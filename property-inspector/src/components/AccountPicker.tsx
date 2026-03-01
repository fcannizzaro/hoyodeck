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
 * Filters accounts by game UID availability when game prop is set.
 * Auto-selects when exactly one account matches.
 * Hides itself when there are 0 or 1 matching accounts.
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

  // Stale selection cleanup + auto-select when exactly one matches
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

  // Hide when 0 or 1 account matches
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
