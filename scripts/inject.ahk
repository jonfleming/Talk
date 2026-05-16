#Requires AutoHotkey v2.0

OutputLine(text)
{
  OutputDebug(text "`n")
}

Output(text)
{
  OutputDebug(text)
}

Log(text)
{
    OutputLine FormatTime(,"hh:mm:ss") ": " text
}

text := A_Args.Length ? A_Args[1] : ""
if (text = "") {
    ExitApp 1
}

originalClipboard := ClipboardAll()
injected := false
try {
    A_Clipboard := text
  if ClipWait(0.5, 1) {
    Send "^v"
    injected := true
  }
} catch {
}

if !injected {
  try {
    SendText text
    injected := true
  } catch {
  }
}

Sleep 100
try {
  A_Clipboard := originalClipboard
} catch {
}

ExitApp injected ? 0 : 2
