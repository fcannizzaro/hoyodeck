import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings } from "@/types/settings";
import { toJsonObject } from "@/types/settings";
import { extractAuthFromCookies, isValidAuth, type HoyoAuth } from "@/api/hoyolab/auth";
import { dataController } from "@/services/data-controller";

/** HoYoLAB URL to load in the login webview */
const HOYOLAB_URL = "https://act.hoyolab.com/app/community-game-records-sea/index.html#/ys";

/** Cookie poll interval (ms) */
const POLL_INTERVAL_MS = 1_000;

/** Domains allowed for navigation in the login webview */
const ALLOWED_HOSTS = ["*"];

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

  try {
    const { NativeWindow, ensureRuntime } = await import("@nativewindow/webview");
    // Auto-install WebView2 on Windows 10 if needed
    ensureRuntime();

    // Update status to 'polling'
    await updateGlobalSettings(settings, {
      pendingLogin: { status: "polling" },
    });

    const win = new NativeWindow({
      title: "Login — HoYoLAB",
      width: 500,
      height: 700,
      resizable: false,
      alwaysOnTop: true,
      allowedHosts: ALLOWED_HOSTS,
      incognito: true,
    });

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
          pendingLogin: { status: "success" as const, auth: detectedAuth! },
        }));
      } else {
        void readAndUpdate((current) => {
          if (current.pendingLogin?.status === "polling") {
            return { pendingLogin: { status: "cancelled" as const } };
          }
          return {};
        });
      }
    });

    win.loadUrl(HOYOLAB_URL);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open login window";
    streamDeck.logger.error("[HoyolabLogin] Failed to start:", error);
    const current = await readGlobalSettings();
    await updateGlobalSettings(current, {
      pendingLogin: { status: "error", message },
    });
  }
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
  await streamDeck.settings.setGlobalSettings(toJsonObject({ ...current, ...updates }));
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
