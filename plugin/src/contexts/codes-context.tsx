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
import type { JsonObject } from "@elgato/utils";
import type { RedeemCodeSettings, GlobalSettings, GameId, AccountId } from "@hoyodeck/shared/types";
import { toJsonObject } from "@/utils/json";
import type { GameCodeWithStatus } from "@hoyodeck/shared/types";
import { codesClient } from "@/api/manager/client";
import { openRedeemWindow } from "@/services/redeem-window";
import { useAccount } from "./account-context";
import { useData } from "./data-context";

// ─── Constants ────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// ─── Context Value ────────────────────────────────────────────────

export interface CodesContextValue {
  /** Current codes list (merged with local claim status) */
  codes: GameCodeWithStatus[];
  /** Number of available (unclaimed, active) codes */
  availableCount: number;
  /**
   * Open the redeem window and start redeeming all available codes.
   * Resolves when the window is closed.
   */
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
 * Provides codes fetching, claimed-code tracking, and redeem-window
 * orchestration for the redeem-code action.
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
   * Open the redeem window with fresh codes and start redemption.
   * Resolves when the window is closed.
   */
  const redeemAll = useCallback(async () => {
    if (!resolvedAccount || !uid) return;

    const client = getClient();
    if (!client) return;

    // Fetch fresh codes before opening window
    const freshCodes = await codesClient.listCodes(game);

    // Merge local claim status so the window shows correct state
    const merged = mergeStatus(freshCodes, localClaimed);
    setCodes(merged);

    try {
      await openRedeemWindow(game, merged, client, uid, persistOneClaimed);
    } catch {
      // Window open failed
    }

    // Refresh after window closes
    await fetchCodes();
  }, [resolvedAccount, uid, game, getClient, localClaimed, persistOneClaimed, fetchCodes]);

  // Merge server codes with locally tracked claims
  const merged = mergeStatus(codes, localClaimed);
  const availableCount = merged.filter((c) => c.status === "available" && c.active).length;

  const value = useMemo<CodesContextValue>(
    () => ({
      codes: merged,
      availableCount,
      redeemAll,
    }),
    [merged, availableCount, redeemAll],
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
