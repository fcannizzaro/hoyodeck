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
 * Auto-selects when exactly one account matches and none is currently selected.
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

  // Auto-select when exactly one account matches and none is selected
  useEffect(() => {
    if (selectedAccountId) return;
    if (filteredAccounts.length !== 1) return;
    saveSettings({ accountId: filteredAccounts[0]!.id });
  }, [selectedAccountId, filteredAccounts, saveSettings]);

  const options = [
    { value: '', label: 'Select account...' },
    ...filteredAccounts.map((a) => ({
      value: a.id,
      label: `${a.name}${a.authStatus === 'invalid' ? ' (invalid)' : ''}`,
    })),
  ];

  const info =
    filteredAccounts.length === 0
      ? 'No accounts configured. Add one in the Accounts section below.'
      : undefined;

  return (
    <Select
      label={label}
      value={selectedAccountId}
      options={options}
      info={info}
      onChange={(value) => saveSettings({ accountId: value || undefined })}
    />
  );
}
