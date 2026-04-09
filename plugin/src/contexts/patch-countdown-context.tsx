import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAction, useSettings, useInterval } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GameId, PatchCountdownSettings, PatchCountdownSlot } from "@hoyodeck/shared/types";
import { patchesClient, type PatchesResponse } from "@/api/manager/patches-client";
import { debug } from "@/utils/debug";

// ─── Resolved Slot Data ───────────────────────────────────────────

type ResolvedSlotData =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; patch: number };

/** Full slot state including config + resolved data */
export interface PatchSlotState {
  game: GameId;
  data: ResolvedSlotData;
}

// ─── Context Value ────────────────────────────────────────────────

interface PatchCountdownContextValue {
  /** Resolved data for each configured slot */
  slots: PatchSlotState[];
  /** Request an immediate data refresh */
  requestUpdateAll: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Convert a server PatchInfo into remaining seconds */
function toRemainingSeconds(end: string | null | undefined): number {
  if (!end) return 0;
  const endMs = new Date(end).getTime();
  return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
}

/** Poll interval — 10 minutes */
const POLL_INTERVAL_MS = 10 * 60 * 1000;

// ─── Context ──────────────────────────────────────────────────────

const PatchCountdownContext = createContext<PatchCountdownContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────

/**
 * Fetches patch countdown data via {@link patchesClient}.
 *
 * No HoYoLAB account is needed — patch dates are scraped from Fandom wikis
 * by the server and served as a simple JSON map keyed by game ID.
 * Polls every 10 minutes and on manual refresh.
 */
export function PatchCountdownProvider({ children }: { children?: React.ReactNode }) {
  const { id: actionId } = useAction();
  const [settings] = useSettings<PatchCountdownSettings & JsonObject>();
  const slots: PatchCountdownSlot[] = settings.slots ?? [];

  const [patchData, setPatchData] = useState<PatchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPatches = useCallback(async () => {
    debug.log("[PatchCountdown]", actionId, "| fetching via PatchesClient");

    const data = await patchesClient.fetchPatches();

    if (data) {
      setPatchData(data);
      setError(null);
      debug.log("[PatchCountdown]", actionId, "| fetched patch data");
    } else {
      setError("No patch data available");
      debug.log("[PatchCountdown]", actionId, "| no patch data returned");
    }
  }, [actionId]);

  // Initial fetch
  useEffect(() => {
    if (slots.length > 0) {
      void fetchPatches();
    }
  }, [slots.length > 0]);

  // Poll every 10 minutes
  useInterval(
    () => {
      if (slots.length > 0) {
        void fetchPatches();
      }
    },
    slots.length > 0 ? POLL_INTERVAL_MS : null,
  );

  // Resolve slot data from the server response
  const resolvedSlots = useMemo<PatchSlotState[]>(() => {
    return slots.map((slot) => {
      if (!patchData) {
        if (error) {
          return { game: slot.game, data: { status: "error" as const, message: error } };
        }
        return { game: slot.game, data: { status: "loading" as const } };
      }

      const serverPatch = patchData[slot.game];
      if (!serverPatch) {
        return {
          game: slot.game,
          data: { status: "error" as const, message: "No patch data" },
        };
      }

      return {
        game: slot.game,
        data: {
          status: "ok" as const,
          patch: toRemainingSeconds(serverPatch),
        },
      };
    });
  }, [slots, patchData, error]);

  const value = useMemo<PatchCountdownContextValue>(
    () => ({
      slots: resolvedSlots,
      requestUpdateAll: fetchPatches,
    }),
    [resolvedSlots, fetchPatches],
  );

  return <PatchCountdownContext.Provider value={value}>{children}</PatchCountdownContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * Access the patch countdown context.
 * Must be used within a `PatchCountdownProvider`.
 */
export function usePatchCountdown(): PatchCountdownContextValue {
  const ctx = useContext(PatchCountdownContext);
  if (!ctx) {
    throw new Error("usePatchCountdown must be used within a PatchCountdownProvider");
  }
  return ctx;
}
