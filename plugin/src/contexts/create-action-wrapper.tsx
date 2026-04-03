import { QueryClientProvider } from "@tanstack/react-query";
import type { GameId } from "@/types/settings";
import type { DataType } from "@/services/data-controller.types";
import { queryClient } from "@/services/query-client";
import { AccountProvider } from "./account-context";
import { DataProvider } from "./data-context";

/**
 * Creates a per-action wrapper that provides QueryClientProvider +
 * AccountProvider + DataProvider configured for a specific game and data types.
 *
 * Used with `defineAction({ wrapper })` so each action root gets the
 * correct context tree without manual provider composition.
 *
 * @example
 * ```ts
 * export const resinAction = defineAction({
 *   uuid: 'com.fcannizzaro.hoyodeck.genshin.resin',
 *   key: ResinKey,
 *   wrapper: createActionWrapper('gi', ['gi:daily-note']),
 * });
 * ```
 */
export function createActionWrapper(game: GameId, dataTypes: DataType[]) {
  return function ActionWrapper({ children }: { children?: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AccountProvider game={game}>
          <DataProvider game={game} dataTypes={dataTypes}>
            {children}
          </DataProvider>
        </AccountProvider>
      </QueryClientProvider>
    );
  };
}
