import { Badge } from "@/components/badge";

const KEY_SIZE = 144;

interface StaminaKeyProps {
  /** Background image data URI (e.g. 3-star rarity background) */
  baseImage: string;
  /** Stamina icon image data URI rendered as a fill overlay */
  iconImage: string;
  /** Current stamina value */
  current: number;
  /** Maximum stamina value (used to compute fill percentage) */
  max: number;
  /** Icon image size in px (default: 144) */
  iconSize?: number;
  /** Top/left offset of the icon in px (default: 0) */
  iconOffset?: number;
}

/**
 * Shared stamina fill-gauge key component.
 *
 * Renders a background image with a stamina icon overlay that reveals
 * proportionally to the current/max ratio, plus a bottom badge with
 * the current value. Used by Resin (GI), Trailblaze Power (HSR), and
 * Battery Charge (ZZZ).
 */
export function StaminaKey({
  baseImage,
  iconImage,
  current,
  max,
  iconSize = KEY_SIZE,
  iconOffset = 0,
}: StaminaKeyProps) {
  const percentage = Math.min(Math.max(current / max, 0), 1);
  const coverH = Math.round(KEY_SIZE * (1 - percentage));

  return (
    <div className="relative w-full h-full">
      <img src={baseImage} width={KEY_SIZE} height={KEY_SIZE} />
      <div
        className="absolute"
        style={{ top: iconOffset, left: iconOffset, width: iconSize, height: iconSize }}
      >
        <img src={iconImage} width={iconSize} height={iconSize} />
      </div>
      <div className="absolute top-0 left-0 w-36 bg-overlay-medium" style={{ height: coverH }} />
      <Badge text={`${current}`} />
    </div>
  );
}
