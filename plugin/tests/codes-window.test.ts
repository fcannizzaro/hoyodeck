import { beforeEach, expect, test, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ html: vi.fn(), message: vi.fn(), openUrl: vi.fn() }));
vi.mock("@elgato/streamdeck", () => ({
  default: { system: { openUrl: mocks.openUrl }, logger: { error: vi.fn() } },
}));
vi.mock("@nativewindow/webview", () => ({
  ensureRuntime() {},
  loadHtmlOrigin: () => "nativewindow://localhost",
  NativeWindow: class {
    loadHtml = mocks.html;
    onMessage = mocks.message;
  },
}));
import { showCodesWindow } from "../src/services/codes-window";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.openUrl.mockResolvedValue(undefined);
});

test.each([
  ["gi", "https://genshin.hoyoverse.com/en/gift"],
  ["hsr", "https://hsr.hoyoverse.com/gift"],
  ["zzz", "https://zenless.hoyoverse.com/redemption"],
] as const)(
  "lists every %s code and only opens a browser after a manual click",
  async (game, page) => {
    await showCodesWindow(game, ["FIRST", "SECOND"]);
    const html = mocks.html.mock.calls[0]![0];
    expect(html).toContain("FIRST");
    expect(html).toContain("SECOND");
    expect(mocks.openUrl).not.toHaveBeenCalled();
    const onMessage = mocks.message.mock.calls[0]![0];
    onMessage(`${page}?code=SECOND`, "nativewindow://localhost/index.html");
    expect(mocks.openUrl).toHaveBeenCalledExactlyOnceWith(`${page}?code=SECOND`);
    onMessage("https://example.com", "nativewindow://localhost");
    onMessage(`${page}?code=FIRST`, "https://example.com");
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
  },
);

test("shows an empty state and escapes server-provided codes", async () => {
  await showCodesWindow("gi", []);
  expect(mocks.html.mock.calls[0]![0]).toContain("No codes are available right now");
  await showCodesWindow("gi", ['<script>"&']);
  const html = mocks.html.mock.calls[1]![0];
  expect(html).toContain("&#60;script&#62;&#34;&#38;");
  expect(html).not.toContain('<script>"&');
});
