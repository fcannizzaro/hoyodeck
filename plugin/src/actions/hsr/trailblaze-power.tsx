import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { StarRailActionSettings } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { StaminaKey } from "@/components/stamina-key";

const GAME = "hsr" as const;
const MAX_STAMINA = GAMES.hsr.staminaMax;
const BASE_DATA_URI = readLocalImageAsDataUri("imgs/actions/hsr/trailblaze-power-state@2x.png");
const STAMINA_DATA_URI = readLocalImageAsDataUri("imgs/actions/hsr/trailblaze-power.webp");

function TrailblazePowerKey() {
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData("hsr:daily-note");

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
      iconImage={STAMINA_DATA_URI}
      current={dailyNote.current_stamina}
      max={MAX_STAMINA}
    />
  );
}

export const trailblazePowerAction = defineAction<StarRailActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.hsr.trailblaze-power",
  key: TrailblazePowerKey,
  wrapper: createActionWrapper(GAME, ["hsr:daily-note"]),
  info: {
    name: "[HSR] Trailblaze Power",
    icon: "imgs/actions/hsr/trailblaze-power-icon",
    tooltip: "Display and refresh Trailblaze Power",
    states: [{ image: "imgs/actions/hsr/trailblaze-power-state", titleAlignment: "middle" }],
  },
});
