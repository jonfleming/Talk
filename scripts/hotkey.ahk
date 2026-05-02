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

ReadConfig()
{
    configPath := A_AppData . "\flow\config.json"
    if !FileExist(configPath)
        return "Ctrl+Alt+D"  ; default
    try
    {
        content := FileRead(configPath)
        ; Simple JSON parsing for "hotkey": "value"
        pos := InStr(content, '"hotkey"')
        if !pos
            return "Ctrl+Alt+D"
        pos := InStr(content, ':', , pos)
        pos := InStr(content, '"', , pos)
        endPos := InStr(content, '"', , pos + 1)
        hotkey := SubStr(content, pos + 1, endPos - pos - 1)
        return hotkey
    }
    catch
    {
        return "Ctrl+Alt+D"
    }
}

ConvertHotkey(humanHotkey)
{
    parts := StrSplit(humanHotkey, "+")
    result := ""
    for part in parts
    {
        part := Trim(part)
        if (part = "Ctrl")
            result .= "^"
        else if (part = "Alt")
            result .= "!"
        else if (part = "Shift")
            result .= "+"
        else if (part = "Meta")
            result .= "#"
        else
            result .= StrLower(part)
    }
    return result
}

Browser_Search:: ; Send configured hotkey
{
    Log "AHK: Browser Search hotkey pressed"
    configHotkey := ReadConfig()
    ahkHotkey := ConvertHotkey(configHotkey)
    Log "AHK: " . configHotkey " converted to " . ahkHotkey
    Send ahkHotkey
}