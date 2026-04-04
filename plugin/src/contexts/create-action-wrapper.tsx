import type { GameId } from "@hoyodeck/shared/types";
import type { DataType } from "@/services/data-controller.types";
import { AccountProvider } from "./account-context";
import { DataProvider } from "./data-context";

/**
 * Creates a per-action wrapper that provides AccountProvider + DataProvider
 * configured for a specific game and data types.
 *
 * QueryClientProvider is provided at the plugin level (see plugin-wrapper.tsx),
 * so individual actions don't need to compose it.
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
      <AccountProvider game={game}>
        <DataProvider game={game} dataTypes={dataTypes}>
          {children}
        </DataProvider>
      </AccountProvider>
    );
  };
}
