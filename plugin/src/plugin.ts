import { createPlugin } from "@fcannizzaro/streamdeck-react";

// Import theme stylesheet (Tailwind v4 CSS with @theme tokens)
import stylesheet from "./theme.css?inline";

// Import services
import { registerAuthValidator } from "@/services/auth-validator";
import { registerLoginHandler } from "@/services/hoyolab-login";
import { dataController } from "@/services/data-controller";

// Import plugin-level wrapper (provides QueryClientProvider to all action roots)
import { PluginWrapper } from "@/contexts/plugin-wrapper.tsx";

// Import React actions — Genshin Impact (game-specific)
import { commissionAction } from "./actions/gi/commission.tsx";
import { expeditionAction } from "./actions/gi/expedition.tsx";
import { teapotAction } from "./actions/gi/teapot.tsx";
import { transformerAction } from "./actions/gi/transformer.tsx";

// Import React actions — Common (multi-game)
import { staminaAction } from "./actions/common/stamina.tsx";
import { endgameAction } from "./actions/common/endgame.tsx";
import { bannerAction } from "./actions/common/banner.tsx";
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
  stylesheets: [stylesheet],
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
    // Multi-game (unified)
    staminaAction,
    bannerAction,
    endgameAction,
    dailyRewardAction,
    redeemCodeAction,
    staminaOverviewAction,
    wishTrackerAction,
    patchCountdownAction,
    // Genshin Impact (game-specific)
    commissionAction,
    expeditionAction,
    teapotAction,
    transformerAction,
  ],
});

// Connect to Stream Deck (replaces streamDeck.connect())
await plugin.connect();
