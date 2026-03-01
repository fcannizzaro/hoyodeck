import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Select } from '../components/Select';
import { Checkbox } from '../components/Checkbox';
import { AccountPicker } from '../components/AccountPicker';
import type { GameId } from '@hoyodeck/shared/types';

interface EndgamePanelProps {
  game: GameId;
  heading: string;
  modeOptions: { value: string; label: string }[];
  defaultMode: string;
}

/**
 * Shared endgame panel — renders account picker and mode selector.
 */
function EndgamePanel({ game, heading, modeOptions, defaultMode }: EndgamePanelProps) {
  const { settings, saveSettings } = useStreamDeck();
  const mode = (settings.mode as string) ?? defaultMode;
  const showStars = (settings.showStars as boolean) ?? true;
  const showName = (settings.showName as boolean) ?? true;

  return (
    <div className="flex flex-col gap-2">
      <Heading>{heading}</Heading>
      <AccountPicker game={game} />
      <Select
        label="Mode"
        value={mode}
        options={modeOptions}
        info="Select which endgame mode to display."
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
    </div>
  );
}

/**
 * Genshin Impact Endgame panel — Spiral Abyss / Imaginarium Theater / Stygian Onslaught
 */
export function GenshinEndgamePanel() {
  return (
    <EndgamePanel
      game="gi"
      heading="Endgame Settings"
      defaultMode="spiral-abyss"
      modeOptions={[
        { value: 'spiral-abyss', label: 'Spiral Abyss' },
        { value: 'imaginarium-theater', label: 'Imaginarium Theater' },
        { value: 'stygian-onslaught', label: 'Stygian Onslaught' },
      ]}
    />
  );
}

/**
 * Star Rail Endgame panel — MoC / Pure Fiction / Apocalyptic Shadow / Anomaly Arbitration
 */
export function StarRailEndgamePanel() {
  return (
    <EndgamePanel
      game="hsr"
      heading="Endgame Settings"
      defaultMode="memory-of-chaos"
      modeOptions={[
        { value: 'memory-of-chaos', label: 'Memory of Chaos' },
        { value: 'pure-fiction', label: 'Pure Fiction' },
        { value: 'apocalyptic-shadow', label: 'Apocalyptic Shadow' },
        { value: 'anomaly-arbitration', label: 'Anomaly Arbitration' },
      ]}
    />
  );
}

/**
 * ZZZ Endgame panel — Shiyu Defense / Deadly Assault
 */
export function ZZZEndgamePanel() {
  return (
    <EndgamePanel
      game="zzz"
      heading="Endgame Settings"
      defaultMode="shiyu-defense"
      modeOptions={[
        { value: 'shiyu-defense', label: 'Shiyu Defense' },
        { value: 'deadly-assault', label: 'Deadly Assault' },
      ]}
    />
  );
}
