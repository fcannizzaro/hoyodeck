import streamDeck from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import type {
  AccountId,
  GlobalSettings,
  HoyoAccount,
} from '@/types/settings';
import type { GameId } from '@/types/games';
import { HoyolabClient } from '@/api/hoyolab/client';
import { isValidAuth } from '@/api/hoyolab/auth';
import type { HoyoAuth } from '@/api/hoyolab/auth';
import { isAuthError } from '@/api/types/common';
import { debug } from '@/utils/debug';
import { toJsonObject } from '@/types/settings';
import type {
  DataType,
  DataTypeMap,
  DataEntry,
  DataStoreKey,
  ActionRegistration,
} from './data-controller.types';
import { DEFAULT_POLL_INTERVAL_MS } from './data-controller.types';
import { SubscriptionIndex } from './subscription-index';
import { GenshinController } from './game-controllers/genshin-controller';
import { HSRController } from './game-controllers/hsr-controller';
import { ZZZController } from './game-controllers/zzz-controller';
import type { BaseGameController } from './game-controllers/base-game-controller';

/**
 * Centralized data lifecycle manager.
 *
 * Owns:
 * - Polling timer (single interval for all games)
 * - Data store (latest fetch results per account+dataType)
 * - Subscription registry (actions register/unregister for data updates)
 * - HoyolabClient instances (one per account)
 *
 * Push model: on each poll tick, fetches data for all active accounts,
 * then notifies subscribed actions so they re-render immediately.
 */
class DataControllerImpl {
  // ─── Config ──────────────────────────────────────────────────────
  private pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS;

  // ─── Game Sub-Controllers ────────────────────────────────────────
  private readonly gameControllers: Record<GameId, BaseGameController> = {
    gi: new GenshinController(),
    hsr: new HSRController(),
    zzz: new ZZZController(),
  };

  // ─── Data Store ──────────────────────────────────────────────────
  /** Latest data per account+dataType */
  private readonly store = new Map<DataStoreKey, DataEntry<unknown>>();

  // ─── Client Cache ────────────────────────────────────────────────
  /** One HoyolabClient per account (for fetching + write operations) */
  private readonly clientCache = new Map<AccountId, HoyolabClient>();

  // ─── Subscriptions ───────────────────────────────────────────────
  /**
   * All active registrations, keyed by actionId.
   * Each registration specifies which account + dataTypes it cares about.
   */
  private readonly registrations = new Map<string, ActionRegistration>();

  /**
   * Actions waiting for account structure changes (not yet registered with DataController).
   * Used by actions in no-accounts / ambiguous / no-uid states to auto-retry.
   */
  private readonly accountChangeSubscribers = new Map<string, () => void>();

  /** Pre-computed index of active subscriptions per account+game+dataType. */
  private readonly subscriptionIndex = new SubscriptionIndex();

  // ─── Polling ─────────────────────────────────────────────────────
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Whether a poll cycle is currently running (prevents overlap) */
  private polling = false;

  /** In-flight fetch promises for request deduplication, keyed by `${accountId}:${game}` */
  private readonly inflight = new Map<string, Promise<void>>();

  // ─── Global Settings Diffing ────────────────────────────────────
  /** Previous accounts snapshot for diffing */
  private previousAccounts: Record<AccountId, HoyoAccount> | undefined;

  /** Previous disableAnimations value for diffing */
  private previousDisableAnimations = false;

  /** Previous banner badge settings for diffing */
  private previousBannerBadgePosition = "center";
  private previousBannerBadgeLayout = "horizontal";
  private previousBannerBadgeFontSize = 18;

  /** Debounce timer for global settings changes */
  private settingsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Debounce delay in milliseconds for coalescing rapid global settings changes */
  private static readonly SETTINGS_DEBOUNCE_MS = 500;

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Whether animations are currently disabled by global preference.
   * Actions call this synchronously during rendering.
   */
  isAnimationDisabled(): boolean {
    return this.previousDisableAnimations;
  }

