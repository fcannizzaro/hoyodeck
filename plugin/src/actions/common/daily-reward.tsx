import { cn, defineAction, useKeyDown, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { DailyRewardSettings, GameId } from "@hoyodeck/shared/types";
import { useAccount, AccountProvider } from "@/contexts/account-context";
import { useData, DataProvider } from "@/contexts/data-context";
import { HoyolabApiError } from "@/api/types/common";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { useImageDataUri } from "@/hooks/use-image-data-uri";
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

  const baseDataUri = useLocalImageDataUri(GAME_BACKGROUNDS[game]);
  const doneDataUri = useLocalImageDataUri(DONE_OVERLAYS[game]);

  const checkInEntry = getData(dataType);
  const checkInData = checkInEntry?.status === "ok" ? (checkInEntry.data as CheckInData) : null;
  const rewardIndex = checkInData ? checkInData.info.total_sign_day - (checkInData.info.is_sign ? 1 : 0) : -1;
  const todayReward = checkInData?.rewards.awards[rewardIndex];
  const rewardIconUri = useImageDataUri(todayReward?.icon);

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

  if (!checkInData || !rewardIconUri) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={baseDataUri} width={144} height={144} />
      </div>
    );
  }

  const claimed = checkInData.info.is_sign;
  const useGrayscale = game === "zzz" && claimed;

  return (
    <div className="relative w-full h-full">
      <img src={baseDataUri} width={144} height={144} className={cn(useGrayscale && "grayscale")} />
      <div className="absolute top-8 left-8 size-20 flex items-center justify-center">
        <img
          src={rewardIconUri}
          width={80}
          height={80}
          className={cn(claimed ? "opacity-60" : "opacity-100")}
        />
      </div>
      {claimed && (
        <div className="absolute top-0 left-0">
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
    icon: "imgs/actions/common/reward-icon",
    tooltip: "View and claim HoYoLAB daily check-in reward",
    states: [{ image: "imgs/actions/common/reward-state", titleAlignment: "middle" }],
  },
});
