import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAction, useSettings, useGlobalSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type {
  AccountId,
  GameId,
  GlobalSettings,
  HoyoAccount,
  PatchCountdownSettings,
  PatchCountdownSlot,
} from "@hoyodeck/shared/types";
import { dataController } from "@/services/data-controller";
import { getPatchInfo, type PatchInfo } from "@/utils/patch";
import { debug } from "@/utils/debug";
import type { DataType, DataEntry, DataUpdate } from "@/services/data-controller.types";

// ─── Calendar DataType mapping ────────────────────────────────────

/** Maps a game to its calendar data type key */
const CALENDAR_DATA_TYPES: Record<GameId, DataType> = {
  gi: "gi:act-calendar",
  hsr: "hsr:act-calendar",
  zzz: "zzz:gacha-calendar",
};

// ─── Account Resolution ───────────────────────────────────────────

/**
 * Find the first account that has a UID for the given game.
 * Returns the account ID or undefined if no account supports the game.
 */
function findAccountForGame(
  accounts: Record<string, HoyoAccount>,
  game: GameId,
): AccountId | undefined {
  for (const account of Object.values(accounts)) {
    if (account.uids[game]) return account.id;
  }
  return undefined;
}

// ─── Resolved Slot Data ───────────────────────────────────────────

/** Resolved data for a single patch countdown slot */
type ResolvedSlotData =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ok"; patch: PatchInfo };

/** Full slot state including config + resolved data */
export interface PatchSlotState {
  game: GameId;
  data: ResolvedSlotData;
}

// ─── Context Value ────────────────────────────────────────────────

interface PatchCountdownContextValue {
  /** Resolved data for each configured slot */
  slots: PatchSlotState[];
  /** Request an immediate data refresh for all slots */
  requestUpdateAll: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────

const PatchCountdownContext = createContext<PatchCountdownContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────

/**
 * Manages multiple DataController subscriptions — one per configured slot.
 *
 * Each slot subscribes to the calendar data type for its game
 * (`gi:act-calendar`, `hsr:act-calendar`, or `zzz:gacha-calendar`).
 * The account is auto-resolved — the first account with a UID for the
 * slot's game is used. No per-slot account selection is needed.
 * Patch end timing is extracted from the calendar using `getPatchInfo()`.
 */
export function PatchCountdownProvider({ children }: { children?: React.ReactNode }) {
  const { id: actionId } = useAction();
  const [settings] = useSettings<PatchCountdownSettings & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  const slots: PatchCountdownSlot[] = settings.slots ?? [];
  const accounts = (globalSettings.accounts ?? {}) as Record<string, HoyoAccount>;

  // Data entries keyed by slot index
  const [slotEntries, setSlotEntries] = useState<Map<number, DataEntry<unknown>>>(new Map());

  // Generation counter to discard stale listener updates
  const generationRef = useRef(0);

  // Resolve account per game — auto-picks the first available account
  const resolvedAccounts = slots.map((s) => findAccountForGame(accounts, s.game));

  // Stable key for dependency tracking (game + resolved accountId)
  const slotsKey = slots.map((s, i) => `${s.game}:${resolvedAccounts[i] ?? ""}`).join("|");

  // Stable key from relevant account UIDs (avoids teardown on unrelated account changes)
  const accountsKey = resolvedAccounts
    .map((accountId, i) => {
      if (!accountId) return "";
      const account = accounts[accountId];
      return account?.uids[slots[i]!.game] ?? "";
    })
    .join("|");

  // Register / unregister with DataController for each slot
  useEffect(() => {
    if (slots.length === 0) {
      setSlotEntries(new Map());
      return;
    }

    const gen = ++generationRef.current;
    const registrationIds: string[] = [];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      const accountId = resolvedAccounts[i];

      // Skip slots with no account available for this game
      if (!accountId) {
        debug.log(
          "[PatchCountdown]",
          actionId,
          `| slot ${i}: no account with UID for ${slot.game}`,
        );
        continue;
      }

      const account = accounts[accountId];
      if (!account) {
        debug.log(
          "[PatchCountdown]",
          actionId,
          `| slot ${i}: resolved account ${accountId} not found`,
        );
        continue;
      }

      const uid = account.uids[slot.game];
      if (!uid) {
        debug.log("[PatchCountdown]", actionId, `| slot ${i}: no UID for ${slot.game}`);
        continue;
      }

      const regId = `${actionId}:patch-${i}`;
      const dataType = CALENDAR_DATA_TYPES[slot.game];
      registrationIds.push(regId);

      debug.log("[PatchCountdown]", actionId, `| registering slot ${i}:`, slot.game, accountId);

      dataController.register({
        actionId: regId,
        accountId,
        dataTypes: [dataType],
        listener: (update: DataUpdate) => {
          // Discard updates from a previous generation
          if (gen !== generationRef.current) return;

          debug.log(
            "[PatchCountdown]",
            actionId,
            `| slot ${i} data:`,
            update.dataType,
            update.entry.status,
          );
          setSlotEntries((prev) => {
            const next = new Map(prev);
            next.set(i, update.entry);
            return next;
          });
        },
        onAccountRemoved: () => {
          if (gen !== generationRef.current) return;

          debug.log("[PatchCountdown]", actionId, `| slot ${i} account removed`);
          setSlotEntries((prev) => {
            const next = new Map(prev);
            next.delete(i);
            return next;
          });
        },
      });

      // Trigger initial fetch
      void dataController.requestUpdate(accountId, slot.game);
    }

    return () => {
      for (const regId of registrationIds) {
        debug.log("[PatchCountdown]", actionId, "| unregistering", regId);
        dataController.unregister(regId);
      }
      setSlotEntries(new Map());
    };
  }, [actionId, slotsKey, accountsKey]);

  // Resolve slot data — extract PatchInfo from calendar responses
  const resolvedSlots = useMemo<PatchSlotState[]>(() => {
    return slots.map((slot, i) => {
      const accountId = resolvedAccounts[i];

      // Unconfigured: no account available for this game
      if (!accountId) {
        return { game: slot.game, data: { status: "unconfigured" as const } };
      }

      const entry = slotEntries.get(i);

      if (!entry) {
        return { game: slot.game, data: { status: "loading" as const } };
      }

      if (entry.status === "error") {
        return {
          game: slot.game,
          data: { status: "error" as const, message: entry.error.message },
        };
      }

      const patch = getPatchInfo(slot.game, entry.data);
      if (!patch) {
        return {
          game: slot.game,
          data: { status: "error" as const, message: "No active patch data" },
        };
      }

      return { game: slot.game, data: { status: "ok" as const, patch } };
    });
  }, [slotsKey, accountsKey, slotEntries]);

  const requestUpdateAll = useCallback(async () => {
    const currentSlots = settings.slots ?? [];
    const promises = currentSlots
      .map((slot) => {
        const accountId = findAccountForGame(accounts, slot.game);
        if (!accountId) return null;
        return dataController.requestUpdate(accountId, slot.game);
      })
      .filter(Boolean);
    await Promise.allSettled(promises as Promise<void>[]);
  }, [slotsKey]);

  const value = useMemo<PatchCountdownContextValue>(
    () => ({
      slots: resolvedSlots,
      requestUpdateAll,
    }),
    [resolvedSlots, requestUpdateAll],
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
