import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings } from "@/types/settings";
import { GAMES } from "@/types/games";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";

const GAME = "gi" as const;
const MAX_RESIN = GAMES.gi.staminaMax;
const BASE_DATA_URI = readLocalImageAsDataUri("imgs/actions/gi/3-star.png");
const RESIN_DATA_URI = readLocalImageAsDataUri("imgs/actions/gi/resin.webp");

function ResinKey() {
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData("gi:daily-note");

  useKeyDown(() => {
    void requestUpdate();
  });

  if (account.status !== "resolved") {
    return <PlaceholderKey game={GAME} status={account.status} />;
  }

  const dailyNote = dailyNoteEntry?.status === "ok" ? dailyNoteEntry.data : null;

  if (!dailyNote) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={BASE_DATA_URI} width={144} height={144} />
      </div>
    );
  }

  const current = dailyNote.current_resin;
  const percentage = Math.min(Math.max(current / MAX_RESIN, 0), 1);
  const coverH = Math.round(144 * (1 - percentage));

  return (
    <div className="relative w-full h-full">
      <img src={BASE_DATA_URI} width={144} height={144} />
      <div className="absolute" style={{ top: 0, left: 0, width: 144, height: 144 }}>
        <img src={RESIN_DATA_URI} width={144} height={144} />
      </div>
      <div
        className="absolute"
        style={{
          top: 0,
          left: 0,
          width: 144,
          height: coverH,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
        }}
      />
      <Badge text={`${current}`} />
    </div>
  );
}

export const resinAction = defineAction<GenshinActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.resin",
  key: ResinKey,
  wrapper: createActionWrapper(GAME, ["gi:daily-note"]),
});
