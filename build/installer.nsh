!macro customInstall
  ; Create default config.json in user data directory
  CreateDirectory "$APPDATA\talk"
  FileOpen $0 "$APPDATA\talk\config.json" w
  FileWrite $0 '{"hotkey": "F4", "model": "small.en", "language": "en"}'
  FileClose $0

  ; Run uv sync after installation to set up Python dependencies
  nsExec::ExecToLog "cmd /c cd /d $\"$INSTDIR$\" && uv sync"
!macroend