import { useState, useCallback } from 'react';
import { Input } from '../components/Input';
import { TextArea } from '../components/TextArea';
import { Button } from '../components/Button';
import { StatusMessage } from '../components/StatusMessage';
import { extractAuthFromCookies, isValidAuth } from '../utils/cookies';

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

interface AccountFormProps {
  /** Existing account to edit; undefined = creating new */
  account?: HoyoAccount;
  onSave: (account: HoyoAccount) => void;
  onCancel: () => void;
}

/**
 * Form for adding or editing a HoYoLAB account.
 * Collects name, cookies, and per-game UIDs.
 */
export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const [name, setName] = useState(account?.name ?? '');
  const [cookies, setCookies] = useState('');
  const [genshinUid, setGenshinUid] = useState(account?.uids?.genshin ?? '');
  const [starrailUid, setStarrailUid] = useState(
    account?.uids?.starrail ?? '',
  );
  const [zzzUid, setZzzUid] = useState(account?.uids?.zzz ?? '');
  const [error, setError] = useState<string | null>(null);

  const validateUid = (uid: string): boolean => {
    if (!uid) return true; // empty is ok
    return /^\d{9,10}$/.test(uid);
  };

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError('Account name is required');
      return;
    }

    // If editing and no new cookies, keep existing auth
    let auth = account?.auth;
    if (cookies.trim()) {
      const extracted = extractAuthFromCookies(cookies.trim());
      if (!isValidAuth(extracted)) {
        setError(
          'Missing required tokens. Make sure you copied the full cookie string.',
        );
        return;
      }
      auth = extracted;
    }

    if (!auth) {
      setError('Cookies are required for new accounts');
      return;
    }

    // Validate UIDs
    if (!validateUid(genshinUid.trim())) {
      setError('Genshin UID should be 9-10 digits');
      return;
    }
    if (!validateUid(starrailUid.trim())) {
      setError('Star Rail UID should be 9-10 digits');
      return;
    }
    if (!validateUid(zzzUid.trim())) {
      setError('ZZZ UID should be 9-10 digits');
      return;
    }

    // Build UIDs — only include non-empty values
    const uids: Partial<Record<GameId, string>> = {};
    if (genshinUid.trim()) uids.genshin = genshinUid.trim();
    if (starrailUid.trim()) uids.starrail = starrailUid.trim();
    if (zzzUid.trim()) uids.zzz = zzzUid.trim();

    onSave({
      id: account?.id ?? crypto.randomUUID(),
      name: name.trim(),
      auth,
      authStatus: cookies.trim()
        ? 'unknown'
        : (account?.authStatus ?? 'unknown'),
      uids,
    });
  }, [name, cookies, genshinUid, starrailUid, zzzUid, account, onSave]);

  return (
    <div className="flex flex-col gap-2.5 p-2.5 border border-sd-border rounded bg-sd-input/30">
      <Input
        label="Account Name"
        value={name}
        placeholder="e.g. Main, Alt EU"
        onChange={setName}
      />

      <TextArea
        label="Cookie String"
        value={cookies}
        placeholder={
          account
            ? 'Paste new cookies to update...'
            : 'Paste your HoYoLAB cookies here...'
        }
        info="1. Go to hoyolab.com and log in | 2. Open DevTools (F12) → Network tab | 3. Find any request and copy the Cookie header | 4. Paste the entire cookie string above"
        onChange={setCookies}
      />

      <div className="h-px bg-sd-border" />

      <Input
        label="Genshin Impact UID"
        value={genshinUid}
        placeholder="Optional (9-10 digits)"
        maxLength={10}
        onChange={setGenshinUid}
      />

      <Input
        label="Honkai: Star Rail UID"
        value={starrailUid}
        placeholder="Optional (9-10 digits)"
        maxLength={10}
        onChange={setStarrailUid}
      />

      <Input
        label="Zenless Zone Zero UID"
        value={zzzUid}
        placeholder="Optional (9-10 digits)"
        maxLength={10}
        onChange={setZzzUid}
      />

      {error && (
        <StatusMessage
          message={error}
          type="error"
          onDismiss={() => setError(null)}
        />
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave}>{account ? 'Update' : 'Add'}</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
