import { action } from "@elgato/streamdeck";
import { BaseBannerAction, type BannerItem } from "../base/banner-action";
import type { BannerSettings } from "@/types/settings";
import type { DataType } from "@/services/data-controller.types";
import type { GenshinActCalendar, GenshinBannerPool } from "@/api/types/genshin";

/**
 * Genshin Impact Banner Action
 * Displays current wish banner info from the HoYoLab act calendar API.
 * Key press cycles through multiple concurrent character banners.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.banner" })
export class BannerAction extends BaseBannerAction<BannerSettings, 'gi:act-calendar', GenshinActCalendar> {
  protected readonly game = 'gi' as const;

  protected getSubscribedDataTypes(): DataType[] {
    return ['gi:act-calendar'];
  }

  protected getCharacterItems(calendar: GenshinActCalendar): BannerItem[] {
    return this.getActiveBanners(calendar.avatar_card_pool_list).flatMap((pool) =>
      pool.avatars
        .filter((a) => a.rarity === 5)
        .map((a) => ({
          icon: a.icon,
          name: a.name,
          countdownSeconds: pool.countdown_seconds,
        })),
    );
  }

  protected getWeaponItems(calendar: GenshinActCalendar): BannerItem[] {
    return this.getActiveBanners(calendar.weapon_card_pool_list).flatMap((pool) =>
      pool.weapon
        .filter((w) => w.rarity === 5)
        .map((w) => ({
          icon: w.icon,
          countdownSeconds: pool.countdown_seconds,
        })),
    );
  }

  private getActiveBanners(pools: GenshinBannerPool[]): GenshinBannerPool[] {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return pools.filter((pool) => {
      const start = Number(pool.start_timestamp);
      const end = Number(pool.end_timestamp);
      return nowSeconds > start && nowSeconds < end;
    });
  }
}
