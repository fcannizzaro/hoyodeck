import streamDeck from "@elgato/streamdeck";
import type { GameId } from "@hoyodeck/shared/types";

/**
 * HTTP client for the Codes Server's REST API.
 *
 * Separate from DataController — this communicates with the
 * codes-server process, not with HoYoLAB directly.
 */
class CodesClient {
  private available = true;
  private lastCheckAt = 0;
  private static readonly RECHECK_INTERVAL_MS = 60_000; // 1 minute

  /** Cached codes keyed by game */
  private readonly codesCache = new Map<string, string[]>();

  /**
   * Whether the codes-server appears to be running.
   * Cached for 1 minute to avoid hammering a dead endpoint.
   */
  isAvailable(): boolean {
    if (Date.now() - this.lastCheckAt > CodesClient.RECHECK_INTERVAL_MS) {
      return true; // Allow re-check
    }
    return this.available;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${__CODE_SERVER_URL__}${path}`, {
      signal: AbortSignal.timeout(5000),
    });

    this.lastCheckAt = Date.now();

    if (!response.ok) {
      this.available = false;
      throw new Error(`Codes server HTTP ${response.status}`);
    }

    this.available = true;
    return (await response.json()) as T;
  }

  async listCodes(game: GameId): Promise<string[]> {
    try {
      const codes = await this.get<string[]>(`/api/codes/${game}?plugin`);
      this.codesCache.set(game, codes);
      return codes;
    } catch (error) {
      streamDeck.logger.warn("[CodesClient] listCodes failed:", error);
      return this.codesCache.get(game) ?? [];
    }
  }
}

/** Singleton instance */
export const codesClient = new CodesClient();
