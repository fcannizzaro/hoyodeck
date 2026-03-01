import streamDeck from '@elgato/streamdeck';

// Import services
import { registerAuthValidator } from '@/services/auth-validator';
import { registerLoginHandler } from '@/services/hoyolab-login';
import { dataController } from '@/services/data-controller';

// Import all Genshin actions
import {
  ResinAction,
  CommissionAction,
  ExpeditionAction,
  TeapotAction,
  TransformerAction,
  GenshinEndgameAction,
  DailyRewardAction,
  BannerAction,
} from './actions/gi';

// Import Star Rail actions
import {
  StaminaAction as StarRailStaminaAction,
  StarRailEndgameAction,
  BannerAction as StarRailBannerAction,
} from './actions/hsr';

// Import ZZZ actions
import {
  BatteryChargeAction as ZZZBatteryChargeAction,
  ZZZEndgameAction,
  BannerAction as ZZZBannerAction,
} from './actions/zzz';

// Register auth validation listener
registerAuthValidator();

// Register webview login handler (clears stale state on first global settings receive)
registerLoginHandler();

// Initialize data controller (diff-based global settings listener)
dataController.init();

// Register all Genshin Impact actions
streamDeck.actions.registerAction(new ResinAction());
streamDeck.actions.registerAction(new CommissionAction());
streamDeck.actions.registerAction(new ExpeditionAction());
streamDeck.actions.registerAction(new TeapotAction());
streamDeck.actions.registerAction(new TransformerAction());
streamDeck.actions.registerAction(new GenshinEndgameAction());
streamDeck.actions.registerAction(new DailyRewardAction());
streamDeck.actions.registerAction(new BannerAction());

// Register all Honkai: Star Rail actions
streamDeck.actions.registerAction(new StarRailStaminaAction());
streamDeck.actions.registerAction(new StarRailEndgameAction());
streamDeck.actions.registerAction(new StarRailBannerAction());

// Register all Zenless Zone Zero actions
streamDeck.actions.registerAction(new ZZZBatteryChargeAction());
streamDeck.actions.registerAction(new ZZZEndgameAction());
streamDeck.actions.registerAction(new ZZZBannerAction());

// Connect to Stream Deck
streamDeck.connect();
