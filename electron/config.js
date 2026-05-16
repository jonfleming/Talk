const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

const DEFAULTS = {
  hotkey: 'Ctrl+Alt+D',
  model: 'small.en',
  language: 'en',
  daemonHost: '127.0.0.1',
  injectionMode: 'autohotkey',
  notificationsEnabled: true,
};

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(values) {
  const merged = { ...load(), ...values };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

module.exports = { load, save, configPath, DEFAULTS };
