import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { StaminaKey } from "@/components/stamina-key";

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

  return (
    <StaminaKey
      baseImage={BASE_DATA_URI}
      iconImage={RESIN_DATA_URI}
      current={dailyNote.current_resin}
      max={MAX_RESIN}
    />
  );
}

export const resinAction = defineAction<GenshinActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.resin",
  key: ResinKey,
  wrapper: createActionWrapper(GAME, ["gi:daily-note"]),
  info: {
    name: "[GI] Resin",
    icon: "imgs/actions/gi/resin-icon",
    tooltip: "Display and refresh Original Resin",
    states: [{ image: "imgs/actions/gi/3-star", titleAlignment: "middle" }],
  },
});
