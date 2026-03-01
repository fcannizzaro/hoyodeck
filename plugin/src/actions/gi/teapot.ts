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
import { buildTeapotAlertSvg } from "@/utils/teapot";
import { svgToBase64 } from "@/utils/svg";

/** Tubby icon */
const TUBBY_NORMAL = readLocalImageAsDataUri("imgs/actions/gi/tubby.png");
const TUBBY_MAX = readLocalImageAsDataUri("imgs/actions/gi/tubby-max.png");
const BACKGROUND = readLocalImageAsDataUri("imgs/actions/gi/5-star.png");

/** Per-key mutable animation state */
interface TeapotKeyState {
  interval: ReturnType<typeof setInterval> | null;
  frameIndex: number;
}

/**
 * Serenitea Pot (Teapot) Action
 * Displays floating tubby with coin percentage or "MAX COIN!" alert
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.teapot" })
export class TeapotAction extends BaseAction<GenshinActionSettings, 'gi:daily-note'> {
  protected readonly game = 'gi' as const;

  /** Per-key animation state (SingletonAction shares one instance across all keys) */
  private readonly keyStates = new Map<string, TeapotKeyState>();

  /** Get or create per-key state */
  private getKeyState(actionId: string): TeapotKeyState {
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
   * Start the floating tubby animation.
   * @param action Stream Deck key action
   * @param text Text to display in the bottom bar
   * @param isMax Whether coins are at maximum (applies red tint)
   */
  private startAnimation(
    action: KeyAction<GenshinActionSettings>,
    text: string,
    isMax: boolean,
  ): void {
    const state = this.getKeyState(action.id);

    const renderFrame = async (): Promise<void> => {
      const svg = buildTeapotAlertSvg(
        BACKGROUND,
        isMax ? TUBBY_MAX : TUBBY_NORMAL,
        state.frameIndex,
        text,
        isMax,
      );
      const base64 = svgToBase64(svg);
      await action.setImage(base64);
      state.frameIndex = state.frameIndex + 1;
    };

    // Show the first frame immediately
    void renderFrame();

    if (dataController.isAnimationDisabled()) return;

    state.interval = setInterval(() => {
      void renderFrame();
    }, 200);
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
    super.onWillDisappear(ev);
    this.clearAnimation(ev.action.id);
    this.keyStates.delete(ev.action.id);
  }
}
