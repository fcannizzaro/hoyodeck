import type { HoyolabClient } from '@/api/hoyolab/client';
import type { DataType } from '../data-controller.types';
import { BaseGameController } from './base-game-controller';

/**
 * Zenless Zone Zero data fetcher.
 * Handles: daily note, gacha calendar, check-in.
 */
export class ZZZController extends BaseGameController {
  readonly game = 'zzz' as const;

  protected getFetchers(
    client: HoyolabClient,
    uid: string,
  ): Map<DataType, () => Promise<unknown>> {
    return new Map<DataType, () => Promise<unknown>>([
      ['zzz:daily-note', () => client.getZZZDailyNote(uid)],
      ['zzz:gacha-calendar', () => client.getZZZGachaCalendar(uid)],
      [
        'zzz:check-in',
        async () => {
          const [info, rewards] = await Promise.all([
            client.getCheckInInfo('zzz'),
            client.getCheckInRewards('zzz'),
          ]);
          return { info, rewards };
        },
      ],
    ]);
  }
}
