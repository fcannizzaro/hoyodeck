import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { StarRailBannerSettings, BannerBadgeOptions } from "@/types/settings";
import type { DataType, DataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services/data-controller";
import type { StarRailActCalendar, StarRailBannerPool } from "@/api/types/hsr";
import { buildBannerSvg, formatCountdownFromSeconds } from "@/utils/banner";
import { fetchImageAsDataUri } from "@/utils/image";

/**
 * Star Rail Banner Action
 * Displays current warp banner info from the HoYoLab act calendar API.
 * Key press cycles through multiple concurrent character banners.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.hsr.banner" })
export class BannerAction extends BaseAction<StarRailBannerSettings, 'hsr:act-calendar'> {
  protected readonly game = 'hsr' as const;

  /** Current index for cycling through character banners */
  private bannerIndex = 0;

  /** Stored accountId for sync cache reads on key press */
  private currentAccountId: string | null = null;

  protected getSubscribedDataTypes(): DataType[] {
    return ['hsr:act-calendar'];
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

  override async onKeyDown(
    ev: KeyDownEvent<StarRailBannerSettings>,
  ): Promise<void> {
    const settings = ev.payload.settings;
    const type = settings.type ?? "character";

    // Cycle through character banners on key press
    if (type === "character") {
      this.bannerIndex++;
    }

    // Re-render from cached data — no network call needed for banner cycling
    if (this.currentAccountId) {
      const entry = dataController.getData(this.currentAccountId, 'hsr:act-calendar');
      if (entry?.status === 'ok') {
        await this.withErrorHandling(ev.action, async () => {
          await this.renderCalendar(ev.action, settings, entry.data);
        });
        return;
      }
    }

    // Fallback: request fresh data
    const account = await this.resolveAccount(settings);
    if (!account) return;

    await this.withErrorHandling(ev.action, async () => {
      await dataController.requestUpdate(account.id, 'hsr');
    });
  }

  protected override async onDataUpdate(
    action: KeyAction<StarRailBannerSettings>,
    update: DataUpdate<'hsr:act-calendar'>,
  ): Promise<void> {
    if (update.entry.status === 'error') {
      await this.showError(action);
      return;
    }

    this.currentAccountId = update.accountId;
    const settings = await action.getSettings();
    await this.renderCalendar(action, settings, update.entry.data);
  }

  private async renderCalendar(
    action: KeyAction<StarRailBannerSettings>,
    settings: StarRailBannerSettings,
    calendar: StarRailActCalendar,
  ): Promise<void> {
    const type = settings.type ?? "character";

    const globalSettings = await this.getGlobalSettings();
    const badge: BannerBadgeOptions = {
      position: globalSettings.bannerBadgePosition ?? "center",
      layout: globalSettings.bannerBadgeLayout ?? "horizontal",
      fontSize: globalSettings.bannerBadgeFontSize ?? 18,
    };

    if (type === "character") {
      await this.displayCharacterBanner(action, calendar.avatar_card_pool_list, badge);
    } else {
      await this.displayEquipBanner(action, calendar.equip_card_pool_list, badge);
    }
  }

  private getActiveBanners(pools: StarRailBannerPool[]): StarRailBannerPool[] {
    return pools.filter((pool) => {
      const now = pool.time_info.now;
      return now > pool.time_info.start_ts && now < pool.time_info.end_ts;
    });
  }

  private async displayCharacterBanner(
    action: KeyAction<StarRailBannerSettings>,
    pools: StarRailBannerPool[],
    badge: BannerBadgeOptions,
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const items = this.getActiveBanners(pools).flatMap((pool) =>
      pool.avatar_list
        .filter((it) => it.rarity === "5")
        .map((it) => ({
          icon: it.icon_url,
          time_info: pool.time_info,
        })),
    );

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(
        this.getCountdownSeconds(item.time_info),
      );
      const dataUri = await fetchImageAsDataUri(item.icon);
      const svg = buildBannerSvg(dataUri, countdown, "hsr", badge);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle("");
      await action.setImage(base64);
    }
  }

  private async displayEquipBanner(
    action: KeyAction<StarRailBannerSettings>,
    pools: StarRailBannerPool[],
    badge: BannerBadgeOptions,
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const items = this.getActiveBanners(pools).flatMap((pool) =>
      pool.equip_list
        .filter((it) => it.rarity === "5")
        .map((it) => ({
          icon: it.item_url,
          time_info: pool.time_info,
        })),
    );

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(
        this.getCountdownSeconds(item.time_info),
      );
      const dataUri = await fetchImageAsDataUri(item.icon);
      const svg = buildBannerSvg(dataUri, countdown, "hsr", badge);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle("");
      await action.setImage(base64);
    }
  }
}
