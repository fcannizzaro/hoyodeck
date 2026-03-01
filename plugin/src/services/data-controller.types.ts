import type { AccountId, GameId } from '@/types/settings';
import type {
  GenshinDailyNote,
  GenshinSpiralAbyss,
  GenshinActCalendar,
  GenshinImaginariumTheater,
  GenshinStygianOnslaught,
} from '@/api/types/genshin';
import type { StarRailDailyNote, StarRailActCalendar, StarRailChallenge, StarRailChallengePeak } from '@/api/types/hsr';
import type { ZZZDailyNote, ZZZGachaCalendar, ZZZShiyuDefense, ZZZDeadlyAssault } from '@/api/types/zzz';
import type { CheckInInfo, CheckInRewards } from '@/api/types/check-in';

// ─── Data Type Registry ───────────────────────────────────────────

/**
 * Maps every fetchable data type key to its response type.
 * Key format: `${GameId}:${EndpointName}`
 */
export interface DataTypeMap {
  // Genshin Impact
  'gi:daily-note': GenshinDailyNote;
  'gi:spiral-abyss': GenshinSpiralAbyss;
  'gi:imaginarium-theater': GenshinImaginariumTheater;
  'gi:stygian-onslaught': GenshinStygianOnslaught;
  'gi:act-calendar': GenshinActCalendar;
  'gi:check-in': CheckInData;

  // Honkai: Star Rail
  'hsr:daily-note': StarRailDailyNote;
  'hsr:memory-of-chaos': StarRailChallenge;
  'hsr:pure-fiction': StarRailChallenge;
  'hsr:apocalyptic-shadow': StarRailChallenge;
  'hsr:anomaly-arbitration': StarRailChallengePeak;
  'hsr:act-calendar': StarRailActCalendar;
  'hsr:check-in': CheckInData;

  // Zenless Zone Zero
  'zzz:daily-note': ZZZDailyNote;
  'zzz:shiyu-defense': ZZZShiyuDefense;
  'zzz:deadly-assault': ZZZDeadlyAssault;
  'zzz:gacha-calendar': ZZZGachaCalendar;
  'zzz:check-in': CheckInData;
}

/** Combined check-in data (info + rewards fetched together) */
export interface CheckInData {
  info: CheckInInfo;
  rewards: CheckInRewards;
}

/** All valid data type keys */
export type DataType = keyof DataTypeMap;

// ─── Data Store ───────────────────────────────────────────────────

/** Stored entry for a single data fetch */
export type DataEntry<T> =
  | { status: 'ok'; data: T; fetchedAt: number }
  | { status: 'error'; error: Error; fetchedAt: number };

/** A DataEntry that is guaranteed to be successful */
export type SuccessDataEntry<T> = Extract<DataEntry<T>, { status: 'ok' }>;

/**
 * Composite key for the data store: `${accountId}:${dataType}`
 * e.g. "abc-123:gi:daily-note"
 */
export type DataStoreKey = `${AccountId}:${DataType}`;

// ─── Subscription API ─────────────────────────────────────────────

/** Payload passed to listeners when new data arrives */
export interface DataUpdate<T extends DataType = DataType> {
  accountId: AccountId;
  dataType: T;
  entry: DataEntry<DataTypeMap[T]>;
}

/** A DataUpdate where the entry is guaranteed to be successful (status: 'ok') */
export interface SuccessDataUpdate<T extends DataType = DataType> {
  accountId: AccountId;
  dataType: T;
  entry: SuccessDataEntry<DataTypeMap[T]>;
}

/** Callback signature for data subscribers */
export type DataListener = (update: DataUpdate) => void;

/** Registration info tracked per visible action instance */
export interface ActionRegistration {
  /** The Stream Deck action's unique context ID */
  actionId: string;
  /** Which account this action instance is bound to */
  accountId: AccountId;
  /** Which data types this action needs */
  dataTypes: DataType[];
  /** Callback invoked when any of the subscribed data types update */
  listener: DataListener;
  /** Called when the bound account is deleted. Action should show "Select Account". */
  onAccountRemoved?: () => void;
  /** Called when the account map structure changes (add/delete/UID change). */
  onStructureChanged?: () => void;
}

// ─── Controller Configuration ─────────────────────────────────────

export interface DataControllerConfig {
  /** Polling interval in milliseconds */
  pollIntervalMs: number;
}

/** Default: poll every 5 minutes */
export const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;

/** Which data types each game can produce */
export const GAME_DATA_TYPES: Record<GameId, DataType[]> = {
  gi: ['gi:daily-note', 'gi:spiral-abyss', 'gi:imaginarium-theater', 'gi:stygian-onslaught', 'gi:act-calendar', 'gi:check-in'],
  hsr: ['hsr:daily-note', 'hsr:memory-of-chaos', 'hsr:pure-fiction', 'hsr:apocalyptic-shadow', 'hsr:anomaly-arbitration', 'hsr:act-calendar', 'hsr:check-in'],
  zzz: ['zzz:daily-note', 'zzz:shiyu-defense', 'zzz:deadly-assault', 'zzz:gacha-calendar', 'zzz:check-in'],
};
