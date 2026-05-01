const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage, Notification, clipboard } = require('electron');
const WebSocket = require('ws');
const config = require('./config');

const DAEMON_HOST = '127.0.0.1';
const DEFAULT_DAEMON_PORT = 8765;
const DAEMON_CONNECT_TIMEOUT_MS = 30000;

let cfg = config.load();

let tray = null;
let historyWindow = null;
let daemonProcess = null;
let socket = null;
let socketOpen = false;
let requestSequence = 0;
const pendingRequests = new Map();
let currentState = { recording: false, model: 'small.en', language: 'en', connected: false, startupError: null };
let daemonFailure = null;
let daemonReadyPromise = null;
let resolveDaemonReady = null;
let daemonPort = DEFAULT_DAEMON_PORT;

function daemonUrl() {
  return `ws://${DAEMON_HOST}:${daemonPort}`;
}

function resetDaemonReadyPromise() {
  daemonReadyPromise = new Promise((resolve) => {
    resolveDaemonReady = resolve;
  });
}

resetDaemonReadyPromise();

// ---------------------------------------------------------------------------
// Tray icon: pure-JS PNG encoder (no native deps, works on all Electron targets)
// ---------------------------------------------------------------------------
const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function _crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = _crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(_crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function _encodePNG(rgba, w, h) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rows = [];
  for (let y = 0; y < h; y++) {
    rows.push(0);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rows.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(rows), { level: 6 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    _pngChunk('IHDR', ihdr),
    _pngChunk('IDAT', compressed),
    _pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeTrayIcon(recording) {
  const size = 16;
  const rgba = new Uint8Array(size * size * 4); // fully transparent by default
  const [r, g, b] = recording ? [239, 68, 68] : [243, 244, 246];

  function px(x, y) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
  }

  // Mic body
  for (let x = 6; x <= 9; x++) px(x, 2);           // top cap
  for (let y = 3; y <= 6; y++) for (let x = 5; x <= 10; x++) px(x, y); // body
  for (let x = 6; x <= 9; x++) px(x, 7);           // bottom cap
  // Arc
  px(4, 8); px(11, 8);                              // arc sides
  for (let x = 4; x <= 11; x++) px(x, 9);          // arc bottom
  // Stem
  px(7, 10); px(8, 10); px(7, 11); px(8, 11);
  // Base
  for (let x = 5; x <= 10; x++) px(x, 12);

  return nativeImage.createFromBuffer(_encodePNG(rgba, size, size));
}

function createTray() {
  tray = new Tray(makeTrayIcon(false));
  tray.setToolTip('Flow');
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const menu = Menu.buildFromTemplate([
    { label: currentState.recording ? 'Stop Dictation' : 'Start Dictation', click: toggleDictation },
    { label: 'History', click: openHistoryWindow },
    { type: 'separator' },
    { label: currentState.connected ? 'Daemon: connected' : 'Daemon: starting', enabled: false },
    { label: `Hotkey: ${cfg.hotkey}`, enabled: false },
    { label: `Model: ${currentState.model}`, enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function broadcastState() {
  if (tray) {
    tray.setImage(makeTrayIcon(currentState.recording));
  }
  refreshTrayMenu();
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('state:changed', currentState);
  });
}

function openHistoryWindow() {
  if (historyWindow) {
    historyWindow.show();
    historyWindow.focus();
    return;
  }

  historyWindow = new BrowserWindow({
    width: 920,
    height: 680,
    title: 'Flow History',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  historyWindow.on('closed', () => {
    historyWindow = null;
  });

  historyWindow.loadFile(path.join(__dirname, 'renderer', 'history.html'));
}

function startDaemon() {
  daemonFailure = null;
  const appPath = app.getAppPath();
  const localPython = path.join(appPath, '.venv', 'Scripts', 'python.exe');
  const pythonCommand = process.env.FLOW_PYTHON_PATH || (fs.existsSync(localPython) ? localPython : 'python');

  daemonProcess = spawn(pythonCommand, ['-m', 'flow_daemon.server'], {
    cwd: app.getAppPath(),
    stdio: 'pipe',
    windowsHide: true,
    env: {
      ...process.env,
      FLOW_DAEMON_PORT: String(daemonPort),
    },
  });

  daemonProcess.stdout.on('data', (chunk) => {
    console.log(chunk.toString().trim());
  });

  daemonProcess.stderr.on('data', (chunk) => {
    console.error(chunk.toString().trim());
  });

  daemonProcess.on('error', (error) => {
    console.error(`Failed to start daemon: ${error.message}`);
    daemonFailure = new Error(`Failed to start Flow daemon: ${error.message}`);
    currentState = { ...currentState, connected: false, startupError: daemonFailure.message };
    broadcastState();
  });

  daemonProcess.on('exit', (code) => {
    console.error(`Daemon exited with code ${code ?? 'unknown'}`);
    daemonProcess = null;
    socketOpen = false;
    daemonFailure = new Error(`Flow daemon exited with code ${code ?? 'unknown'}. Check the terminal for the startup error.`);
    currentState = { ...currentState, connected: false, startupError: daemonFailure.message };
    broadcastState();
  });
}

function connectSocket(retryCount = 0) {
  socket = new WebSocket(daemonUrl());

  socket.on('open', () => {
    socketOpen = true;
    currentState = { ...currentState, connected: true, startupError: null };
    broadcastState();
    if (resolveDaemonReady) {
      resolveDaemonReady();
      resolveDaemonReady = null;
    }
    sendCommand('state.get').catch(() => null);
  });

  socket.on('message', (buffer) => {
    const message = JSON.parse(buffer.toString());
    if (message.id) {
      const pending = pendingRequests.get(message.id);
      if (!pending) {
        return;
      }
      pendingRequests.delete(message.id);
      if (message.ok) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.error || 'Unknown daemon error'));
      }
      return;
    }

    if (message.event === 'state.changed') {
      currentState = { ...message.data, connected: true, startupError: null };
      broadcastState();
      return;
    }

    if (message.event === 'transcript.final') {
      handleTranscript(message.data).catch((error) => {
        console.error(error);
      });
    }
  });

  socket.on('close', () => {
    socketOpen = false;
    currentState = { ...currentState, connected: false };
    broadcastState();
    resetDaemonReadyPromise();
    if (retryCount < 20 && !app.isQuitting) {
      setTimeout(() => connectSocket(retryCount + 1), 300);
    }
  });

  socket.on('error', () => {
    socketOpen = false;
  });
}

async function waitForDaemonConnection(timeoutMs = DAEMON_CONNECT_TIMEOUT_MS) {
  if (socketOpen) {
    return;
  }

  if (daemonFailure) {
    throw daemonFailure;
  }

  await Promise.race([
    daemonReadyPromise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const seconds = Math.round(timeoutMs / 1000);
        reject(new Error(`Flow daemon did not connect within ${seconds} seconds. Check the terminal for startup errors.`));
      }, timeoutMs);
    }),
  ]);

  if (daemonFailure) {
    throw daemonFailure;
  }
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, DAEMON_HOST);
  });
}

