import streamDeck from "@elgato/streamdeck";
import { isDeepStrictEqual } from "node:util";
import type { JsonObject } from "@elgato/utils";
import { HoyolabClient } from "@/api/hoyolab/client";
import { isValidAuth } from "@/api/hoyolab/auth";
import { isAuthError } from "@/api/types/common";
import type {
  AuthStatus,
  GlobalSettings,
  HoyoAuth,
  HoyoAccount,
  GameId,
  GameRole,
} from "@hoyodeck/shared/types";
import { HOYOLAB_GAME_IDS, type GameRecordCardResponse } from "@/api/types/game-record";
import { dataController } from "@/services/data-controller";
import { debug } from "@/utils/debug";

/**
 * Listens for pendingValidation in global settings and validates auth.
 * Called once at plugin startup to register the listener.
 */
export function registerAuthValidator(): void {
  const inFlight = new Map<string, HoyoAccount | undefined>();

  streamDeck.settings.onDidReceiveGlobalSettings<JsonObject>((ev) => {
    const settings = ev.settings as unknown as GlobalSettings;
    const accountId = settings.pendingValidation;
    if (!accountId) return;
    const account = settings.accounts?.[accountId];
    if (
      inFlight.has(accountId) &&
      isDeepStrictEqual(inFlight.get(accountId)?.auth, account?.auth) &&
      inFlight.get(accountId)?.region === account?.region
    )
      return;
    inFlight.set(accountId, account);
    debug.log("[AuthValidator] pendingValidation detected:", settings.pendingValidation);
    void validateAccount(settings)
      .catch((error) => streamDeck.logger.error("[AuthValidator] Validation failed:", error))
      .finally(() => {
        if (inFlight.get(accountId) === account) inFlight.delete(accountId);
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
      const client = new HoyolabClient(account.auth as HoyoAuth, account.region ?? "global");
      const response = await client.getGameRecordCard((account.auth as HoyoAuth).ltuid_v2);
      authStatus = "valid";
      roles = extractGameRoles(response);
      debug.log("[AuthValidator] auth valid | linked games:", Object.keys(roles));
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
  if (
    !currentAccount ||
    !isDeepStrictEqual(currentAccount.auth, account.auth) ||
    currentAccount.region !== account.region
  )
    return;
  authStatus ??= currentAccount.authStatus;
  const uids = { ...currentAccount.uids };
  const nicknames = { ...currentAccount.nicknames };
  if (roles) {
    for (const game of Object.keys(roles) as GameId[]) {
      const available = roles[game]!;
      const selected =
        available.find((role) => role.uid === uids[game]) ??
        (!uids[game] ? available[0] : undefined);
      if (selected) {
        uids[game] = selected.uid;
        nicknames[game] = selected.nickname;
      }
    }
  }

  // Merge into the latest settings so an API response cannot undo intervening edits.
  const updatedAccounts = {
    ...current.accounts,
    [accountId]: {
      ...currentAccount,
      authStatus,
      uids,
      ...(roles ? { nicknames, roles } : {}),
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
function extractGameRoles(response: GameRecordCardResponse): Partial<Record<GameId, GameRole[]>> {
  const roles: Partial<Record<GameId, GameRole[]>> = {};
  for (const card of response.list) {
    const game = HOYOLAB_GAME_IDS[card.game_id];
    if (!card.has_role || !game) continue;
    (roles[game] ??= []).push({
      uid: card.game_role_id,
      nickname: card.nickname,
      region: card.region,
    });
  }
  return roles;
}
