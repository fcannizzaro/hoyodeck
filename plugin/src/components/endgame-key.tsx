import { useState } from "react";
import {
  useKeyDown,
  useSettings,
  useGlobalSettings,
  useInterval,
  cn,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings, GameId } from "@hoyodeck/shared/types";
import type { DataType } from "@/services/data-controller.types";
import { useAccount } from "@/contexts/account-context";
import { useData } from "@/contexts/data-context";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";

// ─── Types ────────────────────────────────────────────────────────

export interface EndgameModeConfig {
  dataType: DataType;
  bg: string;
  name: string;
}

export interface EndgameDisplay {
  progressText: string;
  timerText: string;
  /** End timestamp in ms — used by "ending-soonest" to compare across modes */
  endMs?: number;
}

export interface EndgameKeyProps {
  game: GameId;
  /** Mode configs keyed by mode id */
  modes: Record<string, EndgameModeConfig>;
  /** Default mode when settings.mode is unset */
  defaultMode: string;
  /** Game-specific data formatter */
  formatData: (mode: string, data: unknown) => EndgameDisplay;
}

// ─── Scroll constants ─────────────────────────────────────────────

const NAME_FONT = 14;
const NAME_CHAR_WIDTH = NAME_FONT * 0.6;
const NAME_MAX_INNER_W = 144 - 12 - 20;
const NAME_SEPARATOR = " - ";
const SCROLL_STEP = 2;
const SCROLL_TICK_MS = 200;

// ─── Minimal settings shape used by the shared component ──────────

interface EndgameCycleSettings {
  mode?: string;
  showStars?: boolean;
  showName?: boolean;
  [key: string]: unknown;
}

// ─── "Ending Soonest" resolver ────────────────────────────────────

const ENDING_SOONEST = "ending-soonest";

/**
 * Iterate all modes, format each one that has data, and return the
 * mode whose `endMs` is the smallest (i.e. the one ending soonest).
 * Falls back to `defaultMode` when no mode has a valid `endMs`.
 */
function resolveEndingSoonest(
  modes: Record<string, EndgameModeConfig>,
  defaultMode: string,
  formatData: EndgameKeyProps["formatData"],
  getData: (dataType: DataType) => { status: string; data?: unknown } | undefined,
): string {
  let soonestMode = defaultMode;
  let soonestMs = Infinity;

  for (const [modeId, config] of Object.entries(modes)) {
    const entry = getData(config.dataType);
    if (entry?.status !== "ok" || !entry.data) continue;
    const display = formatData(modeId, entry.data);
    if (display.endMs != null && display.endMs < soonestMs) {
      soonestMs = display.endMs;
      soonestMode = modeId;
    }
  }

  return soonestMode;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * Shared endgame key component used by all three games.
 *
 * Handles settings reading, scroll animation, name pill,
 * star/progress overlay, timer badge, and placeholder/loading states.
 *
 * Each game provides only:
 * - mode configs (background, name, data type per mode)
 * - a formatData function for game-specific data parsing
 */
export function EndgameKey({ game, modes, defaultMode, formatData }: EndgameKeyProps) {
  const [settings] = useSettings<EndgameCycleSettings & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();
  const account = useAccount();
  const { getData, requestUpdate } = useData();
  const animationsDisabled = globalSettings.disableAnimations ?? false;

  const selectedMode = settings.mode ?? defaultMode;
  const showStars = settings.showStars ?? true;
  const showName = settings.showName ?? true;

  // Resolve the actual mode — "ending-soonest" picks dynamically
  const mode =
    selectedMode === ENDING_SOONEST
      ? resolveEndingSoonest(modes, defaultMode, formatData, getData)
      : selectedMode;

  const config = modes[mode] ?? modes[defaultMode]!;
  const entry = getData(config.dataType);

  // ─── Scroll animation ──────────────────────────────────────

  const [scrollOffset, setScrollOffset] = useState(0);
  const modeName = config.name;
  const textW = modeName.length * NAME_CHAR_WIDTH;
  const needsScroll = showName && textW > NAME_MAX_INNER_W;
  const cycleWidth = needsScroll
    ? Math.round((modeName.length + NAME_SEPARATOR.length) * NAME_CHAR_WIDTH)
    : 0;

  useInterval(
    () => setScrollOffset((o) => (o + SCROLL_STEP) % cycleWidth),
    needsScroll && !animationsDisabled ? SCROLL_TICK_MS : null,
  );

  useKeyDown(() => {
    void requestUpdate();
  });

  // ─── Placeholder ────────────────────────────────────────────

  if (account.status !== "resolved") {
    return <PlaceholderKey game={game} status={account.status} />;
  }

  // ─── Loading ────────────────────────────────────────────────

  const data = entry?.status === "ok" ? entry.data : null;
  const bgDataUri = readLocalImageAsDataUri(config.bg);

  if (!data) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={bgDataUri} width={144} height={144} />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  const { progressText, timerText } = formatData(mode, data);

  const scrollText = needsScroll
    ? `${modeName}${NAME_SEPARATOR}`.repeat(Math.ceil(144 / cycleWidth) + 2)
    : modeName;

  return (
    <div className="relative w-full h-full">
      <img src={bgDataUri} width={144} height={144} />

      {/* Name label (top pill) */}
      {showName && (
        <div className="absolute top-1.5 left-0 w-full flex items-center justify-center">
          <div
            className={cn(
              "flex items-center h-6.5 bg-overlay overflow-hidden",
              needsScroll ? "w-36 rounded-none" : "rounded-badge px-2.5",
            )}
          >
            <span
              className="text-sm font-bold text-white font-body whitespace-nowrap"
              style={needsScroll ? { marginLeft: -scrollOffset + 10 } : undefined}
            >
              {scrollText}
            </span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-overlay-subtle" />

      {/* Star/progress box (center) */}
      {showStars && (
        <div className="absolute top-[45px] left-0 w-36 h-15 flex items-center justify-center">
          <span
            className="text-[52px] font-bold text-white font-body"
            style={{
              textShadow:
                "-2px -2px 0 rgba(0,0,0,0.7), 2px -2px 0 rgba(0,0,0,0.7), -2px 2px 0 rgba(0,0,0,0.7), 2px 2px 0 rgba(0,0,0,0.7)",
            }}
          >
            {progressText}
          </span>
        </div>
      )}

      {/* Timer badge (bottom) */}
      <Badge text={timerText} />
    </div>
  );
}
