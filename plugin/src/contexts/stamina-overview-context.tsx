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
  GameId,
  GlobalSettings,
  HoyoAccount,
  StaminaOverviewSettings,
  StaminaSlot,
} from "@hoyodeck/shared/types";
import { dataController } from "@/services/data-controller";
import { extractStamina, type StaminaInfo } from "@/utils/stamina";
import { debug } from "@/utils/debug";
import type { DataType, DataEntry, DataUpdate } from "@/services/data-controller.types";

// ─── Resolved Slot Data ───────────────────────────────────────────

/** Resolved data for a single stamina slot */
export type ResolvedSlotData =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ok"; stamina: StaminaInfo };

/** Full slot state including config + resolved data */
export interface SlotState {
  game: GameId;
  data: ResolvedSlotData;
}

// ─── Focus Index ──────────────────────────────────────────────────

/** No slot selected (-1 stored in settings, null in context API) */
const NO_FOCUS = -1;

// ─── Context Value ────────────────────────────────────────────────

export interface StaminaOverviewContextValue {
  /** Resolved data for each configured slot */
  slots: SlotState[];
  /** Currently focused slot index (null = no selection) */
  focusIndex: number | null;
  /** Set the focused slot index (null = deselect) */
  setFocusIndex: (index: number | null) => void;
  /** Request an immediate data refresh for all slots */
  requestUpdateAll: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────

const StaminaOverviewContext = createContext<StaminaOverviewContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────

/**
 * Manages multiple DataController subscriptions — one per configured slot.
 *
 * Each slot gets a synthetic registration ID (`${actionId}:slot-${index}`)
 * so the DataController tracks them independently. On settings change
 * (slots added/removed/reordered), old registrations are torn down and
 * new ones created.
 */
export function StaminaOverviewProvider({ children }: { children?: React.ReactNode }) {
  const { id: actionId } = useAction();
  const [settings, setSettings] = useSettings<StaminaOverviewSettings & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  const slots: StaminaSlot[] = settings.slots ?? [];
  const rawFocusIndex = settings.focusIndex ?? NO_FOCUS;

  // Data entries keyed by slot index
  const [slotEntries, setSlotEntries] = useState<Map<number, DataEntry<unknown>>>(new Map());

  // Generation counter to discard stale listener updates
  const generationRef = useRef(0);

  // Stable key for dependency tracking
  const slotsKey = slots.map((s) => `${s.game}:${s.accountId}`).join("|");

  // Stable key from relevant account UIDs (avoids teardown on unrelated account changes)
  const accounts = globalSettings.accounts ?? {};
  const accountsKey = slots
    .map((s) => {
      const account = accounts[s.accountId] as HoyoAccount | undefined;
      return account?.uids[s.game] ?? "";
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

      // Skip slots with no account selected
      if (!slot.accountId) {
        debug.log("[StaminaOverview]", actionId, `| slot ${i}: no accountId configured`);
        continue;
      }

      const account = accounts[slot.accountId] as HoyoAccount | undefined;
      if (!account) {
        debug.log(
          "[StaminaOverview]",
          actionId,
          `| slot ${i}: account ${slot.accountId} not found`,
        );
        continue;
      }

      const uid = account.uids[slot.game];
      if (!uid) {
        debug.log("[StaminaOverview]", actionId, `| slot ${i}: no UID for ${slot.game}`);
        continue;
      }

      const regId = `${actionId}:slot-${i}`;
      const dataType = `${slot.game}:daily-note` as DataType;
      registrationIds.push(regId);

      debug.log(
        "[StaminaOverview]",
        actionId,
        `| registering slot ${i}:`,
        slot.game,
        slot.accountId,
      );

      dataController.register({
        actionId: regId,
        accountId: slot.accountId,
        dataTypes: [dataType],
        listener: (update: DataUpdate) => {
          // Discard updates from a previous generation
          if (gen !== generationRef.current) return;

          debug.log(
            "[StaminaOverview]",
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

          debug.log("[StaminaOverview]", actionId, `| slot ${i} account removed`);
          setSlotEntries((prev) => {
            const next = new Map(prev);
            next.delete(i);
            return next;
          });
        },
      });

      // Trigger initial fetch
      void dataController.requestUpdate(slot.accountId, slot.game);
    }

    return () => {
      for (const regId of registrationIds) {
        debug.log("[StaminaOverview]", actionId, "| unregistering", regId);
        dataController.unregister(regId);
      }
      setSlotEntries(new Map());
    };
  }, [actionId, slotsKey, accountsKey]);

  // Resolve slot data — uses slotsKey for stable dependency
  const resolvedSlots = useMemo<SlotState[]>(() => {
    return slots.map((slot, i) => {
      // Unconfigured: no accountId set or account doesn't exist
      if (!slot.accountId || !accounts[slot.accountId]) {
        return { game: slot.game, data: { status: "unconfigured" as const } };
      }

      const account = accounts[slot.accountId] as HoyoAccount | undefined;
      if (!account?.uids[slot.game]) {
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

      const stamina = extractStamina(slot.game, entry.data);
      if (!stamina) {
        return {
          game: slot.game,
          data: { status: "error" as const, message: "Failed to parse data" },
        };
      }

      return { game: slot.game, data: { status: "ok" as const, stamina } };
    });
  }, [slotsKey, accountsKey, slotEntries]);

  // Clamp focus index when slots change
  const focusIndex = useMemo<number | null>(() => {
    if (rawFocusIndex === NO_FOCUS) return null;
    if (slots.length === 0) return null;
    if (rawFocusIndex >= slots.length) return slots.length - 1;
    return rawFocusIndex;
  }, [rawFocusIndex, slots.length]);

  // Persist clamped value back to settings if it differs
  useEffect(() => {
    const stored = rawFocusIndex;
    const clamped = focusIndex === null ? NO_FOCUS : focusIndex;
    if (stored !== clamped) {
      setSettings({ focusIndex: clamped });
    }
  }, [focusIndex, rawFocusIndex]);

  const setFocusIndex = useCallback(
    (index: number | null) => {
      setSettings({ focusIndex: index === null ? NO_FOCUS : index });
    },
    [setSettings],
  );

  const requestUpdateAll = useCallback(async () => {
    const currentSlots = settings.slots ?? [];
    const promises = currentSlots
      .filter((slot) => slot.accountId)
      .map((slot) => dataController.requestUpdate(slot.accountId, slot.game));
    await Promise.allSettled(promises);
  }, [slotsKey]);

  const value = useMemo<StaminaOverviewContextValue>(
    () => ({
      slots: resolvedSlots,
      focusIndex,
      setFocusIndex,
      requestUpdateAll,
    }),
    [resolvedSlots, focusIndex, setFocusIndex, requestUpdateAll],
  );

  return (
    <StaminaOverviewContext.Provider value={value}>{children}</StaminaOverviewContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * Access the stamina overview context.
 * Must be used within a `StaminaOverviewProvider`.
 */
export function useStaminaOverview(): StaminaOverviewContextValue {
  const ctx = useContext(StaminaOverviewContext);
  if (!ctx) {
    throw new Error("useStaminaOverview must be used within a StaminaOverviewProvider");
  }
  return ctx;
}
