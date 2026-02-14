import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "@/types/settings";
import { readLocalImageAsDataUri } from "@/utils/image";
import { buildTeapotAlertSvg } from "@/utils/teapot";

/** Tubby icon */
const TUBBY_NORMAL = readLocalImageAsDataUri("imgs/actions/gi/tubby.png");
const TUBBY_MAX = readLocalImageAsDataUri("imgs/actions/gi/tubby-max.png");
const BACKGROUND = readLocalImageAsDataUri("imgs/actions/gi/5-star.webp");

/**
 * Serenitea Pot (Teapot) Action
 * Displays floating tubby with coin percentage or "MAX COIN!" alert
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.teapot" })
export class TeapotAction extends BaseAction<GenshinActionSettings> {
  /** Interval handle for the floating animation */
  private animationInterval: ReturnType<typeof setInterval> | null = null;

  /** Current frame index in the float cycle */
  private frameIndex = 0;

  /**
   * Clear the running animation interval, if any
   */
  private clearAnimation(): void {
    if (this.animationInterval !== null) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
      this.frameIndex = 0;
    }
  }

  /**
   * Start the floating tubby animation.
   * @param action Stream Deck key action
   * @param tubbyPath Relative path to the tubby icon to use
   * @param text Text to display in the bottom bar
   * @param isMax Whether coins are at maximum (applies red tint)
   */
  private startAnimation(
    action: KeyAction<GenshinActionSettings>,
    text: string,
    isMax: boolean,
  ): void {
    const renderFrame = async (): Promise<void> => {
      const svg = buildTeapotAlertSvg(
        BACKGROUND,
        isMax ? TUBBY_MAX : TUBBY_NORMAL,
        this.frameIndex,
        text,
        isMax,
      );
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setImage(base64);
      this.frameIndex = this.frameIndex + 1;
    };

    // Show the first frame immediately
    void renderFrame();

    this.animationInterval = setInterval(() => {
      void renderFrame();
    }, 200);
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

    const uid = this.getGameUid(ctx.account, "genshin");
    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const dailyNote = await ctx.client.getGenshinDailyNote(uid);
    const maxReached = dailyNote.max_home_coin === dailyNote.current_home_coin;

    const percentage = Math.round(
      (dailyNote.current_home_coin / dailyNote.max_home_coin) * 100,
    );

    const text = maxReached ? "MAX COIN!" : `${percentage}%`;

    await action.setTitle("");
    this.startAnimation(action, text, maxReached);
  }

  /**
   * Clean up the animation interval when the action disappears from the deck
   */
  override onWillDisappear(
    ev: WillDisappearEvent<GenshinActionSettings>,
  ): void {
    this.clearAnimation();
  }
}
