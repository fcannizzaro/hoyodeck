import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings } from "@hoyodeck/shared/types";

// Re-export shared types used within the plugin
export type {
  HoyoAuth,
  AccountId,
  HoyoAccount,
  GameId,
  BannerBadgeOptions,
  GlobalSettings,
  GameActionSettings,
  GenshinActionSettings,
  GenshinEndgameSettings,
  BannerSettings,
  DailyRewardSettings,
  TransformerSettings,
  StarRailActionSettings,
  StarRailEndgameSettings,
  StarRailBannerSettings,
  ZZZActionSettings,
  ZZZEndgameSettings,
  ZZZBannerSettings,
  RedeemCodeSettings,
} from "@hoyodeck/shared/types";

/** Cast GlobalSettings to JsonObject for SDK calls */
export function toJsonObject(settings: GlobalSettings): JsonObject {
  return settings as unknown as JsonObject;
}
