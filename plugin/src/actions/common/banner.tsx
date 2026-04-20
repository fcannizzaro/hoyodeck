import { defineAction, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { UnifiedBannerSettings, GameId } from "@hoyodeck/shared/types";
import type { GenshinActCalendar, GenshinBannerPool } from "@/api/types/genshin";
import type { StarRailActCalendar, StarRailBannerPool } from "@/api/types/hsr";
import type {
  ZZZGachaCalendar,
  ZZZCharacterGachaEvent,
  ZZZWeaponGachaEvent,
} from "@/api/types/zzz";
import { useGameData } from "@/hooks/use-game-data";
import { AccountProvider } from "@/contexts/account-context";
import { DataProvider } from "@/contexts/data-context";
import { BannerKey, BannerDial, type BannerItem } from "@/components/banner-key";
import type { DataType } from "@/services/data-controller.types";

// ─── Icon styles per game ─────────────────────────────────────────

const ICON_STYLES: Record<GameId, { top: number; left: number; width: number; height: number }> = {
  gi: { top: 0, left: 0, width: 144, height: 144 },
  hsr: { top: -12, left: 0, width: 144, height: 169 },
  zzz: { top: -12, left: 0, width: 144, height: 169 },
};

// ─── Calendar data types per game ─────────────────────────────────

const CALENDAR_DATA_TYPES: Record<GameId, DataType> = {
  gi: "gi:act-calendar",
  hsr: "hsr:act-calendar",
  zzz: "zzz:gacha-calendar",
};

// ─── GI item extraction ───────────────────────────────────────────

function getGIActiveBanners(pools: GenshinBannerPool[]): GenshinBannerPool[] {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return pools.filter((pool) => {
    const start = Number(pool.start_timestamp);
    const end = Number(pool.end_timestamp);
    return nowSeconds > start && nowSeconds < end;
  });
}

function getGICharacterItems(calendar: GenshinActCalendar): BannerItem[] {
  return getGIActiveBanners(calendar.avatar_card_pool_list).flatMap((pool: GenshinBannerPool) =>
    pool.avatars
      .filter((a) => a.rarity === 5)
      .map((a) => ({
        icon: a.icon,
        name: a.name,
        countdownSeconds: pool.countdown_seconds,
      })),
  );
}

function getGIWeaponItems(calendar: GenshinActCalendar): BannerItem[] {
  return getGIActiveBanners(calendar.weapon_card_pool_list).flatMap((pool: GenshinBannerPool) =>
    pool.weapon
      .filter((w) => w.rarity === 5)
      .map((w) => ({
        icon: w.icon,
        countdownSeconds: pool.countdown_seconds,
      })),
  );
}

// ─── HSR item extraction ──────────────────────────────────────────

function getHSRActiveBanners(pools: StarRailBannerPool[]): StarRailBannerPool[] {
  return pools.filter((pool) => {
    const now = pool.time_info.now;
    return now > pool.time_info.start_ts && now < pool.time_info.end_ts;
  });
}

function getHSRCountdownSeconds(time_info: StarRailBannerPool["time_info"]): number {
  const endTs = Number(time_info.end_ts);
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(endTs - nowSeconds, 0);
}

function getHSRCharacterItems(calendar: StarRailActCalendar): BannerItem[] {
  return getHSRActiveBanners(calendar.avatar_card_pool_list).flatMap((pool) =>
    pool.avatar_list
      .filter((it) => it.rarity === "5")
      .map((it) => ({
        icon: it.icon_url,
        name: it.item_name,
        countdownSeconds: getHSRCountdownSeconds(pool.time_info),
      })),
  );
}

function getHSRWeaponItems(calendar: StarRailActCalendar): BannerItem[] {
  return getHSRActiveBanners(calendar.equip_card_pool_list).flatMap((pool) =>
    pool.equip_list
      .filter((it) => it.rarity === "5")
      .map((it) => ({
        icon: it.item_url,
        countdownSeconds: getHSRCountdownSeconds(pool.time_info),
      })),
  );
}

// ─── ZZZ item extraction ──────────────────────────────────────────

function getZZZActiveEvents<T extends { gacha_state: string }>(events: T[]): T[] {
  return events.filter((e) => e.gacha_state === "GACHA_STATE_IN_PROGRESS");
}

function getZZZCharacterItems(calendar: ZZZGachaCalendar): BannerItem[] {
  return getZZZActiveEvents(calendar.avatar_gacha_schedule_list).flatMap(
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

function getZZZWeaponItems(calendar: ZZZGachaCalendar): BannerItem[] {
  return getZZZActiveEvents(calendar.weapon_gacha_schedule_list).flatMap(
    (event: ZZZWeaponGachaEvent) =>
      event.weapon_list
        .filter((it) => it.rarity === "S")
        .map((it) => ({
          icon: it.icon,
          countdownSeconds: event.left_end_ts,
        })),
  );
}

// ─── Unified item extractor ───────────────────────────────────────

function extractItems(game: GameId, type: string, data: unknown): BannerItem[] {
  switch (game) {
    case "gi": {
      const calendar = data as GenshinActCalendar;
      return type === "character" ? getGICharacterItems(calendar) : getGIWeaponItems(calendar);
    }
    case "hsr": {
      const calendar = data as StarRailActCalendar;
      return type === "character" ? getHSRCharacterItems(calendar) : getHSRWeaponItems(calendar);
    }
    case "zzz": {
      const calendar = data as ZZZGachaCalendar;
      return type === "character" ? getZZZCharacterItems(calendar) : getZZZWeaponItems(calendar);
    }
  }
}

// ─── Shared data hook ─────────────────────────────────────────────

function useUnifiedBannerData() {
  const [settings] = useSettings<UnifiedBannerSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;
  const type = settings.type ?? "character";
  const dataType = CALENDAR_DATA_TYPES[game];
  const { account, data: calendarEntry, requestUpdate } = useGameData(dataType);

  const calendar = calendarEntry?.status === "ok" ? calendarEntry.data : null;
  const items = calendar ? extractItems(game, type, calendar) : [];

  return { game, account, items, requestUpdate };
}

// ─── Key Component ────────────────────────────────────────────────

function UnifiedBannerKey() {
  const { game, ...data } = useUnifiedBannerData();
  return <BannerKey game={game} iconStyle={ICON_STYLES[game]} {...data} />;
}

// ─── Dial Component ───────────────────────────────────────────────

function UnifiedBannerDial() {
  const { game, ...data } = useUnifiedBannerData();
  return <BannerDial game={game} iconStyle={ICON_STYLES[game]} {...data} />;
}

// ─── Custom Wrapper (dynamic game from settings) ──────────────────

function BannerWrapper({ children }: { children?: React.ReactNode }) {
  const [settings] = useSettings<UnifiedBannerSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;
  const dataType = CALENDAR_DATA_TYPES[game];

  return (
    <AccountProvider game={game}>
      <DataProvider game={game} dataTypes={[dataType]}>
        {children}
      </DataProvider>
    </AccountProvider>
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const bannerAction = defineAction<UnifiedBannerSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.banner",
  key: UnifiedBannerKey,
  dial: UnifiedBannerDial,
  wrapper: BannerWrapper,
  info: {
    name: "Wish Banner",
    disableCaching: true,
    icon: "imgs/actions/common/banner-icon",
    tooltip: "Display current banner countdown for any HoYoverse game",
    states: [{ image: "imgs/actions/gi/5-star", titleAlignment: "middle" }],
    encoder: {
      layout: "$A0",
      triggerDescription: {
        rotate: "Cycle banner",
        touch: "Cycle banner",
      },
    },
  },
});
