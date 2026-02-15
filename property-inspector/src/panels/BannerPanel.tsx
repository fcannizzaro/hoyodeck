import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Select } from '../components/Select';
import { NumberInput } from '../components/NumberInput';
import { AccountPicker } from '../components/AccountPicker';

const BANNER_OPTIONS = [
  { value: 'character', label: 'Character Event Wish' },
  { value: 'weapon', label: 'Weapon Event Wish' },
];

const BADGE_POSITION_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const BADGE_LAYOUT_OPTIONS = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
];

export function BannerPanel() {
  const {
    settings,
    saveSettings,
    globalSettings,
    saveGlobalSettings,
    sendToPlugin,
  } = useStreamDeck();
  const type = (settings.type as string) ?? 'character';
  const badgePosition =
    (globalSettings.bannerBadgePosition as string) ?? 'center';
  const badgeLayout =
    (globalSettings.bannerBadgeLayout as string) ?? 'horizontal';
  const badgeFontSize =
    (globalSettings.bannerBadgeFontSize as number) ?? 18;

  /** Save a global badge setting and tell the plugin to refresh */
  const saveBadgeSetting = (payload: Record<string, unknown>) => {
    saveGlobalSettings(payload);
    sendToPlugin({ event: 'refresh' });
  };

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
      <Heading>Badge Style</Heading>
      <Select
        label="Layout"
        value={badgeLayout}
        options={BADGE_LAYOUT_OPTIONS}
        info="Horizontal places the badge along the bottom edge. Vertical places it along the side."
        onChange={(value) => saveBadgeSetting({ bannerBadgeLayout: value })}
      />
      <Select
        label="Position"
        value={badgePosition}
        options={BADGE_POSITION_OPTIONS}
        info="Badge alignment. For vertical layout, left/right controls which side edge."
        onChange={(value) => saveBadgeSetting({ bannerBadgePosition: value })}
      />
      <NumberInput
        label="Font Size"
        value={badgeFontSize}
        min={12}
        max={28}
        step={1}
        info="Adjust the countdown text size (default: 18)."
        onChange={(value) => saveBadgeSetting({ bannerBadgeFontSize: value })}
      />
    </>
  );
}
