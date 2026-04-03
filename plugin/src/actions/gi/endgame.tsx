import { defineAction } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinEndgameSettings } from "@/types/settings";
import type {
  GenshinSpiralAbyss,
  GenshinImaginariumTheater,
  GenshinStygianOnslaught,
} from "@/api/types/genshin";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { formatDaysRemaining } from "@/utils/time";
import { EndgameKey, type EndgameModeConfig, type EndgameDisplay } from "@/components/endgame-key";

// ─── Mode configs ─────────────────────────────────────────────────

const MODES: Record<string, EndgameModeConfig> = {
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
};

const DEFAULT_MODE = "spiral-abyss";

// ─── Formatters ───────────────────────────────────────────────────

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

function formatModeData(mode: string, data: unknown): EndgameDisplay {
  switch (mode) {
    case "imaginarium-theater":
      return formatImaginariumTheater(data as GenshinImaginariumTheater);
    case "stygian-onslaught":
      return formatStygianOnslaught(data as GenshinStygianOnslaught);
    default:
      return formatSpiralAbyss(data as GenshinSpiralAbyss);
  }
}

// ─── Key Component ────────────────────────────────────────────────

function GenshinEndgameKey() {
  return (
    <EndgameKey game="gi" modes={MODES} defaultMode={DEFAULT_MODE} formatData={formatModeData} />
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const genshinEndgameAction = defineAction<GenshinEndgameSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.abyss",
  key: GenshinEndgameKey,
  wrapper: createActionWrapper("gi", [
    "gi:spiral-abyss",
    "gi:imaginarium-theater",
    "gi:stygian-onslaught",
  ]),
});
