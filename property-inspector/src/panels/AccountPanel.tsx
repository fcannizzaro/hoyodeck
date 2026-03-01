import { useState } from 'react';
import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Button } from '../components/Button';
import { AccountCard } from './AccountCard';
import { AccountForm } from './AccountForm';
import type { HoyoAccount } from '@hoyodeck/shared/types';

/**
 * Account management panel.
 * Lists all accounts with status, and allows adding/editing/deleting accounts.
 */
export function AccountPanel() {
  const { globalSettings, saveGlobalSettings, saveSettings, settings } = useStreamDeck();
  const accounts = (globalSettings.accounts ?? {}) as Record<
    string,
    HoyoAccount
  >;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDelete = (id: string) => {
    const { [id]: _, ...remaining } = accounts;
    saveGlobalSettings({ accounts: remaining });
    if ((settings.accountId as string) === id) {
      saveSettings({ accountId: undefined });
    }
  };

  const handleSave = (account: HoyoAccount) => {
    const isFirstAccount = Object.keys(accounts).length === 0;
    saveGlobalSettings({
      accounts: { ...accounts, [account.id]: account },
      pendingValidation: account.id,
    });
    if (isFirstAccount || !settings.accountId) {
      saveSettings({ accountId: account.id });
    }
    setShowAddForm(false);
    setEditingId(null);
  };

  const sortedAccounts = Object.values(accounts).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="flex flex-col gap-2">
      <Heading>Accounts</Heading>

      {sortedAccounts.length === 0 && !showAddForm && (
        <p className="text-[11px] text-sd-secondary">
          No accounts configured. Add one to get started.
        </p>
      )}

      {sortedAccounts.length > 0 && (
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
      )}

      {showAddForm ? (
        <AccountForm
          onSave={handleSave}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <Button onClick={() => setShowAddForm(true)}>+ Add Account</Button>
      )}
    </div>
  );
}
