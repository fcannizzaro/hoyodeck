import { useState, useCallback, useEffect } from "react";
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

/** All game IDs in display order */
const GAME_IDS: GameId[] = ["gi", "hsr", "zzz"];

function getInitialSelectedGames(account?: HoyoAccount): GameId[] {
  if (!account) return [];
  return GAME_IDS.filter((game) => Boolean(account.uids?.[game]));
}

function getPrimaryGame(selectedGames: GameId[]): GameId | null {
  return GAME_IDS.find((game) => selectedGames.includes(game)) ?? null;
}

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
  const [selectedGames, setSelectedGames] = useState<GameId[]>(() =>
    getInitialSelectedGames(account),
  );

  /** Auth obtained from the native webview login flow */
  const [loginAuth, setLoginAuth] = useState<HoyoAuth | null>(null);

  const pendingLogin = globalSettings.pendingLogin as PendingLogin | undefined;
  const isPolling = pendingLogin?.status === "polling";
  const primaryGame = getPrimaryGame(selectedGames);
  const primaryGameConfig = primaryGame ? GAMES[primaryGame] : null;

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
  }, [pendingLogin, saveGlobalSettings, name, account, onSave]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleLoginWithHoyolab = useCallback(() => {
    if (!primaryGame) {
      setError("Select at least one game before opening HoYoLAB");
      return;
    }

    setError(null);
    saveGlobalSettings({ pendingLogin: { status: "requested", game: primaryGame } });
  }, [primaryGame, saveGlobalSettings]);

  const handleToggleGame = useCallback((game: GameId) => {
    setSelectedGames((current) =>
      current.includes(game)
        ? current.filter((currentGame) => currentGame !== game)
        : [...current, game],
    );
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

      <div className="flex flex-col gap-1.5">
        <div>
          <p className="text-[11px] font-medium text-sd-text">Games you play</p>
          <p className="text-[11px] text-sd-secondary leading-relaxed">
            Select at least one game before logging in. HoYo Deck will open the first selected
            game's Battle Chronicle and auto-detect every linked UID after saving.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          {GAME_IDS.map((game) => {
            const checked = selectedGames.includes(game);

            return (
              <label
                key={game}
                className="flex items-center gap-2 rounded border border-sd-border bg-sd-input/30 px-2 py-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleGame(game)}
                  className="w-4 h-4 accent-sd-focus"
                />
                <GameIcon game={game} />
                <span className="text-sm text-sd-text">{GAMES[game].name}</span>
              </label>
            );
          })}
        </div>
      </div>

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
          {/* Real-Time Notes reminder */}
          <p className="text-[11px] text-sd-secondary leading-relaxed">
            Make sure <strong>Real-Time Notes</strong> is enabled on{" "}
            <span className="text-white">HoYoLAB → Settings</span> for each game you play, otherwise
            the plugin won't be able to read your in-game data.
          </p>

          {/* Login with HoYoLAB button */}
          <button
            onClick={handleLoginWithHoyolab}
            className="flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded text-xs text-white cursor-pointer border-none transition-opacity bg-[#1B1D2A] hover:opacity-90 active:opacity-80"
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
              {primaryGameConfig
                ? `Opens ${primaryGameConfig.name} Battle Chronicle. Cookies will be auto-detected after you log in.`
                : "Select a game above to open the right HoYoLAB page."}
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
            info={
              primaryGameConfig
                ? `Open ${primaryGameConfig.name} Battle Chronicle (${primaryGameConfig.battleChronicleUrl}), then open DevTools (F12) → Application → Cookies. Locate these cookies: ltoken_v2, ltuid_v2, ltmid_v2, cookie_token_v2, account_mid_v2, account_id_v2 and paste them below as key=value; pairs.`
                : "Select a game above, then open its Battle Chronicle page. In DevTools (F12) → Application → Cookies, locate ltoken_v2, ltuid_v2, ltmid_v2, cookie_token_v2, account_mid_v2, account_id_v2 and paste them below as key=value; pairs."
            }
            onChange={setCookies}
          />
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
