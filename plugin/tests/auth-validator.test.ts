import { beforeEach, expect, test, vi } from "vite-plus/test";
import type { GlobalSettings, HoyoAccount } from "@hoyodeck/shared/types";

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@elgato/streamdeck", () => ({
  default: { settings: { onDidReceiveGlobalSettings: mocks.listen }, logger: { error: vi.fn() } },
}));
vi.mock("../src/services/data-controller", () => ({
  dataController: { getCachedGlobalSettings: mocks.read, writeGlobalSettings: mocks.write },
}));
vi.mock("../src/api/hoyolab/client", () => ({
  HoyolabClient: class {
    getGameRecordCard = mocks.fetch;
  },
}));
vi.mock("../src/utils/debug", () => ({ debug: { log: vi.fn() } }));

const account: HoyoAccount = {
  id: "account-a",
  name: "Original",
  authStatus: "unknown",
  uids: {},
  auth: {
    ltoken_v2: "test-token",
    ltuid_v2: "123",
    ltmid_v2: "test-mid",
    cookie_token_v2: "test-cookie",
    account_mid_v2: "test-account-mid",
    account_id_v2: "123",
  },
};
let current: GlobalSettings;
let listener: (event: { settings: GlobalSettings }) => void;

function emit(settings: GlobalSettings) {
  current = structuredClone(settings);
  listener({ settings: structuredClone(settings) });
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  current = { accounts: { [account.id]: structuredClone(account) }, pendingValidation: account.id };
  mocks.read.mockImplementation(() => current);
  mocks.write.mockImplementation(async (settings: GlobalSettings) => {
    current = settings;
  });
  const { registerAuthValidator } = await import("../src/services/auth-validator");
  registerAuthValidator();
  listener = mocks.listen.mock.calls[0]![0];
});

function holdResponse() {
  let resolve!: (value: { list: [] }) => void;
  mocks.fetch.mockReturnValueOnce(
    new Promise<{ list: [] }>((done) => {
      resolve = done;
    }),
  );
  return () => resolve({ list: [] });
}

test("coalesces duplicate validation events and preserves newer settings", async () => {
  const finish = holdResponse();
  emit(current);
  emit(current);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  current = {
    ...current,
    disableAnimations: true,
    pendingValidation: "account-b",
    accounts: { ...current.accounts, [account.id]: { ...account, name: "Renamed" } },
  };
  finish();
  await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
  expect(current.disableAnimations).toBe(true);
  expect(current.pendingValidation).toBe("account-b");
  expect(current.accounts?.[account.id]?.name).toBe("Renamed");
  expect(current.accounts?.[account.id]?.authStatus).toBe("valid");
});

test("discards validation after the account is deleted", async () => {
  const finish = holdResponse();
  emit(current);
  current = { accounts: {} };
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mocks.write).not.toHaveBeenCalled();
  expect(current.accounts).toEqual({});
});

test("allows changed credentials to validate and ignores the old response", async () => {
  const finishOld = holdResponse();
  emit(current);
  const finishNew = holdResponse();
  const updated = { ...account, auth: { ...account.auth, ltoken_v2: "replacement-token" } };
  emit({ accounts: { [account.id]: updated }, pendingValidation: account.id });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  finishNew();
  await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
  finishOld();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mocks.write).toHaveBeenCalledTimes(1);
  expect(current.accounts?.[account.id]?.auth.ltoken_v2).toBe("replacement-token");
  expect(current.pendingValidation).toBeUndefined();
});

test("keeps newer account data on a network error and permits another validation", async () => {
  let fail!: (error: Error) => void;
  mocks.fetch.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      fail = reject;
    }),
  );
  emit(current);
  const updated = { ...account, authStatus: "valid" as const, uids: { gi: "600123456" } };
  current = { ...current, accounts: { [account.id]: updated } };
  fail(new Error("Network unavailable"));
  await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
  expect(current.accounts?.[account.id]).toEqual(updated);
  mocks.fetch.mockResolvedValueOnce({ list: [] });
  emit({ ...current, pendingValidation: account.id });
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
});
