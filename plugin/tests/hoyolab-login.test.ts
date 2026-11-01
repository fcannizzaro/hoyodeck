import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import type { GlobalSettings } from "@hoyodeck/shared/types";

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  open: vi.fn(),
  onClose: vi.fn(),
  runtime: vi.fn(),
}));
vi.mock("@elgato/streamdeck", () => ({
  default: {
    settings: { onDidReceiveGlobalSettings: mocks.listen },
    logger: { error: vi.fn(), info: vi.fn() },
  },
}));
vi.mock("../src/services/data-controller", () => ({
  dataController: { getCachedGlobalSettings: mocks.read, writeGlobalSettings: mocks.write },
}));
vi.mock("@nativewindow/webview", () => ({
  ensureRuntime: mocks.runtime,
  NativeWindow: class {
    constructor() {
      mocks.open();
    }
    onClose = mocks.onClose;
    onPageLoad() {}
    loadUrl() {}
    async getCookies() {
      return [];
    }
  },
}));

let current: GlobalSettings;
let listener: (event: { settings: GlobalSettings }) => void;
function requestLogin() {
  current = { ...current, pendingLogin: { status: "requested", game: "gi" } };
  listener({ settings: structuredClone(current) });
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  current = {};
  mocks.read.mockImplementation(() => current);
  mocks.write.mockImplementation(async (settings: GlobalSettings) => {
    current = settings;
  });
  const { registerLoginHandler } = await import("../src/services/hoyolab-login");
  registerLoginHandler();
  listener = mocks.listen.mock.calls[0]![0];
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test("opens one window for repeated requests, including while the window is open", async () => {
  requestLogin();
  requestLogin();
  await vi.waitFor(() => expect(mocks.open).toHaveBeenCalled());
  expect(mocks.open).toHaveBeenCalledTimes(1);
  requestLogin();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.open).toHaveBeenCalledTimes(1);
  mocks.onClose.mock.calls[0]![0]();
  await vi.advanceTimersByTimeAsync(0);
  requestLogin();
  await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(2));
});

test("preserves settings edited while the native module loads", async () => {
  requestLogin();
  current = { ...current, disableAnimations: true };
  await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1));
  expect(current.disableAnimations).toBe(true);
  expect(current.pendingLogin?.status).toBe("polling");
});

test("allows retry after the native runtime fails to initialize", async () => {
  mocks.runtime.mockImplementationOnce(() => {
    throw new Error("Unavailable");
  });
  requestLogin();
  await vi.waitFor(() => expect(current.pendingLogin?.status).toBe("error"));
  requestLogin();
  await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1));
});
