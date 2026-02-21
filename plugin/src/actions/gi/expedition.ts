import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "@/types/settings";
import type { DataType, DataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services";
import { fetchImageAsDataUri, readLocalImageAsDataUri } from "@/utils/image";
import { buildExpeditionSvg, type ExpeditionCircle } from "@/utils/expedition";

/** Background image loaded once at module init */
const BACKGROUND = readLocalImageAsDataUri(
  "imgs/actions/gi/expeditions-state.png",
);

/** Countdown re-render interval in milliseconds (30 seconds) */
const COUNTDOWN_INTERVAL_MS = 30_000;

/**
 * Expedition Action
 * Displays character avatar circles with progress pie overlays
 * that auto-update remaining time between data refreshes.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.expedition" })
export class ExpeditionAction extends BaseAction<GenshinActionSettings, 'gi:daily-note'> {
  protected readonly game = 'gi' as const;

  /** Interval handle for the countdown re-render loop */
  private animationInterval: ReturnType<typeof setInterval> | null = null;

  /** Timestamp of the last data fetch */
  private lastRefreshTime = 0;

  /** Expedition snapshot from the last data fetch */
  private expeditionData: ExpeditionCircle[] = [];

  /** Total expedition slot count */
  private totalExpeditions = 0;

  /** Clear the running countdown interval, if any */
  private clearAnimation(): void {
    if (this.animationInterval !== null) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  /**
   * Start the countdown loop that decrements remaining times locally
   * and re-renders the SVG every 30 seconds.
   */
  private startCountdown(action: KeyAction<GenshinActionSettings>): void {
    const renderFrame = async (): Promise<void> => {
      const elapsedSinceRefresh = (Date.now() - this.lastRefreshTime) / 1000;

      const circles = this.expeditionData.slice(0, 5).map((exp) => {
        const remaining = Math.max(
          0,
          exp.remainingSeconds - elapsedSinceRefresh,
        );
        return {
          ...exp,
          remainingSeconds: remaining,
          finished: exp.finished || remaining <= 0,
        };
      });

      const svg = buildExpeditionSvg(
        BACKGROUND,
        circles,
        this.totalExpeditions,
      );
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setImage(base64);
    };

    // Render the first frame immediately
    void renderFrame();

    if (dataController.isAnimationDisabled()) return;

    this.animationInterval = setInterval(() => {
      void renderFrame();
    }, COUNTDOWN_INTERVAL_MS);
  }

  protected getSubscribedDataTypes(): DataType[] {
    return ['gi:daily-note'];
  }

  protected override async onDataUpdate(
    action: KeyAction<GenshinActionSettings>,
    update: DataUpdate<'gi:daily-note'>,
  ): Promise<void> {
    this.clearAnimation();

    if (update.entry.status === 'error') {
      await this.showDataError(action, update.entry);
      return;
    }

    const dailyNote = update.entry.data;

    // Fetch all avatar images in parallel
    const avatarDataUris = await Promise.all(
      dailyNote.expeditions.map((exp) =>
        fetchImageAsDataUri(exp.avatar_side_icon),
      ),
    );

    this.lastRefreshTime = Date.now();
    this.totalExpeditions = dailyNote.current_expedition_num;
    this.expeditionData = dailyNote.expeditions.map((exp, i) => ({
      avatarDataUri: avatarDataUris[i]!,
      finished: exp.status === "Finished",
      remainingSeconds: parseInt(exp.remained_time, 10) || 0,
    }));

    await action.setTitle("");
    this.startCountdown(action);
  }

  /** Clean up the countdown interval when the action disappears */
  override onWillDisappear(
    ev: WillDisappearEvent<GenshinActionSettings>,
  ): void {
    super.onWillDisappear(ev);
    this.clearAnimation();
  }
}
