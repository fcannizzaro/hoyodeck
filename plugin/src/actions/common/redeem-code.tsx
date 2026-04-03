import { useState, useEffect, useRef } from "react";
import {
  defineAction,
  useKeyDown,
  useSettings,
  useGlobalSettings,
  useInterval,
  useWillAppear,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type {
  RedeemCodeSettings,
  GlobalSettings,
  GameId,
  HoyoAccount,
  AccountId,
} from "@/types/settings";
import { toJsonObject } from "@/types/settings";
import type { GameCodeWithStatus } from "@hoyodeck/shared/types";
import { codesClient } from "@/api/manager/client";
import { dataController } from "@/services/data-controller";
import { readLocalImageAsDataUri } from "@/utils/image";
import { openRedeemWindow } from "@/services/redeem-window";
import { GAME_LABELS_EXTENDED } from "@hoyodeck/shared/games";
import { Badge } from "@/components/badge";

const GAME_BACKGROUNDS: Record<GameId, string> = {
  gi: "imgs/actions/gi/5-star.png",
  hsr: "imgs/actions/hsr/5-star.png",
  zzz: "imgs/actions/zzz/5-star.png",
};

const CODE_ICON = "imgs/actions/common/code-redeem.png";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Build the key used to store claimed codes: "{game}:{uid}" */
function claimedKey(game: GameId, uid: string): string {
  return `${game}:${uid}`;
}

function resolveAccount(
  accountId: AccountId | undefined,
  accounts: Record<string, HoyoAccount>,
  game: GameId,
): HoyoAccount | null {
  const all = Object.values(accounts);
  if (all.length === 0) return null;

  if (accountId && accounts[accountId]) {
    return accounts[accountId]!;
  }

  const candidates = all.filter((a) => a.uids[game] !== undefined);
  if (candidates.length === 1) return candidates[0]!;

  return null;
}

function RedeemCodeKey() {
  const [settings] = useSettings<RedeemCodeSettings & JsonObject>();
  const [globalSettings, setGlobalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  const game = (settings.game ?? "gi") as GameId;
  const accounts = globalSettings.accounts ?? {};
  const account = resolveAccount(settings.accountId as AccountId | undefined, accounts, game);
  const uid = account?.uids[game];

  const [codes, setCodes] = useState<GameCodeWithStatus[]>([]);
  const [, setRefreshTick] = useState(0);

  // Keep a ref to always have the latest globalSettings (avoids stale closures)
  const globalSettingsRef = useRef(globalSettings);
  globalSettingsRef.current = globalSettings;

  /**
   * In-memory accumulator for claimed codes within the current session.
   * Survives across rapid onClaimed calls even when the SDK hasn't
   * round-tripped the updated globalSettings yet.
   */
  const claimedAccRef = useRef<Set<string>>(new Set());

  // Seed the accumulator from persisted globalSettings on load / when settings change
  useEffect(() => {
    if (!uid) return;
    const key = claimedKey(game, uid);
    const persisted = globalSettings.claimedCodes?.[key] ?? [];
    const acc = claimedAccRef.current;
    for (const c of persisted) acc.add(c);
  }, [game, uid, globalSettings.claimedCodes]);

  // Derive localClaimed from BOTH persisted globalSettings (available synchronously
  // on mount, survives page switches) AND the in-memory accumulator (handles rapid
  // claims before globalSettings round-trips). This avoids the race where the ref
  // is empty on remount because the seeding useEffect hasn't run yet.
  const localClaimed = uid
    ? new Set([
        ...(globalSettings.claimedCodes?.[claimedKey(game, uid)] ?? []),
        ...claimedAccRef.current,
      ])
    : new Set<string>();

  /**
   * Persist a single claimed code immediately.
   * 1. Adds to the in-memory accumulator (instant, no async gap)
   * 2. Writes the full set to globalSettings (persists across restarts)
   * 3. Forces a re-render so the badge updates
   */
  const persistOneClaimed = (code: string) => {
    if (!uid) return;

    // 1. Accumulate locally
    claimedAccRef.current.add(code);

    // 2. Persist to globalSettings
    const current = globalSettingsRef.current;
    const key = claimedKey(game, uid);

    const updated: GlobalSettings = {
      ...current,
      claimedCodes: {
        ...current.claimedCodes,
        [key]: [...claimedAccRef.current],
      },
    };

    void setGlobalSettings(toJsonObject(updated));

    // 3. Force re-render so the badge count updates immediately
    setRefreshTick((t) => t + 1);
  };

  // Fetch codes from the codes-server
  const fetchCodes = async () => {
    const result = await codesClient.listCodes(game);
    setCodes(result);
  };

  // Fetch on mount and when game changes
  useEffect(() => {
    void fetchCodes();
  }, [game]);

  // Fetch on key appear (e.g. profile switch, plugin reload)
  useWillAppear(() => {
    void fetchCodes();
  });

  // Auto-refresh every 5 minutes
  useInterval(
    () =>
      setRefreshTick((t) => {
        void fetchCodes();
        return t + 1;
      }),
    REFRESH_INTERVAL_MS,
  );

  useKeyDown(async () => {
    if (!account || !uid) return;

    const client = dataController.getClient(account);
    if (!client) return;

    // Fetch fresh codes before opening window
    const freshCodes = await codesClient.listCodes(game);

    // Merge local claim status so the window shows correct state
    const merged = mergeStatus(freshCodes, localClaimed);
    setCodes(merged);

    try {
      await openRedeemWindow(game, merged, client, uid, persistOneClaimed);
    } catch {
      // Window open failed
    }

    // Refresh after window closes
    await fetchCodes();
  });

  const bgDataUri = readLocalImageAsDataUri(GAME_BACKGROUNDS[game]);
  const iconDataUri = readLocalImageAsDataUri(CODE_ICON);
  const gameLabel = GAME_LABELS_EXTENDED[game];

  if (!account) {
    return (
      <div className="relative w-full h-full">
        <img src={bgDataUri} width={144} height={144} />
        <div className="absolute flex items-center justify-center w-full h-full">
          <img src={iconDataUri} width={100} height={100} />
        </div>
        <Badge text={gameLabel} fontSize={14} />
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="relative w-full h-full">
        <img src={bgDataUri} width={144} height={144} />
        <div className="absolute flex items-center justify-center w-full h-full">
          <img src={iconDataUri} width={100} height={100} />
        </div>
        <Badge text={gameLabel} fontSize={14} />
      </div>
    );
  }

  // Merge server codes with locally tracked claims for badge count
  const merged = mergeStatus(codes, localClaimed);
  const available = merged.filter((c) => c.status === "available" && c.active);
  const count = available.length;

  return (
    <div className="relative w-full h-full">
      <img src={bgDataUri} width={144} height={144} />
      <div
        className="absolute flex items-center justify-center w-full h-full"
        style={{ top: 0, left: 0 }}
      >
        <img src={iconDataUri} width={100} height={100} />
      </div>
      {count > 0 && (
        <>
          <div
            className="absolute w-full h-full"
            style={{ top: 0, left: 0, backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          />
          <div
            className="absolute flex items-center justify-center w-full h-full"
            style={{ top: 0, left: 0 }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: "white",
                fontFamily: "Inter",
              }}
            >
              {count}
            </span>
          </div>
        </>
      )}
      <Badge text={gameLabel} fontSize={14} />
    </div>
  );
}

/**
 * Overlay local claim status onto server codes.
 * Codes the server reports as "available" but that are locally claimed
 * get their status changed to "claimed".
 */
function mergeStatus(codes: GameCodeWithStatus[], localClaimed: Set<string>): GameCodeWithStatus[] {
  return codes.map((c) => {
    if (c.status === "available" && localClaimed.has(c.code)) {
      return { ...c, status: "claimed" as const };
    }
    return c;
  });
}

export const redeemCodeAction = defineAction<RedeemCodeSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.redeem-code",
  key: RedeemCodeKey,
});
