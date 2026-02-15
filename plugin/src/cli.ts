import { validateAuth } from "@/api/hoyolab/auth";
import { HoyolabClient } from "@/api/hoyolab/client";
import { isValidUid } from "@/utils/region";
import type { GameId } from "@/types/games";
import { GAMES } from "@/types/games";

// ============================================
// Help & Usage
// ============================================

const USAGE = `
Usage: bun run cli <game> <endpoint> [uid] [options]

Games:
  genshin     Genshin Impact
  starrail    Honkai: Star Rail
  zzz         Zenless Zone Zero

Endpoints:
  genshin:
    daily-note <uid>          Resin, commissions, expeditions, teapot, transformer
    abyss <uid>               Spiral Abyss data (--schedule=1|2, default 1)
    check-in-info             Daily check-in status
    check-in-rewards          Monthly check-in rewards list
    check-in-claim            Claim today's check-in reward
    act-calendar              Active banners and events

  starrail:
    daily-note <uid>          Trailblaze power, assignments, etc.
    act-calendar <uid>        Active banners and events

  zzz:
    daily-note <uid>          Battery charge, scratch card, etc.

Environment:
  HOYOLAB_COOKIE    Raw cookie string (ltoken_v2=xxx; ltuid_v2=yyy; ltmid_v2=zzz)
                    Loaded from .env automatically by Bun.

Examples:
  bun run cli genshin daily-note 600123456
  bun run cli genshin abyss 600123456 --schedule=2
  bun run cli genshin check-in-info
  bun run cli starrail daily-note 600123456
  bun run cli zzz daily-note 1012345678
`.trim();

// ============================================
// Argument Parsing
// ============================================

function parseArgs(argv: string[]) {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  const game = args[0];
  const endpoint = args[1];

  if (!game || !endpoint) {
    console.error("Error: <game> and <endpoint> are required.\n");
    console.log(USAGE);
    process.exit(1);
  }

  const validGames: GameId[] = ["gi", "hsr", "zzz"];
  if (!validGames.includes(game as GameId)) {
    console.error(
      `Error: Unknown game "${game}". Valid games: ${validGames.join(", ")}`,
    );
    process.exit(1);
  }

  // Extract positional uid and flags
  let uid: string | undefined;
  const flags: Record<string, string> = {};

  for (let i = 2; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (key) flags[key] = value ?? "true";
    } else if (!uid) {
      uid = arg;
    }
  }

  return { game: game as GameId, endpoint, uid, flags };
}

// ============================================
// Auth from Environment
// ============================================

function getAuthFromEnv() {
  const parsed = {
    ltoken_v2: process.env.LTOKEN,
    ltuid_v2: process.env.LTUID,
    ltmid_v2: process.env.LTMID,
  };

  if (!parsed.ltoken_v2 || !parsed.ltuid_v2 || !parsed.ltmid_v2) {
    console.error(
      "Error: Missing authentication environment variables. Ensure LTOKEN, LTUID, and LTMID are set.",
    );
    process.exit(1);
  }

  try {
    return validateAuth(parsed);
  } catch {
    console.error(
      "Error: Invalid cookie. Ensure ltoken_v2, ltuid_v2, and ltmid_v2 are present.",
    );
    process.exit(1);
  }
}

// ============================================
// UID Validation Helper
// ============================================

function requireUid(uid: string | undefined, game: GameId): string {
  if (!uid) {
    console.error(`Error: <uid> is required for this endpoint.`);
    process.exit(1);
  }

  if (!isValidUid(uid)) {
    console.error(`Error: Invalid UID "${uid}". Must be 9-10 digits.`);
    process.exit(1);
  }

  const gameConfig = GAMES[game];
  console.error(`Game:   ${gameConfig.name}`);
  console.error(`UID:    ${uid}`);
  console.error("");

  return uid;
}

// ============================================
// Command Dispatch
// ============================================

type EndpointHandler = (
  client: HoyolabClient,
  uid: string | undefined,
  flags: Record<string, string>,
  game: GameId,
) => Promise<unknown>;

const ENDPOINTS: Record<string, Record<string, EndpointHandler>> = {
  genshin: {
    "daily-note": async (client, uid, _, game) => {
      return client.getGenshinDailyNote(requireUid(uid, game));
    },
    abyss: async (client, uid, flags, game) => {
      const schedule = flags["schedule"] === "2" ? 2 : 1;
      return client.getGenshinSpiralAbyss(
        requireUid(uid, game),
        schedule as 1 | 2,
      );
    },
    "check-in-info": async (client) => {
      return client.getCheckInInfo('gi');
    },
    "check-in-rewards": async (client) => {
      return client.getCheckInRewards('gi');
    },
    "check-in-claim": async (client) => {
      return client.claimCheckIn('gi');
    },
    "act-calendar": async (client, uid, _, game) => {
      return client.getGenshinActCalendar(requireUid(uid, game));
    },
  },
  starrail: {
    "daily-note": async (client, uid, _, game) => {
      return client.getStarRailDailyNote(requireUid(uid, game));
    },
    "act-calendar": async (client, uid, _, game) => {
      return client.getStarRailActCalendar(requireUid(uid, game));
    },
    "check-in-info": async (client) => {
      return client.getCheckInInfo('hsr');
    },
    "check-in-rewards": async (client) => {
      return client.getCheckInRewards('hsr');
    },
    "check-in-claim": async (client) => {
      return client.claimCheckIn('hsr');
    },
  },
  zzz: {
    "daily-note": async (client, uid, _, game) => {
      return client.getZZZDailyNote(requireUid(uid, game));
    },
    "check-in-info": async (client) => {
      return client.getCheckInInfo('zzz');
    },
    "check-in-rewards": async (client) => {
      return client.getCheckInRewards('zzz');
    },
    "check-in-claim": async (client) => {
      return client.claimCheckIn('zzz');
    },
  },
};

// ============================================
// Main
// ============================================

async function main() {
  const { game, endpoint, uid, flags } = parseArgs(process.argv);
  const auth = getAuthFromEnv();
  const client = new HoyolabClient(auth);

  const gameEndpoints = ENDPOINTS[game];
  if (!gameEndpoints) {
    console.error(`Error: No endpoints defined for game "${game}".`);
    process.exit(1);
  }

  const handler = gameEndpoints[endpoint];
  if (!handler) {
    const available = Object.keys(gameEndpoints).join(", ");
    console.error(
      `Error: Unknown endpoint "${endpoint}" for ${game}.\n` +
        `Available: ${available}`,
    );
    process.exit(1);
  }

  try {
    const result = await handler(client, uid, flags, game);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("Error:", error);
    }
    process.exit(1);
  }
}

main();
