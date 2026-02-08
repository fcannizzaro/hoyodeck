import { z } from 'zod';
import type { JsonValue } from '@elgato/utils';

/**
 * V2 Authentication schema
 */
export const HoyoAuthSchema = z.object({
  ltoken_v2: z.string().min(1),
  ltuid_v2: z.string().min(1),
  ltmid_v2: z.string().min(1),
  cookie_token_v2: z.string().optional(),
  account_mid_v2: z.string().optional(),
  account_id_v2: z.string().optional(),
});

export type HoyoAuth = z.infer<typeof HoyoAuthSchema>;

/**
 * Global plugin settings stored by Stream Deck
 */
export interface GlobalSettings {
  auth?: HoyoAuth;
  uid?: string;
}

/**
 * Base settings for Genshin actions
 */
export interface GenshinActionSettings {
  uid?: string;
  [key: string]: JsonValue;
}

/**
 * Banner action settings
 */
export interface BannerSettings extends GenshinActionSettings {
  type?: 'character' | 'weapon';
}

/**
 * Daily reward action settings
 */
export interface DailyRewardSettings extends GenshinActionSettings {
  claimOnClick?: boolean;
}

/**
 * Transformer action settings
 */
export interface TransformerSettings extends GenshinActionSettings {
  style?: 'icon' | 'text';
}
