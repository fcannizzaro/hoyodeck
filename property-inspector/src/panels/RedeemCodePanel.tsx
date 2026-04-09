import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Select } from "../components/Select";
import { AccountPicker } from "../components/AccountPicker";
import type { GameId, GlobalSettings, HoyoAccount } from "@hoyodeck/shared/types";

const GAME_OPTIONS = [
  { value: "gi", label: "Genshin Impact" },
  { value: "hsr", label: "Honkai: Star Rail" },
  { value: "zzz", label: "Zenless Zone Zero" },
];

export function RedeemCodePanel() {
  const { settings, saveSettings, globalSettings, saveGlobalSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? "gi";

  // Resolve the current account + UID for this game
  const accounts = (globalSettings.accounts ?? {}) as Record<string, HoyoAccount>;
  const accountId = settings.accountId as string | undefined;
  const account = accountId ? accounts[accountId] : Object.values(accounts)[0];
  const uid = account?.uids[game];

  // Get claimed codes for this game+uid from global settings
  const claimedKey = uid ? `${game}:${uid}` : null;
  const claimedCodes = claimedKey
    ? ((globalSettings as GlobalSettings).claimedCodes?.[claimedKey] ?? [])
    : [];

  const handleResetClaimed = () => {
    if (!claimedKey) return;

    const current = globalSettings as GlobalSettings;
    const updated = { ...current.claimedCodes };
    delete updated[claimedKey];

    saveGlobalSettings({ claimedCodes: updated });
  };

  return (
    <div className="flex flex-col gap-2">
      <Heading>Redeem Code Settings</Heading>

      <Select
        label="Game"
        value={game}
        options={GAME_OPTIONS}
        onChange={(value) => saveSettings({ game: value })}
      />

      <AccountPicker game={game} />

      {/* Claimed codes list */}
      {claimedCodes.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sd-secondary uppercase tracking-wider">
              Redeemed Codes ({claimedCodes.length})
            </span>
            <button
              type="button"
              onClick={handleResetClaimed}
              className="text-[10px] px-1.5 py-0.5 rounded bg-sd-button hover:bg-sd-button-hover text-sd-secondary transition-colors"
            >
              Reset
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {claimedCodes.map((code) => (
              <div
                key={code}
                className="flex items-center gap-1.5 px-2 py-1 bg-sd-input/50 rounded text-[11px]"
              >
                <span className="text-sd-success">✅</span>
                <span className="font-mono text-sd-text">{code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {uid && claimedCodes.length === 0 && (
        <p className="text-[11px] text-sd-secondary mt-2">
          No codes have been redeemed yet. Press the key to start.
        </p>
      )}
    </div>
  );
}
