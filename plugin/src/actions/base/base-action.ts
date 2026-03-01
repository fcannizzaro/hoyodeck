import streamDeck, {
  type KeyAction,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type KeyDownEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
} from '@elgato/streamdeck';
import type { JsonObject, JsonValue } from '@elgato/utils';
import { HoyolabClient } from '@/api/hoyolab/client';
import { isAuthError, isRateLimitError } from '@/api/types/common';
import { readLocalImageAsDataUri } from '@/utils/image';
import type {
  GlobalSettings,
  HoyoAccount,
  AccountId,
} from '@/types/settings';
import type { GameId } from '@/types/games';
import { dataController } from '@/services/data-controller';
import type { DataEntry, DataType, SuccessDataUpdate } from '@/services/data-controller.types';
import { debug } from '@/utils/debug';

/** 5-star background image paths per game, used for the "Select Account" state */
const GAME_BACKGROUNDS: Record<GameId, string> = {
  gi: 'imgs/actions/gi/5-star.webp',
  hsr: 'imgs/actions/hsr/5-star.png',
  zzz: 'imgs/actions/zzz/5-star.png',
};

/**
 * Resolved account context — everything an action needs to operate.
 */
export interface AccountContext {
  account: HoyoAccount;
  client: HoyolabClient;
}

/**
 * Base action class with common functionality for all Hoyo Deck actions.
 *
 * Uses DataController for data lifecycle:
 * - Registers on onWillAppear, unregisters on onWillDisappear
 * - Receives pushed data updates via onDataUpdate()
 * - Requests instant updates on key press via dataController.requestUpdate()
 */
export abstract class BaseAction<
  TSettings extends JsonObject = JsonObject,
  TDataType extends DataType = DataType,
