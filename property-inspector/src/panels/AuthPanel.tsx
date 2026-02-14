import { useState, useCallback, useEffect } from 'react';
import { useStreamDeck } from '../hooks/use-stream-deck';
import {
  extractAuthFromCookies,
  isValidAuth,
  type HoyoAuth,
} from '../utils/cookies';
import { Heading } from '../components/Heading';
import { TextArea } from '../components/TextArea';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { StatusMessage } from '../components/StatusMessage';

interface Status {
  message: string;
  type: 'success' | 'error';
}

export function AuthPanel() {
  const { globalSettings, saveGlobalSettings } = useStreamDeck();
  const [cookieInput, setCookieInput] = useState('');
  const [authStatus, setAuthStatus] = useState<Status | null>(null);
  const [uidStatus, setUidStatus] = useState<Status | null>(null);

  const auth = globalSettings.auth as HoyoAuth | undefined;
  const uid = (globalSettings.uid as string) ?? '';
  const [uidInput, setUidInput] = useState(uid);

  useEffect(() => {
    setUidInput(uid);
  }, [uid]);

  const handleParseCookies = useCallback(() => {
    const trimmed = cookieInput.trim();
    if (!trimmed) {
      setAuthStatus({
        message: 'Please paste your cookies first',
        type: 'error',
      });
      return;
    }

    const extracted = extractAuthFromCookies(trimmed);
    if (!isValidAuth(extracted)) {
      setAuthStatus({
        message:
          'Missing required tokens. Make sure you copied the full cookie string.',
        type: 'error',
      });
      return;
    }

    saveGlobalSettings({ auth: extracted });
    setAuthStatus({
      message: 'Authentication saved successfully!',
      type: 'success',
    });
    setCookieInput('');
  }, [cookieInput, saveGlobalSettings]);

  const handleUidBlur = useCallback(() => {
    const trimmed = uidInput.trim();
    if (!trimmed) return;

    if (!/^\d{9,10}$/.test(trimmed)) {
      setUidStatus({ message: 'UID should be 9-10 digits', type: 'error' });
      return;
    }

    saveGlobalSettings({ uid: trimmed });
    setUidStatus({ message: 'UID saved!', type: 'success' });
  }, [uidInput, saveGlobalSettings]);

  const authenticated = auth && isValidAuth(auth);

  return (
    <>
      <Heading>Authentication</Heading>

      <TextArea
        label="Cookie String"
        value={cookieInput}
        placeholder="Paste your HoYoLAB cookies here..."
        info="1. Go to hoyolab.com and log in | 2. Open DevTools (F12) → Network tab | 3. Find any request and copy the Cookie header | 4. Paste the entire cookie string above"
        onChange={setCookieInput}
      />

      <Button onClick={handleParseCookies}>Parse Cookies</Button>

      {authStatus && (
        <StatusMessage
          message={authStatus.message}
          type={authStatus.type}
          onDismiss={() => setAuthStatus(null)}
        />
      )}

      <div className="h-px bg-sd-border" />

      <Input
        label="Game UID"
        value={uidInput}
        placeholder="Enter your game UID"
        maxLength={10}
        info="Your in-game UID (9-10 digits). Found in the game's profile screen."
        onChange={setUidInput}
        onBlur={handleUidBlur}
      />

      {uidStatus && (
        <StatusMessage
          message={uidStatus.message}
          type={uidStatus.type}
          onDismiss={() => setUidStatus(null)}
        />
      )}

      <div className="h-px bg-sd-border" />

      <Heading>Current Auth Status</Heading>
      <p
        className={`text-[11px] ${authenticated ? 'text-sd-success' : 'text-sd-error'}`}
      >
        {authenticated
          ? `Authenticated (ltuid: ${auth.ltuid_v2})`
          : 'Not authenticated'}
      </p>
    </>
  );
}
