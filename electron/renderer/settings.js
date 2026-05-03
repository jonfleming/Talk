document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settings-form');
  const hotkeyInput = document.getElementById('hotkey');
  const setHotkeyBtn = document.getElementById('set-hotkey');

  // Load current config
  const config = await window.talkApi.getConfig();
  form.model.value = config.model;
  form.hotkey.value = config.hotkey;
  form.injectionMode.value = config.injectionMode;
  form.language.value = config.language;

  // Hotkey capture
  let capturing = false;
  setHotkeyBtn.addEventListener('click', () => {
    if (capturing) {
      capturing = false;
      setHotkeyBtn.textContent = 'Set Hotkey';
      hotkeyInput.style.backgroundColor = '';
    } else {
      capturing = true;
      setHotkeyBtn.textContent = 'Cancel';
      hotkeyInput.style.backgroundColor = '#ffff99';
      hotkeyInput.value = 'Press keys...';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!capturing) return;
    e.preventDefault();
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    if (e.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      parts.push(e.key.toUpperCase());
    }
    // Require at least one modifier
    if (parts.length > 1) {
      hotkeyInput.value = parts.join('+');
      capturing = false;
      setHotkeyBtn.textContent = 'Set Hotkey';
      hotkeyInput.style.backgroundColor = '';
    }
  });

  // Save
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = {
      model: form.model.value,
      hotkey: form.hotkey.value,
      injectionMode: form.injectionMode.value,
      language: form.language.value,
    };
    await window.talkApi.setConfig(patch);
  });
});