import streamDeck, { action, type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { RedeemCodeSettings } from '@/types/settings';
import type { GameId } from '@/types/games';
import type { DataType, SuccessDataUpdate, CodeList } from '@/services/data-controller.types';
import { dataController } from '@/services/data-controller';
import { getManagerClient } from '@/api/manager/client';
import { HoyolabApiError } from '@/api/types/common';
import { buildBadgeSvg } from '@/utils/banner';
import { readLocalImageAsDataUri } from '@/utils/image';

/** Background images per game for the redeem key */
const GAME_BACKGROUNDS: Record<GameId, string> = {
  gi: 'imgs/actions/gi/5-star.webp',
  hsr: 'imgs/actions/hsr/5-star.png',
  zzz: 'imgs/actions/zzz/5-star.png',
};

const SIZE = 144;

/**
 * Redeem Code Action
 * Shows unclaimed code count and redeems codes on tap — supports all games
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.redeem-code' })
export class RedeemCodeAction extends BaseAction<
  RedeemCodeSettings,
  'gi:codes' | 'hsr:codes' | 'zzz:codes'
> {
  protected readonly game = 'gi' as const;

  /** Use settings-based game for account resolution (multi-game action) */
  protected override getResolvedGame(settings: RedeemCodeSettings): GameId {
    return settings.game ?? 'gi';
  }

  /**
   * Dynamic data types based on selected game.
   */
  protected getSubscribedDataTypes(settings: RedeemCodeSettings): DataType[] {
    const game = settings.game ?? 'gi';
    return [`${game}:codes`];
  }

  protected override async onDataUpdate(
    action: KeyAction<RedeemCodeSettings>,
    update: SuccessDataUpdate<'gi:codes' | 'hsr:codes' | 'zzz:codes'>,
  ): Promise<void> {
    const codeList = update.entry.data;
    const settings = await action.getSettings();
    const game = settings.game ?? 'gi';

    await this.renderCodeBadge(action, game, codeList);
  }

  override async onKeyDown(
    ev: KeyDownEvent<RedeemCodeSettings>,
  ): Promise<void> {
    await this.withErrorHandling(ev.action, async () => {
      const ctx = await this.getAccountContext(ev.payload.settings, ev.action);
      if (!ctx) {
        await this.showNoAccount(ev.action);
        return;
      }

      const game = ev.payload.settings.game ?? 'gi';
      const uid = this.getGameUid(ctx.account, game);
      if (!uid) {
        await this.showNoUid(ev.action);
        return;
      }

      // Get cached codes
      const cached = dataController.getData(ctx.account.id, `${game}:codes`);
      if (cached?.status !== 'ok') {
        // No cached data — just refresh
        await dataController.requestUpdate(ctx.account.id, game);
        return;
      }

      const codeList = cached.data as CodeList;
      const nextCode = codeList.codes.find((c) => c.status === 'new');

      if (!nextCode) {
        // All codes claimed/dismissed
        await ev.action.showOk();
        return;
      }

      // Redeem the code via HoYoLAB
      const managerClient = getManagerClient();

      try {
        await ctx.client.redeemCode(game, nextCode.code, uid);
        streamDeck.logger.info(
          `[RedeemCode] Successfully redeemed ${nextCode.code} for ${game}`,
        );
        await ev.action.showOk();

        // Mark as claimed in manager
        if (managerClient) {
          await managerClient.markClaimed(nextCode.id, ctx.account.id);
        }
      } catch (error) {
        if (error instanceof HoyolabApiError) {
          // -2001: already redeemed, -2003: expired, -2004: invalid
          if (error.retcode === -2001) {
            // Already redeemed — mark as claimed
            await ev.action.showOk();
            if (managerClient) {
              await managerClient.markClaimed(
                nextCode.id,
                ctx.account.id,
                'Already redeemed',
              );
            }
          } else {
            // Mark as failed
            if (managerClient) {
              await managerClient.markFailed(
                nextCode.id,
                ctx.account.id,
                error.message,
              );
            }
            throw error;
          }
        } else {
          throw error;
        }
      }

      // Refresh display after redeeming
      await dataController.requestUpdate(ctx.account.id, game);
    });
  }

  /**
   * Render the key with game background and unclaimed badge count
   */
  private async renderCodeBadge(
    action: KeyAction<RedeemCodeSettings>,
    game: GameId,
    codeList: CodeList,
  ): Promise<void> {
    const bgDataUri = readLocalImageAsDataUri(GAME_BACKGROUNDS[game]);
    const count = codeList.unclaimed;

    const badgeText = count > 0 ? `${count}` : '✓';
    const badgeColor = count > 0 ? '#ef4444' : '#22c55e';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${bgDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <rect x="${SIZE - 40}" y="4" width="36" height="24" rx="12" fill="${badgeColor}" />
  <text x="${SIZE - 22}" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="sans-serif">${badgeText}</text>
  ${buildBadgeSvg('CODES')}
</svg>`;

    const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
    await action.setTitle('');
    await action.setImage(base64);
  }
}
