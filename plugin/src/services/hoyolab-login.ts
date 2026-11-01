import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { getGameConfig } from "@hoyodeck/shared/games";
import type { GlobalSettings, GameId, HoyoRegion } from "@hoyodeck/shared/types";
import { extractAuthFromCookies, isValidAuth, type HoyoAuth } from "@/api/hoyolab/auth";
import { dataController } from "@/services/data-controller";

const DEFAULT_LOGIN_GAME: GameId = "gi";

/** Cookie poll interval (ms) */
const POLL_INTERVAL_MS = 1_000;

/** Domains allowed for navigation in the login webview */
const ALLOWED_HOSTS = ["*.hoyolab.com", "*.hoyoverse.com", "*.miyoushe.com", "*.mihoyo.com"];

let loginInProgress = false;
let cancelLogin: (() => void) | undefined;
let activeRequestId: string | undefined;

// ─── Public API ───────────────────────────────────────────────────

/**
 * Register the global settings listener that drives the webview login flow.
 * Called once at plugin startup.
 *
 * On the first global settings receive, clears any stale pendingLogin
 * left over from a previous session. Then, on subsequent receives,
 * starts the login flow when pendingLogin.status === 'requested'.
 */
export function registerLoginHandler(): void {
  let initialized = false;

  streamDeck.settings.onDidReceiveGlobalSettings<JsonObject>((ev) => {
    const settings = ev.settings as unknown as GlobalSettings;

    // On first receive, clear stale login state from a previous session
    if (!initialized) {
      initialized = true;
      if (settings.pendingLogin && settings.pendingLogin.status !== "requested") {
        void readAndUpdate(() => ({ pendingLogin: undefined })).catch((error) => {
          streamDeck.logger.error("[HoyolabLogin] Failed to clear login state:", error);
        });
        return;
      }
    }

    if (loginInProgress) {
      if (!settings.pendingLogin || settings.pendingLogin.requestId !== activeRequestId)
        cancelLogin?.();
      return;
    }
    if (settings.pendingLogin?.status !== "requested") return;
    activeRequestId = settings.pendingLogin.requestId;
    loginInProgress = true;
    void startLoginFlow(settings).catch((error) => {
      streamDeck.logger.error("[HoyolabLogin] Failed to save login state:", error);
    });
  });
}

// ─── Login flow ───────────────────────────────────────────────────

