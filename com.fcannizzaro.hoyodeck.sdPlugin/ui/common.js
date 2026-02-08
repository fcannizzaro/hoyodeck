/**
 * Stream Deck Property Inspector utilities
 */

// WebSocket connection
let websocket = null;
let uuid = null;
let actionInfo = null;
let settings = {};
let globalSettings = {};

/**
 * Connect to Stream Deck
 */
function connectElgatoStreamDeckSocket(
  inPort,
  inPropertyInspectorUUID,
  inRegisterEvent,
  inInfo,
  inActionInfo
) {
  uuid = inPropertyInspectorUUID;
  actionInfo = JSON.parse(inActionInfo);
  settings = actionInfo.payload.settings || {};

  websocket = new WebSocket('ws://127.0.0.1:' + inPort);

  websocket.onopen = function () {
    // Register the property inspector
    const json = {
      event: inRegisterEvent,
      uuid: uuid,
    };
    websocket.send(JSON.stringify(json));

    // Request global settings
    requestGlobalSettings();

    // Notify that we're connected
    if (typeof onConnected === 'function') {
      onConnected();
    }
  };

  websocket.onmessage = function (evt) {
    const data = JSON.parse(evt.data);

    switch (data.event) {
      case 'didReceiveSettings':
        settings = data.payload.settings || {};
        if (typeof onSettingsReceived === 'function') {
          onSettingsReceived(settings);
        }
        break;

      case 'didReceiveGlobalSettings':
        globalSettings = data.payload.settings || {};
        if (typeof onGlobalSettingsReceived === 'function') {
          onGlobalSettingsReceived(globalSettings);
        }
        break;
    }
  };
}

/**
 * Request global settings from Stream Deck
 */
function requestGlobalSettings() {
  if (websocket) {
    const json = {
      event: 'getGlobalSettings',
      context: uuid,
    };
    websocket.send(JSON.stringify(json));
  }
}

/**
 * Save action settings
 */
function saveSettings(payload) {
  if (websocket) {
    settings = { ...settings, ...payload };
    const json = {
      event: 'setSettings',
      context: uuid,
      payload: settings,
    };
    websocket.send(JSON.stringify(json));
  }
}

/**
 * Save global settings
 */
function saveGlobalSettings(payload) {
  if (websocket) {
    globalSettings = { ...globalSettings, ...payload };
    const json = {
      event: 'setGlobalSettings',
      context: uuid,
      payload: globalSettings,
    };
    websocket.send(JSON.stringify(json));
  }
}

/**
 * Parse cookies from a cookie string
 */
function parseCookies(cookieString) {
  const cookies = {};
  const pairs = cookieString.split(';').map((s) => s.trim());

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;

    const key = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1);

    cookies[key] = value;
  }

  return cookies;
}

/**
 * Extract V2 auth tokens from cookies
 */
function extractAuthFromCookies(cookieString) {
  const cookies = parseCookies(cookieString);

  const auth = {};

  if (cookies.ltoken_v2) auth.ltoken_v2 = cookies.ltoken_v2;
  if (cookies.ltuid_v2) auth.ltuid_v2 = cookies.ltuid_v2;
  if (cookies.ltmid_v2) auth.ltmid_v2 = cookies.ltmid_v2;
  if (cookies.cookie_token_v2) auth.cookie_token_v2 = cookies.cookie_token_v2;
  if (cookies.account_mid_v2) auth.account_mid_v2 = cookies.account_mid_v2;
  if (cookies.account_id_v2) auth.account_id_v2 = cookies.account_id_v2;

  return auth;
}

/**
 * Validate auth has required fields
 */
function isValidAuth(auth) {
  return auth && auth.ltoken_v2 && auth.ltuid_v2 && auth.ltmid_v2;
}
