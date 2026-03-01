# Redeem Codes & Manager Platform — Implementation Guide

> Branch: `feat/redeem-codes`
> 5 commits, 30+ files changed
> Depends on: `feat/account-picking-strategy` (apply that first)

---

## Overview

Three major pieces:

1. **Rename `inpaint-eyes/` → `manager/`** — rebrand as "Hoyo Deck Manager"
2. **Manager backend** — SQLite database, code crawler, oRPC API, `/codes` dashboard
3. **Plugin side** — HoYoLAB code redemption API, Manager client, `RedeemCodeAction`, PI panel

---

## Part 1: Rename `inpaint-eyes/` → `manager/`

### 1.1 Move the directory

```bash
git mv inpaint-eyes manager
```

### 1.2 `manager/package.json`

Change the name:

```diff
-  "name": "inpaint-eyes",
+  "name": "@hoyodeck/manager",
```

Add dev dependency:

```diff
  "devDependencies": {
    "@tanstack/devtools-vite": "^0.5.1",
+   "@types/bun": "^1.3.9",
    "@types/node": "^25.2.3",
```

### 1.3 `manager/.gitignore`

Add at the end:

```
data/
```

### 1.4 `manager/src/components/Header.tsx`

Replace the header with manager branding and add a "Codes" nav link:

```tsx
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, Paintbrush, Images, TicketCheck } from 'lucide-react'
import { getPassword, clearPassword } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'

export default function Header() {
  const navigate = useNavigate()
  const isAuthenticated = typeof window !== 'undefined' && !!getPassword()

  const handleLogout = () => {
    clearPassword()
    navigate({ to: '/' })
  }

  return (
    <header className="border-b border-border bg-card px-4 py-2 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-base">🎮</span>
        <span className="font-semibold text-sm">Hoyo Deck Manager</span>
      </Link>

      {isAuthenticated && (
        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/codes">
              <TicketCheck className="h-4 w-4 mr-1" />
              Codes
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/editor">
              <Paintbrush className="h-4 w-4 mr-1" />
              Editor
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/gallery">
              <Images className="h-4 w-4 mr-1" />
              Gallery
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </header>
  )
}
```

### 1.5 `manager/src/routes/__root.tsx`

Update the page title:

```diff
-        title: 'inpaint-eyes',
+        title: 'Hoyo Deck Manager',
```

---

## Part 2: Manager Backend

### 2.1 NEW FILE: `manager/src/services/database.ts`

SQLite singleton with auto-migration using `bun:sqlite`:

```typescript
import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = join(DATA_DIR, 'codes.db')

let _db: Database | null = null

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.run('PRAGMA journal_mode = WAL')
    _db.run('PRAGMA foreign_keys = ON')
    migrate(_db)
  }
  return _db
}

function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS codes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      game           TEXT NOT NULL CHECK(game IN ('gi', 'hsr', 'zzz')),
      code           TEXT NOT NULL,
      rewards        TEXT,
      source         TEXT,
      discovered_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at     INTEGER,
      UNIQUE(game, code)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS code_claims (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code_id    INTEGER NOT NULL REFERENCES codes(id),
      account_id TEXT NOT NULL,
      status     TEXT NOT NULL CHECK(status IN ('claimed', 'dismissed', 'failed', 'expired')),
      claimed_at INTEGER NOT NULL DEFAULT (unixepoch()),
      message    TEXT,
      UNIQUE(code_id, account_id)
    )
  `)
}
```

### 2.2 NEW FILE: `manager/src/services/crawler.ts`

Fetches codes from `hoyo-codes.seria.moe` for all 3 games:

```typescript
import type { Database } from 'bun:sqlite'
import { getDb } from './database'

type GameId = 'gi' | 'hsr' | 'zzz'

interface CrawledCode {
  game: GameId
  code: string
  rewards?: string
  source: string
}

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

