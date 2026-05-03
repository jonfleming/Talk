# Talk: Windows Dictation App Architecture

## Purpose

Talk is a lightweight, local Windows dictation application designed for fast, private speech-to-text transcription with minimal latency. It provides a global hotkey-based interface for recording audio, transcribing it locally using Whisper models, and injecting the text into the active window.

### Core Goals
- **Privacy**: All processing happens locally, no audio leaves the device
- **Speed**: Minimal latency from hotkey press to text injection
- **Reliability**: Robust error handling and recovery
- **Simplicity**: Clean tray-based interface with minimal UI
- **Configurability**: User-controlled model selection, hotkeys, and injection methods

## Architecture Overview

Talk follows a distributed architecture with clear separation of concerns:

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Electron      │◄──────────────►│   Python        │
│   Tray App      │                │   Daemon        │
│                 │                │                 │
│ • UI Management │                │ • Audio Recording│
│ • Settings      │                │ • Transcription │
│ • IPC           │                │ • Storage       │
│ • Hotkey Mgmt   │                │                 │
└─────────────────┘                └─────────────────┘
         │                                 │
         │                                 │
         ▼                                 ▼
┌─────────────────┐               ┌─────────────────┐
│   AutoHotkey    │               │   SQLite DB     │
│   Injection     │               │   History       │
└─────────────────┘               └─────────────────┘
```

### Component Responsibilities

#### Electron Tray App (`electron/`)
- **Main Process**: Application lifecycle, tray management, daemon spawning
- **Renderer Processes**: Settings window, history browser
- **IPC**: Communication between main and renderer processes
- **Global Hotkeys**: System-wide keyboard shortcuts
- **Daemon Management**: Spawning and monitoring the Python daemon

#### Python Daemon (`talk_daemon/`)
- **WebSocket Server**: Real-time communication with Electron
- **Audio Recording**: Microphone capture using sounddevice
- **Transcription**: Local Whisper model inference
- **Storage**: SQLite database for transcript history
- **State Management**: Recording state and session tracking

#### AutoHotkey Integration (`scripts/`)
- **Text Injection**: Cross-application text insertion
- **Fallback Mechanism**: Clipboard-based injection when AHK unavailable

## Design Decisions

### 1. Electron + Python Architecture

**Decision**: Separate Electron (UI) and Python (processing) into different processes

**Rationale**:
- **Performance**: Python's GIL doesn't block Electron's UI responsiveness
- **Isolation**: Audio processing failures don't crash the UI
- **Ecosystem**: Best tools for each domain (Electron for desktop UI, Python for ML)
- **Maintainability**: Clear separation of concerns

**Trade-offs**:
- **Complexity**: Inter-process communication adds overhead
- **Deployment**: Requires both Node.js and Python environments
- **Synchronization**: State must be kept consistent across processes

### 2. WebSocket Communication

**Decision**: WebSocket-based IPC between Electron and Python

**Rationale**:
- **Bidirectional**: Real-time state updates and commands
- **Standard**: Well-supported protocol with good libraries
- **Async**: Non-blocking communication
- **Debugging**: Easy to inspect with browser dev tools

**Alternatives Considered**:
- **HTTP REST**: Simpler but less real-time
- **Named Pipes**: Windows-specific, more complex
- **Shared Memory**: Higher performance but more error-prone

### 3. Local Whisper Models

**Decision**: Client-side transcription using faster-whisper

**Rationale**:
- **Privacy**: No audio data sent to external services
- **Offline**: Works without internet connectivity
- **Quality**: State-of-the-art transcription accuracy
- **Flexibility**: Multiple model sizes for performance/accuracy trade-off

**Trade-offs**:
- **Resources**: Requires significant CPU/GPU memory
- **Setup**: Model download and environment setup
- **Latency**: Initial model load time

### 4. Tray-Based Interface

**Decision**: Minimal tray icon interface over traditional windowed app

**Rationale**:
- **Always Available**: Persistent access without window management
- **Non-Intrusive**: Doesn't interfere with workflow
- **System Integration**: Follows Windows notification area patterns
- **Resource Efficient**: No unnecessary UI rendering

### 5. SQLite Storage

**Decision**: Local SQLite database for transcript history

**Rationale**:
- **Self-Contained**: No external database dependencies
- **Reliable**: ACID transactions, data integrity
- **Query Performance**: Efficient for historical data retrieval
- **Backup**: Single file for easy user backup/restore

### 6. AutoHotkey Integration

**Decision**: AutoHotkey for cross-application text injection

**Rationale**:
- **Reliability**: Proven technology for Windows automation
- **Compatibility**: Works across all Windows applications
- **Performance**: Fast, direct text insertion
- **Fallback**: Clipboard injection when AHK unavailable

**Alternatives Considered**:
- **Windows API**: More complex, potential compatibility issues
- **Accessibility API**: Limited application support

## Data Flow

### Recording Session
1. **Hotkey Press** → Electron registers global shortcut
2. **Toggle Command** → WebSocket message to Python daemon
3. **Audio Recording** → sounddevice captures microphone input
4. **Transcription** → faster-whisper processes audio to text
5. **Storage** → SQLite saves transcript with metadata
6. **Injection** → AutoHotkey inserts text into active window
7. **Notification** → System notification confirms completion

### State Synchronization
- **Real-time Updates**: WebSocket broadcasts state changes
- **UI Consistency**: All windows reflect current recording state
- **Error Propagation**: Failures communicated through notification system

## Communication Patterns

### WebSocket Protocol

**Client → Server Commands**:
```json
{
  "id": "req-123",
  "command": "dictation.toggle",
  "payload": {}
}
```

**Server → Client Events**:
```json
{
  "event": "state.changed",
  "data": {
    "recording": true,
    "model": "small.en",
    "language": "en"
  }
}
```

**Server Responses**:
```json
{
  "id": "req-123",
  "ok": true,
  "data": { ... }
}
```

### IPC Patterns

**Main ↔ Renderer**:
- **Settings**: `config:get/set` for persistent configuration
- **History**: `history:list` for transcript retrieval
- **State**: `state:get` for current daemon state

## Error Handling

### Daemon Failure Recovery
- **Automatic Restart**: Daemon process monitored and restarted on failure
- **Graceful Degradation**: UI remains functional during daemon issues
- **User Notification**: Clear error messages for troubleshooting

### Audio Device Issues
- **Device Detection**: Fallback when preferred device unavailable
- **Permission Handling**: Clear messaging for microphone access issues
- **Recording Validation**: Audio level monitoring and error detection

### Network/Port Conflicts
- **Port Selection**: Automatic port finding to avoid conflicts
- **Connection Retry**: Robust reconnection logic with backoff

## Performance Considerations

### Latency Optimization
- **Model Selection**: Trade-off between speed and accuracy
- **Audio Buffering**: Minimal latency audio processing
- **Injection Speed**: Direct text insertion vs clipboard fallback

### Resource Management
- **Memory**: Model caching and cleanup
- **CPU**: Background processing without UI blocking
- **Storage**: Efficient database queries and cleanup

### Startup Time
- **Lazy Loading**: Components initialized on demand
- **Caching**: Model and configuration persistence
- **Parallel Initialization**: Concurrent daemon and UI startup

## Security Considerations

### Local Processing
- **No Data Exfiltration**: All audio stays on device
- **No External Dependencies**: Self-contained processing
- **User Control**: Clear data storage and access patterns

### Permission Management
- **Microphone Access**: Explicit user permission required
- **File System**: Controlled access to user data directory
- **Network**: Local-only WebSocket communication

## Future Considerations

### Streaming Transcripts
- **Real-time Updates**: Partial transcript streaming during recording
- **UI Feedback**: Live transcription display
- **VAD Integration**: Voice activity detection for segmentation

### Advanced Features
- **Multi-language**: Dynamic language switching
- **Custom Models**: User-uploaded Whisper models
- **Integration APIs**: Plugin system for external tools

### Platform Expansion
- **Cross-platform**: macOS/Linux support
- **Mobile**: Companion mobile transcription
- **Cloud Sync**: Optional encrypted transcript synchronization

## Development Workflow

### Local Development
- **Hot Reload**: Electron development with live updates
- **Debugging**: Chrome DevTools for UI, Python debugger for daemon
- **Testing**: Unit tests for components, integration tests for IPC

### Deployment
- **Packaging**: Electron Builder for Windows installer
- **Dependencies**: Virtual environment bundling
- **Updates**: Auto-update mechanism for future versions

This architecture provides a solid foundation for a reliable, performant dictation application while maintaining clear separation of concerns and room for future enhancements.</content>
<parameter name="filePath">c:\Projects\talk\AGENTS.md