import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Select } from '../components/Select';

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
