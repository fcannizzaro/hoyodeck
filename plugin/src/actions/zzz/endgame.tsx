import { defineAction } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { ZZZEndgameSettings } from "@/types/settings";
import type { ZZZShiyuDefense, ZZZDeadlyAssault, ZZZDateComponents } from "@/api/types/zzz";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { formatDaysRemaining } from "@/utils/time";
import { EndgameKey, type EndgameModeConfig, type EndgameDisplay } from "@/components/endgame-key";

// ─── Mode configs ─────────────────────────────────────────────────

const MODES: Record<string, EndgameModeConfig> = {
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
};

const DEFAULT_MODE = "shiyu-defense";

// ─── Formatters ───────────────────────────────────────────────────

function toDate(dc: ZZZDateComponents): Date {
  return new Date(Date.UTC(dc.year, dc.month - 1, dc.day, dc.hour - 8, dc.minute, dc.second));
}

function formatShiyuDefense(data: ZZZShiyuDefense): EndgameDisplay {
  const endDate = data.hadal_end_time
    ? toDate(data.hadal_end_time)
    : data.end_time !== "0"
      ? new Date(parseInt(data.end_time) * 1000)
      : undefined;
  const timerText = endDate ? formatDaysRemaining(endDate) : "--";
  return { progressText: `${data.zone_id}*`, timerText, endMs: endDate?.getTime() };
}

function formatDeadlyAssault(data: ZZZDeadlyAssault): EndgameDisplay {
  const endDate = toDate(data.end_time);
  return {
    progressText: `${data.total_star}*`,
    timerText: formatDaysRemaining(endDate),
    endMs: endDate.getTime(),
  };
}

function formatModeData(mode: string, data: unknown): EndgameDisplay {
  if (mode === "deadly-assault") return formatDeadlyAssault(data as ZZZDeadlyAssault);
  return formatShiyuDefense(data as ZZZShiyuDefense);
}

// ─── Key Component ────────────────────────────────────────────────

function ZZZEndgameKey() {
  return (
    <EndgameKey game="zzz" modes={MODES} defaultMode={DEFAULT_MODE} formatData={formatModeData} />
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const zzzEndgameAction = defineAction<ZZZEndgameSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.zzz.endgame",
  key: ZZZEndgameKey,
  wrapper: createActionWrapper("zzz", ["zzz:shiyu-defense", "zzz:deadly-assault"]),
  info: {
    name: "[ZZZ] Endgame",
    icon: "imgs/actions/common/endgame-icon",
    tooltip: "Display Shiyu Defense or Deadly Assault progress",
    states: [{ image: "imgs/actions/zzz/5-star", titleAlignment: "middle" }],
  },
});
