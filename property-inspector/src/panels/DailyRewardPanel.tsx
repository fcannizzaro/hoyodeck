import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Checkbox } from '../components/Checkbox';

export function DailyRewardPanel() {
  const { settings, saveSettings } = useStreamDeck();
  const claimOnClick = (settings.claimOnClick as boolean) ?? true;

  return (
    <>
      <Heading>Daily Reward Settings</Heading>
      <Checkbox
        label="Claim reward on click"
        checked={claimOnClick}
        info="When enabled, pressing the button will automatically claim the daily check-in reward."
        onChange={(checked) => saveSettings({ claimOnClick: checked })}
      />
    </>
  );
}
