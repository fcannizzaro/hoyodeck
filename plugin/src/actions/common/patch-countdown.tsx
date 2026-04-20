import {
  PatchCountdownProvider,
  usePatchCountdown,
  type PatchSlotState,
} from "@/contexts/patch-countdown-context";
import { formatCountdownFromSeconds } from "@/utils/banner";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import type { JsonObject } from "@elgato/utils";
import { defineAction, cn, useKeyDown, useTouchTap } from "@fcannizzaro/streamdeck-react";
import type { GameId, PatchCountdownSettings } from "@hoyodeck/shared/types";

// ─── Constants ────────────────────────────────────────────────────

const ROW_HEIGHT = 34;
const DIAL_ROW_HEIGHT = 26;

/** Per-game avatar icon paths (same as Wish Tracker) */
const GAME_ICON_PATHS: Record<GameId, string> = {
  gi: "imgs/games/gi.webp",
  hsr: "imgs/games/hsr.webp",
  zzz: "imgs/games/zzz.webp",
};

/**
 * Per-game badge background classes — tinted to match each game icon's palette.
 * GI: warm amber/gold  |  HSR: pink/rose  |  ZZZ: cool teal/slate
 */
const BADGE_BG_CLASS: Record<GameId, string> = {
  gi: "bg-badge-gi",
  hsr: "bg-badge-hsr",
  zzz: "bg-badge-zzz",
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
  const gameIcon = useLocalImageDataUri(GAME_ICON_PATHS[game]);
  const isKey = variant === "key";
  const imageSize = isKey ? ROW_HEIGHT : DIAL_ROW_HEIGHT;
  return (
    <div
      className={cn(
        "flex items-center rounded-badge overflow-hidden",
        BADGE_BG_CLASS[game],
        isKey ? "w-30 h-8.5" : stretch ? "w-42.5 flex-1" : "w-42.5 h-6.5",
      )}
    >
      {/* Icon — fills full height, shares left-side border radius */}
      <img src={gameIcon} width={imageSize} height={imageSize} />
      <span
        className={cn("font-bold text-white font-body ml-1.5", isKey ? "text-lg" : "text-base")}
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
    return formatCountdownFromSeconds(slot.data.patch);
  }
  if (slot.data.status === "error") return "N/A";
  return "--";
}

/**
 * Format a slot into verbose text for the dial.
 * Shows "X days Yh" when ≥1 day remains, otherwise "X hours".
 */
function getSlotTextVerbose(slot: PatchSlotState): string {
  if (slot.data.status !== "ok") return getSlotText(slot);

  const seconds = slot.data.patch;
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
      <div className="flex px-4 items-center justify-center size-full bg-surface">
        <div className="rounded-badge px-4 py-2 bg-overlay-white text-lg text-center font-semibold text-white/40 font-body">
          Configure games
        </div>
      </div>
    );
  }

  // ─── Rows ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-surface gap-2.5">
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
      <div className="items-center justify-center size-full bg-surface">
        <div className="items-center justify-center rounded-badge px-4 py-2 bg-overlay-white text-base font-semibold text-white/40 font-body">
          Configure games
        </div>
      </div>
    );
  }

  // ─── Rows ──────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "flex flex-col items-center w-50 h-25 bg-surface p-1",
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
    disableCaching: true,
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
