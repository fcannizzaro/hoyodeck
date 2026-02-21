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

const BASE_IMG = "imgs/actions/zzz/battery-recharge-state@2x.png";
const BATTERY_IMG = "imgs/actions/zzz/battery-recharge.png";

/**
 * Battery Charge Action
 * Displays current Battery Charge as a floating fill gauge and refreshes on tap
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.zzz.battery-charge" })
export class BatteryChargeAction extends BaseAction<ZZZActionSettings, 'zzz:daily-note'> {
  protected readonly game = 'zzz' as const;
  private readonly MAX_BATTERY = GAMES.zzz.staminaMax;

  /** Interval handle for the floating animation */
  private animationInterval: ReturnType<typeof setInterval> | null = null;

  /** Current frame index in the float cycle */
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
   * Start the floating battery animation.
   * @param action Stream Deck key action
   * @param current Current Battery Charge count
   */
  private startAnimation(
    action: KeyAction<ZZZActionSettings>,
    current: number,
  ): void {
    const baseDataUri = readLocalImageAsDataUri(BASE_IMG);
    const batteryDataUri = readLocalImageAsDataUri(BATTERY_IMG);

    const renderFrame = async (): Promise<void> => {
      const svg = buildResinSvg(
        baseDataUri,
        batteryDataUri,
        this.frameIndex,
        current,
        this.MAX_BATTERY,
        0.75,
      );
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setImage(base64);
      this.frameIndex = (this.frameIndex + 1) % RESIN_FLOATS.length;
    };

    // Show the first frame immediately
    void renderFrame();

    if (dataController.isAnimationDisabled()) return;

    this.animationInterval = setInterval(() => {
      void renderFrame();
    }, 200);
  }

  protected getSubscribedDataTypes(): DataType[] {
    return ['zzz:daily-note'];
  }

  protected override onBeforeDataUpdate(): void {
    this.clearAnimation();
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
    this.clearAnimation();
  }
}
