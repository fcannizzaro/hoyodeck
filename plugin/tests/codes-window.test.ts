import { beforeEach, expect, test, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  settings: {} as { redeemedCodes?: Record<string, string[]> },
  writeSettings: vi.fn(),
  html: vi.fn(),
  message: vi.fn(),
  openUrl: vi.fn(),
  evaluateJs: vi.fn(),
  hide: vi.fn(),
  close: vi.fn(),
  onClose: vi.fn(),
}));
vi.mock("../src/services/data-controller", () => ({
  dataController: {
    getCachedGlobalSettings: () => mocks.settings,
    writeGlobalSettings: mocks.writeSettings,
  },
}));
vi.mock("@elgato/streamdeck", () => ({
  default: { system: { openUrl: mocks.openUrl }, logger: { error: vi.fn() } },
}));
vi.mock("@nativewindow/webview", () => ({
  ensureRuntime() {},
  loadHtmlOrigin: () => "nativewindow://localhost",
  NativeWindow: class {
    loadHtml = mocks.html;
    onMessage = mocks.message;
    evaluateJs = mocks.evaluateJs;
    hide = mocks.hide;
    close = mocks.close;
    onClose = mocks.onClose;
  },
}));
import { showCodesWindow } from "../src/services/codes-window";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.settings = {};
  mocks.writeSettings.mockImplementation(async (settings) => {
    mocks.settings = settings;
  });
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

test("marks only the clicked code after the browser opens", async () => {
  let opened!: () => void;
  mocks.openUrl.mockReturnValue(
    new Promise<void>((resolve) => {
      opened = resolve;
    }),
  );
  await showCodesWindow("gi", ["FIRST", "SECOND"]);
  const onMessage = mocks.message.mock.calls[0]![0];
  onMessage("https://genshin.hoyoverse.com/en/gift?code=SECOND", "nativewindow://localhost");
  expect(mocks.evaluateJs).not.toHaveBeenCalled();
  expect(mocks.writeSettings).not.toHaveBeenCalled();
  opened();
  await vi.waitFor(() =>
    expect(mocks.evaluateJs).toHaveBeenCalledExactlyOnceWith("markRedeemed(1)"),
  );
});

test("persists successive redemptions per game without losing other settings", async () => {
  mocks.settings = { redeemedCodes: { hsr: ["OTHER"] } };
  await showCodesWindow("gi", ["FIRST", "SECOND"]);
  const onMessage = mocks.message.mock.calls[0]![0];
  for (const code of ["FIRST", "SECOND", "FIRST"]) {
    onMessage(`https://genshin.hoyoverse.com/en/gift?code=${code}`, "nativewindow://localhost");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(mocks.settings.redeemedCodes).toEqual({ hsr: ["OTHER"], gi: ["FIRST", "SECOND"] });
});

test("keeps codes available when opening the browser fails", async () => {
  mocks.openUrl.mockRejectedValue(new Error("Browser unavailable"));
  await showCodesWindow("gi", ["FIRST"]);
  mocks.message.mock.calls[0]![0](
    "https://genshin.hoyoverse.com/en/gift?code=FIRST",
    "nativewindow://localhost",
  );
  await vi.waitFor(() =>
    expect(mocks.evaluateJs).toHaveBeenCalledExactlyOnceWith(
      "document.getElementById('error').hidden = false",
    ),
  );
  expect(mocks.writeSettings).not.toHaveBeenCalled();
});

test("closes through trusted IPC and ignores repeated close requests", async () => {
  await showCodesWindow("gi", []);
  const onMessage = mocks.message.mock.calls[0]![0];
  onMessage("close", "https://example.com");
  expect(mocks.close).not.toHaveBeenCalled();
  onMessage("close", "nativewindow://localhost/index.html");
  onMessage("close", "nativewindow://localhost/index.html");
  expect(mocks.hide).toHaveBeenCalledTimes(1);
  expect(mocks.close).toHaveBeenCalledTimes(1);
  expect(mocks.hide.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.close.mock.invocationCallOrder[0]!,
  );
});

test.each([true, false])(
  "does not update a closed window after browser completion: %s",
  async (success) => {
    let finish!: () => void;
    mocks.openUrl.mockReturnValue(
      new Promise<void>((resolve, reject) => {
        finish = () => (success ? resolve() : reject(new Error("Browser unavailable")));
      }),
    );
    await showCodesWindow("gi", ["FIRST"]);
    mocks.message.mock.calls[0]![0](
      "https://genshin.hoyoverse.com/en/gift?code=FIRST",
      "nativewindow://localhost",
    );
    mocks.onClose.mock.calls[0]![0]();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.evaluateJs).not.toHaveBeenCalled();
  },
);

test("marks a code already redeemed without opening the browser", async () => {
  await showCodesWindow("gi", ["FIRST", "SECOND"]);
  const html = mocks.html.mock.calls[0]![0];
  expect(html).toContain('data-redeemed-index="1"');
  expect(html).toContain("Mark SECOND as already redeemed");
  const onMessage = mocks.message.mock.calls[0]![0];
  onMessage("redeemed:1", "nativewindow://localhost");
  await vi.waitFor(() => expect(mocks.evaluateJs).toHaveBeenCalledWith("markRedeemed(1)"));
  expect(mocks.openUrl).not.toHaveBeenCalled();
  expect(mocks.settings.redeemedCodes).toEqual({ gi: ["SECOND"] });
});

test("ignores untrusted and invalid already-redeemed messages", async () => {
  await showCodesWindow("gi", ["FIRST"]);
  const onMessage = mocks.message.mock.calls[0]![0];
  onMessage("redeemed:0", "https://example.com");
  onMessage("redeemed:1", "nativewindow://localhost");
  onMessage("redeemed:-1", "nativewindow://localhost");
  onMessage("redeemed:0junk", "nativewindow://localhost");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mocks.writeSettings).not.toHaveBeenCalled();
  expect(mocks.openUrl).not.toHaveBeenCalled();
});

test("keeps the item available when saving already-redeemed status fails", async () => {
  mocks.writeSettings.mockRejectedValue(new Error("Settings unavailable"));
  await showCodesWindow("gi", ["FIRST"]);
  mocks.message.mock.calls[0]![0]("redeemed:0", "nativewindow://localhost");
  await vi.waitFor(() =>
    expect(mocks.evaluateJs).toHaveBeenCalledExactlyOnceWith(
      "document.getElementById('error').hidden = false",
    ),
  );
  expect(mocks.openUrl).not.toHaveBeenCalled();
});
