import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "../../types/settings";
import { GAMES } from "../../types/games";
import { readLocalImageAsDataUri } from "../../utils/image";
import { buildResinSvg, RESIN_FLOATS } from "../../utils/resin";

const BASE_IMG = "imgs/actions/gi/3-star.webp";
const RESIN_IMG = "imgs/actions/gi/resin.webp";

/**
 * Resin Counter Action
 * Displays current Original Resin as a floating fill gauge and refreshes on tap
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.resin" })
export class ResinAction extends BaseAction<GenshinActionSettings> {
  private readonly MAX_RESIN = GAMES.genshin.staminaMax;

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
   * Start the floating resin animation.
   * @param action Stream Deck key action
   * @param current Current resin count
   */
  private startAnimation(
    action: KeyAction<GenshinActionSettings>,
    current: number,
  ): void {
    const baseDataUri = readLocalImageAsDataUri(BASE_IMG);
    const resinDataUri = readLocalImageAsDataUri(RESIN_IMG);

    const renderFrame = async (): Promise<void> => {
      const svg = buildResinSvg(
        baseDataUri,
        resinDataUri,
        this.frameIndex,
        current,
        this.MAX_RESIN,
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
    action: KeyAction<GenshinActionSettings>,
    settings: GenshinActionSettings,
  ): Promise<void> {
    this.clearAnimation();

    const client = await this.getClient();
    if (!client) {
      await this.showNoAuth(action);
      return;
    }

    const uid = await this.getUid(settings);
    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const dailyNote = await client.getGenshinDailyNote(uid);

    await action.setTitle("");
    this.startAnimation(action, dailyNote.current_resin);
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
