import type { HoyolabClient } from "@/api/hoyolab/client";
import { useAccount, type AccountContextValue } from "@/contexts/account-context";
import { useData } from "@/contexts/data-context";
import type { DataType, DataTypeMap, DataEntry } from "@/services/data-controller.types";

// ─── Result Type ──────────────────────────────────────────────────

export interface UseGameDataResult<T extends DataType> {
  /** Account resolution status */
  account: AccountContextValue;
  /** Typed data entry, undefined if not yet fetched */
  data: DataEntry<DataTypeMap[T]> | undefined;
  /** Request an immediate data refresh */
  requestUpdate: () => Promise<void>;
  /** Get HoyolabClient for write operations (e.g. check-in) */
  getClient: () => HoyolabClient | null;
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * High-level hook that combines account resolution + data access.
 *
 * Reads a single data type from the DataProvider. The actual
 * registration/unregistration is handled by the DataProvider wrapper;
 * this hook is a typed accessor that composes `useAccount()` + `useData()`.
 *
 * For actions that need multiple data types, call `useData().getData()`
 * directly for each type.
 *
 * @example
 * ```tsx
 * function ResinKey() {
 *   const { account, data, requestUpdate } = useGameData('gi:daily-note');
 *   if (account.status !== 'resolved') return <Placeholder status={account.status} />;
 *   if (!data || data.status !== 'ok') return <Loading />;
 *   return <ResinDisplay resin={data.data.current_resin} />;
 * }
 * ```
 */
export function useGameData<T extends DataType>(dataType: T): UseGameDataResult<T> {
  const account = useAccount();
  const { getData, requestUpdate, getClient } = useData();

  return {
    account,
    data: getData(dataType),
    requestUpdate,
    getClient,
  };
}
