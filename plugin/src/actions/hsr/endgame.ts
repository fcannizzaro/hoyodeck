import { action } from "@elgato/streamdeck";
import { BaseEndgameAction, type EndgameDisplay, type EndgameModeConfig } from "../base/endgame-action";
import type { StarRailEndgameSettings } from "@/types/settings";
import type { DataType } from "@/services/data-controller.types";
import type { StarRailChallenge, StarRailChallengePeak, StarRailDateComponents } from "@/api/types/hsr";
import { formatDaysRemaining } from "@/utils/time";

/** Data types this action can subscribe to */
type HSREndgameDataType = 'hsr:memory-of-chaos' | 'hsr:pure-fiction' | 'hsr:apocalyptic-shadow' | 'hsr:anomaly-arbitration';

const MODES: Record<string, EndgameModeConfig> = {
  'memory-of-chaos': { dataType: 'hsr:memory-of-chaos', bg: 'imgs/actions/hsr/moc.webp', name: 'Memory of Chaos' },
  'pure-fiction': { dataType: 'hsr:pure-fiction', bg: 'imgs/actions/hsr/pf.webp', name: 'Pure Fiction' },
  'apocalyptic-shadow': { dataType: 'hsr:apocalyptic-shadow', bg: 'imgs/actions/hsr/as.webp', name: 'Apocalyptic Shadow' },
  'anomaly-arbitration': { dataType: 'hsr:anomaly-arbitration', bg: 'imgs/actions/hsr/aa.webp', name: 'Anomaly Arbitration' },
};

// ─── Helpers ──────────────────────────────────────────────────────

/** Convert HoYoLAB date components to a Date. Server time is UTC+8. */
function toDate(dc: StarRailDateComponents): Date {
  return new Date(Date.UTC(dc.year, dc.month - 1, dc.day, dc.hour - 8, dc.minute));
}

function formatChallenge(challenge: StarRailChallenge): EndgameDisplay {
  const endTimeComponents =
    challenge.end_time ??
    challenge.groups.find(g => g.status !== 'End')?.end_time;

  const timerText = endTimeComponents
    ? formatDaysRemaining(toDate(endTimeComponents))
    : '--';

  return {
    progressText: `${challenge.star_num}*`,
    timerText,
  };
}

function formatChallengePeak(peak: StarRailChallengePeak): EndgameDisplay {
  const record =
    peak.challenge_peak_records.find(r => r.group.status !== 'End') ??
    peak.challenge_peak_records[0];

  if (!record) {
    return { progressText: '0*', timerText: '--' };
  }

  const stars = record.mob_stars + record.boss_stars;
  return {
    progressText: `${stars}*`,
    timerText: formatDaysRemaining(toDate(record.group.end_time)),
  };
}

// ─── Action ───────────────────────────────────────────────────────

/**
 * Honkai: Star Rail Endgame Action
 * Displays Memory of Chaos, Pure Fiction, Apocalyptic Shadow, or Anomaly Arbitration progress.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.hsr.endgame" })
export class StarRailEndgameAction extends BaseEndgameAction<StarRailEndgameSettings, HSREndgameDataType> {
  protected readonly game = 'hsr' as const;
  protected readonly defaultMode = 'memory-of-chaos';
  protected readonly modes = MODES;

  protected formatModeData(mode: string, data: unknown): EndgameDisplay {
    if (mode === 'anomaly-arbitration') {
      return formatChallengePeak(data as StarRailChallengePeak);
    }
    return formatChallenge(data as StarRailChallenge);
  }
}
