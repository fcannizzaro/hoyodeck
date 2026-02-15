import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Select } from '../components/Select';
import { AccountPicker } from '../components/AccountPicker';

const STYLE_OPTIONS = [
  { value: 'text', label: 'Text (Countdown)' },
  { value: 'icon', label: 'Icon Only' },
];

export function TransformerPanel() {
  const { settings, saveSettings } = useStreamDeck();
  const style = (settings.style as string) ?? 'text';

  return (
    <>
      <Heading>Transformer Settings</Heading>
      <AccountPicker game="gi" />
      <Select
        label="Display Style"
        value={style}
        options={STYLE_OPTIONS}
        info="Choose how to display the transformer status."
        onChange={(value) => saveSettings({ style: value })}
      />
    </>
  );
}
