import { useState, useEffect } from "react";
import { defineAction, useKeyDown, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { DailyRewardSettings, GameId } from "@hoyodeck/shared/types";
import { useAccount, AccountProvider } from "@/contexts/account-context";
import { useData, DataProvider } from "@/contexts/data-context";
import { HoyolabApiError } from "@/api/types/common";
import { fetchImageAsDataUri, readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";
import type { DataType, CheckInData } from "@/services/data-controller.types";

const GAME_BACKGROUNDS: Record<GameId, string> = {
  gi: "imgs/actions/gi/daily.png",
  hsr: "imgs/actions/hsr/daily.png",
  zzz: "imgs/actions/zzz/daily.png",
};

const DONE_OVERLAYS: Record<GameId, string> = {
  gi: "imgs/actions/gi/done.png",
  hsr: "imgs/actions/hsr/done.png",
  zzz: "imgs/actions/zzz/done.png",
};

function DailyRewardKey() {
  const [settings] = useSettings<DailyRewardSettings & JsonObject>();
  const account = useAccount();
  const { getData, getClient, requestUpdate } = useData();

  const game = (settings.game ?? "gi") as GameId;
  const claimOnClick = settings.claimOnClick ?? true;
  const dataType = `${game}:check-in` as DataType;

  const checkInEntry = getData(dataType);
  const checkInData = checkInEntry?.status === "ok" ? (checkInEntry.data as CheckInData) : null;

  const [rewardIconUri, setRewardIconUri] = useState<string | null>(null);

  // Fetch reward icon
  useEffect(() => {
    if (!checkInData) {
      setRewardIconUri(null);
      return;
    }

    const { info, rewards } = checkInData;
    const rewardIndex = info.total_sign_day - (info.is_sign ? 1 : 0);
    const todayReward = rewards.awards[rewardIndex];

    if (!todayReward) {
      setRewardIconUri(null);
      return;
    }

    let cancelled = false;
    fetchImageAsDataUri(todayReward.icon).then((uri: string) => {
      if (!cancelled) setRewardIconUri(uri);
    });

    return () => {
      cancelled = true;
    };
  }, [checkInData]);

  useKeyDown(async () => {
    if (account.status !== "resolved") return;

    const client = getClient();
    if (!client) return;

    // Already claimed — just show ok
    if (checkInData?.info.is_sign) return;

    if (claimOnClick) {
      try {
        await client.claimCheckIn(game);
      } catch (error) {
        if (error instanceof HoyolabApiError && error.retcode === -5003) {
          // Already claimed
        } else {
          throw error;
        }
      }
    }

    await requestUpdate();
  });

  if (account.status !== "resolved") {
    return <PlaceholderKey game={game} status={account.status} />;
  }

  const baseDataUri = readLocalImageAsDataUri(GAME_BACKGROUNDS[game]);

  if (!checkInData || !rewardIconUri) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={baseDataUri} width={144} height={144} />
      </div>
    );
  }

  const { info, rewards } = checkInData;
  const rewardIndex = info.total_sign_day - (info.is_sign ? 1 : 0);
  const todayReward = rewards.awards[rewardIndex];
  const claimed = info.is_sign;
  const doneDataUri = readLocalImageAsDataUri(DONE_OVERLAYS[game]);
  const useGrayscale = game === "zzz" && claimed;

  return (
    <div className="relative w-full h-full">
      <img
        src={baseDataUri}
        width={144}
        height={144}
        style={useGrayscale ? { filter: "grayscale(100%)" } : undefined}
      />
      <div
        className="absolute flex items-center justify-center"
        style={{ top: 32, left: 32, width: 80, height: 80 }}
      >
        <img src={rewardIconUri} width={80} height={80} style={{ opacity: claimed ? 0.6 : 1 }} />
      </div>
      {claimed && (
        <div className="absolute" style={{ top: 0, left: 0 }}>
          <img src={doneDataUri} width={144} height={144} />
        </div>
      )}
      {!claimed && todayReward && <Badge text={`x${todayReward.cnt}`} />}
    </div>
  );
}

/**
 * Custom wrapper for Daily Reward — supports multi-game via settings.game.
 *
 * The game used for account resolution is dynamic based on per-action settings.
 * QueryClientProvider is provided at the plugin level.
 */
function DailyRewardWrapper({ children }: { children?: React.ReactNode }) {
  const [settings] = useSettings<DailyRewardSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;
  const dataType = `${game}:check-in` as DataType;

  return (
    <AccountProvider game={game}>
      <DataProvider game={game} dataTypes={[dataType]}>
        {children}
      </DataProvider>
    </AccountProvider>
  );
}

export const dailyRewardAction = defineAction<DailyRewardSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.daily-reward",
  key: DailyRewardKey,
  wrapper: DailyRewardWrapper,
  info: {
    name: "Daily Reward",
    icon: "imgs/actions/gi/reward-icon",
    tooltip: "View and claim HoYoLAB daily check-in reward",
    states: [{ image: "imgs/actions/gi/reward-state", titleAlignment: "middle" }],
  },
});
