import type { HoyolabClient } from '@/api/hoyolab/client';
import type { DataType } from '../data-controller.types';
import { BaseGameController } from './base-game-controller';

/**
 * Genshin Impact data fetcher.
 * Handles: daily note, spiral abyss, act calendar, check-in.
 */
export class GenshinController extends BaseGameController {
  readonly game = 'gi' as const;

  protected getFetchers(
    client: HoyolabClient,
    uid: string,
  ): Map<DataType, () => Promise<unknown>> {
    return new Map<DataType, () => Promise<unknown>>([
      ['gi:daily-note', () => client.getGenshinDailyNote(uid)],
      ['gi:spiral-abyss', () => client.getGenshinSpiralAbyss(uid)],
      ['gi:act-calendar', () => client.getGenshinActCalendar(uid)],
      [
        'gi:check-in',
        async () => {
          const [info, rewards] = await Promise.all([
            client.getCheckInInfo('gi'),
            client.getCheckInRewards('gi'),
          ]);
          return { info, rewards };
        },
      ],
    ]);
  }
}
