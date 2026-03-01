# Account Picking Strategy — Implementation Guide

> Branch: `feat/account-picking-strategy`
> 8 commits, 15 files changed, +460 / -168 lines

---

## Overview

Replaces the old "resolve account" logic with a deterministic auto-pick strategy that handles 0, 1, and N accounts gracefully. Also fixes several animation and state bugs, and adds incognito mode for the login webview.

---

## 1. The Strategy

The core idea: **only `accountId` is persisted in action settings — never a UID.**

### Pick Algorithm (in order)

| Condition | Result | PI Behavior |
|-----------|--------|-------------|
| 0 accounts total | `no-accounts` | Show login only (hide action settings) |
| `accountId` in settings + account exists | `resolved` | Show picker only if 2+ candidates |
| 1 account with game UID | `resolved` (auto-select, persist accountId) | Hide picker |
| 2+ accounts with game UID | `ambiguous` | Show picker, user must choose |
| Accounts exist but none has this game's UID | `no-uid` | Show "Set UID" |

### Result Type

```typescript
type AccountPickResult =
  | { kind: 'resolved'; account: HoyoAccount }
  | { kind: 'no-accounts' }
  | { kind: 'no-uid' }
  | { kind: 'ambiguous' };
```

---

## 2. File-by-File Changes

### 2.1 `plugin/src/actions/base/base-action.ts` (core — largest change)

#### New: `pickAccount()` method

Replaces the old `resolveAccount()` with a strict implementation of the strategy above.

```typescript
protected async pickAccount(
  settings: TSettings,
  game: GameId,
  action?: KeyAction<TSettings>,
): Promise<AccountPickResult> {
  const globalSettings = await this.getGlobalSettings();
  const accounts = globalSettings.accounts ?? {};
  const allAccounts = Object.values(accounts);

  // No accounts at all → must log in first
  if (allAccounts.length === 0) {
    return { kind: 'no-accounts' };
  }

  const raw = settings as Record<string, unknown>;
  const storedAccountId = raw['accountId'] as AccountId | undefined;

  // If an explicit accountId is stored, resolve it directly
  if (storedAccountId) {
    const account = accounts[storedAccountId];
    if (account) {
      return { kind: 'resolved', account };
    }
    // Stored accountId no longer exists → fall through to re-pick
  }

  // Find accounts that have a UID for this game
  const candidates = allAccounts.filter((a) => a.uids[game] !== undefined);

  if (candidates.length === 0) {
    return { kind: 'no-uid' };
  }

  if (candidates.length === 1) {
    const selected = candidates[0]!;
    if (action) {
      await action.setSettings({ ...settings, accountId: selected.id });
    }
    return { kind: 'resolved', account: selected };
  }

  return { kind: 'ambiguous' };
}
```

#### Legacy `resolveAccount()` — kept as a thin wrapper

```typescript
protected async resolveAccount(
  settings: TSettings,
  action?: KeyAction<TSettings>,
): Promise<HoyoAccount | null> {
  const game = this.getResolvedGame(settings);
  const result = await this.pickAccount(settings, game, action);
  return result.kind === 'resolved' ? result.account : null;
}
```

#### New: `attemptRegister()` private method

Replaces the registration logic previously split between `onWillAppear` and `onDidReceiveSettings`. Now a single method handles all pick outcomes:

```typescript
private async attemptRegister(
  actionId: string,
  keyAction: KeyAction<TSettings>,
  settings: TSettings,
): Promise<void> {
  // Stop running animations before any async work
  this.onStop(keyAction);

  const game = this.getResolvedGame(settings);
  const result = await this.pickAccount(settings, game, keyAction);

  if (result.kind === 'no-accounts' || result.kind === 'ambiguous') {
    dataController.unregister(actionId);
    await this.showNoAccount(keyAction);
    // Watch for account changes so we auto-retry
    dataController.subscribeAccountChanges(actionId, () => {
      void this.attemptRegister(actionId, keyAction, settings);
    });
    return;
  }

  if (result.kind === 'no-uid') {
    dataController.unregister(actionId);
    await this.showNoUid(keyAction);
    // Watch — UIDs may arrive after auth-validator runs
    dataController.subscribeAccountChanges(actionId, () => {
      void this.attemptRegister(actionId, keyAction, settings);
    });
    return;
  }

  // Resolved — stop watching
  dataController.unsubscribeAccountChanges(actionId);

  const { account } = result;
  const uid = this.getGameUid(account, game);
  if (!uid) {
    // Account resolved but no UID yet — watch for UID changes
    dataController.unregister(actionId);
    await this.showNoUid(keyAction);
    dataController.subscribeAccountChanges(actionId, () => {
      void this.attemptRegister(actionId, keyAction, settings);
    });
    return;
  }

  // Normal registration...
  const dataTypes = this.getSubscribedDataTypes(settings);

  // Skip re-registration if nothing changed
  const existing = dataController.getRegistration(actionId);
  if (existing && existing.accountId === account.id &&
      JSON.stringify(existing.dataTypes) === JSON.stringify(dataTypes)) {
    return;
  }

  dataController.unregister(actionId);
  dataController.register({
    actionId,
    accountId: account.id,
    dataTypes,
    listener: (update) => { /* same as before */ },
    onAccountRemoved: () => {
      // Account deleted → show placeholder and watch for new accounts
      void this.showNoAccount(keyAction);
      dataController.subscribeAccountChanges(actionId, () => {
        void this.attemptRegister(actionId, keyAction, settings);
      });
    },
    onStructureChanged: () => {
      // Any structural change → re-run resolution
      void this.attemptRegister(actionId, keyAction, settings);
    },
  });

  await this.withErrorHandling(keyAction, async () => {
    await dataController.requestUpdate(account.id, game);
  });
}
```

