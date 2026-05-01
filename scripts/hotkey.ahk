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

Browser_Search:: ; Send "^!d"
{
    Log "Browser Search hotkey pressed"
    Send "^!d"
}