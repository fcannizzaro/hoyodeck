import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocketServer } from "ws";

const root = fileURLToPath(new URL("../", import.meta.url));

for (const initial of [
  { pendingLogin: { status: "polling", game: "gi" } },
  { pendingValidation: "deleted-account", accounts: {} },
  {
    pendingLogin: { status: "polling", game: "gi" },
    pendingValidation: "deleted-account",
    accounts: {},
  },
]) {
  const fields = ["pendingLogin", "pendingValidation"].filter((field) => field in initial);
  test(`startup clears ${fields.join(" and ")} without a property inspector update`, async () => {
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await once(server, "listening");
    let child;
    let timer;
    let output = "";
    let reads = 0;
    let settings = initial;
    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`${fields.join(", ")} not cleared; settings reads=${reads}; ${output}`),
            ),
          5000,
        );
        server.on("connection", (socket) =>
          socket.on("message", (raw) => {
            const message = JSON.parse(raw.toString());
            if (message.event === "getGlobalSettings") {
              reads++;
              socket.send(
                JSON.stringify({
                  event: "didReceiveGlobalSettings",
                  id: message.id,
                  payload: { settings },
                }),
              );
            }
            if (message.event === "setGlobalSettings") {
              settings = message.payload;
              if (fields.every((field) => !(field in settings))) {
                assert.ok(reads > 0);
                resolve();
              }
            }
          }),
        );
        child = spawn(
          process.execPath,
          [
            "bin/plugin.mjs",
            "-port",
            String(server.address().port),
            "-pluginUUID",
            "com.fcannizzaro.hoyodeck",
            "-registerEvent",
            "registerPlugin",
            "-info",
            JSON.stringify({
              application: {
                version: "7.1.0",
                platform: "mac",
                platformVersion: "15",
                language: "en",
                font: "Arial",
              },
              plugin: { uuid: "com.fcannizzaro.hoyodeck", version: "1.0.0.4" },
              devices: [],
              colors: {},
              devicePixelRatio: 1,
            }),
          ],
          { cwd: `${root}/com.fcannizzaro.hoyodeck.sdPlugin`, stdio: ["ignore", "pipe", "pipe"] },
        );
        child.stdout.on("data", (data) => (output += data));
        child.stderr.on("data", (data) => (output += data));
        child.on("error", reject);
        child.on("exit", (code) => reject(new Error(`Plugin exited ${code}: ${output}`)));
      });
    } finally {
      clearTimeout(timer);
      if (child && child.exitCode === null) {
        child.kill();
        await once(child, "exit");
      }
      for (const socket of server.clients) socket.terminate();
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
