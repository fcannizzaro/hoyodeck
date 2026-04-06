import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings } from "@hoyodeck/shared/types";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";

const GAME = "gi" as const;
const COOLDOWN_SECONDS = 7 * 24 * 60 * 60; // 7 days

function TransformerKey() {
  const baseDataUri = useLocalImageDataUri("imgs/actions/gi/4-star.png");
  const transformerDataUri = useLocalImageDataUri("imgs/actions/gi/transformer.webp");
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

  if (!dailyNote.transformer.obtained) {
    return (
      <div className="relative w-full h-full">
        <img src={baseDataUri} width={144} height={144} />
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
  const display = isReady
    ? "Ready!"
    : recovery.Day > 0
      ? `${recovery.Day}d ${recovery.Hour}h`
      : recovery.Hour > 0
        ? `${recovery.Hour}h ${recovery.Minute}m`
        : `${recovery.Minute}m`;

  return (
    <div className="relative w-full h-full">
      <img src={baseDataUri} width={144} height={144} />
      <div className="absolute top-0 left-0 size-36">
        <img src={transformerDataUri} width={144} height={144} />
      </div>
      <div className="absolute top-0 left-0 w-36 bg-overlay-medium" style={{ height: coverH }} />
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
