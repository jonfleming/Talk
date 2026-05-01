# Flow

Lightweight Windows dictation app scaffold built around Electron, a local Python faster-whisper daemon, and AutoHotkey text injection.

## What is in the scaffold

- Electron tray app with a global toggle hotkey
- Python WebSocket daemon that records microphone audio and transcribes locally
- SQLite-backed transcript history stored in `.flow/history.db`
- AutoHotkey v2 injection bridge that pastes text into the active window

## Current MVP behavior

- Press `Ctrl+Alt=D` to start recording
- Press `Ctrl+Alt=D` again to stop recording and transcribe
- Final transcript is injected into the active window when AutoHotkey is available
- Every utterance is stored and browsable in the history window

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

## Useful environment variables

- `FLOW_MODEL`: Whisper model name, defaults to `small.en`
- `FLOW_LANGUAGE`: Language hint, defaults to `en`
- `FLOW_AHK_PATH`: Absolute path to `AutoHotkey.exe` if it is not on `PATH`

## Suggested next improvements

- Stream partial transcripts while recording
- Add real VAD segmentation instead of whole-utterance transcription on stop
- Save focused app metadata with each utterance
- Add settings UI for model, hotkey, and injection mode
