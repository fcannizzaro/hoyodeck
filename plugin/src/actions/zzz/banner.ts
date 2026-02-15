import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
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
import { fetchImageAsDataUri } from "@/utils/image";

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

  protected getSubscribedDataTypes(): DataType[] {
    return ['zzz:gacha-calendar'];
  }

  override async onKeyDown(
    ev: KeyDownEvent<ZZZBannerSettings>,
  ): Promise<void> {
    const settings = ev.payload.settings;
    const type = settings.type ?? "character";

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
}
