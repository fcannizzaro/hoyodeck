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
import { readLocalImageAsDataUri } from "@/utils/image";
import { formatRecoveryTime } from "@/utils/stamina";
import {
  StaminaOverviewProvider,
  useStaminaOverview,
  type SlotState,
} from "@/contexts/stamina-overview-context";

// ─── Constants ────────────────────────────────────────────────────

const DIAL_WIDTH = 200;
const DIAL_HEIGHT = 100;
const BAR_HEIGHT = 26;

/** Stamina icon paths per game (full images, scaled down in each slot) */
const STAMINA_ICONS: Record<GameId, string> = {
  gi: readLocalImageAsDataUri("imgs/actions/gi/resin.webp"),
  hsr: readLocalImageAsDataUri("imgs/actions/hsr/trailblaze-power.webp"),
  zzz: readLocalImageAsDataUri("imgs/actions/zzz/battery-recharge.png"),
};

/** Per-game themed background (same as each stamina key action) */
const SLOT_BACKGROUNDS: Record<GameId, string> = {
  gi: readLocalImageAsDataUri("imgs/actions/gi/3-star.png"),
  hsr: readLocalImageAsDataUri("imgs/actions/hsr/trailblaze-power-state@2x.png"),
  zzz: readLocalImageAsDataUri("imgs/actions/zzz/battery-recharge-state@2x.png"),
};

// ─── Slot Component ───────────────────────────────────────────────

interface SlotProps {
  slot: SlotState;
  width: number;
  /** Animated vertical offset (0 = centered, negative = shifted up) */
  offsetY: number;
  focused: boolean;
  /** Another slot is focused — dim this one */
  dimmed: boolean;
}

/**
 * A single stamina slot column in the overview display.
 * Renders the game's themed background with icon + value overlaid.
 * A colored bottom border appears when focused.
 */
function StaminaSlotView({ slot, width, offsetY, focused, dimmed }: SlotProps) {
  const icon = STAMINA_ICONS[slot.game];
  const bg = SLOT_BACKGROUNDS[slot.game];
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
      style={{
        width,
        height: roundedHeight,
        marginTop: Math.round(offsetY),
      }}
    >
      {/* Game-themed background */}
      <img
        src={bg}
        width={width}
        height={roundedHeight}
        style={{ position: "absolute", top: 0, left: 0 }}
      />

      {/* Dark cover from top — the unfilled portion */}
      {coverH > 0 && (
        <div
          className="absolute"
          style={{
            top: 0,
            left: 0,
            width,
            height: coverH,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
          }}
        />
      )}

      {/* Content overlay: centered icon + badge */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ top: 0, left: 0, width, height: roundedHeight }}
      >
        <img src={icon} width={iconSize} height={iconSize} />

        {/* Badge pill — same style as per-game key actions */}
        <div
          className="flex items-center justify-center"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            borderRadius: 8,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 0,
            marginTop: 6,
          }}
        >
          {current !== null ? (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "white",
                fontFamily: "Inter",
              }}
            >
              {current}
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.5)",
                fontFamily: "Inter",
              }}
            >
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
          className="absolute"
          style={{
            top: 0,
            left: 0,
            width,
            height: roundedHeight,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
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
      className="absolute flex items-center justify-between"
      style={{
        bottom: Math.round(bottom),
        left: 0,
        width: DIAL_WIDTH,
        height: BAR_HEIGHT,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        paddingLeft: 12,
        paddingRight: 12,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "white",
          fontFamily: "Inter",
        }}
      >
        {valueText}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255, 255, 255, 0.6)",
          fontFamily: "Inter",
        }}
      >
        {timeText}
      </span>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyDial() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: DIAL_WIDTH, height: DIAL_HEIGHT, backgroundColor: "#0f172a" }}
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
    <div
      className="relative"
      style={{ width: DIAL_WIDTH, height: DIAL_HEIGHT, backgroundColor: "black" }}
    >
      {/* Slot columns — shift up when bar is open */}
      <div className="flex" style={{ gap: GAP }}>
        {slots.map((slot, i) => (
          <StaminaSlotView
            key={`${slot.game}-${i}`}
            slot={slot}
            width={slotWidth}
            offsetY={slotsOffsetY}
            focused={focusIndex === i}
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
    icon: "imgs/actions/stamina-overview-icon",
    tooltip: "Multi-game stamina overview for the Stream Deck+ encoder",
    encoder: {
      layout: "$A0",
      triggerDescription: {
        rotate: "Cycle focus",
        touch: "Refresh all",
      },
    },
  },
});
