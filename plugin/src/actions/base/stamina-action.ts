import type { JsonObject } from '@elgato/utils';
import { BaseAction } from './base-action';
import { formatStamina } from '../../utils/format';

/**
 * Abstract base class for stamina/resource tracking actions.
 *
 * Provides shared stamina formatting utilities.
 * Data fetching is handled by the DataController — subclasses
 * receive data via onDataUpdate().
 *
 * @template TSettings - Action settings type
 * @template TDailyNote - Daily note response type from API
 */
export abstract class StaminaAction<
  TSettings extends JsonObject = JsonObject,
  TDailyNote = unknown,
> extends BaseAction<TSettings> {
  /** Maximum stamina value for this game */
  protected abstract readonly maxStamina: number;

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
}
