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

const BASE_IMG = "imgs/actions/hsr/trailblaze-power-state@2x.png";
const STAMINA_IMG = "imgs/actions/hsr/trailblaze-power.webp";

/**
 * Trailblaze Power Action
 * Displays current Trailblaze Power as a floating fill gauge and refreshes on tap
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.hsr.trailblaze-power" })
export class StaminaAction extends BaseAction<StarRailActionSettings, 'hsr:daily-note'> {
  protected readonly game = 'hsr' as const;
  private readonly MAX_STAMINA = GAMES.hsr.staminaMax;

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
   * Start the floating stamina animation.
   * @param action Stream Deck key action
   * @param current Current Trailblaze Power count
   */
  private startAnimation(
    action: KeyAction<StarRailActionSettings>,
    current: number,
  ): void {
    const baseDataUri = readLocalImageAsDataUri(BASE_IMG);
    const staminaDataUri = readLocalImageAsDataUri(STAMINA_IMG);

    const renderFrame = async (): Promise<void> => {
      const svg = buildResinSvg(
        baseDataUri,
        staminaDataUri,
        this.frameIndex,
        current,
        this.MAX_STAMINA,
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
    return ['hsr:daily-note'];
  }

  protected override onBeforeDataUpdate(): void {
    this.clearAnimation();
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
    this.clearAnimation();
  }
}
