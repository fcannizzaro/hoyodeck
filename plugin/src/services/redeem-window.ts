import streamDeck from "@elgato/streamdeck";
import type { GameId } from "@hoyodeck/shared/types";
import type { GameCodeWithStatus } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import type { HoyolabClient } from "@/api/hoyolab/client";
import { HoyolabApiError, isAuthError } from "@/api/types/common";

// ─── Constants ─────────────────────────────────────────────────

/** Rate-limit cooldown between consecutive redeems (ms) */
const REDEEM_DELAY_MS = 5_000;

/** Prevent opening multiple windows simultaneously */
let windowOpen = false;

// ─── IPC Message Types ─────────────────────────────────────────

interface CodeDisplay {
  code: string;
  rewards: string;
  status: "available" | "claimed" | "dismissed" | "expired";
  active: boolean;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Open a native window showing all codes for a game, then sequentially
 * redeem every available code via HoYoLAB with live progress updates.
 *
 * The plugin drives the redemption loop and communicates status to the
 * webview via `postMessage` IPC. The webview is purely presentational.
 *
 * @param onClaimed — called immediately each time a code is successfully redeemed.
 */
export async function openRedeemWindow(
  game: GameId,
  codes: GameCodeWithStatus[],
  client: HoyolabClient,
  uid: string,
  onClaimed: (code: string) => void,
): Promise<void> {
  if (windowOpen) return;
  windowOpen = true;

  try {
    const { NativeWindow, ensureRuntime } = await import("@nativewindow/webview");
    ensureRuntime();

    const gameName = GAMES[game].name;

    const win = new NativeWindow({
      title: `Redeem Codes — ${gameName}`,
      width: 480,
      height: 600,
      resizable: false,
      alwaysOnTop: true,
    });

    const send = (msg: unknown) => {
      try {
        win.postMessage(JSON.stringify(msg));
      } catch {
        // Window may have been closed
      }
    };

    // Resolve when the window closes
    const closed = new Promise<void>((resolve) => {
      win.onClose(() => {
        windowOpen = false;
        resolve();
      });
    });

    // Wait for the webview to signal "ready", then init + redeem
    win.onMessage((raw: string) => {
      try {
        const msg = JSON.parse(raw) as { type: string };
        if (msg.type === "ready") {
          const display: CodeDisplay[] = codes.map((c) => ({
            code: c.code,
            rewards: c.rewards,
            status: c.status,
            active: c.active,
          }));
          send({ type: "init", game, gameName, codes: display });
          void runRedemptionLoop(send, game, codes, client, uid, onClaimed);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    win.loadHtml(buildRedeemHtml());

    // Block until window is closed
    await closed;
  } catch (error) {
    windowOpen = false;
    streamDeck.logger.error("[RedeemWindow] Failed to open:", error);
    throw error;
  }
}

// ─── Redemption Loop ───────────────────────────────────────────

async function runRedemptionLoop(
  send: (msg: unknown) => void,
  game: GameId,
  codes: GameCodeWithStatus[],
  client: HoyolabClient,
  uid: string,
  onClaimed: (code: string) => void,
): Promise<void> {
  const available = codes.filter((c) => c.status === "available" && c.active);

  if (available.length === 0) {
    send({ type: "redeem-complete" });
    return;
  }

  for (let i = 0; i < available.length; i++) {
    const entry = available[i]!;
    send({ type: "redeem-progress", code: entry.code, status: "loading" });

    try {
      await client.redeemCode(game, entry.code, uid);
      onClaimed(entry.code);
      send({ type: "redeem-progress", code: entry.code, status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (isAuthError(error)) {
        // Auth error — do NOT mark as claimed, stop the loop
        send({
          type: "redeem-progress",
          code: entry.code,
          status: "error",
          message: "Not logged in",
        });
        streamDeck.logger.warn(`[RedeemWindow] Auth error, stopping redemption loop`);
        break;
      }

      // Any other error (expired, max usage, already claimed, etc.) — mark as done so it's not retried
      onClaimed(entry.code);

      const isAlreadyClaimed = error instanceof HoyolabApiError && error.retcode === -2017;
      send({
        type: "redeem-progress",
        code: entry.code,
        status: isAlreadyClaimed ? "success" : "error",
        message: isAlreadyClaimed ? "Already claimed" : message,
      });

      if (!isAlreadyClaimed) {
        streamDeck.logger.warn(`[RedeemWindow] Failed to redeem ${entry.code}:`, message);
      }
    }

    // Rate-limit delay between codes (skip after last)
    if (i < available.length - 1) {
      for (let sec = REDEEM_DELAY_MS / 1000; sec > 0; sec--) {
        send({ type: "redeem-delay", code: entry.code, remaining: sec });
        await sleep(1000);
      }
    }
  }

  send({ type: "redeem-complete" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── HTML Template ─────────────────────────────────────────────

function buildRedeemHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f0f1a;
    color: #e0e0e0;
    min-height: 100vh;
    overflow-y: auto;
  }

  .header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 16px 20px;
    border-bottom: 1px solid #2a2a4a;
  }

  .header h1 {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .header .subtitle {
    font-size: 12px;
    color: #8888aa;
    margin-top: 2px;
  }

  .code-list {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #666688;
    padding: 8px 4px 4px;
    font-weight: 600;
  }

  .code-card {
    background: #16213e;
    border-radius: 8px;
    padding: 12px 14px;
    border: 1px solid #2a2a4a;
    transition: border-color 0.3s, background 0.3s;
  }

  .code-card.loading {
    border-color: #fdcb6e;
    background: #1a2540;
  }

  .code-card.success {
    border-color: #00b894;
  }

  .code-card.error {
    border-color: #e17055;
  }

  .code-card.claimed, .code-card.dismissed {
    opacity: 0.5;
  }

  .code-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #fdcb6e33;
    border-top-color: #fdcb6e;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .code-name {
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.5px;
    flex: 1;
  }

  .code-rewards {
    font-size: 12px;
    color: #8888aa;
    margin-top: 4px;
    padding-left: 28px;
  }

  .code-message {
    font-size: 11px;
    margin-top: 3px;
    padding-left: 28px;
  }

  .code-message.success { color: #00b894; }
  .code-message.error { color: #e17055; }

  .delay-bar {
    margin-top: 6px;
    padding-left: 28px;
    font-size: 11px;
    color: #fdcb6e;
  }

  .footer {
    position: sticky;
    bottom: 0;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-top: 1px solid #2a2a4a;
    padding: 12px 20px;
    font-size: 13px;
    color: #8888aa;
    text-align: center;
  }

  .footer .stat {
    display: inline-block;
    margin: 0 8px;
  }

  .footer .stat.success { color: #00b894; }
  .footer .stat.error { color: #e17055; }

  .badge {
    display: inline-block;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 6px;
    font-weight: 600;
  }

  .badge.available { background: #00b89433; color: #00b894; }
  .badge.claimed   { background: #636e7233; color: #636e72; }
  .badge.expired   { background: #e1705533; color: #e17055; }
  .badge.dismissed { background: #636e7233; color: #636e72; }
</style>
</head>
<body>
  <div class="header">
    <h1 id="title">Redeem Codes</h1>
    <div class="subtitle" id="subtitle">Loading...</div>
  </div>

  <div class="code-list" id="available-section"></div>
  <div class="code-list" id="other-section"></div>

  <div class="footer" id="footer" style="display:none">
    <span class="stat success" id="stat-success"></span>
    <span class="stat error" id="stat-error"></span>
  </div>

  <script>
    // ── State ──────────────────────────────────────────
    let codes = [];
    let stats = { success: 0, errors: 0, total: 0 };

    // ── IPC ────────────────────────────────────────────
    window.__native_message__ = function(raw) {
      try {
        var msg = JSON.parse(raw);
        switch (msg.type) {
          case 'init':      onInit(msg); break;
          case 'redeem-progress': onProgress(msg); break;
          case 'redeem-delay':    onDelay(msg); break;
          case 'redeem-complete': onComplete(); break;
        }
      } catch(e) { console.error(e); }
    };

    // Signal ready
    window.ipc.postMessage(JSON.stringify({ type: 'ready' }));

    // ── Handlers ───────────────────────────────────────
    function onInit(msg) {
      codes = msg.codes;
      document.getElementById('title').textContent = msg.gameName + ' — Codes';

      var available = codes.filter(function(c) { return c.status === 'available' && c.active; });
      var other = codes.filter(function(c) { return c.status !== 'available' || !c.active; });

      stats.total = available.length;
      document.getElementById('subtitle').textContent =
        available.length > 0
          ? 'Redeeming ' + available.length + ' code' + (available.length !== 1 ? 's' : '') + '...'
          : 'All codes already claimed!';

      var avSection = document.getElementById('available-section');
      if (available.length > 0) {
        avSection.innerHTML = '<div class="section-label">Available</div>' +
          available.map(function(c) { return renderCard(c, 'pending'); }).join('');
      }

      var otSection = document.getElementById('other-section');
      if (other.length > 0) {
        otSection.innerHTML = '<div class="section-label">Previously claimed</div>' +
          other.map(function(c) { return renderCard(c, c.status); }).join('');
      }

      if (available.length === 0) {
        showFooter();
      }
    }

    function onProgress(msg) {
      var card = document.getElementById('card-' + msg.code);
      if (!card) return;

      // Remove old state classes
      card.className = 'code-card ' + msg.status;

      var icon = card.querySelector('.status-icon');
      var msgEl = card.querySelector('.code-message');
      var delayEl = card.querySelector('.delay-bar');

      if (msg.status === 'loading') {
        icon.innerHTML = '<div class="spinner"></div>';
        if (msgEl) msgEl.textContent = '';
        if (delayEl) delayEl.textContent = '';
      } else if (msg.status === 'success') {
        icon.textContent = '\\u2705';
        stats.success++;
        if (msgEl) {
          msgEl.className = 'code-message success';
          msgEl.textContent = msg.message || 'Redeemed!';
        }
        if (delayEl) delayEl.textContent = '';
      } else if (msg.status === 'error') {
        icon.textContent = '\\u274C';
        stats.errors++;
        if (msgEl) {
          msgEl.className = 'code-message error';
          msgEl.textContent = msg.message || 'Failed';
        }
        if (delayEl) delayEl.textContent = '';
      }

      updateFooterStats();
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function onDelay(msg) {
      var card = document.getElementById('card-' + msg.code);
      if (!card) return;
      var delayEl = card.querySelector('.delay-bar');
      if (delayEl) {
        delayEl.textContent = 'Next code in ' + msg.remaining + 's...';
      }
    }

    function onComplete() {
      document.getElementById('subtitle').textContent =
        'Done! ' + stats.success + ' redeemed' +
        (stats.errors > 0 ? ', ' + stats.errors + ' failed' : '');
      showFooter();
    }

    // ── Rendering ──────────────────────────────────────
    function renderCard(code, state) {
      var icon = '';
      var extraClass = state;
      var msg = '';

      switch (state) {
        case 'pending':
          icon = '<span style="color:#636e72">\\u2B1C</span>';
          break;
        case 'loading':
          icon = '<div class="spinner"></div>';
          break;
        case 'success':
        case 'claimed':
          icon = '\\u2705';
          extraClass = state === 'claimed' ? 'claimed' : 'success';
          if (state === 'claimed') msg = '<div class="code-message success">Claimed</div>';
          break;
        case 'error':
          icon = '\\u274C';
          break;
        case 'dismissed':
          icon = '<span style="color:#636e72">\\u2796</span>';
          extraClass = 'dismissed';
          msg = '<div class="code-message" style="color:#636e72">Dismissed</div>';
          break;
        case 'expired':
          icon = '<span style="color:#e17055">\\u23F3</span>';
          msg = '<div class="code-message error">Expired</div>';
          break;
        default:
          icon = '<span style="color:#636e72">\\u2B1C</span>';
      }

      return '<div class="code-card ' + extraClass + '" id="card-' + code.code + '">' +
        '<div class="code-top">' +
          '<div class="status-icon">' + icon + '</div>' +
          '<div class="code-name">' + escapeHtml(code.code) + '</div>' +
        '</div>' +
        (code.rewards ? '<div class="code-rewards">' + escapeHtml(code.rewards) + '</div>' : '') +
        '<div class="code-message"></div>' +
        msg +
        '<div class="delay-bar"></div>' +
      '</div>';
    }

    function showFooter() {
      updateFooterStats();
      document.getElementById('footer').style.display = '';
    }

    function updateFooterStats() {
      var el = document.getElementById('stat-success');
      el.textContent = '\\u2705 ' + stats.success + ' redeemed';
      var errEl = document.getElementById('stat-error');
      if (stats.errors > 0) {
        errEl.textContent = '\\u274C ' + stats.errors + ' failed';
      } else {
        errEl.textContent = '';
      }
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
}
