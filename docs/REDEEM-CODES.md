# Feature: Redeem Codes — Reference Document

## Overview

Add a unified **Redeem Codes** system to Hoyo Deck:

1. **New Stream Deck Action** — A single "Redeem Code" action where the user selects a game (GI / HSR / ZZZ) in the Property Inspector. Displays a badge with the count of unclaimed codes. On key press, auto-redeems the oldest unclaimed code for the selected game/account.

2. **Management Platform** (web) — Evolve the `inpaint-eyes` app into a general **Hoyo Deck Manager** with a new "Codes" section. This dashboard shows all known codes per game, their status (new / claimed / expired), and allows manual claim/dismiss.

3. **Code Crawler Backend** — A server-side service that periodically scrapes known community sources for new redemption codes and stores them in a SQLite database.

---

## Architecture

```
┌─────────────────────────────────┐
│  Stream Deck Plugin (plugin/)   │
│  ─────────────────────────────  │
│  RedeemCodeAction               │
│   ├─ subscribes to codes data   │
│   ├─ renders badge: unclaimed # │
│   └─ keyDown → redeem oldest    │
│                                 │
│  HoyolabClient                  │
│   └─ redeemCode(game, code, uid)│
└─────────────────────────────────┘
           │ HTTP
           ▼
┌─────────────────────────────────┐
│  Hoyo Deck Manager (manager/)   │
│  (renamed from inpaint-eyes/)   │
│  ─────────────────────────────  │
│  Routes:                        │
│   /           → login           │
│   /editor     → inpaint editor  │
│   /gallery    → avatar gallery  │
│   /codes      → code dashboard  │
│                                 │
│  oRPC API:                      │
│   codes.list({game?, accountId?})│
│   codes.markClaimed(id, accountId) │
│   codes.dismiss(id, accountId)  │
│   codes.crawl()  (manual trigger)  │
│                                 │
│  Crawler Service:               │
│   └─ runs on startup + every 30m│
│   └─ sources: see §Sources      │
│   └─ stores in SQLite           │
└─────────────────────────────────┘
```

---

## 1. Database Schema (SQLite)

Add SQLite via `better-sqlite3`. Database file: `data/codes.db`.

```sql
CREATE TABLE IF NOT EXISTS codes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  game           TEXT NOT NULL CHECK(game IN ('gi', 'hsr', 'zzz')),
  code           TEXT NOT NULL,
  rewards        TEXT,           -- human-readable (e.g. "60 Primogems + 5 Hero's Wit")
  source         TEXT,           -- origin (e.g. "hoyo-codes", "reddit")
  discovered_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at     INTEGER,        -- nullable, not all codes have known expiry
  UNIQUE(game, code)
);

CREATE TABLE IF NOT EXISTS code_claims (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code_id    INTEGER NOT NULL REFERENCES codes(id),
  account_id TEXT NOT NULL,      -- matches AccountId from shared types
  status     TEXT NOT NULL CHECK(status IN ('claimed', 'dismissed', 'failed', 'expired')),
  claimed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  message    TEXT,               -- API error detail on failure
  UNIQUE(code_id, account_id)
);
```

---

## 2. Code Crawler

### Sources

| Source | Method | URL |
|--------|--------|-----|
| hoyo-codes (primary) | JSON fetch | `https://hoyo-codes.seria.moe/codes?game={gi\|hsr\|zzz}` |

Start with the primary source. Additional scrapers (Reddit, Twitter, HoYoLAB forums) can be added later.

### Logic

- Fetch all games in parallel
- Upsert into DB (`INSERT OR IGNORE` — dedup by game+code)
- Run on startup, then every 30 minutes via `setInterval`
- Expose manual trigger via oRPC endpoint

---

## 3. Manager oRPC API — `codes` Router

```typescript
// codes.list
// Input: { game?: GameId, accountId?: string }
// Output: Array<{
//   id, game, code, rewards, source, discoveredAt, expiresAt,
//   claimStatus: 'new' | 'claimed' | 'dismissed' | 'failed' | 'expired' | null
// }>

// codes.markClaimed
// Input: { codeId: number, accountId: string }

// codes.dismiss
// Input: { codeId: number, accountId: string }

// codes.crawl (manual trigger)
// Output: { found: number, new: number }
```

