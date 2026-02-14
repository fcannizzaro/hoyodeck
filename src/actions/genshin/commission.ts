import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "../../types/settings";
import { readLocalImageAsDataUri } from "../../utils/image";
import {
  buildCommissionSvg,
  type CommissionImages,
} from "../../utils/commission";
import { da } from "zod/v4/locales";

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

/**
 * Commission Action
 * Displays daily commission count with animated maid character.
 * Three visual states: unfinished, completed, and rewarded.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.commission" })
export class CommissionAction extends BaseAction<GenshinActionSettings> {
  /** Interval handle for the animation loop */
  private animationInterval: ReturnType<typeof setInterval> | null = null;

  /** Current frame index in the animation cycle */
  private frameIndex = 0;

  /** Clear the running animation interval, if any */
  private clearAnimation(): void {
    if (this.animationInterval !== null) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
      this.frameIndex = 0;
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
    const renderFrame = async (): Promise<void> => {
      const svg = buildCommissionSvg(images, this.frameIndex, text);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setImage(base64);
      this.frameIndex = this.frameIndex + 1;
    };

    // Show the first frame immediately
    void renderFrame();

    this.animationInterval = setInterval(() => {
      void renderFrame();
    }, 100);
  }

  protected override async refresh(
    action: KeyAction<GenshinActionSettings>,
    settings: GenshinActionSettings,
  ): Promise<void> {
    this.clearAnimation();

    const ctx = await this.getAccountContext(settings);
    if (!ctx) {
      await this.showNoAccount(action);
      return;
    }

    const uid = this.getGameUid(ctx.account, 'genshin');
    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const dailyNote = await ctx.client.getGenshinDailyNote(uid);

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
    this.clearAnimation();
  }
}