export function startCrawler(): void {
  if (crawlInterval) return
  void crawlCodes()
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
```

### 2.3 NEW FILE: `manager/src/services/init.ts`

Boot-time service initializer:

```typescript
import { startCrawler } from './crawler'

let initialized = false

export function initServices(): void {
  if (initialized) return
  initialized = true
  startCrawler()
}
```

### 2.4 `manager/src/routes/api.rpc.$.ts`

Add service initialization on first module load:

```diff
+import { initServices } from '@/services/init'
+
+// Start background services (crawler, etc.) on first server module load
+initServices()
+
 const handler = new RPCHandler(router)
```

### 2.5 NEW FILE: `manager/src/orpc/router/codes.ts`

Full oRPC codes router — 5 endpoints:

```typescript
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

// ─── listCodes ────────────────────────────────────────────────────
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

// ─── markClaimed ──────────────────────────────────────────────────
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

// ─── markFailed ───────────────────────────────────────────────────
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

// ─── dismissCode ──────────────────────────────────────────────────
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

// ─── triggerCrawl ─────────────────────────────────────────────────
export const triggerCrawl = authed
  .input(z.object({}))
  .handler(async () => {
    return await crawlCodes()
  })
```

### 2.6 `manager/src/orpc/router/index.ts`

Register the new codes endpoints:

```diff
 import { verifyPassword } from './auth'
 import { listAvatars, saveAvatar, deleteAvatar } from './avatars'
 import { generateInpaint } from './inpaint'
+import { listCodes, markClaimed, markFailed, dismissCode, triggerCrawl } from './codes'

 export default {
   verifyPassword,
   listAvatars,
   saveAvatar,
   deleteAvatar,
   generateInpaint,
+  listCodes,
+  markClaimed,
+  markFailed,
+  dismissCode,
+  triggerCrawl,
 }
```

### 2.7 NEW FILE: `manager/src/routes/codes.tsx`

Full codes dashboard page — game filter tabs, copy-to-clipboard, dismiss, manual refresh:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getPassword } from '@/lib/auth-store'
import { orpc, client } from '@/orpc/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { RefreshCw, Loader2, X, Copy, Check } from 'lucide-react'

type GameId = 'gi' | 'hsr' | 'zzz'
type GameFilter = GameId | 'all'

const GAME_LABELS: Record<GameFilter, string> = {
  all: 'All',
  gi: 'Genshin Impact',
  hsr: 'Star Rail',
  zzz: 'Zenless Zone Zero',
}

const GAME_BADGES: Record<GameId, { label: string; className: string }> = {
  gi: { label: 'GI', className: 'bg-amber-500/20 text-amber-400' },
  hsr: { label: 'HSR', className: 'bg-blue-500/20 text-blue-400' },
  zzz: { label: 'ZZZ', className: 'bg-emerald-500/20 text-emerald-400' },
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-sky-500/20 text-sky-400' },
  claimed: { label: 'Claimed', className: 'bg-green-500/20 text-green-400' },
  dismissed: { label: 'Dismissed', className: 'bg-zinc-500/20 text-zinc-400' },
  failed: { label: 'Failed', className: 'bg-red-500/20 text-red-400' },
  expired: { label: 'Expired', className: 'bg-orange-500/20 text-orange-400' },
}

export const Route = createFileRoute('/codes')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !getPassword()) {
      throw redirect({ to: '/' })
    }
  },
  component: CodesPage,
})

function CodesPage() {
  const queryClient = useQueryClient()
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [isCrawling, setIsCrawling] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const queryInput = gameFilter === 'all' ? {} : { game: gameFilter as GameId }
  const queryOptions = orpc.listCodes.queryOptions({ input: queryInput })
  const { data: codes, isLoading } = useQuery(queryOptions)

  const handleCrawl = async () => {
    setIsCrawling(true)
    try {
      await client.triggerCrawl({})
      queryClient.invalidateQueries({ queryKey: queryOptions.queryKey })
    } finally {
      setIsCrawling(false)
    }
  }

  const handleDismiss = async (codeId: number) => {
    await client.dismissCode({ codeId, accountId: '_global' })
    queryClient.invalidateQueries({ queryKey: queryOptions.queryKey })
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Redeem Codes</h1>
          <Button size="sm" variant="outline" onClick={handleCrawl} disabled={isCrawling}>
            {isCrawling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>

        {/* Game filter tabs */}
        <div className="flex gap-1">
          {(Object.keys(GAME_LABELS) as GameFilter[]).map((game) => (
            <Button
              key={game}
              size="sm"
              variant={gameFilter === game ? 'default' : 'ghost'}
              onClick={() => setGameFilter(game)}
              className="text-xs"
            >
              {game === 'all' ? 'All' : GAME_LABELS[game]}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !codes?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No codes found. Try refreshing.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {codes.map((code) => {
              const gameBadge = GAME_BADGES[code.game as GameId]
              const status = (code.claim_status as string) ?? 'new'
              const statusBadge = STATUS_BADGES[status] ?? STATUS_BADGES['new']!

              return (
                <Card key={code.id}>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${gameBadge?.className}`}>
                      {gameBadge?.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-semibold">{code.code}</code>
                        <button
                          onClick={() => handleCopy(code.code)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      {code.rewards && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{code.rewards}</p>
                      )}
                    </div>

                    <div className="text-right text-xs text-muted-foreground hidden sm:block">
                      {code.source && <div>{code.source}</div>}
                      <div>{formatDate(code.discovered_at)}</div>
                    </div>

                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadge?.className}`}>
                      {statusBadge?.label}
                    </span>

                    {status === 'new' && (
                      <button
                        onClick={() => handleDismiss(code.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Part 3: Plugin Side

### 3.1 `plugin/src/api/hoyolab/constants.ts`

Add redemption URLs and game biz identifiers at the end:

```typescript
/**
 * Code redemption base URLs per game
 */
