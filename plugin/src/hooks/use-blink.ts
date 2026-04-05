import { useState, useEffect } from "react";

/**
 * Centralized blink coordinator.
 *
 * A single global timer drives all blink animations across every visible
 * action root. Each subscriber is assigned a **staggered offset** so
 * different actions don't blink at the same time.
 *
 * Offset assignment uses a "largest-gap" strategy on a circular timeline:
 * the first subscriber gets a random offset, and every subsequent one is
 * placed at the midpoint of the biggest unused gap. This guarantees
 * maximum visual spread between concurrent blinkers.
 *
 * Performance: components only re-render **twice per cycle** (blink-on
 * and blink-off), compared to 30 re-renders per cycle with the old
 * frame-index approach.
 */

// ─── Blink cycle constants ───────────────────────────────────────

const FRAME_INTERVAL_MS = 100;
const CYCLE_LENGTH = 30;
const BLINK_START = 12;
const BLINK_END = 15;

// ─── Coordinator state (module-level singleton) ──────────────────

let globalFrame = 0;
let timer: ReturnType<typeof setInterval> | null = null;

interface Subscriber {
  offset: number;
  notify: (blinking: boolean) => void;
}

const subscribers = new Map<symbol, Subscriber>();

/** Check whether the given frame (with offset applied) falls in the blink window. */
function isBlink(frame: number, offset: number): boolean {
  const f = (frame + offset) % CYCLE_LENGTH;
  return f >= BLINK_START && f <= BLINK_END;
}

/**
 * Find the offset that maximises distance from all existing subscribers.
 *
 * First subscriber gets a random offset so each session looks different.
 * Subsequent subscribers are placed at the midpoint of the largest gap
 * on the circular timeline (0 … CYCLE_LENGTH-1).
 */
function findBestOffset(): number {
  if (subscribers.size === 0) {
    return Math.floor(Math.random() * CYCLE_LENGTH);
  }

  const offsets = [...subscribers.values()].map((s) => s.offset).sort((a, b) => a - b);

  let bestGap = 0;
  let bestMid = 0;

  for (let i = 0; i < offsets.length; i++) {
    const current = offsets[i]!;
    const next = i + 1 < offsets.length ? offsets[i + 1]! : offsets[0]! + CYCLE_LENGTH;
    const gap = next - current;

    if (gap > bestGap) {
      bestGap = gap;
      bestMid = current + Math.floor(gap / 2);
    }
  }

  return bestMid % CYCLE_LENGTH;
}

function tick() {
  globalFrame = (globalFrame + 1) % CYCLE_LENGTH;

  for (const sub of subscribers.values()) {
    sub.notify(isBlink(globalFrame, sub.offset));
  }
}

function register(notify: (blinking: boolean) => void): symbol {
  const id = Symbol();
  const offset = findBestOffset();

  subscribers.set(id, { offset, notify });

  if (timer === null) {
    timer = setInterval(tick, FRAME_INTERVAL_MS);
  }

  // Notify immediately with the current state
  notify(isBlink(globalFrame, offset));

  return id;
}

function unregister(id: symbol) {
  subscribers.delete(id);

  if (subscribers.size === 0 && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

// ─── Hook ────────────────────────────────────────────────────────

/**
 * Subscribe to the global blink coordinator.
 *
 * Returns `true` during blink frames, with timing staggered across all
 * active subscribers so visible actions don't blink simultaneously.
 *
 * When `enabled` is `false` the subscriber is unregistered and the hook
 * returns `false` (no re-renders from the coordinator).
 *
 * @param enabled Whether this subscriber should participate in blinking
 */
export function useBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setBlinking(false);
      return;
    }

    const id = register(setBlinking);
    return () => unregister(id);
  }, [enabled]);

  return blinking;
}
