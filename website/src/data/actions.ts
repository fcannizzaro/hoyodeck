export interface ActionDef {
  id: string;
  name: string;
  description: string;
  features: string[];
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
      },
      {
        id: "commissions",
        name: "Commissions",
        description:
          "Daily commission progress tracker with an animated mascot that blinks and floats across three visual states.",
        features: ["Progress tracking", "Animated mascot", "Three visual states"],
      },
      {
        id: "expeditions",
        name: "Expeditions",
        description:
          "Character avatar display showing all active expeditions with completion status and live countdown timers.",
        features: ["Character avatars", "Completion indicators", "Live countdown"],
      },
      {
        id: "teapot",
        name: "Teapot",
        description:
          "Serenitea Pot realm currency shown as a percentage with a floating Tubby animation and max coin alert.",
        features: ["Currency percentage", "Floating animation", "MAX COIN alert"],
      },
      {
        id: "transformer",
        name: "Transformer",
        description:
          "Parametric Transformer cooldown timer with ready state indicator. Supports icon and text display styles.",
        features: ["Cooldown timer", "Ready indicator", "Two display styles"],
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
  },
  {
    id: "redeem-code",
    name: "Redeem Code",
    description:
      "Automatically detects and redeems all available promo codes for your account with live progress tracking.",
    features: [
      "Auto-detect new codes",
      "Batch redeem",
      "Live progress",
      "Per-account tracking",
    ],
  },
];

/** Total action count: 7 (GI) + 3 (HSR) + 3 (ZZZ) + 2 (cross-game) = 15 */
export const TOTAL_ACTIONS = games.reduce((sum, g) => sum + g.actions.length, 0) + crossGameActions.length;