export const REDEEM_URLS: Record<string, string> = {
  gi: 'https://sg-hk4e-api.hoyolab.com/common/apicdkey/api/webExchangeCdkey',
  hsr: 'https://sg-hkrpg-api.hoyolab.com/common/apicdkey/api/webExchangeCdkey',
  zzz: 'https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey',
} as const;

/**
 * Game biz identifiers for code redemption
 */
export const GAME_BIZ: Record<string, string> = {
  gi: 'hk4e_global',
  hsr: 'hkrpg_global',
  zzz: 'nap_global',
} as const;
```

### 3.2 `plugin/src/api/hoyolab/client.ts`

Update imports and add `redeemCode()` method to the `HoyolabClient` class.

**Import change:**

```diff
-import { API_URLS, COMMON_HEADERS, GENSHIN, STAR_RAIL, ZZZ } from './constants';
+import { API_URLS, COMMON_HEADERS, GENSHIN, STAR_RAIL, ZZZ, REDEEM_URLS, GAME_BIZ } from './constants';
```

**Add method at the end of the class (before the closing `}`):**

```typescript
  // ============================================
  // Code Redemption
  // ============================================

  /**
   * Redeem a gift code for a specific game.
   *
   * @param game - Game identifier (gi, hsr, zzz)
   * @param code - The redemption code
   * @param uid - In-game UID
   * @throws {HoyolabApiError} On already-redeemed, expired, or invalid codes
   */
  async redeemCode(game: GameId, code: string, uid: string): Promise<void> {
    const region = getRegionFromUid(uid, game);
    const redeemUrl = REDEEM_URLS[game];
    const gameBiz = GAME_BIZ[game];

    if (!redeemUrl || !gameBiz) {
      throw new Error(`Unsupported game for code redemption: ${game}`);
    }

    const params = new URLSearchParams({
      uid,
      region,
      lang: 'en',
      cdkey: code,
      game_biz: gameBiz,
    });

    const url = `${redeemUrl}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...COMMON_HEADERS,
        Cookie: this.cookieString,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as ApiResponse<unknown>;

    if (!isSuccess(json)) {
      throw new HoyolabApiError(json.retcode, json.message);
    }
  }
```

### 3.3 NEW FILE: `plugin/src/api/manager/client.ts`

Lightweight HTTP client for the Manager API:

```typescript
import streamDeck from '@elgato/streamdeck';
import type { CodeList } from '@/services/data-controller.types';

export class ManagerClient {
  constructor(
    private readonly baseUrl: string,
    private readonly password: string,
  ) {}

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

  async markClaimed(codeId: number, accountId: string, message?: string): Promise<void> {
    const url = `${this.baseUrl}/api/rpc/markClaimed`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': this.password },
      body: JSON.stringify([{ codeId, accountId, message }]),
    });
    if (!response.ok) {
      streamDeck.logger.warn(`Failed to mark code ${codeId} as claimed: ${response.status}`);
    }
  }

  async markFailed(codeId: number, accountId: string, message?: string): Promise<void> {
    const url = `${this.baseUrl}/api/rpc/markFailed`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': this.password },
      body: JSON.stringify([{ codeId, accountId, message }]),
    });
    if (!response.ok) {
      streamDeck.logger.warn(`Failed to mark code ${codeId} as failed: ${response.status}`);
    }
  }
}

/** Singleton — lazily initialized from env vars */
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
```

### 3.4 `plugin/src/services/data-controller.types.ts`

**Add to `DataTypeMap` (inside the interface):**

```typescript
  // Redeem Codes
  'gi:codes': CodeList;
  'hsr:codes': CodeList;
  'zzz:codes': CodeList;
```

**Update `GAME_DATA_TYPES`:**

```diff
-  gi: ['gi:daily-note', 'gi:spiral-abyss', 'gi:act-calendar', 'gi:check-in'],
-  hsr: ['hsr:daily-note', 'hsr:act-calendar', 'hsr:check-in'],
-  zzz: ['zzz:daily-note', 'zzz:gacha-calendar', 'zzz:check-in'],
+  gi: ['gi:daily-note', 'gi:spiral-abyss', 'gi:act-calendar', 'gi:check-in', 'gi:codes'],
+  hsr: ['hsr:daily-note', 'hsr:act-calendar', 'hsr:check-in', 'hsr:codes'],
+  zzz: ['zzz:daily-note', 'zzz:gacha-calendar', 'zzz:check-in', 'zzz:codes'],
```

**Add at the end of the file:**

```typescript
// ─── Redeem Codes ─────────────────────────────────────────────────

export interface CodeEntry {
  id: number;
  code: string;
  rewards?: string;
  status: 'new' | 'claimed' | 'dismissed' | 'failed' | 'expired';
}

export interface CodeList {
  codes: CodeEntry[];
  unclaimed: number;
}
```

### 3.5 `plugin/src/services/game-controllers/base-game-controller.ts`

Add codes fetcher to the base controller so all games inherit it.

**Import changes:**

```diff
 import streamDeck from '@elgato/streamdeck';
 import type { HoyolabClient } from '@/api/hoyolab/client';
+import { getManagerClient } from '@/api/manager/client';
 import type { GameId } from '@/types/games';
-import type { DataType, DataEntry } from '../data-controller.types';
+import type { DataType, DataEntry, CodeList } from '../data-controller.types';
```

**Update `fetchAll` signature and add codes fetcher logic:**

```typescript
  async fetchAll(
    client: HoyolabClient,
    uid: string,
    requestedTypes: DataType[],
    accountId?: string,    // ← NEW parameter
  ): Promise<Map<DataType, DataEntry<unknown>>> {
    const results = new Map<DataType, DataEntry<unknown>>();
    const fetchers = this.getFetchers(client, uid);

    // ← NEW: Add codes fetcher if requested and manager is configured
    const codesType = `${this.game}:codes` as DataType;
    if (requestedTypes.includes(codesType) && !fetchers.has(codesType) && accountId) {
      const managerClient = getManagerClient();
      if (managerClient) {
        fetchers.set(codesType, () => managerClient.getCodeList(this.game, accountId));
      }
    }

    // ... rest of existing fetchAll logic unchanged ...
  }
```

### 3.6 `plugin/src/services/data-controller.ts`

Pass `accountId` through to `fetchAll`:

```diff
-    const results = await controller.fetchAll(client, uid, dataTypes);
+    const results = await controller.fetchAll(client, uid, dataTypes, accountId);
```

### 3.7 NEW FILE: `plugin/src/actions/common/redeem-code.ts`

Full action class:

```typescript
import streamDeck, { action, type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';
import { BaseAction } from '../base/base-action';
import type { RedeemCodeSettings } from '@/types/settings';
import type { GameId } from '@/types/games';
import type { DataType, SuccessDataUpdate, CodeList } from '@/services/data-controller.types';
import { dataController } from '@/services/data-controller';
import { getManagerClient } from '@/api/manager/client';
import { HoyolabApiError } from '@/api/types/common';
import { buildBadgeSvg } from '@/utils/banner';
import { readLocalImageAsDataUri } from '@/utils/image';

const GAME_BACKGROUNDS: Record<GameId, string> = {
  gi: 'imgs/actions/gi/5-star.webp',
  hsr: 'imgs/actions/hsr/5-star.png',
  zzz: 'imgs/actions/zzz/5-star.png',
};

const SIZE = 144;

@action({ UUID: 'com.fcannizzaro.hoyodeck.redeem-code' })
export class RedeemCodeAction extends BaseAction<
  RedeemCodeSettings,
  'gi:codes' | 'hsr:codes' | 'zzz:codes'
> {
  protected readonly game = 'gi' as const;

  protected override getResolvedGame(settings: RedeemCodeSettings): GameId {
    return settings.game ?? 'gi';
  }

  protected getSubscribedDataTypes(settings: RedeemCodeSettings): DataType[] {
    const game = settings.game ?? 'gi';
    return [`${game}:codes`];
  }

  protected override async onDataUpdate(
    action: KeyAction<RedeemCodeSettings>,
    update: SuccessDataUpdate<'gi:codes' | 'hsr:codes' | 'zzz:codes'>,
  ): Promise<void> {
    const codeList = update.entry.data;
    const settings = await action.getSettings();
    const game = settings.game ?? 'gi';
    await this.renderCodeBadge(action, game, codeList);
  }

  override async onKeyDown(ev: KeyDownEvent<RedeemCodeSettings>): Promise<void> {
    await this.withErrorHandling(ev.action, async () => {
      const ctx = await this.getAccountContext(ev.payload.settings, ev.action);
      if (!ctx) { await this.showNoAccount(ev.action); return; }

      const game = ev.payload.settings.game ?? 'gi';
      const uid = this.getGameUid(ctx.account, game);
      if (!uid) { await this.showNoUid(ev.action); return; }

      // Get cached codes
      const cached = dataController.getData(ctx.account.id, `${game}:codes`);
      if (cached?.status !== 'ok') {
        await dataController.requestUpdate(ctx.account.id, game);
        return;
      }

      const codeList = cached.data as CodeList;
      const nextCode = codeList.codes.find((c) => c.status === 'new');

      if (!nextCode) {
        await ev.action.showOk();
        return;
      }

      const managerClient = getManagerClient();

      try {
        await ctx.client.redeemCode(game, nextCode.code, uid);
        streamDeck.logger.info(`[RedeemCode] Redeemed ${nextCode.code} for ${game}`);
        await ev.action.showOk();
        if (managerClient) {
          await managerClient.markClaimed(nextCode.id, ctx.account.id);
        }
      } catch (error) {
        if (error instanceof HoyolabApiError) {
          if (error.retcode === -2001) {
            // Already redeemed
            await ev.action.showOk();
            if (managerClient) {
              await managerClient.markClaimed(nextCode.id, ctx.account.id, 'Already redeemed');
            }
          } else {
            if (managerClient) {
              await managerClient.markFailed(nextCode.id, ctx.account.id, error.message);
            }
            throw error;
          }
        } else {
          throw error;
        }
      }

      await dataController.requestUpdate(ctx.account.id, game);
    });
  }

  private async renderCodeBadge(
    action: KeyAction<RedeemCodeSettings>,
    game: GameId,
    codeList: CodeList,
  ): Promise<void> {
    const bgDataUri = readLocalImageAsDataUri(GAME_BACKGROUNDS[game]);
    const count = codeList.unclaimed;

    const badgeText = count > 0 ? `${count}` : '✓';
    const badgeColor = count > 0 ? '#ef4444' : '#22c55e';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${bgDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <rect x="${SIZE - 40}" y="4" width="36" height="24" rx="12" fill="${badgeColor}" />
  <text x="${SIZE - 22}" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="sans-serif">${badgeText}</text>
  ${buildBadgeSvg('CODES')}
</svg>`;

    const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
    await action.setTitle('');
    await action.setImage(base64);
  }
}
```

### 3.8 `plugin/src/plugin.ts`

Register the new action:

```diff
+// Import common actions
+import { RedeemCodeAction } from './actions/common/redeem-code';

 // ... existing registrations ...

