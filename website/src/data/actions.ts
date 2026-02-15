export interface ActionDef {
  id: string;
  name: string;
  description: string;
  features: string[];
  image?: string;
}

export interface GameActions {
  id: "gi" | "hsr" | "zzz";
  name: string;
  accent: string;
  actions: ActionDef[];
}

export const games: GameActions[] = [
  {
    id: "gi",
    name: "Genshin Impact",
    accent: "teal",
    actions: [
      {
        id: "resin",
        name: "Resin",
        description:
          "Animated fill gauge showing your current Original Resin (0–200) with a floating bobbing icon animation. Refreshes data on tap.",
        features: [
          "Animated fill gauge",
          "0–200 range",
          "Floating icon animation",
          "Tap to refresh",
        ],
      },
      {
        id: "commissions",
        name: "Commissions",
        description:
          "Daily commission progress tracker (X/4) with an animated Katheryne character that blinks. Three visual states reflect your progress.",
        features: [
          "Progress tracking (X/4)",
          "Unfinished state",
          "Completed state",
          "Rewarded state",
          "Animated Katheryne",
        ],
      },
      {
        id: "expeditions",
        name: "Expeditions",
        description:
          "Displays up to 5 expedition character slots with pie-chart progress overlays and real-time countdown timers.",
        features: [
          "5 expedition slots",
          "Pie-chart progress overlay",
          "Countdown timers",
          "Character avatars",
        ],
      },
      {
        id: "teapot",
        name: "Teapot",
        description:
          "Shows Serenitea Pot realm currency as a percentage with a floating Tubby animation. Alerts when coins are full.",
        features: [
          "Currency percentage",
          "Floating Tubby animation",
          "MAX COIN alert state",
        ],
      },
      {
        id: "transformer",
        name: "Transformer",
        description:
          "Displays the Parametric Transformer cooldown timer or a Ready state indicator. Supports icon and text display styles.",
        features: [
          "Cooldown timer",
          "Ready state indicator",
          "Icon / text style options",
        ],
      },
      {
        id: "spiral-abyss",
        name: "Spiral Abyss",
        description:
          "Shows your current Spiral Abyss star count alongside the number of days remaining until the next reset.",
        features: ["Star count display", "Days until reset"],
      },
      {
        id: "banner",
        name: "Banner",
        description:
          "Displays the current wish banner featuring the 5-star character or weapon icon with a countdown badge. Press to cycle banners.",
        features: [
          "5-star character / weapon icon",
          "Countdown badge",
          "Cycles through banners",
        ],
      },
      {
        id: "daily-reward",
        name: "Daily Reward",
        description:
          "Shows today's HoYoLAB check-in reward with a done overlay. Tap to claim the reward directly from your Stream Deck.",
        features: [
          "Today's reward preview",
          "Done overlay",
          "Tap to claim",
          "Cross-game action",
        ],
      },
    ],
  },
  {
    id: "hsr",
    name: "Honkai: Star Rail",
    accent: "purple",
    actions: [
      {
        id: "trailblaze-power",
        name: "Trailblaze Power",
        description:
          "Animated fill gauge showing your current Trailblaze Power (0–300) with a floating icon animation.",
        features: ["Animated fill gauge", "0–300 range", "Floating icon animation"],
      },
      {
        id: "banner",
        name: "Banner",
        description:
          "Displays the current warp banner featuring the 5-star character or Light Cone icon with a countdown badge.",
        features: [
          "5-star character / Light Cone icon",
          "Countdown badge",
          "Banner cycling",
        ],
      },
      {
        id: "daily-reward",
        name: "Daily Reward",
        description:
          "Shows today's HoYoLAB check-in reward with a done overlay. Tap to claim the reward directly from your Stream Deck.",
        features: [
          "Today's reward preview",
          "Done overlay",
          "Tap to claim",
          "Cross-game action",
        ],
      },
    ],
  },
  {
    id: "zzz",
    name: "Zenless Zone Zero",
    accent: "orange",
    actions: [
      {
        id: "battery-charge",
        name: "Battery Charge",
        description:
          "Animated fill gauge showing your current Battery Charge (0–240) with a floating icon animation.",
        features: ["Animated fill gauge", "0–240 range", "Floating icon animation"],
      },
      {
        id: "banner",
        name: "Banner",
        description:
          "Displays the current Signal Search banner featuring the S-rank character or W-Engine icon with a countdown badge.",
        features: [
          "S-rank character / W-Engine icon",
          "Countdown badge",
          "Banner cycling",
        ],
      },
      {
        id: "daily-reward",
        name: "Daily Reward",
        description:
          "Shows today's HoYoLAB check-in reward with a done overlay. Tap to claim the reward directly from your Stream Deck.",
        features: [
          "Today's reward preview",
          "Done overlay",
          "Tap to claim",
          "Cross-game action",
        ],
      },
    ],
  },
];
