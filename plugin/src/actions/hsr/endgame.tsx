import { defineAction } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { StarRailEndgameSettings } from "@/types/settings";
import type {
  StarRailChallenge,
  StarRailChallengePeak,
  StarRailDateComponents,
} from "@/api/types/hsr";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { formatDaysRemaining } from "@/utils/time";
import { EndgameKey, type EndgameModeConfig, type EndgameDisplay } from "@/components/endgame-key";

// ─── Mode configs ─────────────────────────────────────────────────

const MODES: Record<string, EndgameModeConfig> = {
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
};

const DEFAULT_MODE = "memory-of-chaos";

// ─── Formatters ───────────────────────────────────────────────────

function toDate(dc: StarRailDateComponents): Date {
  return new Date(Date.UTC(dc.year, dc.month - 1, dc.day, dc.hour - 8, dc.minute));
}

function formatChallenge(challenge: StarRailChallenge): EndgameDisplay {
  const endTimeComponents =
    challenge.end_time ?? challenge.groups.find((g) => g.status !== "End")?.end_time;
  const endDate = endTimeComponents ? toDate(endTimeComponents) : undefined;
  const timerText = endDate ? formatDaysRemaining(endDate) : "--";
  return { progressText: `${challenge.star_num}*`, timerText, endMs: endDate?.getTime() };
}

function formatChallengePeak(peak: StarRailChallengePeak): EndgameDisplay {
  const record =
    peak.challenge_peak_records.find((r) => r.group.status !== "End") ??
    peak.challenge_peak_records[0];
  if (!record) return { progressText: "0*", timerText: "--" };
  const stars = record.mob_stars + record.boss_stars;
  const endDate = toDate(record.group.end_time);
  return {
    progressText: `${stars}*`,
    timerText: formatDaysRemaining(endDate),
    endMs: endDate.getTime(),
  };
}

function formatModeData(mode: string, data: unknown): EndgameDisplay {
  if (mode === "anomaly-arbitration") return formatChallengePeak(data as StarRailChallengePeak);
  return formatChallenge(data as StarRailChallenge);
}

// ─── Key Component ────────────────────────────────────────────────

function StarRailEndgameKey() {
  return (
    <EndgameKey game="hsr" modes={MODES} defaultMode={DEFAULT_MODE} formatData={formatModeData} />
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const starRailEndgameAction = defineAction<StarRailEndgameSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.hsr.endgame",
  key: StarRailEndgameKey,
  wrapper: createActionWrapper("hsr", [
    "hsr:memory-of-chaos",
    "hsr:pure-fiction",
    "hsr:apocalyptic-shadow",
    "hsr:anomaly-arbitration",
  ]),
  info: {
    name: "[HSR] Endgame",
    icon: "imgs/actions/common/endgame-icon",
    tooltip: "Display Memory of Chaos, Pure Fiction, or Apocalyptic Shadow progress",
    states: [{ image: "imgs/actions/hsr/5-star", titleAlignment: "middle" }],
  },
});
