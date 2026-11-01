import { afterEach, expect, test, vi } from "vite-plus/test";
import { HoyolabClient } from "../src/api/hoyolab/client";
const auth = {
  ltoken_v2: "test",
  ltuid_v2: "test",
  ltmid_v2: "test",
  cookie_token_v2: "test",
  account_mid_v2: "test",
  account_id_v2: "test",
};
afterEach(() => vi.unstubAllGlobals());

test("discovers every global role through the binding API for all games", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      retcode: 0,
      data: {
        list: [
          { game_uid: "600123456", nickname: "A", region: "os_usa", level: 60 },
          { game_uid: "700123456", nickname: "B", region: "os_euro", level: 60 },
        ],
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const result = await new HoyolabClient(auth).getGameRecordCard("test");
  expect(result.list).toHaveLength(6);
  expect(fetcher.mock.calls).toHaveLength(3);
  for (const [url] of fetcher.mock.calls as unknown as [string][])
    expect(url).toContain("/binding/api/getUserGameRolesByLtoken?game_biz=");
});

test("routes CN records and check-in using the discovered server", async () => {
  const fetcher = vi.fn(async () => Response.json({ retcode: 0, data: {} }));
  vi.stubGlobal("fetch", fetcher);
  const client = new HoyolabClient(auth, "cn", {
    gi: [{ uid: "500123456", nickname: "A", region: "cn_qd01" }],
  });
  await client.getGenshinDailyNote("500123456");
  await client.claimCheckIn("gi", "500123456");
  const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
  expect(calls[0]![0]).toContain(
    "api-takumi-record.mihoyo.com/game_record/app/genshin/api/dailyNote",
  );
  expect(calls[0]![0]).toContain("server=cn_qd01");
  expect(calls[1]![0]).toContain("uid=500123456&region=cn_qd01");
  expect(calls[1]![1].method).toBe("POST");
  expect(calls[0]![1].headers).toHaveProperty("DS");
  await expect(client.claimCheckIn("gi")).rejects.toThrow("UID is required");
});
