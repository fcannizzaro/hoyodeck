import streamDeck from "@elgato/streamdeck";
import type { GameId, GameCodeWithStatus } from "@hoyodeck/shared/types";

/**
 * HTTP client for the Codes Server's REST API.
 *
 * Separate from DataController — this communicates with the
 * codes-server process, not with HoYoLAB directly.
 *
 * Uses ETag-based caching: the server returns an ETag header tied to
 * its internal revision counter. Subsequent requests send
 * `If-None-Match` — a 304 means "nothing changed" and we reuse cache.
 */
class CodesClient {
  private available = true;
  private lastCheckAt = 0;
  private static readonly RECHECK_INTERVAL_MS = 60_000; // 1 minute

  /** Last ETag returned by the server */
  private lastEtag: string | undefined;

  /** Cached codes keyed by "game" or "all" */
  private readonly codesCache = new Map<string, GameCodeWithStatus[]>();

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

  /**
   * GET request with ETag support.
   * Returns `null` when the server responds 304 (not modified).
   */
  private async get<T>(path: string): Promise<{ data: T; etag?: string } | null> {
    const headers: Record<string, string> = {};

    if (this.lastEtag) {
      headers["If-None-Match"] = `"${this.lastEtag}"`;
    }

    const response = await fetch(`${__CODE_SERVER_URL__}${path}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    this.lastCheckAt = Date.now();

    if (response.status === 304) {
      this.available = true;
      return null; // Cache still valid
    }

    if (!response.ok) {
      this.available = false;
      throw new Error(`Codes server HTTP ${response.status}`);
    }

    this.available = true;

    const etag = response.headers.get("ETag")?.replace(/"/g, "");
    const data = (await response.json()) as T;

    return { data, etag };
  }

  /**
   * List codes, optionally filtered by game.
   *
   * Sends `If-None-Match` with the last ETag — if the server
   * responds 304, cached data is returned without re-parsing.
   */
  async listCodes(game?: GameId): Promise<GameCodeWithStatus[]> {
    const cacheKey = game ?? "all";

    try {
      const path = game ? `/codes/${game}` : "/codes";
      const result = await this.get<GameCodeWithStatus[] | Record<string, GameCodeWithStatus[]>>(
        path,
      );

      // 304 — cache still valid
      if (result === null) {
        return this.codesCache.get(cacheKey) ?? [];
      }

      // Update ETag
      if (result.etag) {
        this.lastEtag = result.etag;
      }

      let codes: GameCodeWithStatus[];

      if (game) {
        codes = result.data as GameCodeWithStatus[];
      } else {
        // /codes returns grouped by game — flatten
        const grouped = result.data as Record<string, GameCodeWithStatus[]>;
        codes = Object.values(grouped).flat();
      }

      this.codesCache.set(cacheKey, codes);
      return codes;
    } catch (error) {
      streamDeck.logger.warn("[CodesClient] listCodes failed:", error);
      return this.codesCache.get(cacheKey) ?? [];
    }
  }
}

/** Singleton instance */
export const codesClient = new CodesClient();
