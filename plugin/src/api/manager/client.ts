import streamDeck from '@elgato/streamdeck';
import type { CodeList } from '@/services/data-controller.types';

/**
 * Lightweight client for the Hoyo Deck Manager API.
 * Fetches code data for the Stream Deck plugin.
 */
export class ManagerClient {
  constructor(
    private readonly baseUrl: string,
    private readonly password: string,
  ) {}

  /**
   * Fetch codes for a game with claim status for a specific account.
   */
  async getCodeList(
    game: 'gi' | 'hsr' | 'zzz',
    accountId: string,
  ): Promise<CodeList> {
    const url = `${this.baseUrl}/api/rpc/listCodes`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-password': this.password,
      },
      body: JSON.stringify([{ game, accountId }]),
    });

    if (!response.ok) {
      throw new Error(`Manager API error: ${response.status}`);
    }

    const codes = await response.json() as Array<{
      id: number;
      code: string;
      rewards: string | null;
      claim_status: string | null;
    }>;

    const entries = codes.map((c) => ({
      id: c.id,
      code: c.code,
      rewards: c.rewards ?? undefined,
      status: (c.claim_status ?? 'new') as 'new' | 'claimed' | 'dismissed' | 'failed' | 'expired',
    }));

    const unclaimed = entries.filter((c) => c.status === 'new').length;

    return { codes: entries, unclaimed };
  }

  /**
   * Mark a code as claimed in the manager database.
   */
  async markClaimed(
    codeId: number,
    accountId: string,
    message?: string,
  ): Promise<void> {
    const url = `${this.baseUrl}/api/rpc/markClaimed`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-password': this.password,
      },
      body: JSON.stringify([{ codeId, accountId, message }]),
    });

    if (!response.ok) {
      streamDeck.logger.warn(`Failed to mark code ${codeId} as claimed: ${response.status}`);
    }
  }

  /**
   * Mark a code redeem as failed in the manager database.
   */
  async markFailed(
    codeId: number,
    accountId: string,
    message?: string,
  ): Promise<void> {
    const url = `${this.baseUrl}/api/rpc/markFailed`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-password': this.password,
      },
      body: JSON.stringify([{ codeId, accountId, message }]),
    });

    if (!response.ok) {
      streamDeck.logger.warn(`Failed to mark code ${codeId} as failed: ${response.status}`);
    }
  }
}

/** Singleton manager client — initialized lazily from environment */
let _client: ManagerClient | null = null;

export function getManagerClient(): ManagerClient | null {
  if (_client) return _client;

  const baseUrl = process.env.MANAGER_URL;
  const password = process.env.MANAGER_PASSWORD;

  if (!baseUrl || !password) {
    streamDeck.logger.warn('[ManagerClient] MANAGER_URL or MANAGER_PASSWORD not set — code features disabled');
    return null;
  }

  _client = new ManagerClient(baseUrl, password);
  return _client;
}
