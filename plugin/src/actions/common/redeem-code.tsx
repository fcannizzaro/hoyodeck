import { defineAction, useKeyDown, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { RedeemCodeSettings, GameId } from "@hoyodeck/shared/types";
import { useAccount } from "@/contexts/account-context";
import { AccountProvider } from "@/contexts/account-context";
import { DataProvider } from "@/contexts/data-context";
import { CodesProvider, useRedeemCodes } from "@/contexts/codes-context";
import { readLocalImageAsDataUri } from "@/utils/image";
import { GAME_LABELS_EXTENDED } from "@hoyodeck/shared/games";
import { Badge } from "@/components/badge";

const GAME_BACKGROUNDS: Record<GameId, string> = {
  gi: "imgs/actions/gi/5-star.png",
  hsr: "imgs/actions/hsr/5-star.png",
  zzz: "imgs/actions/zzz/5-star.png",
};

const CODE_ICON = "imgs/actions/common/code-redeem.png";

function RedeemCodeKey() {
  const [settings] = useSettings<RedeemCodeSettings & JsonObject>();
  const account = useAccount();
  const { availableCount, redeemAll } = useRedeemCodes();

  const game = (settings.game ?? "gi") as GameId;

  useKeyDown(async () => {
    await redeemAll();
  });

  const bgDataUri = readLocalImageAsDataUri(GAME_BACKGROUNDS[game]);
  const iconDataUri = readLocalImageAsDataUri(CODE_ICON);
  const gameLabel = GAME_LABELS_EXTENDED[game];

  if (account.status !== "resolved") {
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

  if (!account.account.uids[game]) {
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

  const count = availableCount;

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
 * Custom wrapper for Redeem Code — supports multi-game via settings.game.
 *
 * Composes AccountProvider + DataProvider (for client access) + CodesProvider
 * with a dynamic game derived from per-action settings.
 *
 * QueryClientProvider is provided at the plugin level.
 */
function RedeemCodeWrapper({ children }: { children?: React.ReactNode }) {
  const [settings] = useSettings<RedeemCodeSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;

  return (
    <AccountProvider game={game}>
      <DataProvider game={game} dataTypes={[]}>
        <CodesProvider>{children}</CodesProvider>
      </DataProvider>
    </AccountProvider>
  );
}

export const redeemCodeAction = defineAction<RedeemCodeSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.redeem-code",
  key: RedeemCodeKey,
  wrapper: RedeemCodeWrapper,
  info: {
    name: "Redeem Code",
    icon: "imgs/actions/common/redeem-icon",
    tooltip: "Redeem HoYoverse gift codes via the manager",
    states: [{ image: "imgs/actions/common/redeem-state", titleAlignment: "middle" }],
  },
});
