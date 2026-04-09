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

const MODE_OPTIONS: Record<GameId, { value: string; label: string }[]> = {
  gi: [
    { value: "spiral-abyss", label: "Spiral Abyss" },
    { value: "imaginarium-theater", label: "Imaginarium Theater" },
    { value: "stygian-onslaught", label: "Stygian Onslaught" },
  ],
  hsr: [
    { value: "memory-of-chaos", label: "Memory of Chaos" },
    { value: "pure-fiction", label: "Pure Fiction" },
    { value: "apocalyptic-shadow", label: "Apocalyptic Shadow" },
    { value: "anomaly-arbitration", label: "Anomaly Arbitration" },
  ],
  zzz: [
    { value: "shiyu-defense", label: "Shiyu Defense" },
    { value: "deadly-assault", label: "Deadly Assault" },
  ],
};

const ENDING_SOONEST_OPTION = { value: "ending-soonest", label: "Ending Soonest" };
const DEFAULT_MODE = "ending-soonest";

interface EndgamePanelBaseProps {
  game: GameId;
  modeOptions: { value: string; label: string }[];
}

/**
 * Shared endgame panel base — renders account picker and mode selector.
 */
function EndgamePanelBase({ game, modeOptions }: EndgamePanelBaseProps) {
  const { settings, saveSettings } = useStreamDeck();
  const mode = (settings.mode as string) ?? DEFAULT_MODE;
  const showStars = (settings.showStars as boolean) ?? true;
  const showName = (settings.showName as boolean) ?? true;

  const allOptions = [...modeOptions, ENDING_SOONEST_OPTION];

  return (
    <>
      <AccountPicker game={game} />
      <Select
        label="Mode"
        value={mode}
        options={allOptions}
        info="Select which endgame mode to display. 'Ending Soonest' automatically shows the one closest to resetting."
        onChange={(value) => saveSettings({ mode: value })}
      />
      <Checkbox
        label="Show Stars"
        checked={showStars}
        onChange={(checked) => saveSettings({ showStars: checked })}
      />
      <Checkbox
        label="Show Name"
        checked={showName}
        onChange={(checked) => saveSettings({ showName: checked })}
      />
    </>
  );
}

/**
 * Unified endgame panel — game picker + account picker + mode selector.
 */
export function UnifiedEndgamePanel() {
  const { settings, saveSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? "gi";

  return (
    <div className="flex flex-col gap-2">
      <Heading>Endgame Settings</Heading>
      <Select
        label="Game"
        value={game}
        options={GAME_OPTIONS}
        onChange={(value) => saveSettings({ game: value, mode: undefined })}
      />
      <EndgamePanelBase game={game} modeOptions={MODE_OPTIONS[game]} />
    </div>
  );
}

/**
 * Genshin Impact Endgame panel — Spiral Abyss / Imaginarium Theater / Stygian Onslaught
 */
export function GenshinEndgamePanel() {
  return (
    <div className="flex flex-col gap-2">
      <Heading>Endgame Settings</Heading>
      <EndgamePanelBase game="gi" modeOptions={MODE_OPTIONS.gi} />
    </div>
  );
}

/**
 * Star Rail Endgame panel — MoC / Pure Fiction / Apocalyptic Shadow / Anomaly Arbitration
 */
export function StarRailEndgamePanel() {
  return (
    <div className="flex flex-col gap-2">
      <Heading>Endgame Settings</Heading>
      <EndgamePanelBase game="hsr" modeOptions={MODE_OPTIONS.hsr} />
    </div>
  );
}

/**
 * ZZZ Endgame panel — Shiyu Defense / Deadly Assault
 */
export function ZZZEndgamePanel() {
  return (
    <div className="flex flex-col gap-2">
      <Heading>Endgame Settings</Heading>
      <EndgamePanelBase game="zzz" modeOptions={MODE_OPTIONS.zzz} />
    </div>
  );
}
