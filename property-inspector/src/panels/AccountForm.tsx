import { useState, useCallback, useRef } from 'react';
import { Input } from '../components/Input';
import { GameIcon } from '../components/GameIcon';
import { TextArea } from '../components/TextArea';
import { Button } from '../components/Button';
import { StatusMessage } from '../components/StatusMessage';
import { parseCookies, extractAuthFromCookies, isValidAuth } from '@hoyodeck/shared/cookies';
import type { GameId, HoyoAccount, HoyoAuth } from '@hoyodeck/shared/types';

/** Console snippet that extracts HoYoLAB auth cookies and copies them to clipboard */
const COOKIE_SCRIPT = `(()=>{const keys=['ltoken_v2','ltuid_v2','ltmid_v2','cookie_token_v2','account_mid_v2','account_id_v2'];const r=document.cookie.split('; ').filter(p=>{const k=p.substring(0,p.indexOf('='));return keys.includes(k)});if(!r.length){console.error('No HoYoLAB cookies found. Make sure you are logged in on hoyolab.com');return}navigator.clipboard.writeText(r.join('; ')).then(()=>console.log('Cookies copied to clipboard!')).catch(()=>prompt('Auto-copy failed. Manually copy:',r.join('; ')))})()`;

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
  const [genshinUid, setGenshinUid] = useState(account?.uids?.gi ?? '');
  const [starrailUid, setStarrailUid] = useState(
    account?.uids?.hsr ?? '',
  );
  const [zzzUid, setZzzUid] = useState(account?.uids?.zzz ?? '');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopyScript = useCallback(() => {
    navigator.clipboard.writeText(COOKIE_SCRIPT).then(() => {
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }, []);

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
    let auth: HoyoAuth | undefined = account?.auth;
    if (cookies.trim()) {
      const parsed = parseCookies(cookies.trim());
      const extracted = extractAuthFromCookies(parsed);
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
    if (genshinUid.trim()) uids.gi = genshinUid.trim();
    if (starrailUid.trim()) uids.hsr = starrailUid.trim();
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
        info="Copy the script below, then on hoyolab.com open DevTools (F12) → Console tab and paste it to auto-copy cookies."
        onChange={setCookies}
      />

      <Button onClick={handleCopyScript}>
        {copied ? 'Copied!' : 'Copy Cookie Script'}
      </Button>

      <div className="h-px bg-sd-border" />

      <Input
        label="Genshin Impact UID"
        icon={<GameIcon game="gi" />}
        value={genshinUid}
        placeholder="Optional (9-10 digits)"
        maxLength={10}
        onChange={setGenshinUid}
      />

      <Input
        label="Honkai: Star Rail UID"
        icon={<GameIcon game="hsr" />}
        value={starrailUid}
        placeholder="Optional (9-10 digits)"
        maxLength={10}
        onChange={setStarrailUid}
      />

      <Input
        label="Zenless Zone Zero UID"
        icon={<GameIcon game="zzz" />}
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
