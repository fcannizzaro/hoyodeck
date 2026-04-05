import { useStreamDeck } from "./hooks/use-stream-deck";
import { AccountPanel } from "./panels/AccountPanel";
import { AccountPicker } from "./components/AccountPicker";
import { Footer } from "./components/Footer";
import { Heading } from "./components/Heading";
import { BannerPanel, HSRBannerPanel, ZZZBannerPanel } from "./panels/BannerPanel";
import { DailyRewardPanel } from "./panels/DailyRewardPanel";
import { RedeemCodePanel } from "./panels/RedeemCodePanel";
import { TransformerPanel } from "./panels/TransformerPanel";
import { GenshinEndgamePanel, StarRailEndgamePanel, ZZZEndgamePanel } from "./panels/EndgamePanel";
import { StaminaOverviewPanel } from "./panels/StaminaOverviewPanel";
import { WishTrackerPanel } from "./panels/WishTrackerPanel";
import { PatchCountdownPanel } from "./panels/PatchCountdownPanel";
import { PreferencesPanel } from "./panels/PreferencesPanel";
import type { GameId, HoyoAccountInfo } from "@hoyodeck/shared/types";

/** Actions that have their own custom settings panel (includes AccountPicker inside) */
const ACTION_PANELS: Record<string, React.ComponentType> = {
  "com.fcannizzaro.hoyodeck.genshin.banner": BannerPanel,
  "com.fcannizzaro.hoyodeck.genshin.daily-reward": DailyRewardPanel,
  "com.fcannizzaro.hoyodeck.genshin.transformer": TransformerPanel,
  "com.fcannizzaro.hoyodeck.genshin.abyss": GenshinEndgamePanel,
  "com.fcannizzaro.hoyodeck.hsr.banner": HSRBannerPanel,
  "com.fcannizzaro.hoyodeck.hsr.endgame": StarRailEndgamePanel,
  "com.fcannizzaro.hoyodeck.zzz.banner": ZZZBannerPanel,
  "com.fcannizzaro.hoyodeck.zzz.endgame": ZZZEndgamePanel,
  "com.fcannizzaro.hoyodeck.redeem-code": RedeemCodePanel,
  "com.fcannizzaro.hoyodeck.stamina-overview": StaminaOverviewPanel,
  "com.fcannizzaro.hoyodeck.wish-tracker": WishTrackerPanel,
  "com.fcannizzaro.hoyodeck.patch-countdown": PatchCountdownPanel,
};

/** Actions without a custom panel — show a default AccountPicker with game filter */
const DEFAULT_GAME_FILTER: Record<string, GameId> = {
  "com.fcannizzaro.hoyodeck.genshin.resin": "gi",
  "com.fcannizzaro.hoyodeck.genshin.commission": "gi",
  "com.fcannizzaro.hoyodeck.genshin.expedition": "gi",
  "com.fcannizzaro.hoyodeck.genshin.teapot": "gi",
  "com.fcannizzaro.hoyodeck.hsr.trailblaze-power": "hsr",
  "com.fcannizzaro.hoyodeck.zzz.battery-charge": "zzz",
};

export default function App() {
  const { actionInfo, globalSettings } = useStreamDeck();

  if (!actionInfo) {
    return <div className="p-3 text-xs text-sd-secondary">Connecting...</div>;
  }

  const accounts = (globalSettings.accounts ?? {}) as Record<string, HoyoAccountInfo>;
  const hasAccounts = Object.keys(accounts).length > 0;

  // No accounts → show ONLY AccountPanel (login button)
  if (!hasAccounts) {
    return (
      <div className="flex flex-col gap-4 p-3 bg-sd-bg text-sd-text text-xs leading-relaxed font-sans min-h-screen">
        <AccountPanel />
        <Footer />
      </div>
    );
  }

  const ActionPanel = ACTION_PANELS[actionInfo.action];
  const defaultGame = DEFAULT_GAME_FILTER[actionInfo.action];

  // Check if the default AccountPicker would actually render (needs 2+ matching accounts)
  const gameAccounts = defaultGame
    ? Object.values(accounts).filter((a) => a.uids?.[defaultGame] !== undefined)
    : [];
  const showDefaultSection = defaultGame !== undefined && gameAccounts.length > 1;

  return (
    <div className="flex flex-col gap-4 p-3 bg-sd-bg text-sd-text text-xs leading-relaxed font-sans min-h-screen">
      {ActionPanel ? (
        <ActionPanel />
      ) : showDefaultSection ? (
        <div className="flex flex-col gap-2">
          <Heading>Action Settings</Heading>
          <AccountPicker game={defaultGame} />
        </div>
      ) : null}
      <PreferencesPanel />
      <AccountPanel />
      <Footer />
    </div>
  );
}