#### Lifecycle hooks simplified

All three hooks (`onWillAppear`, `onDidReceiveSettings`, `onWillDisappear`) now delegate to `attemptRegister`:

```typescript
override async onWillAppear(ev: WillAppearEvent<TSettings>): Promise<void> {
  if (!ev.action.isKey()) return;
  await this.attemptRegister(ev.action.id, ev.action, ev.payload.settings);
}

override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
  dataController.unregister(ev.action.id);
  dataController.unsubscribeAccountChanges(ev.action.id);
}

override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TSettings>): Promise<void> {
  if (!ev.action.isKey()) return;
  await this.attemptRegister(ev.action.id, ev.action, ev.payload.settings);
}
```

#### New: `onStop()` hook

Called before any placeholder image is set (showNoAccount, showNoUid, showNoAuth, showError). Subclasses override it to clear running animations that would overwrite the placeholder:

```typescript
protected onStop(_action: KeyAction<TSettings>): void {}
```

Added `this.onStop(action)` call to: `showNoAccount()`, `showNoAuth()`, `showNoUid()`.

#### Updated: `onKeyDown` and `sendToPlugin` (refresh)

Both now use `pickAccount()` instead of `resolveAccount()`:

```typescript
override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
  const settings = ev.payload.settings;
  const game = this.getResolvedGame(settings);
  const pickResult = await this.pickAccount(settings, game);
  if (pickResult.kind !== 'resolved') return;
  await this.withErrorHandling(ev.action, async () => {
    await dataController.requestUpdate(pickResult.account.id, game);
  });
}
```

---

### 2.2 `plugin/src/services/data-controller.ts`

#### New: Account-change subscription system

```typescript
private readonly accountChangeSubscribers = new Map<string, () => void>();

subscribeAccountChanges(actionId: string, cb: () => void): void {
  this.accountChangeSubscribers.set(actionId, cb);
}

unsubscribeAccountChanges(actionId: string): void {
  this.accountChangeSubscribers.delete(actionId);
}
```

#### New: `notifyAccountStructureChanged()`

Fires both `accountChangeSubscribers` and `onStructureChanged` on all active registrations:

```typescript
private notifyAccountStructureChanged(): void {
  for (const [actionId, cb] of this.accountChangeSubscribers) {
    try { cb(); } catch (err) { /* log */ }
  }
  for (const [actionId, reg] of this.registrations) {
    if (!reg.onStructureChanged) continue;
    try { reg.onStructureChanged(); } catch (err) { /* log */ }
  }
}
```

#### Updated: `onGlobalSettingsChanged()` diff logic

Now detects three types of structural changes:

1. **Account deleted** — already existed, now fires `structureChanged = true`
2. **Account added** — new key appears in accounts map
3. **UIDs changed** — uses new `uidsEqual()` helper to detect UID changes even when auth stays the same

```typescript
// New helper
private uidsEqual(
  a: Partial<Record<string, string>>,
  b: Partial<Record<string, string>>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}
```

At the end of the diff:

```typescript
if (structureChanged) {
  this.notifyAccountStructureChanged();
}
```

---

### 2.3 `plugin/src/services/data-controller.types.ts`

Added `onStructureChanged` to `ActionRegistration`:

```typescript
export interface ActionRegistration {
  // ... existing fields ...
  onStructureChanged?: () => void;
}
```

---

### 2.4 `plugin/src/actions/base/banner-action.ts`

- `onKeyDown` now uses `pickAccount()` instead of `resolveAccount()`
- Added `onStop()` override to clear blink animation

```typescript
protected override onStop(action: KeyAction<TSettings>): void {
  const state = this.keyStates.get(action.id);
  if (state) this.clearBlinkAnimation(state);
}
```

---

### 2.5 Stamina actions (3 files)

Each stamina action (`resin.ts`, `trailblaze-power.ts`, `battery-charge.ts`) adds:

```typescript
protected override onStop(): void {
  this.clearAnimation();
}
```

This prevents the stamina fill animation from overwriting placeholder images when transitioning to no-account/no-uid states.

---

### 2.6 `plugin/src/services/hoyolab-login.ts`

Two changes:

1. **Added `incognito: true`** to the native window options — ensures no cookies carry over between login sessions:

