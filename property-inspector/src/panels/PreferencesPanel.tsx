import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Checkbox } from "../components/Checkbox";

const BANNER_ACTIONS = new Set([
  "com.fcannizzaro.hoyodeck.banner",
  "com.fcannizzaro.hoyodeck.genshin.banner",
  "com.fcannizzaro.hoyodeck.hsr.banner",
  "com.fcannizzaro.hoyodeck.zzz.banner",
]);

/**
 * Global preferences panel shown on every action's Property Inspector.
 * Settings are stored in globalSettings and affect all actions.
 */
export function PreferencesPanel() {
  const { actionInfo, settings, globalSettings, saveSettings, saveGlobalSettings } =
    useStreamDeck();
  const isBannerAction = actionInfo ? BANNER_ACTIONS.has(actionInfo.action) : false;
  const alwaysBlink = (settings.alwaysBlink as boolean) ?? false;
  const disableAnimations = (globalSettings.disableAnimations as boolean) ?? false;

  return (
    <div className="flex flex-col gap-2">
      <Heading>Preferences</Heading>
      <Checkbox
        label="Disable Animations"
        checked={disableAnimations}
        info="Show static images instead of animated icons. Reduces CPU usage."
        onChange={(checked) => saveGlobalSettings({ disableAnimations: checked })}
      />
      {isBannerAction ? (
        <Checkbox
          label="Always Blink"
          checked={alwaysBlink}
          info="Keep banner eye blinking active even when animations are globally disabled."
          onChange={(checked) => saveSettings({ alwaysBlink: checked })}
        />
      ) : null}
    </div>
  );
}
