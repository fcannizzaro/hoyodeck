import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { HoyolabClient } from "../src/api/hoyolab/client";
import { GenshinController } from "../src/services/game-controllers/genshin-controller";
import { HSRController } from "../src/services/game-controllers/hsr-controller";
import { ZZZController } from "../src/services/game-controllers/zzz-controller";

vi.mock("@elgato/streamdeck", () => ({
  default: { logger: { warn: vi.fn() } },
}));
vi.mock("../src/utils/debug", () => ({ debug: { log: vi.fn() } }));

const info = {
  total_sign_day: 1,
  today: "2026-11-01",
  is_sign: false,
  is_sub: false,
  first_bind: false,
  region: "",
};
const rewards = { month: 11, awards: [] };

afterEach(() => vi.restoreAllMocks());

describe.each([
  [new GenshinController(), "gi:check-in"],
  [new HSRController(), "hsr:check-in"],
  [new ZZZController(), "zzz:check-in"],
] as const)("%s check-in", (controller, dataType) => {
  function setup() {
    const client = new HoyolabClient({
      ltoken_v2: "test-token",
      ltuid_v2: "123",
      ltmid_v2: "test-mid",
      cookie_token_v2: "test-cookie",
      account_mid_v2: "test-account-mid",
      account_id_v2: "123",
    });
    vi.spyOn(client, "getCheckInInfo").mockResolvedValue(info);
    vi.spyOn(client, "getCheckInRewards").mockResolvedValue(rewards);
    return client;
  }

  test("combines status and rewards for the controller's game", async () => {
    const client = setup();
    const results = await controller.fetchAll(client, "600123456", [dataType]);

    expect(client.getCheckInInfo).toHaveBeenCalledExactlyOnceWith(controller.game);
    expect(client.getCheckInRewards).toHaveBeenCalledExactlyOnceWith(controller.game);
    expect([...results.keys()]).toEqual([dataType]);
    expect(results.get(dataType)).toMatchObject({ status: "ok", data: { info, rewards } });
  });

  test.each(["getCheckInInfo", "getCheckInRewards"] as const)(
    "reports a check-in error when %s fails",
    async (method) => {
      const client = setup();
      const error = new Error("Network unavailable");
      vi.mocked(client[method]).mockRejectedValueOnce(error);

      const results = await controller.fetchAll(client, "600123456", [dataType]);

      expect(results.get(dataType)).toMatchObject({ status: "error", error });
    },
  );

  test("does not fetch check-in data when it is not requested", async () => {
    const client = setup();
    const results = await controller.fetchAll(client, "600123456", []);

    expect(results.size).toBe(0);
    expect(client.getCheckInInfo).not.toHaveBeenCalled();
    expect(client.getCheckInRewards).not.toHaveBeenCalled();
  });
});
