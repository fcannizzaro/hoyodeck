import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings } from "@hoyodeck/shared/types";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";
import { formatTransformerTime } from "@/utils/time";

const GAME = "gi" as const;
const COOLDOWN_SECONDS = 7 * 24 * 60 * 60; // 7 days
const BASE_DATA_URI = readLocalImageAsDataUri("imgs/actions/gi/4-star.png");
const TRANSFORMER_DATA_URI = readLocalImageAsDataUri("imgs/actions/gi/transformer.webp");

function TransformerKey() {
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

  if (!dailyNote.transformer.obtained) {
    return (
      <div className="relative w-full h-full">
        <img src={BASE_DATA_URI} width={144} height={144} />
        <Badge text="N/A" />
      </div>
    );
  }

  const recovery = dailyNote.transformer.recovery_time;
  const isReady = recovery.reached;
  const remainingSeconds =
    recovery.Day * 86400 + recovery.Hour * 3600 + recovery.Minute * 60 + recovery.Second;
  const percentage = isReady
    ? 1
    : Math.min(Math.max(1 - remainingSeconds / COOLDOWN_SECONDS, 0), 1);
  const coverH = Math.round(144 * (1 - percentage));
  const display = isReady ? "Ready!" : formatTransformerTime(recovery);

  return (
    <div className="relative w-full h-full">
      <img src={BASE_DATA_URI} width={144} height={144} />
      <div className="absolute" style={{ top: 0, left: 0, width: 144, height: 144 }}>
        <img src={TRANSFORMER_DATA_URI} width={144} height={144} />
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
      <Badge text={display} />
    </div>
  );
}

export const transformerAction = defineAction<GenshinActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.transformer",
  key: TransformerKey,
  wrapper: createActionWrapper(GAME, ["gi:daily-note"]),
  info: {
    name: "[GI] Transformer",
    icon: "imgs/actions/gi/transformer-icon",
    tooltip: "Display Parametric Transformer cooldown",
    states: [{ image: "imgs/actions/gi/4-star", titleAlignment: "middle" }],
  },
});
