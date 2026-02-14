import { useStreamDeck } from './hooks/use-stream-deck';
import { AuthPanel } from './panels/AuthPanel';
import { BannerPanel } from './panels/BannerPanel';
import { DailyRewardPanel } from './panels/DailyRewardPanel';
import { TransformerPanel } from './panels/TransformerPanel';

const ACTION_PANELS: Record<string, React.ComponentType> = {
  'com.fcannizzaro.hoyodeck.genshin.banner': BannerPanel,
  'com.fcannizzaro.hoyodeck.genshin.daily-reward': DailyRewardPanel,
  'com.fcannizzaro.hoyodeck.genshin.transformer': TransformerPanel,
};

export default function App() {
  const { actionInfo } = useStreamDeck();

  if (!actionInfo) {
    return (
      <div className="p-3 text-xs text-sd-secondary">Connecting...</div>
    );
  }

  const ActionPanel = ACTION_PANELS[actionInfo.action];

  return (
    <div className="flex flex-col gap-4 p-3 bg-sd-bg text-sd-text text-xs leading-relaxed font-sans min-h-screen">
      {ActionPanel && (
        <>
          <ActionPanel />
          <div className="h-px bg-sd-border" />
        </>
      )}
      <AuthPanel />
    </div>
  );
}