---

## 4. Stream Deck Plugin — RedeemCodeAction

### Manifest Entry

```json
{
  "UUID": "com.fcannizzaro.hoyodeck.redeem-code",
  "Name": "Redeem Code",
  "Icon": "imgs/actions/common/redeem-icon",
  "Tooltip": "View and redeem new game codes",
  "Controllers": ["Keypad"],
  "DisableCaching": true,
  "States": [{
    "Image": "imgs/actions/common/redeem-state",
    "TitleAlignment": "middle"
  }]
}
```

### Settings

```typescript
interface RedeemCodeSettings extends GameActionSettings {
  game?: GameId;
  autoRedeem?: boolean;  // auto-redeem on new code discovery
}
```

### Behavior

- **Display**: Game icon + badge with unclaimed count. Green check when all caught up.
- **Key press**: Redeems the oldest unclaimed code via HoYoLAB API, updates status in manager DB.
- **Polling**: Periodically checks manager API for new codes (piggybacks on DataController refresh cycle).

### HoYoLAB Code Redeem API

| Game | Base URL |
|------|----------|
| GI   | `https://sg-hk4e-api.hoyolab.com/common/apicdkey/api/webExchangeCdkey` |
| HSR  | `https://sg-hkrpg-api.hoyolab.com/common/apicdkey/api/webExchangeCdkey` |
| ZZZ  | `https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey` |

Query params: `uid`, `region`, `lang=en`, `cdkey={code}`, `game_biz={biz}`

Game biz values: `hk4e_global` (GI), `hkrpg_global` (HSR), `nap_global` (ZZZ)

**Rate limit**: ~5s cooldown between redeems. Action redeems one code per press.

### Data Types

```typescript
// Add to DataTypeMap:
'gi:codes': CodeList;
'hsr:codes': CodeList;
'zzz:codes': CodeList;

interface CodeList {
  codes: CodeEntry[];
  unclaimed: number;
}

interface CodeEntry {
  id: number;
  code: string;
  rewards?: string;
  status: 'new' | 'claimed' | 'dismissed' | 'failed' | 'expired';
}
```

### Property Inspector

`RedeemCodePanel`:
- Game selector (GI / HSR / ZZZ)
- Account picker (reuse `AccountPicker`)
- Auto-redeem toggle

---

## 5. Manager Web UI — `/codes` Route

### Layout

- Game filter tabs: All / GI / HSR / ZZZ
- Table: Code | Rewards | Source | Discovered | Status | Actions
- Status badge per code: New (blue) / Claimed (green) / Dismissed (gray) / Expired (red)
- Actions: "Dismiss" button for unwanted codes
- "Refresh Codes" button → triggers manual crawl

---

## 6. Rename: `inpaint-eyes/` → `manager/`

- Rename directory
- Update `package.json` name → `@hoyodeck/manager`
- Update turbo.json, root package.json references
- Update Header: "Hoyo Deck Manager" branding
- Keep `/editor` and `/gallery` routes intact
- Add `/codes` route

---

## 7. Implementation Order

1. Rename `inpaint-eyes/` → `manager/` (mechanical, verify build)
2. Add SQLite + schema (`better-sqlite3`)
3. Code crawler service
4. Manager oRPC `codes` router
5. Manager UI: `/codes` route
6. Plugin: `redeemCode()` in `HoyolabClient`
7. Plugin: `{game}:codes` data types + fetcher
8. Plugin: `RedeemCodeAction` + manifest
9. PI: `RedeemCodePanel`
10. Integration testing

---

## 8. Open Questions

- [ ] Plugin ↔ Manager communication: direct HTTP API (recommended — global settings has size limits)
- [ ] Auto-claim scope: per-game toggle in PI (recommended)
- [ ] Manager auth for plugin: shared secret in `.env` (recommended)
