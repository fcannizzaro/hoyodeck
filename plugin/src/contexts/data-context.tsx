import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAction } from "@fcannizzaro/streamdeck-react";
import type { GameId } from "@/types/settings";
import type { HoyolabClient } from "@/api/hoyolab/client";
import { dataController } from "@/services/data-controller";
import { useAccount } from "./account-context";
import type {
  DataType,
  DataTypeMap,
  DataEntry,
  DataUpdate,
} from "@/services/data-controller.types";

// ─── Context Value ────────────────────────────────────────────────

export interface DataContextValue {
  /** Current data entries keyed by DataType */
  entries: Partial<Record<DataType, DataEntry<unknown>>>;
  /** Request an immediate data refresh for the resolved account + game */
  requestUpdate: () => Promise<void>;
  /** Get a typed data entry */
  getData: <T extends DataType>(dataType: T) => DataEntry<DataTypeMap[T]> | undefined;
  /** Get the HoyolabClient for write operations (e.g. check-in) */
  getClient: () => HoyolabClient | null;
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

  // Register / unregister with the singleton
  useEffect(() => {
    if (account.status !== "resolved") {
      setEntries({});
      return;
    }

    const { accountId } = account;

    const listener = (update: DataUpdate) => {
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
        setEntries({});
      },
    });

    // Trigger an immediate fetch so actions render data on appear
    // rather than waiting for the first poll tick (up to 5 minutes).
    // register() pushes cached store entries, but the store is empty
    // on first plugin launch; this kick-starts the initial fetch.
    void dataController.requestUpdate(accountId, game);

    return () => {
      dataController.unregister(actionId);
    };
  }, [actionId, resolvedAccountId, dataTypesKey]);

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

  const value = useMemo<DataContextValue>(
    () => ({
      entries,
      requestUpdate,
      getData,
      getClient,
    }),
    [entries, requestUpdate, getData, getClient],
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
