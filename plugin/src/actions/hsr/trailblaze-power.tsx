import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { StarRailActionSettings } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { PlaceholderKey } from "@/components/placeholder-key";
import { StaminaKey } from "@/components/stamina-key";

const GAME = "hsr" as const;
const MAX_STAMINA = GAMES.hsr.staminaMax;

function TrailblazePowerKey() {
  const baseDataUri = useLocalImageDataUri("imgs/actions/hsr/trailblaze-power-state@2x.png");
  const staminaDataUri = useLocalImageDataUri("imgs/actions/hsr/trailblaze-power.webp");
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
        <img src={baseDataUri} width={144} height={144} />
      </div>
    );
  }

  return (
    <StaminaKey
      baseImage={baseDataUri}
      iconImage={staminaDataUri}
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
