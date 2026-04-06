import { cn } from "@fcannizzaro/streamdeck-react";
import type { BannerBadgeOptions } from "@hoyodeck/shared/types";

/**
 * Configurable banner countdown badge.
 * Supports left/center/right positioning and horizontal/vertical layout.
 *
 * Uses a full-axis wrapper + flexbox centering instead of CSS translate
 * transforms (Takumi renderer only supports rotate, not translateX/Y).
 */
export function BannerBadge({ text, options }: { text: string; options: BannerBadgeOptions }) {
  const { position, layout, fontSize } = options;
  const isVertical = layout === "vertical";

  // Wrapper spans the full axis needed for flexbox centering —
  // position offsets are dynamic per-config so they stay in style
  const wrapperStyle: Record<string, string | number> = {};

  if (isVertical) {
    wrapperStyle.top = 0;
    wrapperStyle.height = "100%";
    if (position === "left") wrapperStyle.left = 6;
    else if (position === "right") wrapperStyle.right = 6;
    else {
      wrapperStyle.left = 0;
      wrapperStyle.width = "100%";
    }
  } else {
    wrapperStyle.bottom = 6;
    if (position === "left") wrapperStyle.left = 6;
    else if (position === "right") wrapperStyle.right = 6;
    else {
      wrapperStyle.left = 0;
      wrapperStyle.width = "100%";
    }
  }

  return (
    <div className="absolute flex items-center justify-center" style={wrapperStyle}>
      <div
        className={cn(
          "flex items-center justify-center bg-overlay rounded-badge px-2.5 py-0.5",
          isVertical && "-rotate-90",
        )}
      >
        <span className="font-bold text-white font-body" style={{ fontSize }}>
          {text}
        </span>
      </div>
    </div>
  );
}
