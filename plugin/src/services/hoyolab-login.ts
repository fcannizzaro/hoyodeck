import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { getGameConfig } from "@hoyodeck/shared/games";
import type { GlobalSettings, GameId } from "@hoyodeck/shared/types";
import { extractAuthFromCookies, isValidAuth, type HoyoAuth } from "@/api/hoyolab/auth";
import { dataController } from "@/services/data-controller";

const DEFAULT_LOGIN_GAME: GameId = "gi";

/** Cookie poll interval (ms) */
const POLL_INTERVAL_MS = 1_000;

/** Domains allowed for navigation in the login webview */
const ALLOWED_HOSTS = ["*.hoyolab.com"];

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
        void updateGlobalSettings(settings, { pendingLogin: undefined });
        return;
      }
    }

    if (settings.pendingLogin?.status !== "requested") return;
    void startLoginFlow(settings);
  });
}

// ─── Login flow ───────────────────────────────────────────────────

async function startLoginFlow(settings: GlobalSettings): Promise<void> {
  let detectedAuth: HoyoAuth | null = null;
  const loginGame = settings.pendingLogin?.game ?? DEFAULT_LOGIN_GAME;
  const gameConfig = getGameConfig(loginGame);

  try {
    const { NativeWindow, ensureRuntime } = await import("@nativewindow/webview");
    // Auto-install WebView2 on Windows 10 if needed
    ensureRuntime();

    // Update status to 'polling'
    await updateGlobalSettings(settings, {
      pendingLogin: { status: "polling", game: loginGame },
    });

    const win = new NativeWindow({
      title: `Login — ${gameConfig.name}`,
      width: 500,
      height: 700,
      resizable: false,
      alwaysOnTop: true,
      allowedHosts: ALLOWED_HOSTS,
      incognito: true,
    });

    if (gameConfig.loginButtonSelector) {
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
        const cookies = await win.getCookies();
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
      if (pollTimer) clearInterval(pollTimer);
      if (detectedAuth) {
        streamDeck.logger.info("[HoyolabLogin] Auth cookies detected");
        void readAndUpdate(() => ({
          pendingLogin: { status: "success" as const, auth: detectedAuth!, game: loginGame },
        }));
      } else {
        void readAndUpdate((current) => {
          if (current.pendingLogin?.status === "polling") {
            return { pendingLogin: { status: "cancelled" as const, game: loginGame } };
          }
          return {};
        });
      }
    });

    win.loadUrl(gameConfig.battleChronicleUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open login window";
    streamDeck.logger.error("[HoyolabLogin] Failed to start:", error);
    const current = await readGlobalSettings();
    await updateGlobalSettings(current, {
      pendingLogin: { status: "error", message, game: loginGame },
    });
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

async function readGlobalSettings(): Promise<GlobalSettings> {
  const cached = dataController.getCachedGlobalSettings();
  if (cached) return cached;
  return (await streamDeck.settings.getGlobalSettings()) as unknown as GlobalSettings;
}

async function updateGlobalSettings(
  current: GlobalSettings,
  updates: Partial<GlobalSettings>,
): Promise<void> {
  await dataController.writeGlobalSettings({ ...current, ...updates });
}

async function readAndUpdate(
  updater: (current: GlobalSettings) => Partial<GlobalSettings>,
): Promise<void> {
  const current = await readGlobalSettings();
  const updates = updater(current);
  if (Object.keys(updates).length > 0) {
    await updateGlobalSettings(current, updates);
  }
}
