# AGENTS.md - TypeScript Coding Guidelines

This document defines the TypeScript coding standards for the Hoyo Deck Stream Deck plugin. Follow these guidelines to ensure simplicity, reusability, and maintainability.

## Core Principles

1. **Simplicity** - Prefer simple, readable code over clever abstractions
2. **Reusability** - Extract common patterns into shared utilities
3. **Code Split** - Organize code by feature/domain, not by type
4. **Type Safety** - Use TypeScript strictly, avoid `any`

---

## 0. Project Script

You can use
- `bun run typecheck` to check types across all workspace packages (`@hoyodeck/shared`, `plugin`, `property-inspector`)
- `bun run build` to build the plugin and property inspector

The monorepo has three workspace packages:
- **`packages/shared/`** (`@hoyodeck/shared`) -- shared types, Zod schemas, cookie utilities, and game constants
- **`plugin/`** -- Stream Deck plugin backend (Rollup + SWC)
- **`property-inspector/`** -- Stream Deck UI panel (Vite + React)

## 1. Simplicity

### Prefer Explicit Over Implicit

```typescript
// Bad - implicit behavior
const getData = (uid?: string) => uid ?? globalUid;

// Good - explicit parameters
const getData = (uid: string) => fetchData(uid);
```

### Avoid Deep Nesting

```typescript
// Bad
if (user) {
  if (user.settings) {
    if (user.settings.auth) {
      doSomething(user.settings.auth);
    }
  }
}

// Good - early returns
if (!user?.settings?.auth) return;
doSomething(user.settings.auth);
```

### Use Descriptive Names

```typescript
// Bad
const d = 86400;
const fn = (x: number) => x * d;

// Good
const SECONDS_PER_DAY = 86400;
const toSeconds = (days: number) => days * SECONDS_PER_DAY;
```

### Keep Functions Small

```typescript
// Bad - function doing too much
async function handleResinAction(ev: KeyDownEvent) {
  const auth = await getAuth();
  const response = await fetch(url, { headers: buildHeaders(auth) });
  const data = await response.json();
  const resin = data.data.current_resin;
  await ev.action.setTitle(`${resin}/200`);
  await ev.action.setImage(generateResinImage(resin));
  // ... more logic
}

// Good - split into focused functions
async function handleResinAction(ev: KeyDownEvent) {
  const data = await fetchDailyNote();
  await updateResinDisplay(ev.action, data.current_resin);
}
```

---

## 2. Reusability

### Extract Common Patterns

```typescript
// api/hoyolab/client.ts
export class HoyolabClient {
  constructor(private auth: HoyoAuth) {}

  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const response = await fetch(endpoint, {
      headers: this.buildHeaders(),
      ...options,
    });
    return this.handleResponse<T>(response);
  }
}
```

### Use Generic Base Classes

```typescript
// actions/base/stamina-action.ts
export abstract class StaminaAction<TSettings> extends SingletonAction<TSettings> {
  protected abstract readonly game: GameId;
  protected abstract readonly maxStamina: number;
  protected abstract readonly staminaField: string;

  protected async getStamina(): Promise<number> {
    const data = await this.client.getDailyNote(this.game);
    return data[this.staminaField];
  }

  protected formatDisplay(current: number): string {
    return `${current}/${this.maxStamina}`;
  }
}

// actions/genshin/resin.ts
@action({ UUID: 'com.fcannizzaro.hoyodeck.genshin.resin' })
export class ResinAction extends StaminaAction<ResinSettings> {
  protected readonly game = 'gi';
  protected readonly maxStamina = 200;
  protected readonly staminaField = 'current_resin';
}
```

### Create Utility Functions

```typescript
// utils/time.ts
export const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return 'Ready';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const formatDaysRemaining = (date: Date): string => {
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  return days === 1 ? '1 day' : `${days} days`;
};
```

### Define Shared Types

Shared types live in `@hoyodeck/shared` and are imported via subpath exports:

