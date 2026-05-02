# Flow

Lightweight Windows dictation app scaffold built around Electron, a local Python faster-whisper daemon, and AutoHotkey text injection.

## What is in the scaffold

- Electron tray app with a global toggle hotkey
- Python WebSocket daemon that records microphone audio and transcribes locally
- SQLite-backed transcript history stored in `%APPDATA%\flow\flow.db`
- AutoHotkey v2 injection bridge that pastes text into the active window

## Current MVP behavior

- Press the configured hotkey (default: `Ctrl+Alt+D`) to start recording
- Press the hotkey again to stop recording and transcribe
- Final transcript is injected into the active window when AutoHotkey is available
- Every utterance is stored and browsable in the history window
- Settings can be accessed from the tray menu to configure model, hotkey, injection mode, and language

This scaffold is optimized for a fast local iteration loop. It does not yet implement streaming partial transcripts, advanced VAD tuning, or app-specific injection rules.

## Requirements

- Windows
- `uv`
- Node.js
- AutoHotkey v2 available as `AutoHotkey.exe` on `PATH`, or set `FLOW_AHK_PATH`

## Python setup

```powershell
uv sync
```

## Electron setup

```powershell
npm install
```

## Run the app

```powershell
npm start
```

The Electron process will launch the Python daemon with:

```powershell
uv run python -m flow_daemon.server
```

## Packaging for distribution

To build a Windows installer:

```powershell
npm run dist
```

This creates `dist/Flow Setup 0.1.0.exe`, a Windows NSIS installer that includes all necessary files.

## Installation on another machine

1. Install the prerequisites:
   - Python 3.10+ (with `pip`)
   - Node.js (for running the installer, if needed)
   - AutoHotkey v2

2. Run the installer `Flow Setup 0.1.x.exe`

3. In the installation directory (default: `C:\Users\<username>\AppData\Local\Programs\flow-desktop`), install Python dependencies:
4.  

   ```powershell
   uv sync
   ```

5. Launch the app from the Start Menu or desktop shortcut.

The app will create its database at `%APPDATA%\flow\flow.db` and config at `%APPDATA%\flow\config.json`.

## Useful environment variables

- `FLOW_MODEL`: Whisper model name, defaults to `small.en`
- `FLOW_LANGUAGE`: Language hint, defaults to `en`
- `FLOW_AHK_PATH`: Absolute path to `AutoHotkey.exe` if it is not on `PATH`

## Suggested next improvements

- Add settings UI for model, hotkey, and injection mode ✅
- Save focused app metadata with each utterance
- Stream partial transcripts while recording
- Add real VAD segmentation instead of whole-utterance transcription on stop
