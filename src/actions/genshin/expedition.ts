import { action, type KeyAction } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { GenshinActionSettings } from '../../types/settings';

/**
 * Expedition Counter Action
 * Displays completed/total expeditions
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.expedition' })
export class ExpeditionAction extends BaseAction<GenshinActionSettings> {
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

    // Count finished expeditions
    const finished = dailyNote.expeditions.filter(
      (exp) => exp.status === 'Finished'
    ).length;
    const total = dailyNote.current_expedition_num;

    await action.setTitle(`${finished}/${total}`);
  }
}
