!macro customInstall
  nsExec::ExecToLog "cmd /c cd /d $\"$INSTDIR$\" && uv sync"
!macroend