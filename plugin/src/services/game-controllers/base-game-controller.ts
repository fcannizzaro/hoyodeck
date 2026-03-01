import streamDeck from '@elgato/streamdeck';
import type { HoyolabClient } from '@/api/hoyolab/client';
import type { GameId } from '@/types/games';
import type { DataType, DataEntry } from '../data-controller.types';
import { debug } from '@/utils/debug';

/**
 * Abstract base for per-game data fetching.
 * Each subclass knows which endpoints to call for its game.
 */
export abstract class BaseGameController {
  abstract readonly game: GameId;

  /**
   * Fetch all requested data types for a given account.
   * Uses Promise.allSettled — individual endpoint failures don't block others.
   *
   * @param client - Authenticated HoyolabClient for this account
   * @param uid - The user's in-game UID for this game
   * @param requestedTypes - Only fetch these data types
   */
  async fetchAll(
    client: HoyolabClient,
    uid: string,
    requestedTypes: DataType[],
  ): Promise<Map<DataType, DataEntry<unknown>>> {
    const results = new Map<DataType, DataEntry<unknown>>();
    const fetchers = this.getFetchers(client, uid);

    const entries = [...fetchers.entries()].filter(([type]) =>
      requestedTypes.includes(type),
    );
    debug.log('[GameController]', this.game, '| fetchAll | requested:', requestedTypes, '| fetching:', entries.map(([t]) => t));

    const settled = await Promise.allSettled(
      entries.map(async ([type, fetcher]) => {
        const data = await fetcher();
        return { type, data };
      }),
    );

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]!;
      const type = entries[i]![0];

      if (result.status === 'fulfilled') {
        results.set(result.value.type, {
          status: 'ok',
          data: result.value.data,
          fetchedAt: Date.now(),
        });
        debug.log('[GameController]', this.game, '| OK:', result.value.type);
      } else {
        streamDeck.logger.warn(
          `[${this.game}] Failed to fetch ${type}:`,
          result.reason,
        );
        results.set(type, {
          status: 'error',
          error:
            result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason)),
          fetchedAt: Date.now(),
        });
        debug.log('[GameController]', this.game, '| FAIL:', type);
      }
    }

    debug.log('[GameController]', this.game, '| fetchAll complete |', results.size, 'results');
    return results;
  }

  /**
   * Return a map of dataType → fetch function.
   * Subclasses define what each game can fetch.
   */
  protected abstract getFetchers(
    client: HoyolabClient,
    uid: string,
  ): Map<DataType, () => Promise<unknown>>;
}
