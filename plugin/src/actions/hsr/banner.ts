import { action, type KeyAction, type KeyDownEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { StarRailBannerSettings, BannerBadgeOptions } from "@/types/settings";
import type { DataType, DataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services/data-controller";
import type { StarRailActCalendar, StarRailBannerPool } from "@/api/types/hsr";
import { buildBannerSvg, formatCountdownFromSeconds } from "@/utils/banner";
import { fetchImageAsDataUri, localImageExists, readLocalImageAsDataUri } from "@/utils/image";

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

  /** Timeout handle for the eye blink animation */
  private blinkTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Clear any running blink animation */
  private clearBlinkAnimation(): void {
    if (this.blinkTimeout !== null) {
      clearTimeout(this.blinkTimeout);
      this.blinkTimeout = null;
    }
  }

  /**
   * Start a natural eye-blink animation, alternating between open and closed frames.
   * Eyes stay open for ~4s, then briefly close for ~200ms.
   * @param action Stream Deck key action
   * @param openBase64 Base64 data URI of the open-eyes SVG
   * @param closedBase64 Base64 data URI of the closed-eyes SVG
   */
  private startBlinkAnimation(
    action: KeyAction<StarRailBannerSettings>,
    openBase64: string,
    closedBase64: string,
  ): void {
    if (dataController.isAnimationDisabled()) return;

    const showOpen = (): void => {
      void action.setImage(openBase64);
      this.blinkTimeout = setTimeout(showClosed, 4000);
    };

    const showClosed = (): void => {
      void action.setImage(closedBase64);
      this.blinkTimeout = setTimeout(showOpen, 200);
    };

    // Open frame is already shown by the caller; schedule first blink
    this.blinkTimeout = setTimeout(showClosed, 4000);
  }

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

    // Clear any running blink animation before cycling
    this.clearBlinkAnimation();

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
    this.clearBlinkAnimation();

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
          name: it.item_name,
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
      const openSvg = buildBannerSvg(dataUri, countdown, "hsr", badge);
      const openBase64 = `data:image/svg+xml;base64,${btoa(openSvg)}`;
      await action.setTitle("");
      await action.setImage(openBase64);

      // Check for a local closed-eyes image to start blink animation
      const closedPath = `imgs/banner/${item.name.toLowerCase()}-closed.png`;
      if (localImageExists(closedPath)) {
        const closedDataUri = readLocalImageAsDataUri(closedPath);
        const closedSvg = buildBannerSvg(closedDataUri, countdown, "hsr", badge);
        const closedBase64 = `data:image/svg+xml;base64,${btoa(closedSvg)}`;
        this.startBlinkAnimation(action, openBase64, closedBase64);
      }
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

  /**
   * Clean up the blink animation when the action disappears from the deck
   */
  override onWillDisappear(
    ev: WillDisappearEvent<StarRailBannerSettings>,
  ): void {
    super.onWillDisappear(ev);
    this.clearBlinkAnimation();
  }
}
