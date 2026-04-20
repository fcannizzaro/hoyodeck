import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAction } from "@fcannizzaro/streamdeck-react";
import streamDeck from "@elgato/streamdeck";
import type { GameId } from "@hoyodeck/shared/types";
import type { HoyolabClient } from "@/api/hoyolab/client";
import { dataController } from "@/services/data-controller";
import { useAccount } from "./account-context";
import { debug } from "@/utils/debug";
import type {
  DataType,
  DataTypeMap,
  DataEntry,
  DataUpdate,
} from "@/services/data-controller.types";

// ─── Context Value ────────────────────────────────────────────────

interface DataContextValue {
  /** Current data entries keyed by DataType */
  entries: Partial<Record<DataType, DataEntry<unknown>>>;
  /** Request an immediate data refresh for the resolved account + game */
  requestUpdate: () => Promise<void>;
  /** Get a typed data entry */
  getData: <T extends DataType>(dataType: T) => DataEntry<DataTypeMap[T]> | undefined;
  /** Get the HoyolabClient for write operations (e.g. check-in) */
  getClient: () => HoyolabClient | null;
  /**
   * Refresh cookie_token_v2 using stoken_v2 for the resolved account.
   * Returns a fresh HoyolabClient with updated cookies, or null if refresh
   * is not possible (e.g. no stoken_v2 stored for this account).
   */
  refreshCookieToken: () => Promise<HoyolabClient | null>;
}

// ─── Context ──────────────────────────────────────────────────────

const DataContext = createContext<DataContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────

interface DataProviderProps {
  game: GameId;
  dataTypes: DataType[];
  children?: React.ReactNode;
}

/**
 * Registers/unregisters with the DataController singleton automatically.
 *
 * When the account (from AccountProvider) is resolved, registers the
 * action for the specified data types and tracks incoming updates as
 * React state. When the account is not resolved, provides empty data.
 *
 * Must be rendered inside an `AccountProvider`.
 */
