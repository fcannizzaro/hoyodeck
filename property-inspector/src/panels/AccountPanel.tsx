import { useState } from 'react';
import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Button } from '../components/Button';
import { AccountCard } from './AccountCard';
import { AccountForm } from './AccountForm';

type GameId = 'genshin' | 'starrail' | 'zzz';

interface HoyoAuth {
  ltoken_v2?: string;
  ltuid_v2?: string;
  ltmid_v2?: string;
  cookie_token_v2?: string;
  account_mid_v2?: string;
  account_id_v2?: string;
}

interface HoyoAccount {
  id: string;
  name: string;
  auth: HoyoAuth;
  authStatus: 'unknown' | 'valid' | 'invalid';
  uids: Partial<Record<GameId, string>>;
}

/**
 * Account management panel.
 * Lists all accounts with status, and allows adding/editing/deleting accounts.
 */
export function AccountPanel() {
  const { globalSettings, saveGlobalSettings } = useStreamDeck();
  const accounts = (globalSettings.accounts ?? {}) as Record<
    string,
    HoyoAccount
  >;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDelete = (id: string) => {
    const { [id]: _, ...remaining } = accounts;
    saveGlobalSettings({ accounts: remaining });
  };

  const handleSave = (account: HoyoAccount) => {
    saveGlobalSettings({
      accounts: { ...accounts, [account.id]: account },
      pendingValidation: account.id,
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const sortedAccounts = Object.values(accounts).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <>
      <Heading>Accounts</Heading>

      {sortedAccounts.length === 0 && !showAddForm && (
        <p className="text-[11px] text-sd-secondary">
          No accounts configured. Add one to get started.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {sortedAccounts.map((account) =>
          editingId === account.id ? (
            <AccountForm
              key={account.id}
              account={account}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => setEditingId(account.id)}
              onDelete={() => handleDelete(account.id)}
            />
          ),
        )}
      </div>

      {showAddForm ? (
        <AccountForm
          onSave={handleSave}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <Button onClick={() => setShowAddForm(true)}>+ Add Account</Button>
      )}
    </>
  );
}
