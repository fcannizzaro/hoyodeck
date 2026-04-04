import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { StarRailActionSettings } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";

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

  const current = dailyNote.current_stamina;
  const percentage = Math.min(Math.max(current / MAX_STAMINA, 0), 1);
  const coverH = Math.round(144 * (1 - percentage));

  return (
    <div className="relative w-full h-full">
      <img src={BASE_DATA_URI} width={144} height={144} />
      <div className="absolute" style={{ top: 0, left: 0, width: 144, height: 144 }}>
        <img src={STAMINA_DATA_URI} width={144} height={144} />
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
