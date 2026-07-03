#Requires AutoHotkey v2.0
#SingleInstance Force


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
    configPath := A_AppData . "\talk\config.json"
    Log("AHK: Reading config from " . configPath)

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
    specialKeys := Map(
        "Space", "{Space}",
        "Tab", "{Tab}",
        "Capslock", "{Capslock}",
        "Numlock", "{Numlock}",
        "Scrolllock", "{Scrolllock}",
        "Backspace", "{BS}",
        "Del", "{Del}",
        "Delete", "{Del}",
        "Insert", "{Ins}",
        "Enter", "{Enter}",
        "Up", "{Up}",
        "Down", "{Down}",
        "Left", "{Left}",
        "Right", "{Right}",
        "End", "{End}",
        "PageUp", "{PageUp}",
        "PageDown", "{PageDown}",
        "Esc", "{Esc}",
        "VolumeUp", "{Volume_Up}",
        "VolumeDown", "{Volume_Down}",
        "VolumeMute", "{Volume_Mute}",
        "MediaNextTrack", "{Media_Next}",
        "MediaPreviousTrack", "{Media_Prev}",
        "MediaStop", "{Media_Stop}",
        "MediaPlayPause", "{Media_Play_Pause}",
        "PrintScreen", "{PrintScreen}"
    )
    
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
        else if (specialKeys.Has(part))
            result .= specialKeys[part]
        else if (RegExMatch(part, "^F(1[0-2]|[1-9])$"))
            result .= "{" . part . "}"
        else
            result .= StrLower(part)
    }
    return result
}

Browser_Home:: ; Send configured hotkey
{
    Log "AHK: hotkey pressed"
    configHotkey := ReadConfig()
    ahkHotkey := ConvertHotkey(configHotkey)
    Log "AHK: " . configHotkey " converted to " . ahkHotkey
    Send ahkHotkey
}