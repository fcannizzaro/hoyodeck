import streamDeck from "@elgato/streamdeck";
import type { GameId } from "@hoyodeck/shared/types";
import type { EndgameKeyProps } from "@/components/endgame-key";

/** Add safe diagnostic context before passing formatting failures to the renderer. */
export function formatEndgameData(
  game: GameId,
  mode: string,
  data: unknown,
  formatData: EndgameKeyProps["formatData"],
) {
  try {
    return formatData(mode, data);
  } catch (error) {
    streamDeck.logger.error(
      `[EndgameKey] Failed to format ${game}:${mode} ${JSON.stringify({
        errorType: error instanceof Error ? error.name : typeof error,
      })}`,
    );
    throw error;
  }
}
