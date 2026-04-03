import type { AccountId, HoyoAccount, GlobalSettings } from "@/types/settings";
import type { GameId } from "@/types/games";

// ─── Account Pick Result ────────────────────────────────────────────

/**
 * Discriminated union returned by `pickAccount()`.
 *
 * - `resolved`    -- account found and ready to use
 * - `no-accounts` -- no accounts configured at all
 * - `no-uid`      -- accounts exist but none has a UID for this game
 * - `ambiguous`   -- 2+ accounts match, user must choose
 */
type AccountPickResult =
  | { kind: "resolved"; account: HoyoAccount }
  | { kind: "no-accounts" }
  | { kind: "no-uid" }
  | { kind: "ambiguous" };

/**
 * Deterministic account pick strategy (pure function).
 *
 * Pick algorithm (in order):
 * 1. 0 accounts total -> `no-accounts`
 * 2. `accountId` provided + account exists -> `resolved`
 * 3. 1 account with game UID -> `resolved` (auto-select)
 * 4. 2+ accounts with game UID -> `ambiguous`
 * 5. Accounts exist but none has this game's UID -> `no-uid`
 */
export function pickAccount(
  accountId: AccountId | undefined,
  accounts: Record<string, HoyoAccount>,
  game: GameId,
): AccountPickResult {
  const allAccounts = Object.values(accounts);

  if (allAccounts.length === 0) {
    return { kind: "no-accounts" };
  }

  if (accountId) {
    const account = accounts[accountId];
    if (account) {
      return { kind: "resolved", account };
    }
  }

  const candidates = allAccounts.filter((a) => a.uids[game] !== undefined);

  if (candidates.length === 0) {
    return { kind: "no-uid" };
  }

  if (candidates.length === 1) {
    return { kind: "resolved", account: candidates[0]! };
  }

  return { kind: "ambiguous" };
}

/**
 * Convenience wrapper that reads accounts from GlobalSettings.
 */
export function pickAccountFromGlobal(
  accountId: AccountId | undefined,
  globalSettings: GlobalSettings,
  game: GameId,
): AccountPickResult {
  return pickAccount(accountId, globalSettings.accounts ?? {}, game);
}
