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
import type {
  GlobalSettings,
  HoyoAccount,
  AccountId,
} from '@/types/settings';
import type { GameId } from '@/types/games';
import { dataController } from '@/services/data-controller';
import type { DataEntry, DataType, DataUpdate } from '@/services/data-controller.types';

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
   */
  protected abstract onDataUpdate(
    action: KeyAction<TSettings>,
    update: DataUpdate<TDataType>,
  ): Promise<void>;

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

    // V2 path: accountId is set
    const accountId = raw['accountId'] as AccountId | undefined;
    if (accountId) {
      return accounts[accountId] ?? null;
    }

    // V1 fallback: uid is set but accountId is not
    const legacyUid = raw['uid'] as string | undefined;
    if (legacyUid) {
      const match = Object.values(accounts).find((account) =>
        Object.values(account.uids).includes(legacyUid),
      );
      return match ?? null;
    }

    // Auto-select: if exactly one account has a UID for this game, use it
    const game = this.getResolvedGame(settings);
    const candidates = Object.values(accounts).filter(
      (a) => a.uids[game] !== undefined,
    );

    if (candidates.length === 1) {
      const selected = candidates[0]!;
      if (action) {
        await action.setSettings({ ...settings, accountId: selected.id });
      }
      return selected;
    }

    return null;
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
   * Show "Select Account" message and alert
   */
  protected async showNoAccount(action: KeyAction<TSettings>): Promise<void> {
    await action.setTitle('Select\nAccount');
    await action.showAlert();
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

    const account = await this.resolveAccount(ev.payload.settings, keyAction);
    if (!account) {
      await this.showNoAccount(keyAction);
      return;
    }

    const game = this.getResolvedGame(ev.payload.settings);
    const uid = this.getGameUid(account, game);
    if (!uid) {
      await this.showNoUid(keyAction);
      return;
    }

    // Register with DataController
    dataController.register({
      actionId: ev.action.id,
      accountId: account.id,
      dataTypes: this.getSubscribedDataTypes(ev.payload.settings),
      listener: (update) => {
        void this.withErrorHandling(keyAction, () =>
          this.onDataUpdate(keyAction, update as DataUpdate<TDataType>),
        );
      },
    });

    // Request immediate data for first render
    await this.withErrorHandling(keyAction, async () => {
      await dataController.requestUpdate(account.id, game);
    });
  }

  /**
   * Called when action disappears — unregisters from DataController.
   */
  override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
    dataController.unregister(ev.action.id);
  }

  /**
   * Called when per-action settings change — re-registers with DataController
   * only if the account or subscribed data types actually changed.
   */
  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<TSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    const keyAction = ev.action;

    const account = await this.resolveAccount(ev.payload.settings);
    
    if (!account) {
      dataController.unregister(ev.action.id);
      await this.showNoAccount(keyAction);
      return;
    }

    const game = this.getResolvedGame(ev.payload.settings);
    const uid = this.getGameUid(account, game);
    
    if (!uid) {
      dataController.unregister(ev.action.id);
      await this.showNoUid(keyAction);
      return;
    }

    const dataTypes = this.getSubscribedDataTypes(ev.payload.settings);

    // Skip re-registration if nothing meaningful changed
    const existing = dataController.getRegistration(ev.action.id);
    if (
      existing &&
      existing.accountId === account.id &&
      existing.dataTypes.length === dataTypes.length &&
      existing.dataTypes.every((dt, i) => dt === dataTypes[i])
    ) {
      return;
    }

    // Unregister old subscription and re-register with new params
    dataController.unregister(ev.action.id);

    dataController.register({
      actionId: ev.action.id,
      accountId: account.id,
      dataTypes,
      listener: (update) => {
        void this.withErrorHandling(keyAction, () =>
          this.onDataUpdate(keyAction, update as DataUpdate<TDataType>),
        );
      },
    });

    // Fetch fresh data for new settings
    await this.withErrorHandling(keyAction, async () => {
      await dataController.requestUpdate(account.id, game);
    });
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
    const account = await this.resolveAccount(ev.payload.settings);
    if (!account) return;

    const game = this.getResolvedGame(ev.payload.settings);

    await this.withErrorHandling(ev.action, async () => {
      await dataController.requestUpdate(account.id, game);
    });
  }
}