```typescript
// Import types from the shared package
import type { GameId, GameConfig, HoyoAccount } from '@hoyodeck/shared/types';
import { GAMES, getGameConfig } from '@hoyodeck/shared/games';
import { parseCookies, isValidAuth } from '@hoyodeck/shared/cookies';

// Use in both plugin and property-inspector
const config = getGameConfig('gi');
console.log(config.name); // "Genshin Impact"
```

---

## 3. Code Split

### Organize by Feature/Domain

```
packages/shared/src/           # @hoyodeck/shared — shared across all packages
├── types/                     # GameId, HoyoAuth, HoyoAccount, settings types
├── cookies/                   # parseCookies, isValidAuth, extractAuthFromCookies
└── games/                     # GAMES registry, GAME_LABELS, getGameConfig

plugin/src/                    # Stream Deck plugin backend
├── actions/
│   ├── base/                  # Shared action base classes
│   ├── gi/                    # Genshin-specific actions
│   ├── hsr/                   # Star Rail actions
│   └── zzz/                   # ZZZ actions
├── api/
│   ├── hoyolab/               # HoYoLAB API client
│   └── types/                 # API response types (game-specific)
├── services/                  # Cross-cutting services
└── utils/                     # Pure utility functions

property-inspector/src/        # Stream Deck UI panel (React)
├── components/                # Reusable UI components
├── constants/                 # PI-specific constants (GAME_ICONS)
├── hooks/                     # React hooks (useStreamDeck)
└── panels/                    # Action settings panels
```

### One File, One Purpose

```typescript
// Bad - mixed concerns
// actions/genshin.ts
export class ResinAction { ... }
export class CommissionAction { ... }
export const fetchDailyNote = () => { ... }
export type DailyNoteResponse = { ... }

// Good - separated
// actions/genshin/resin.ts
export class ResinAction { ... }

// api/games/genshin.ts
export const fetchDailyNote = () => { ... }

// api/types/genshin.ts
export type DailyNoteResponse = { ... }
```

### Index Files for Clean Exports

```typescript
// actions/genshin/index.ts
export { ResinAction } from './resin';
export { CommissionAction } from './commission';
export { ExpeditionAction } from './expedition';
// ...

// plugin.ts
import * as genshin from './actions/genshin';
streamDeck.actions.registerAction(new genshin.ResinAction());
```

---

## 3.1 Shared Package (`@hoyodeck/shared`)

The shared package contains types, validation, and constants used by both `plugin` and `property-inspector`. It has **no build step** — consumers import `.ts` source directly via their bundlers.

### What goes in `@hoyodeck/shared`

| Subpath | Contents |
|---------|----------|
| `@hoyodeck/shared/types` | `GameId`, `GameConfig`, `HoyoAuth`, `HoyoAccount`, all settings types, Zod schemas |
| `@hoyodeck/shared/cookies` | `parseCookies`, `extractAuthFromCookies`, `isValidAuth`, `buildCookieString` |
| `@hoyodeck/shared/games` | `GAMES` registry, `GAME_LABELS`, `getGameConfig` |

### What stays package-specific

- **Plugin only**: Stream Deck SDK types (`JsonObject`), API client, action classes, SVG builders, `toJsonObject` helper
- **PI only**: React components, hooks, image assets (`GAME_ICONS`), CSS

### Import pattern

```typescript
// In plugin — import directly from shared
import type { GameId, HoyoAccount } from '@hoyodeck/shared/types';
import { GAMES } from '@hoyodeck/shared/games';
import { isValidAuth } from '@hoyodeck/shared/cookies';

// In property-inspector — same imports
import type { GameId, HoyoAccountInfo } from '@hoyodeck/shared/types';
import { parseCookies, extractAuthFromCookies } from '@hoyodeck/shared/cookies';
```

---

## 4. Type Safety

### Avoid `any`

```typescript
// Bad
const handleResponse = (data: any) => data.result;

// Good
interface ApiResponse<T> {
  retcode: number;
  message: string;
  data: T;
}

const handleResponse = <T>(response: ApiResponse<T>): T => {
  if (response.retcode !== 0) throw new Error(response.message);
  return response.data;
};
```

