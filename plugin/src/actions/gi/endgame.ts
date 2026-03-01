import { action } from "@elgato/streamdeck";
import { BaseEndgameAction, type EndgameDisplay, type EndgameModeConfig } from "../base/endgame-action";
import type { GenshinEndgameSettings } from "@/types/settings";
import type { DataType } from "@/services/data-controller.types";
import type { GenshinSpiralAbyss, GenshinImaginariumTheater, GenshinStygianOnslaught } from "@/api/types/genshin";
import { formatDaysRemaining } from "@/utils/time";

/** Data types this action can subscribe to */
type GenshinEndgameDataType = 'gi:spiral-abyss' | 'gi:imaginarium-theater' | 'gi:stygian-onslaught';

const MODES: Record<string, EndgameModeConfig> = {
  'spiral-abyss': { dataType: 'gi:spiral-abyss', bg: 'imgs/actions/gi/sa.webp', name: 'Spiral Abyss' },
  'imaginarium-theater': { dataType: 'gi:imaginarium-theater', bg: 'imgs/actions/gi/it.webp', name: 'Imaginarium Theater' },
  'stygian-onslaught': { dataType: 'gi:stygian-onslaught', bg: 'imgs/actions/gi/so.webp', name: 'Stygian Onslaught' },
};

// ─── Formatters ───────────────────────────────────────────────────

function formatSpiralAbyss(abyss: GenshinSpiralAbyss): EndgameDisplay {
  return {
    progressText: `${abyss.total_star}*`,
    timerText: formatDaysRemaining(new Date(parseInt(abyss.end_time) * 1000)),
  };
}

function formatImaginariumTheater(theater: GenshinImaginariumTheater): EndgameDisplay {
  if (!theater.data?.length) {
    return { progressText: '0*', timerText: '--' };
  }
  const current = theater.data.find(e => e.schedule.schedule_type === 1) ?? theater.data[0]!;
  const endMs = parseInt(current.schedule.end_time) * 1000;
  return {
    progressText: `${current.stat.medal_num}*`,
    timerText: formatDaysRemaining(new Date(endMs)),
  };
}

function formatStygianOnslaught(onslaught: GenshinStygianOnslaught): EndgameDisplay {
  if (!onslaught.data?.length) {
    return { progressText: '0*', timerText: '--' };
  }
  const current = onslaught.data.find(e => e.schedule.is_valid) ?? onslaught.data[0]!;
  const difficulty = current.single.best?.difficulty ?? 0;
  const endMs = parseInt(current.schedule.end_time) * 1000;
  return {
    progressText: `${difficulty}*`,
    timerText: formatDaysRemaining(new Date(endMs)),
  };
}

// ─── Action ───────────────────────────────────────────────────────

/**
 * Genshin Impact Endgame Action
 * Displays Spiral Abyss, Imaginarium Theater, or Stygian Onslaught progress.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.abyss" })
export class GenshinEndgameAction extends BaseEndgameAction<GenshinEndgameSettings, GenshinEndgameDataType> {
  protected readonly game = 'gi' as const;
  protected readonly defaultMode = 'spiral-abyss';
  protected readonly modes = MODES;

  protected formatModeData(mode: string, data: unknown): EndgameDisplay {
    switch (mode) {
      case 'imaginarium-theater':
        return formatImaginariumTheater(data as GenshinImaginariumTheater);
      case 'stygian-onslaught':
        return formatStygianOnslaught(data as GenshinStygianOnslaught);
      default:
        return formatSpiralAbyss(data as GenshinSpiralAbyss);
    }
  }
}
