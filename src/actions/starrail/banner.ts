import { action, type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { StarRailBannerSettings } from '../../types/settings';
import type { StarRailBannerPool } from '../../api/types/starrail';
import { buildBannerSvg, formatCountdownFromSeconds } from '../../utils/banner';
import { fetchImageAsDataUri } from '../../utils/image';

/**
 * Star Rail Banner Action
 * Displays current warp banner info from the HoYoLab act calendar API.
 * Key press cycles through multiple concurrent character banners.
 */
@action({ UUID: 'com.fcannizzaro.hoyodeck.starrail.banner' })
export class BannerAction extends BaseAction<StarRailBannerSettings> {
  /** Current index for cycling through character banners */
  private bannerIndex = 0;

  /**
   * Get the featured 5-star icon URL from a pool.
   * Character pools use avatar_list[].icon_url, equipment pools use equip_list[].item_url.
   */
  private getFeaturedIcon(
    pool: StarRailBannerPool,
    type: 'character' | 'lightcone',
  ): string | undefined {
    if (type === 'lightcone') {
      return pool.equip_list.find((e) => e.rarity === '5')?.item_url;
    }
    return pool.avatar_list.find((a) => a.rarity === '5')?.icon_url;
  }

  /**
   * Compute remaining seconds from end_ts epoch string.
   * HSR provides end_ts as a Unix timestamp string, unlike Genshin's countdown_seconds.
   */
  private getCountdownSeconds(pool: StarRailBannerPool): number {
    const endTs = Number(pool.time_info.end_ts);
    const nowSeconds = Math.floor(Date.now() / 1000);
    return Math.max(endTs - nowSeconds, 0);
  }

  override async onKeyDown(
    ev: KeyDownEvent<StarRailBannerSettings>,
  ): Promise<void> {
    const settings = ev.payload.settings;
    const type = settings.type ?? 'character';

    // Cycle through character banners on key press
    if (type === 'character') {
      this.bannerIndex++;
    }

    await this.withErrorHandling(ev.action, async () => {
      await this.refresh(ev.action, settings);
    });
  }

  protected override async refresh(
    action: KeyAction<StarRailBannerSettings>,
    settings: StarRailBannerSettings,
  ): Promise<void> {
    const ctx = await this.getAccountContext(settings);
    if (!ctx) {
      await this.showNoAccount(action);
      return;
    }

    const uid = this.getGameUid(ctx.account, 'starrail');
    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const calendar = await ctx.client.getStarRailActCalendar(uid);
    const type = settings.type ?? 'character';

    if (type === 'character') {
      await this.displayCharacterBanner(
        action,
        calendar.avatar_card_pool_list,
      );
    } else {
      await this.displayEquipBanner(
        action,
        calendar.equip_card_pool_list,
      );
    }
  }

  private async displayCharacterBanner(
    action: KeyAction<StarRailBannerSettings>,
    pools: StarRailBannerPool[],
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle('No\nBanner');
      return;
    }

    const index = this.bannerIndex % pools.length;
    const pool = pools[index]!;
    const countdown = formatCountdownFromSeconds(
      this.getCountdownSeconds(pool),
    );

    const iconUrl = this.getFeaturedIcon(pool, 'character');
    if (iconUrl) {
      const dataUri = await fetchImageAsDataUri(iconUrl);
      const svg = buildBannerSvg(dataUri, countdown);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle('');
      await action.setImage(base64);
    }
  }

  private async displayEquipBanner(
    action: KeyAction<StarRailBannerSettings>,
    pools: StarRailBannerPool[],
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle('No\nBanner');
      return;
    }

    const pool = pools[0]!;
    const countdown = formatCountdownFromSeconds(
      this.getCountdownSeconds(pool),
    );

    const iconUrl = this.getFeaturedIcon(pool, 'lightcone');
    if (iconUrl) {
      const dataUri = await fetchImageAsDataUri(iconUrl);
      const svg = buildBannerSvg(dataUri, countdown);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle('');
      await action.setImage(base64);
    }
  }
}