### Use Zod for Runtime Validation

```typescript
import { z } from 'zod';

const AuthSchema = z.object({
  ltoken_v2: z.string().min(1),
  ltuid_v2: z.string().min(1),
  ltmid_v2: z.string().min(1),
});

type Auth = z.infer<typeof AuthSchema>;

const validateAuth = (settings: unknown): Auth => {
  return AuthSchema.parse(settings);
};
```

> **Note:** The canonical `HoyoAuthSchema` lives in `@hoyodeck/shared/types`. Use `import { HoyoAuthSchema } from '@hoyodeck/shared/types'` rather than defining schemas inline.

### Discriminated Unions for States

```typescript
// Bad
interface ActionState {
  loading: boolean;
  error?: Error;
  data?: DailyNote;
}

// Good
type ActionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: DailyNote };

// Usage
switch (state.status) {
  case 'loading':
    return showLoading();
  case 'error':
    return showError(state.error);
  case 'success':
    return showData(state.data);
}
```

---

## 5. Error Handling

### Use Result Types

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchWithResult<T>(url: string): Promise<Result<T>> {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}

// Usage
const result = await fetchWithResult<DailyNote>(url);
if (!result.ok) {
  streamDeck.logger.error(result.error.message);
  return;
}
const data = result.value;
```

### Graceful Degradation

```typescript
async function refreshResin(action: Action) {
  try {
    const data = await fetchDailyNote();
    await action.setTitle(formatResin(data.current_resin));
  } catch (error) {
    streamDeck.logger.error('Failed to fetch resin:', error);
    await action.setTitle('--');
    await action.showAlert();
  }
}
```

---

## 6. Async/Await Best Practices

### Parallel When Possible

```typescript
// Bad - sequential
const resin = await fetchResin();
const abyss = await fetchAbyss();

// Good - parallel
const [resin, abyss] = await Promise.all([
  fetchResin(),
  fetchAbyss(),
]);
```

### Use Promise.allSettled for Non-Critical

```typescript
const results = await Promise.allSettled([
  updateResinDisplay(),
  updateCommissionDisplay(),
  updateExpeditionDisplay(),
]);

results.forEach((result, index) => {
  if (result.status === 'rejected') {
    streamDeck.logger.warn(`Action ${index} failed:`, result.reason);
  }
});
```

---

## 7. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `daily-reward.ts` |
| Classes | PascalCase | `ResinAction` |
| Interfaces | PascalCase | `DailyNoteResponse` |
| Types | PascalCase | `GameId` |
| Functions | camelCase | `fetchDailyNote` |
| Constants | SCREAMING_SNAKE | `MAX_RESIN` |
| Private fields | prefix `#` or `_` | `#client` |

---

## 8. Documentation

### JSDoc for Public APIs

```typescript
/**
 * Fetches the daily note data for a game.
 * @param game - The game identifier
 * @param uid - The user's in-game UID
 * @returns The daily note data including stamina, commissions, etc.
 * @throws {AuthError} If authentication fails
 * @throws {RateLimitError} If rate limited by HoYoLAB
 */
async function fetchDailyNote(game: GameId, uid: string): Promise<DailyNote> {
  // ...
}
```

### Inline Comments for Complex Logic

```typescript
// DS (Dynamic Secret) is a signature required by HoYoLAB API
// Format: "{timestamp},{random},{md5(salt={SALT}&t={timestamp}&r={random})}"
const generateDS = (): string => {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = generateRandomString(6);
  const hash = md5(`salt=${DS_SALT}&t=${timestamp}&r=${random}`);
  return `${timestamp},${random},${hash}`;
};
```

---

## Summary Checklist

- [ ] Functions are small and focused (<20 lines ideal)
- [ ] No `any` types (use `unknown` + type guards)
- [ ] Error handling with graceful degradation
- [ ] Parallel async operations where possible
- [ ] Clear file/folder organization by domain
- [ ] Consistent naming conventions
- [ ] JSDoc for public APIs
