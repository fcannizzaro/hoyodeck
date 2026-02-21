import { action, type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { DailyRewardSettings } from '@/types/settings';
import type { GameId } from '@/types/games';
import type { DataType, SuccessDataUpdate } from '@/services/data-controller.types';
import { dataController } from '@/services/data-controller';
import { HoyolabApiError } from '@/api/types/common';
import { fetchImageAsDataUri, readLocalImageAsDataUri } from '@/utils/image';
import { buildRewardSvg } from '@/utils/reward';

/**
 * Daily Reward (Check-in) Action
 * Shows today's reward and claims on tap — supports all games
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.daily-reward' })
export class DailyRewardAction extends BaseAction<DailyRewardSettings, 'gi:check-in' | 'hsr:check-in' | 'zzz:check-in'> {
  protected readonly game = 'gi' as const;

  /** Use settings-based game for account resolution (multi-game action) */
  protected override getResolvedGame(settings: DailyRewardSettings): GameId {
    return settings.game ?? 'gi';
  }

  /**
   * Dynamic data types based on selected game.
   * Returns the check-in data type for the configured game.
   */
  protected getSubscribedDataTypes(settings: DailyRewardSettings): DataType[] {
    const game = settings.game ?? 'gi';
    return [`${game}:check-in`];
  }

  protected override async onDataUpdate(
    action: KeyAction<DailyRewardSettings>,
    update: SuccessDataUpdate<'gi:check-in' | 'hsr:check-in' | 'zzz:check-in'>,
  ): Promise<void> {
    const checkInData = update.entry.data;
    const settings = await action.getSettings();
    const game = settings.game ?? 'gi';

    const { info, rewards } = checkInData;

    // If already claimed, show the latest claimed reward; otherwise show the next to claim
    const rewardIndex = info.total_sign_day - (info.is_sign ? 1 : 0);
    const todayReward = rewards.awards[rewardIndex];

    if (!todayReward) {
      await action.setTitle('--');
      return;
    }

    // Fetch reward icon and load local assets
    const rewardDataUri = await fetchImageAsDataUri(todayReward.icon);
    const baseDataUri = readLocalImageAsDataUri(`imgs/actions/${game}/daily.png`);
    const doneDataUri = readLocalImageAsDataUri(`imgs/actions/${game}/done.png`);

    // Build 3-layer SVG: base frame + reward icon + optional done overlay
    const svg = buildRewardSvg(baseDataUri, rewardDataUri, doneDataUri, info.is_sign, game === 'zzz' && info.is_sign, `x${todayReward.cnt}`);
    const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;

    await action.setTitle('');
    await action.setImage(base64);
  }

  override async onKeyDown(
    ev: KeyDownEvent<DailyRewardSettings>,
  ): Promise<void> {
    await this.withErrorHandling(ev.action, async () => {
      const ctx = await this.getAccountContext(ev.payload.settings, ev.action);
      if (!ctx) {
        await this.showNoAccount(ev.action);
        return;
      }

      const game = ev.payload.settings.game ?? 'gi';

      // Check cached check-in info to see if already claimed
      const cached = dataController.getData(ctx.account.id, `${game}:check-in`);
      if (cached?.status === 'ok') {
        if (cached.data.info.is_sign) {
          await ev.action.showOk();
          return;
        }
      }

      // Claim the reward via direct client call (write operation)
      const claimOnClick = ev.payload.settings.claimOnClick ?? true;
      if (claimOnClick) {
        try {
          await ctx.client.claimCheckIn(game);
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

      // Refresh display after claiming
      await dataController.requestUpdate(ctx.account.id, game);
    });
  }
}
