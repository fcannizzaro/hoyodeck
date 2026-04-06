import { useState } from "react";
import {
  defineAction,
  useKeyDown,
  useGlobalSettings,
  useInterval,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings, GlobalSettings } from "@hoyodeck/shared/types";
import { useGameData } from "@/hooks/use-game-data";
import { useBlink } from "@/hooks/use-blink";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";

const GAME = "gi" as const;

// Float animation constants (blink is handled by the global coordinator)
const FLOAT_FRAMES = 30;
const AMPLITUDE_X = 2;

const FLOAT_X: ReadonlyArray<number> = Array.from({ length: FLOAT_FRAMES }, (_, i) => {
  const t = (i / FLOAT_FRAMES) * Math.PI * 2;
  return Math.round(Math.sin(t) * AMPLITUDE_X * 10) / 10;
});

function CommissionKey() {
  const background = useLocalImageDataUri("imgs/actions/gi/commissions-bg.png");
  const unfinishedOpen = useLocalImageDataUri("imgs/actions/gi/commissions-unfinished-open.png");
  const unfinishedClosed = useLocalImageDataUri(
    "imgs/actions/gi/commissions-unfinished-closed.png",
  );
  const completedOpen = useLocalImageDataUri("imgs/actions/gi/commissions-completed-open.png");
  const completedClosed = useLocalImageDataUri("imgs/actions/gi/commissions-completed-closed.png");
  const rewardedOpen = useLocalImageDataUri("imgs/actions/gi/commissions-rewarded-open.png");
  const rewardedClosed = useLocalImageDataUri("imgs/actions/gi/commissions-rewarded-closed.png");

  const stateImages = {
    unfinished: { open: unfinishedOpen, closed: unfinishedClosed },
    completed: { open: completedOpen, closed: completedClosed },
    rewarded: { open: rewardedOpen, closed: rewardedClosed },
  };

  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData("gi:daily-note");
  const animationsDisabled = globalSettings.disableAnimations ?? false;

  const [frameIndex, setFrameIndex] = useState(0);

  useInterval(() => setFrameIndex((i) => (i + 1) % FLOAT_FRAMES), animationsDisabled ? null : 100);
  const blink = useBlink(!animationsDisabled);

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

  const completedTask = dailyNote.daily_task.attendance_rewards.filter(
    (it) => it.status === "AttendanceRewardStatusWaitTaken",
  ).length;

  const allDone = dailyNote.finished_task_num + completedTask >= dailyNote.total_task_num;

  const images = dailyNote.is_extra_task_reward_received
    ? stateImages.rewarded
    : allDone
      ? stateImages.completed
      : stateImages.unfinished;

  const text = allDone ? undefined : `${dailyNote.finished_task_num}/${dailyNote.total_task_num}`;

  const floatX = FLOAT_X[frameIndex % FLOAT_X.length]!;
  const charSrc = blink ? images.closed : images.open;

  return (
    <div className="relative w-full h-full">
      <img src={background} width={144} height={144} />
      <div className="absolute top-0" style={{ left: floatX }}>
        <img src={charSrc} width={144} height={144} />
      </div>
      {text && <Badge text={text} />}
    </div>
  );
}

export const commissionAction = defineAction<GenshinActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.commission",
  key: CommissionKey,
  wrapper: createActionWrapper(GAME, ["gi:daily-note"]),
  info: {
    name: "[GI] Commissions",
    icon: "imgs/actions/gi/commissions-icon",
    tooltip: "Display remaining daily commissions",
    states: [{ image: "imgs/actions/gi/commissions-bg", titleAlignment: "middle" }],
  },
});
