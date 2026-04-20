import { useEffect, useRef, useState } from "react";
import {
  defineAction,
  cn,
  useKeyDown,
  useSettings,
  useInterval,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { RedeemCodeSettings, GameId } from "@hoyodeck/shared/types";
import type { CodeRedeemProgress } from "@hoyodeck/shared/types";
import { useAccount } from "@/contexts/account-context";
import { AccountProvider } from "@/contexts/account-context";
import { DataProvider } from "@/contexts/data-context";
import { CodesProvider, useRedeemCodes } from "@/contexts/codes-context";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { GAME_LABELS_EXTENDED } from "@hoyodeck/shared/games";
import { Badge } from "@/components/badge";

// ─── Constants ─────────────────────────────────────────────────

const GAME_BACKGROUNDS: Record<GameId, string> = {
  gi: "imgs/actions/gi/5-star.png",
  hsr: "imgs/actions/hsr/5-star.png",
  zzz: "imgs/actions/zzz/5-star.png",
};

const CODE_ICON = "imgs/actions/common/code-redeem.png";

/** Grid layout constants (px) */
const CELL_SIZE = 14;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const GRID_COLS = 7;
const KEY_SIZE = 144;
const GRID_WIDTH = GRID_COLS * CELL_STEP - CELL_GAP;
const GRID_LEFT = Math.round((KEY_SIZE - GRID_WIDTH) / 2);

/** Visible grid area (leave room for badge at bottom) */
const GRID_TOP = 8;
const GRID_VISIBLE_HEIGHT = KEY_SIZE - GRID_TOP - 30;
const VISIBLE_ROWS = Math.floor((GRID_VISIBLE_HEIGHT + CELL_GAP) / CELL_STEP);

/** Auto-scroll speed during redemption */
const SCROLL_TICK_MS = 300;

// ─── Color Map ─────────────────────────────────────────────────

const PROGRESS_COLORS: Record<CodeRedeemProgress, string> = {
  pending: "bg-overlay-white",
  loading: "bg-[#fbbf24]",
  success: "bg-[#22c55e]",
  error: "bg-[#ef4444]",
};

/** Color for already-claimed codes (from server, not this session) */
const CLAIMED_COLOR = "bg-[#166534]";

// ─── Key Component ─────────────────────────────────────────────

function RedeemCodeKey() {
  const [settings] = useSettings<RedeemCodeSettings & JsonObject>();
  const account = useAccount();
  const { codes, availableCount, redeemProgress, isRedeeming, redeemAll } = useRedeemCodes();

  const game = (settings.game ?? "gi") as GameId;
  const bgDataUri = useLocalImageDataUri(GAME_BACKGROUNDS[game]);
  const iconDataUri = useLocalImageDataUri(CODE_ICON);
  const gameLabel = GAME_LABELS_EXTENDED[game];

  const [scrollOffset, setScrollOffset] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const wasRedeeming = useRef(false);

  useKeyDown(async () => {
    if (availableCount === 0) return;
    setShowGrid(true);
    await redeemAll();
  });

  // Hide the grid after redemption finishes (brief delay to show final state)
  useEffect(() => {
    if (isRedeeming) {
      wasRedeeming.current = true;
      return;
    }
    if (!wasRedeeming.current) return;
    wasRedeeming.current = false;

    const timer = setTimeout(() => setShowGrid(false), 1500);
    return () => clearTimeout(timer);
  }, [isRedeeming]);

  // Auto-scroll during redemption to follow progress
  useInterval(
    () => {
      if (!isRedeeming) return;

      // Find the index of the currently loading code
      const allCodes = codes.filter((c) => c.active);
      let loadingIdx = -1;
      for (let i = 0; i < allCodes.length; i++) {
        const progress = redeemProgress.get(allCodes[i]!.code);
        if (progress === "loading") {
          loadingIdx = i;
          break;
        }
      }

      if (loadingIdx < 0) return;

      // Calculate which row the loading code is in
      const loadingRow = Math.floor(loadingIdx / GRID_COLS);
      const totalRows = Math.ceil(allCodes.length / GRID_COLS);

      // Scroll so the loading row is visible (center it if possible)
      if (totalRows > VISIBLE_ROWS) {
        const targetRow = Math.max(0, loadingRow - Math.floor(VISIBLE_ROWS / 2));
        const maxOffset = (totalRows - VISIBLE_ROWS) * CELL_STEP;
        const targetOffset = Math.min(targetRow * CELL_STEP, maxOffset);
        setScrollOffset(targetOffset);
      }
    },
    isRedeeming ? SCROLL_TICK_MS : null,
  );

  // ── Placeholder states ─────────────────────────────────────

  if (account.status !== "resolved" || !account.account.uids[game]) {
    return (
      <div className="relative w-full h-full">
        <img src={bgDataUri} width={144} height={144} />
        <div className="absolute inset-0 flex items-center justify-center">
          <img src={iconDataUri} width={100} height={100} />
        </div>
        <Badge text={gameLabel} fontSize={14} />
      </div>
    );
  }

  // ── Idle state: icon + available count ──────────────────────

  const activeCodes = codes.filter((c) => c.active);

  if (!showGrid) {
    return (
      <div className="relative w-full h-full">
        <img src={bgDataUri} width={144} height={144} />
        <div className="absolute inset-0 flex items-center justify-center">
          <img src={iconDataUri} width={100} height={100} />
        </div>
        {availableCount > 0 && (
          <>
            <div className="absolute inset-0 bg-overlay-light" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[64px] font-bold text-white font-body">{availableCount}</span>
            </div>
          </>
        )}
        <Badge text={gameLabel} fontSize={14} />
      </div>
    );
  }

  // ── Grid state: contribution graph during/after redemption ──

  const totalRows = Math.ceil(activeCodes.length / GRID_COLS);
  const totalGridHeight = totalRows * CELL_STEP - CELL_GAP;
  const needsScroll = totalGridHeight > GRID_VISIBLE_HEIGHT;

  return (
    <div className="relative w-full h-full bg-surface">
      {/* Scrollable grid area */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: GRID_TOP,
          left: GRID_LEFT,
          width: GRID_WIDTH,
          height: GRID_VISIBLE_HEIGHT,
        }}
      >
        <div
          className="absolute"
          style={{
            top: needsScroll ? -scrollOffset : 0,
            left: 0,
            width: GRID_WIDTH,
          }}
        >
          {activeCodes.map((code, i) => {
            const col = i % GRID_COLS;
            const row = Math.floor(i / GRID_COLS);
            const progress = redeemProgress.get(code.code);

            // Determine cell color
            let colorClass: string;
            if (progress) {
              colorClass = PROGRESS_COLORS[progress];
            } else if (code.status === "claimed") {
              colorClass = CLAIMED_COLOR;
            } else {
              colorClass = PROGRESS_COLORS.pending;
            }

            return (
              <div
                key={code.code}
                className={cn("absolute rounded-sm", colorClass)}
                style={{
                  left: col * CELL_STEP,
                  top: row * CELL_STEP,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Badge */}
      <Badge text={gameLabel} fontSize={14} />
    </div>
  );
}

// ─── Wrapper ───────────────────────────────────────────────────

/**
 * Custom wrapper for Redeem Code — supports multi-game via settings.game.
 *
 * Composes AccountProvider + DataProvider (for client access) + CodesProvider
 * with a dynamic game derived from per-action settings.
 *
 * QueryClientProvider is provided at the plugin level.
 */
function RedeemCodeWrapper({ children }: { children?: React.ReactNode }) {
  const [settings] = useSettings<RedeemCodeSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;

  return (
    <AccountProvider game={game}>
      <DataProvider game={game} dataTypes={[]}>
        <CodesProvider>{children}</CodesProvider>
      </DataProvider>
    </AccountProvider>
  );
}

export const redeemCodeAction = defineAction<RedeemCodeSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.redeem-code",
  key: RedeemCodeKey,
  wrapper: RedeemCodeWrapper,
  info: {
    name: "Redeem Code",
    disableCaching: true,
    icon: "imgs/actions/common/redeem-icon",
    tooltip: "Redeem HoYoverse gift codes via the manager",
    states: [{ image: "imgs/actions/common/reward-state", titleAlignment: "middle" }],
  },
});
