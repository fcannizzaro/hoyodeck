import {
  defineAction,
  useDialRotate,
  useTouchTap,
  useSpring,
  SpringPresets,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GameId, StaminaOverviewSettings } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import {
  StaminaOverviewProvider,
  useStaminaOverview,
  formatRecoveryTime,
  type SlotState,
} from "@/contexts/stamina-overview-context";

// ─── Constants ────────────────────────────────────────────────────

const DIAL_WIDTH = 200;
const DIAL_HEIGHT = 100;
const BAR_HEIGHT = 26;

/** Stamina icon paths per game (full images, scaled down in each slot) */
const STAMINA_ICON_PATHS: Record<GameId, string> = {
  gi: "imgs/actions/gi/resin.webp",
  hsr: "imgs/actions/hsr/trailblaze-power.webp",
  zzz: "imgs/actions/zzz/battery-recharge.png",
};

/** Per-game themed background paths (same as each stamina key action) */
const SLOT_BG_PATHS: Record<GameId, string> = {
  gi: "imgs/actions/gi/3-star.png",
  hsr: "imgs/actions/hsr/trailblaze-power-state@2x.png",
  zzz: "imgs/actions/zzz/battery-recharge-state@2x.png",
};

// ─── Slot Component ───────────────────────────────────────────────

interface SlotProps {
  slot: SlotState;
  width: number;
  /** Animated vertical offset (0 = centered, negative = shifted up) */
  offsetY: number;
  /** Another slot is focused — dim this one */
  dimmed: boolean;
}

/**
 * A single stamina slot column in the overview display.
 * Renders the game's themed background with icon + value overlaid.
 * A colored bottom border appears when focused.
 */
function StaminaSlotView({ slot, width, offsetY, dimmed }: SlotProps) {
  const icon = useLocalImageDataUri(STAMINA_ICON_PATHS[slot.game]);
  const bg = useLocalImageDataUri(SLOT_BG_PATHS[slot.game]);
  const okData = slot.data.status === "ok" ? slot.data : null;
  const current = okData?.stamina.current ?? null;
  const max = okData?.stamina.max ?? GAMES[slot.game].staminaMax;
  const percentage = current !== null ? Math.min(Math.max(current / max, 0), 1) : 0;
  const coverH = Math.round(DIAL_HEIGHT * (1 - percentage));
  const iconSize = 44;
  const roundedHeight = Math.round(DIAL_HEIGHT);

  return (
    <div
      className="relative"
      style={{ width, height: roundedHeight, marginTop: Math.round(offsetY) }}
    >
      {/* Game-themed background */}
      <img src={bg} width={width} height={roundedHeight} className="absolute top-0 left-0" />

      {/* Dark cover from top — the unfilled portion */}
      {coverH > 0 && (
        <div
          className="absolute top-0 left-0 bg-overlay-medium"
          style={{ width, height: coverH }}
        />
      )}

      {/* Content overlay: centered icon + badge */}
      <div
        className="absolute top-0 left-0 flex flex-col items-center justify-center"
        style={{ width, height: roundedHeight }}
      >
        <img src={icon} width={iconSize} height={iconSize} />

        {/* Badge pill — same style as per-game key actions */}
        <div className="flex items-center justify-center bg-overlay rounded-lg px-2 pt-0.5 pb-0 mt-1.5">
          {current !== null ? (
            <span className="text-[13px] font-bold text-white font-body">{current}</span>
          ) : (
            <span className="text-2xs font-semibold text-white/50 font-body">
              {slot.data.status === "error"
                ? "ERR"
                : slot.data.status === "unconfigured"
                  ? "N/A"
                  : "--"}
            </span>
          )}
        </div>
      </div>

      {/* Dark overlay when another slot is focused */}
      {dimmed && (
        <div
          className="absolute top-0 left-0 bg-overlay-dim"
          style={{ width, height: roundedHeight }}
        />
      )}
    </div>
  );
}

// ─── Detail Bottom Bar ────────────────────────────────────────────

interface DetailBarProps {
  slot: SlotState | null;
  /** Animated bottom offset (0 = fully visible, -BAR_HEIGHT = hidden below) */
  bottom: number;
}

/**
 * Full-width detail bar that slides up from the bottom.
 * Left: current/max — Right: recovery time.
 */
