import { action, type KeyAction } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { GenshinActionSettings } from '../../types/settings';

/**
 * Commission Counter Action
 * Displays remaining daily commissions
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.commission' })
export class CommissionAction extends BaseAction<GenshinActionSettings> {
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
    const remaining = dailyNote.total_task_num - dailyNote.finished_task_num;

    await action.setTitle(`${remaining}`);
  }
}
