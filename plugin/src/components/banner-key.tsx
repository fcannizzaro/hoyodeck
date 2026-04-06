import {
  useKeyDown,
  useSettings,
  useGlobalSettings,
  useTouchTap,
  useDialRotate,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings, BannerBadgeOptions, GameId } from "@hoyodeck/shared/types";
import type { AccountContextValue } from "@/contexts/account-context";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { useImageDataUri } from "@/hooks/use-image-data-uri";
import { useBlink } from "@/hooks/use-blink";
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

// ─── Background image paths ───────────────────────────────────────

const BG_PATHS: Record<GameId, string> = {
  gi: "imgs/actions/gi/5-star.png",
  hsr: "imgs/actions/hsr/5-star.png",
  zzz: "imgs/actions/zzz/5-star.png",
};

// ─── Blink animation ─────────────────────────────────────────────

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

// ─── Key dimensions ──────────────────────────────────────────────

const KEY_SIZE = 144;

// ─── Dial dimensions ─────────────────────────────────────────────

const DIAL_BG_SIZE = 100;
const DIAL_SCALE = DIAL_BG_SIZE / KEY_SIZE;

/** Scale a key icon style to fit the dial's 100×100 content area. */
function scaleIconForDial(keyStyle: BannerKeyProps["iconStyle"]) {
  return {
    top: Math.round(keyStyle.top * DIAL_SCALE),
    left: Math.round(keyStyle.left * DIAL_SCALE),
    width: Math.round(keyStyle.width * DIAL_SCALE),
    height: Math.round(keyStyle.height * DIAL_SCALE),
  };
}

// ─── Dial placeholder labels ─────────────────────────────────────

const DIAL_STATUS_LABELS: Record<Exclude<AccountContextValue["status"], "resolved">, string> = {
  "no-accounts": "Login",
  "no-uid": "Set UID",
  ambiguous: "Select Account",
};

// ─── Shared state hook ───────────────────────────────────────────

/**
 * Common state management for BannerKey.
 *
 * Handles settings, remote icon fetching, closed-eyes avatar,
 * blink animation, and countdown formatting for a single item.
 */
function useBannerState(game: GameId, items: BannerItem[]) {
  const [settings, setSettings] = useSettings<BannerCycleSettings & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  const bgDataUri = useLocalImageDataUri(BG_PATHS[game]);
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

  // Coordinated blink via the global blink coordinator
  const blink = useBlink(shouldAnimate);
  const charSrc = blink ? closedDataUri! : iconDataUri;
  const countdown = currentItem ? formatCountdownFromSeconds(currentItem.countdownSeconds) : null;

  return {
    bgDataUri,
    bannerIndex,
    currentItem,
    iconDataUri,
    charSrc,
    countdown,
    badge,
    setSettings,
  };
}

// ─── Key Component ────────────────────────────────────────────────

/**
 * Shared banner key component used by all three games.
 *
 * Handles settings cycling, remote icon fetching, badge rendering,
 * and placeholder/loading states. Each game provides only:
 * - the resolved account + data items (via useGameData in the wrapper)
 * - the icon overlay style (position + dimensions differ per game)
 */
export function BannerKey({ game, account, items, requestUpdate, iconStyle }: BannerKeyProps) {
  const {
    bgDataUri,
    bannerIndex,
    currentItem,
    iconDataUri,
    charSrc,
    countdown,
    badge,
    setSettings,
  } = useBannerState(game, items);

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
        <img src={bgDataUri} width={KEY_SIZE} height={KEY_SIZE} />
      </div>
    );
  }

  // ─── Banner ─────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full">
      <img src={bgDataUri} width={KEY_SIZE} height={KEY_SIZE} />
      <div className="absolute" style={iconStyle}>
        <img src={charSrc!} width={iconStyle.width} height={iconStyle.height} />
      </div>
      <BannerBadge text={countdown!} options={badge} />
    </div>
  );
}

// ─── Dial Slot Component ─────────────────────────────────────────

interface BannerDialSlotProps {
  game: GameId;
  item: BannerItem;
  iconStyle: BannerKeyProps["iconStyle"];
  shouldAnimate: boolean;
  badge: BannerBadgeOptions;
}

/**
 * A single item slot within the dial display.
 *
 * Handles its own icon fetching, blink animation, and countdown badge.
 * Renders at 100×100 (the encoder display height).
 */
