export type InputType = "key" | "dial" | "key+dial";

export interface ActionDef {
  id: string;
  name: string;
  description: string;
  features: string[];
  inputType: InputType;
}

export interface GameDef {
  id: "gi" | "hsr" | "zzz";
  name: string;
  description: string;
  actions: ActionDef[];
}

export interface CrossGameActionDef {
  id: string;
  name: string;
  description: string;
  features: string[];
  inputType: InputType;
}

export const games: GameDef[] = [
  {
    id: "gi",
    name: "Genshin Impact",
    description:
      "Monitor your Original Resin, daily commissions, expeditions, Serenitea Pot, endgame progress, and current banners — never miss a resin cap again.",
    actions: [
      {
        id: "resin",
        name: "Resin",
        description:
          "Animated fill gauge showing your current Original Resin with visual fill level and count badge.",
        features: ["Fill-level visualization", "0–200 range", "Tap to refresh"],
        inputType: "key",
      },
      {
        id: "commissions",
        name: "Commissions",
        description:
          "Daily commission progress tracker with an animated mascot that blinks and floats across three visual states.",
        features: ["Progress tracking", "Animated mascot", "Three visual states"],
        inputType: "key",
      },
      {
        id: "expeditions",
        name: "Expeditions",
        description:
          "Character avatar display showing all active expeditions with completion status and live countdown timers.",
        features: ["Character avatars", "Completion indicators", "Live countdown"],
        inputType: "key",
      },
      {
        id: "teapot",
        name: "Teapot",
        description:
          "Serenitea Pot realm currency shown as a percentage with a floating Tubby animation and max coin alert.",
        features: ["Currency percentage", "Floating animation", "MAX COIN alert"],
        inputType: "key",
      },
      {
        id: "transformer",
        name: "Transformer",
        description:
          "Parametric Transformer cooldown timer with ready state indicator. Supports icon and text display styles.",
        features: ["Cooldown timer", "Ready indicator", "Two display styles"],
        inputType: "key",
      },
      {
        id: "endgame",
        name: "Endgame",
        description:
          "Track Spiral Abyss, Imaginarium Theater, and Stygian Onslaught progress with star counts and reset timers.",
        features: [
          "3 endgame modes",
          "Star count",
          "Days until reset",
          "Auto-select ending soonest",
        ],
        inputType: "key",
      },
      {
        id: "banner",
        name: "Banner",
        description:
          "Current wish banner with 5-star character or weapon icon, countdown badge, and animated blink effect.",
        features: [
          "Character / weapon icon",
          "Countdown badge",
          "Cycle banners",
          "Blink animation",
        ],
        inputType: "key+dial",
      },
    ],
  },
  {
    id: "hsr",
    name: "Honkai: Star Rail",
    description:
      "Keep an eye on your Trailblaze Power, endgame challenges, and current warp banners at a glance.",
    actions: [
      {
        id: "trailblaze-power",
        name: "Trailblaze Power",
        description:
          "Animated fill gauge showing your current Trailblaze Power with visual fill level and count badge.",
        features: ["Fill-level visualization", "0–300 range", "Tap to refresh"],
        inputType: "key",
      },
      {
        id: "endgame",
        name: "Endgame",
        description:
          "Track Memory of Chaos, Pure Fiction, Apocalyptic Shadow, and Anomaly Arbitration with star counts and timers.",
        features: [
          "4 endgame modes",
          "Star count",
          "Days until reset",
          "Auto-select ending soonest",
        ],
        inputType: "key",
      },
      {
        id: "banner",
        name: "Banner",
        description:
          "Current warp banner with 5-star character or Light Cone icon, countdown badge, and blink animation.",
        features: [
          "Character / Light Cone icon",
          "Countdown badge",
          "Cycle banners",
          "Blink animation",
        ],
        inputType: "key+dial",
      },
    ],
  },
  {
    id: "zzz",
    name: "Zenless Zone Zero",
    description:
      "Track your Battery Charge, endgame challenges, and Signal Search banners directly from your desk.",
    actions: [
      {
        id: "battery-charge",
        name: "Battery Charge",
        description:
          "Animated fill gauge showing your current Battery Charge with visual fill level and count badge.",
        features: ["Fill-level visualization", "0–240 range", "Tap to refresh"],
        inputType: "key",
      },
      {
        id: "endgame",
        name: "Endgame",
        description:
          "Track Shiyu Defense and Deadly Assault progress with star counts and season reset timers.",
        features: [
          "2 endgame modes",
          "Star count",
          "Days until reset",
          "Auto-select ending soonest",
        ],
        inputType: "key",
      },
      {
        id: "banner",
        name: "Banner",
        description:
          "Current Signal Search banner with S-rank character or W-Engine icon, countdown badge, and blink animation.",
        features: [
          "Character / W-Engine icon",
          "Countdown badge",
          "Cycle banners",
          "Blink animation",
        ],
        inputType: "key+dial",
      },
    ],
  },
];

export const crossGameActions: CrossGameActionDef[] = [
  {
    id: "daily-reward",
    name: "Daily Reward",
    description:
      "Shows today's HoYoLAB check-in reward with a preview of the item. Tap to claim it directly from your Stream Deck.",
    features: ["Today's reward preview", "One-tap claim", "Done overlay"],
    inputType: "key",
  },
  {
    id: "redeem-code",
    name: "Redeem Code",
    description:
      "Automatically detects and redeems all available promo codes for your account with live progress tracking.",
    features: ["Auto-detect new codes", "Batch redeem", "Live progress", "Per-account tracking"],
    inputType: "key",
  },
  {
    id: "stamina-overview",
    name: "Stamina Overview",
    description:
      "Multi-game stamina overview for your Stream Deck+ encoder. Shows up to three games side-by-side with rotate to focus and tap to refresh.",
    features: ["Up to 3 games", "Rotate to focus", "Tap to refresh"],
    inputType: "dial",
  },
  {
    id: "wish-tracker",
    name: "Wish Tracker",
    description:
      "Manual pity counter for all games on the encoder. Rotate to increment, press for +10, and tap the display to switch game or reset.",
    features: ["Pity counter", "Rotate / press", "Multi-game", "Tap to reset"],
    inputType: "dial",
  },
];

/** Total action count: 7 (GI) + 3 (HSR) + 3 (ZZZ) + 4 (cross-game) = 17 */
export const TOTAL_ACTIONS =
  games.reduce((sum, g) => sum + g.actions.length, 0) + crossGameActions.length;
