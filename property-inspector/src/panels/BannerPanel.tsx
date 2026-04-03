import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Select } from "../components/Select";
import { NumberInput } from "../components/NumberInput";
import { AccountPicker } from "../components/AccountPicker";
import type { GameId } from "@hoyodeck/shared/types";

const BADGE_POSITION_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const BADGE_LAYOUT_OPTIONS = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

interface BaseBannerPanelProps {
  game: GameId;
  typeOptions: { value: string; label: string }[];
}

/**
 * Shared banner settings panel — renders account picker, banner type selector,
 * and global badge style settings. Used by all three games.
 */
function BaseBannerPanel({ game, typeOptions }: BaseBannerPanelProps) {
  const { settings, saveSettings, globalSettings, saveGlobalSettings } = useStreamDeck();
  const type = (settings.type as string) ?? "character";
  const badgePosition = (globalSettings.bannerBadgePosition as string) ?? "center";
  const badgeLayout = (globalSettings.bannerBadgeLayout as string) ?? "horizontal";
  const badgeFontSize = (globalSettings.bannerBadgeFontSize as number) ?? 18;

  return (
    <div className="flex flex-col gap-2">
      <Heading>Banner Settings</Heading>
      <AccountPicker game={game} />
      <Select
        label="Banner Type"
        value={type}
        options={typeOptions}
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
    </div>
  );
}

/** Genshin Impact banner panel — Character Event Wish / Weapon Event Wish */
export function BannerPanel() {
  return (
    <BaseBannerPanel
      game="gi"
      typeOptions={[
        { value: "character", label: "Character Event Wish" },
        { value: "weapon", label: "Weapon Event Wish" },
      ]}
    />
  );
}

/** Star Rail banner panel — Character Warp / Light Cone Warp */
export function HSRBannerPanel() {
  return (
    <BaseBannerPanel
      game="hsr"
      typeOptions={[
        { value: "character", label: "Character Warp" },
        { value: "lightcone", label: "Light Cone Warp" },
      ]}
    />
  );
}

/** ZZZ banner panel — Agent Signal Search / W-Engine Signal Search */
export function ZZZBannerPanel() {
  return (
    <BaseBannerPanel
      game="zzz"
      typeOptions={[
        { value: "character", label: "Agent Signal Search" },
        { value: "w-engine", label: "W-Engine Signal Search" },
      ]}
    />
  );
}
