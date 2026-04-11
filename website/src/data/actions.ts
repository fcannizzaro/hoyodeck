export type InputType = "key" | "dial" | "key+dial";

export interface ActionDef {
  id: string;
  name: string;
  description: string;
  features: string[];
  inputType: InputType;
  supportedGames?: Array<"gi" | "hsr" | "zzz">;
}

export interface GameDef {
  id: "gi" | "hsr" | "zzz";
  name: string;
  description: string;
  availability: string;
  coreActions: ActionDef[];
  utilityActions: ActionDef[];
  exclusiveActions: ActionDef[];
}

export const coreActions: ActionDef[] = [
  {
    id: "stamina",
    name: "Stamina",
    description:
      "One unified stamina key for Resin, Trailblaze Power, or Battery Charge. Pick the game in settings and press to refresh.",
    features: ["GI / HSR / ZZZ", "Tap to refresh", "Game-specific art"],
    inputType: "key",
    supportedGames: ["gi", "hsr", "zzz"],
  },
  {
    id: "banner",
    name: "Wish Banner",
    description:
      "Unified banner action for all supported games with both key and Stream Deck+ dial layouts.",
    features: ["Key + dial", "Current 5★ pools", "Countdown timer"],
    inputType: "key+dial",
    supportedGames: ["gi", "hsr", "zzz"],
  },
  {
    id: "endgame",
    name: "Endgame",
    description:
      "Unified endgame tracker that switches between each game's active challenge modes and reset windows.",
    features: ["Per-game modes", "Star progress", "Ending-soonest view"],
    inputType: "key",
    supportedGames: ["gi", "hsr", "zzz"],
  },
  {
    id: "daily-reward",
    name: "Daily Reward",
    description:
      "See today's HoYoLAB login reward and claim it directly from the key for the selected game.",
    features: ["In-key claim", "Reward preview", "Done overlay"],
    inputType: "key",
    supportedGames: ["gi", "hsr", "zzz"],
  },
  {
    id: "redeem-code",
    name: "Redeem Code",
    description:
      "Redeem available promo codes for the selected game and watch progress directly on the key.",
    features: ["Batch redeem", "Live status grid", "Per-game codes"],
    inputType: "key",
    supportedGames: ["gi", "hsr", "zzz"],
  },
];

export const multiGameUtilities: ActionDef[] = [
  {
    id: "stamina-overview",
    name: "Stamina Overview",
    description: "Stream Deck+ overview for up to three game stamina meters in one dial display.",
    features: ["Dial only", "Up to 3 slots", "Rotate focus"],
    inputType: "dial",
    supportedGames: ["gi", "hsr", "zzz"],
  },
  {
    id: "wish-tracker",
    name: "Wish Tracker",
    description:
      "Manual pity counter for Stream Deck+ with rotate, press, tap, and long-touch gestures.",
    features: ["Dial only", "+1 / +10", "Tap switch / hold reset"],
    inputType: "dial",
    supportedGames: ["gi", "hsr", "zzz"],
  },
  {
    id: "patch-countdown",
    name: "Patch Countdown",
    description: "Version countdown rows for multiple games on either key or dial layouts.",
    features: ["Key + dial", "Up to 3 games", "Refresh on tap"],
    inputType: "key+dial",
    supportedGames: ["gi", "hsr", "zzz"],
  },
];

const genshinExclusiveActions: ActionDef[] = [
  {
    id: "commissions",
    name: "Commissions",
    description:
      "Animated daily commission tracker with unfinished, completed, and rewarded states.",
    features: ["Genshin only", "Animated mascot", "Progress badge"],
    inputType: "key",
    supportedGames: ["gi"],
  },
  {
    id: "expeditions",
    name: "Expeditions",
    description: "Shows expedition avatars with completion status and a finished-count badge.",
    features: ["Genshin only", "Avatar grid", "Completion count"],
    inputType: "key",
    supportedGames: ["gi"],
  },
  {
    id: "teapot",
    name: "Teapot",
    description:
      "Serenitea Pot currency tracker with floating Tubby art and a max-coin warning state.",
    features: ["Genshin only", "Tubby animation", "MAX COIN alert"],
    inputType: "key",
    supportedGames: ["gi"],
  },
  {
    id: "transformer",
    name: "Transformer",
    description:
      "Parametric Transformer cooldown key with ready-state handling and progress cover.",
    features: ["Genshin only", "Cooldown timer", "Ready state"],
    inputType: "key",
    supportedGames: ["gi"],
  },
];

export const games: GameDef[] = [
  {
    id: "gi",
    name: "Genshin Impact",
    description:
      "Genshin gets the full shared action set plus dedicated keys for commissions, expeditions, teapot income, and the Parametric Transformer.",
    availability: "Shared unified actions + 4 GI-only keys",
    coreActions,
    utilityActions: multiGameUtilities,
    exclusiveActions: genshinExclusiveActions,
  },
  {
    id: "hsr",
    name: "Honkai: Star Rail",
    description:
      "Star Rail now uses the unified common actions for stamina, banners, endgame, rewards, and code redemption, plus the multi-game dial tools.",
    availability: "Unified common action set",
    coreActions,
    utilityActions: multiGameUtilities,
    exclusiveActions: [],
  },
  {
    id: "zzz",
    name: "Zenless Zone Zero",
    description:
      "ZZZ also runs on the unified common actions, covering battery charge, banners, endgame, daily rewards, and shared multi-game utilities.",
    availability: "Unified common action set",
    coreActions,
    utilityActions: multiGameUtilities,
    exclusiveActions: [],
  },
];

export const TOTAL_ACTIONS =
  coreActions.length + multiGameUtilities.length + genshinExclusiveActions.length;
