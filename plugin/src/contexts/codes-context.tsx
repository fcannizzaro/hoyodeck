import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  useSettings,
  useGlobalSettings,
  useWillAppear,
  useInterval,
} from "@fcannizzaro/streamdeck-react";
import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import type { RedeemCodeSettings, GlobalSettings, GameId } from "@hoyodeck/shared/types";
import type { GameCodeWithStatus, CodeRedeemProgress } from "@hoyodeck/shared/types";
import { toJsonObject } from "@/utils/json";
import { codesClient } from "@/api/manager/client";
import { HoyolabApiError, isAuthError } from "@/api/types/common";
import { useAccount } from "./account-context";
import { useData } from "./data-context";

// ─── Constants ────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Rate-limit cooldown between consecutive redeems (ms) */
const REDEEM_DELAY_MS = 4_000;

// ─── Context Value ────────────────────────────────────────────────

interface CodesContextValue {
  /** Current codes list (merged with local claim status) */
  codes: GameCodeWithStatus[];
  /** Number of available (unclaimed, active) codes */
  availableCount: number;
  /** Live redemption progress per code (only populated during redemption) */
  redeemProgress: Map<string, CodeRedeemProgress>;
  /** Whether a redemption loop is currently running */
  isRedeeming: boolean;
  /** Start redeeming all available codes inline (no window) */
  redeemAll: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────

const CodesContext = createContext<CodesContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────

interface CodesProviderProps {
  children?: React.ReactNode;
}

/** Build the key used to store claimed codes: "{game}:{uid}" */
function claimedKey(game: GameId, uid: string): string {
  return `${game}:${uid}`;
}

/**
 * Overlay local claim status onto server codes.
 * Codes the server reports as "available" but that are locally claimed
 * get their status changed to "claimed".
 */
function mergeStatus(codes: GameCodeWithStatus[], localClaimed: Set<string>): GameCodeWithStatus[] {
  return codes.map((c) => {
    if (c.status === "available" && localClaimed.has(c.code)) {
      return { ...c, status: "claimed" as const };
    }
    return c;
  });
}

/**
 * Provides codes fetching, claimed-code tracking, and inline
 * redemption for the redeem-code action.
 *
 * Must be rendered inside AccountProvider and DataProvider so it can
 * resolve the current account and obtain a HoyolabClient for redemption.
 *
 * Reads `settings.game` to determine which game's codes to fetch.
 */
export function CodesProvider({ children }: CodesProviderProps) {
  const [settings] = useSettings<RedeemCodeSettings & JsonObject>();
  const [globalSettings, setGlobalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();
  const account = useAccount();
  const { getClient } = useData();

  const game = (settings.game ?? "gi") as GameId;
  const resolvedAccount = account.status === "resolved" ? account.account : null;
  const uid = resolvedAccount?.uids[game];

  const [codes, setCodes] = useState<GameCodeWithStatus[]>([]);
  const [, setRefreshTick] = useState(0);
  const [redeemProgress, setRedeemProgress] = useState<Map<string, CodeRedeemProgress>>(new Map());
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Keep a ref to always have the latest globalSettings (avoids stale closures)
  const globalSettingsRef = useRef(globalSettings);
  globalSettingsRef.current = globalSettings;

  /**
   * In-memory accumulator for claimed codes within the current session.
   * Survives across rapid onClaimed calls even when the SDK hasn't
   * round-tripped the updated globalSettings yet.
   */
  const claimedAccRef = useRef<Set<string>>(new Set());

  // Seed the accumulator from persisted globalSettings on load / when settings change
  useEffect(() => {
    if (!uid) return;
    const key = claimedKey(game, uid);
    const persisted = globalSettings.claimedCodes?.[key] ?? [];
    const acc = claimedAccRef.current;
    for (const c of persisted) acc.add(c);
  }, [game, uid, globalSettings.claimedCodes]);

  // Derive localClaimed from BOTH persisted globalSettings (available synchronously
  // on mount, survives page switches) AND the in-memory accumulator (handles rapid
  // claims before globalSettings round-trips).
  const localClaimed = uid
    ? new Set([
        ...(globalSettings.claimedCodes?.[claimedKey(game, uid)] ?? []),
        ...claimedAccRef.current,
      ])
    : new Set<string>();

  /**
   * Persist a single claimed code immediately.
   * 1. Adds to the in-memory accumulator (instant, no async gap)
   * 2. Writes the full set to globalSettings (persists across restarts)
   * 3. Forces a re-render so the badge updates
   */
  const persistOneClaimed = useCallback(
    (code: string) => {
      if (!uid) return;

      // 1. Accumulate locally
      claimedAccRef.current.add(code);

      // 2. Persist to globalSettings
      const current = globalSettingsRef.current;
      const key = claimedKey(game, uid);

      const updated: GlobalSettings = {
        ...current,
        claimedCodes: {
          ...current.claimedCodes,
          [key]: [...claimedAccRef.current],
        },
      };

      void setGlobalSettings(toJsonObject(updated));

      // 3. Force re-render so the badge count updates immediately
      setRefreshTick((t) => t + 1);
    },
    [game, uid, setGlobalSettings],
  );

  // Fetch codes from the codes-server
  const fetchCodes = useCallback(async () => {
    const result = await codesClient.listCodes(game);
    setCodes(result);
  }, [game]);

  // Fetch on mount and when game changes
  useEffect(() => {
    void fetchCodes();
  }, [fetchCodes]);

  // Fetch on key appear (e.g. profile switch, plugin reload)
  useWillAppear(() => {
    void fetchCodes();
  });

  // Auto-refresh every 5 minutes
  useInterval(
    () =>
      setRefreshTick((t) => {
        void fetchCodes();
        return t + 1;
      }),
    REFRESH_INTERVAL_MS,
  );

  /**
   * Run the redemption loop inline — redeems all available codes
   * sequentially, updating `redeemProgress` state for each code
   * so the key component can visualize live progress.
   */
  const redeemAll = useCallback(async () => {
    if (isRedeeming) return;
    if (!resolvedAccount || !uid) return;

    const client = getClient();
    if (!client) return;

    setIsRedeeming(true);

    // Fetch fresh codes before starting
    const freshCodes = await codesClient.listCodes(game);
    const merged = mergeStatus(freshCodes, localClaimed);
    setCodes(merged);

    const available = merged.filter((c) => c.status === "available" && c.active);

    if (available.length === 0) {
      setIsRedeeming(false);
      return;
    }

    // Initialize progress map — all available codes start as "pending"
    const initial = new Map<string, CodeRedeemProgress>();
    for (const c of available) initial.set(c.code, "pending");
    // Include non-available codes with their final state
    for (const c of merged) {
      if (!initial.has(c.code)) {
        initial.set(c.code, c.status === "claimed" ? "success" : "pending");
      }
    }
    setRedeemProgress(new Map(initial));

    for (let i = 0; i < available.length; i++) {
      const entry = available[i]!;

      // Mark as loading
      initial.set(entry.code, "loading");
      setRedeemProgress(new Map(initial));

      try {
        await client.redeemCode(game, entry.code, uid);
        persistOneClaimed(entry.code);
        initial.set(entry.code, "success");
        setRedeemProgress(new Map(initial));
      } catch (error) {
        if (isAuthError(error)) {
          initial.set(entry.code, "error");
          setRedeemProgress(new Map(initial));
          streamDeck.logger.warn("[RedeemCode] Auth error, stopping redemption loop");
          break;
        }

        const isAlreadyClaimed = error instanceof HoyolabApiError && error.retcode === -2017;
        persistOneClaimed(entry.code);
        initial.set(entry.code, isAlreadyClaimed ? "success" : "error");
        setRedeemProgress(new Map(initial));

        if (!isAlreadyClaimed) {
          const message = error instanceof Error ? error.message : "Unknown error";
          streamDeck.logger.warn(`[RedeemCode] Failed to redeem ${entry.code}:`, message);
        }
      }

      // Rate-limit delay between codes (skip after last)
      if (i < available.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, REDEEM_DELAY_MS));
      }
    }

    setIsRedeeming(false);

    // Refresh codes after completion
    await fetchCodes();
  }, [
    isRedeeming,
    resolvedAccount,
    uid,
    game,
    getClient,
    localClaimed,
    persistOneClaimed,
    fetchCodes,
  ]);

  // Merge server codes with locally tracked claims
  const merged = mergeStatus(codes, localClaimed);
  const availableCount = merged.filter((c) => c.status === "available" && c.active).length;

  const value = useMemo<CodesContextValue>(
    () => ({
      codes: merged,
      availableCount,
      redeemProgress,
      isRedeeming,
      redeemAll,
    }),
    [merged, availableCount, redeemProgress, isRedeeming, redeemAll],
  );

  return <CodesContext.Provider value={value}>{children}</CodesContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * Access the redeem codes context.
 * Must be used within a `CodesProvider`.
 */
export function useRedeemCodes(): CodesContextValue {
  const ctx = useContext(CodesContext);
  if (!ctx) {
    throw new Error("useRedeemCodes must be used within a CodesProvider");
  }
  return ctx;
}