function BannerDialSlot({ game, item, iconStyle, shouldAnimate, badge }: BannerDialSlotProps) {
  const bgDataUri = useLocalImageDataUri(BG_PATHS[game]);

  // Fetch icon and closed-eyes avatar independently per slot
  const iconDataUri = useImageDataUri(item.icon);
  const closedEyesUrl = item.name ? getClosedEyesUrl(game, item.name) : null;
  const closedDataUri = useImageDataUri(closedEyesUrl);

  // Coordinated blink — each slot is an independent subscriber
  const canAnimate = closedDataUri !== null && shouldAnimate;
  const blink = useBlink(canAnimate);
  const charSrc = blink ? closedDataUri! : iconDataUri;
  const countdown = formatCountdownFromSeconds(item.countdownSeconds);

  const scaledIcon = scaleIconForDial(iconStyle);
  const scaledBadge: BannerBadgeOptions = {
    ...badge,
    fontSize: Math.round(badge.fontSize * DIAL_SCALE),
  };

  // Still loading icon
  if (!iconDataUri) {
    return (
      <div className="relative size-25">
        <img src={bgDataUri} width={DIAL_BG_SIZE} height={DIAL_BG_SIZE} />
      </div>
    );
  }

  return (
    <div className="relative size-25">
      <img src={bgDataUri} width={DIAL_BG_SIZE} height={DIAL_BG_SIZE} />
      <div className="absolute" style={scaledIcon}>
        <img src={charSrc!} width={scaledIcon.width} height={scaledIcon.height} />
      </div>
      <BannerBadge text={countdown} options={scaledBadge} />
    </div>
  );
}

// ─── Dial Component ──────────────────────────────────────────────

/**
 * Shared banner dial component for the Stream Deck+ encoder touch display.
 *
 * Shows up to **two** banner items side-by-side (each 100×100) when
 * two or more items are active, perfectly filling the 200×100 display.
 * Falls back to a single centered slot when only one item is available.
 *
 * Interactions:
 * - Touch tap → cycle banner + refresh data
 * - Dial rotate → cycle through banner items
 */
export function BannerDial({ game, account, items, requestUpdate, iconStyle }: BannerKeyProps) {
  const [settings, setSettings] = useSettings<BannerCycleSettings & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  const bgDataUri = useLocalImageDataUri(BG_PATHS[game]);
  const bannerIndex = settings.bannerIndex ?? 0;

  const badge: BannerBadgeOptions = {
    position: globalSettings.bannerBadgePosition ?? "center",
    layout: globalSettings.bannerBadgeLayout ?? "horizontal",
    fontSize: globalSettings.bannerBadgeFontSize ?? 18,
  };

  // Animation policy — each slot further checks if its closed-eyes image loaded
  const animationsDisabled = globalSettings.disableAnimations ?? false;
  const alwaysBlink = settings.alwaysBlink ?? false;
  const shouldAnimate = !animationsDisabled || alwaysBlink;

  // Determine visible items (up to 2 when available)
  const len = items.length;
  const first = len > 0 ? items[bannerIndex % len]! : null;
  const second = len >= 2 ? items[(bannerIndex + 1) % len]! : null;

  // Cycle banner on touch tap
  useTouchTap(() => {
    setSettings({ bannerIndex: bannerIndex + 1 });
    void requestUpdate();
  });

  // Cycle through items with dial rotation
  useDialRotate(({ ticks }) => {
    if (items.length === 0) return;
    const len = items.length;
    setSettings({ bannerIndex: (((bannerIndex + ticks) % len) + len) % len });
  });

  // ─── Placeholder ────────────────────────────────────────────
  if (account.status !== "resolved") {
    return (
      <div className="relative w-full h-full">
        <img src={bgDataUri} className="w-full h-full object-cover" />
        <div className="absolute flex items-center justify-center w-full h-full">
          <div className="flex items-center justify-center bg-overlay rounded-lg px-2.5 py-0.75">
            <span className="text-sm font-bold text-white font-body text-center">
              {DIAL_STATUS_LABELS[account.status]}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading ────────────────────────────────────────────────

  if (!first) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={bgDataUri} width={DIAL_BG_SIZE} height={DIAL_BG_SIZE} />
      </div>
    );
  }

  // ─── Banner (2 items side by side) ──────────────────────────

  if (second) {
    return (
      <div className="flex w-full h-full">
        <BannerDialSlot
          game={game}
          item={first}
          iconStyle={iconStyle}
          shouldAnimate={shouldAnimate}
          badge={badge}
        />
        <BannerDialSlot
          game={game}
          item={second}
          iconStyle={iconStyle}
          shouldAnimate={shouldAnimate}
          badge={badge}
        />
      </div>
    );
  }

  // ─── Banner (single item centered) ─────────────────────────

  return (
    <div className="flex items-center justify-center w-full h-full">
      <BannerDialSlot
        game={game}
        item={first}
        iconStyle={iconStyle}
        shouldAnimate={shouldAnimate}
        badge={badge}
      />
    </div>
  );
}
