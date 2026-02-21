import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { HoyolabClient } from "@/api/hoyolab/client";
import { isValidAuth } from "@/api/hoyolab/auth";
import type { GlobalSettings, HoyoAuth } from "@/types/settings";
import { toJsonObject } from "@/types/settings";
import type { GameId } from "@/types/games";
import { HOYOLAB_GAME_IDS } from "@/api/types/game-record";

/**
 * Listens for pendingValidation in global settings and validates auth.
 * Called once at plugin startup to register the listener.
 */
export function registerAuthValidator(): void {
  streamDeck.settings.onDidReceiveGlobalSettings<JsonObject>((ev) => {
    const settings = ev.settings as unknown as GlobalSettings;
    if (!settings.pendingValidation) return;
    void validateAccount(settings);
  });
}

async function validateAccount(settings: GlobalSettings): Promise<void> {
  const accountId = settings.pendingValidation;
  if (!accountId) return;

  const accounts = settings.accounts ?? {};
  const account = accounts[accountId];

  if (!account) {
    // Account was deleted before validation ran — just clear the flag
    await streamDeck.settings.setGlobalSettings(
      toJsonObject({ ...settings, pendingValidation: undefined }),
    );
    return;
  }

  let authStatus: "valid" | "invalid" = "invalid";
  let uids = account.uids;
  let nicknames = account.nicknames;

  if (isValidAuth(account.auth)) {
    try {
      const client = new HoyolabClient(account.auth as HoyoAuth);
      // Lightweight call that requires valid auth but no UID
      await client.getCheckInInfo('gi');
      authStatus = "valid";

      // Auto-fetch game UIDs and nicknames
      const roles = await fetchGameRoles(client, account.auth as HoyoAuth);
      uids = roles.uids;
      nicknames = roles.nicknames;
    } catch {
      authStatus = "invalid";
    }
  }

  // Write result back — update the account's status, UIDs, and clear pending flag
  const updatedAccounts = {
    ...accounts,
    [accountId]: {
      ...account,
      authStatus,
      uids,
      nicknames,
    },
  };

  await streamDeck.settings.setGlobalSettings(
    toJsonObject({
      ...settings,
      accounts: updatedAccounts,
      pendingValidation: undefined,
    }),
  );
}

/**
 * Fetch all linked game roles (UIDs + nicknames) from the game record card API.
 * Returns empty objects on failure so auth validation is not blocked.
 */
async function fetchGameRoles(
  client: HoyolabClient,
  auth: HoyoAuth,
): Promise<{ uids: Partial<Record<GameId, string>>; nicknames: Partial<Record<GameId, string>> }> {
  try {
    const response = await client.getGameRecordCard(auth.ltuid_v2);
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
  } catch (error) {
    streamDeck.logger.warn('[AuthValidator] Failed to fetch game UIDs:', error);
    return { uids: {}, nicknames: {} };
  }
}
