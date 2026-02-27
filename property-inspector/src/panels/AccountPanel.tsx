import { useState } from 'react';
import { useStreamDeck } from '../hooks/use-stream-deck';
import { Heading } from '../components/Heading';
import { Button } from '../components/Button';
import { AccountCard } from './AccountCard';
import { AccountForm } from './AccountForm';
import type { HoyoAccount, HoyoAccountInfo } from '@hoyodeck/shared/types';

/**
 * Account management panel.
 * Lists all accounts with status, and allows adding/editing/deleting accounts.
 *
 * Post-login refresh:
 * After saving the *first* account, every action that has no accountId set
 * will have it auto-assigned here (mirrors plugin-side auto-pick).
 * For the second+ account, the plugin-side watcher handles re-resolution.
 */
export function AccountPanel() {
  const { globalSettings, saveGlobalSettings, settings, saveSettings } = useStreamDeck();
  const accounts = (globalSettings.accounts ?? {}) as Record<
    string,
    HoyoAccount
  >;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDelete = (id: string) => {
    const { [id]: _, ...remaining } = accounts;
    saveGlobalSettings({ accounts: remaining });

    // If the current action was using this account, clear it so the PI
    // shows "Select Account" immediately (plugin-side will also re-resolve).
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

    // Auto-assign the new account to this action if:
    // - it's the very first account (Case 1: silent auto-select), OR
    // - the action has no account selected yet
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
