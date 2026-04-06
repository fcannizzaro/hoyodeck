import {
  PatchCountdownProvider,
  usePatchCountdown,
  type PatchSlotState,
} from "@/contexts/patch-countdown-context";
import { formatCountdownFromSeconds } from "@/utils/banner";
import { readLocalImageAsDataUri } from "@/utils/image";
import type { JsonObject } from "@elgato/utils";
import { defineAction, tw, useKeyDown, useTouchTap } from "@fcannizzaro/streamdeck-react";
import type { GameId, PatchCountdownSettings } from "@hoyodeck/shared/types";

// ─── Constants ────────────────────────────────────────────────────

const ROW_HEIGHT = 34;
const DIAL_ROW_HEIGHT = 26;

/** Per-game avatar icons (same as Wish Tracker) */
const GAME_ICONS: Record<GameId, string> = {
  gi: readLocalImageAsDataUri("imgs/games/gi.webp"),
  hsr: readLocalImageAsDataUri("imgs/games/hsr.webp"),
  zzz: readLocalImageAsDataUri("imgs/games/zzz.webp"),
};

/**
 * Per-game badge background colors — tinted to match each game icon's palette.
 * GI: warm amber/gold  |  HSR: pink/rose  |  ZZZ: cool teal/slate
 */
const BADGE_COLORS: Record<GameId, string> = {
  gi: "rgba(40, 140, 180, 0.65)",
  hsr: "rgba(160, 70, 130, 0.65)",
  zzz: "rgba(200, 120, 40, 0.65)",
};

// ─── Row Component ────────────────────────────────────────────────

interface PatchRowProps {
  game: GameId;
  text: string;
  variant: "key" | "dial";
  stretch?: boolean;
}

/**
 * A single patch countdown row — fixed-width rounded badge pill with game icon + text.
 * The game icon fills the full badge height and shares the left-side border radius,
 * creating a flush icon tab followed by the countdown text.
 */
function PatchRow({ game, text, variant, stretch }: PatchRowProps) {
  const isKey = variant === "key";
  const imageSize = isKey ? ROW_HEIGHT : DIAL_ROW_HEIGHT;
  return (
    <div
      className={tw(
        "flex items-center rounded-[10px] overflow-hidden",
        isKey && "w-[120px] h-[34px]",
        !isKey && (stretch ? "w-[170px] flex-1" : "w-[170px] h-[26px]"),
      )}
      style={{ backgroundColor: BADGE_COLORS[game] }}
    >
      {/* Icon — fills full height, shares left-side border radius */}
      <img src={GAME_ICONS[game]} width={imageSize} height={imageSize} />
      <span
        className={tw(
          "font-bold text-white font-[Inter] ml-[6px]",
          isKey ? "text-[18px] leading-[34px]" : "text-[16px]",
        )}
      >
        {text}
      </span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Format a slot into compact text for the key (e.g. "12d 5h") */
function getSlotText(slot: PatchSlotState): string {
  if (slot.data.status === "ok") {
    return formatCountdownFromSeconds(slot.data.patch.remainingSeconds);
  }
  if (slot.data.status === "error") return "N/A";
  if (slot.data.status === "unconfigured") return "N/A";
  return "--";
}

/**
 * Format a slot into verbose text for the dial.
 * Shows "X days Yh" when ≥1 day remains, otherwise "X hours".
 */
function getSlotTextVerbose(slot: PatchSlotState): string {
  if (slot.data.status !== "ok") return getSlotText(slot);

  const seconds = slot.data.patch.remainingSeconds;
  if (seconds <= 0) return "Ended";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) {
    const d = days === 1 ? "day" : "days";
    return hours > 0 ? `${days} ${d} ${hours}h` : `${days} ${d}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

// ─── Key Component ────────────────────────────────────────────────

/**
 * Patch countdown key component (144×144).
 *
 * Renders the GI 4-star background with vertically centered rows,
 * each showing a game icon + countdown in a rounded badge pill.
 */
function PatchCountdownKey() {
  const { slots, requestUpdateAll } = usePatchCountdown();

  useKeyDown(() => {
    void requestUpdateAll();
  });

  // ─── Empty state ───────────────────────────────────────────

  if (slots.length === 0) {
    return (
      <div className="flex px-4 items-center justify-center size-full bg-[#0f172a]">
        <div className="rounded-[10px] px-4 py-2 bg-[rgba(255,255,255,0.08)] text-[18px] text-center font-semibold text-white/40 font-[Inter]">
          Configure games
        </div>
      </div>
    );
  }

  // ─── Rows ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#0f172a] gap-[10px]">
      {slots.map((slot, i) => (
        <PatchRow
          key={`${slot.game}-${i}`}
          game={slot.game}
          text={getSlotText(slot)}
          variant="key"
        />
      ))}
    </div>
  );
}

// ─── Dial Component ───────────────────────────────────────────────

/**
 * Patch countdown dial component for the Stream Deck+ encoder (200×100).
 *
 * Same row layout adapted for the wider/shorter display with 4-star bg.
 * Touch → refresh, dial rotate → no-op (static display).
 */
function PatchCountdownDial() {
  const { slots, requestUpdateAll } = usePatchCountdown();

  useTouchTap(() => {
    void requestUpdateAll();
  });

  // ─── Empty state ───────────────────────────────────────────

  if (slots.length === 0) {
    return (
      <div className="items-center justify-center size-full bg-[#0f172a]">
        <div className="items-center justify-center rounded-[10px] px-4 py-2 bg-[rgba(255,255,255,0.08)] text-[16px] font-semibold text-white/40 font-[Inter]">
          Configure games
        </div>
      </div>
    );
  }

  // ─── Rows ──────────────────────────────────────────────────

  return (
    <div
      className={tw(
        "flex flex-col items-center w-[200px] h-[100px] bg-[#0f172a] p-1",
        slots.length < 3 && "justify-center",
        slots.length === 2 ? "gap-2" : "gap-1",
      )}
    >
      {slots.map((slot, i) => (
        <PatchRow
          key={`${slot.game}-${i}`}
          game={slot.game}
          text={getSlotTextVerbose(slot)}
          variant="dial"
          stretch={slots.length >= 3}
        />
      ))}
    </div>
  );
}

// ─── Wrapper ──────────────────────────────────────────────────────

function PatchCountdownWrapper({ children }: { children?: React.ReactNode }) {
  return <PatchCountdownProvider>{children}</PatchCountdownProvider>;
}

// ─── Action Definition ────────────────────────────────────────────

export const patchCountdownAction = defineAction<PatchCountdownSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.patch-countdown",
  key: PatchCountdownKey,
  dial: PatchCountdownDial,
  wrapper: PatchCountdownWrapper,
  info: {
    name: "Patch Countdown",
    icon: "imgs/actions/common/patch-countdown-icon",
    tooltip: "Time remaining until each game's next version update",
    states: [{ image: "imgs/actions/common/patch-countdown-state", titleAlignment: "middle" }],
    encoder: {
      layout: "$A0",
      triggerDescription: {
        touch: "Refresh",
      },
    },
  },
});
