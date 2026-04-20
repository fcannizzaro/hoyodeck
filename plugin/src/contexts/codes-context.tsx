import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSettings, useGlobalSettings, useWillAppear } from "@fcannizzaro/streamdeck-react";
import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import type { RedeemCodeSettings, GlobalSettings, GameId } from "@hoyodeck/shared/types";
import type {
  CodeRedeemProgress,
  CodeRedeemResult,
  CodeRedeemStatus,
} from "@hoyodeck/shared/types";
import { toJsonObject } from "@/utils/json";
import { codesClient } from "@/api/manager/client";
import { HoyolabApiError, isAuthError } from "@/api/types/common";
import { useAccount } from "./account-context";
import { useData } from "./data-context";

// ─── Constants ────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/** Rate-limit cooldown between consecutive redeems (ms) */
const REDEEM_DELAY_MS = 5_000;

/** HoYoLAB retcode for "already claimed" */
const ALREADY_CLAIMED_RETCODE = -2017;

/** Known retcodes that indicate an expired or invalid code */
const EXPIRED_RETCODES = new Set([-2001, -2003, -2016]);

/**
 * Classify a redeem error into a persisted status + human-readable reason.
 */
function classifyRedeemError(error: unknown): { status: CodeRedeemStatus; reason: string } {
  if (error instanceof HoyolabApiError) {
    const { message, retcode } = error;
    if (retcode === ALREADY_CLAIMED_RETCODE) {
      return { status: "already_claimed", reason: "Already claimed" };
    }
    if (EXPIRED_RETCODES.has(retcode)) {
      return { status: "expired", reason: message || "Code expired" };
    }
    if (isAuthError(error)) {
      return { status: "error", reason: "Authentication failed" };
    }
    return { status: "error", reason: message || `Error (${retcode})` };
  }
  return { status: "error", reason: error instanceof Error ? error.message : "Unknown error" };
}

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

