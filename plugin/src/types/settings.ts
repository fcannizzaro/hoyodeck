import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings } from "@hoyodeck/shared/types";

// Re-export all shared types
export type {
  HoyoAuth,
  PartialHoyoAuth,
  AccountId,
  AuthStatus,
  HoyoAccount,
  HoyoAccountInfo,
  GameId,
  GameConfig,
  BannerBadgePosition,
  BannerBadgeLayout,
  BannerBadgeOptions,
  GlobalSettings,
  GameActionSettings,
  GenshinActionSettings,
  BannerSettings,
  DailyRewardSettings,
  TransformerSettings,
  StarRailActionSettings,
  StarRailBannerSettings,
  ZZZActionSettings,
  ZZZBannerSettings,
} from "@hoyodeck/shared/types";

export { HoyoAuthSchema } from "@hoyodeck/shared/types";

/** Cast GlobalSettings to JsonObject for SDK calls */
export function toJsonObject(settings: GlobalSettings): JsonObject {
  return settings as unknown as JsonObject;
}
