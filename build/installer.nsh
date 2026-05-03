!macro customInstall
  ; Run uv sync after installation to set up Python dependencies
  nsExec::ExecToLog "cmd /c cd /d $INSTDIR && uv sync"
!macroend</content>
<parameter name="filePath">c:\Projects\talk\build\installer.nsh