async function findAvailablePort(startPort = DEFAULT_DAEMON_PORT, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    const candidate = startPort + index;
    // Reserve a nearby open port to reduce clashes with stale listeners.
    if (await checkPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No available daemon port found in range ${startPort}-${startPort + attempts - 1}.`);
}

async function sendCommand(command, payload = {}) {
  if (!socket || !socketOpen) {
    await waitForDaemonConnection();
  }

  const id = `req-${++requestSequence}`;
  socket.send(JSON.stringify({ id, command, payload }));
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
  });
}

async function sendCommandOrFallback(command, payload, fallbackValue) {
  try {
    return await sendCommand(command, payload);
  } catch {
    return fallbackValue;
  }
}

async function toggleDictation() {
  try {
    await sendCommand('dictation.toggle');
  } catch (error) {
    new Notification({
      title: 'Flow',
      body: error.message,
    }).show();
  }
}

async function handleTranscript(transcript) {
  const injected = await injectText(transcript.text);
  if (transcript.utteranceId) {
    await sendCommand('history.mark_injected', {
      utteranceId: transcript.utteranceId,
      injected,
    }).catch(() => null);
  }

  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('transcript:final', { ...transcript, injected });
  });

  const body = injected ? transcript.text : 'Transcript copied to clipboard. AutoHotkey injection not available.';
  new Notification({ title: 'Flow', body }).show();
}

async function injectText(text) {
  const ahkPath = process.env.FLOW_AHK_PATH || 'AutoHotkey.exe';
  const scriptPath = path.join(app.getAppPath(), 'scripts', 'inject.ahk');

  if (!fs.existsSync(scriptPath)) {
    clipboard.writeText(text);
    return false;
  }

  return new Promise((resolve) => {
    const child = spawn(ahkPath, [scriptPath, text], {
      cwd: app.getAppPath(),
      windowsHide: true,
    });

    child.on('error', () => {
      clipboard.writeText(text);
      resolve(false);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(true);
        return;
      }
      clipboard.writeText(text);
      resolve(false);
    });
  });
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const ok = globalShortcut.register(cfg.hotkey, () => {
    toggleDictation().catch(() => null);
  });
  if (!ok) {
    console.error(`Failed to register hotkey: ${cfg.hotkey}`);
  }
}

function setupIpc() {
  ipcMain.handle('history:list', async (_event, { limit }) => {
    const response = await sendCommandOrFallback('history.list', { limit }, { items: [] });
    return response.items;
  });

  ipcMain.handle('state:get', async () => {
    currentState = await sendCommandOrFallback('state.get', {}, currentState);
    refreshTrayMenu();
    return currentState;
  });

  ipcMain.handle('dictation:toggle', async () => sendCommand('dictation.toggle'));

  ipcMain.handle('config:get', () => cfg);

  ipcMain.handle('config:set', (_event, patch) => {
    cfg = config.save(patch);
    if (patch.hotkey) {
      registerHotkeys();
      refreshTrayMenu();
    }
    return cfg;
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  if (socket) {
    socket.close();
  }
  if (daemonProcess) {
    daemonProcess.kill();
  }
});

app.whenReady().then(async () => {
  daemonPort = await findAvailablePort();
  startDaemon();
  createTray();
  setupIpc();
  registerHotkeys();
  openHistoryWindow();
  connectSocket();
});
