import { useCallback } from "react";
import {
  defineAction,
  useSettings,
  useGlobalSettings,
  useDialRotate,
  useTouchTap,
  useDialDown,
  useSpring,
  SpringPresets,
  cn,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type {
  GameId,
  GlobalSettings,
  HoyoAccount,
  WishTrackerSettings,
  WishTrackerSlot,
  WishTrackerBannerType,
  WishPityData,
} from "@hoyodeck/shared/types";
import { readLocalImageAsDataUri } from "@/utils/image";

// ─── Constants ────────────────────────────────────────────────────

const BANNER_LABELS: Record<WishTrackerBannerType, string> = {
  character: "Character",
  weapon: "Weapon",
  lightcone: "Weapon",
  "w-engine": "Weapon",
};

/** Hard pity values per game and banner type */
const HARD_PITY: Record<GameId, Record<string, number>> = {
  gi: { character: 90, weapon: 80 },
  hsr: { character: 90, lightcone: 80 },
  zzz: { character: 90, "w-engine": 80 },
};

/** Per-game wish item icons */
const WISH_ICONS: Record<GameId, string> = {
  gi: readLocalImageAsDataUri("imgs/actions/gi/wish.webp"),
  hsr: readLocalImageAsDataUri("imgs/actions/hsr/wish.webp"),
  zzz: readLocalImageAsDataUri("imgs/actions/zzz/wish.webp"),
};

/** Game avatar icons for the top tab bar */
const GAME_ICONS: Record<GameId, string> = {
  gi: readLocalImageAsDataUri("imgs/games/gi.webp"),
  hsr: readLocalImageAsDataUri("imgs/games/hsr.webp"),
  zzz: readLocalImageAsDataUri("imgs/games/zzz.webp"),
};

// ─── Helpers ──────────────────────────────────────────────────────

function getHardPity(game: GameId, bannerType: WishTrackerBannerType): number {
  return HARD_PITY[game]?.[bannerType] ?? 90;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

// ─── Pity data hook (reads/writes global settings) ────────────────

function useWishPity(game: GameId, bannerType: WishTrackerBannerType) {
  const [globalSettings, setGlobalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  const key = `${game}:${bannerType}`;
  const data: WishPityData = globalSettings.wishTrackers?.[key] ?? { pity: 0, guaranteed: false };
  const hardPity = getHardPity(game, bannerType);

  const update = useCallback(
    (partial: Partial<WishPityData>) => {
      const current = globalSettings.wishTrackers?.[key] ?? { pity: 0, guaranteed: false };
      const next = { ...current, ...partial };
      setGlobalSettings({
        wishTrackers: { ...globalSettings.wishTrackers, [key]: next },
      });
    },
    [key, globalSettings.wishTrackers],
  );

  return { pity: data.pity, hardPity, update };
}

// ─── Game Tab ─────────────────────────────────────────────────────

interface GameTabProps {
  game: GameId;
  accountName: string | undefined;
  active: boolean;
}

function GameTab({ game, accountName, active }: GameTabProps) {
  return (
    <div
      className={cn(
        "flex-1 flex items-center justify-center h-5.5",
        active ? "bg-white/15" : "opacity-40",
      )}
    >
      <img src={GAME_ICONS[game]} width={14} height={14} className="rounded-sm" />
      {accountName && (
        <span
          className={cn(
            "text-[12px] text-white font-body ml-1",
            active ? "font-bold" : "font-medium",
          )}
        >
          {accountName}
        </span>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyDial() {
  return (
    <div className="flex items-center justify-center w-50 h-25 bg-surface">
      <span className="text-xs font-semibold text-white/40 font-body">Configure Slots</span>
    </div>
  );
}

// ─── Dial Component ───────────────────────────────────────────────

/**
 * Wish Tracker dial component for the Stream Deck+ encoder display.
 *
 * Layout (200×100):
 *  - Top bar (22px): game tabs from configured slots
 *  - Main area (flex-1): large pity counter + wish icon, banner label
 *
 * Interaction:
 *  - Touch: cycle active slot (game)
 *  - Long touch: reset pity to 0
 *  - Dial rotate: +1 pity per tick
 *  - Dial press: +10 pity
 */
function WishTrackerDial() {
  const [settings, setSettings] = useSettings<WishTrackerSettings & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  const accounts = globalSettings.accounts ?? {};
  const slots: WishTrackerSlot[] = settings.slots ?? [];
  const rawActiveSlot = settings.activeSlot ?? 0;
  const activeSlot = slots.length > 0 ? clamp(rawActiveSlot, 0, slots.length - 1) : 0;
  const activeGame: GameId = slots[activeSlot]?.game ?? "gi";
  const bannerType: WishTrackerBannerType =
    (settings.bannerType as WishTrackerBannerType) ?? "character";

  const { pity, hardPity, update: updatePity } = useWishPity(activeGame, bannerType);
  const { value: animatedPity } = useSpring(pity, SpringPresets.snap);

  const displayPity = Math.round(animatedPity);
  const ratio = hardPity > 0 ? Math.min(Math.max(pity / hardPity, 0), 1) : 0;
  const pityColorClass =
    ratio >= 0.9 ? "text-danger" : ratio >= 0.7 ? "text-warning" : "text-white";

  const wishIcon = WISH_ICONS[activeGame];

  // Dial rotate: +1 pity per tick
  useDialRotate(({ ticks }) => {
    if (slots.length === 0) return;
    const newPity = clamp(pity + ticks, 0, hardPity);
    updatePity({ pity: newPity });
  });

  // Dial press: +10 pity
  useDialDown(() => {
    if (slots.length === 0) return;
    const newPity = clamp(pity + 10, 0, hardPity);
    updatePity({ pity: newPity });
  });

  // Touch: cycle active slot — long touch: reset pity
  useTouchTap(({ hold }) => {
    if (slots.length === 0) return;
    if (hold) {
      updatePity({ pity: 0 });
      return;
    }
    const nextSlot = (activeSlot + 1) % slots.length;
    setSettings({ activeSlot: nextSlot });
  });

  if (slots.length === 0) {
    return <EmptyDial />;
  }

  return (
    <div className="flex flex-col w-50 h-25 bg-surface">
      {/* ── Top bar: game tabs from configured slots ── */}
      <div className="flex h-5.5">
        {slots.map((slot, i) => {
          const account = accounts[slot.accountId] as HoyoAccount | undefined;
          return (
            <GameTab
              key={`${slot.game}-${i}`}
              game={slot.game}
              accountName={account?.name}
              active={i === activeSlot}
            />
          );
        })}
      </div>

      {/* ── Main area: pity counter + wish icon ── */}
      <div className="flex-1 flex items-center justify-center">
        {/* Pity counter */}
        <div className="flex items-baseline mr-2">
          <span className={cn("text-[32px] font-extrabold font-body leading-none", pityColorClass)}>
            {displayPity}
          </span>
          <span className="text-sm font-semibold text-white/35 font-body ml-0.75">/{hardPity}</span>
        </div>

        {/* Wish icon */}
        <img src={wishIcon} width={44} height={44} />
      </div>

      {/* ── Bottom bar: banner type label ── */}
      <div className="flex items-center justify-center h-4.5 bg-overlay-white">
        <span className="text-2xs font-semibold text-white/50 font-body">
          {BANNER_LABELS[bannerType]}
        </span>
      </div>
    </div>
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const wishTrackerAction = defineAction<WishTrackerSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.wish-tracker",
  dial: WishTrackerDial,
  info: {
    name: "Wish Tracker",
    icon: "imgs/actions/common/wish-tracker-icon",
    tooltip: "Manual banner wish/pity counter for all HoYoverse games",
    states: [{ image: "imgs/actions/gi/5-star", titleAlignment: "middle" }],
    encoder: {
      layout: "$A0",
      triggerDescription: {
        rotate: "+1 pity",
        push: "+10 pity",
        touch: "Change game",
        longTouch: "Reset pity",
      },
    },
  },
});
