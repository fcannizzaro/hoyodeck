import type { KeyAction, WillDisappearEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { BaseAction } from "./base-action";
import type { DataType, SuccessDataUpdate } from "@/services/data-controller.types";
import { buildEndgameSvg, getNameCycleWidth } from "@/utils/endgame";
import { endgameScroller } from "@/utils/endgame-scroller";
import { readLocalImageAsDataUri } from "@/utils/image";
import { svgToBase64 } from "@/utils/svg";

// ─── Shared Types ─────────────────────────────────────────────────

/**
 * Config for a single endgame mode.
 */
export interface EndgameModeConfig {
  dataType: DataType;
  /** Relative image path for the background */
  bg: string;
  /** Full display name (e.g. "Spiral Abyss") */
  name: string;
}

/**
 * Normalized display data returned by subclass formatters.
 */
export interface EndgameDisplay {
  progressText: string;
  timerText: string;
}

/**
 * Settings constraint — all endgame settings share these fields.
 */
interface EndgameSettingsBase extends JsonObject {
  mode?: string;
  showStars?: boolean;
  showName?: boolean;
}

// ─── Base Endgame Action ──────────────────────────────────────────

/**
 * Abstract base class for all endgame actions.
 *
 * Encapsulates:
 * - Mode resolution from settings
 * - SVG rendering pipeline with marquee scroller
 * - Cleanup on disappear
 *
 * Subclasses provide game-specific mode config via `modes` / `defaultMode`
 * and data extraction via `formatModeData()`.
 *
 * @typeParam TSettings  Per-action settings (must include optional `mode` and `showStars`)
 * @typeParam TDataType  DataController data type key union
 */
export abstract class BaseEndgameAction<
  TSettings extends EndgameSettingsBase,
  TDataType extends DataType,
> extends BaseAction<TSettings, TDataType> {

  /** Mode slug → config. Defines all modes for this game. */
  protected abstract readonly modes: Record<string, EndgameModeConfig>;

  /** Default mode slug when settings.mode is unset. */
  protected abstract readonly defaultMode: string;

  /**
   * Extract display data from the raw API response for the given mode.
   * Called by the base `onDataUpdate` pipeline.
   */
  protected abstract formatModeData(mode: string, data: unknown): EndgameDisplay;

  // ─── DataController hooks ──────────────────────────────────────

  protected getSubscribedDataTypes(settings: TSettings): DataType[] {
    const mode = settings.mode ?? this.defaultMode;
    const config = this.modes[mode] ?? this.modes[this.defaultMode]!;
    return [config.dataType];
  }

  protected override async onDataUpdate(
    action: KeyAction<TSettings>,
    update: SuccessDataUpdate<TDataType>,
  ): Promise<void> {
    const settings = this.getCachedSettings(action.id);
    if (!settings) return;

    const mode = settings.mode ?? this.defaultMode;
    const config = this.modes[mode] ?? this.modes[this.defaultMode]!;

    const { progressText, timerText } = this.formatModeData(mode, update.entry.data);

    const bgDataUri = readLocalImageAsDataUri(config.bg);
    const showStars = settings.showStars ?? true;
    const showName = settings.showName ?? true;
    const modeName = config.name;

    if (showName) {
      const cycleWidth = getNameCycleWidth(modeName);
      await action.setTitle('');
      endgameScroller.start(action.id, cycleWidth, async (offset) => {
        const svg = buildEndgameSvg(bgDataUri, progressText, timerText, modeName, showStars, true, offset);
        await action.setImage(svgToBase64(svg));
      });
    } else {
      endgameScroller.stop(action.id);
      const svg = buildEndgameSvg(bgDataUri, progressText, timerText, modeName, showStars, false);
      await action.setTitle('');
      await action.setImage(svgToBase64(svg));
    }
  }

  override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
    endgameScroller.stop(ev.action.id);
    super.onWillDisappear(ev);
  }
}
