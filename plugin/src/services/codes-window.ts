import streamDeck from "@elgato/streamdeck";
import type { GameId } from "@hoyodeck/shared/types";
import { GAME_LABELS_EXTENDED } from "@hoyodeck/shared/games";

const REDEMPTION_PAGES: Record<GameId, string> = {
  gi: "https://genshin.hoyoverse.com/en/gift",
  hsr: "https://hsr.hoyoverse.com/gift",
  zzz: "https://zenless.hoyoverse.com/redemption",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** A public code list. Redemption uses the user's browser session only. */
export async function showCodesWindow(game: GameId, codes: string[]): Promise<void> {
  const { NativeWindow, ensureRuntime, loadHtmlOrigin } = await import("@nativewindow/webview");
  ensureRuntime();
  const title = `${GAME_LABELS_EXTENDED[game]} codes`;
  const links = codes.map((code) => {
    const url = new URL(REDEMPTION_PAGES[game]);
    url.searchParams.set("code", code);
    return url.href;
  });
  const origin = loadHtmlOrigin();
  const win = new NativeWindow({
    title,
    width: 520,
    height: 640,
    resizable: true,
    allowedHosts: ["localhost"],
    trustedOrigins: [origin],
  });
  let closed = false;
  win.onClose(() => {
    closed = true;
  });
  win.onMessage((message, sourceUrl) => {
    if (sourceUrl !== origin && !sourceUrl.startsWith(`${origin}/`)) return;
    if (closed) return;
    if (message === "close") {
      closed = true;
      // Hide first so the last window disappears before the native event pump stops.
      win.hide();
      win.close();
      return;
    }
    const index = links.indexOf(message);
    if (index === -1) return;
    void streamDeck.system.openUrl(message).then(
      () => {
        if (!closed) win.evaluateJs(`markRedeemed(${index})`);
      },
      (error) => {
        streamDeck.logger.error("[CodesWindow] Failed to open redemption page:", error);
        if (!closed) win.evaluateJs("document.getElementById('error').hidden = false");
      },
    );
  });
  win.loadHtml(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; font: 14px system-ui, sans-serif; background: #2d2d2d; color: #ddd; }
  body { margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { line-height: 1.5; color: #bbb; }
  ul { list-style: none; padding: 0; margin: 24px 0; }
  li { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid #505050; }
  code { flex: 1; min-width: 0; overflow-wrap: anywhere; user-select: all; }
  a, button { color: #ddd; padding: 8px 12px; background: #414141; border-radius: 4px; text-decoration: none; }
  button { font: inherit; border: 0; cursor: pointer; }
  a:hover, button:hover { background: #505050; }
  a:focus-visible, button:focus-visible { outline: 2px solid #ddd; outline-offset: 3px; }
  li.redeemed code { text-decoration: line-through; color: #bbb; }
  .redeemed span { padding: 8px 12px; color: #bbb; }
  #error { color: #ffaaaa; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>Choose Redeem to open the official website in your browser. Sign in, select your character, and confirm redemption there. You can also select and copy a code to redeem in-game.</p>
<p>Choosing Redeem marks the code as redeemed in this list. Confirm redemption on the official website. Codes may have expired or already been claimed.</p>
<p id="error" role="alert" hidden>Could not open the browser. Copy the code and visit the game's official redemption website.</p>
${codes.length ? `<ul>${codes.map((code, i) => `<li data-code-index="${i}"><code>${escapeHtml(code)}</code><a href="${escapeHtml(links[i]!)}" aria-label="Redeem ${escapeHtml(code)}">Redeem</a></li>`).join("")}</ul>` : "<p>No codes are available right now. Close this window and press the key to check again.</p>"}
<button type="button" id="close">Close</button>
<script>
  function markRedeemed(index) {
    const row = document.querySelector('[data-code-index="' + index + '"]');
    const link = row.querySelector('a');
    if (!link) return;
    row.classList.add('redeemed');
    const status = document.createElement('span');
    status.textContent = 'Redeemed';
    link.replaceWith(status);
    row.parentElement.appendChild(row);
    document.getElementById('error').hidden = true;
  }
  document.getElementById('close').addEventListener('click', function() {
    window.ipc.postMessage('close');
  });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') window.ipc.postMessage('close');
  });
  document.addEventListener('click', function(event) {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    window.ipc.postMessage(link.href);
  });
</script></body></html>`);
}
