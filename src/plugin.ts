import streamDeck from '@elgato/streamdeck';

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
} from './actions/genshin';

// Register all Genshin Impact actions
streamDeck.actions.registerAction(new ResinAction());
streamDeck.actions.registerAction(new CommissionAction());
streamDeck.actions.registerAction(new ExpeditionAction());
streamDeck.actions.registerAction(new TeapotAction());
streamDeck.actions.registerAction(new TransformerAction());
streamDeck.actions.registerAction(new AbyssAction());
streamDeck.actions.registerAction(new DailyRewardAction());
streamDeck.actions.registerAction(new BannerAction());

// Connect to Stream Deck
streamDeck.connect();
