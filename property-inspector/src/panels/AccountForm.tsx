import { useState, useCallback, useRef } from 'react';
import { Input } from '../components/Input';
import { GameIcon } from '../components/GameIcon';
import { TextArea } from '../components/TextArea';
import { Button } from '../components/Button';
import { StatusMessage } from '../components/StatusMessage';
import { parseCookies, extractAuthFromCookies, isValidAuth } from '@hoyodeck/shared/cookies';
import { GAMES } from '@hoyodeck/shared/games';
import type { GameId, HoyoAccount, HoyoAuth } from '@hoyodeck/shared/types';

/** Console snippet that extracts HoYoLAB auth cookies and copies them to clipboard */
const COOKIE_SCRIPT = `(()=>{const keys=['ltoken_v2','ltuid_v2','ltmid_v2','cookie_token_v2','account_mid_v2','account_id_v2'];const r=document.cookie.split('; ').filter(p=>{const k=p.substring(0,p.indexOf('='));return keys.includes(k)});if(!r.length){console.error('No HoYoLAB cookies found. Make sure you are logged in on hoyolab.com');return}navigator.clipboard.writeText(r.join('; ')).then(()=>console.log('Cookies copied to clipboard!')).catch(()=>prompt('Auto-copy failed. Manually copy:',r.join('; ')))})()`;

/** All game IDs in display order */
const GAME_IDS: GameId[] = ['gi', 'hsr', 'zzz'];

/**
 * Format a game role for display: "nickname (UID)" or just the UID.
 */
function formatGameRole(game: GameId, account: HoyoAccount): string {
  const uid = account.uids?.[game];
  if (!uid) return '';
  const nickname = account.nicknames?.[game];
  return nickname ? `${nickname} (${uid})` : uid;
}

interface AccountFormProps {
  /** Existing account to edit; undefined = creating new */
  account?: HoyoAccount;
  onSave: (account: HoyoAccount) => void;
  onCancel: () => void;
}

/**
 * Form for adding or editing a HoYoLAB account.
 * Collects name and cookies. Game UIDs are auto-fetched during validation.
 */
export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const [name, setName] = useState(account?.name ?? '');
  const [cookies, setCookies] = useState('');
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

    onSave({
      id: account?.id ?? crypto.randomUUID(),
      name: name.trim(),
      auth,
      authStatus: cookies.trim()
        ? 'unknown'
        : (account?.authStatus ?? 'unknown'),
      uids: account?.uids ?? {},
      nicknames: account?.nicknames,
    });
  }, [name, cookies, account, onSave]);

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

      {account ? (
        GAME_IDS.map((game) => (
          <Input
            key={game}
            label={GAMES[game].name}
            icon={<GameIcon game={game} />}
            value={formatGameRole(game, account)}
            placeholder="Not linked"
            readOnly
          />
        ))
      ) : (
        <p className="text-[11px] text-sd-secondary">
          Game UIDs will be auto-detected after saving.
        </p>
      )}

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
