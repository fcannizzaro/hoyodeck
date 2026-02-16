import { action, type KeyAction, type KeyDownEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { BannerSettings, BannerBadgeOptions } from "@/types/settings";
import type { DataType, DataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services/data-controller";
import type { GenshinActCalendar, GenshinBannerPool } from "@/api/types/genshin";
import { buildBannerSvg, formatCountdownFromSeconds } from "@/utils/banner";
import { fetchImageAsDataUri, localImageExists, readLocalImageAsDataUri } from "@/utils/image";

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
    action: KeyAction<BannerSettings>,
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
    return ['gi:act-calendar'];
  }

  override async onKeyDown(ev: KeyDownEvent<BannerSettings>): Promise<void> {
    // Clear any running blink animation before cycling
    this.clearBlinkAnimation();

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
          name: a.name,
          countdown_seconds: pool.countdown_seconds,
        })),
    );

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(item.countdown_seconds);
      const dataUri = await fetchImageAsDataUri(item.icon);
      const openSvg = buildBannerSvg(dataUri, countdown, "gi", badge);
      const openBase64 = `data:image/svg+xml;base64,${btoa(openSvg)}`;
      await action.setTitle("");
      await action.setImage(openBase64);

      // Check for a local closed-eyes image to start blink animation
      const closedPath = `imgs/banner/${item.name.toLowerCase()}.png`;
      if (localImageExists(closedPath)) {
        const closedDataUri = readLocalImageAsDataUri(closedPath);
        const closedSvg = buildBannerSvg(closedDataUri, countdown, "gi", badge);
        const closedBase64 = `data:image/svg+xml;base64,${btoa(closedSvg)}`;
        this.startBlinkAnimation(action, openBase64, closedBase64);
      }
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

  /**
   * Clean up the blink animation when the action disappears from the deck
   */
  override onWillDisappear(
    ev: WillDisappearEvent<BannerSettings>,
  ): void {
    super.onWillDisappear(ev);
    this.clearBlinkAnimation();
  }
}
