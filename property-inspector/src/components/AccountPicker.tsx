import { useStreamDeck } from '../hooks/use-stream-deck';
import { Select } from './Select';

type GameId = 'genshin' | 'starrail' | 'zzz';

interface HoyoAccount {
  id: string;
  name: string;
  authStatus: 'unknown' | 'valid' | 'invalid';
  uids: Partial<Record<GameId, string>>;
}

interface AccountPickerProps {
  /** If set, only show accounts that have a UID for this game */
  game?: GameId;
  /** Label override */
  label?: string;
}

/**
 * Account selector dropdown for action panels.
 * Filters accounts by game UID availability when game prop is set.
 */
export function AccountPicker({
  game,
  label = 'Account',
}: AccountPickerProps) {
  const { globalSettings, settings, saveSettings } = useStreamDeck();
  const accounts = (globalSettings.accounts ?? {}) as Record<
    string,
    HoyoAccount
  >;
  const selectedAccountId = (settings.accountId as string) ?? '';

  // Filter accounts: if game is specified, only show accounts with a UID for that game
  const filteredAccounts = Object.values(accounts).filter((account) => {
    if (!game) return true;
    return account.uids?.[game] !== undefined;
  });

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
