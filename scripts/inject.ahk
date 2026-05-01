#Requires AutoHotkey v2.0

text := A_Args.Length ? A_Args[1] : ""
if (text = "") {
    ExitApp 1
}

originalClipboard := ClipboardAll()
try {
    A_Clipboard := text
    ClipWait 0.5
    Send "^v"
} catch {
    SendText text
}

Sleep 100
A_Clipboard := originalClipboard
ExitApp 0
