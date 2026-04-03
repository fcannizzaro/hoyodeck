import { defineAction, useKeyDown, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { TransformerSettings } from "@/types/settings";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";
import { formatTransformerTime } from "@/utils/time";

const GAME = "gi" as const;
const BG_COOLDOWN = readLocalImageAsDataUri("imgs/actions/gi/transformerState@2x.png");
const BG_READY = readLocalImageAsDataUri("imgs/actions/gi/transformerReadyState@2x.png");

function TransformerKey() {
  const [settings] = useSettings<TransformerSettings & JsonObject>();
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData("gi:daily-note");
  const style = settings.style ?? "icon";

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
        <img src={BG_COOLDOWN} width={144} height={144} />
      </div>
    );
  }

  if (!dailyNote.transformer.obtained) {
    return (
      <div className="relative w-full h-full">
        <img src={BG_COOLDOWN} width={144} height={144} />
        <Badge text="N/A" />
      </div>
    );
  }

  const isReady = dailyNote.transformer.recovery_time.reached;
  const background = isReady ? BG_READY : BG_COOLDOWN;

  if (style === "icon") {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={background} width={144} height={144} />
      </div>
    );
  }

  // Text mode: image background with countdown badge
  const display = isReady ? "Ready!" : formatTransformerTime(dailyNote.transformer.recovery_time);

  return (
    <div className="relative w-full h-full">
      <img src={background} width={144} height={144} />
      <Badge text={display} />
    </div>
  );
}

export const transformerAction = defineAction<TransformerSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.transformer",
  key: TransformerKey,
  wrapper: createActionWrapper(GAME, ["gi:daily-note"]),
});
