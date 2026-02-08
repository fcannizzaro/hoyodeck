import { type KeyAction } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import { BaseAction } from './base-action';
import type { GameId } from '../../types/games';
import { formatStamina } from '../../utils/format';
import type { HoyolabClient } from '../../api/hoyolab/client';

/**
 * Abstract base class for stamina/resource tracking actions.
 *
 * Extensible for:
 * - Genshin Impact (Original Resin)
 * - Honkai: Star Rail (Trailblaze Power)
 * - Zenless Zone Zero (Battery)
 *
 * @template TSettings - Action settings type
 * @template TDailyNote - Daily note response type from API
 */
export abstract class StaminaAction<
  TSettings extends JsonObject = JsonObject,
  TDailyNote = unknown,
> extends BaseAction<TSettings> {
  /** Game identifier for this action */
  protected abstract readonly game: GameId;

  /** Maximum stamina value for this game */
  protected abstract readonly maxStamina: number;

  /**
   * Fetch daily note data from the API
   * @param client - Authenticated HoYoLAB client
   * @param uid - User's in-game UID
   */
  protected abstract fetchDailyNote(
    client: HoyolabClient,
    uid: string
  ): Promise<TDailyNote>;

  /**
   * Extract current stamina value from daily note response
   * @param dailyNote - Daily note data from API
   */
  protected abstract getCurrentStamina(dailyNote: TDailyNote): number;

  /**
   * Format stamina for display. Override for custom formatting.
   * @param current - Current stamina value
   * @param max - Maximum stamina value
   */
  protected formatDisplay(current: number, max: number): string {
    return formatStamina(current, max);
  }

  protected override async refresh(
    action: KeyAction<TSettings>,
    settings: TSettings
  ): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      await this.showNoAuth(action);
      return;
    }

    const uid = await this.getUid(settings);
    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const dailyNote = await this.fetchDailyNote(client, uid);
    const current = this.getCurrentStamina(dailyNote);
    const display = this.formatDisplay(current, this.maxStamina);

    await action.setTitle(display);
  }
}