  /**
   * Initialize the global settings listener for diff-based invalidation.
   * Must be called once at plugin startup before actions are registered.
   */
  init(): void {
    debug.log('[DataController] init');
    // Seed initial preference values
    void streamDeck.settings.getGlobalSettings().then((s) => {
      const settings = s as unknown as GlobalSettings;
      this.previousDisableAnimations = settings.disableAnimations ?? false;
      this.previousBannerBadgePosition = settings.bannerBadgePosition ?? "center";
      this.previousBannerBadgeLayout = settings.bannerBadgeLayout ?? "horizontal";
      this.previousBannerBadgeFontSize = settings.bannerBadgeFontSize ?? 18;
      this.previousAccounts = structuredClone(settings.accounts ?? {});
    });

    streamDeck.settings.onDidReceiveGlobalSettings<JsonObject>((ev) => {
      if (this.settingsDebounceTimer) {
        clearTimeout(this.settingsDebounceTimer);
      }

      const settings = ev.settings as unknown as GlobalSettings;

      this.settingsDebounceTimer = setTimeout(() => {
        this.settingsDebounceTimer = null;
        this.onGlobalSettingsChanged(settings);
      }, DataControllerImpl.SETTINGS_DEBOUNCE_MS);
    });
  }

  /**
   * Register an action instance to receive data updates.
   *
   * If cached data already exists for any of the requested dataTypes,
   * the listener is called immediately with that data.
   *
   * Starts polling if this is the first registration.
   */
  register(registration: ActionRegistration): void {
    debug.log('[DataController] register', registration.actionId, '| account:', registration.accountId, '| types:', registration.dataTypes);
    // Skip if already registered with the same account and data types
    const existing = this.registrations.get(registration.actionId);
    if (
      existing &&
      existing.accountId === registration.accountId &&
      existing.dataTypes.length === registration.dataTypes.length &&
      existing.dataTypes.every((dt, i) => dt === registration.dataTypes[i])
    ) {
      debug.log('[DataController] register', registration.actionId, '| skipped — duplicate');
      return;
    }

    // If replacing an existing registration, remove old subscriptions first
    if (existing) {
      this.subscriptionIndex.remove(existing.accountId, existing.dataTypes);
    }

    this.registrations.set(registration.actionId, registration);
    this.subscriptionIndex.add(registration.accountId, registration.dataTypes);
    streamDeck.logger.debug(
      `[DataController] Registered ${registration.actionId} for ${registration.dataTypes.join(', ')}`,
    );

    // Push any cached data immediately
    for (const dataType of registration.dataTypes) {
      const key = this.buildStoreKey(registration.accountId, dataType);
      const entry = this.store.get(key);
      if (entry) {
        debug.log('[DataController] register', registration.actionId, '| pushing cached', dataType, '| status:', entry.status);
        try {
          registration.listener({
            accountId: registration.accountId,
            dataType,
            entry: entry as DataEntry<DataTypeMap[typeof dataType]>,
          });
        } catch (err) {
          streamDeck.logger.error(
            `[DataController] Listener error on register push for ${registration.actionId}:`,
            err,
          );
        }
      }
    }

    this.startPollingIfNeeded();
  }

  /**
   * Unregister an action instance.
   * Stops polling if no registrations remain.
   */
  unregister(actionId: string): void {
    debug.log('[DataController] unregister', actionId);
    const existing = this.registrations.get(actionId);
    if (existing) {
      this.subscriptionIndex.remove(existing.accountId, existing.dataTypes);
    }

    this.registrations.delete(actionId);
    streamDeck.logger.debug(`[DataController] Unregistered ${actionId}`);

    if (!this.subscriptionIndex.hasSubscriptions) {
      debug.log('[DataController] unregister | no subscriptions left, stopping poll');
      this.stopPolling();
    }
  }

