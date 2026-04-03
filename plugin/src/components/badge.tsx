interface BadgeProps {
  text: string;
  fontSize?: number;
}

/**
 * Centered bottom pill badge for Stream Deck key overlays.
 * Renders a semi-transparent black pill with white bold text.
 * Uses a full-width wrapper + flexbox centering (Takumi doesn't support translate transforms).
 */
export function Badge({ text, fontSize = 18 }: BadgeProps) {
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{ bottom: 6, left: 0, width: "100%" }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          borderRadius: 10,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 2,
          paddingBottom: 2,
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
