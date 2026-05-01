const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const recordingState = document.getElementById('recordingState');
const modelName = document.getElementById('modelName');
const languageName = document.getElementById('languageName');
const toggleButton = document.getElementById('toggleButton');
const refreshButton = document.getElementById('refreshButton');

async function refresh() {
  const [state, items] = await Promise.all([
    window.flowApi.getState(),
    window.flowApi.listHistory(100),
  ]);
  renderState(state);
  renderItems(items);
}

function renderState(state) {
  recordingState.textContent = state.recording ? 'Recording' : 'Idle';
  modelName.textContent = state.model;
  languageName.textContent = state.language;
  toggleButton.textContent = state.recording ? 'Stop Dictation' : 'Start Dictation';
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

refresh().catch((error) => {
  emptyState.hidden = false;
  emptyState.textContent = error.message;
});