interface GameCodeWithStatus {
  code: string;
  status: "available" | "claimed" | "dismissed" | "expired";
  active: boolean;
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

function toPluginCodes(codes: string[]): GameCodeWithStatus[] {
  return codes.map((code) => ({
    code,
    status: "available",
    active: true,
  }));
}

function codesQueryKey(game: GameId) {
  return ["codes", "list", game] as const;
}

function codesQueryOptions(game: GameId) {
  return queryOptions({
    queryKey: codesQueryKey(game),
    queryFn: async () => toPluginCodes(await codesClient.listCodes(game)),
    refetchInterval: REFRESH_INTERVAL_MS,
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
  const { getClient, refreshCookieToken } = useData();
  const queryClient = useQueryClient();

  const game = (settings.game ?? "gi") as GameId;
  const resolvedAccount = account.status === "resolved" ? account.account : null;
  const uid = resolvedAccount?.uids[game];

  const [, setClaimedTick] = useState(0);
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

  /**
   * In-memory accumulator for redeem results within the current session.
   * Keyed by code string to allow upserts (re-redeem replaces prior result).
   */
  const resultsAccRef = useRef<Map<string, CodeRedeemResult>>(new Map());

  // Sync the accumulators with persisted globalSettings.
  // When the PI resets claimed codes, the persisted arrays become empty
  // and the accumulators must follow suit so localClaimed stays correct.
  useEffect(() => {
    if (!uid) return;
    const key = claimedKey(game, uid);

    const persistedCodes = globalSettings.claimedCodes?.[key] ?? [];
    claimedAccRef.current = new Set(persistedCodes);

    const persistedResults = globalSettings.redeemResults?.[key] ?? [];
    const rAcc = new Map<string, CodeRedeemResult>();
    for (const r of persistedResults) rAcc.set(r.code, r);
    resultsAccRef.current = rAcc;
  }, [game, uid, globalSettings.claimedCodes, globalSettings.redeemResults]);

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
   * Persist a single code result immediately.
   * 1. Adds code to the claimed accumulator (instant, no async gap)
   * 2. Adds result to the results accumulator
   * 3. Writes both to globalSettings (persists across restarts)
   * 4. Forces a re-render so the badge updates
   */
  const persistOneClaimed = useCallback(
    (code: string, result?: CodeRedeemResult) => {
      if (!uid) return;

      // 1. Accumulate locally
      claimedAccRef.current.add(code);

      // 2. Accumulate result
      if (result) {
        resultsAccRef.current.set(code, result);
      }

      // 3. Persist to globalSettings
      const current = globalSettingsRef.current;
      const key = claimedKey(game, uid);

      const updated: GlobalSettings = {
        ...current,
        claimedCodes: {
          ...current.claimedCodes,
          [key]: [...claimedAccRef.current],
        },
        redeemResults: {
          ...current.redeemResults,
          [key]: [...resultsAccRef.current.values()],
        },
      };

      void setGlobalSettings(toJsonObject(updated));

      // 4. Force re-render so the badge count updates immediately
      setClaimedTick((t) => t + 1);
    },
    [game, uid, setGlobalSettings],
  );

  const { data: codes = [], refetch: refetchCodes } = useQuery(codesQueryOptions(game));

  // Fetch on key appear (e.g. profile switch, plugin reload)
  useWillAppear(() => {
    void refetchCodes();
  });

  /**
   * Run the redemption loop inline — redeems all available codes
   * sequentially, updating `redeemProgress` state for each code
   * so the key component can visualize live progress.
   *
   * Before starting, attempts to refresh cookie_token_v2 using
   * stoken_v2 to prevent "Please log in" errors from expired tokens.
   */
  const redeemAll = useCallback(async () => {
    if (isRedeeming) return;
    if (!resolvedAccount || !uid) return;

    // Try to refresh cookie_token_v2 before redemption.
    // The redemption API uses cookie_token_v2 which expires faster (~days)
    // than ltoken_v2 used by all other actions. Refreshing proactively
    // prevents the "Please log in to your account first" error.
    let client = getClient();
    const refreshedClient = await refreshCookieToken();
    if (refreshedClient) {
      client = refreshedClient;
      streamDeck.logger.info("[RedeemCode] cookie_token_v2 refreshed successfully");
    }

    if (!client) return;

    setIsRedeeming(true);

    // Fetch fresh codes before starting
    const freshCodes = await queryClient.fetchQuery(codesQueryOptions(game));
    const merged = mergeStatus(freshCodes, localClaimed);

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
        const result: CodeRedeemResult = {
          code: entry.code,
          status: "success",
          reason: "Redeemed successfully",
          redeemedAt: new Date().toISOString(),
        };
        persistOneClaimed(entry.code, result);
        initial.set(entry.code, "success");
        setRedeemProgress(new Map(initial));
      } catch (error) {
        const classified = classifyRedeemError(error);

        if (isAuthError(error)) {
          const result: CodeRedeemResult = {
            code: entry.code,
            status: classified.status,
            reason: classified.reason,
            redeemedAt: new Date().toISOString(),
          };
          persistOneClaimed(entry.code, result);
          initial.set(entry.code, "error");
          setRedeemProgress(new Map(initial));
          streamDeck.logger.warn(
            "[RedeemCode] Auth error — cookie_token_v2 likely expired. " +
              "Re-login to refresh tokens. Stopping redemption loop.",
          );
          break;
        }

        const result: CodeRedeemResult = {
          code: entry.code,
          status: classified.status,
          reason: classified.reason,
          redeemedAt: new Date().toISOString(),
        };
        persistOneClaimed(entry.code, result);
        initial.set(entry.code, classified.status === "already_claimed" ? "success" : "error");
        setRedeemProgress(new Map(initial));

        if (classified.status !== "already_claimed") {
          streamDeck.logger.warn(`[RedeemCode] Failed to redeem ${entry.code}:`, classified.reason);
        }
      }

      // Rate-limit delay between codes (skip after last)
      if (i < available.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, REDEEM_DELAY_MS));
      }
    }

    setIsRedeeming(false);

    // Refresh codes after completion
    await queryClient.invalidateQueries({ queryKey: codesQueryKey(game) });
  }, [
    isRedeeming,
    resolvedAccount,
    uid,
    game,
    getClient,
    refreshCookieToken,
    queryClient,
    localClaimed,
    persistOneClaimed,
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
