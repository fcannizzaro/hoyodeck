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

  // Wrapper spans the full axis needed for flexbox centering
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
        className="flex items-center justify-center"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          borderRadius: 10,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 2,
          paddingBottom: 2,
          ...(isVertical ? { transform: "rotate(-90deg)" } : {}),
        }}
      >
        <span
          style={{
            fontSize,
            fontWeight: 700,
            color: "white",
            fontFamily: "Inter",
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}