+// Register common actions
+streamDeck.actions.registerAction(new RedeemCodeAction());
+
 // Connect to Stream Deck
 streamDeck.connect();
```

### 3.9 `plugin/com.fcannizzaro.hoyodeck.sdPlugin/manifest.json`

Add the new action entry to the `Actions` array:

```json
{
  "UUID": "com.fcannizzaro.hoyodeck.redeem-code",
  "Name": "Redeem Code",
  "Icon": "imgs/actions/common/redeem-icon",
  "Tooltip": "View and redeem new game codes",
  "Controllers": ["Keypad"],
  "DisableCaching": true,
  "States": [
    {
      "Image": "imgs/actions/common/redeem-state",
      "TitleAlignment": "middle"
    }
  ]
}
```

> **Note**: You'll need to create the icon images at `imgs/actions/common/redeem-icon.png` and `imgs/actions/common/redeem-state.png`.

---

## Part 4: Shared Types & Property Inspector

### 4.1 `packages/shared/src/types/settings.ts`

Add at the end:

```typescript
/**
 * Redeem Code action settings
 */
export interface RedeemCodeSettings extends GameActionSettings {
  game?: GameId;
}
```

### 4.2 `plugin/src/types/settings.ts`

Add `RedeemCodeSettings` to the re-export:

```diff
   ZZZBannerSettings,
