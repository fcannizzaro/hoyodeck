import { createPlugin } from "@fcannizzaro/streamdeck-react";

// Import services
import { registerAuthValidator } from "@/services/auth-validator";
import { registerLoginHandler } from "@/services/hoyolab-login";
import { dataController } from "@/services/data-controller";

// Import plugin-level wrapper (provides QueryClientProvider to all action roots)
import { PluginWrapper } from "@/contexts/plugin-wrapper.tsx";

// Import React actions — Genshin Impact
import { genshinBannerAction } from "./actions/gi/banner.tsx";
import { resinAction } from "./actions/gi/resin.tsx";
import { commissionAction } from "./actions/gi/commission.tsx";
import { expeditionAction } from "./actions/gi/expedition.tsx";
import { teapotAction } from "./actions/gi/teapot.tsx";
import { transformerAction } from "./actions/gi/transformer.tsx";
import { genshinEndgameAction } from "./actions/gi/endgame.tsx";

// Import React actions — Honkai: Star Rail
import { trailblazePowerAction } from "./actions/hsr/trailblaze-power.tsx";
import { starRailBannerAction } from "./actions/hsr/banner.tsx";
import { starRailEndgameAction } from "./actions/hsr/endgame.tsx";

// Import React actions — Zenless Zone Zero
import { batteryChargeAction } from "./actions/zzz/battery-charge.tsx";
import { zzzBannerAction } from "./actions/zzz/banner.tsx";
import { zzzEndgameAction } from "./actions/zzz/endgame.tsx";

// Import React actions — Common
import { dailyRewardAction } from "./actions/common/daily-reward.tsx";
import { redeemCodeAction } from "./actions/common/redeem-code.tsx";
import { staminaOverviewAction } from "./actions/common/stamina-overview.tsx";
import { wishTrackerAction } from "./actions/common/wish-tracker.tsx";
import { patchCountdownAction } from "./actions/common/patch-countdown.tsx";

// Import font
import Inter from "@fontsource/inter/files/inter-latin-400-normal.woff";

// Register auth validation listener
registerAuthValidator();

// Register webview login handler (clears stale state on first global settings receive)
registerLoginHandler();

// Initialize data controller (diff-based global settings listener)
dataController.init();

// Create plugin with React renderer
const plugin = createPlugin({
  devtools: true,
  wrapper: PluginWrapper,
  fonts: [
    {
      name: "Inter",
      data: Inter,
      weight: 400 as const,
      style: "normal" as const,
    },
  ],
  actions: [
    // Genshin Impact
    resinAction,
    commissionAction,
    expeditionAction,
    teapotAction,
    transformerAction,
    genshinEndgameAction,
    genshinBannerAction,
    // Honkai: Star Rail
    trailblazePowerAction,
    starRailBannerAction,
    starRailEndgameAction,
    // Zenless Zone Zero
    batteryChargeAction,
    zzzBannerAction,
    zzzEndgameAction,
    // Common
    dailyRewardAction,
    redeemCodeAction,
    staminaOverviewAction,
    wishTrackerAction,
    patchCountdownAction,
  ],
});

// Connect to Stream Deck (replaces streamDeck.connect())
await plugin.connect();
