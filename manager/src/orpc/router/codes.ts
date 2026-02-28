import { os } from '@orpc/server'
import { z } from 'zod'
import { authMiddleware } from '@/orpc/middleware/auth'
import { getDb } from '@/services/database'
import { crawlCodes } from '@/services/crawler'

const authed = os.use(authMiddleware)

const GameIdSchema = z.enum(['gi', 'hsr', 'zzz'])

export type ClaimStatus = 'new' | 'claimed' | 'dismissed' | 'failed' | 'expired'

export interface CodeRow {
  id: number
  game: string
  code: string
  rewards: string | null
  source: string | null
  discovered_at: number
  expires_at: number | null
  claim_status: ClaimStatus | null
}

/**
 * List codes, optionally filtered by game and/or with claim status for a specific account.
 */
export const listCodes = authed
  .input(
    z.object({
      game: GameIdSchema.optional(),
      accountId: z.string().optional(),
    }),
  )
  .handler(({ input }) => {
    const db = getDb()

    let query: string
    const params: unknown[] = []

    if (input.accountId) {
      query = `
        SELECT
          c.id, c.game, c.code, c.rewards, c.source, c.discovered_at, c.expires_at,
          cc.status AS claim_status
        FROM codes c
        LEFT JOIN code_claims cc ON cc.code_id = c.id AND cc.account_id = ?
      `
      params.push(input.accountId)
    } else {
      query = `
        SELECT
          c.id, c.game, c.code, c.rewards, c.source, c.discovered_at, c.expires_at,
          NULL AS claim_status
        FROM codes c
      `
    }

    if (input.game) {
      query += ` WHERE c.game = ?`
      params.push(input.game)
    }

    query += ` ORDER BY c.discovered_at DESC`

    return db.prepare(query).all(...params) as CodeRow[]
  })

/**
 * Mark a code as claimed for a specific account.
 */
export const markClaimed = authed
  .input(
    z.object({
      codeId: z.number(),
      accountId: z.string(),
      message: z.string().optional(),
    }),
  )
  .handler(({ input }) => {
    const db = getDb()
    db.prepare(
      `INSERT INTO code_claims (code_id, account_id, status, message)
       VALUES (?, ?, 'claimed', ?)
       ON CONFLICT(code_id, account_id) DO UPDATE SET status = 'claimed', message = excluded.message, claimed_at = unixepoch()`,
    ).run(input.codeId, input.accountId, input.message ?? null)
    return { success: true }
  })

/**
 * Mark a code redeem as failed for a specific account.
 */
export const markFailed = authed
  .input(
    z.object({
      codeId: z.number(),
      accountId: z.string(),
      message: z.string().optional(),
    }),
  )
  .handler(({ input }) => {
    const db = getDb()
    db.prepare(
      `INSERT INTO code_claims (code_id, account_id, status, message)
       VALUES (?, ?, 'failed', ?)
       ON CONFLICT(code_id, account_id) DO UPDATE SET status = 'failed', message = excluded.message, claimed_at = unixepoch()`,
    ).run(input.codeId, input.accountId, input.message ?? null)
    return { success: true }
  })

/**
 * Dismiss a code for a specific account (user doesn't want it).
 */
export const dismissCode = authed
  .input(
    z.object({
      codeId: z.number(),
      accountId: z.string(),
    }),
  )
  .handler(({ input }) => {
    const db = getDb()
    db.prepare(
      `INSERT INTO code_claims (code_id, account_id, status)
       VALUES (?, ?, 'dismissed')
       ON CONFLICT(code_id, account_id) DO UPDATE SET status = 'dismissed', claimed_at = unixepoch()`,
    ).run(input.codeId, input.accountId)
    return { success: true }
  })

/**
 * Manually trigger a code crawl.
 */
export const triggerCrawl = authed
  .input(z.object({}))
  .handler(async () => {
    return await crawlCodes()
  })
