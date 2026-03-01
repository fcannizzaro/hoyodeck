import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "@/types/settings";
import type { DataType, SuccessDataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services";
import { readLocalImageAsDataUri } from "@/utils/image";
import { buildCommissionSvg, type CommissionImages } from "@/utils/commission";
import { svgToBase64 } from "@/utils/svg";

/** Background shared across all states */
const BACKGROUND = readLocalImageAsDataUri(
  "imgs/actions/gi/commissions-bg.png",
);

/** Pre-loaded image pairs for each commission state */
const STATE_IMAGES = {
  unfinished: {
    background: BACKGROUND,
    open: readLocalImageAsDataUri(
      "imgs/actions/gi/commissions-unfinished-open.png",
    ),
    closed: readLocalImageAsDataUri(
      "imgs/actions/gi/commissions-unfinished-closed.png",
    ),
  },
  completed: {
    background: BACKGROUND,
    open: readLocalImageAsDataUri(
      "imgs/actions/gi/commissions-completed-open.png",
    ),
    closed: readLocalImageAsDataUri(
      "imgs/actions/gi/commissions-completed-closed.png",
    ),
  },
  rewarded: {
    background: BACKGROUND,
    open: readLocalImageAsDataUri(
      "imgs/actions/gi/commissions-rewarded-open.png",
    ),
    closed: readLocalImageAsDataUri(
      "imgs/actions/gi/commissions-rewarded-closed.png",
    ),
  },
} as const satisfies Record<string, CommissionImages>;

/** Per-key mutable animation state */
interface CommissionKeyState {
  interval: ReturnType<typeof setInterval> | null;
  frameIndex: number;
}

/**
 * Commission Action
 * Displays daily commission count with animated maid character.
 * Three visual states: unfinished, completed, and rewarded.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.commission" })
export class CommissionAction extends BaseAction<GenshinActionSettings, 'gi:daily-note'> {
  protected readonly game = 'gi' as const;

  /** Per-key animation state (SingletonAction shares one instance across all keys) */
  private readonly keyStates = new Map<string, CommissionKeyState>();

  /** Get or create per-key state */
  private getKeyState(actionId: string): CommissionKeyState {
    let state = this.keyStates.get(actionId);
    if (!state) {
      state = { interval: null, frameIndex: 0 };
      this.keyStates.set(actionId, state);
    }
    return state;
  }

  /** Clear the running animation interval for a specific key */
  private clearAnimation(actionId: string): void {
    const state = this.keyStates.get(actionId);
    if (!state) return;
    if (state.interval !== null) {
      clearInterval(state.interval);
      state.interval = null;
      state.frameIndex = 0;
    }
  }

  /**
   * Start the commission animation loop.
   * @param action Stream Deck key action
   * @param images Open/closed eye pair for the current state
   * @param text Text to display in the bottom bar
   */
  private startAnimation(
    action: KeyAction<GenshinActionSettings>,
    images: CommissionImages,
    text?: string,
  ): void {
    const state = this.getKeyState(action.id);

    const renderFrame = async (): Promise<void> => {
      const svg = buildCommissionSvg(images, state.frameIndex, text);
      const base64 = svgToBase64(svg);
      await action.setImage(base64);
      state.frameIndex = state.frameIndex + 1;
    };

    // Show the first frame immediately
    void renderFrame();

    if (dataController.isAnimationDisabled()) return;

    state.interval = setInterval(() => {
      void renderFrame();
    }, 100);
  }

  protected getSubscribedDataTypes(): DataType[] {
    return ['gi:daily-note'];
  }

  protected override onBeforeDataUpdate(action: KeyAction<GenshinActionSettings>): void {
    this.clearAnimation(action.id);
  }

  protected override async onDataUpdate(
    action: KeyAction<GenshinActionSettings>,
    update: SuccessDataUpdate<'gi:daily-note'>,
  ): Promise<void> {
    const dailyNote = update.entry.data;

    const completedTask = dailyNote.daily_task.attendance_rewards.filter(
      (it) => it.status === "AttendanceRewardStatusWaitTaken",
    ).length;

    const allDone =
      dailyNote.finished_task_num + completedTask >= dailyNote.total_task_num;

    const images = dailyNote.is_extra_task_reward_received
      ? STATE_IMAGES.rewarded
      : allDone
        ? STATE_IMAGES.completed
        : STATE_IMAGES.unfinished;

    const text = allDone
      ? undefined
      : `${dailyNote.finished_task_num}/${dailyNote.total_task_num}`;

    await action.setTitle("");
    this.startAnimation(action, images, text);
  }

  /** Clean up the animation interval when the action disappears */
  override onWillDisappear(
    ev: WillDisappearEvent<GenshinActionSettings>,
  ): void {
    super.onWillDisappear(ev);
    this.clearAnimation(ev.action.id);
    this.keyStates.delete(ev.action.id);
  }
}
