import { action, type KeyAction } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { TransformerSettings } from '../../types/settings';
import { formatTransformerTime } from '../../utils/time';

/**
 * Parametric Transformer Action
 * Displays transformer cooldown or ready state
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.transformer' })
export class TransformerAction extends BaseAction<TransformerSettings> {
  protected override async refresh(
    action: KeyAction<TransformerSettings>,
    settings: TransformerSettings
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

    if (!dailyNote.transformer.obtained) {
      await action.setTitle('N/A');
      return;
    }

    const display = formatTransformerTime(dailyNote.transformer.recovery_time);
    await action.setTitle(display);
  }
}
