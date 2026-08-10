/**
 * Compile-time debug logger.
 *
 * All calls are stripped from production builds when __DEBUG__ is false.
 * Enable with: DEBUG=1 pnpm build
 *
 * Usage:
 *   import { debug } from '@/utils/debug';
 *   debug.log('[DataController]', 'register', actionId, dataTypes);
 */

function noop(..._args: unknown[]): void {}

function makeLogger() {
  if (!__DEBUG__) {
    return { log: noop, warn: noop, error: noop, group: noop, groupEnd: noop };
  }

  const tag =
    (level: string) =>
    (...args: unknown[]) =>
      console.log(`[DEBUG:${level}]`, ...args);

  return {
    log: tag("LOG"),
    warn: tag("WARN"),
    error: tag("ERROR"),
    group: (...args: unknown[]) => console.group("[DEBUG]", ...args),
    groupEnd: () => console.groupEnd(),
  };
}

export const debug = makeLogger();
