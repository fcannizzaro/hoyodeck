import streamDeck from "@elgato/streamdeck";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { formatEndgameData } from "../src/utils/format-endgame-data";

vi.mock("@elgato/streamdeck", () => ({ default: { logger: { error: vi.fn() } } }));
afterEach(() => vi.clearAllMocks());

test("logs the failing mode without including the payload or exception message", () => {
  const error = new TypeError("private account details");
  expect(() =>
    formatEndgameData("hsr", "anomaly-arbitration", { uid: "100123456" }, () => {
      throw error;
    }),
  ).toThrow(error);
  expect(streamDeck.logger.error).toHaveBeenCalledExactlyOnceWith(
    '[EndgameKey] Failed to format hsr:anomaly-arbitration {"errorType":"TypeError"}',
  );
});

test("passes through successful formatting without logging errors", () => {
  const display = { progressText: "36*", timerText: "5d" };
  expect(formatEndgameData("hsr", "memory-of-chaos", {}, () => display)).toBe(display);
  expect(streamDeck.logger.error).not.toHaveBeenCalled();
});
