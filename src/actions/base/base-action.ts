import streamDeck, {
  type KeyAction,
  SingletonAction,
  type WillAppearEvent,
  type KeyDownEvent,
} from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import { HoyolabClient } from '../../api/hoyolab/client';
import type { HoyoAuth } from '../../api/hoyolab/auth';
import { isValidAuth } from '../../api/hoyolab/auth';
import { isAuthError } from '../../api/types/common';
import type { GlobalSettings } from '../../types/settings';

/**
 * Base action class with common functionality for all Hoyo Deck actions
 */
export abstract class BaseAction<
  TSettings extends JsonObject = JsonObject,
> extends SingletonAction<TSettings> {
  /**
   * Get the global settings containing auth
   */
  protected async getGlobalSettings(): Promise<GlobalSettings> {
    return (await streamDeck.settings.getGlobalSettings()) as GlobalSettings;
  }

  /**
   * Get authenticated client or null if not authenticated
   */
  protected async getClient(): Promise<HoyolabClient | null> {
    const globalSettings = await this.getGlobalSettings();

    if (!globalSettings.auth || !isValidAuth(globalSettings.auth)) {
      return null;
    }

    return new HoyolabClient(globalSettings.auth as HoyoAuth);
  }

  /**
   * Get the UID from action settings or global settings
   */
  protected async getUid(actionSettings: TSettings): Promise<string | null> {
    // Check action-specific UID first
    const actionUid = (actionSettings as Record<string, unknown>)['uid'];
    if (typeof actionUid === 'string' && actionUid.length > 0) {
      return actionUid;
    }

    // Fall back to global UID
    const globalSettings = await this.getGlobalSettings();
    return globalSettings.uid ?? null;
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
    message?: string
  ): Promise<void> {
    await action.setTitle(message ?? 'Error');
    await action.showAlert();
  }

  /**
   * Wrap action execution with error handling
   */
  protected async withErrorHandling(
    action: KeyAction<TSettings>,
    fn: () => Promise<void>
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
    ev: WillAppearEvent<TSettings>
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
    settings: TSettings
  ): Promise<void>;
}
