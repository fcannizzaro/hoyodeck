import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Select } from "../components/Select";
import { AccountPicker } from "../components/AccountPicker";
import type {
  GameId,
  GlobalSettings,
  HoyoAccount,
  CodeRedeemResult,
  CodeRedeemStatus,
} from "@hoyodeck/shared/types";

const GAME_OPTIONS = [
  { value: "gi", label: "Genshin Impact" },
  { value: "hsr", label: "Honkai: Star Rail" },
  { value: "zzz", label: "Zenless Zone Zero" },
];

/** Status icon + color for each redeem outcome */
const STATUS_CONFIG: Record<CodeRedeemStatus, { icon: string; colorClass: string; label: string }> =
  {
    success: { icon: "✓", colorClass: "text-sd-success", label: "Redeemed" },
    already_claimed: { icon: "✓", colorClass: "text-sd-secondary", label: "Already claimed" },
    expired: { icon: "✕", colorClass: "text-sd-error", label: "Expired" },
    error: { icon: "!", colorClass: "text-sd-error", label: "Failed" },
  };

function ResultRow({ result }: { result: CodeRedeemResult }) {
  const config = STATUS_CONFIG[result.status];

  return (
    <div className="flex items-start gap-1.5 px-2 py-1 bg-sd-input/50 rounded text-[11px]">
      <span className={`${config.colorClass} font-bold text-xs shrink-0 w-3 text-center`}>
        {config.icon}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-sd-text truncate">{result.code}</span>
        <span className="text-sd-secondary text-[10px] truncate">{result.reason}</span>
      </div>
    </div>
  );
}

export function RedeemCodePanel() {
  const { settings, saveSettings, globalSettings, saveGlobalSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? "gi";

  // Resolve the current account + UID for this game
  const accounts = (globalSettings.accounts ?? {}) as Record<string, HoyoAccount>;
  const accountId = settings.accountId as string | undefined;
  const account = accountId ? accounts[accountId] : Object.values(accounts)[0];
  const uid = account?.uids[game];

  // Get claimed codes and results for this game+uid from global settings
  const settingsKey = uid ? `${game}:${uid}` : null;
  const gs = globalSettings as GlobalSettings;
  const claimedCodes = settingsKey ? (gs.claimedCodes?.[settingsKey] ?? []) : [];
  const redeemResults = settingsKey ? (gs.redeemResults?.[settingsKey] ?? []) : [];

  // Build a map of results keyed by code for quick lookup
  const resultsByCode = new Map<string, CodeRedeemResult>();
  for (const r of redeemResults) resultsByCode.set(r.code, r);

  // Build display list: results first (have detail), then codes without results (legacy)
  const displayItems: CodeRedeemResult[] = [];
  const seen = new Set<string>();

  // Add all results (sorted newest first)
  const sorted = [...redeemResults].sort(
    (a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime(),
  );
  for (const r of sorted) {
    displayItems.push(r);
    seen.add(r.code);
  }

  // Add legacy claimed codes that have no result entry
  for (const code of claimedCodes) {
    if (!seen.has(code)) {
      displayItems.push({
        code,
        status: "success",
        reason: "Redeemed (prior session)",
        redeemedAt: "",
      });
    }
  }

  const handleResetClaimed = () => {
    if (!settingsKey) return;

    const current = globalSettings as GlobalSettings;
    const updatedClaimed = { ...current.claimedCodes };
    const updatedResults = { ...current.redeemResults };
    delete updatedClaimed[settingsKey];
    delete updatedResults[settingsKey];

    saveGlobalSettings({ claimedCodes: updatedClaimed, redeemResults: updatedResults });
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

      {(account?.region ?? "global") === "cn" && (
        <p className="text-[11px] text-sd-secondary mt-1">
          MiYouShe does not provide a CN web redemption endpoint. Redeem gift codes in-game.
        </p>
      )}

      {/* Results list */}
      {displayItems.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sd-secondary uppercase tracking-wider">
              Redeemed Codes ({displayItems.length})
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
            {displayItems.map((result) => (
              <ResultRow key={result.code} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {uid && (account?.region ?? "global") !== "cn" && displayItems.length === 0 && (
        <p className="text-[11px] text-sd-secondary mt-2">
          No codes have been redeemed yet. Press the key to start.
        </p>
      )}
    </div>
  );
}
