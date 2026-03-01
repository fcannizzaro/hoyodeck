import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "@/types/settings";
import type { DataType, SuccessDataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services";
import { GAMES } from "@/types/games";
import { readLocalImageAsDataUri } from "@/utils/image";
import { buildResinSvg, RESIN_FLOATS } from "@/utils/resin";
import { svgToBase64 } from "@/utils/svg";

const BASE_IMG = "imgs/actions/gi/3-star.webp";
const RESIN_IMG = "imgs/actions/gi/resin.webp";

/** Per-key mutable animation state */
interface ResinKeyState {
  interval: ReturnType<typeof setInterval> | null;
  frameIndex: number;
}

/**
 * Resin Counter Action
 * Displays current Original Resin as a floating fill gauge and refreshes on tap
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.resin" })
export class ResinAction extends BaseAction<GenshinActionSettings, 'gi:daily-note'> {
  protected readonly game = 'gi' as const;
  private readonly MAX_RESIN = GAMES.gi.staminaMax;

  /** Per-key animation state (SingletonAction shares one instance across all keys) */
  private readonly keyStates = new Map<string, ResinKeyState>();

  /** Get or create per-key state */
  private getKeyState(actionId: string): ResinKeyState {
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
   * Start the floating resin animation.
   * @param action Stream Deck key action
   * @param current Current resin count
   */
  private startAnimation(
    action: KeyAction<GenshinActionSettings>,
    current: number,
  ): void {
    const state = this.getKeyState(action.id);
    const baseDataUri = readLocalImageAsDataUri(BASE_IMG);
    const resinDataUri = readLocalImageAsDataUri(RESIN_IMG);

    const renderFrame = async (): Promise<void> => {
      const svg = buildResinSvg(
        baseDataUri,
        resinDataUri,
        state.frameIndex,
        current,
        this.MAX_RESIN,
      );
      const base64 = svgToBase64(svg);
      await action.setImage(base64);
      state.frameIndex = (state.frameIndex + 1) % RESIN_FLOATS.length;
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

  protected override onStop(action: KeyAction<GenshinActionSettings>): void {
    this.clearAnimation(action.id);
  }

  protected override onBeforeDataUpdate(action: KeyAction<GenshinActionSettings>): void {
    this.clearAnimation(action.id);
  }

  protected override async onDataUpdate(
    action: KeyAction<GenshinActionSettings>,
    update: SuccessDataUpdate<'gi:daily-note'>,
  ): Promise<void> {
    const dailyNote = update.entry.data;

    await action.setTitle("");
    this.startAnimation(action, dailyNote.current_resin);
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
