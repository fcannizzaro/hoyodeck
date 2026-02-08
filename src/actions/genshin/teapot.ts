import { action, type KeyAction } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { GenshinActionSettings } from '../../types/settings';
import { formatNumber } from '../../utils/format';

/**
 * Serenitea Pot (Teapot) Action
 * Displays current realm currency
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.teapot' })
export class TeapotAction extends BaseAction<GenshinActionSettings> {
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
    const coins = formatNumber(dailyNote.current_home_coin);

    await action.setTitle(coins);
  }
}
