import { useState } from "react";
import { useStreamDeck } from "./hooks/use-stream-deck";
import { AccountPanel } from "./panels/AccountPanel";
import { AccountPicker } from "./components/AccountPicker";
import { Footer } from "./components/Footer";
import { Heading } from "./components/Heading";
import { Sidebar, SlidersIcon, CogIcon, UsersIcon, type SidebarItem } from "./components/Sidebar";
import { StaminaPanel } from "./panels/StaminaPanel";
import {
  UnifiedBannerPanel,
  BannerPanel,
  HSRBannerPanel,
  ZZZBannerPanel,
} from "./panels/BannerPanel";
import { DailyRewardPanel } from "./panels/DailyRewardPanel";
import { RedeemCodePanel } from "./panels/RedeemCodePanel";
import { TransformerPanel } from "./panels/TransformerPanel";
import {
  UnifiedEndgamePanel,
  GenshinEndgamePanel,
  StarRailEndgamePanel,
  ZZZEndgamePanel,
} from "./panels/EndgamePanel";
import { StaminaOverviewPanel } from "./panels/StaminaOverviewPanel";
import { WishTrackerPanel } from "./panels/WishTrackerPanel";
import { PatchCountdownPanel } from "./panels/PatchCountdownPanel";
import { PreferencesPanel } from "./panels/PreferencesPanel";
import type { GameId, HoyoAccountInfo } from "@hoyodeck/shared/types";

/** Actions that have their own custom settings panel (includes AccountPicker inside) */
const ACTION_PANELS: Record<string, React.ComponentType> = {
  // Unified multi-game actions
  "com.fcannizzaro.hoyodeck.stamina": StaminaPanel,
  "com.fcannizzaro.hoyodeck.endgame": UnifiedEndgamePanel,
  "com.fcannizzaro.hoyodeck.banner": UnifiedBannerPanel,
  // Legacy per-game actions (kept for backward compatibility)
  "com.fcannizzaro.hoyodeck.genshin.banner": BannerPanel,
  "com.fcannizzaro.hoyodeck.genshin.abyss": GenshinEndgamePanel,
  "com.fcannizzaro.hoyodeck.hsr.banner": HSRBannerPanel,
  "com.fcannizzaro.hoyodeck.hsr.endgame": StarRailEndgamePanel,
  "com.fcannizzaro.hoyodeck.zzz.banner": ZZZBannerPanel,
  "com.fcannizzaro.hoyodeck.zzz.endgame": ZZZEndgamePanel,
  // Other actions with custom panels
  "com.fcannizzaro.hoyodeck.genshin.daily-reward": DailyRewardPanel,
  "com.fcannizzaro.hoyodeck.genshin.transformer": TransformerPanel,
  "com.fcannizzaro.hoyodeck.redeem-code": RedeemCodePanel,
  "com.fcannizzaro.hoyodeck.stamina-overview": StaminaOverviewPanel,
  "com.fcannizzaro.hoyodeck.wish-tracker": WishTrackerPanel,
  "com.fcannizzaro.hoyodeck.patch-countdown": PatchCountdownPanel,
};

/** Actions without a custom panel — show a default AccountPicker with game filter */
const DEFAULT_GAME_FILTER: Record<string, GameId> = {
  "com.fcannizzaro.hoyodeck.genshin.commission": "gi",
  "com.fcannizzaro.hoyodeck.genshin.expedition": "gi",
  "com.fcannizzaro.hoyodeck.genshin.teapot": "gi",
};

// ─── Sidebar section IDs ──────────────────────────────────────────

type SectionId = "settings" | "preferences" | "accounts";

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "settings", label: "Settings", icon: <SlidersIcon /> },
  { id: "preferences", label: "Preferences", icon: <CogIcon /> },
  { id: "accounts", label: "Accounts", icon: <UsersIcon /> },
];

/** Actions that use animations (blink, float, scroll, countdown tick) and need the Preferences tab */
const ANIMATED_ACTIONS = new Set([
  // Banner (blink animation)
  "com.fcannizzaro.hoyodeck.banner",
  "com.fcannizzaro.hoyodeck.genshin.banner",
  "com.fcannizzaro.hoyodeck.hsr.banner",
  "com.fcannizzaro.hoyodeck.zzz.banner",
  // Endgame (scroll animation)
  "com.fcannizzaro.hoyodeck.endgame",
  "com.fcannizzaro.hoyodeck.genshin.abyss",
  "com.fcannizzaro.hoyodeck.hsr.endgame",
  "com.fcannizzaro.hoyodeck.zzz.endgame",
  // GI-specific (float / blink / countdown tick)
  "com.fcannizzaro.hoyodeck.genshin.commission",
  "com.fcannizzaro.hoyodeck.genshin.teapot",
  "com.fcannizzaro.hoyodeck.genshin.expedition",
]);

// ─── App ──────────────────────────────────────────────────────────

export default function App() {
  const { actionInfo, globalSettings } = useStreamDeck();
  const [activeSection, setActiveSection] = useState<SectionId>("settings");

  if (!actionInfo) {
    return <div className="p-3 text-xs text-sd-secondary">Connecting...</div>;
  }

  const accounts = (globalSettings.accounts ?? {}) as Record<string, HoyoAccountInfo>;
  const hasAccounts = Object.keys(accounts).length > 0;

  // No accounts → show ONLY AccountPanel (no sidebar, full width)
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

  // Determine which sidebar items to show
  const hasSettingsContent = ActionPanel !== undefined || showDefaultSection;
  const hasAnimations = ANIMATED_ACTIONS.has(actionInfo.action);
  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (item.id === "settings" && !hasSettingsContent) return false;
    if (item.id === "preferences" && !hasAnimations) return false;
    return true;
  });

  // If the active tab was removed, fall back to the first visible tab
  const effectiveSection = visibleItems.some((item) => item.id === activeSection)
    ? activeSection
    : ((visibleItems[0]?.id as SectionId) ?? "accounts");

  return (
    <div className="flex bg-sd-bg text-sd-text text-xs leading-relaxed font-sans min-h-screen">
      {/* Sidebar rail */}
      <Sidebar
        items={visibleItems}
        activeId={effectiveSection}
        onChange={(id) => setActiveSection(id as SectionId)}
      />

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-3 overflow-y-auto">
          {effectiveSection === "settings" && (
            <>
              {ActionPanel ? (
                <ActionPanel />
              ) : showDefaultSection ? (
                <div className="flex flex-col gap-2">
                  <Heading>Action Settings</Heading>
                  <AccountPicker game={defaultGame} />
                </div>
              ) : null}
            </>
          )}
          {effectiveSection === "preferences" && <PreferencesPanel />}
          {effectiveSection === "accounts" && <AccountPanel />}
        </div>
        <div className="px-3 pb-1">
          <Footer />
        </div>
      </div>
    </div>
  );
}
