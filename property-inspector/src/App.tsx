import { useStreamDeck } from './hooks/use-stream-deck';
import { AccountPanel } from './panels/AccountPanel';
import { AccountPicker } from './components/AccountPicker';
import { Heading } from './components/Heading';
import { BannerPanel } from './panels/BannerPanel';
import { DailyRewardPanel } from './panels/DailyRewardPanel';
import { TransformerPanel } from './panels/TransformerPanel';
import { PreferencesPanel } from './panels/PreferencesPanel';
import type { GameId } from '@hoyodeck/shared/types';

/** Actions that have their own custom settings panel (includes AccountPicker inside) */
const ACTION_PANELS: Record<string, React.ComponentType> = {
  'com.fcannizzaro.hoyodeck.genshin.banner': BannerPanel,
  'com.fcannizzaro.hoyodeck.genshin.daily-reward': DailyRewardPanel,
  'com.fcannizzaro.hoyodeck.genshin.transformer': TransformerPanel,
};

/** Actions without a custom panel — show a default AccountPicker with game filter */
const DEFAULT_GAME_FILTER: Record<string, GameId> = {
  'com.fcannizzaro.hoyodeck.gi.resin': 'gi',
  'com.fcannizzaro.hoyodeck.gi.commission': 'gi',
  'com.fcannizzaro.hoyodeck.gi.expedition': 'gi',
  'com.fcannizzaro.hoyodeck.gi.teapot': 'gi',
  'com.fcannizzaro.hoyodeck.gi.abyss': 'gi',
  'com.fcannizzaro.hoyodeck.hsr.trailblaze-power': 'hsr',
  'com.fcannizzaro.hoyodeck.hsr.banner': 'hsr',
  'com.fcannizzaro.hoyodeck.zzz.battery-charge': 'zzz',
  'com.fcannizzaro.hoyodeck.zzz.banner': 'zzz',
};

export default function App() {
  const { actionInfo } = useStreamDeck();

  if (!actionInfo) {
    return (
      <div className="p-3 text-xs text-sd-secondary">Connecting...</div>
    );
  }

  const ActionPanel = ACTION_PANELS[actionInfo.action];
  const defaultGame = DEFAULT_GAME_FILTER[actionInfo.action];

  return (
    <div className="flex flex-col gap-4 p-3 bg-sd-bg text-sd-text text-xs leading-relaxed font-sans min-h-screen">
      {ActionPanel ? (
        <>
          <ActionPanel />
          <div className="h-px bg-sd-border" />
        </>
      ) : defaultGame !== undefined ? (
        <>
          <Heading>Action Settings</Heading>
          <AccountPicker game={defaultGame} />
          <div className="h-px bg-sd-border" />
        </>
      ) : null}
      <PreferencesPanel />
      <div className="h-px bg-sd-border" />
      <AccountPanel />
    </div>
  );
}
