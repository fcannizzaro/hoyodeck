import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Select } from "../components/Select";
import { Checkbox } from "../components/Checkbox";
import { AccountPicker } from "../components/AccountPicker";
import type { GameId } from "@hoyodeck/shared/types";

const GAME_OPTIONS = [
  { value: "gi", label: "Genshin Impact" },
  { value: "hsr", label: "Honkai: Star Rail" },
  { value: "zzz", label: "Zenless Zone Zero" },
];

export function RedeemCodePanel() {
  const { settings, saveSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? "gi";
  const autoRedeem = (settings.autoRedeem as boolean) ?? true;

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
      <Checkbox
        label="Auto-redeem on press"
        checked={autoRedeem}
        info="When enabled, pressing the button automatically redeems the next available code. Requires the manager to be running."
        onChange={(checked) => saveSettings({ autoRedeem: checked })}
      />
    </div>
  );
}
