import { createContext, useContext, useMemo, useRef } from "react";
import { useSettings, useGlobalSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { AccountId, GlobalSettings, HoyoAccount, GameId } from "@/types/settings";
import { pickAccountFromGlobal } from "@/services/account-picker";

// ─── Context Value ────────────────────────────────────────────────

/**
 * Discriminated union representing the current account resolution state.
 * Mirrors `AccountPickResult` but uses `status` for consistency with `DataEntry`.
 */
export type AccountContextValue =
  | { status: "resolved"; account: HoyoAccount; accountId: AccountId }
  | { status: "no-accounts" }
  | { status: "no-uid" }
  | { status: "ambiguous" };

// ─── Context ──────────────────────────────────────────────────────

const AccountContext = createContext<AccountContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────

interface AccountProviderProps {
  game: GameId;
  children?: React.ReactNode;
}

/**
 * Resolves the account for the current action instance.
 *
 * Reads `accountId` from per-action settings and `accounts` from
 * global settings, then runs the pick algorithm. When a single
 * candidate is auto-selected, the `accountId` is persisted to
 * per-action settings so the PI shows the correct selection.
 *
 * Must be rendered inside the built-in SettingsProvider and
 * GlobalSettingsProvider (which the plugin wrapper position guarantees).
 */
export function AccountProvider({ game, children }: AccountProviderProps) {
  const [settings, setSettings] = useSettings<{ accountId?: AccountId } & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  // Track whether we already auto-persisted to avoid repeated writes
  const autoPersistedRef = useRef<AccountId | undefined>(undefined);

  const value = useMemo<AccountContextValue>(() => {
    const result = pickAccountFromGlobal(settings.accountId, globalSettings, game);

    if (result.kind !== "resolved") {
      // Reset auto-persist tracking when account is no longer resolved
      autoPersistedRef.current = undefined;
      return { status: result.kind };
    }

    const { account } = result;

    // Auto-persist accountId when auto-selected (single candidate, no stored id)
    if (!settings.accountId && account.id && autoPersistedRef.current !== account.id) {
      autoPersistedRef.current = account.id;
      setSettings({ accountId: account.id });
    }

    return { status: "resolved", account, accountId: account.id };
  }, [settings.accountId, globalSettings.accounts, game]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * Returns the resolved account for the current action instance.
 * Must be used within an `AccountProvider`.
 */
export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return ctx;
}
