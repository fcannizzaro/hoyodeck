import { createContext, useContext, useMemo, useRef } from "react";
import { useSettings, useGlobalSettings, useAction } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { AccountId, GlobalSettings, HoyoAccount, GameId } from "@/types/settings";
import { debug } from "@/utils/debug";

// ─── Account Pick ─────────────────────────────────────────────────

/**
 * Discriminated union representing the current account resolution state.
 *
 * - `resolved`    -- account found and ready to use
 * - `no-accounts` -- no accounts configured at all
 * - `no-uid`      -- accounts exist but none has a UID for this game
 * - `ambiguous`   -- 2+ accounts match, user must choose
 */
export type AccountContextValue =
  | { status: "resolved"; account: HoyoAccount; accountId: AccountId }
  | { status: "no-accounts" }
  | { status: "no-uid" }
  | { status: "ambiguous" };

/**
 * Deterministic account pick (pure function).
 *
 * 1. 0 accounts total -> `no-accounts`
 * 2. `accountId` provided + account exists -> `resolved`
 * 3. 1 account with game UID -> `resolved` (auto-select)
 * 4. 2+ accounts with game UID -> `ambiguous`
 * 5. Accounts exist but none has this game's UID -> `no-uid`
 */
function pickAccount(
  accountId: AccountId | undefined,
  globalSettings: GlobalSettings,
  game: GameId,
): AccountContextValue {
  const accounts = globalSettings.accounts ?? {};
  const allAccounts = Object.values(accounts);

  if (allAccounts.length === 0) {
    return { status: "no-accounts" };
  }

  if (accountId) {
    const account = accounts[accountId];
    if (account) {
      return { status: "resolved", account, accountId };
    }
  }

  const candidates = allAccounts.filter((a) => a.uids[game] !== undefined);

  if (candidates.length === 0) {
    return { status: "no-uid" };
  }

  if (candidates.length === 1) {
    const account = candidates[0]!;
    return { status: "resolved", account, accountId: account.id };
  }

  return { status: "ambiguous" };
}

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
  const { id: actionId } = useAction();
  const [settings, setSettings] = useSettings<{ accountId?: AccountId } & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  // Track whether we already auto-persisted to avoid repeated writes
  const autoPersistedRef = useRef<AccountId | undefined>(undefined);
  const prevStatusRef = useRef<string | undefined>(undefined);

  const value = useMemo<AccountContextValue>(() => {
    const accounts = globalSettings.accounts ?? {};
    const accountCount = Object.keys(accounts).length;
    const result = pickAccount(settings.accountId, globalSettings, game);

    debug.log(
      "[AccountProvider]",
      actionId,
      "| game:",
      game,
      "| pick:",
      result.status,
      "| accountId in settings:",
      settings.accountId ?? "(none)",
      "| accounts:",
      accountCount,
      "| uids:",
      Object.fromEntries(Object.entries(accounts).map(([id, a]) => [id, Object.keys(a.uids)])),
    );

    if (result.status !== "resolved") {
      // Reset auto-persist tracking when account is no longer resolved
      autoPersistedRef.current = undefined;

      if (prevStatusRef.current !== result.status) {
        debug.log(
          "[AccountProvider]",
          actionId,
          "| status changed:",
          prevStatusRef.current,
          "→",
          result.status,
        );
        prevStatusRef.current = result.status;
      }

      return result;
    }

    const { account } = result;

    // Auto-persist accountId when auto-selected (single candidate, no stored id)
    if (!settings.accountId && account.id && autoPersistedRef.current !== account.id) {
      debug.log("[AccountProvider]", actionId, "| auto-persisting accountId:", account.id);
      autoPersistedRef.current = account.id;
      setSettings({ accountId: account.id });
    }

    if (prevStatusRef.current !== "resolved") {
      debug.log(
        "[AccountProvider]",
        actionId,
        "| status changed:",
        prevStatusRef.current,
        "→ resolved | account:",
        account.id,
      );
      prevStatusRef.current = "resolved";
    }

    return result;
  }, [settings.accountId, globalSettings, game]);

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
