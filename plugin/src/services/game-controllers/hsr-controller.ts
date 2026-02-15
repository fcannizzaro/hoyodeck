import type { HoyolabClient } from '@/api/hoyolab/client';
import type { DataType } from '../data-controller.types';
import { BaseGameController } from './base-game-controller';

/**
 * Honkai: Star Rail data fetcher.
 * Handles: daily note, act calendar, check-in.
 */
export class HSRController extends BaseGameController {
  readonly game = 'hsr' as const;

  protected getFetchers(
    client: HoyolabClient,
    uid: string,
  ): Map<DataType, () => Promise<unknown>> {
    return new Map<DataType, () => Promise<unknown>>([
      ['hsr:daily-note', () => client.getStarRailDailyNote(uid)],
      ['hsr:act-calendar', () => client.getStarRailActCalendar(uid)],
      [
        'hsr:check-in',
        async () => {
          const [info, rewards] = await Promise.all([
            client.getCheckInInfo('hsr'),
            client.getCheckInRewards('hsr'),
          ]);
          return { info, rewards };
        },
      ],
    ]);
  }
}