  /**
   * Get the current registration for an action.
   * Used by BaseAction to check if re-registration is needed.
   */
  getRegistration(actionId: string): ActionRegistration | undefined {
    return this.registrations.get(actionId);
  }

  /**
   * Subscribe to account structure changes (add/delete/UID change).
   * Used by actions in non-resolved states to auto-retry when accounts change.
   */
  subscribeAccountChanges(actionId: string, cb: () => void): void {
    this.accountChangeSubscribers.set(actionId, cb);
  }

  /**
   * Unsubscribe from account structure changes.
   */
  unsubscribeAccountChanges(actionId: string): void {
    this.accountChangeSubscribers.delete(actionId);
  }

  /**
   * Read cached data synchronously. Returns undefined if not yet fetched.
   */
  getData<T extends DataType>(
    accountId: AccountId,
    dataType: T,
  ): DataEntry<DataTypeMap[T]> | undefined {
    const key = this.buildStoreKey(accountId, dataType);
    return this.store.get(key) as DataEntry<DataTypeMap[T]> | undefined;
  }

  /**
   * Request an immediate data refresh for a specific account + game.
   * Fetches all data types that have active subscribers for this account+game,
   * then notifies listeners. Returns when fetching is complete.
   *
   * Concurrent calls for the same account+game are coalesced: only one network
   * fetch runs and all callers share the same Promise.
   *
   * Use for key-press "refresh now" scenarios.
   */
  async requestUpdate(accountId: AccountId, game: GameId): Promise<void> {
    const typesNeeded = this.subscriptionIndex.getActiveDataTypes(accountId, game);
    debug.log('[DataController] requestUpdate', accountId, game, '| types:', typesNeeded);
    if (typesNeeded.length === 0) {
      debug.log('[DataController] requestUpdate', accountId, game, '| no active types');
      return;
    }

    const key = `${accountId}:${game}`;
    const existing = this.inflight.get(key);
    if (existing) {
      debug.log('[DataController] requestUpdate', accountId, game, '| dedup — joining inflight');
      await existing;
      // Inflight may not have fetched our types (registered after it started).
      // Check if any needed types are still missing from the store.
      const stillMissing = typesNeeded.some(
        dt => !this.store.has(this.buildStoreKey(accountId, dt)),
      );
      if (stillMissing) {
        debug.log('[DataController] requestUpdate', accountId, game, '| follow-up — types missing after inflight');
        return this.requestUpdate(accountId, game);
      }
      return;
    }

    const promise = this.fetchAndNotify(accountId, game, typesNeeded).finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Get or create a HoyolabClient for write operations (e.g. claimCheckIn).
   * Returns null if the account has invalid auth.
   */
  getClient(account: HoyoAccount): HoyolabClient | null {
    if (!isValidAuth(account.auth)) return null;

    const existing = this.clientCache.get(account.id);
    if (existing) return existing;

    const client = new HoyolabClient(account.auth as HoyoAuth);
    this.clientCache.set(account.id, client);
    return client;
  }

  /**
   * Invalidate all cached data and client for a specific account.
   * Called when account auth changes or account is deleted.
   */
  invalidateAccount(accountId: AccountId): void {
    debug.log('[DataController] invalidateAccount', accountId);
    this.clientCache.delete(accountId);

    for (const key of [...this.store.keys()]) {
      if (key.startsWith(`${accountId}:`)) {
        this.store.delete(key);
      }
    }

    streamDeck.logger.debug(
      `[DataController] Invalidated account ${accountId}`,
    );
  }

  /**
   * Notify all actions registered to a deleted account and unregister them.
   * Each action's onAccountRemoved callback is called so it can show "Select Account".
   */
  private notifyAccountRemoved(accountId: AccountId): void {
    for (const [actionId, reg] of this.registrations) {
      if (reg.accountId !== accountId) continue;

      try {
        reg.onAccountRemoved?.();
      } catch (err) {
        streamDeck.logger.error(
          `[DataController] onAccountRemoved error for ${actionId}:`,
          err,
        );
      }

      this.subscriptionIndex.remove(reg.accountId, reg.dataTypes);
      this.registrations.delete(actionId);
    }
  }

  /**
   * Invalidate all accounts and clients.
   * Used internally as a fallback; prefer invalidateAccount() for targeted invalidation.
   */
  private invalidateAll(): void {
    this.clientCache.clear();
    this.store.clear();
    streamDeck.logger.debug('[DataController] Invalidated all data');
  }

  /**
   * Update polling interval. Takes effect on the next tick.
   */
  setPollingInterval(ms: number): void {
    this.pollIntervalMs = ms;

    // Restart timer with new interval if currently polling
    if (this.pollTimer) {
      this.stopPolling();
      this.startPollingIfNeeded();
    }
  }

  // ─── Polling Logic ───────────────────────────────────────────────

  /**
   * Diff old vs new accounts and invalidate only what changed.
   * Called after debounce when global settings change.
   */
  private onGlobalSettingsChanged(settings: GlobalSettings): void {
    const newAccounts = settings.accounts ?? {};
    const oldAccounts = this.previousAccounts ?? {};

    // Save snapshot for next diff
    this.previousAccounts = structuredClone(newAccounts);

    let structureChanged = false;

    // Check for deleted accounts
    for (const accountId of Object.keys(oldAccounts)) {
      if (!(accountId in newAccounts)) {
        debug.log('[DataController] globalSettingsChanged | account deleted:', accountId);
        streamDeck.logger.debug(
          `[DataController] Account ${accountId} deleted, invalidating`,
        );
        this.invalidateAccount(accountId as AccountId);
        this.notifyAccountRemoved(accountId as AccountId);
        structureChanged = true;
      }
    }

    // Check for added accounts and auth/UID changes on existing accounts
    for (const [accountId, newAccount] of Object.entries(newAccounts)) {
      const oldAccount = oldAccounts[accountId as AccountId];

      if (!oldAccount) {
        // New account added
        debug.log('[DataController] globalSettingsChanged | account added:', accountId);
        structureChanged = true;
        continue;
      }

      if (!this.authEqual(oldAccount.auth, newAccount.auth)) {
        debug.log('[DataController] globalSettingsChanged | auth changed:', accountId);
        streamDeck.logger.debug(
          `[DataController] Auth changed for account ${accountId}, invalidating`,
        );
        this.invalidateAccount(accountId as AccountId);
      }

      if (!this.uidsEqual(oldAccount.uids, newAccount.uids)) {
        debug.log('[DataController] globalSettingsChanged | UIDs changed:', accountId);
        structureChanged = true;
      }
    }

    if (structureChanged) {
      this.notifyAccountStructureChanged();
    }

    // Detect rendering preference changes that require re-render
    let needsRenotify = false;

    const newDisableAnimations = settings.disableAnimations ?? false;
    if (newDisableAnimations !== this.previousDisableAnimations) {
      this.previousDisableAnimations = newDisableAnimations;
      needsRenotify = true;
    }

    const newBadgePosition = settings.bannerBadgePosition ?? "center";
    const newBadgeLayout = settings.bannerBadgeLayout ?? "horizontal";
    const newBadgeFontSize = settings.bannerBadgeFontSize ?? 18;

    if (
      newBadgePosition !== this.previousBannerBadgePosition ||
      newBadgeLayout !== this.previousBannerBadgeLayout ||
      newBadgeFontSize !== this.previousBannerBadgeFontSize
    ) {
      this.previousBannerBadgePosition = newBadgePosition;
      this.previousBannerBadgeLayout = newBadgeLayout;
      this.previousBannerBadgeFontSize = newBadgeFontSize;
      needsRenotify = true;
    }

    if (needsRenotify) {
      debug.log('[DataController] globalSettingsChanged | renotifying all (prefs changed)');
      this.renotifyAll();
    }
  }

  /**
   * Shallow comparison of auth cookie objects.
   */
  private authEqual(a: HoyoAuth, b: HoyoAuth): boolean {
    return (
      a.ltoken_v2 === b.ltoken_v2 &&
      a.ltuid_v2 === b.ltuid_v2 &&
      a.ltmid_v2 === b.ltmid_v2 &&
      a.cookie_token_v2 === b.cookie_token_v2 &&
      a.account_mid_v2 === b.account_mid_v2 &&
      a.account_id_v2 === b.account_id_v2
    );
  }

  /**
   * Shallow comparison of UID maps.
   */
  private uidsEqual(
    a: Partial<Record<string, string>>,
    b: Partial<Record<string, string>>,
  ): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => a[k] === b[k]);
  }

  /**
   * Notify all account-change subscribers and all registered actions
   * with an `onStructureChanged` callback.
   */
  private notifyAccountStructureChanged(): void {
    for (const [, cb] of this.accountChangeSubscribers) {
      try { cb(); } catch (err) {
        streamDeck.logger.error('[DataController] accountChangeSubscriber error:', err);
      }
    }
    for (const [, reg] of this.registrations) {
      if (!reg.onStructureChanged) continue;
      try { reg.onStructureChanged(); } catch (err) {
        streamDeck.logger.error('[DataController] onStructureChanged error:', err);
      }
    }
  }

  /**
   * Re-push cached data to all registered listeners.
   * Used when a global preference changes that affects rendering.
   */
  private renotifyAll(): void {
    debug.log('[DataController] renotifyAll |', this.registrations.size, 'registrations');
    for (const reg of this.registrations.values()) {
      for (const dataType of reg.dataTypes) {
        const key = this.buildStoreKey(reg.accountId, dataType);
        const entry = this.store.get(key);
        if (entry) {
          try {
            reg.listener({
              accountId: reg.accountId,
              dataType,
              entry: entry as DataEntry<DataTypeMap[typeof dataType]>,
            });
          } catch (err) {
            streamDeck.logger.error(
              `[DataController] Listener error on renotify for ${reg.actionId}:`,
              err,
            );
          }
        }
      }
    }
  }

  private startPollingIfNeeded(): void {
    if (this.pollTimer) return;
    if (!this.subscriptionIndex.hasSubscriptions) return;

    streamDeck.logger.info(
      `[DataController] Starting polling (interval: ${this.pollIntervalMs}ms)`,
    );

    this.pollTimer = setInterval(() => {
      void this.pollTick();
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (!this.pollTimer) return;

    clearInterval(this.pollTimer);
    this.pollTimer = null;
    streamDeck.logger.info('[DataController] Stopped polling');
  }

  /**
   * Single poll tick: determine active accounts+games, fetch all, notify.
   */
  private async pollTick(): Promise<void> {
    if (this.polling) {
      debug.log('[DataController] pollTick | skipped — already running');
      streamDeck.logger.debug(
        '[DataController] Poll tick skipped (already running)',
      );
      return;
    }

    this.polling = true;
    debug.log('[DataController] pollTick | starting');

    try {
      const activeMap = this.subscriptionIndex.getActiveAccountGames();
      debug.log('[DataController] pollTick | accounts:', [...activeMap.entries()].map(([id, g]) => `${id}:[${[...g].join(',')}]`));

      const promises: Promise<void>[] = [];

      for (const [accountId, games] of activeMap) {
        for (const game of games) {
          const typesNeeded = this.subscriptionIndex.getActiveDataTypes(accountId, game);
          if (typesNeeded.length > 0) {
            promises.push(this.fetchAndNotify(accountId, game, typesNeeded));
          }
        }
      }

      await Promise.allSettled(promises);
    } finally {
      this.polling = false;
    }
  }

  // ─── Internal Helpers ────────────────────────────────────────────

  /**
   * Fetch data for one account+game, store results, notify listeners.
   */
  private async fetchAndNotify(
    accountId: AccountId,
    game: GameId,
    dataTypes: DataType[],
  ): Promise<void> {
    debug.log('[DataController] fetchAndNotify', accountId, game, '| types:', dataTypes);
    const account = await this.resolveAccount(accountId);
    if (!account) {
      streamDeck.logger.warn(
        `[DataController] Account ${accountId} not found, skipping fetch`,
      );
      return;
    }

    const client = this.getClient(account);
    if (!client) {
      streamDeck.logger.warn(
        `[DataController] Invalid auth for account ${accountId}, skipping fetch`,
      );
      return;
    }

    const uid = account.uids[game];
    if (!uid) {
      streamDeck.logger.debug(
        `[DataController] No UID for ${game} on account ${accountId}, skipping`,
      );
      return;
    }

    const controller = this.gameControllers[game];
    const results = await controller.fetchAll(client, uid, dataTypes);
    debug.log('[DataController] fetchAndNotify', accountId, game, '| results:', [...results.entries()].map(([dt, e]) => `${dt}:${e.status}`));

    // Store + notify
    for (const [dataType, entry] of results) {
      const storeKey = this.buildStoreKey(accountId, dataType);
      this.store.set(storeKey, entry);
      this.notifyListeners(accountId, dataType, entry);
    }

    // If any result was an auth error, mark the account as invalid in global settings
    await this.invalidateAuthIfNeeded(accountId, results);
  }

  /**
   * If any fetch result contains an auth error, mark the account's authStatus
   * as "invalid" so the Property Inspector reflects expired cookies.
   */
  private async invalidateAuthIfNeeded(
    accountId: AccountId,
    results: Map<DataType, DataEntry<unknown>>,
  ): Promise<void> {
    const hasAuthError = [...results.values()].some(
      (entry) => entry.status === 'error' && isAuthError(entry.error),
    );
    if (!hasAuthError) return;

    const globalSettings =
      (await streamDeck.settings.getGlobalSettings()) as unknown as GlobalSettings;
    const account = globalSettings.accounts?.[accountId];
    if (!account || account.authStatus === 'invalid') return;

    await streamDeck.settings.setGlobalSettings(
      toJsonObject({
        ...globalSettings,
        accounts: {
          ...globalSettings.accounts,
          [accountId]: { ...account, authStatus: 'invalid' },
        },
      }),
    );
  }

  /**
   * Notify all registered listeners that care about this account+dataType.
   */
  private notifyListeners(
    accountId: AccountId,
    dataType: DataType,
    entry: DataEntry<unknown>,
  ): void {
    debug.log('[DataController] notifyListeners', accountId, dataType, '| status:', entry.status);
    for (const reg of this.registrations.values()) {
      if (reg.accountId !== accountId) continue;
      if (!reg.dataTypes.includes(dataType)) continue;

      try {
        reg.listener({
          accountId,
          dataType,
          entry: entry as DataEntry<DataTypeMap[typeof dataType]>,
        });
      } catch (err) {
        streamDeck.logger.error(
          `[DataController] Listener error for ${reg.actionId}:`,
          err,
        );
      }
    }
  }

  /**
   * Look up an account from global settings.
   */
  private async resolveAccount(
    accountId: AccountId,
  ): Promise<HoyoAccount | null> {
    const globalSettings =
      (await streamDeck.settings.getGlobalSettings()) as unknown as GlobalSettings;
    return globalSettings.accounts?.[accountId] ?? null;
  }

  private buildStoreKey(
    accountId: AccountId,
    dataType: DataType,
  ): DataStoreKey {
    return `${accountId}:${dataType}` as DataStoreKey;
  }
}

/** Singleton instance */
export const dataController = new DataControllerImpl();
