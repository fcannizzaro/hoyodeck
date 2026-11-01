import { useRef } from "react";
import { defineAction, useKeyDown, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { RedeemCodeSettings, GameId } from "@hoyodeck/shared/types";
import { CodesProvider, useRedeemCodes } from "@/contexts/codes-context";
import { showCodesWindow } from "@/services/codes-window";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
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
  const { codes, refreshCodes } = useRedeemCodes();
  const opening = useRef(false);
  const game = settings.game ?? "gi";
  const bgDataUri = useLocalImageDataUri(GAME_BACKGROUNDS[game]);
  const iconDataUri = useLocalImageDataUri(CODE_ICON);

  useKeyDown(async () => {
    if (opening.current) return;
    opening.current = true;
    try {
      await showCodesWindow(game, await refreshCodes());
    } finally {
      opening.current = false;
    }
  });

  return (
    <div className="relative w-full h-full">
      <img src={bgDataUri} width={144} height={144} />
      <div className="absolute inset-0 flex items-center justify-center">
        <img src={iconDataUri} width={100} height={100} />
      </div>
      {codes.length > 0 && (
        <>
          <div className="absolute inset-0 bg-overlay-light" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[64px] font-bold text-white font-body">{codes.length}</span>
          </div>
        </>
      )}
      <Badge text={GAME_LABELS_EXTENDED[game]} fontSize={14} />
    </div>
  );
}

export const redeemCodeAction = defineAction<RedeemCodeSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.redeem-code",
  key: RedeemCodeKey,
  wrapper: CodesProvider,
  info: {
    name: "Redeem Code",
    disableCaching: true,
    icon: "imgs/actions/common/redeem-icon",
    tooltip: "Show available gift codes and redeem manually on the official website",
    states: [{ image: "imgs/actions/common/reward-state", titleAlignment: "middle" }],
  },
});
