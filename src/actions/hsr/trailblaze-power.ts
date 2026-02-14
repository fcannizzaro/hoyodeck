import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { StarRailActionSettings } from "../../types/settings";
import { GAMES } from "../../types/games";
import { readLocalImageAsDataUri } from "../../utils/image";
import { buildResinSvg, RESIN_FLOATS } from "../../utils/resin";

const BASE_IMG = "imgs/actions/hsr/trailblaze-power-state@2x.png";
const STAMINA_IMG = "imgs/actions/hsr/trailblaze-power.webp";

/**
 * Trailblaze Power Action
 * Displays current Trailblaze Power as a floating fill gauge and refreshes on tap
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.starrail.trailblaze-power" })
export class StaminaAction extends BaseAction<StarRailActionSettings> {
  private readonly MAX_STAMINA = GAMES.starrail.staminaMax;

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

    this.animationInterval = setInterval(() => {
      void renderFrame();
    }, 200);
  }

  protected override async refresh(
    action: KeyAction<StarRailActionSettings>,
    settings: StarRailActionSettings,
  ): Promise<void> {
    this.clearAnimation();

    const ctx = await this.getAccountContext(settings);
    if (!ctx) {
      await this.showNoAccount(action);
      return;
    }

    const uid = this.getGameUid(ctx.account, "starrail");
    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const dailyNote = await ctx.client.getStarRailDailyNote(uid);

    await action.setTitle("");
    this.startAnimation(action, dailyNote.current_stamina);
  }

  /**
   * Clean up the animation interval when the action disappears from the deck
   */
  override onWillDisappear(
    ev: WillDisappearEvent<StarRailActionSettings>,
  ): void {
    this.clearAnimation();
  }
}
