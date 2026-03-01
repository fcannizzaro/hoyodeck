import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Select } from '../components/Select';
import { AccountPicker } from '../components/AccountPicker';
import type { GameId } from '@hoyodeck/shared/types';

const GAME_OPTIONS = [
  { value: 'gi', label: 'Genshin Impact' },
  { value: 'hsr', label: 'Honkai: Star Rail' },
  { value: 'zzz', label: 'Zenless Zone Zero' },
];

export function RedeemCodePanel() {
  const { settings, saveSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? 'gi';

  return (
    <>
      <Heading>Redeem Code Settings</Heading>
      <Select
        label="Game"
        value={game}
        options={GAME_OPTIONS}
        onChange={(value) => saveSettings({ game: value })}
      />
      <AccountPicker game={game} />
    </>
  );
}