+  RedeemCodeSettings,
 } from "@hoyodeck/shared/types";
```

### 4.3 `plugin/package.json`

Add explicit `@elgato/utils` dependency:

```diff
   "dependencies": {
     "@elgato/streamdeck": "^2.0.0",
+    "@elgato/utils": "^0.4.2",
     "@fcannizzaro/native-window": "^0.1.10",
```

### 4.4 NEW FILE: `property-inspector/src/panels/RedeemCodePanel.tsx`

```tsx
import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Select } from '../components/Select';
import { AccountPicker } from '../components/AccountPicker';
import type { GameId } from '@hoyodeck/shared/types';

const GAME_OPTIONS = [
  { value: 'gi', label: 'Genshin Impact' },
  { value: 'hsr', label: 'Honkai: Star Rail' },
  { value: 'zzz', label: 'Zenless Zone Zero' },
];

export function RedeemCodePanel() {
  const { settings, saveSettings } = useStreamDeck();
  const game = (settings.game as GameId) ?? 'gi';

  return (
    <>
      <Heading>Redeem Code Settings</Heading>
      <Select
        label="Game"
        value={game}
        options={GAME_OPTIONS}
        onChange={(value) => saveSettings({ game: value })}
      />
      <AccountPicker game={game} />
    </>
  );
}
```

### 4.5 `property-inspector/src/App.tsx`

Register the panel:

```diff
+import { RedeemCodePanel } from './panels/RedeemCodePanel';

 const ACTION_PANELS: Record<string, React.ComponentType> = {
   'com.fcannizzaro.hoyodeck.genshin.banner': BannerPanel,
   'com.fcannizzaro.hoyodeck.genshin.daily-reward': DailyRewardPanel,
   'com.fcannizzaro.hoyodeck.genshin.transformer': TransformerPanel,
+  'com.fcannizzaro.hoyodeck.redeem-code': RedeemCodePanel,
 };
