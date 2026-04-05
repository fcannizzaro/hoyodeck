import {
  defineAction,
  useKeyDown,
  useTouchTap,
  useDialRotate,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GameId, PatchCountdownSettings } from "@hoyodeck/shared/types";
import { readLocalImageAsDataUri } from "@/utils/image";
import { formatCountdownFromSeconds } from "@/utils/banner";
import {
  PatchCountdownProvider,
  usePatchCountdown,
  type PatchSlotState,
} from "@/contexts/patch-countdown-context";

// ─── Constants ────────────────────────────────────────────────────

const KEY_SIZE = 144;
const DIAL_WIDTH = 200;
const DIAL_HEIGHT = 100;

const ROW_HEIGHT = 34;
const ROW_GAP = 10;

const DIAL_ROW_HEIGHT = 26;
const DIAL_ROW_GAP = 5;

/** Fixed badge width so all rows are the same size */
const BADGE_WIDTH = 120;
const DIAL_BADGE_WIDTH = 170;

/** Solid dark navy background — same as Wish Tracker */
const BG_COLOR = "#0f172a";

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
  badgeWidth: number;
  fontSize: number;
  rowHeight: number;
}

/**
 * A single patch countdown row — fixed-width rounded badge pill with game icon + text.
 * The game icon fills the full badge height and shares the left-side border radius,
 * creating a flush icon tab followed by the countdown text.
 */
function PatchRow({ game, text, badgeWidth, fontSize, rowHeight }: PatchRowProps) {
  return (
    <div
      className="flex items-center"
      style={{
        backgroundColor: BADGE_COLORS[game],
        borderRadius: 10,
        height: rowHeight,
        width: badgeWidth,
        overflow: "hidden",
      }}
    >
      {/* Icon — fills full height, shares left-side border radius */}
      <img src={GAME_ICONS[game]} width={rowHeight} height={rowHeight} />
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: "white",
          fontFamily: "Inter",
          lineHeight: `${rowHeight}px`,
          marginLeft: 6,
        }}
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
      <div
        className="flex items-center justify-center w-full h-full"
        style={{ backgroundColor: BG_COLOR }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderRadius: 10,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.4)",
              fontFamily: "Inter",
            }}
          >
            Configure
          </span>
        </div>
      </div>
    );
  }

  // ─── Rows ──────────────────────────────────────────────────

  const totalRowsHeight = slots.length * ROW_HEIGHT + (slots.length - 1) * ROW_GAP;
  const topOffset = Math.round((KEY_SIZE - totalRowsHeight) / 2);

  return (
    <div className="relative w-full h-full" style={{ backgroundColor: BG_COLOR }}>
      <div
        className="absolute flex flex-col items-center"
        style={{
          top: topOffset,
          left: 0,
          width: KEY_SIZE,
          gap: ROW_GAP,
        }}
      >
        {slots.map((slot, i) => (
          <PatchRow
            key={`${slot.game}-${i}`}
            game={slot.game}
            text={getSlotText(slot)}
            badgeWidth={BADGE_WIDTH}
            fontSize={18}
            rowHeight={ROW_HEIGHT}
          />
        ))}
      </div>
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

  // Absorb dial rotation (no cycling needed, but avoids accidental SD actions)
  useDialRotate(() => {});

  // ─── Empty state ───────────────────────────────────────────

  if (slots.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: DIAL_WIDTH, height: DIAL_HEIGHT, backgroundColor: BG_COLOR }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderRadius: 10,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.4)",
              fontFamily: "Inter",
            }}
          >
            Configure Slots
          </span>
        </div>
      </div>
    );
  }

  // ─── Rows ──────────────────────────────────────────────────

  const dialGap = slots.length <= 2 ? 12 : DIAL_ROW_GAP;
  const totalRowsHeight = slots.length * DIAL_ROW_HEIGHT + (slots.length - 1) * dialGap;
  const topOffset = Math.round((DIAL_HEIGHT - totalRowsHeight) / 2);

  return (
    <div
      className="relative"
      style={{ width: DIAL_WIDTH, height: DIAL_HEIGHT, backgroundColor: BG_COLOR }}
    >
      <div
        className="absolute flex flex-col items-center"
        style={{
          top: topOffset,
          left: 0,
          width: DIAL_WIDTH,
          gap: dialGap,
        }}
      >
        {slots.map((slot, i) => (
          <PatchRow
            key={`${slot.game}-${i}`}
            game={slot.game}
            text={getSlotTextVerbose(slot)}
            badgeWidth={DIAL_BADGE_WIDTH}
            fontSize={16}
            rowHeight={DIAL_ROW_HEIGHT}
          />
        ))}
      </div>
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
