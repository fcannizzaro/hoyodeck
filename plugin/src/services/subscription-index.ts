import streamDeck from "@elgato/streamdeck";
import type { AccountId } from "@/types/settings";
import type { GameId } from "@/types/games";
import type { DataType } from "./data-controller.types";
import { debug } from "@/utils/debug";

/**
 * Pre-computed index of active data subscriptions.
 *
 * Tracks which DataTypes are needed per account+game, with reference
 * counting so overlapping action subscriptions are handled correctly.
 *
 * Updated incrementally on register/unregister — never scans all
 * registrations. Logs a summary whenever subscriptions change.
 */
export class SubscriptionIndex {
  /**
   * accountId → gameId → dataType → subscriber count
   *
   * A dataType entry exists only while count > 0.
   * A game entry exists only while it has dataType entries.
   * An account entry exists only while it has game entries.
   */
  private readonly counts = new Map<AccountId, Map<GameId, Map<DataType, number>>>();

  /**
   * Add subscriptions for an action.
   * Call when registering an action with the DataController.
   */
  add(accountId: AccountId, dataTypes: DataType[]): void {
    debug.log("[SubscriptionIndex] add", accountId, dataTypes);
    for (const dt of dataTypes) {
      const game = dt.split(":")[0] as GameId;
      const byType = this.getOrCreateTypeMap(accountId, game);
      byType.set(dt, (byType.get(dt) ?? 0) + 1);
    }
    this.logSnapshot();
  }

  /**
   * Remove subscriptions for an action.
   * Call when unregistering an action from the DataController.
   */
  remove(accountId: AccountId, dataTypes: DataType[]): void {
    debug.log("[SubscriptionIndex] remove", accountId, dataTypes);
    const byGame = this.counts.get(accountId);
    if (!byGame) return;

    for (const dt of dataTypes) {
      const game = dt.split(":")[0] as GameId;
      const byType = byGame.get(game);
      if (!byType) continue;

      const count = (byType.get(dt) ?? 0) - 1;
      if (count <= 0) {
        byType.delete(dt);
      } else {
        byType.set(dt, count);
      }

      // Prune empty game level
      if (byType.size === 0) byGame.delete(game);
    }

    // Prune empty account level
    if (byGame.size === 0) this.counts.delete(accountId);
    this.logSnapshot();
  }

  /**
   * Get all account+game pairs that have active subscriptions.
   * Used by pollTick to determine what to fetch.
   */
  getActiveAccountGames(): Map<AccountId, Set<GameId>> {
    const result = new Map<AccountId, Set<GameId>>();
    for (const [accountId, byGame] of this.counts) {
      result.set(accountId, new Set(byGame.keys()));
    }
    return result;
  }

  /**
   * Get the unique data types needed for a specific account+game.
   * Used by pollTick and requestUpdate to decide which endpoints to call.
   */
  getActiveDataTypes(accountId: AccountId, game: GameId): DataType[] {
    const byType = this.counts.get(accountId)?.get(game);
    return byType ? [...byType.keys()] : [];
  }

  /** Whether there are any active subscriptions at all. */
  get hasSubscriptions(): boolean {
    return this.counts.size > 0;
  }

  // ─── Internal ──────────────────────────────────────────────────

  private getOrCreateTypeMap(accountId: AccountId, game: GameId): Map<DataType, number> {
    let byGame = this.counts.get(accountId);
    if (!byGame) {
      byGame = new Map();
      this.counts.set(accountId, byGame);
    }

    let byType = byGame.get(game);
    if (!byType) {
      byType = new Map();
      byGame.set(game, byType);
    }

    return byType;
  }

  /** Log current subscription snapshot whenever it changes. */
  private logSnapshot(): void {
    if (this.counts.size === 0) {
      streamDeck.logger.debug("[SubscriptionIndex] No active subscriptions");
      return;
    }

    const lines: string[] = [];
    for (const [accountId, byGame] of this.counts) {
      for (const [game, byType] of byGame) {
        const types = [...byType.entries()]
          .map(([dt, count]) => (count > 1 ? `${dt}(x${count})` : dt))
          .join(", ");
        lines.push(`  ${accountId}/${game}: ${types}`);
      }
    }

    streamDeck.logger.debug(`[SubscriptionIndex] Active subscriptions:\n${lines.join("\n")}`);
  }
}
