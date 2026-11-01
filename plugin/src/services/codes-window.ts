import streamDeck from "@elgato/streamdeck";
import type { GameId } from "@hoyodeck/shared/types";
import { GAME_LABELS_EXTENDED } from "@hoyodeck/shared/games";
import { dataController } from "@/services/data-controller";

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
    alwaysOnTop: false,
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
    const index = links.findIndex((link, i) => message === link || message === `redeemed:${i}`);
    if (index === -1) return;
    const opening =
      message === links[index] ? streamDeck.system.openUrl(message) : Promise.resolve();
    void opening
      .then(async () => {
        const settings = dataController.getCachedGlobalSettings();
        if (!settings) throw new Error("Global settings are not available");
        const redeemed = settings.redeemedCodes?.[game] ?? [];
        await dataController.writeGlobalSettings({
          ...settings,
          redeemedCodes: {
            ...settings.redeemedCodes,
            [game]: [...new Set([...redeemed, codes[index]!])],
          },
        });
        if (!closed) win.evaluateJs(`markRedeemed(${index})`);
      })
      .catch((error) => {
        streamDeck.logger.error(
          "[CodesWindow] Failed to open redemption page or save redeemed code:",
          error,
        );
        if (!closed) win.evaluateJs("document.getElementById('error').hidden = false");
      });
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
  a, button { font: inherit; border: 0; cursor: pointer; color: #ddd; padding: 8px 12px; background: #414141; border-radius: 4px; text-decoration: none; }
  a:hover, button:hover { background: #505050; }
  a:focus-visible, button:focus-visible { outline: 2px solid #ddd; outline-offset: 3px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  @media (max-width: 440px) { li { flex-direction: column; align-items: flex-start; gap: 8px; } }
  li.redeemed code { text-decoration: line-through; color: #bbb; }
  .redeemed span { padding: 8px 12px; color: #bbb; }
  #error { color: #ffaaaa; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>Choose Redeem to open the official website in your browser. Sign in, select your character, and confirm redemption there. You can also select and copy a code to redeem in-game.</p>
<p>Choosing Redeem marks the code as redeemed in this list. Confirm redemption on the official website. Use Already redeemed for codes you have claimed before. Codes may have expired.</p>
<p id="error" role="alert" hidden>Could not open the browser or save the redeemed code. Please try again.</p>
${codes.length ? `<ul>${codes.map((code, i) => `<li data-code-index="${i}"><code>${escapeHtml(code)}</code><div class="actions"><a href="${escapeHtml(links[i]!)}" aria-label="Redeem ${escapeHtml(code)}">Redeem</a><button type="button" data-redeemed-index="${i}" aria-label="Mark ${escapeHtml(code)} as already redeemed">Already redeemed</button></div></li>`).join("")}</ul>` : "<p>No codes are available right now. Close this window and press the key to check again.</p>"}
<script>
  function markRedeemed(index) {
    const row = document.querySelector('[data-code-index="' + index + '"]');
    const link = row.querySelector('a');
    if (!link) return;
    row.classList.add('redeemed');
    const status = document.createElement('span');
    status.textContent = 'Redeemed';
    row.querySelector('.actions').replaceWith(status);
    row.parentElement.appendChild(row);
    document.getElementById('error').hidden = true;
  }
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') window.ipc.postMessage('close');
  });
  document.addEventListener('click', function(event) {
    const control = event.target.closest('a, button');
    if (!control) return;
    event.preventDefault();
    window.ipc.postMessage(control.tagName === 'A' ? control.href : 'redeemed:' + control.dataset.redeemedIndex);
  });
</script></body></html>`);
}
