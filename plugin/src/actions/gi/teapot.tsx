import { defineAction, useKeyDown, useGlobalSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings, GlobalSettings } from "@/types/settings";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { FloatingImage } from "@/components/floating-image";
import { Badge } from "@/components/badge";

const GAME = "gi" as const;
const BACKGROUND = readLocalImageAsDataUri("imgs/actions/gi/5-star.png");
const TUBBY_NORMAL = readLocalImageAsDataUri("imgs/actions/gi/tubby.png");
const TUBBY_MAX = readLocalImageAsDataUri("imgs/actions/gi/tubby-max.png");

function TeapotKey() {
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
        <img src={BACKGROUND} width={144} height={144} />
      </div>
    );
  }

  const maxReached = dailyNote.max_home_coin === dailyNote.current_home_coin;
  const percentage = Math.round((dailyNote.current_home_coin / dailyNote.max_home_coin) * 100);
  const text = maxReached ? "MAX COIN!" : `${percentage}%`;
  const tubbyIcon = maxReached ? TUBBY_MAX : TUBBY_NORMAL;

  return (
    <div className="relative w-full h-full">
      <img src={BACKGROUND} width={144} height={144} />
      {maxReached && (
        <div
          className="absolute"
          style={{
            top: 0,
            left: 0,
            width: 144,
            height: 144,
            backgroundColor: "rgba(255, 0, 0, 0.3)",
          }}
        />
      )}
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
