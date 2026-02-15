import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { HoyolabClient } from "@/api/hoyolab/client";
import { isValidAuth } from "@/api/hoyolab/auth";
import type { GlobalSettings, HoyoAuth } from "@/types/settings";
import { toJsonObject } from "@/types/settings";

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

  if (isValidAuth(account.auth)) {
    try {
      const client = new HoyolabClient(account.auth as HoyoAuth);
      // Lightweight call that requires valid auth but no UID
      await client.getCheckInInfo('gi');
      authStatus = "valid";
    } catch {
      authStatus = "invalid";
    }
  }

  // Write result back — update the account's status and clear pending flag
  const updatedAccounts = {
    ...accounts,
    [accountId]: {
      ...account,
      authStatus,
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