> extends SingletonAction<TSettings> {
  /** Game identifier for this action */
  protected abstract readonly game: GameId;

  /**
   * Per-action settings cache.
   * Avoids calling `action.getSettings()` (which triggers a WebSocket
   * round-trip and re-fires `onDidReceiveSettings`, causing infinite loops).
   * Updated from event payloads in onWillAppear and onDidReceiveSettings.
   */
  private readonly _settingsCache = new Map<string, TSettings>();

  /**
   * Re-entrancy guard for onDidReceiveSettings.
   * Prevents infinite loops when code inside the handler indirectly
   * triggers another didReceiveSettings event (e.g. via setSettings).
   */
  private readonly _settingsProcessing = new Set<string>();

  /**
   * Get the last-known settings for an action from the local cache.
   * This is safe to call from onDataUpdate without triggering
   * additional didReceiveSettings events.
   */
  protected getCachedSettings(actionId: string): TSettings | undefined {
    return this._settingsCache.get(actionId);
  }

  /**
   * Get the global settings
   */
  protected async getGlobalSettings(): Promise<GlobalSettings> {
    return (await streamDeck.settings.getGlobalSettings()) as unknown as GlobalSettings;
  }

  /**
   * Get the game ID used for account resolution.
   * Override in multi-game actions (e.g. DailyReward) to return the settings-based game.
   */
  protected getResolvedGame(_settings: TSettings): GameId {
    return this.game;
  }

  /**
   * Return the data types this action subscribes to.
   * Called during registration (onWillAppear, onDidReceiveSettings).
   * Most actions return a fixed array; DailyRewardAction returns
   * a settings-dependent value.
   */
  protected abstract getSubscribedDataTypes(settings: TSettings): DataType[];

  /**
   * Called when the DataController pushes new data.
   * Subclasses implement this to re-render with fresh data.
   * Error entries are handled automatically by the base class — subclasses
   * only receive updates with status === 'ok'.
   */
  protected abstract onDataUpdate(
    action: KeyAction<TSettings>,
    update: SuccessDataUpdate<TDataType>,
  ): Promise<void>;

  /**
   * Called before every data update (success or error).
   * Override in subclasses to clear animations or reset state.
   */
  protected onBeforeDataUpdate(_action: KeyAction<TSettings>): void {}

  /**
   * Resolve the account referenced by this action's settings.
   * Returns null if no account is selected or the account was deleted.
   *
   * Handles three resolution strategies:
   * 1. accountId is set -> look up in globalSettings.accounts
   * 2. Legacy uid is set but no accountId -> find matching account by UID
   * 3. Exactly one account has a UID for this game -> auto-select and persist
   */
  protected async resolveAccount(
    settings: TSettings,
    action?: KeyAction<TSettings>,
  ): Promise<HoyoAccount | null> {
    const raw = settings as Record<string, unknown>;
    const globalSettings = await this.getGlobalSettings();
    const accounts = globalSettings.accounts ?? {};

    const accountId = raw['accountId'] as AccountId | undefined;
    if (accountId) {
      return accounts[accountId] ?? null;
    }

    // Auto-select: if exactly one account has a UID for this game, use it
    const game = this.getResolvedGame(settings);
    const candidates = Object.values(accounts).filter(
      (a) => a.uids[game] !== undefined,
    );

    if (candidates.length === 1) {
      debug.log('[BaseAction] resolveAccount | auto-selected by game uid, account:', candidates[0]!.id);
      const selected = candidates[0]!;
      if (action) {
        await action.setSettings({ ...settings, accountId: selected.id });
      }
      return selected;
    }

    // Broader fallback: if only one account exists total, use it
    // (handles the case where UIDs haven't been detected yet)
    const allAccounts = Object.values(accounts);
    if (allAccounts.length === 1) {
      debug.log('[BaseAction] resolveAccount | auto-selected sole account:', allAccounts[0]!.id);
      const selected = allAccounts[0]!;
      if (action) {
        await action.setSettings({ ...settings, accountId: selected.id });
      }
      return selected;
    }

    debug.log('[BaseAction] resolveAccount | no account resolved');
    return null;
  }
  protected getClientForAccount(account: HoyoAccount): HoyolabClient | null {
    return dataController.getClient(account);
  }

  /**
   * Get full account context: resolved account + client.
   * Returns null if account not found or auth invalid.
   */
  protected async getAccountContext(
    settings: TSettings,
    action?: KeyAction<TSettings>,
  ): Promise<AccountContext | null> {
    const account = await this.resolveAccount(settings, action);
    if (!account) return null;

    const client = this.getClientForAccount(account);
    if (!client) return null;

    return { account, client };
  }

  /**
   * Get the UID for a specific game from the selected account.
   */
  protected getGameUid(account: HoyoAccount, game: GameId): string | null {
    return account.uids[game] ?? null;
  }

  /**
   * Show "Select Account" message with the game's 5-star background and alert
   */
  protected async showNoAccount(action: KeyAction<TSettings>): Promise<void> {
    const bg = readLocalImageAsDataUri(GAME_BACKGROUNDS[this.game]);
    await action.setImage(bg);
    await action.setTitle('Select\nAccount');
  }

  /**
   * Show "No Auth" message and alert
   */
  protected async showNoAuth(action: KeyAction<TSettings>): Promise<void> {
    await action.setTitle('Setup\nAuth');
    await action.showAlert();
  }

  /**
   * Show "No UID" message
   */
  protected async showNoUid(action: KeyAction<TSettings>): Promise<void> {
    await action.setTitle('Set\nUID');
    await action.showAlert();
  }

  /**
   * Show error state
   */
  protected async showError(
    action: KeyAction<TSettings>,
    message?: string,
  ): Promise<void> {
    await action.setTitle(message ?? 'Error');
    await action.showAlert();
  }

  /**
   * Show appropriate error based on a DataEntry's error type.
   * Auth errors → "Setup Auth", rate limits → "Rate Limited", others → "Error".
   */
  protected async showDataError(
    action: KeyAction<TSettings>,
    entry: DataEntry<unknown>,
  ): Promise<void> {
    if (entry.status !== 'error') return;
    if (isAuthError(entry.error)) {
      await this.showNoAuth(action);
    } else if (isRateLimitError(entry.error)) {
      await this.showError(action, 'Rate\nLimited');
    } else {
      await this.showError(action);
    }
  }

  /**
   * Wrap action execution with error handling
   */
  protected async withErrorHandling(
    action: KeyAction<TSettings>,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      streamDeck.logger.error('Action error:', error);
      if (isAuthError(error)) {
        await this.showNoAuth(action);
      } else if (isRateLimitError(error)) {
        await this.showError(action, 'Rate\nLimited');
      } else {
        await this.showError(action);
      }
    }
  }

  /**
   * Called when action appears — registers with DataController.
   */
  override async onWillAppear(
    ev: WillAppearEvent<TSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    const keyAction = ev.action;
    this._settingsCache.set(ev.action.id, ev.payload.settings);

    const account = await this.resolveAccount(ev.payload.settings, keyAction);
    if (!account) {
      await this.showNoAccount(keyAction);
      return;
    }

    debug.log('[BaseAction] onWillAppear', ev.action.id, '| account:', account.id, '| game:', this.getResolvedGame(ev.payload.settings));

    const game = this.getResolvedGame(ev.payload.settings);
    const uid = this.getGameUid(account, game);
    debug.log('[BaseAction] onWillAppear', ev.action.id, '| uid:', uid ?? 'none');
    if (!uid) {
      await this.showNoUid(keyAction);
      return;
    }

    // Register with DataController
    const subscribedTypes = this.getSubscribedDataTypes(ev.payload.settings);
    debug.log('[BaseAction] onWillAppear', ev.action.id, '| registering, dataTypes:', subscribedTypes);
    dataController.register({
      actionId: ev.action.id,
      accountId: account.id,
      dataTypes: subscribedTypes,
      listener: (update) => {
        void this.withErrorHandling(keyAction, async () => {
          this.onBeforeDataUpdate(keyAction);
          if (update.entry.status === 'error') {
            await this.showDataError(keyAction, update.entry);
            return;
          }
          await this.onDataUpdate(keyAction, update as SuccessDataUpdate<TDataType>);
        });
      },
      onAccountRemoved: () => {
        void this.showNoAccount(keyAction);
      },
    });

    // Request immediate data for first render
    debug.log('[BaseAction] onWillAppear', ev.action.id, '| requesting initial update');
    await this.withErrorHandling(keyAction, async () => {
      await dataController.requestUpdate(account.id, game);
    });
  }

  /**
   * Called when action disappears — unregisters from DataController.
   */
  override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
    debug.log('[BaseAction] onWillDisappear', ev.action.id);
    dataController.unregister(ev.action.id);
    this._settingsCache.delete(ev.action.id);
  }

  /**
   * Called when per-action settings change — re-registers with DataController
   * only if the account or subscribed data types actually changed.
   */
  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<TSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;

    // Re-entrancy guard: action.getSettings() triggers a didReceiveSettings
    // round-trip through the SDK. If we're already processing for this action,
    // skip to prevent infinite loops.
    if (this._settingsProcessing.has(ev.action.id)) return;
    this._settingsProcessing.add(ev.action.id);
    this._settingsCache.set(ev.action.id, ev.payload.settings);

    try {

    // If no registration exists, onWillAppear hasn't finished yet — let it handle setup.
    // This prevents the churn caused by resolveAccount's auto-select calling setSettings,
    // which triggers onDidReceiveSettings before onWillAppear has registered the action.
    const existing = dataController.getRegistration(ev.action.id);
    if (!existing) {
      debug.log('[BaseAction] onDidReceiveSettings', ev.action.id, '| skipped — no registration yet');
      return;
    }

    const keyAction = ev.action;

    const account = await this.resolveAccount(ev.payload.settings);

    if (!account) {
      debug.log('[BaseAction] onDidReceiveSettings', ev.action.id, '| no account, unregistering');
      dataController.unregister(ev.action.id);
      await this.showNoAccount(keyAction);
      return;
    }

    const game = this.getResolvedGame(ev.payload.settings);
    const uid = this.getGameUid(account, game);

    if (!uid) {
      debug.log('[BaseAction] onDidReceiveSettings', ev.action.id, '| no uid, unregistering');
      dataController.unregister(ev.action.id);
      await this.showNoUid(keyAction);
      return;
    }

    const dataTypes = this.getSubscribedDataTypes(ev.payload.settings);

    // Skip re-registration if nothing meaningful changed
    if (
      existing.accountId === account.id &&
      existing.dataTypes.length === dataTypes.length &&
      existing.dataTypes.every((dt, i) => dt === dataTypes[i])
    ) {
      debug.log('[BaseAction] onDidReceiveSettings', ev.action.id, '| subscription unchanged, re-rendering from cache');
      // Display-only settings may have changed — re-render from cached data
      for (const dt of dataTypes) {
        const entry = dataController.getData(account.id, dt);
        if (entry?.status === 'ok') {
          // Clear animations/state before re-render (e.g. blink in banner actions)
          this.onBeforeDataUpdate(keyAction);
          await this.withErrorHandling(keyAction, async () => {
            await this.onDataUpdate(keyAction, { accountId: account.id, dataType: dt, entry } as SuccessDataUpdate<TDataType>);
          });
        }
      }
      return;
    }

    debug.log('[BaseAction] onDidReceiveSettings', ev.action.id, '| subscription changed, re-registering');
    // Unregister old subscription and re-register with new params
    dataController.unregister(ev.action.id);

    dataController.register({
      actionId: ev.action.id,
      accountId: account.id,
      dataTypes,
      listener: (update) => {
        void this.withErrorHandling(keyAction, async () => {
          this.onBeforeDataUpdate(keyAction);
          if (update.entry.status === 'error') {
            await this.showDataError(keyAction, update.entry);
            return;
          }
          await this.onDataUpdate(keyAction, update as SuccessDataUpdate<TDataType>);
        });
      },
      onAccountRemoved: () => {
        void this.showNoAccount(keyAction);
      },
    });

    // Fetch fresh data for new settings
    await this.withErrorHandling(keyAction, async () => {
      await dataController.requestUpdate(account.id, game);
    });

    } finally {
      this._settingsProcessing.delete(ev.action.id);
    }
  }

  /**
   * Handle PI -> Plugin "refresh" event.
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, TSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    const payload = ev.payload as Record<string, unknown>;
    if (payload.event === 'refresh') {
      debug.log('[BaseAction] onSendToPlugin | refresh', ev.action.id);
      const keyAction = ev.action;
      const settings = this._settingsCache.get(ev.action.id) as TSettings | undefined;
      if (!settings) return;

      const account = await this.resolveAccount(settings);
      if (!account) return;

      const game = this.getResolvedGame(settings);
      await dataController.requestUpdate(account.id, game);
    }
  }

  /**
   * Called when key is pressed — request instant data refresh.
   */
  override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
    debug.log('[BaseAction] onKeyDown', ev.action.id);
    this._settingsCache.set(ev.action.id, ev.payload.settings);
    const account = await this.resolveAccount(ev.payload.settings);
    if (!account) return;

    const game = this.getResolvedGame(ev.payload.settings);

    await this.withErrorHandling(ev.action, async () => {
      await dataController.requestUpdate(account.id, game);
    });
  }
}
