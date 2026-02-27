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
 * Result of the account auto-pick strategy.
 *
 * - `resolved`: a valid account was found and should be used
 * - `no-accounts`: no accounts configured at all → show login prompt in PI
 * - `no-uid`: account found but has no UID for this game → show "Set UID"
 * - `ambiguous`: 2+ accounts have a UID for this game → user must pick in PI
 */
export type AccountPickResult =
  | { kind: 'resolved'; account: HoyoAccount }
  | { kind: 'no-accounts' }
  | { kind: 'no-uid' }
  | { kind: 'ambiguous' };

/**
 * Base action class with common functionality for all Hoyo Deck actions.
 *
 * Account auto-picking strategy:
 *
 *   0 accounts                → no-accounts  (PI shows login-only view)
 *   1 account, has game UID   → auto-select, never show picker in PI
 *   1 account, no game UID    → no-uid
 *   2+ accounts, exactly one
 *     has the game UID        → auto-select, hide picker in PI
 *   2+ accounts, multiple
 *     have the game UID       → ambiguous, show picker in PI
 *   accountId set in settings → use it directly (user already picked)
 *
 * Only `accountId` is persisted in action settings — never a UID.
 *
 * Account-change watcher:
 * Actions in "no-accounts" or "ambiguous" state subscribe to structural
 * account changes (account added/removed) via DataController so they
 * automatically re-run resolution without requiring a user interaction.
 */
export abstract class BaseAction<
  TSettings extends JsonObject = JsonObject,
  TDataType extends DataType = DataType,
> extends SingletonAction<TSettings> {
  /** Game identifier for this action */
  protected abstract readonly game: GameId;

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

  // ─── Account picking ─────────────────────────────────────────────

  /**
   * Core account auto-pick logic.
   *
   * Rules (in order):
   * 1. If `accountId` is in settings and the account still exists → resolved
   * 2. Count accounts that have a UID for this game:
   *    - 0 matching accounts total → no-accounts (or no-uid if accounts exist)
   *    - Exactly 1 → auto-select (persist accountId if action handle provided)
   *    - 2+ → ambiguous
   *
   * Only accountId is persisted — never a UID.
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
      // Accounts exist but none has this game's UID
      return { kind: 'no-uid' };
    }

    if (candidates.length === 1) {
      // Exactly one match → auto-select and persist
      const selected = candidates[0]!;
      if (action) {
        await action.setSettings({ ...settings, accountId: selected.id });
      }
      return { kind: 'resolved', account: selected };
    }

    // 2+ candidates → ambiguous, user must pick in PI
    return { kind: 'ambiguous' };
  }

  /**
   * Resolve account for rendering purposes (no persistence side-effect).
   * Returns the account or null if not resolvable.
   *
   * @deprecated prefer pickAccount() for new code
   */
  protected async resolveAccount(
    settings: TSettings,
    action?: KeyAction<TSettings>,
  ): Promise<HoyoAccount | null> {
    const game = this.getResolvedGame(settings);
    const result = await this.pickAccount(settings, game, action);
    return result.kind === 'resolved' ? result.account : null;
  }

  /**
   * Get authenticated client for the given account via DataController.
   */
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
    const game = this.getResolvedGame(settings);
    const result = await this.pickAccount(settings, game, action);
    if (result.kind !== 'resolved') return null;

    const client = this.getClientForAccount(result.account);
    if (!client) return null;

    return { account: result.account, client };
  }

  /**
   * Get the UID for a specific game from the selected account.
   */
  protected getGameUid(account: HoyoAccount, game: GameId): string | null {
    return account.uids[game] ?? null;
  }

  // ─── Display helpers ─────────────────────────────────────────────

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

  // ─── Registration helper ─────────────────────────────────────────

  /**
   * Attempt to register this action with the DataController.
   *
   * Handles all pick outcomes:
   * - resolved + has UID  → register, fetch, unwatch
   * - resolved + no UID   → showNoUid, unwatch
   * - no-accounts         → showNoAccount, watch for account changes
   * - ambiguous           → showNoAccount, watch for account changes
   * - no-uid              → showNoUid, unwatch
   */
  private async attemptRegister(
    actionId: string,
    keyAction: KeyAction<TSettings>,
    settings: TSettings,
  ): Promise<void> {
    const game = this.getResolvedGame(settings);
    const result = await this.pickAccount(settings, game, keyAction);

    if (result.kind === 'no-accounts' || result.kind === 'ambiguous') {
      // No usable account yet — show placeholder and wait for account changes
      dataController.unregister(actionId);
      await this.showNoAccount(keyAction);

      // Subscribe so we retry as soon as an account is added/removed
      dataController.subscribeAccountChanges(actionId, () => {
        void this.attemptRegister(actionId, keyAction, settings);
      });
      return;
    }

    // Account resolved (or no-uid) — no need to watch for structure changes
    dataController.unsubscribeAccountChanges(actionId);

    if (result.kind === 'no-uid') {
      dataController.unregister(actionId);
      await this.showNoUid(keyAction);
      return;
    }

    const { account } = result;
    const uid = this.getGameUid(account, game);
    if (!uid) {
      dataController.unregister(actionId);
      await this.showNoUid(keyAction);
      return;
    }

    const dataTypes = this.getSubscribedDataTypes(settings);

    // Skip re-registration if nothing meaningful changed
    const existing = dataController.getRegistration(actionId);
    if (
      existing &&
      existing.accountId === account.id &&
      existing.dataTypes.length === dataTypes.length &&
      existing.dataTypes.every((dt, i) => dt === dataTypes[i])
    ) {
      return;
    }

    dataController.unregister(actionId);
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
        // Account deleted → show placeholder and start watching for a new one
        void this.showNoAccount(keyAction);
        dataController.subscribeAccountChanges(actionId, () => {
          void this.attemptRegister(actionId, keyAction, settings);
        });
      },
    });

    await this.withErrorHandling(keyAction, async () => {
      await dataController.requestUpdate(account.id, game);
    });
  }

  // ─── Lifecycle hooks ─────────────────────────────────────────────

  /**
   * Called when action appears — registers with DataController.
   */
  override async onWillAppear(
    ev: WillAppearEvent<TSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.attemptRegister(
      ev.action.id,
      ev.action,
      ev.payload.settings,
    );
  }

  /**
   * Called when action disappears — unregisters from DataController.
   */
  override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
    dataController.unregister(ev.action.id);
    dataController.unsubscribeAccountChanges(ev.action.id);
  }

  /**
   * Called when per-action settings change — re-runs full resolution.
   */
  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<TSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.attemptRegister(
      ev.action.id,
      ev.action,
      ev.payload.settings,
    );
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
      const keyAction = ev.action;
      const settings = (await keyAction.getSettings()) as TSettings;

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
    const settings = ev.payload.settings;
    const game = this.getResolvedGame(settings);
    const pickResult = await this.pickAccount(settings, game);
    if (pickResult.kind !== 'resolved') return;

    await this.withErrorHandling(ev.action, async () => {
      await dataController.requestUpdate(pickResult.account.id, game);
    });
  }
}
