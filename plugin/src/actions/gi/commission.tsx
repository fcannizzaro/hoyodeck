import { useState } from "react";
import {
  defineAction,
  useKeyDown,
  useGlobalSettings,
  useInterval,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings, GlobalSettings } from "@/types/settings";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";

const GAME = "gi" as const;
const BACKGROUND = readLocalImageAsDataUri("imgs/actions/gi/commissions-bg.png");

const STATE_IMAGES = {
  unfinished: {
    open: readLocalImageAsDataUri("imgs/actions/gi/commissions-unfinished-open.png"),
    closed: readLocalImageAsDataUri("imgs/actions/gi/commissions-unfinished-closed.png"),
  },
  completed: {
    open: readLocalImageAsDataUri("imgs/actions/gi/commissions-completed-open.png"),
    closed: readLocalImageAsDataUri("imgs/actions/gi/commissions-completed-closed.png"),
  },
  rewarded: {
    open: readLocalImageAsDataUri("imgs/actions/gi/commissions-rewarded-open.png"),
    closed: readLocalImageAsDataUri("imgs/actions/gi/commissions-rewarded-closed.png"),
  },
} as const;

// Animation constants
const TOTAL_FRAMES = 30;
const AMPLITUDE_X = 2;
const BLINK_START = 12;
const BLINK_END = 15;

const FLOATS: ReadonlyArray<{ x: number; blink: boolean }> = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => {
    const t = (i / TOTAL_FRAMES) * Math.PI * 2;
    return {
      x: Math.round(Math.sin(t) * AMPLITUDE_X * 10) / 10,
      blink: i >= BLINK_START && i <= BLINK_END,
    };
  },
);

function CommissionKey() {
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData("gi:daily-note");
  const animationsDisabled = globalSettings.disableAnimations ?? false;

  const [frameIndex, setFrameIndex] = useState(0);

  useInterval(() => setFrameIndex((i) => (i + 1) % TOTAL_FRAMES), animationsDisabled ? null : 100);

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

  const completedTask = dailyNote.daily_task.attendance_rewards.filter(
    (it) => it.status === "AttendanceRewardStatusWaitTaken",
  ).length;

  const allDone = dailyNote.finished_task_num + completedTask >= dailyNote.total_task_num;

  const images = dailyNote.is_extra_task_reward_received
    ? STATE_IMAGES.rewarded
    : allDone
      ? STATE_IMAGES.completed
      : STATE_IMAGES.unfinished;

  const text = allDone ? undefined : `${dailyNote.finished_task_num}/${dailyNote.total_task_num}`;

  const float = FLOATS[frameIndex % FLOATS.length]!;
  const charSrc = float.blink ? images.closed : images.open;

  return (
    <div className="relative w-full h-full">
      <img src={BACKGROUND} width={144} height={144} />
      <div className="absolute" style={{ top: 0, left: float.x }}>
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
});