```typescript
const win = await NativeWindow.open({
  url: LOGIN_URL,
  // ... existing options ...
  incognito: true,
});
```

2. **Removed `win.clearCookies()`** call before `win.close()` — no longer needed since incognito mode handles this.

---

### 2.7 `property-inspector/src/App.tsx`

Added a "no accounts" guard at the top of the render:

```typescript
const accounts = (globalSettings.accounts ?? {}) as Record<string, HoyoAccountInfo>;
const hasAccounts = Object.keys(accounts).length > 0;

// No accounts → show ONLY AccountPanel (login button)
if (!hasAccounts) {
  return (
    <div className="...">
      <AccountPanel />
    </div>
  );
}
```

---

### 2.8 `property-inspector/src/components/AccountPicker.tsx`

Major behavior change — picker now **hides itself** when there are 0 or 1 matching accounts:

```typescript
// Hide when 0 or 1 account matches
if (filteredAccounts.length <= 1) {
  return null;
}
```

Also added **stale selection cleanup** — if the stored `accountId` no longer passes the game filter (account deleted or UID removed), clear it:

```typescript
useEffect(() => {
  if (selectedAccountId) {
    const stillValid = filteredAccounts.some((a) => a.id === selectedAccountId);
    if (!stillValid) {
      saveSettings({ accountId: undefined });
    }
    return;
  }
  // Auto-select when exactly ONE matches
  if (filteredAccounts.length === 1) {
    saveSettings({ accountId: filteredAccounts[0]!.id });
  }
}, [selectedAccountId, filteredAccounts, saveSettings]);
```

Removed the `info` text about "No accounts configured" (that's now handled by the App.tsx guard).

---

### 2.9 `property-inspector/src/panels/AccountPanel.tsx`

Two changes:

1. **On delete**: if the current action was using the deleted account, clear `accountId`:

```typescript
const handleDelete = (id: string) => {
  const { [id]: _, ...remaining } = accounts;
  saveGlobalSettings({ accounts: remaining });
  if ((settings.accountId as string) === id) {
    saveSettings({ accountId: undefined });
  }
};
```

2. **On save (add account)**: only auto-assign if it's the first account or the action has no account selected:

```typescript
const handleSave = (account: HoyoAccount) => {
  const isFirstAccount = Object.keys(accounts).length === 0;
  saveGlobalSettings({
    accounts: { ...accounts, [account.id]: account },
    pendingValidation: account.id,
  });
  if (isFirstAccount || !settings.accountId) {
    saveSettings({ accountId: account.id });
  }
  // ...
};
```

---

### 2.10 `property-inspector/src/panels/BannerPanel.tsx`

Added missing `game="gi"` prop to `AccountPicker`:

```diff
-<AccountPicker />
+<AccountPicker game="gi" />
```

---

### 2.11 `plugin/package.json`

- Bumped `@fcannizzaro/native-window` from `^0.1.10` → `^0.2.0` (+ optional platform deps to `0.2.0`)
- Added explicit `@elgato/utils` dependency (`^0.4.2`)

---

## 3. Commit History (chronological)

| # | Commit | Description |
|---|--------|-------------|
| 1 | `feat: implement account picking strategy (cases 1-3)` | Core `pickAccount()`, `attemptRegister()`, PI guards, AccountPicker auto-hide |
| 2 | `fix: stop animations before showing select-account / no-uid / no-auth states` | Added `onStop()` hook to prevent animation overwrites |
| 3 | `fix: re-resolve actions when account UIDs are updated after login` | `uidsEqual()` + UID change detection in `onGlobalSettingsChanged` |
| 4 | `fix: re-resolve all actions on any account structural change` | `onStructureChanged` callback + `notifyAccountStructureChanged()` |
| 5 | `fix: keep watching for uid changes when action lands in no-uid state` | Watch for UID changes even after resolved account has no UID |
| 6 | `fix: stop animation at top of attemptRegister before any async work` | Moved `onStop()` call to top of `attemptRegister` |
| 7 | `fix: clear webview cookies before loading login url` | Clean login state |
| 8 | `feat: use incognito mode for login window` | `incognito: true` + remove `clearCookies()` |
| 9 | `chore: bump native-window to 0.2.0 and enable incognito flag` | Version bump + remove `@ts-expect-error` |

---

## 4. Key Architectural Decisions

1. **No UID in settings** — only `accountId` is persisted. UIDs can change (auth-validator writes them async after login).

2. **Watchers for retry** — actions in non-resolved states (`no-accounts`, `ambiguous`, `no-uid`) subscribe to account-change events so they automatically retry without user interaction.

3. **`onStructureChanged` on registered actions** — even already-registered actions re-run resolution when the account map changes. Example: if you go from 2 accounts to 1 (delete), the remaining account should auto-select.

4. **`onStop()` hook** — prevents animation intervals from overwriting placeholder images during state transitions.

5. **AccountPicker hides with ≤1 candidate** — reduces UI noise when there's nothing to choose.
