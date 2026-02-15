import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Checkbox } from '../components/Checkbox';

/**
 * Global preferences panel shown on every action's Property Inspector.
 * Settings are stored in globalSettings and affect all actions.
 */
export function PreferencesPanel() {
  const { globalSettings, saveGlobalSettings } = useStreamDeck();
  const disableAnimations = (globalSettings.disableAnimations as boolean) ?? false;

  return (
    <>
      <Heading>Preferences</Heading>
      <Checkbox
        label="Disable Animations"
        checked={disableAnimations}
        info="Show static images instead of animated icons. Reduces CPU usage."
        onChange={(checked) =>
          saveGlobalSettings({ disableAnimations: checked })
        }
      />
    </>
  );
}
