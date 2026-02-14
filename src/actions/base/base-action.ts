import streamDeck, {
  type KeyAction,
  SingletonAction,
  type WillAppearEvent,
  type KeyDownEvent,
} from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import { HoyolabClient } from '../../api/hoyolab/client';
import { isValidAuth } from '../../api/hoyolab/auth';
import type { HoyoAuth } from '../../api/hoyolab/auth';
import { isAuthError } from '../../api/types/common';
import type {
  GlobalSettings,
  HoyoAccount,
  AccountId,
} from '../../types/settings';
import type { GameId } from '../../types/games';

/**
 * Resolved account context — everything an action needs to operate.
 */
export interface AccountContext {
  account: HoyoAccount;
  client: HoyolabClient;
}

/**
 * Base action class with common functionality for all Hoyo Deck actions
 */
export abstract class BaseAction<
  TSettings extends JsonObject = JsonObject,
> extends SingletonAction<TSettings> {
  /**
   * Get the global settings
   */
  protected async getGlobalSettings(): Promise<GlobalSettings> {
    return (await streamDeck.settings.getGlobalSettings()) as unknown as GlobalSettings;
  }

  /**
   * Resolve the account referenced by this action's settings.
   * Returns null if no account is selected or the account was deleted.
   *
   * Handles three resolution strategies:
   * 1. accountId is set → look up in globalSettings.accounts
   * 2. Legacy uid is set but no accountId → find matching account by UID
   * 3. Only one account exists → auto-select it
   */
  protected async resolveAccount(
    settings: TSettings,
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

    // If only one account exists, use it automatically
    const accountList = Object.values(accounts);
    if (accountList.length === 1) return accountList[0]!;

    return null;
  }

  /**
   * Get authenticated client for the given account.
   */
  protected getClientForAccount(account: HoyoAccount): HoyolabClient | null {
    if (!isValidAuth(account.auth)) return null;
    return new HoyolabClient(account.auth as HoyoAuth);
  }

  /**
   * Get full account context: resolved account + client.
   * Returns null if account not found or auth invalid.
   */
  protected async getAccountContext(
    settings: TSettings,
  ): Promise<AccountContext | null> {
    const account = await this.resolveAccount(settings);
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
      } else {
        await this.showError(action);
      }
    }
  }

  /**
   * Called when action appears - override in subclass
   */
  override async onWillAppear(
    ev: WillAppearEvent<TSettings>,
  ): Promise<void> {
    // Only handle key actions, not dials
    if (!ev.action.isKey()) return;
    const keyAction = ev.action;

    await this.withErrorHandling(keyAction, async () => {
      await this.refresh(keyAction, ev.payload.settings);
    });
  }

  /**
   * Called when key is pressed - default is to refresh
   */
  override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
    await this.withErrorHandling(ev.action, async () => {
      await this.refresh(ev.action, ev.payload.settings);
    });
  }

  /**
   * Refresh action display - override in subclass
   */
  protected abstract refresh(
    action: KeyAction<TSettings>,
    settings: TSettings,
  ): Promise<void>;
}
