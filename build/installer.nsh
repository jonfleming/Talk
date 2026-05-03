!macro customInstall
  ; Create default config.json in user data directory
  CreateDirectory "$APPDATA\talk"
  FileOpen $0 "$APPDATA\talk\config.json" w
  FileWrite $0 '{"hotkey": "F4", "model": "small.en", "language": "en"}'
  FileClose $0

  ; Run uv sync in the unpacked app project directory so runtime uses the same environment
  nsExec::ExecToLog "cmd /c cd /d $\"$INSTDIR\resources\app.asar.unpacked$\" && uv sync"
!macroend