import type { Database } from 'bun:sqlite'
import { getDb } from './database'

type GameId = 'gi' | 'hsr' | 'zzz'

interface CrawledCode {
  game: GameId
  code: string
  rewards?: string
  source: string
}

/** Response shape from hoyo-codes.seria.moe */
interface HoyoCodesResponse {
  codes: Array<{
    code: string
    rewards: string[]
  }>
}

const HOYO_CODES_BASE = 'https://hoyo-codes.seria.moe/codes'

const GAME_QUERY: Record<GameId, string> = {
  gi: 'genshin-impact',
  hsr: 'honkai-star-rail',
  zzz: 'zenless-zone-zero',
}

async function fetchHoyoCodes(game: GameId): Promise<CrawledCode[]> {
  const url = `${HOYO_CODES_BASE}?game=${GAME_QUERY[game]}`
  const res = await fetch(url)

  if (!res.ok) {
    console.error(`[crawler] Failed to fetch ${game} codes: ${res.status}`)
    return []
  }

  const data = (await res.json()) as HoyoCodesResponse

  return data.codes.map((c) => ({
    game,
    code: c.code.trim(),
    rewards: c.rewards.join(', ') || undefined,
    source: 'hoyo-codes',
  }))
}

function persistCodes(db: Database, codes: CrawledCode[]): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO codes (game, code, rewards, source)
    VALUES (?, ?, ?, ?)
  `)

  let inserted = 0
  for (const c of codes) {
    const result = stmt.run(c.game, c.code, c.rewards ?? null, c.source)
    if (result.changes > 0) inserted++
  }
  return inserted
}

/** Crawl all games and persist new codes. Returns { found, new }. */
export async function crawlCodes(): Promise<{ found: number; inserted: number }> {
  const games: GameId[] = ['gi', 'hsr', 'zzz']

  const results = await Promise.allSettled(games.map(fetchHoyoCodes))
  const allCodes: CrawledCode[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allCodes.push(...result.value)
    }
  }

  const db = getDb()
  const inserted = persistCodes(db, allCodes)

  console.log(`[crawler] Found ${allCodes.length} codes, ${inserted} new`)
  return { found: allCodes.length, inserted }
}

let crawlInterval: ReturnType<typeof setInterval> | null = null

/** Start the crawler: run immediately, then every 30 minutes */
export function startCrawler(): void {
  if (crawlInterval) return

  // Initial crawl
  void crawlCodes()

  // Schedule every 30 minutes
  crawlInterval = setInterval(() => {
    void crawlCodes()
  }, 30 * 60 * 1000)

  console.log('[crawler] Started (30m interval)')
}

export function stopCrawler(): void {
  if (crawlInterval) {
    clearInterval(crawlInterval)
    crawlInterval = null
  }
}
