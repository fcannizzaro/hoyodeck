import { useCallback, useSyncExternalStore } from 'react';

// ─── Types ──────────────────────────────────────────────────────────

interface ActionInfo {
  action: string;
  context: string;
  device: string;
  payload: {
    settings: Record<string, unknown>;
    coordinates: { column: number; row: number };
  };
}

interface StreamDeckStore {
  connected: boolean;
  actionInfo: ActionInfo | null;
  settings: Record<string, unknown>;
  globalSettings: Record<string, unknown>;
}

// ─── Module-level singleton state ──────────────────────────────────

let ws: WebSocket | null = null;
let piUUID: string | null = null;
const listeners = new Set<() => void>();

let store: StreamDeckStore = {
  connected: false,
  actionInfo: null,
  settings: {},
  globalSettings: {},
};

function emitChange() {
  store = { ...store };
  listeners.forEach((l) => l());
}

function getSnapshot(): StreamDeckStore {
  return store;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── WebSocket send helper ─────────────────────────────────────────

function wsSend(event: string, payload?: Record<string, unknown>) {
  if (!ws || !piUUID) return;
  ws.send(JSON.stringify({ event, context: piUUID, ...payload }));
}

// ─── Register global function (called by Stream Deck SDK) ──────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as unknown as Record<string, unknown>).connectElgatoStreamDeckSocket = (
  port: string,
  uuid: string,
  registerEvent: string,
  _info: string,
  actionInfo: string,
) => {
  piUUID = uuid;

  const parsedActionInfo: ActionInfo = JSON.parse(actionInfo);
  store = {
    ...store,
    actionInfo: parsedActionInfo,
    settings: parsedActionInfo.payload.settings ?? {},
  };
  emitChange();

  ws = new WebSocket(`ws://127.0.0.1:${port}`);

  ws.onopen = () => {
    ws!.send(JSON.stringify({ event: registerEvent, uuid }));
    wsSend('getGlobalSettings');
    store = { ...store, connected: true };
    emitChange();
  };

  ws.onmessage = (evt) => {
    const data = JSON.parse(evt.data);

    switch (data.event) {
      case 'didReceiveSettings':
        store = { ...store, settings: data.payload.settings ?? {} };
        emitChange();
        break;
      case 'didReceiveGlobalSettings':
        store = { ...store, globalSettings: data.payload.settings ?? {} };
        emitChange();
        break;
    }
  };
};

// ─── React hook ────────────────────────────────────────────────────

export function useStreamDeck() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  const saveSettings = useCallback(
    (payload: Record<string, unknown>) => {
      const merged = { ...store.settings, ...payload };
      store = { ...store, settings: merged };
      emitChange();
      wsSend('setSettings', { payload: merged });
    },
    [],
  );

  const saveGlobalSettings = useCallback(
    (payload: Record<string, unknown>) => {
      const merged = { ...store.globalSettings, ...payload };
      store = { ...store, globalSettings: merged };
      emitChange();
      wsSend('setGlobalSettings', { payload: merged });
    },
    [],
  );

  const sendToPlugin = useCallback(
    (payload: Record<string, unknown>) => {
      wsSend('sendToPlugin', { payload });
    },
    [],
  );

  return {
    connected: state.connected,
    actionInfo: state.actionInfo,
    settings: state.settings,
    globalSettings: state.globalSettings,
    saveSettings,
    saveGlobalSettings,
    sendToPlugin,
  };
}
