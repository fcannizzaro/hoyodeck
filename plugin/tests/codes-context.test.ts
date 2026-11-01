import { beforeEach, expect, test, vi } from "vite-plus/test";
import type { GlobalSettings } from "@hoyodeck/shared/types";

const mocks = vi.hoisted(() => ({
  settings: {} as GlobalSettings,
  refetch: vi.fn(),
}));
vi.mock("@fcannizzaro/streamdeck-react", () => ({
  useSettings: () => [{ game: "gi" }],
  useGlobalSettings: () => [mocks.settings],
  useWillAppear: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: ["FIRST", "SECOND"], refetch: mocks.refetch }),
}));
vi.mock("../src/services/data-controller", () => ({
  dataController: { getCachedGlobalSettings: () => mocks.settings },
}));
vi.mock("../src/api/manager/client", () => ({ codesClient: {} }));
import { CodesProvider } from "../src/contexts/codes-context";

beforeEach(() => {
  mocks.settings = {};
  mocks.refetch.mockResolvedValue({ data: ["FIRST", "SECOND", "NEW"] });
});

test("updates the counter's list and reopened list while keeping new codes available", async () => {
  expect(CodesProvider({}).props.value.codes).toEqual(["FIRST", "SECOND"]);
  mocks.settings = { redeemedCodes: { gi: ["FIRST"], hsr: ["SECOND"] } };
  const { codes, refreshCodes } = CodesProvider({}).props.value;
  expect(codes).toEqual(["SECOND"]);
  expect(await refreshCodes()).toEqual(["SECOND", "NEW"]);
});

test("uses current redemption history when a refresh finishes", async () => {
  const { refreshCodes } = CodesProvider({}).props.value;
  mocks.settings = { redeemedCodes: { gi: ["FIRST", "SECOND"] } };
  expect(await refreshCodes()).toEqual(["NEW"]);
});
