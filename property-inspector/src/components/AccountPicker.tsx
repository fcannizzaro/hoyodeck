import { useEffect, useMemo } from 'react';
import { useStreamDeck } from '../hooks/use-stream-deck';
import { Select } from './Select';
import type { GameId, HoyoAccountInfo } from '@hoyodeck/shared/types';

interface AccountPickerProps {
  /** If set, only show accounts that have a UID for this game */
  game?: GameId;
  /** Label override */
  label?: string;
}

/**
 * Account selector dropdown for action panels.
 *
 * Visibility rules (mirrors plugin-side auto-pick strategy):
 * - 0 accounts                → hidden (AccountPanel handles the "login first" message)
 * - 1 account matching game   → hidden, auto-selects silently
 * - 2+ accounts matching game → visible, user must pick
 *
 * Only accountId is stored in action settings — never a UID.
 *
 * Stale selection handling:
 * If the stored accountId no longer appears in filteredAccounts (account deleted
 * or UID removed), the selection is cleared so auto-pick can re-run cleanly.
 */
export function AccountPicker({
  game,
  label = 'Account',
}: AccountPickerProps) {
  const { globalSettings, settings, saveSettings } = useStreamDeck();
  const accounts = (globalSettings.accounts ?? {}) as Record<
    string,
    HoyoAccountInfo
  >;
  const selectedAccountId = (settings.accountId as string) ?? '';

  // Filter accounts: if game is specified, only show accounts with a UID for that game
  const filteredAccounts = useMemo(
    () =>
      Object.values(accounts).filter((account) => {
        if (!game) return true;
        return account.uids?.[game] !== undefined;
      }),
    [accounts, game],
  );

  useEffect(() => {
    if (selectedAccountId) {
      // If the stored account no longer passes the game filter (deleted or UID removed),
      // clear it so the auto-pick logic below can re-run cleanly.
      const stillValid = filteredAccounts.some((a) => a.id === selectedAccountId);
      if (!stillValid) {
        saveSettings({ accountId: undefined });
      }
      return;
    }

    // Auto-select when exactly ONE account matches and none is already selected.
    // This mirrors the plugin-side logic so the PI stays in sync.
    if (filteredAccounts.length === 1) {
      saveSettings({ accountId: filteredAccounts[0]!.id });
    }
  }, [selectedAccountId, filteredAccounts, saveSettings]);

  // Hide the picker entirely when 0 or 1 account matches.
  // - 0: nothing to pick (AccountPanel shows a login prompt instead)
  // - 1: auto-selected above, showing the picker would just be noise
  if (filteredAccounts.length <= 1) {
    return null;
  }

  const options = [
    { value: '', label: 'Select account...' },
    ...filteredAccounts.map((a) => ({
      value: a.id,
      label: `${a.name}${a.authStatus === 'invalid' ? ' (invalid)' : ''}`,
    })),
  ];

  return (
    <Select
      label={label}
      value={selectedAccountId}
      options={options}
      onChange={(value) => saveSettings({ accountId: value || undefined })}
    />
  );
}
