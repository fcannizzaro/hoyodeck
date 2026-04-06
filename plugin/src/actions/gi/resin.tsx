import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { PlaceholderKey } from "@/components/placeholder-key";
import { StaminaKey } from "@/components/stamina-key";

const GAME = "gi" as const;
const MAX_RESIN = GAMES.gi.staminaMax;

function ResinKey() {
  const baseDataUri = useLocalImageDataUri("imgs/actions/gi/3-star.png");
  const resinDataUri = useLocalImageDataUri("imgs/actions/gi/resin.webp");
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
        <img src={baseDataUri} width={144} height={144} />
      </div>
    );
  }

  return (
    <StaminaKey
      baseImage={baseDataUri}
      iconImage={resinDataUri}
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
