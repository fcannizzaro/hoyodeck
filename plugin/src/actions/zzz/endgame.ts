import { action } from "@elgato/streamdeck";
import { BaseEndgameAction, type EndgameDisplay, type EndgameModeConfig } from "../base/endgame-action";
import type { ZZZEndgameSettings } from "@/types/settings";
import type { DataType } from "@/services/data-controller.types";
import type { ZZZShiyuDefense, ZZZDeadlyAssault, ZZZDateComponents } from "@/api/types/zzz";
import { formatDaysRemaining } from "@/utils/time";

/** Data types this action can subscribe to */
type ZZZEndgameDataType = 'zzz:shiyu-defense' | 'zzz:deadly-assault';

const MODES: Record<string, EndgameModeConfig> = {
  'shiyu-defense': { dataType: 'zzz:shiyu-defense', bg: 'imgs/actions/zzz/sd.webp', name: 'Shiyu Defense' },
  'deadly-assault': { dataType: 'zzz:deadly-assault', bg: 'imgs/actions/zzz/da.webp', name: 'Deadly Assault' },
};

// ─── Helpers ──────────────────────────────────────────────────────

/** Convert ZZZ date components to a Date. Server time is UTC+8. */
function toDate(dc: ZZZDateComponents): Date {
  return new Date(Date.UTC(dc.year, dc.month - 1, dc.day, dc.hour - 8, dc.minute, dc.second));
}

function formatShiyuDefense(data: ZZZShiyuDefense): EndgameDisplay {
  const timerText = data.hadal_end_time
    ? formatDaysRemaining(toDate(data.hadal_end_time))
    : data.end_time !== '0'
      ? formatDaysRemaining(new Date(parseInt(data.end_time) * 1000))
      : '--';

  return { progressText: `${data.zone_id}*`, timerText };
}

function formatDeadlyAssault(data: ZZZDeadlyAssault): EndgameDisplay {
  return {
    progressText: `${data.total_star}*`,
    timerText: formatDaysRemaining(toDate(data.end_time)),
  };
}

// ─── Action ───────────────────────────────────────────────────────

/**
 * Zenless Zone Zero Endgame Action
 * Displays Shiyu Defense or Deadly Assault progress.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.zzz.endgame" })
export class ZZZEndgameAction extends BaseEndgameAction<ZZZEndgameSettings, ZZZEndgameDataType> {
  protected readonly game = 'zzz' as const;
  protected readonly defaultMode = 'shiyu-defense';
  protected readonly modes = MODES;

  protected formatModeData(mode: string, data: unknown): EndgameDisplay {
    if (mode === 'deadly-assault') {
      return formatDeadlyAssault(data as ZZZDeadlyAssault);
    }
    return formatShiyuDefense(data as ZZZShiyuDefense);
  }
}
