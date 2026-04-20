import { defineAction, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { UnifiedEndgameSettings, GameId } from "@hoyodeck/shared/types";
import type {
  GenshinSpiralAbyss,
  GenshinImaginariumTheater,
  GenshinStygianOnslaught,
} from "@/api/types/genshin";
import type {
  StarRailChallenge,
  StarRailChallengePeak,
  StarRailDateComponents,
} from "@/api/types/hsr";
import type { ZZZShiyuDefense, ZZZDeadlyAssault, ZZZDateComponents } from "@/api/types/zzz";
import { AccountProvider } from "@/contexts/account-context";
import { DataProvider } from "@/contexts/data-context";
import { formatDaysRemaining } from "@/utils/time";
import { EndgameKey, type EndgameModeConfig, type EndgameDisplay } from "@/components/endgame-key";
import type { DataType } from "@/services/data-controller.types";

// ─── GI formatters ────────────────────────────────────────────────

function formatSpiralAbyss(abyss: GenshinSpiralAbyss): EndgameDisplay {
  const endMs = parseInt(abyss.end_time) * 1000;
  return {
    progressText: `${abyss.total_star}*`,
    timerText: formatDaysRemaining(new Date(endMs)),
    endMs,
  };
}

function formatImaginariumTheater(theater: GenshinImaginariumTheater): EndgameDisplay {
  if (!theater.data?.length) {
    return { progressText: "0*", timerText: "--" };
  }
  const current = theater.data.find((e) => e.schedule.schedule_type === 1) ?? theater.data[0]!;
  const endMs = parseInt(current.schedule.end_time) * 1000;
  return {
    progressText: `${current.stat.medal_num}*`,
    timerText: formatDaysRemaining(new Date(endMs)),
    endMs,
  };
}

function formatStygianOnslaught(onslaught: GenshinStygianOnslaught): EndgameDisplay {
  if (!onslaught.data?.length) {
    return { progressText: "0*", timerText: "--" };
  }
  const current = onslaught.data.find((e) => e.schedule.is_valid) ?? onslaught.data[0]!;
  const difficulty = current.single.best?.difficulty ?? 0;
  const endMs = parseInt(current.schedule.end_time) * 1000;
  return {
    progressText: `${difficulty}*`,
    timerText: formatDaysRemaining(new Date(endMs)),
    endMs,
  };
}

function formatGIModeData(mode: string, data: unknown): EndgameDisplay {
  switch (mode) {
    case "imaginarium-theater":
      return formatImaginariumTheater(data as GenshinImaginariumTheater);
    case "stygian-onslaught":
      return formatStygianOnslaught(data as GenshinStygianOnslaught);
    default:
      return formatSpiralAbyss(data as GenshinSpiralAbyss);
  }
}

// ─── HSR formatters ───────────────────────────────────────────────

function hsrToDate(dc: StarRailDateComponents): Date {
  return new Date(Date.UTC(dc.year, dc.month - 1, dc.day, dc.hour - 8, dc.minute));
}

function formatChallenge(challenge: StarRailChallenge): EndgameDisplay {
  const endTimeComponents =
    challenge.end_time ?? challenge.groups.find((g) => g.status !== "End")?.end_time;
  const endDate = endTimeComponents ? hsrToDate(endTimeComponents) : undefined;
  const timerText = endDate ? formatDaysRemaining(endDate) : "--";
  return { progressText: `${challenge.star_num}*`, timerText, endMs: endDate?.getTime() };
}

function formatChallengePeak(peak: StarRailChallengePeak): EndgameDisplay {
  const record =
    peak.challenge_peak_records.find((r) => r.group.status !== "End") ??
    peak.challenge_peak_records[0];
  if (!record) return { progressText: "0*", timerText: "--" };
  const stars = record.mob_stars + record.boss_stars;
  const endDate = hsrToDate(record.group.end_time);
  return {
    progressText: `${stars}*`,
    timerText: formatDaysRemaining(endDate),
    endMs: endDate.getTime(),
  };
}

function formatHSRModeData(mode: string, data: unknown): EndgameDisplay {
  if (mode === "anomaly-arbitration") return formatChallengePeak(data as StarRailChallengePeak);
  return formatChallenge(data as StarRailChallenge);
}

// ─── ZZZ formatters ───────────────────────────────────────────────

function zzzToDate(dc: ZZZDateComponents): Date {
  return new Date(Date.UTC(dc.year, dc.month - 1, dc.day, dc.hour - 8, dc.minute, dc.second));
}

function formatShiyuDefense(data: ZZZShiyuDefense): EndgameDisplay {
  const endDate = data.hadal_end_time
    ? zzzToDate(data.hadal_end_time)
    : data.end_time !== "0"
      ? new Date(parseInt(data.end_time) * 1000)
      : undefined;
  const timerText = endDate ? formatDaysRemaining(endDate) : "--";
  return { progressText: `${data.zone_id}*`, timerText, endMs: endDate?.getTime() };
}

function formatDeadlyAssault(data: ZZZDeadlyAssault): EndgameDisplay {
  const endDate = zzzToDate(data.end_time);
  return {
    progressText: `${data.total_star}*`,
    timerText: formatDaysRemaining(endDate),
    endMs: endDate.getTime(),
  };
}

function formatZZZModeData(mode: string, data: unknown): EndgameDisplay {
  if (mode === "deadly-assault") return formatDeadlyAssault(data as ZZZDeadlyAssault);
  return formatShiyuDefense(data as ZZZShiyuDefense);
}

// ─── Per-game endgame configs ─────────────────────────────────────

interface EndgameGameConfig {
  modes: Record<string, EndgameModeConfig>;
  dataTypes: DataType[];
  formatData: (mode: string, data: unknown) => EndgameDisplay;
}

const GAME_CONFIGS: Record<GameId, EndgameGameConfig> = {
  gi: {
    modes: {
      "spiral-abyss": {
        dataType: "gi:spiral-abyss",
        bg: "imgs/actions/gi/sa.webp",
        name: "Spiral Abyss",
      },
      "imaginarium-theater": {
        dataType: "gi:imaginarium-theater",
        bg: "imgs/actions/gi/it.webp",
        name: "Imaginarium Theater",
      },
      "stygian-onslaught": {
        dataType: "gi:stygian-onslaught",
        bg: "imgs/actions/gi/so.webp",
        name: "Stygian Onslaught",
      },
    },
    dataTypes: ["gi:spiral-abyss", "gi:imaginarium-theater", "gi:stygian-onslaught"],
    formatData: formatGIModeData,
  },
  hsr: {
    modes: {
      "memory-of-chaos": {
        dataType: "hsr:memory-of-chaos",
        bg: "imgs/actions/hsr/moc.webp",
        name: "Memory of Chaos",
      },
      "pure-fiction": {
        dataType: "hsr:pure-fiction",
        bg: "imgs/actions/hsr/pf.webp",
        name: "Pure Fiction",
      },
      "apocalyptic-shadow": {
        dataType: "hsr:apocalyptic-shadow",
        bg: "imgs/actions/hsr/as.webp",
        name: "Apocalyptic Shadow",
      },
      "anomaly-arbitration": {
        dataType: "hsr:anomaly-arbitration",
        bg: "imgs/actions/hsr/aa.webp",
        name: "Anomaly Arbitration",
      },
    },
    dataTypes: [
      "hsr:memory-of-chaos",
      "hsr:pure-fiction",
      "hsr:apocalyptic-shadow",
      "hsr:anomaly-arbitration",
    ],
    formatData: formatHSRModeData,
  },
  zzz: {
    modes: {
      "shiyu-defense": {
        dataType: "zzz:shiyu-defense",
        bg: "imgs/actions/zzz/sd.webp",
        name: "Shiyu Defense",
      },
      "deadly-assault": {
        dataType: "zzz:deadly-assault",
        bg: "imgs/actions/zzz/da.webp",
        name: "Deadly Assault",
      },
    },
    dataTypes: ["zzz:shiyu-defense", "zzz:deadly-assault"],
    formatData: formatZZZModeData,
  },
};

const DEFAULT_MODE = "ending-soonest";

// ─── Key Component ────────────────────────────────────────────────

function UnifiedEndgameKey() {
  const [settings] = useSettings<UnifiedEndgameSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;
  const config = GAME_CONFIGS[game];

  return (
    <EndgameKey
      game={game}
      modes={config.modes}
      defaultMode={DEFAULT_MODE}
      formatData={config.formatData}
    />
  );
}

// ─── Custom Wrapper (dynamic game from settings) ──────────────────

function EndgameWrapper({ children }: { children?: React.ReactNode }) {
  const [settings] = useSettings<UnifiedEndgameSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;
  const config = GAME_CONFIGS[game];

  return (
    <AccountProvider game={game}>
      <DataProvider game={game} dataTypes={config.dataTypes}>
        {children}
      </DataProvider>
    </AccountProvider>
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const endgameAction = defineAction<UnifiedEndgameSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.endgame",
  key: UnifiedEndgameKey,
  wrapper: EndgameWrapper,
  info: {
    name: "Endgame",
    disableCaching: true,
    icon: "imgs/actions/common/endgame-icon",
    tooltip: "Display endgame challenge progress (Spiral Abyss, Memory of Chaos, Shiyu Defense…)",
    states: [{ image: "imgs/actions/gi/5-star", titleAlignment: "middle" }],
  },
});
