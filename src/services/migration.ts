import streamDeck from "@elgato/streamdeck";
import { isValidAuth } from "@/api/hoyolab/auth";
import type { GlobalSettings, HoyoAccount, HoyoAuth } from "@/types/settings";
import { toJsonObject } from "@/types/settings";

/**
 * Migrate V1 single-account global settings to V2 multi-account.
 *
 * V1 shape: { auth?: HoyoAuth, uid?: string }
 * V2 shape: { version: 2, accounts: Record<AccountId, HoyoAccount> }
 *
 * Safe to call multiple times — no-ops if already V2.
 */
export async function migrateGlobalSettings(): Promise<void> {
  const raw = await streamDeck.settings.getGlobalSettings();
  const settings = raw as unknown as GlobalSettings;

  // Already migrated
  if (settings.version === 2) return;

  const accounts: Record<string, HoyoAccount> = {};

  if (settings.auth && isValidAuth(settings.auth)) {
    const id = crypto.randomUUID();
    const account: HoyoAccount = {
      id,
      name: "Main",
      auth: settings.auth as HoyoAuth,
      authStatus: "unknown",
      uids: {},
    };

    // If a UID was configured, assume it's Genshin (that's all V1 supported)
    if (settings.uid) {
      account.uids = { genshin: settings.uid };
    }

    accounts[id] = account;
  }

  const v2: GlobalSettings = {
    version: 2,
    accounts,
    // Trigger validation for the migrated account
    pendingValidation: Object.keys(accounts)[0],
  };

  await streamDeck.settings.setGlobalSettings(toJsonObject(v2));

  streamDeck.logger.info(
    `Migrated global settings from V1 to V2 (${Object.keys(accounts).length} accounts)`,
  );
}
