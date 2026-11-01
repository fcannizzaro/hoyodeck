import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Select } from "../components/Select";
import type { GameId } from "@hoyodeck/shared/types";

const GAME_OPTIONS = [
  { value: "gi", label: "Genshin Impact" },
  { value: "hsr", label: "Honkai: Star Rail" },
  { value: "zzz", label: "Zenless Zone Zero" },
];

export function RedeemCodePanel() {
  const { settings, saveSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? "gi";

  return (
    <div className="flex flex-col gap-2">
      <Heading>Redeem Code Settings</Heading>
      <Select
        label="Game"
        value={game}
        options={GAME_OPTIONS}
        onChange={(value) => saveSettings({ game: value })}
      />
      <p className="text-[11px] text-sd-secondary mt-2">
        Press the key to view all available codes. Choose Redeem beside a code to open the official
        website in your browser, then sign in and confirm redemption there. You can also copy a code
        and redeem it in-game. No plugin account is required.
      </p>
    </div>
  );
}
