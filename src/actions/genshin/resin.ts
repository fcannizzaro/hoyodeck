import { action, type KeyAction } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { GenshinActionSettings } from '../../types/settings';
import { formatStamina } from '../../utils/format';
import { GAMES } from '../../types/games';

/**
 * Resin Counter Action
 * Displays current Original Resin and refreshes on tap
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.resin' })
export class ResinAction extends BaseAction<GenshinActionSettings> {
  private readonly MAX_RESIN = GAMES.genshin.staminaMax;

  protected override async refresh(
    action: KeyAction<GenshinActionSettings>,
    settings: GenshinActionSettings
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

    const dailyNote = await client.getGenshinDailyNote(uid);
    const display = formatStamina(dailyNote.current_resin, this.MAX_RESIN);

    await action.setTitle(display);
  }
}
