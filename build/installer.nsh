!macro customInstall
  ; Create default config.json in user data directory if it doesn't exist
  CreateDirectory "$APPDATA\talk"
  IfFileExists "$APPDATA\talk\config.json" config_exists
    FileOpen $0 "$APPDATA\talk\config.json" w
    FileWrite $0 '{"hotkey": "F4", "model": "small.en", "language": "en"}'
    FileClose $0
  config_exists:

  ; Run uv sync in the unpacked app project directory so runtime uses the same environment
  nsExec::ExecToLog "cmd /c cd /d $\"$INSTDIR\resources\app.asar.unpacked$\" && uv sync"
!macroend