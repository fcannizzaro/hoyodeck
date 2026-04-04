import { defineAction, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { ZZZBannerSettings } from "@hoyodeck/shared/types";
import type {
  ZZZGachaCalendar,
  ZZZCharacterGachaEvent,
  ZZZWeaponGachaEvent,
} from "@/api/types/zzz";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { BannerKey, BannerDial, type BannerItem } from "@/components/banner-key";

// ─── Icon style (ZZZ portraits are taller, offset upward) ────────

const ICON_STYLE = { top: -12, left: 0, width: 144, height: 169 };

// ─── Item extraction ──────────────────────────────────────────────

function getActiveEvents<T extends { gacha_state: string }>(events: T[]): T[] {
  return events.filter((e) => e.gacha_state === "GACHA_STATE_IN_PROGRESS");
}

function getCharacterItems(calendar: ZZZGachaCalendar): BannerItem[] {
  return getActiveEvents(calendar.avatar_gacha_schedule_list).flatMap(
    (event: ZZZCharacterGachaEvent) =>
      event.avatar_list
        .filter((it) => it.rarity === "S")
        .map((it) => ({
          icon: it.icon,
          name: it.avatar_name,
          countdownSeconds: event.left_end_ts,
        })),
  );
}

function getWeaponItems(calendar: ZZZGachaCalendar): BannerItem[] {
  return getActiveEvents(calendar.weapon_gacha_schedule_list).flatMap(
    (event: ZZZWeaponGachaEvent) =>
      event.weapon_list
        .filter((it) => it.rarity === "S")
        .map((it) => ({
          icon: it.icon,
          countdownSeconds: event.left_end_ts,
        })),
  );
}

// ─── Shared data hook ─────────────────────────────────────────────

function useZZZBannerData() {
  const [settings] = useSettings<ZZZBannerSettings & JsonObject>();
  const { account, data: calendarEntry, requestUpdate } = useGameData("zzz:gacha-calendar");

  const type = settings.type ?? "character";
  const calendar = calendarEntry?.status === "ok" ? calendarEntry.data : null;

  const items = calendar
    ? type === "character"
      ? getCharacterItems(calendar)
      : getWeaponItems(calendar)
    : [];

  return { account, items, requestUpdate };
}

// ─── Key Component ────────────────────────────────────────────────

function ZZZBannerKey() {
  const data = useZZZBannerData();
  return <BannerKey game="zzz" iconStyle={ICON_STYLE} {...data} />;
}

// ─── Dial Component ───────────────────────────────────────────────

function ZZZBannerDial() {
  const data = useZZZBannerData();
  return <BannerDial game="zzz" iconStyle={ICON_STYLE} {...data} />;
}

// ─── Action Definition ────────────────────────────────────────────

export const zzzBannerAction = defineAction<ZZZBannerSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.zzz.banner",
  key: ZZZBannerKey,
  dial: ZZZBannerDial,
  wrapper: createActionWrapper("zzz", ["zzz:gacha-calendar"]),
  info: {
    name: "[ZZZ] Banner",
    icon: "imgs/actions/zzz/banner-icon",
    tooltip: "Display current Signal Search banner countdown",
    states: [{ image: "imgs/actions/zzz/5-star", titleAlignment: "middle" }],
    encoder: {
      layout: "$A0",
      triggerDescription: {
        rotate: "Cycle banner",
        touch: "Cycle banner",
      },
    },
  },
});
