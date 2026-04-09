import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Select } from "../components/Select";
import { NumberInput } from "../components/NumberInput";
import { AccountPicker } from "../components/AccountPicker";
import type { GameId } from "@hoyodeck/shared/types";

const GAME_OPTIONS = [
  { value: "gi", label: "Genshin Impact" },
  { value: "hsr", label: "Honkai: Star Rail" },
  { value: "zzz", label: "Zenless Zone Zero" },
];

const BADGE_POSITION_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const BADGE_LAYOUT_OPTIONS = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

const TYPE_OPTIONS: Record<GameId, { value: string; label: string }[]> = {
  gi: [
    { value: "character", label: "Character Event Wish" },
    { value: "weapon", label: "Weapon Event Wish" },
  ],
  hsr: [
    { value: "character", label: "Character Warp" },
    { value: "lightcone", label: "Light Cone Warp" },
  ],
  zzz: [
    { value: "character", label: "Agent Signal Search" },
    { value: "w-engine", label: "W-Engine Signal Search" },
  ],
};

const DEFAULT_TYPES: Record<GameId, string> = {
  gi: "character",
  hsr: "character",
  zzz: "character",
};

/**
 * Shared banner settings — renders account picker, banner type selector,
 * and global badge style settings.
 */
function BannerPanelBase({ game }: { game: GameId }) {
  const { settings, saveSettings, globalSettings, saveGlobalSettings } = useStreamDeck();
  const type = (settings.type as string) ?? DEFAULT_TYPES[game];
  const badgePosition = (globalSettings.bannerBadgePosition as string) ?? "center";
  const badgeLayout = (globalSettings.bannerBadgeLayout as string) ?? "horizontal";
  const badgeFontSize = (globalSettings.bannerBadgeFontSize as number) ?? 18;

  return (
    <>
      <AccountPicker game={game} />
      <Select
        label="Banner Type"
        value={type}
        options={TYPE_OPTIONS[game]}
        info="Select which type of banner to display."
        onChange={(value) => saveSettings({ type: value })}
      />
      <Heading>Badge Style</Heading>
      <Select
        label="Layout"
        value={badgeLayout}
        options={BADGE_LAYOUT_OPTIONS}
        info="Horizontal places the badge along the bottom edge. Vertical places it along the side."
        onChange={(value) => saveGlobalSettings({ bannerBadgeLayout: value })}
      />
      <Select
        label="Position"
        value={badgePosition}
        options={BADGE_POSITION_OPTIONS}
        info="Badge alignment. For vertical layout, left/right controls which side edge."
        onChange={(value) => saveGlobalSettings({ bannerBadgePosition: value })}
      />
      <NumberInput
        label="Font Size"
        value={badgeFontSize}
        min={12}
        max={28}
        step={1}
        info="Adjust the countdown text size (default: 18)."
        onChange={(value) => saveGlobalSettings({ bannerBadgeFontSize: value })}
      />
    </>
  );
}

/**
 * Unified banner panel — game picker + account picker + type selector + badge style.
 */
export function UnifiedBannerPanel() {
  const { settings, saveSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? "gi";

  return (
    <div className="flex flex-col gap-2">
      <Heading>Banner Settings</Heading>
      <Select
        label="Game"
        value={game}
        options={GAME_OPTIONS}
        onChange={(value) => saveSettings({ game: value, type: undefined })}
      />
      <BannerPanelBase game={game} />
    </div>
  );
}

/** Genshin Impact banner panel — Character Event Wish / Weapon Event Wish */
export function BannerPanel() {
  return (
    <div className="flex flex-col gap-2">
      <Heading>Banner Settings</Heading>
      <BannerPanelBase game="gi" />
    </div>
  );
}

/** Star Rail banner panel — Character Warp / Light Cone Warp */
export function HSRBannerPanel() {
  return (
    <div className="flex flex-col gap-2">
      <Heading>Banner Settings</Heading>
      <BannerPanelBase game="hsr" />
    </div>
  );
}

/** ZZZ banner panel — Agent Signal Search / W-Engine Signal Search */
export function ZZZBannerPanel() {
  return (
    <div className="flex flex-col gap-2">
      <Heading>Banner Settings</Heading>
      <BannerPanelBase game="zzz" />
    </div>
  );
}
