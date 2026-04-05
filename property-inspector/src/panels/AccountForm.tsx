import { useState, useCallback, useRef, useEffect } from "react";
import { useStreamDeck } from "../hooks/use-stream-deck";
import { Input } from "../components/Input";
import { GameIcon } from "../components/GameIcon";
import { TextArea } from "../components/TextArea";
import { Button } from "../components/Button";
import { StatusMessage } from "../components/StatusMessage";
import { parseCookies, extractAuthFromCookies, isValidAuth } from "@hoyodeck/shared/cookies";
import { GAMES } from "@hoyodeck/shared/games";
import type { GameId, HoyoAccount, HoyoAuth, PendingLogin } from "@hoyodeck/shared/types";
import hoyolabLogo from "../assets/hoyo.webp";

/** Console snippet that extracts HoYoLAB auth cookies and copies them to clipboard */
const COOKIE_SCRIPT = `(()=>{const keys=['ltoken_v2','ltuid_v2','ltmid_v2','cookie_token_v2','account_mid_v2','account_id_v2'];const r=document.cookie.split('; ').filter(p=>{const k=p.substring(0,p.indexOf('='));return keys.includes(k)});if(!r.length){console.error('No HoYoLAB cookies found. Make sure you are logged in on hoyolab.com');return}navigator.clipboard.writeText(r.join('; ')).then(()=>console.log('Cookies copied to clipboard!')).catch(()=>prompt('Auto-copy failed. Manually copy:',r.join('; ')))})()`;

/** All game IDs in display order */
const GAME_IDS: GameId[] = ["gi", "hsr", "zzz"];

/**
 * Format a game role for display: "nickname (UID)" or just the UID.
 */
function formatGameRole(game: GameId, account: HoyoAccount): string {
  const uid = account.uids?.[game];
  if (!uid) return "";
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
 * Supports two auth methods:
 * 1. "Login with HoYoLAB" — opens a native webview, auto-detects cookies
 * 2. Manual cookie paste — user copies cookies from browser DevTools
 */
export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const { globalSettings, saveGlobalSettings } = useStreamDeck();

  const [name, setName] = useState(account?.name ?? "");
  const [cookies, setCookies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Auth obtained from the native webview login flow */
  const [loginAuth, setLoginAuth] = useState<HoyoAuth | null>(null);

  const pendingLogin = globalSettings.pendingLogin as PendingLogin | undefined;
  const isPolling = pendingLogin?.status === "polling";

  // ─── Watch pendingLogin state changes from the plugin ──────────

  useEffect(() => {
    if (!pendingLogin) return;

    if (pendingLogin.status === "success") {
      const auth = pendingLogin.auth;
      setError(null);
      saveGlobalSettings({ pendingLogin: undefined });

      // Auto-save if account name is already filled
      if (name.trim()) {
        onSave({
          id: account?.id ?? crypto.randomUUID(),
          name: name.trim(),
          auth,
          authStatus: "unknown",
          uids: account?.uids ?? {},
          nicknames: account?.nicknames,
        });
        return;
      }

      // Otherwise show success state and let user fill in name + press Add
      setLoginAuth(auth);
    } else if (pendingLogin.status === "cancelled") {
      saveGlobalSettings({ pendingLogin: undefined });
    } else if (pendingLogin.status === "error") {
      setError(pendingLogin.message);
      saveGlobalSettings({ pendingLogin: undefined });
    }
  }, [pendingLogin, saveGlobalSettings]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleLoginWithHoyolab = useCallback(() => {
    setError(null);
    saveGlobalSettings({ pendingLogin: { status: "requested" } });
  }, [saveGlobalSettings]);

  const handleCopyScript = useCallback(() => {
    navigator.clipboard.writeText(COOKIE_SCRIPT).then(() => {
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError("Account name is required");
      return;
    }

    // Priority: loginAuth (from webview) > parsed cookies > existing auth (edit mode)
    let auth: HoyoAuth | undefined = loginAuth ?? account?.auth;
    if (cookies.trim()) {
      const parsed = parseCookies(cookies.trim());
      const extracted = extractAuthFromCookies(parsed);
      if (!isValidAuth(extracted)) {
        setError("Missing required tokens. Make sure you copied the full cookie string.");
        return;
      }
      auth = extracted;
    }

    if (!auth) {
      setError("Please log in or paste cookies to continue");
      return;
    }

    const hasNewAuth = loginAuth !== null || cookies.trim() !== "";

    onSave({
      id: account?.id ?? crypto.randomUUID(),
      name: name.trim(),
      auth,
      authStatus: hasNewAuth ? "unknown" : (account?.authStatus ?? "unknown"),
      uids: account?.uids ?? {},
      nicknames: account?.nicknames,
    });
  }, [name, cookies, loginAuth, account, onSave]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2.5 p-2.5 border border-sd-border rounded bg-sd-input/30">
      <Input label="Account Name" value={name} placeholder="e.g. Main, Alt EU" onChange={setName} />

      {/* After successful webview login, show success + game UIDs */}
      {loginAuth ? (
        <>
          <StatusMessage message="Login successful!" type="success" />

          <p className="text-[11px] text-sd-secondary">
            Game UIDs will be auto-detected after saving.
          </p>
        </>
      ) : (
        <>
          {/* Login with HoYoLAB button */}
          <button
            onClick={handleLoginWithHoyolab}
            className="flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded text-xs text-white cursor-pointer border-none transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: "#1B1D2A" }}
          >
            {isPolling ? (
              "Waiting for login..."
            ) : (
              <>
                Login with <img src={hoyolabLogo} alt="HoYoLAB" className="h-3.5" />
              </>
            )}
          </button>

          {isPolling ? (
            <StatusMessage
              message="A browser window has been opened. Log in to HoYoLAB and your cookies will be detected automatically."
              type="info"
            />
          ) : (
            <p className="text-[11px] text-sd-secondary">
              Opens a browser window. Cookies will be auto-detected after you log in.
            </p>
          )}

          {/* Divider — or paste manually */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-sd-border" />
            <span className="text-[10px] text-sd-secondary uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-sd-border" />
          </div>

          {/* Manual cookie paste */}
          <TextArea
            label="Cookie String"
            value={cookies}
            placeholder={
              account ? "Paste new cookies to update..." : "Paste your HoYoLAB cookies here..."
            }
            info="Copy the script below, then on hoyolab.com open DevTools (F12) → Console tab and paste it to auto-copy cookies."
            onChange={setCookies}
          />

          <Button onClick={handleCopyScript}>{copied ? "Copied!" : "Copy Cookie Script"}</Button>
        </>
      )}

      {/* Game UIDs (edit mode only) */}
      {account && (
        <>
          <div className="h-px bg-sd-border" />
          {GAME_IDS.map((game) => (
            <Input
              key={game}
              label={GAMES[game].name}
              icon={<GameIcon game={game} />}
              value={formatGameRole(game, account)}
              placeholder="Not linked"
              readOnly
            />
          ))}
        </>
      )}

      {error && <StatusMessage message={error} type="error" onDismiss={() => setError(null)} />}

      <div className="flex gap-2">
        <Button onClick={handleSave}>{account ? "Update" : "Add"}</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
