const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chord-quest-test-'));
  try {
    for (const phase of ['play', 'reopen']) {
      const result = spawnSync(require('electron'), [__filename, profile, phase], {
        stdio: 'inherit', timeout: 45000, windowsHide: true,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, `Desktop ${phase} check failed`);
    }
    console.log('Desktop checks passed; both app instances exited.');
  } finally {
    assert.equal(path.dirname(profile), os.tmpdir());
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }
} else {
  const { app, session } = require('electron');
  app.setPath('userData', process.argv[2]);
  const phase = process.argv[3];
  const timeout = setTimeout(() => { console.error('Desktop check timed out'); app.exit(1); }, 30000);
  app.once('browser-window-created', (_, window) => {
    window.webContents.once('did-finish-load', async () => {
      try {
        const result = await window.webContents.executeJavaScript(`(async () => {
          const check = (ok, message) => { if (!ok) throw new Error(message); };
          const $ = id => document.getElementById(id);
          check(isSecureContext, 'MIDI requires a secure context');
          check(typeof require === 'undefined' && typeof process === 'undefined', 'Renderer must not expose Node');
          check(document.querySelectorAll('[data-key]').length === 12, 'All 12 keys must load');
          if (${JSON.stringify(phase)} === 'reopen') {
            const saved = JSON.parse(localStorage.getItem('chord-quest-v1'));
            check(saved.xp === 5 && saved.selectedKey === 7, 'Progress must survive a full app restart');
            check($('world-name').textContent === 'G major path', 'Saved key must be restored');
            return 'Saved progress restored';
          }
          check((await fetch('/desktop.cjs')).status === 404, 'Main-process files must not be served');
          check((await navigator.permissions.query({ name: 'microphone' })).state === 'denied', 'Unneeded permissions must be denied');
          const midi = await navigator.requestMIDIAccess({ sysex: false });
          check(midi.sysexEnabled === false, 'Game MIDI access must not enable SysEx');
          $('continue').click();
          check($('chord-name').textContent === 'C major', 'First lesson must load');
          for (const note of [60, 64, 67]) document.querySelector('[data-note="' + note + '"]').click();
          $('check').click();
          check($('feedback').textContent.includes('Correct'), 'C major must be accepted');
          check($('audio-status').textContent === 'Audio ready', 'Audio must start');
          $('exit').click();
          document.querySelector('[data-key="7"]').click();
          return { midiInputs: [...midi.inputs.values()].map(input => input.name), xp: JSON.parse(localStorage.getItem('chord-quest-v1')).xp };
        })().catch(error => { throw new Error(error.name + ': ' + error.message); })`, true);
        assert.equal((await session.defaultSession.fetch('chordquest://other/app.js')).status, 404);
        assert.equal(window.webContents.getLastWebPreferences().sandbox, true);
        console.log(phase, result);
        clearTimeout(timeout);
        window.close();
      } catch (error) {
        console.error(error?.stack || error?.message || String(error));
        clearTimeout(timeout);
        app.exit(1);
      }
    });
  });
  require('./desktop.cjs');
}
