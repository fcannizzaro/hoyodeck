import {
  action,
  type KeyAction,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "@/types/settings";
import type { DataType, SuccessDataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services";
import { fetchImageAsDataUri, readLocalImageAsDataUri } from "@/utils/image";
import { buildExpeditionSvg, type ExpeditionCircle } from "@/utils/expedition";
import { svgToBase64 } from "@/utils/svg";

/** Background image loaded once at module init */
const BACKGROUND = readLocalImageAsDataUri(
  "imgs/actions/gi/expeditions-state.png",
);

/** Countdown re-render interval in milliseconds (30 seconds) */
const COUNTDOWN_INTERVAL_MS = 30_000;

/** Per-key mutable state for the expedition countdown */
interface ExpeditionKeyState {
  interval: ReturnType<typeof setInterval> | null;
  lastRefreshTime: number;
  expeditionData: ExpeditionCircle[];
  totalExpeditions: number;
}

/**
 * Expedition Action
 * Displays character avatar circles with progress pie overlays
 * that auto-update remaining time between data refreshes.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.expedition" })
export class ExpeditionAction extends BaseAction<GenshinActionSettings, 'gi:daily-note'> {
  protected readonly game = 'gi' as const;

  /** Per-key state (SingletonAction shares one instance across all keys) */
  private readonly keyStates = new Map<string, ExpeditionKeyState>();

  /** Get or create per-key state */
  private getKeyState(actionId: string): ExpeditionKeyState {
    let state = this.keyStates.get(actionId);
    if (!state) {
      state = { interval: null, lastRefreshTime: 0, expeditionData: [], totalExpeditions: 0 };
      this.keyStates.set(actionId, state);
    }
    return state;
  }

  /** Clear the running countdown interval for a specific key */
  private clearAnimation(actionId: string): void {
    const state = this.keyStates.get(actionId);
    if (!state) return;
    if (state.interval !== null) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  /**
   * Start the countdown loop that decrements remaining times locally
   * and re-renders the SVG every 30 seconds.
   */
  private startCountdown(action: KeyAction<GenshinActionSettings>): void {
    const state = this.getKeyState(action.id);

    const renderFrame = async (): Promise<void> => {
      const elapsedSinceRefresh = (Date.now() - state.lastRefreshTime) / 1000;

      const circles = state.expeditionData.slice(0, 5).map((exp) => {
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
        state.totalExpeditions,
      );
      const base64 = svgToBase64(svg);
      await action.setImage(base64);
    };

    // Render the first frame immediately
    void renderFrame();

    if (dataController.isAnimationDisabled()) return;

    state.interval = setInterval(() => {
      void renderFrame();
    }, COUNTDOWN_INTERVAL_MS);
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
    const state = this.getKeyState(action.id);

    // Fetch all avatar images in parallel
    const avatarDataUris = await Promise.all(
      dailyNote.expeditions.map((exp) =>
        fetchImageAsDataUri(exp.avatar_side_icon),
      ),
    );

    state.lastRefreshTime = Date.now();
    state.totalExpeditions = dailyNote.current_expedition_num;
    state.expeditionData = dailyNote.expeditions.map((exp, i) => ({
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
    this.clearAnimation(ev.action.id);
    this.keyStates.delete(ev.action.id);
  }
}