export function DataProvider({ game, dataTypes, children }: DataProviderProps) {
  const { id: actionId } = useAction();
  const account = useAccount();
  const [entries, setEntries] = useState<Partial<Record<DataType, DataEntry<unknown>>>>({});

  // Stable key for the dataTypes array to use in dependency arrays
  const dataTypesKey = dataTypes.join(",");

  // Derive the accountId only when resolved (avoids accessing property on non-resolved union)
  const resolvedAccountId = account.status === "resolved" ? account.accountId : null;

  // Track the resolved account's UID for this game. When the auth validator
  // writes back UIDs after account creation, the accountId stays the same but
  // the UID changes from undefined → "123456". Including this in the effect
  // deps ensures re-registration + a fresh fetch once the UID is available.
  const resolvedUid = account.status === "resolved" ? account.account.uids[game] : undefined;

  // ── Clear stale entries when the game or action changes ─────────
  //
  // When the recycling pool reuses a root that was configured for a
  // different game (e.g. GI root recycled for HSR), `entries` still
  // holds data keyed by the old game's DataTypes (e.g. "gi:daily-note").
  // The new key component asks for "hsr:daily-note" which doesn't exist
  // in entries — but the old keys linger as garbage.
  //
  // Clearing entries eagerly on game/action change ensures:
  // 1. The component sees a clean loading state immediately
  // 2. The subsequent register() → cached data push fills entries
  //    with the correct game's data (no stale cross-game keys)
  const prevGameRef = useRef(game);
  const prevActionRef = useRef(actionId);

  if (game !== prevGameRef.current || actionId !== prevActionRef.current) {
    const oldGame = prevGameRef.current;
    const oldAction = prevActionRef.current;
    prevGameRef.current = game;
    prevActionRef.current = actionId;

    // Log the transition for debugging recycling issues
    if (game !== oldGame) {
      streamDeck.logger.info(
        `[DataProvider] ${actionId} | game changed: ${oldGame} → ${game} (root recycled cross-game), clearing stale entries`,
      );
      debug.log(
        "[DataProvider]",
        actionId,
        "| game changed:",
        oldGame,
        "→",
        game,
        "| clearing stale entries | had keys:",
        Object.keys(entries),
      );
    }
    if (actionId !== oldAction) {
      streamDeck.logger.debug(
        `[DataProvider] ${actionId} | action changed: ${oldAction} → ${actionId} (root recycled), clearing entries`,
      );
      debug.log(
        "[DataProvider]",
        actionId,
        "| action changed:",
        oldAction,
        "→",
        actionId,
        "| clearing entries",
      );
    }

    // Synchronous state reset during render (React allows this pattern
    // for state that must be consistent with props/context changes).
    // This avoids the "stale entries → wrong getData() → loading flash"
    // scenario that occurs when relying solely on the async effect cleanup.
    setEntries({});
  }

  // Register / unregister with the singleton
  useEffect(() => {
    if (account.status !== "resolved") {
      debug.log(
        "[DataProvider]",
        actionId,
        "| account not resolved:",
        account.status,
        "| clearing entries",
      );
      setEntries({});
      return;
    }

    const { accountId } = account;

    streamDeck.logger.debug(
      `[DataProvider] ${actionId} | registering | account: ${accountId} | game: ${game} | uid: ${resolvedUid ?? "(none)"} | types: ${dataTypes.join(", ")}`,
    );
    debug.log(
      "[DataProvider]",
      actionId,
      "| registering | account:",
      accountId,
      "| game:",
      game,
      "| uid:",
      resolvedUid ?? "(none)",
      "| types:",
      dataTypes,
    );

    // Clear entries at the start of each registration cycle.
    // This ensures we don't carry over stale data from a previous
    // game/account when the effect re-runs due to dep changes.
    setEntries({});

    const listener = (update: DataUpdate) => {
      debug.log(
        "[DataProvider]",
        actionId,
        "| data update:",
        update.dataType,
        "| status:",
        update.entry.status,
      );
      setEntries((prev) => ({
        ...prev,
        [update.dataType]: update.entry,
      }));
    };

    dataController.register({
      actionId,
      accountId,
      dataTypes,
      listener,
      onAccountRemoved: () => {
        debug.log("[DataProvider]", actionId, "| account removed, clearing entries");
        setEntries({});
      },
    });

    // Trigger an immediate fetch so actions render data on appear
    // rather than waiting for the first poll tick (up to 5 minutes).
    // register() pushes cached store entries, but the store is empty
    // on first plugin launch; this kick-starts the initial fetch.
    void dataController.requestUpdate(accountId, game);

    return () => {
      streamDeck.logger.debug(`[DataProvider] ${actionId} | unregistering (game: ${game})`);
      debug.log("[DataProvider]", actionId, "| unregistering");
      dataController.unregister(actionId);
    };
  }, [actionId, resolvedAccountId, resolvedUid, game, dataTypesKey]);

  const requestUpdate = useCallback(async () => {
    if (!resolvedAccountId) return;
    await dataController.requestUpdate(resolvedAccountId, game);
  }, [resolvedAccountId, game]);

  const getData = useCallback(
    <T extends DataType>(dataType: T): DataEntry<DataTypeMap[T]> | undefined => {
      return entries[dataType] as DataEntry<DataTypeMap[T]> | undefined;
    },
    [entries],
  );

  const getClient = useCallback((): HoyolabClient | null => {
    if (account.status !== "resolved") return null;
    return dataController.getClient(account.account);
  }, [resolvedAccountId]);

  const refreshCookieToken = useCallback(async (): Promise<HoyolabClient | null> => {
    if (!resolvedAccountId) return null;
    return dataController.refreshCookieToken(resolvedAccountId);
  }, [resolvedAccountId]);

  const value = useMemo<DataContextValue>(
    () => ({
      entries,
      requestUpdate,
      getData,
      getClient,
      refreshCookieToken,
    }),
    [entries, requestUpdate, getData, getClient, refreshCookieToken],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * Access the DataController context.
 * Must be used within a `DataProvider`.
 */
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
}
