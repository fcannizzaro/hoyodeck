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
    <div className="absolute bottom-1.5 left-0 w-full flex items-center justify-center">
      <div className="flex items-center justify-center bg-overlay rounded-badge px-2.5 py-0.5">
        <span className="font-bold text-white font-body" style={{ fontSize }}>
          {text}
        </span>
      </div>
    </div>
  );
}
