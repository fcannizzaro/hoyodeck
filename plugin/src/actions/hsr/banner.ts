import { action } from "@elgato/streamdeck";
import { BaseBannerAction, type BannerItem } from "../base/banner-action";
import type { StarRailBannerSettings } from "@/types/settings";
import type { DataType } from "@/services/data-controller.types";
import type { StarRailActCalendar, StarRailBannerPool } from "@/api/types/hsr";

/**
 * Star Rail Banner Action
 * Displays current warp banner info from the HoYoLab act calendar API.
 * Key press cycles through multiple concurrent character banners.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.hsr.banner" })
export class BannerAction extends BaseBannerAction<StarRailBannerSettings, 'hsr:act-calendar', StarRailActCalendar> {
  protected readonly game = 'hsr' as const;

  protected getSubscribedDataTypes(): DataType[] {
    return ['hsr:act-calendar'];
  }

  protected getCharacterItems(calendar: StarRailActCalendar): BannerItem[] {
    return this.getActiveBanners(calendar.avatar_card_pool_list).flatMap((pool) =>
      pool.avatar_list
        .filter((it) => it.rarity === "5")
        .map((it) => ({
          icon: it.icon_url,
          name: it.item_name,
          countdownSeconds: this.getCountdownSeconds(pool.time_info),
        })),
    );
  }

  protected getWeaponItems(calendar: StarRailActCalendar): BannerItem[] {
    return this.getActiveBanners(calendar.equip_card_pool_list).flatMap((pool) =>
      pool.equip_list
        .filter((it) => it.rarity === "5")
        .map((it) => ({
          icon: it.item_url,
          countdownSeconds: this.getCountdownSeconds(pool.time_info),
        })),
    );
  }

  private getActiveBanners(pools: StarRailBannerPool[]): StarRailBannerPool[] {
    return pools.filter((pool) => {
      const now = pool.time_info.now;
      return now > pool.time_info.start_ts && now < pool.time_info.end_ts;
    });
  }

  /**
   * Compute remaining seconds from end_ts epoch string.
   * HSR provides end_ts as a Unix timestamp string, unlike Genshin's countdown_seconds.
   */
  private getCountdownSeconds(
    time_info: StarRailBannerPool["time_info"],
  ): number {
    const endTs = Number(time_info.end_ts);
    const nowSeconds = Math.floor(Date.now() / 1000);
    return Math.max(endTs - nowSeconds, 0);
  }
}
