import { action, type KeyAction, type KeyDownEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { ZZZBannerSettings, BannerBadgeOptions } from "@/types/settings";
import type { DataType, DataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services/data-controller";
import type {
  ZZZGachaCalendar,
  ZZZCharacterGachaEvent,
  ZZZWeaponGachaEvent,
} from "@/api/types/zzz";
import { buildBannerSvg, formatCountdownFromSeconds } from "@/utils/banner";
import { fetchImageAsDataUri, localImageExists, readLocalImageAsDataUri } from "@/utils/image";

/**
 * ZZZ Banner Action
 * Displays current Signal Search banner info from the HoYoLab gacha calendar API.
 * Key press cycles through multiple concurrent character banners.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.zzz.banner" })
export class BannerAction extends BaseAction<ZZZBannerSettings, 'zzz:gacha-calendar'> {
  protected readonly game = 'zzz' as const;

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
    action: KeyAction<ZZZBannerSettings>,
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
    return ['zzz:gacha-calendar'];
  }

  override async onKeyDown(
    ev: KeyDownEvent<ZZZBannerSettings>,
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
      const entry = dataController.getData(this.currentAccountId, 'zzz:gacha-calendar');
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
      await dataController.requestUpdate(account.id, 'zzz');
    });
  }

  protected override async onDataUpdate(
    action: KeyAction<ZZZBannerSettings>,
    update: DataUpdate<'zzz:gacha-calendar'>,
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
    action: KeyAction<ZZZBannerSettings>,
    settings: ZZZBannerSettings,
    calendar: ZZZGachaCalendar,
  ): Promise<void> {
    const type = settings.type ?? "character";

    const globalSettings = await this.getGlobalSettings();
    const badge: BannerBadgeOptions = {
      position: globalSettings.bannerBadgePosition ?? "center",
      layout: globalSettings.bannerBadgeLayout ?? "horizontal",
      fontSize: globalSettings.bannerBadgeFontSize ?? 18,
    };

    if (type === "character") {
      await this.displayCharacterBanner(
        action,
        calendar.avatar_gacha_schedule_list,
        badge,
      );
    } else {
      await this.displayWeaponBanner(
        action,
        calendar.weapon_gacha_schedule_list,
        badge,
      );
    }
  }

  private getActiveEvents<T extends { gacha_state: string }>(
    events: T[],
  ): T[] {
    return events.filter(
      (e) => e.gacha_state === "GACHA_STATE_IN_PROGRESS",
    );
  }

  private async displayCharacterBanner(
    action: KeyAction<ZZZBannerSettings>,
    events: ZZZCharacterGachaEvent[],
    badge: BannerBadgeOptions,
  ): Promise<void> {
    const items = this.getActiveEvents(events).flatMap((event) =>
      event.avatar_list
        .filter((it) => it.rarity === "S")
        .map((it) => ({
          icon: it.icon,
          name: it.avatar_name,
          left_end_ts: event.left_end_ts,
        })),
    );

    if (items.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(item.left_end_ts);
      const dataUri = await fetchImageAsDataUri(item.icon);
      const openSvg = buildBannerSvg(dataUri, countdown, "zzz", badge);
      const openBase64 = `data:image/svg+xml;base64,${btoa(openSvg)}`;
      await action.setTitle("");
      await action.setImage(openBase64);

      // Check for a local closed-eyes image to start blink animation
      const closedPath = `imgs/banner/${item.name.toLowerCase()}.png`;
      if (localImageExists(closedPath)) {
        const closedDataUri = readLocalImageAsDataUri(closedPath);
        const closedSvg = buildBannerSvg(closedDataUri, countdown, "zzz", badge);
        const closedBase64 = `data:image/svg+xml;base64,${btoa(closedSvg)}`;
        this.startBlinkAnimation(action, openBase64, closedBase64);
      }
    }
  }

  private async displayWeaponBanner(
    action: KeyAction<ZZZBannerSettings>,
    events: ZZZWeaponGachaEvent[],
    badge: BannerBadgeOptions,
  ): Promise<void> {
    const items = this.getActiveEvents(events).flatMap((event) =>
      event.weapon_list
        .filter((it) => it.rarity === "S")
        .map((it) => ({
          icon: it.icon,
          left_end_ts: event.left_end_ts,
        })),
    );

    if (items.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(item.left_end_ts);
      const dataUri = await fetchImageAsDataUri(item.icon);
      const svg = buildBannerSvg(dataUri, countdown, "zzz", badge);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle("");
      await action.setImage(base64);
    }
  }

  /**
   * Clean up the blink animation when the action disappears from the deck
   */
  override onWillDisappear(
    ev: WillDisappearEvent<ZZZBannerSettings>,
  ): void {
    super.onWillDisappear(ev);
    this.clearBlinkAnimation();
  }
}
