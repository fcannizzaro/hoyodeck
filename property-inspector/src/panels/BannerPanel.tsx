import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Select } from '../components/Select';
import { AccountPicker } from '../components/AccountPicker';

const BANNER_OPTIONS = [
  { value: 'character', label: 'Character Event Wish' },
  { value: 'weapon', label: 'Weapon Event Wish' },
];

export function BannerPanel() {
  const { settings, saveSettings } = useStreamDeck();
  const type = (settings.type as string) ?? 'character';

  return (
    <>
      <Heading>Banner Settings</Heading>
      <AccountPicker />
      <Select
        label="Banner Type"
        value={type}
        options={BANNER_OPTIONS}
        info="Select which type of wish banner to display."
        onChange={(value) => saveSettings({ type: value })}
      />
    </>
  );
}
