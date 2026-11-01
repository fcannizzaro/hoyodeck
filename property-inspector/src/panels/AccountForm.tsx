import { roleLabel } from "../utils/role-label";
import { useState, useCallback, useEffect, useRef } from "react";
import { useStreamDeck } from "../hooks/use-stream-deck";
import { Input } from "../components/Input";
import { GameIcon } from "../components/GameIcon";
import { TextArea } from "../components/TextArea";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { StatusMessage } from "../components/StatusMessage";
import { parseCookies, extractAuthFromCookies, isValidAuth } from "@hoyodeck/shared/cookies";
import { GAMES } from "@hoyodeck/shared/games";
import type {
  GameId,
  HoyoAccount,
  HoyoAuth,
  HoyoRegion,
  PendingLogin,
} from "@hoyodeck/shared/types";
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

  const loginRequest = useRef<string | undefined>(undefined);
  const [name, setName] = useState(account?.name ?? "");
  const [region, setRegion] = useState<HoyoRegion>(account?.region ?? "global");
  const [uids, setUids] = useState(account?.uids ?? {});
  const [cookies, setCookies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedGames, setSelectedGames] = useState<GameId[]>(() =>
    getInitialSelectedGames(account),
  );

  /** Auth obtained from the native webview login flow */
  const [loginAuth, setLoginAuth] = useState<HoyoAuth | null>(null);

  const pendingLogin = globalSettings.pendingLogin as PendingLogin | undefined;
  const isPolling = pendingLogin?.status === "polling" || pendingLogin?.status === "requested";
  const primaryGame = getPrimaryGame(selectedGames);
  const primaryGameConfig = primaryGame ? GAMES[primaryGame] : null;
  const serviceName = region === "cn" ? "MiYouShe" : "HoYoLAB";
  const battleChronicleUrl = primaryGameConfig
    ? region === "cn"
      ? primaryGameConfig.cnBattleChronicleUrl
      : primaryGameConfig.battleChronicleUrl
    : null;

  // ─── Watch pendingLogin state changes from the plugin ──────────

  useEffect(() => {
    if (
      !pendingLogin ||
      !loginRequest.current ||
      pendingLogin.requestId !== loginRequest.current ||
      (pendingLogin.region ?? "global") !== region
    )
      return;

    if (pendingLogin.status === "success") {
      const auth = pendingLogin.auth;
      const loginRegion = pendingLogin.region ?? "global";
      setError(null);
      saveGlobalSettings({ pendingLogin: undefined });

      setRegion(loginRegion);
      setLoginAuth(auth);
    } else if (pendingLogin.status === "cancelled") {
      saveGlobalSettings({ pendingLogin: undefined });
    } else if (pendingLogin.status === "error") {
      setError(pendingLogin.message);
      saveGlobalSettings({ pendingLogin: undefined });
    }
  }, [pendingLogin, saveGlobalSettings, region]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleLoginWithHoyolab = useCallback(() => {
    if (!primaryGame) {
      setError("Select at least one game before opening HoYoLAB");
      return;
    }

    setError(null);
    loginRequest.current = crypto.randomUUID();
    saveGlobalSettings({
      pendingLogin: {
        status: "requested",
        game: primaryGame,
        region,
        requestId: loginRequest.current,
      },
    });
  }, [primaryGame, region, saveGlobalSettings]);

  const handleRegionChange = useCallback(
    (value: string) => {
      if (isPolling) return;
      setRegion(value as HoyoRegion);
      setUids({});
      setLoginAuth(null);
      setCookies("");
      setError(null);
    },
    [isPolling],
  );

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
    const accountRegion = account?.region ?? "global";
    const canReuseExistingAuth = account && accountRegion === region;
    let auth: HoyoAuth | undefined = loginAuth ?? (canReuseExistingAuth ? account.auth : undefined);
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

    const sameIdentity = canReuseExistingAuth && auth.ltuid_v2 === account.auth.ltuid_v2;
    const hasNewAuth = loginAuth !== null || cookies.trim() !== "";

    onSave({
      id: account?.id ?? crypto.randomUUID(),
      name: name.trim(),
      region,
      auth,
      authStatus: hasNewAuth ? "unknown" : (account?.authStatus ?? "unknown"),
      uids: sameIdentity ? uids : {},
      roles: sameIdentity ? account.roles : undefined,
      nicknames: sameIdentity
        ? Object.fromEntries(
            Object.entries(uids).map(([game, uid]) => [
              game,
              account.roles?.[game as GameId]?.find((role) => role.uid === uid)?.nickname ??
                account.nicknames?.[game as GameId],
            ]),
          )
        : undefined,
    });
  }, [name, region, cookies, loginAuth, account, onSave, uids]);

  // ─── Render ────────────────────────────────────────────────────

  const authenticationFields = (
    <>
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
            Make sure <strong>Real-Time Notes</strong> is enabled in {serviceName} for each game you
            play, otherwise the plugin won't be able to read your in-game data.
          </p>

          {/* Login with HoYoLAB button */}
          <button
            disabled={isPolling}
            onClick={handleLoginWithHoyolab}
            className="flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded text-xs text-white cursor-pointer border-none transition-opacity bg-[#1B1D2A] hover:opacity-90 active:opacity-80"
          >
            {isPolling ? (
              "Waiting for login..."
            ) : (
              <>
                Login with{" "}
                {region === "global" && <img src={hoyolabLogo} alt="" className="h-3.5" />}{" "}
                {serviceName}
              </>
            )}
          </button>

          {isPolling ? (
            <StatusMessage
              message={`A browser window has been opened. Log in to ${serviceName} and your cookies will be detected automatically.`}
              type="info"
            />
          ) : (
            <p className="text-[11px] text-sd-secondary">
              {primaryGameConfig
                ? `Opens ${primaryGameConfig.name} on ${serviceName}. Cookies will be auto-detected after you log in.`
                : `Select a game above to open the right ${serviceName} page.`}
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
              account
                ? "Paste new cookies to update..."
                : `Paste your ${serviceName} cookies here...`
            }
            info={
              primaryGameConfig && battleChronicleUrl
                ? `Open ${primaryGameConfig.name} on ${serviceName} (${battleChronicleUrl}), then open DevTools (F12) → Application → Cookies. Locate these cookies: ltoken_v2, ltuid_v2, ltmid_v2, cookie_token_v2, account_mid_v2, account_id_v2 and paste them below as key=value; pairs.`
                : `Select a game above, then open its ${serviceName} page. In DevTools (F12) → Application → Cookies, locate ltoken_v2, ltuid_v2, ltmid_v2, cookie_token_v2, account_mid_v2, account_id_v2 and paste them below as key=value; pairs.`
            }
            onChange={setCookies}
          />
        </>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-2.5 p-2.5 border border-sd-border rounded bg-sd-input/30">
      <Input label="Account Name" value={name} placeholder="e.g. Main, Alt EU" onChange={setName} />

      <Select
        disabled={isPolling}
        label="Service"
        value={region}
        options={[
          { value: "global", label: "HoYoLAB (Global)" },
          { value: "cn", label: "MiYouShe (China)" },
        ]}
        info="Choose the service where this account is registered. Existing accounts default to Global."
        onChange={handleRegionChange}
      />

      {account && !isPolling && !loginAuth ? (
        <details className="text-xs text-sd-secondary">
          <summary className="cursor-pointer py-1">Update login or cookies</summary>
          <div className="flex flex-col gap-2.5 mt-2">{authenticationFields}</div>
        </details>
      ) : (
        authenticationFields
      )}

      {/* Game UIDs (edit mode only) */}
      {account && region === (account.region ?? "global") && (
        <>
          <div className="h-px bg-sd-border" />
          <p className="text-[11px] text-sd-secondary">
            Choose the character each game uses for this entry. To show another server at the same
            time, use Add another region on the account card.
          </p>
          {GAME_IDS.map((game) => {
            const roles = account.roles?.[game] ?? [];
            const currentUid = uids[game];
            const options = roles.map((role) => ({ value: role.uid, label: roleLabel(role) }));
            if (currentUid && !options.some((option) => option.value === currentUid))
              options.unshift({ value: currentUid, label: `${currentUid} (saved character)` });
            return options.length > 0 ? (
              <Select
                key={game}
                label={GAMES[game].name}
                value={currentUid ?? options[0]!.value}
                options={options}
                onChange={(uid) => setUids((current) => ({ ...current, [game]: uid }))}
              />
            ) : null;
          })}
        </>
      )}

      {error && <StatusMessage message={error} type="error" onDismiss={() => setError(null)} />}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isPolling}>
          {account ? "Update" : "Add"}
        </Button>
        <Button
          onClick={() => {
            if (pendingLogin?.requestId === loginRequest.current)
              saveGlobalSettings({ pendingLogin: undefined });
            onCancel();
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
