import streamDeck from "@elgato/streamdeck";
import { isDeepStrictEqual } from "node:util";
import type { JsonObject } from "@elgato/utils";
import { HoyolabClient } from "@/api/hoyolab/client";
import { isValidAuth } from "@/api/hoyolab/auth";
import { isAuthError } from "@/api/types/common";
import type { AuthStatus, GlobalSettings, HoyoAuth, GameId } from "@hoyodeck/shared/types";
import { HOYOLAB_GAME_IDS, type GameRecordCardResponse } from "@/api/types/game-record";
import { dataController } from "@/services/data-controller";
import { debug } from "@/utils/debug";

/**
 * Listens for pendingValidation in global settings and validates auth.
 * Called once at plugin startup to register the listener.
 */
export function registerAuthValidator(): void {
  const inFlight = new Map<string, HoyoAuth | undefined>();

  streamDeck.settings.onDidReceiveGlobalSettings<JsonObject>((ev) => {
    const settings = ev.settings as unknown as GlobalSettings;
    const accountId = settings.pendingValidation;
    if (!accountId) return;
    const auth = settings.accounts?.[accountId]?.auth;
    if (inFlight.has(accountId) && isDeepStrictEqual(inFlight.get(accountId), auth)) return;
    inFlight.set(accountId, auth);
    debug.log("[AuthValidator] pendingValidation detected:", settings.pendingValidation);
    void validateAccount(settings)
      .catch((error) => streamDeck.logger.error("[AuthValidator] Validation failed:", error))
      .finally(() => {
        if (inFlight.get(accountId) === auth) inFlight.delete(accountId);
      });
  });
}

async function validateAccount(settings: GlobalSettings): Promise<void> {
  const accountId = settings.pendingValidation;
  if (!accountId) return;

  const accounts = settings.accounts ?? {};
  const account = accounts[accountId];

  if (!account) {
    // Account was deleted before validation ran — just clear the flag
    debug.log("[AuthValidator] account not found, clearing pendingValidation");
    await dataController.writeGlobalSettings({ ...settings, pendingValidation: undefined });
    return;
  }

  let authStatus: AuthStatus | undefined;
  let roles: ReturnType<typeof extractGameRoles> | undefined;

  if (isValidAuth(account.auth)) {
    try {
      debug.log("[AuthValidator] validating auth for:", accountId);
      const client = new HoyolabClient(account.auth as HoyoAuth);
      const response = await client.getGameRecordCard((account.auth as HoyoAuth).ltuid_v2);
      authStatus = "valid";
      roles = extractGameRoles(response);
      debug.log("[AuthValidator] auth valid | linked games:", Object.keys(roles.uids));
    } catch (error) {
      if (isAuthError(error)) {
        authStatus = "invalid";
        debug.log("[AuthValidator] auth invalid:", error);
      } else {
        debug.log("[AuthValidator] validation request failed, keeping previous status:", error);
      }
    }
  } else {
    authStatus = "invalid";
    debug.log("[AuthValidator] auth cookies incomplete for:", accountId);
  }

  const current = dataController.getCachedGlobalSettings() ?? settings;
  const currentAccount = current.accounts?.[accountId];
  if (!currentAccount || !isDeepStrictEqual(currentAccount.auth, account.auth)) return;
  authStatus ??= currentAccount.authStatus;
  const uids = roles?.uids ?? currentAccount.uids;
  const nicknames = roles?.nicknames ?? currentAccount.nicknames;

  // Merge into the latest settings so an API response cannot undo intervening edits.
  const updatedAccounts = {
    ...current.accounts,
    [accountId]: {
      ...currentAccount,
      authStatus,
      uids,
      nicknames,
    },
  };

  debug.log(
    "[AuthValidator] writing back | account:",
    accountId,
    "| authStatus:",
    authStatus,
    "| linked games:",
    Object.keys(uids),
  );

  await dataController.writeGlobalSettings({
    ...current,
    accounts: updatedAccounts,
    pendingValidation:
      current.pendingValidation === accountId ? undefined : current.pendingValidation,
  });

  debug.log("[AuthValidator] globalSettings written successfully");
}

/**
 * Extract linked game roles (UIDs + nicknames) from the game record card API.
 */
function extractGameRoles(response: GameRecordCardResponse): {
  uids: Partial<Record<GameId, string>>;
  nicknames: Partial<Record<GameId, string>>;
} {
  const uids: Partial<Record<GameId, string>> = {};
  const nicknames: Partial<Record<GameId, string>> = {};

  for (const card of response.list) {
    if (!card.has_role) continue;
    const gameId = HOYOLAB_GAME_IDS[card.game_id];
    if (gameId) {
      uids[gameId] = card.game_role_id;
      nicknames[gameId] = card.nickname;
    }
  }

  return { uids, nicknames };
}
