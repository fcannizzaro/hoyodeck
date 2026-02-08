import { action, type KeyAction } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { GenshinActionSettings } from '../../types/settings';
import { formatDaysRemaining } from '../../utils/time';

/**
 * Spiral Abyss Action
 * Displays days remaining and star count
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.abyss' })
export class AbyssAction extends BaseAction<GenshinActionSettings> {
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

    const abyss = await client.getGenshinSpiralAbyss(uid);

    // Calculate days remaining
    const endDate = new Date(parseInt(abyss.end_time) * 1000);
    const daysLeft = formatDaysRemaining(endDate);

    // Format: "Stars\nDays"
    await action.setTitle(`${abyss.total_star}*\n${daysLeft}`);
  }
}
