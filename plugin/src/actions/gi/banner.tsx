import { defineAction, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { BannerSettings } from "@/types/settings";
import type { GenshinActCalendar, GenshinBannerPool } from "@/api/types/genshin";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { BannerKey, type BannerItem } from "@/components/banner-key";

// ─── Icon style (GI icons fit 1:1 in the key) ────────────────────

const ICON_STYLE = { top: 0, left: 0, width: 144, height: 144 };

// ─── Item extraction ──────────────────────────────────────────────

function getActiveBanners(pools: GenshinBannerPool[]): GenshinBannerPool[] {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return pools.filter((pool) => {
    const start = Number(pool.start_timestamp);
    const end = Number(pool.end_timestamp);
    return nowSeconds > start && nowSeconds < end;
  });
}

function getCharacterItems(calendar: GenshinActCalendar): BannerItem[] {
  return getActiveBanners(calendar.avatar_card_pool_list).flatMap((pool: GenshinBannerPool) =>
    pool.avatars
      .filter((a) => a.rarity === 5)
      .map((a) => ({
        icon: a.icon,
        name: a.name,
        countdownSeconds: pool.countdown_seconds,
      })),
  );
}

function getWeaponItems(calendar: GenshinActCalendar): BannerItem[] {
  return getActiveBanners(calendar.weapon_card_pool_list).flatMap((pool: GenshinBannerPool) =>
    pool.weapon
      .filter((w) => w.rarity === 5)
      .map((w) => ({
        icon: w.icon,
        countdownSeconds: pool.countdown_seconds,
      })),
  );
}

// ─── Key Component ────────────────────────────────────────────────

function GenshinBannerKey() {
  const [settings] = useSettings<BannerSettings & JsonObject>();
  const { account, data: calendarEntry, requestUpdate } = useGameData("gi:act-calendar");

  const type = settings.type ?? "character";
  const calendar = calendarEntry?.status === "ok" ? calendarEntry.data : null;

  const items = calendar
    ? type === "character"
      ? getCharacterItems(calendar)
      : getWeaponItems(calendar)
    : [];

  return (
    <BannerKey
      game="gi"
      account={account}
      items={items}
      requestUpdate={requestUpdate}
      iconStyle={ICON_STYLE}
    />
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const genshinBannerAction = defineAction<BannerSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.banner",
  key: GenshinBannerKey,
  wrapper: createActionWrapper("gi", ["gi:act-calendar"]),
});