async function startLoginFlow(settings: GlobalSettings): Promise<void> {
  let detectedAuth: HoyoAuth | null = null;
  const requestId = settings.pendingLogin?.requestId;
  const loginGame = settings.pendingLogin?.game ?? DEFAULT_LOGIN_GAME;
  const loginRegion: HoyoRegion = settings.pendingLogin?.region ?? "global";
  const gameConfig = getGameConfig(loginGame);
  const serviceName = loginRegion === "cn" ? "MiYouShe" : "HoYoLAB";

  try {
    const { NativeWindow, ensureRuntime } = await import("@nativewindow/webview");
    // Auto-install WebView2 on Windows 10 if needed
    ensureRuntime();

    const pending = dataController.getCachedGlobalSettings()?.pendingLogin;
    if (!pending || pending.status !== "requested" || pending.requestId !== requestId) {
      loginInProgress = false;
      return;
    }

    // Update status to 'polling'
    await readAndUpdate(() => ({
      pendingLogin: { status: "polling", game: loginGame, region: loginRegion, requestId },
    }));

    const win = new NativeWindow({
      title: `${serviceName} Login — ${gameConfig.name}`,
      width: 500,
      height: 700,
      resizable: false,
      alwaysOnTop: true,
      allowedHosts: ALLOWED_HOSTS,
      incognito: true,
    });

    if (loginRegion === "global" && gameConfig.loginButtonSelector) {
      win.onPageLoad((event) => {
        if (event !== "finished") return;
        injectAutoLoginClick(win, gameConfig.loginButtonSelector!);
      });
    }

    // Poll cookies on a fixed interval
    const pollTimer = setInterval(() => void checkCookies(), POLL_INTERVAL_MS);

    /**
     * Check the webview's cookies for valid HoYoLAB auth tokens.
     * On success: store auth and close the window (triggers onClose).
     */
    const checkCookies = async () => {
      try {
        const cookies = win.getCookies();
        const cookieRecord: Record<string, string> = {};
        for (const c of cookies) {
          cookieRecord[c.name] = c.value;
        }
        const auth = extractAuthFromCookies(cookieRecord);
        if (!isValidAuth(auth)) return; // Not logged in yet
        detectedAuth = auth;
        clearInterval(pollTimer);
        win.close();
      } catch (error) {
        streamDeck.logger.error("[HoyolabLogin] Cookie check failed:", error);
      }
    };

    // All cleanup and global settings writes happen here
    win.onClose(() => {
      clearInterval(pollTimer);
      void readAndUpdate((current) => {
        if (
          current.pendingLogin?.requestId !== requestId ||
          current.pendingLogin?.status !== "polling" ||
          (current.pendingLogin.region ?? "global") !== loginRegion
        )
          return {};
        if (detectedAuth) {
          return {
            pendingLogin: {
              status: "success",
              auth: detectedAuth,
              game: loginGame,
              region: loginRegion,
              requestId,
            },
          };
        }
        if (current.pendingLogin?.status === "polling") {
          return {
            pendingLogin: { status: "cancelled", game: loginGame, region: loginRegion, requestId },
          };
        }
        return {};
      })
        .catch((error) =>
          streamDeck.logger.error("[HoyolabLogin] Failed to save login state:", error),
        )
        .finally(() => {
          cancelLogin = undefined;
          loginInProgress = false;
          const next = dataController.getCachedGlobalSettings();
          if (
            next?.pendingLogin?.status === "requested" &&
            next.pendingLogin.requestId !== requestId
          ) {
            activeRequestId = next.pendingLogin.requestId;
            loginInProgress = true;
            void startLoginFlow(next).catch((error) =>
              streamDeck.logger.error("[HoyolabLogin] Failed to save login state:", error),
            );
          }
        });
    });

    cancelLogin = () => win.close();
    win.loadUrl(
      loginRegion === "cn" ? gameConfig.cnBattleChronicleUrl : gameConfig.battleChronicleUrl,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open login window";
    streamDeck.logger.error("[HoyolabLogin] Failed to start:", error);
    try {
      await readAndUpdate((current) =>
        current.pendingLogin?.requestId === requestId
          ? {
              pendingLogin: {
                status: "error",
                message,
                game: loginGame,
                region: loginRegion,
                requestId,
              },
            }
          : {},
      );
    } finally {
      loginInProgress = false;
    }
  }
}

function injectAutoLoginClick(
  win: { evaluateJs: (script: string) => void },
  selector: string,
): void {
  const selectorJson = JSON.stringify(selector);

  win.evaluateJs(`
    (() => {
      const selector = ${selectorJson};
      const globalKey = "__hoyodeckAutoLoginTimers";
      const root = window;
      const timers = (root[globalKey] ??= {});

      if (timers[selector]) {
        clearInterval(timers[selector]);
        delete timers[selector];
      }

      let attempts = 0;
      const maxAttempts = 40;
      const intervalMs = 250;

      const tryClick = () => {
        attempts += 1;

        const button = document.querySelector(selector);
        if (button instanceof HTMLElement) {
          button.click();
          clearInterval(timers[selector]);
          delete timers[selector];
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(timers[selector]);
          delete timers[selector];
        }
      };

      tryClick();
      if (!timers[selector]) {
        timers[selector] = setInterval(tryClick, intervalMs);
      }
    })();
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────

async function readAndUpdate(
  updater: (current: GlobalSettings) => Partial<GlobalSettings>,
): Promise<void> {
  const current =
    dataController.getCachedGlobalSettings() ??
    ((await streamDeck.settings.getGlobalSettings()) as unknown as GlobalSettings);
  const updates = updater(current);
  if (Object.keys(updates).length > 0) {
    await dataController.writeGlobalSettings({ ...current, ...updates });
  }
}
