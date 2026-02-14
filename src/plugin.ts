import streamDeck from '@elgato/streamdeck';

// Import services
import { registerAuthValidator } from '@/services/auth-validator';
import { migrateGlobalSettings } from '@/services/migration';

// Import all Genshin actions
import {
  ResinAction,
  CommissionAction,
  ExpeditionAction,
  TeapotAction,
  TransformerAction,
  AbyssAction,
  DailyRewardAction,
  BannerAction,
} from './actions/gi';

// Import Star Rail actions
import {
  StaminaAction as StarRailStaminaAction,
  BannerAction as StarRailBannerAction,
} from './actions/hsr';

// Register auth validation listener
registerAuthValidator();

// Run V1 → V2 migration on startup
void migrateGlobalSettings();

// Register all Genshin Impact actions
streamDeck.actions.registerAction(new ResinAction());
streamDeck.actions.registerAction(new CommissionAction());
streamDeck.actions.registerAction(new ExpeditionAction());
streamDeck.actions.registerAction(new TeapotAction());
streamDeck.actions.registerAction(new TransformerAction());
streamDeck.actions.registerAction(new AbyssAction());
streamDeck.actions.registerAction(new DailyRewardAction());
streamDeck.actions.registerAction(new BannerAction());

// Register all Honkai: Star Rail actions
streamDeck.actions.registerAction(new StarRailStaminaAction());
streamDeck.actions.registerAction(new StarRailBannerAction());

// Connect to Stream Deck
streamDeck.connect();