function DetailBar({ slot, bottom }: DetailBarProps) {
  if (!slot) return null;

  const config = GAMES[slot.game];
  const okData = slot.data.status === "ok" ? slot.data : null;
  const current = okData?.stamina.current;
  const max = config.staminaMax;
  const recoverySeconds = okData?.stamina.recoverySeconds ?? 0;

  const valueText = current !== undefined ? `${current}/${max}` : "--";
  const timeText = okData && recoverySeconds > 0 ? formatRecoveryTime(recoverySeconds) : "Full";

  return (
    <div
      className="absolute left-0 w-50 h-6.5 bg-overlay-heavy flex items-center justify-between px-3"
      style={{ bottom: Math.round(bottom) }}
    >
      <span className="text-[13px] font-bold text-white font-body">{valueText}</span>
      <span className="text-[11px] font-medium text-white/60 font-body">{timeText}</span>
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
 * Stamina overview dial component for the Stream Deck+ encoder display.
 *
 * Renders up to 3 game stamina slots side-by-side on the 200x100 display.
 * Dial rotation cycles focus: none → slot 0 → slot 1 → ... → none → ...
 * When focused, a detail bar slides up from the bottom and the slot area
 * compresses to make room — both driven by a single spring value.
 * Touch tap refreshes all data.
 */
function StaminaOverviewDialInner() {
  const { slots, focusIndex, setFocusIndex, requestUpdateAll } = useStaminaOverview();

  // Single spring drives both the bar position and slots vertical shift.
  // barBottom: -BAR_HEIGHT (hidden) → 0 (visible)
  // offsetY: how much the slots shift upward to make room
  //   when hidden:  -(0 - (-26)) / 2 = 0   (no shift — bar is off-screen)
  //   when visible: -(26) / 2 = -13          (shift up by half the bar height)
  const barTarget = focusIndex !== null ? 0 : -BAR_HEIGHT;
  const { value: barBottom } = useSpring(barTarget, SpringPresets.snap);
  const slotsOffsetY = -(barBottom + BAR_HEIGHT);

  // Cycle focus on dial rotation: null → 0 → 1 → ... → N-1 → null → ...
  useDialRotate(({ ticks }) => {
    if (slots.length === 0) return;
    const positions = slots.length + 1;
    const currentPos = focusIndex === null ? 0 : focusIndex + 1;
    const nextPos = (((currentPos + ticks) % positions) + positions) % positions;
    setFocusIndex(nextPos === 0 ? null : nextPos - 1);
  });

  // Refresh all on touch tap
  useTouchTap(() => {
    void requestUpdateAll();
  });

  if (slots.length === 0) {
    return <EmptyDial />;
  }

  const GAP = 4;
  const totalGap = slots.length > 1 ? GAP * (slots.length - 1) : 0;
  const slotWidth = Math.floor((DIAL_WIDTH - totalGap) / slots.length);
  const focusedSlot = focusIndex !== null ? (slots[focusIndex] ?? null) : null;

  return (
    <div className="relative w-50 h-25 bg-black">
      {/* Slot columns — shift up when bar is open */}
      <div className="flex gap-1">
        {slots.map((slot, i) => (
          <StaminaSlotView
            key={`${slot.game}-${i}`}
            slot={slot}
            width={slotWidth}
            offsetY={slotsOffsetY}
            dimmed={focusIndex !== null && focusIndex !== i}
          />
        ))}
      </div>

      {/* Animated detail bottom bar */}
      <DetailBar slot={focusedSlot} bottom={barBottom} />
    </div>
  );
}

// ─── Wrapper ──────────────────────────────────────────────────────

function StaminaOverviewWrapper({ children }: { children?: React.ReactNode }) {
  return <StaminaOverviewProvider>{children}</StaminaOverviewProvider>;
}

// ─── Action Definition ────────────────────────────────────────────

export const staminaOverviewAction = defineAction<StaminaOverviewSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.stamina-overview",
  dial: StaminaOverviewDialInner,
  wrapper: StaminaOverviewWrapper,
  info: {
    name: "Stamina Overview",
    disableCaching: true,
    icon: "imgs/actions/common/stamina-icon",
    tooltip: "Multi-game stamina overview for the Stream Deck+ encoder",
    states: [{ image: "imgs/actions/gi/5-star", titleAlignment: "middle" }],
    encoder: {
      layout: "$A0",
      triggerDescription: {
        rotate: "Cycle focus",
        touch: "Refresh all",
      },
    },
  },
});
