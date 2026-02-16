import { action } from "@elgato/streamdeck";
import { BaseBannerAction, type BannerItem } from "../base/banner-action";
import type { ZZZBannerSettings } from "@/types/settings";
import type { DataType } from "@/services/data-controller.types";
import type {
  ZZZGachaCalendar,
  ZZZCharacterGachaEvent,
  ZZZWeaponGachaEvent,
} from "@/api/types/zzz";

/**
 * ZZZ Banner Action
 * Displays current Signal Search banner info from the HoYoLab gacha calendar API.
 * Key press cycles through multiple concurrent character banners.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.zzz.banner" })
export class BannerAction extends BaseBannerAction<ZZZBannerSettings, 'zzz:gacha-calendar', ZZZGachaCalendar> {
  protected readonly game = 'zzz' as const;

  protected getSubscribedDataTypes(): DataType[] {
    return ['zzz:gacha-calendar'];
  }

  protected getCharacterItems(calendar: ZZZGachaCalendar): BannerItem[] {
    return this.getActiveEvents(calendar.avatar_gacha_schedule_list).flatMap((event) =>
      event.avatar_list
        .filter((it) => it.rarity === "S")
        .map((it) => ({
          icon: it.icon,
          name: it.avatar_name,
          countdownSeconds: event.left_end_ts,
        })),
    );
  }

  protected getWeaponItems(calendar: ZZZGachaCalendar): BannerItem[] {
    return this.getActiveEvents(calendar.weapon_gacha_schedule_list).flatMap((event) =>
      event.weapon_list
        .filter((it) => it.rarity === "S")
        .map((it) => ({
          icon: it.icon,
          countdownSeconds: event.left_end_ts,
        })),
    );
  }

  private getActiveEvents<T extends { gacha_state: string }>(
    events: T[],
  ): T[] {
    return events.filter(
      (e) => e.gacha_state === "GACHA_STATE_IN_PROGRESS",
    );
  }
}