```

---

## Part 5: Configuration

### 5.1 `.env.example`

Add:

```
# Manager API (for Redeem Codes feature)
MANAGER_URL=http://localhost:3000
MANAGER_PASSWORD=your-manager-password
```

---

## Commit History

| # | Commit | Description |
|---|--------|-------------|
| 1 | `docs: add redeem codes feature reference document` | Architecture and design doc |
| 2 | `refactor: rename inpaint-eyes to manager` | Directory rename + branding |
| 3 | `feat: add codes database, crawler, oRPC router, and codes dashboard UI` | Full manager backend + UI |
| 4 | `feat: add redeem code action, manager client, and property inspector panel` | Full plugin side |

---

## Data Flow Summary

```
hoyo-codes.seria.moe
        │
        ▼ (every 30min)
   Crawler Service
        │
        ▼ (INSERT OR IGNORE)
   SQLite: codes table
        │
        ▼ (oRPC: listCodes)
   Manager API ◄──────── Manager Web UI (/codes)
        │
        ▼ (HTTP POST)
   Plugin: ManagerClient
        │
        ▼ (DataController)
   RedeemCodeAction
        │
        ▼ (on keyDown)
   HoYoLAB: webExchangeCdkey
        │
        ▼ (success/fail)
   Plugin → Manager: markClaimed / markFailed
```
