import streamDeck from "@elgato/streamdeck";
import { GameIdSchema } from "@hoyodeck/shared/types";
import { z } from "zod";

// ─── Server API types ─────────────────────────────────────────────

/** Full response from `GET /api/patches` — patch info + metadata keyed by game */
const PatchSchema = z.record(GameIdSchema, z.string());
export type PatchesResponse = z.infer<typeof PatchSchema>;

// ─── Client ───────────────────────────────────────────────────────

/**
 * HTTP client for the server's `GET /api/patches` endpoint.
 *
 * Uses ETag-based caching: subsequent requests send `If-None-Match` —
 * a 304 means "nothing changed" and we reuse the cached data.
 *
 * Follows the same pattern as `CodesClient`.
 */
class PatchesClient {
  private available = true;
  private lastCheckAt = 0;
  private static readonly RECHECK_INTERVAL_MS = 60_000 * 60 * 2; // 2 hours

  /** Cached patch data */
  private cache: PatchesResponse | null = null;

  /**
   * Whether the server appears to be running.
   * Cached for 1 minute to avoid hammering a dead endpoint.
   */
  isAvailable(): boolean {
    if (Date.now() - this.lastCheckAt > PatchesClient.RECHECK_INTERVAL_MS) {
      return true; // Allow re-check
    }
    return this.available;
  }

  /**
   * Fetch current patch info for all games.
   *
   * Sends `If-None-Match` with the last ETag — if the server
   * responds 304, cached data is returned without re-parsing.
   *
   * Returns `null` when no data is available (server down + no cache).
   */
  async fetchPatches(): Promise<PatchesResponse | null> {
    try {
      const headers: Record<string, string> = {};

      const response = await fetch(`${__CODE_SERVER_URL__}/api/patches?end`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      this.lastCheckAt = Date.now();

      if (!response.ok) {
        this.available = false;
        throw new Error(`Patches server HTTP ${response.status}`);
      }

      this.available = true;

      const data = PatchSchema.safeParse(await response.json());

      // Check for error response
      if (data.error) {
        throw new Error(data.error.message);
      }

      this.cache = data.data;
      return this.cache;
    } catch (error) {
      streamDeck.logger.warn("[PatchesClient] fetchPatches failed:", error);
      return this.cache;
    }
  }
}

/** Singleton instance */
export const patchesClient = new PatchesClient();
