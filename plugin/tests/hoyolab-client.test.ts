import streamDeck from "@elgato/streamdeck";
import { createHash } from "node:crypto";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { HoyolabClient } from "../src/api/hoyolab/client";
vi.mock("@elgato/streamdeck", () => ({ default: { logger: { warn: vi.fn() } } }));

const auth = {
  ltoken_v2: "test",
  ltuid_v2: "test",
  ltmid_v2: "test",
  cookie_token_v2: "test",
  account_mid_v2: "test",
  account_id_v2: "test",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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

test("posts CN Genshin calendars to the app endpoint with a signed JSON body", async () => {
  const calendar = { avatar_up_list: [], weapon_up_list: [] };
  const fetcher = vi.fn(async (_url: string, _options: RequestInit) =>
    Response.json({ retcode: 0, data: calendar }),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = new HoyolabClient(auth, "cn", {
    gi: [{ uid: "500123456", nickname: "A", region: "cn_qd01" }],
  });

  expect(await client.getGenshinActCalendar("500123456")).toEqual(calendar);
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/act_calendar");
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body as string)).toEqual({
    role_id: "500123456",
    server: "cn_qd01",
  });
  expect(options.headers).toHaveProperty("Content-Type", "application/json");
  const [timestamp, random, hash] = new Headers(options.headers).get("DS")!.split(",");
  const expectedHash = createHash("md5")
    .update(`salt=xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs&t=${timestamp}&r=${random}&b=${options.body}&q=`)
    .digest("hex");
  expect(hash).toBe(expectedHash);
});

test("preserves the global Genshin calendar request", async () => {
  const fetcher = vi.fn(async (_url: string, _options: RequestInit) =>
    Response.json({ retcode: 0, data: {} }),
  );
  vi.stubGlobal("fetch", fetcher);
  await new HoyolabClient(auth).getGenshinActCalendar("600123456");
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe(
    "https://sg-public-api.hoyolab.com/event/game_record/genshin/api/act_calendar?role_id=600123456&server=os_usa",
  );
  expect(options.method).toBe("POST");
  expect(options.body).toBeUndefined();
  expect(options.headers).not.toHaveProperty("DS");
});

test("enables disabled CN real-time notes for a linked role and retries once", async () => {
  const note = { current_resin: 123, max_resin: 200 };
  const fetcher = vi
    .fn(async (_url: string, _options: RequestInit) => Response.json({ retcode: 0, data: note }))
    .mockResolvedValueOnce(Response.json({ retcode: 10102, message: "Notes disabled", data: null }))
    .mockResolvedValueOnce(Response.json({ retcode: 0, data: {} }));
  vi.stubGlobal("fetch", fetcher);
  const client = new HoyolabClient(auth, "cn", {
    gi: [{ uid: "500123456", nickname: "A", region: "cn_qd01" }],
  });

  expect(await client.getGenshinDailyNote("500123456")).toEqual(note);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const [url, options] = fetcher.mock.calls[1]!;
  expect(url).toBe(
    "https://api-takumi-record.mihoyo.com/game_record/app/card/wapi/changeDataSwitch",
  );
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body as string)).toEqual({
    game_id: 2,
    is_public: true,
    switch_id: 3,
  });
  expect(options.headers).toHaveProperty("DS");
  expect(fetcher.mock.calls[2]![0]).toBe(fetcher.mock.calls[0]![0]);
});

test.each([1034, 5003, -100, 10001])(
  "does not change note settings for CN error %s",
  async (retcode) => {
    const fetcher = vi.fn(async () =>
      Response.json({ retcode, message: "Request failed", data: null }),
    );
    vi.stubGlobal("fetch", fetcher);
    const client = new HoyolabClient(auth, "cn", {
      gi: [{ uid: "100123456", nickname: "A", region: "cn_gf01" }],
    });
    await expect(client.getGenshinDailyNote("100123456")).rejects.toMatchObject({ retcode });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

test.each([
  { region: "global", linked: true },
  { region: "cn", linked: false },
] as const)(
  "does not enable notes for region=$region, linked=$linked",
  async ({ region, linked }) => {
    const fetcher = vi.fn(async () =>
      Response.json({ retcode: 10102, message: "Notes disabled", data: null }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      new HoyolabClient(auth, region, {
        gi: linked ? [{ uid: "100123456", nickname: "A", region: "cn_gf01" }] : [],
      }).getGenshinDailyNote("100123456"),
    ).rejects.toMatchObject({ retcode: 10102 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

test("does not keep retrying when CN notes remain disabled", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ retcode: 10102, message: "Notes disabled", data: null }),
  );
  fetcher.mockResolvedValueOnce(Response.json({ retcode: 10102, message: "Notes disabled" }));
  fetcher.mockResolvedValueOnce(Response.json({ retcode: 0, data: {} }));
  vi.stubGlobal("fetch", fetcher);
  const client = new HoyolabClient(auth, "cn", {
    gi: [{ uid: "100123456", nickname: "A", region: "cn_gf01" }],
  });
  await expect(client.getGenshinDailyNote("100123456")).rejects.toMatchObject({ retcode: 10102 });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

test.each([
  {
    response: () =>
      Response.json({ retcode: 1034, message: "private upstream message", data: null }),
    code: 1034,
    status: 200,
    errorType: "HoyolabApiError",
  },
  {
    response: () => new Response("private response", { status: 403 }),
    code: undefined,
    status: 403,
    errorType: "Error",
  },
  {
    response: () => new Response("private invalid JSON"),
    code: undefined,
    status: 200,
    errorType: "SyntaxError",
  },
])(
  "logs safe request context for $errorType with HTTP $status",
  async ({ response, code, status, errorType }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    const client = new HoyolabClient(auth, "cn");
    await expect(client.getStarRailMemoryOfChaos("100123456")).rejects.toBeInstanceOf(Error);
    const warning = vi.mocked(streamDeck.logger.warn).mock.calls[0]![0] as string;
    const context = JSON.parse(warning.slice(warning.indexOf("{")));
    expect(context).toEqual({
      region: "cn",
      method: "GET",
      endpoint: "https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/challenge",
      server: "prod_gf_cn",
      scheduleType: "1",
      httpStatus: status,
      retcode: code,
      errorType,
    });
    expect(warning).not.toMatch(/100123456|private|Cookie|ltoken|DS/);
  },
);

test("logs a network failure without exposing the URL or exception message", async () => {
  const error = new TypeError("private URL with role_id=100123456 and ltoken_v2=test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw error;
    }),
  );
  await expect(new HoyolabClient(auth, "cn").getStarRailPureFiction("100123456")).rejects.toBe(
    error,
  );
  const warning = vi.mocked(streamDeck.logger.warn).mock.calls[0]![0] as string;
  expect(warning).toContain("challenge_story");
  expect(warning).toContain('"errorType":"TypeError"');
  expect(warning).not.toMatch(/100123456|private|ltoken/);
});
