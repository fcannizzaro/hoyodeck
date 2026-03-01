import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { ZZZActionSettings } from "../../types/settings";
import type { DataType, SuccessDataUpdate } from "../../services/data-controller.types";
import { dataController } from "../../services";
import { GAMES } from "../../types/games";
import { readLocalImageAsDataUri } from "../../utils/image";
import { buildResinSvg, RESIN_FLOATS } from "../../utils/resin";
import { svgToBase64 } from "../../utils/svg";

const BASE_IMG = "imgs/actions/zzz/battery-recharge-state@2x.png";
const BATTERY_IMG = "imgs/actions/zzz/battery-recharge.png";

/** Per-key mutable animation state */
interface BatteryKeyState {
  interval: ReturnType<typeof setInterval> | null;
  frameIndex: number;
}

/**
 * Battery Charge Action
 * Displays current Battery Charge as a floating fill gauge and refreshes on tap
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.zzz.battery-charge" })
export class BatteryChargeAction extends BaseAction<ZZZActionSettings, 'zzz:daily-note'> {
  protected readonly game = 'zzz' as const;
  private readonly MAX_BATTERY = GAMES.zzz.staminaMax;

  /** Per-key animation state (SingletonAction shares one instance across all keys) */
  private readonly keyStates = new Map<string, BatteryKeyState>();

  /** Get or create per-key state */
  private getKeyState(actionId: string): BatteryKeyState {
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
   * Start the floating battery animation.
   * @param action Stream Deck key action
   * @param current Current Battery Charge count
   */
  private startAnimation(
    action: KeyAction<ZZZActionSettings>,
    current: number,
  ): void {
    const state = this.getKeyState(action.id);
    const baseDataUri = readLocalImageAsDataUri(BASE_IMG);
    const batteryDataUri = readLocalImageAsDataUri(BATTERY_IMG);

    const renderFrame = async (): Promise<void> => {
      const svg = buildResinSvg(
        baseDataUri,
        batteryDataUri,
        state.frameIndex,
        current,
        this.MAX_BATTERY,
        0.75,
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
    return ['zzz:daily-note'];
  }

  protected override onStop(action: KeyAction<ZZZActionSettings>): void {
    this.clearAnimation(action.id);
  }

  protected override onBeforeDataUpdate(action: KeyAction<ZZZActionSettings>): void {
    this.clearAnimation(action.id);
  }

  protected override async onDataUpdate(
    action: KeyAction<ZZZActionSettings>,
    update: SuccessDataUpdate<'zzz:daily-note'>,
  ): Promise<void> {
    const dailyNote = update.entry.data;

    await action.setTitle("");
    this.startAnimation(action, dailyNote.energy.progress.current);
  }

  /**
   * Clean up the animation interval when the action disappears from the deck
   */
  override onWillDisappear(
    ev: WillDisappearEvent<ZZZActionSettings>,
  ): void {
    super.onWillDisappear(ev);
    this.clearAnimation(ev.action.id);
    this.keyStates.delete(ev.action.id);
  }
}
