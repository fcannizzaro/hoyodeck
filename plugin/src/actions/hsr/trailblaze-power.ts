import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { StarRailActionSettings } from "../../types/settings";
import type { DataType, SuccessDataUpdate } from "../../services/data-controller.types";
import { dataController } from "../../services";
import { GAMES } from "../../types/games";
import { readLocalImageAsDataUri } from "../../utils/image";
import { buildResinSvg, RESIN_FLOATS } from "../../utils/resin";
import { svgToBase64 } from "../../utils/svg";

const BASE_IMG = "imgs/actions/hsr/trailblaze-power-state@2x.png";
const STAMINA_IMG = "imgs/actions/hsr/trailblaze-power.webp";

/** Per-key mutable animation state */
interface StaminaKeyState {
  interval: ReturnType<typeof setInterval> | null;
  frameIndex: number;
}

/**
 * Trailblaze Power Action
 * Displays current Trailblaze Power as a floating fill gauge and refreshes on tap
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.hsr.trailblaze-power" })
export class StaminaAction extends BaseAction<StarRailActionSettings, 'hsr:daily-note'> {
  protected readonly game = 'hsr' as const;
  private readonly MAX_STAMINA = GAMES.hsr.staminaMax;

  /** Per-key animation state (SingletonAction shares one instance across all keys) */
  private readonly keyStates = new Map<string, StaminaKeyState>();

  /** Get or create per-key state */
  private getKeyState(actionId: string): StaminaKeyState {
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
   * Start the floating stamina animation.
   * @param action Stream Deck key action
   * @param current Current Trailblaze Power count
   */
  private startAnimation(
    action: KeyAction<StarRailActionSettings>,
    current: number,
  ): void {
    const state = this.getKeyState(action.id);
    const baseDataUri = readLocalImageAsDataUri(BASE_IMG);
    const staminaDataUri = readLocalImageAsDataUri(STAMINA_IMG);

    const renderFrame = async (): Promise<void> => {
      const svg = buildResinSvg(
        baseDataUri,
        staminaDataUri,
        state.frameIndex,
        current,
        this.MAX_STAMINA,
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
    return ['hsr:daily-note'];
  }

  protected override onStop(action: KeyAction<StarRailActionSettings>): void {
    this.clearAnimation(action.id);
  }

  protected override onBeforeDataUpdate(action: KeyAction<StarRailActionSettings>): void {
    this.clearAnimation(action.id);
  }

  protected override async onDataUpdate(
    action: KeyAction<StarRailActionSettings>,
    update: SuccessDataUpdate<'hsr:daily-note'>,
  ): Promise<void> {
    const dailyNote = update.entry.data;

    await action.setTitle("");
    this.startAnimation(action, dailyNote.current_stamina);
  }

  /**
   * Clean up the animation interval when the action disappears from the deck
   */
  override onWillDisappear(
    ev: WillDisappearEvent<StarRailActionSettings>,
  ): void {
    super.onWillDisappear(ev);
    this.clearAnimation(ev.action.id);
    this.keyStates.delete(ev.action.id);
  }
}
