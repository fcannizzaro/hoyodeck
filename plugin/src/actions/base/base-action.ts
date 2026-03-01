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

// ─── Account Pick Result ────────────────────────────────────────────

/**
 * Discriminated union returned by `pickAccount()`.
 *
 * - `resolved`    — account found and ready to use
 * - `no-accounts` — no accounts configured at all
 * - `no-uid`      — accounts exist but none has a UID for this game
 * - `ambiguous`   — 2+ accounts match, user must choose
 */
export type AccountPickResult =
  | { kind: 'resolved'; account: HoyoAccount }
  | { kind: 'no-accounts' }
  | { kind: 'no-uid' }
  | { kind: 'ambiguous' };

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
   * Called before any placeholder image is set (showNoAccount, showNoUid, showNoAuth).
   * Subclasses override to clear running animations that would overwrite the placeholder.
   */
  protected onStop(_action: KeyAction<TSettings>): void {}

  // ─── Account Picking ──────────────────────────────────────────────

  /**
   * Deterministic account pick strategy.
   *
   * Only `accountId` is persisted in action settings — never a UID.
   *
   * Pick algorithm (in order):
   * 1. 0 accounts total → `no-accounts`
   * 2. `accountId` in settings + account exists → `resolved`
   * 3. 1 account with game UID → `resolved` (auto-select, persist accountId)
   * 4. 2+ accounts with game UID → `ambiguous`
   * 5. Accounts exist but none has this game's UID → `no-uid`
   */
  protected async pickAccount(
    settings: TSettings,
    game: GameId,
    action?: KeyAction<TSettings>,
  ): Promise<AccountPickResult> {
    const globalSettings = await this.getGlobalSettings();
    const accounts = globalSettings.accounts ?? {};
    const allAccounts = Object.values(accounts);

    // No accounts at all → must log in first
    if (allAccounts.length === 0) {
      return { kind: 'no-accounts' };
    }

    const raw = settings as Record<string, unknown>;
    const storedAccountId = raw['accountId'] as AccountId | undefined;

    // If an explicit accountId is stored, resolve it directly
    if (storedAccountId) {
      const account = accounts[storedAccountId];
      if (account) {
        return { kind: 'resolved', account };
      }
      // Stored accountId no longer exists → fall through to re-pick
    }

    // Find accounts that have a UID for this game
    const candidates = allAccounts.filter((a) => a.uids[game] !== undefined);

    if (candidates.length === 0) {
      return { kind: 'no-uid' };
    }

    if (candidates.length === 1) {
      const selected = candidates[0]!;
      if (action) {
        await action.setSettings({ ...settings, accountId: selected.id });
      }
      return { kind: 'resolved', account: selected };
    }

    return { kind: 'ambiguous' };
  }

  /**
   * Legacy account resolution — kept as a thin wrapper around `pickAccount()`.
   * Returns the resolved account or null.
   */
  protected async resolveAccount(
    settings: TSettings,
    action?: KeyAction<TSettings>,
  ): Promise<HoyoAccount | null> {
    const game = this.getResolvedGame(settings);
    const result = await this.pickAccount(settings, game, action);
    return result.kind === 'resolved' ? result.account : null;
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

  // ─── Display helpers ──────────────────────────────────────────────

  /**
   * Show "Select Account" message with the game's 5-star background and alert
   */
  protected async showNoAccount(action: KeyAction<TSettings>): Promise<void> {
    this.onStop(action);
    const bg = readLocalImageAsDataUri(GAME_BACKGROUNDS[this.game]);
    await action.setImage(bg);
    await action.setTitle('Select\nAccount');
  }

  /**
   * Show "No Auth" message and alert
   */
  protected async showNoAuth(action: KeyAction<TSettings>): Promise<void> {
    this.onStop(action);
    await action.setTitle('Setup\nAuth');
    await action.showAlert();
  }

  /**
   * Show "No UID" message
   */
  protected async showNoUid(action: KeyAction<TSettings>): Promise<void> {
    this.onStop(action);
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

  // ─── Registration ─────────────────────────────────────────────────

  /**
   * Central registration method. Replaces the split logic previously in
   * onWillAppear and onDidReceiveSettings.
   *
   * Handles all pick outcomes:
   * - `no-accounts` / `ambiguous` → show placeholder, watch for account changes
   * - `no-uid` → show placeholder, watch for UID changes
   * - `resolved` → register with DataController, request initial update
   */
  private async attemptRegister(
    actionId: string,
    keyAction: KeyAction<TSettings>,
    settings: TSettings,
  ): Promise<void> {
    // Stop running animations before any async work
    this.onStop(keyAction);

    const game = this.getResolvedGame(settings);
    const result = await this.pickAccount(settings, game, keyAction);

    if (result.kind === 'no-accounts' || result.kind === 'ambiguous') {
      dataController.unregister(actionId);
      await this.showNoAccount(keyAction);
      // Watch for account changes so we auto-retry
      dataController.subscribeAccountChanges(actionId, () => {
        void this.attemptRegister(actionId, keyAction, settings);
      });
      return;
    }

    if (result.kind === 'no-uid') {
      dataController.unregister(actionId);
      await this.showNoUid(keyAction);
      // Watch — UIDs may arrive after auth-validator runs
      dataController.subscribeAccountChanges(actionId, () => {
        void this.attemptRegister(actionId, keyAction, settings);
      });
      return;
    }

    // Resolved — stop watching for account changes
    dataController.unsubscribeAccountChanges(actionId);

    const { account } = result;
    const uid = this.getGameUid(account, game);
    if (!uid) {
      // Account resolved but no UID yet — watch for UID changes
      dataController.unregister(actionId);
      await this.showNoUid(keyAction);
      dataController.subscribeAccountChanges(actionId, () => {
        void this.attemptRegister(actionId, keyAction, settings);
      });
      return;
    }

    // Normal registration
    const dataTypes = this.getSubscribedDataTypes(settings);

    // Skip re-registration if nothing changed
    const existing = dataController.getRegistration(actionId);
    if (
      existing &&
      existing.accountId === account.id &&
      JSON.stringify(existing.dataTypes) === JSON.stringify(dataTypes)
    ) {
      return;
    }

    dataController.unregister(actionId);

    debug.log('[BaseAction] attemptRegister', actionId, '| account:', account.id, '| game:', game, '| types:', dataTypes);

    dataController.register({
      actionId,
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
        // Account deleted → show placeholder and watch for new accounts
        void this.showNoAccount(keyAction);
        dataController.subscribeAccountChanges(actionId, () => {
          void this.attemptRegister(actionId, keyAction, settings);
        });
      },
      onStructureChanged: () => {
        // Any structural change → re-run resolution
        void this.attemptRegister(actionId, keyAction, settings);
      },
    });

    await this.withErrorHandling(keyAction, async () => {
      await dataController.requestUpdate(account.id, game);
    });
  }

  // ─── Lifecycle hooks ──────────────────────────────────────────────

  /**
   * Called when action appears — delegates to attemptRegister.
   */
  override async onWillAppear(
    ev: WillAppearEvent<TSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    this._settingsCache.set(ev.action.id, ev.payload.settings);
    await this.attemptRegister(ev.action.id, ev.action, ev.payload.settings);
  }

  /**
   * Called when action disappears — unregisters from DataController.
   */
  override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
    debug.log('[BaseAction] onWillDisappear', ev.action.id);
    dataController.unregister(ev.action.id);
    dataController.unsubscribeAccountChanges(ev.action.id);
    this._settingsCache.delete(ev.action.id);
  }

  /**
   * Called when per-action settings change — re-runs attemptRegister.
   */
  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<TSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    this._settingsCache.set(ev.action.id, ev.payload.settings);
    await this.attemptRegister(ev.action.id, ev.action, ev.payload.settings);
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

      const game = this.getResolvedGame(settings);
      const pickResult = await this.pickAccount(settings, game);
      if (pickResult.kind !== 'resolved') return;

      await dataController.requestUpdate(pickResult.account.id, game);
    }
  }

  /**
   * Called when key is pressed — request instant data refresh.
   */
  override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
    debug.log('[BaseAction] onKeyDown', ev.action.id);
    this._settingsCache.set(ev.action.id, ev.payload.settings);

    const settings = ev.payload.settings;
    const game = this.getResolvedGame(settings);
    const pickResult = await this.pickAccount(settings, game);
    if (pickResult.kind !== 'resolved') return;

    await this.withErrorHandling(ev.action, async () => {
      await dataController.requestUpdate(pickResult.account.id, game);
    });
  }
}
