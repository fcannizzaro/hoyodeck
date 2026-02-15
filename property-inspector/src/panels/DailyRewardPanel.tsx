import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Select } from '../components/Select';
import { Checkbox } from '../components/Checkbox';
import { AccountPicker } from '../components/AccountPicker';
import type { GameId } from '@hoyodeck/shared/types';

const GAME_OPTIONS = [
  { value: 'gi', label: 'Genshin Impact' },
  { value: 'hsr', label: 'Honkai: Star Rail' },
  { value: 'zzz', label: 'Zenless Zone Zero' },
];

export function DailyRewardPanel() {
  const { settings, saveSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? 'gi';
  const claimOnClick = (settings.claimOnClick as boolean) ?? true;

  return (
    <>
      <Heading>Daily Reward Settings</Heading>
      <Select
        label="Game"
        value={game}
        options={GAME_OPTIONS}
        onChange={(value) => saveSettings({ game: value })}
      />
      <AccountPicker game={game} />
      <Checkbox
        label="Claim reward on click"
        checked={claimOnClick}
        info="When enabled, pressing the button will automatically claim the daily check-in reward."
        onChange={(checked) => saveSettings({ claimOnClick: checked })}
      />
    </>
  );
}
