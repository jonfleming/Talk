const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const recordingState = document.getElementById('recordingState');
const modelName = document.getElementById('modelName');
const languageName = document.getElementById('languageName');
const toggleButton = document.getElementById('toggleButton');
const refreshButton = document.getElementById('refreshButton');
const hotkeyDisplay = document.getElementById('hotkeyDisplay');
const liveTranscriptSection = document.getElementById('liveTranscriptSection');
const liveTranscriptText = document.getElementById('liveTranscriptText');
const menuButton = document.getElementById('menuButton');
const dropdownMenu = document.getElementById('dropdownMenu');
const startDictationMenu = document.getElementById('startDictationMenu');
const settingsMenu = document.getElementById('settingsMenu');
const quitMenu = document.getElementById('quitMenu');

let currentState = null;



async function refresh() {
  try {
    const [state, items, config] = await Promise.all([
      window.flowApi.getState().catch(() => ({ recording: false, model: 'small.en', language: 'en', connected: false })),
      window.flowApi.listHistory(100).catch(() => []),
      window.flowApi.getConfig().catch(() => ({ hotkey: 'Ctrl+Alt+D', model: 'small.en', language: 'en', injectionMode: 'autohotkey' })),
    ]);
    if (state.connected === false) {
      emptyState.textContent = 'Connecting to daemon...';
      emptyState.hidden = false;
    } else if (items.length === 0) {
      emptyState.textContent = 'No transcripts yet. Record a short utterance to populate history.';
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
    }
    renderItems(items);
    renderState(state);
    renderConfig(config);
    currentState = state;
  } catch (error) {
    console.error('Error refreshing history:', error);
    // Fallback: try to get config at least
    try {
      const config = await window.flowApi.getConfig().catch(() => ({ hotkey: 'Ctrl+Alt+D', model: 'small.en', language: 'en', injectionMode: 'autohotkey' }));
      renderConfig(config);
    } catch (e) {
      console.error('Error loading config:', e);
    }
    // Show specific error if daemon is not connected
    if (error.message && error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
      emptyState.hidden = false;
      emptyState.textContent = 'Daemon not connected. Please wait a moment and try again.';
    } else {
      emptyState.hidden = false;
      emptyState.textContent = 'Error loading history. Click refresh to try again.';
    }
  }
}

function renderConfig(config) {
  console.log('Config loaded:', config);
  if (config && config.hotkey) {
    hotkeyDisplay.textContent = config.hotkey;
  }
}

function renderState(state) {
  recordingState.textContent = state.recording ? 'Recording' : 'Idle';
  modelName.textContent = state.model;
  languageName.textContent = state.language;
  toggleButton.textContent = state.recording ? 'Stop Dictation' : 'Start Dictation';
  liveTranscriptSection.hidden = !state.recording;
  if (!state.recording) {
    liveTranscriptText.textContent = '';
  }
}

function renderItems(items) {
  historyList.innerHTML = '';
  // emptyState.hidden is handled in refresh

  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'entry';

    const meta = document.createElement('div');
    meta.className = 'entryMeta';
    meta.innerHTML = [
      `<span>${new Date(item.created_at).toLocaleString()}</span>`,
      `<span>${item.duration_ms} ms</span>`,
      `<span>${item.latency_ms} ms latency</span>`,
      `<span>${item.model_name}</span>`,
      `<span>${item.injected ? 'Injected' : 'Not injected'}</span>`,
    ].join('');

    const text = document.createElement('p');
    text.className = 'entryText';
    text.textContent = item.text;

    article.append(meta, text);
    historyList.append(article);
  }
}

toggleButton.addEventListener('click', async () => {
  await window.flowApi.toggleDictation();
});

refreshButton.addEventListener('click', refresh);

menuButton.addEventListener('click', (event) => {
  event.stopPropagation();
  dropdownMenu.hidden = !dropdownMenu.hidden;
});

startDictationMenu.addEventListener('click', async (event) => {
  event.stopPropagation();
  await window.flowApi.toggleDictation();
  dropdownMenu.hidden = true;
});

settingsMenu.addEventListener('click', async (event) => {
  event.stopPropagation();
  await window.flowApi.openSettings();
  dropdownMenu.hidden = true;
});

quitMenu.addEventListener('click', async (event) => {
  event.stopPropagation();
  await window.flowApi.quitApp();
});

// Close menu when clicking outside
document.addEventListener('click', (event) => {
  if (!menuButton.contains(event.target) && !dropdownMenu.contains(event.target)) {
    dropdownMenu.hidden = true;
  }
});

window.flowApi.onState((newState) => {
  renderState(newState);
  if (newState.connected && (!currentState || !currentState.connected)) {
    refresh();
  }
  currentState = newState;
});
window.flowApi.onTranscript(() => refresh());
window.flowApi.onPartialTranscript((data) => {
  liveTranscriptText.textContent = data.text;
});

// Load config immediately on startup
window.flowApi.getConfig().then(config => {
  renderConfig(config);
  // Now load history after config is loaded
  refresh();
}).catch(error => {
  console.error('Error loading initial config:', error);
  // Fallback to defaults if API call fails
  renderConfig({ hotkey: 'Ctrl+Alt+D', model: 'small.en', language: 'en', injectionMode: 'autohotkey' });
  // Still try to refresh to get history
  refresh().catch(err => console.error('Error initial refresh:', err));
});
