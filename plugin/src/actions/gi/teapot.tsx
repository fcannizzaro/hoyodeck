import { defineAction, useKeyDown, useGlobalSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings, GlobalSettings } from "@hoyodeck/shared/types";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { PlaceholderKey } from "@/components/placeholder-key";
import { FloatingImage } from "@/components/floating-image";
import { Badge } from "@/components/badge";

const GAME = "gi" as const;

function TeapotKey() {
  const background = useLocalImageDataUri("imgs/actions/gi/5-star.png");
  const tubbyNormal = useLocalImageDataUri("imgs/actions/gi/tubby.png");
  const tubbyMax = useLocalImageDataUri("imgs/actions/gi/tubby-max.png");
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData("gi:daily-note");
  const animationsDisabled = globalSettings.disableAnimations ?? false;

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
        <img src={background} width={144} height={144} />
      </div>
    );
  }

  const maxReached = dailyNote.max_home_coin === dailyNote.current_home_coin;
  const percentage = Math.round((dailyNote.current_home_coin / dailyNote.max_home_coin) * 100);
  const text = maxReached ? "MAX COIN!" : `${percentage}%`;
  const tubbyIcon = maxReached ? tubbyMax : tubbyNormal;

  return (
    <div className="relative w-full h-full">
      <img src={background} width={144} height={144} />
      {maxReached && <div className="absolute inset-0 bg-danger-tint" />}
      <FloatingImage src={tubbyIcon} animate={!animationsDisabled} />
      <Badge text={text} />
    </div>
  );
}

export const teapotAction = defineAction<GenshinActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.teapot",
  key: TeapotKey,
  wrapper: createActionWrapper(GAME, ["gi:daily-note"]),
  info: {
    name: "[GI] Teapot",
    icon: "imgs/actions/gi/teapot-icon",
    tooltip: "Display Serenitea Pot realm currency",
    states: [{ image: "imgs/actions/gi/teapot-state", titleAlignment: "middle" }],
  },
});
