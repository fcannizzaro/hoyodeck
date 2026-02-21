import type { KeyAction, KeyDownEvent, WillDisappearEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { BaseAction } from "./base-action";
import type { BannerBadgeOptions, GameActionSettings } from "@/types/settings";
import type { DataType, DataUpdate } from "@/services/data-controller.types";
import { dataController } from "@/services/data-controller";
import { buildBannerSvg, formatCountdownFromSeconds } from "@/utils/banner";
import { fetchImageAsDataUri, localImageExists, readLocalImageAsDataUri } from "@/utils/image";

// ─── Shared Types ─────────────────────────────────────────────────

/**
 * Normalized banner item produced by subclass extractors.
 * Character items include `name` for the blink animation lookup;
 * weapon items omit it.
 */
export interface BannerItem {
  icon: string;
  name?: string;
  countdownSeconds: number;
}

/**
 * Settings constraint — every banner settings type has an optional `type` field.
 */
interface BannerSettingsBase extends GameActionSettings {
  type?: string;
}

/**
 * Per-key mutable state.
 * Each physical Stream Deck key gets its own entry so that
 * animations and cycling are independent across keys.
 */
interface BannerKeyState {
  bannerIndex: number;
  currentAccountId: string | null;
  blinkTimeout: ReturnType<typeof setTimeout> | null;
  /**
   * Monotonically increasing counter, bumped on every clearBlinkAnimation().
   * Blink closures capture the current generation and self-cancel when it
   * no longer matches, preventing orphaned timers from showing stale frames.
   */
  blinkGeneration: number;
}

// ─── Base Banner Action ───────────────────────────────────────────

/**
 * Abstract base class for all banner actions.
 *
 * Encapsulates:
 * - Banner index cycling (character banners only)
 * - Cache-based re-render on key press
 * - Badge option resolution from global settings
 * - SVG rendering pipeline with blink eye animation
 * - Cleanup on disappear
 *
 * Because `SingletonAction` uses one class instance for all physical keys,
 * mutable state is stored in a per-key map keyed by `action.id`.
 *
 * Subclasses provide game-specific item extraction via
 * `getCharacterItems()` and `getWeaponItems()`.
 *
 * @typeParam TSettings  Per-action settings (must include optional `type`)
 * @typeParam TDataType  DataController data type key
 * @typeParam TCalendar  Calendar payload type pushed by DataController
 */
export abstract class BaseBannerAction<
  TSettings extends BannerSettingsBase & JsonObject,
  TDataType extends DataType,
  TCalendar,
> extends BaseAction<TSettings, TDataType> {

  /** Per-key state (animation timers, banner index, account) */
  private readonly keyStates = new Map<string, BannerKeyState>();

  /** Get or create per-key state */
  private getKeyState(actionId: string): BannerKeyState {
    let state = this.keyStates.get(actionId);
    if (!state) {
      state = { bannerIndex: 0, currentAccountId: null, blinkTimeout: null, blinkGeneration: 0 };
      this.keyStates.set(actionId, state);
    }
    return state;
  }

  // ─── Abstract extractors ────────────────────────────────────────

  /**
   * Extract normalized character banner items from the calendar data.
   * Should filter to active banners and 5-star (or equivalent) characters.
   */
  protected abstract getCharacterItems(calendar: TCalendar): BannerItem[];

  /**
   * Extract normalized weapon/equipment banner items from the calendar data.
   * Should filter to active banners and 5-star (or equivalent) weapons.
   */
  protected abstract getWeaponItems(calendar: TCalendar): BannerItem[];

  // ─── Blink animation ───────────────────────────────────────────

  /**
   * Invalidate any running blink animation for a specific key.
   * Bumps the generation counter so orphaned closures self-cancel,
   * and clears the tracked timeout if one exists.
   */
  private clearBlinkAnimation(state: BannerKeyState): void {
    state.blinkGeneration++;
    if (state.blinkTimeout !== null) {
      clearTimeout(state.blinkTimeout);
      state.blinkTimeout = null;
    }
  }

  /**
   * Start a natural eye-blink animation, alternating between open and closed frames.
   * Eyes stay open for a random 3–5s, then briefly close for 200ms.
   * Each cycle picks a fresh random delay so successive blinks feel organic.
   * The wide initial delay range (0.8–3s) ensures multiple keys desync quickly.
   *
   * Each closure captures the current `blinkGeneration` and checks it on every
   * tick — if a newer generation has been started the closure silently exits,
   * preventing orphaned timers from showing stale frames.
   *
   * @param state Per-key state to store the timeout handle
   * @param action Stream Deck key action
   * @param openBase64 Base64 data URI of the open-eyes SVG
   * @param closedBase64 Base64 data URI of the closed-eyes SVG
   */
  private startBlinkAnimation(
    state: BannerKeyState,
    action: KeyAction<TSettings>,
    openBase64: string,
    closedBase64: string,
  ): void {
    if (dataController.isAnimationDisabled()) return;

    const generation = state.blinkGeneration;

    /** Random integer in [min, max] */
    const randBetween = (min: number, max: number): number =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const showOpen = (): void => {
      if (state.blinkGeneration !== generation) return;
      void action.setImage(openBase64);
      // Random open duration: 3–5s for natural variation
      state.blinkTimeout = setTimeout(showClosed, randBetween(3000, 5000));
    };

    const showClosed = (): void => {
      if (state.blinkGeneration !== generation) return;
      void action.setImage(closedBase64);
      // Fixed blink duration: 200ms
      state.blinkTimeout = setTimeout(showOpen, 200);
    };

    // Open frame is already shown by the caller; schedule first blink with random delay
    state.blinkTimeout = setTimeout(showClosed, randBetween(3000, 5000));
  }

  // ─── Lifecycle hooks ────────────────────────────────────────────

  override async onKeyDown(
    ev: KeyDownEvent<TSettings>,
  ): Promise<void> {
    const settings = ev.payload.settings;
    const state = this.getKeyState(ev.action.id);

    // Clear any running blink animation before cycling
    this.clearBlinkAnimation(state);

    // Cycle through character banners on key press
    state.bannerIndex++;

    // Re-render from cached data — no network call needed for banner cycling
    if (state.currentAccountId) {
      const dataTypes = this.getSubscribedDataTypes(settings);
      const dataType = dataTypes[0] as TDataType;
      const entry = dataController.getData(state.currentAccountId, dataType);
      if (entry?.status === 'ok') {
        await this.withErrorHandling(ev.action, async () => {
          await this.renderCalendar(ev.action, settings, entry.data as TCalendar);
        });
        return;
      }
    }

    // Fallback: request fresh data
    const account = await this.resolveAccount(settings);
    if (!account) return;

    await this.withErrorHandling(ev.action, async () => {
      await dataController.requestUpdate(account.id, this.game);
    });
  }

  protected override async onDataUpdate(
    action: KeyAction<TSettings>,
    update: DataUpdate<TDataType>,
  ): Promise<void> {
    const state = this.getKeyState(action.id);
    this.clearBlinkAnimation(state);

    if (update.entry.status === 'error') {
      await this.showDataError(action, update.entry);
      return;
    }

    state.currentAccountId = update.accountId;
    const settings = await action.getSettings();
    await this.renderCalendar(action, settings, update.entry.data as TCalendar);
  }

  /**
   * Clean up the blink animation and per-key state when the action disappears
   */
  override onWillDisappear(
    ev: WillDisappearEvent<TSettings>,
  ): void {
    super.onWillDisappear(ev);
    const state = this.keyStates.get(ev.action.id);
    if (state) {
      this.clearBlinkAnimation(state);
      this.keyStates.delete(ev.action.id);
    }
  }

  // ─── Rendering ──────────────────────────────────────────────────

  private async renderCalendar(
    action: KeyAction<TSettings>,
    settings: TSettings,
    calendar: TCalendar,
  ): Promise<void> {
    const type = settings.type ?? "character";

    const globalSettings = await this.getGlobalSettings();
    const badge: BannerBadgeOptions = {
      position: globalSettings.bannerBadgePosition ?? "center",
      layout: globalSettings.bannerBadgeLayout ?? "horizontal",
      fontSize: globalSettings.bannerBadgeFontSize ?? 18,
    };

    if (type === "character") {
      const items = this.getCharacterItems(calendar);
      await this.displayBanner(action, items, badge, true);
    } else {
      const items = this.getWeaponItems(calendar);
      await this.displayBanner(action, items, badge, false);
    }
  }

  /**
   * Render a single banner item on the Stream Deck key.
   * Handles cycling, SVG generation, and blink animation for characters.
   */
  private async displayBanner(
    action: KeyAction<TSettings>,
    items: BannerItem[],
    badge: BannerBadgeOptions,
    isCharacter: boolean,
  ): Promise<void> {
    if (items.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const state = this.getKeyState(action.id);
    const index = state.bannerIndex % items.length;
    const item = items[index];
    if (!item) return;

    const countdown = formatCountdownFromSeconds(item.countdownSeconds);
    const dataUri = await fetchImageAsDataUri(item.icon);
    const openSvg = buildBannerSvg(dataUri, countdown, this.game, badge);
    const openBase64 = `data:image/svg+xml;base64,${btoa(openSvg)}`;
    await action.setTitle("");
    await action.setImage(openBase64);

    // Blink animation — only for character banners with a local closed-eyes image
    if (isCharacter && item.name) {
      const closedPath = `imgs/banner/${item.name.toLowerCase().replace(/[ ]+/, '-')}.png`;
      if (localImageExists(closedPath)) {
        const closedDataUri = readLocalImageAsDataUri(closedPath);
        const closedSvg = buildBannerSvg(closedDataUri, countdown, this.game, badge);
        const closedBase64 = `data:image/svg+xml;base64,${btoa(closedSvg)}`;
        this.startBlinkAnimation(state, action, openBase64, closedBase64);
      }
    }
  }
}
