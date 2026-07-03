# Talk

Lightweight Windows dictation app scaffold built around Electron, a local Python faster-whisper daemon, and AutoHotkey text injection.

## What is in the scaffold

- Electron tray app with a global toggle hotkey
- Python WebSocket daemon that records microphone audio and transcribes locally
- SQLite-backed transcript history stored in `%APPDATA%\talk\talk.db`
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
- AutoHotkey v2 available as `AutoHotkey.exe` on `PATH`, or set `TALK_AHK_PATH`

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
uv run python -m talk_daemon.server
```

## Building for development

To build the app locally (no installer):

```powershell
npm run build
```

This produces an unpacked Electron app in `dist/` suitable for local testing.

## Packaging for distribution

To build a Windows installer:

```powershell
npm run dist
```

This creates `dist/Talk Setup 0.1.9.exe`, a Windows NSIS installer that includes all necessary files.

## Deployment

Copy `dist/Talk Setup 0.1.x.exe` to the target machine and run it. The installer will:

1. Install Talk to `C:\Users\<username>\AppData\Local\Programs\talk-desktop`
2. Create a Start Menu entry and desktop shortcut
3. Register the global hotkey (`Ctrl+Alt+D` by default)

After installation, the user must install Python dependencies in the installation directory:

```powershell
cd "C:\Users\<username>\AppData\Local\Programs\talk-desktop"
uv sync
```

Then launch from the Start Menu or desktop shortcut.

## Installation on another machine

1. Install the prerequisites:
   - Python 3.10+ (with `pip`)
   - Node.js (for running the installer, if needed)
   - AutoHotkey v2

2. Run the installer `Talk Setup 0.1.x.exe`

3. In the installation directory (default: `C:\Users\<username>\AppData\Local\Programs\talk-desktop`), install Python dependencies:

   ```powershell
   uv sync
   ```

4. Launch the app from the Start Menu or desktop shortcut.

The app will create its database at `%APPDATA%\talk\talk.db` and config at `%APPDATA%\talk\config.json`.

## Useful environment variables

- `TALK_MODEL`: Whisper model name, defaults to `small.en`
- `TALK_LANGUAGE`: Language hint, defaults to `en`
- `TALK_AHK_PATH`: Absolute path to `AutoHotkey.exe` if it is not on `PATH`

## Suggested next improvements

- Add settings UI for model, hotkey, and injection mode ✅
- Save focused app metadata with each utterance
- Stream partial transcripts while recording
- Add real VAD segmentation instead of whole-utterance transcription on stop
