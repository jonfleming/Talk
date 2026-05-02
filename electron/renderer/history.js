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

// Initialize with defaults
renderConfig({ hotkey: 'Ctrl+Alt+D', model: 'small.en', language: 'en', injectionMode: 'autohotkey' });

async function refresh() {
  try {
    const [state, items, config] = await Promise.all([
      window.flowApi.getState().catch(() => ({ recording: false, model: 'small.en', language: 'en' })),
      window.flowApi.listHistory(100).catch(() => []),
      window.flowApi.getConfig().catch(() => ({ hotkey: 'Ctrl+Alt+D', model: 'small.en', language: 'en', injectionMode: 'autohotkey' })),
    ]);
    renderState(state);
    renderItems(items);
    renderConfig(config);
  } catch (error) {
    console.error('Error refreshing history:', error);
    // Fallback: try to get config at least
    try {
      const config = await window.flowApi.getConfig().catch(() => ({ hotkey: 'Ctrl+Alt+D', model: 'small.en', language: 'en', injectionMode: 'autohotkey' }));
      renderConfig(config);
    } catch (e) {
      console.error('Error loading config:', e);
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
  emptyState.hidden = items.length > 0;

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
window.flowApi.onState(renderState);
window.flowApi.onTranscript(() => refresh());
window.flowApi.onPartialTranscript((data) => {
  liveTranscriptText.textContent = data.text;
});

refresh().catch((error) => {
  emptyState.hidden = false;
  emptyState.textContent = error.message;
});
