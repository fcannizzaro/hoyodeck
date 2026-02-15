import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { BannerSettings, BannerBadgeOptions } from "@/types/settings";
import type { DataType, DataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services/data-controller";
import type { GenshinActCalendar, GenshinBannerPool } from "@/api/types/genshin";
import { buildBannerSvg, formatCountdownFromSeconds } from "@/utils/banner";
import { fetchImageAsDataUri } from "@/utils/image";

/**
 * Banner Action
 * Displays current Genshin Impact wish banner info from the HoYoLab act calendar API.
 * Key press cycles through multiple concurrent banners.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.banner" })
export class BannerAction extends BaseAction<BannerSettings, 'gi:act-calendar'> {
  protected readonly game = 'gi' as const;

  /** Current index for cycling through banners */
  private bannerIndex = 0;

  /** Stored accountId for sync cache reads on key press */
  private currentAccountId: string | null = null;

  protected getSubscribedDataTypes(): DataType[] {
    return ['gi:act-calendar'];
  }

  override async onKeyDown(ev: KeyDownEvent<BannerSettings>): Promise<void> {
    this.bannerIndex++;

    // Re-render from cached data — no network call needed for banner cycling
    if (this.currentAccountId) {
      const entry = dataController.getData(this.currentAccountId, 'gi:act-calendar');
      if (entry?.status === 'ok') {
        const settings = ev.payload.settings;
        await this.withErrorHandling(ev.action, async () => {
          await this.renderCalendar(ev.action, settings, entry.data);
        });
        return;
      }
    }

    // Fallback: request fresh data
    const account = await this.resolveAccount(ev.payload.settings);
    if (!account) return;

    await this.withErrorHandling(ev.action, async () => {
      await dataController.requestUpdate(account.id, 'gi');
    });
  }

  protected override async onDataUpdate(
    action: KeyAction<BannerSettings>,
    update: DataUpdate<'gi:act-calendar'>,
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
    action: KeyAction<BannerSettings>,
    settings: BannerSettings,
    calendar: GenshinActCalendar,
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
      await this.displayWeaponBanner(action, calendar.weapon_card_pool_list, badge);
    }
  }

  private getActiveBanners(pools: GenshinBannerPool[]): GenshinBannerPool[] {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return pools.filter((pool) => {
      const start = Number(pool.start_timestamp);
      const end = Number(pool.end_timestamp);
      return nowSeconds > start && nowSeconds < end;
    });
  }

  private async displayCharacterBanner(
    action: KeyAction<BannerSettings>,
    pools: GenshinBannerPool[],
    badge: BannerBadgeOptions,
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const items = this.getActiveBanners(pools).flatMap((pool) =>
      pool.avatars
        .filter((a) => a.rarity === 5)
        .map((a) => ({
          icon: a.icon,
          countdown_seconds: pool.countdown_seconds,
        })),
    );

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(item.countdown_seconds);
      const dataUri = await fetchImageAsDataUri(item.icon);
      const svg = buildBannerSvg(dataUri, countdown, "gi", badge);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle("");
      await action.setImage(base64);
    }
  }

  private async displayWeaponBanner(
    action: KeyAction<BannerSettings>,
    pools: GenshinBannerPool[],
    badge: BannerBadgeOptions,
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const items = this.getActiveBanners(pools).flatMap((pool) =>
      pool.weapon
        .filter((w) => w.rarity === 5)
        .map((w) => ({
          icon: w.icon,
          countdown_seconds: pool.countdown_seconds,
        })),
    );

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(item.countdown_seconds);
      const dataUri = await fetchImageAsDataUri(item.icon);
      const svg = buildBannerSvg(dataUri, countdown, "gi", badge);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle("");
      await action.setImage(base64);
    }
  }
}
