import { defineAction, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { StarRailBannerSettings } from "@/types/settings";
import type { StarRailActCalendar, StarRailBannerPool } from "@/api/types/hsr";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { BannerKey, type BannerItem } from "@/components/banner-key";

// ─── Icon style (HSR portraits are taller, offset upward) ────────

const ICON_STYLE = { top: -12, left: 0, width: 144, height: 169 };

// ─── Item extraction ──────────────────────────────────────────────

function getActiveBanners(pools: StarRailBannerPool[]): StarRailBannerPool[] {
  return pools.filter((pool) => {
    const now = pool.time_info.now;
    return now > pool.time_info.start_ts && now < pool.time_info.end_ts;
  });
}

function getCountdownSeconds(time_info: StarRailBannerPool["time_info"]): number {
  const endTs = Number(time_info.end_ts);
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(endTs - nowSeconds, 0);
}

function getCharacterItems(calendar: StarRailActCalendar): BannerItem[] {
  return getActiveBanners(calendar.avatar_card_pool_list).flatMap((pool) =>
    pool.avatar_list
      .filter((it) => it.rarity === "5")
      .map((it) => ({
        icon: it.icon_url,
        name: it.item_name,
        countdownSeconds: getCountdownSeconds(pool.time_info),
      })),
  );
}

function getWeaponItems(calendar: StarRailActCalendar): BannerItem[] {
  return getActiveBanners(calendar.equip_card_pool_list).flatMap((pool) =>
    pool.equip_list
      .filter((it) => it.rarity === "5")
      .map((it) => ({
        icon: it.item_url,
        countdownSeconds: getCountdownSeconds(pool.time_info),
      })),
  );
}

// ─── Key Component ────────────────────────────────────────────────

function StarRailBannerKey() {
  const [settings] = useSettings<StarRailBannerSettings & JsonObject>();
  const { account, data: calendarEntry, requestUpdate } = useGameData("hsr:act-calendar");

  const type = settings.type ?? "character";
  const calendar = calendarEntry?.status === "ok" ? calendarEntry.data : null;

  const items = calendar
    ? type === "character"
      ? getCharacterItems(calendar)
      : getWeaponItems(calendar)
    : [];

  return (
    <BannerKey
      game="hsr"
      account={account}
      items={items}
      requestUpdate={requestUpdate}
      iconStyle={ICON_STYLE}
    />
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const starRailBannerAction = defineAction<StarRailBannerSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.hsr.banner",
  key: StarRailBannerKey,
  wrapper: createActionWrapper("hsr", ["hsr:act-calendar"]),
});
