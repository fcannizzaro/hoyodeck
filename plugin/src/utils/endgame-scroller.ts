/**
 * Manages per-action marquee scroll animations for endgame mode names.
 *
 * Stream Deck renders images as static bitmaps, so scrolling is achieved
 * by periodically re-rendering the SVG with a shifting text offset.
 *
 * The text is rendered twice (with a gap) and the offset wraps around
 * for a seamless infinite loop.
 */

const TICK_MS = 200;
const STEP_PX = 2;

export class EndgameScroller {
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Start (or restart) a scroll animation for the given action.
   *
   * If `cycleWidth <= 0` the text fits — calls `render(0)` once, no timer.
   * Otherwise starts a continuous infinite scroll.
   *
   * @param actionId    Unique Stream Deck action id
   * @param cycleWidth  Full loop distance in px (textWidth + gap); 0 = no scroll
   * @param render      Callback that rebuilds the SVG at the given scroll offset
   */
  start(
    actionId: string,
    cycleWidth: number,
    render: (offset: number) => Promise<void>,
  ): void {
    this.stop(actionId);

    // Static — text fits, no animation needed
    if (cycleWidth <= 0) {
      void render(0);
      return;
    }

    void render(0);

    let offset = 0;

    const timer = setInterval(() => {
      offset = (offset + STEP_PX) % cycleWidth;
      void render(offset);
    }, TICK_MS);

    this.timers.set(actionId, timer);
  }

  /** Stop the scroll animation for a single action. */
  stop(actionId: string): void {
    const timer = this.timers.get(actionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(actionId);
    }
  }
}

/** Singleton shared by all endgame actions. */
export const endgameScroller = new EndgameScroller();
