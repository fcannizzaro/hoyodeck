import { useState } from "react";
import {
  useKeyDown,
  useSettings,
  useGlobalSettings,
  useInterval,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings, BannerBadgeOptions, GameId } from "@hoyodeck/shared/types";
import type { AccountContextValue } from "@/contexts/account-context";
import { readLocalImageAsDataUri } from "@/utils/image";
import { useImageDataUri } from "@/hooks/use-image-data-uri";
import { formatCountdownFromSeconds } from "@/utils/banner";
import { PlaceholderKey } from "@/components/placeholder-key";
import { BannerBadge } from "@/components/banner-badge";

// ─── Types ────────────────────────────────────────────────────────

export interface BannerItem {
  icon: string;
  name?: string;
  countdownSeconds: number;
}

/** Minimal settings shape used by the shared component for index cycling and blink */
interface BannerCycleSettings {
  bannerIndex?: number;
  alwaysBlink?: boolean;
  [key: string]: unknown;
}

export interface BannerKeyProps {
  game: GameId;
  account: AccountContextValue;
  /** Items for the currently selected banner type (character/weapon) */
  items: BannerItem[];
  requestUpdate: () => Promise<void>;
  /** Icon overlay positioning and dimensions (varies per game) */
  iconStyle: { top: number; left: number; width: number; height: number };
}

// ─── Pre-loaded backgrounds ───────────────────────────────────────

const BG_DATA_URIS: Record<GameId, string> = {
  gi: readLocalImageAsDataUri("imgs/actions/gi/5-star.png"),
  hsr: readLocalImageAsDataUri("imgs/actions/hsr/5-star.png"),
  zzz: readLocalImageAsDataUri("imgs/actions/zzz/5-star.png"),
};

// ─── Blink animation ─────────────────────────────────────────────

const TOTAL_FRAMES = 30;
const BLINK_START = 12;
const BLINK_END = 15;

const BLINK_FRAMES: ReadonlyArray<boolean> = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => i >= BLINK_START && i <= BLINK_END,
);

/**
 * Convert a character name to a slug for file lookup.
 * e.g. "Raiden Shogun" -> "raiden-shogun"
 */
const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

/**
 * Build the codes-server URL for a character's closed-eyes avatar.
 */
const getClosedEyesUrl = (game: GameId, name: string): string =>
  `${__CODE_SERVER_URL__}/avatars/${game}/${toSlug(name)}.png`;

// ─── Component ────────────────────────────────────────────────────

/**
 * Shared banner key component used by all three games.
 *
 * Handles settings cycling, remote icon fetching, badge rendering,
 * and placeholder/loading states. Each game provides only:
 * - the resolved account + data items (via useGameData in the wrapper)
 * - the icon overlay style (position + dimensions differ per game)
 */
export function BannerKey({ game, account, items, requestUpdate, iconStyle }: BannerKeyProps) {
  const [settings, setSettings] = useSettings<BannerCycleSettings & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();
  const [frameIndex, setFrameIndex] = useState(0);

  const bgDataUri = BG_DATA_URIS[game];
  const bannerIndex = settings.bannerIndex ?? 0;
  const currentItem = items.length > 0 ? items[bannerIndex % items.length] : null;

  const badge: BannerBadgeOptions = {
    position: globalSettings.bannerBadgePosition ?? "center",
    layout: globalSettings.bannerBadgeLayout ?? "horizontal",
    fontSize: globalSettings.bannerBadgeFontSize ?? 18,
  };

  // Fetch remote icon and closed-eyes avatar via React Query
  const iconDataUri = useImageDataUri(currentItem?.icon ?? null);
  const closedEyesUrl = currentItem?.name ? getClosedEyesUrl(game, currentItem.name) : null;
  const closedDataUri = useImageDataUri(closedEyesUrl);

  // Determine if blink animation should run
  const animationsDisabled = globalSettings.disableAnimations ?? false;
  const alwaysBlink = settings.alwaysBlink ?? false;
  const shouldAnimate = closedDataUri !== null && (!animationsDisabled || alwaysBlink);

  // Blink animation loop
  useInterval(() => setFrameIndex((i) => (i + 1) % TOTAL_FRAMES), shouldAnimate ? 100 : null);

  // Cycle banner on key press
  useKeyDown(() => {
    setSettings({ bannerIndex: bannerIndex + 1 });
    void requestUpdate();
  });

  // ─── Placeholder ────────────────────────────────────────────

  if (account.status !== "resolved") {
    return <PlaceholderKey game={game} status={account.status} />;
  }

  // ─── Loading ────────────────────────────────────────────────

  if (!currentItem || !iconDataUri) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={bgDataUri} width={144} height={144} />
      </div>
    );
  }

  // ─── Banner ─────────────────────────────────────────────────

  const countdown = formatCountdownFromSeconds(currentItem.countdownSeconds);
  const blink = shouldAnimate && BLINK_FRAMES[frameIndex % BLINK_FRAMES.length];
  const charSrc = blink ? closedDataUri! : iconDataUri;

  return (
    <div className="relative w-full h-full">
      <img src={bgDataUri} width={144} height={144} />
      <div className="absolute" style={iconStyle}>
        <img src={charSrc} width={iconStyle.width} height={iconStyle.height} />
      </div>
      <BannerBadge text={countdown} options={badge} />
    </div>
  );
}
