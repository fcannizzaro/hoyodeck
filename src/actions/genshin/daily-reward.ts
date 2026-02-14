import { action, type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { DailyRewardSettings } from '../../types/settings';
import { HoyolabApiError } from '../../api/types/common';
import { fetchImageAsDataUri, readLocalImageAsDataUri } from '../../utils/image';
import { buildRewardSvg } from '../../utils/reward';

const DAILY_IMG = 'imgs/actions/gi/daily.png';
const DONE_IMG = 'imgs/actions/gi/done.png';

/**
 * Daily Reward (Check-in) Action
 * Shows today's reward and claims on tap
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.daily-reward' })
export class DailyRewardAction extends BaseAction<DailyRewardSettings> {
  protected override async refresh(
    action: KeyAction<DailyRewardSettings>,
    _settings: DailyRewardSettings
  ): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      await this.showNoAuth(action);
      return;
    }

    const [info, rewards] = await Promise.all([
      client.getGenshinCheckInInfo(),
      client.getGenshinCheckInRewards(),
    ]);

    // If already claimed, show the latest claimed reward; otherwise show the next to claim
    const rewardIndex = info.total_sign_day - (info.is_sign ? 1 : 0);
    const todayReward = rewards.awards[rewardIndex];

    if (!todayReward) {
      await action.setTitle('--');
      return;
    }

    // Fetch reward icon and load local assets
    const rewardDataUri = await fetchImageAsDataUri(todayReward.icon);
    const baseDataUri = readLocalImageAsDataUri(DAILY_IMG);
    const doneDataUri = readLocalImageAsDataUri(DONE_IMG);

    // Build 3-layer SVG: base frame + reward icon + optional done overlay
    const svg = buildRewardSvg(baseDataUri, rewardDataUri, doneDataUri, info.is_sign);
    const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;

    await action.setTitle('');
    await action.setImage(base64);
  }

  override async onKeyDown(
    ev: KeyDownEvent<DailyRewardSettings>
  ): Promise<void> {
    await this.withErrorHandling(ev.action, async () => {
      const client = await this.getClient();
      if (!client) {
        await this.showNoAuth(ev.action);
        return;
      }

      // Check if already claimed
      const info = await client.getGenshinCheckInInfo();
      if (info.is_sign) {
        await ev.action.showOk();
        return;
      }

      // Claim the reward
      const claimOnClick = ev.payload.settings.claimOnClick ?? true;
      if (claimOnClick) {
        try {
          await client.claimGenshinCheckIn();
          await ev.action.showOk();
        } catch (error) {
          if (error instanceof HoyolabApiError && error.retcode === -5003) {
            // Already claimed
            await ev.action.showOk();
          } else {
            throw error;
          }
        }
      }

      // Refresh display
      await this.refresh(ev.action, ev.payload.settings);
    });
  }
}
