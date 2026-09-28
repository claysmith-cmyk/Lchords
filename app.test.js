import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as music from './music.js';

// A small DOM/MIDI boundary double lets real game handlers run without hardware.
const source = (await readFile(new URL('./app.js', import.meta.url), 'utf8')).replace(/^import .*?;\s*/, '');
function fixture(saved = null) {
  const elements = new Map(), timers = new Map(), events = new Map(), storage = new Map();
  if (saved) storage.set('chord-quest-v1', JSON.stringify(saved));
  let time = 1000000, timerId = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, hidden: false, checked: false, value: '', textContent: '', innerHTML: '', dataset: {}, style: { setProperty() {} },
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute() {}, append() {}, add() {},
      close() { this.open = false; }, showModal() { this.open = true; },
    });
    return elements.get(id);
  }
  const input = { id: 'test-midi', name: 'Test keyboard', state: 'connected' };
  const midi = { inputs: new Map([[input.id, input]]) };
  const context = {
    ...music, MAJOR_KEYS: music.KEY_NAMES, console, Map, Set, JSON, Math, Number,
    schedule: (previous, success) => music.schedule(previous, success, time),
    reviewQueue: cards => music.reviewQueue(cards, time),
    Date: class extends Date { static now() { return time; } },
    document: { getElementById: element, querySelector: element, querySelectorAll: () => [], createElement: () => element(Symbol()), documentElement: element('html'), addEventListener: (name, fn) => events.set(name, fn) },
    window: { addEventListener: (name, fn) => events.set(name, fn), scrollTo() {} },
    navigator: { requestMIDIAccess: async () => midi },
    Option: class {},
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    setInterval: fn => { timers.set(++timerId, { fn, ms: 'interval' }); return timerId; },
    clearInterval: id => timers.delete(id),
  };
  vm.runInNewContext(source, context);
  return {
    element, input, midi, events, navigator: context.navigator, selectKey: root => context.selectKey(root),
    click: id => element(id).onclick(),
    send: (status, note, velocity = 100) => input.onmidimessage({ data: [status, note, velocity] }),
    run: ms => { for (const [id, t] of [...timers]) if (t.ms === ms) { if (ms !== 'interval') timers.delete(id); t.fn(); } },
    advance: ms => { time += ms; },
    saved: () => JSON.parse(storage.get('chord-quest-v1')),
    timers,
  };
}

test('MIDI gameplay: rejects extra notes, accepts inversions, advances on release, cleans up on disconnect', async () => {
  const f = fixture();
  await f.click('midi-connect'); f.element('dialog').close(); f.click('continue');
  assert.equal(f.element('chord-name').textContent, 'C major');
  for (const note of [64, 67, 72, 73]) f.send(0x91, note);
  f.run(350);
  assert.equal(f.element('next').hidden, true);
  f.send(0x81, 73, 0); f.run(350);
  assert.equal(f.element('next').hidden, false);
  assert.equal(f.saved().xp, 5);
  f.run(350); assert.equal(f.saved().xp, 5, 'same held chord cannot award XP twice');
  for (const note of [64, 67, 72]) f.send(0x91, note, 0);
  f.run(800);
  assert.equal(f.element('chord-name').textContent, 'F major');
  f.send(0x90, 65);
  f.input.state = 'disconnected'; f.midi.onstatechange();
  assert.equal(f.element('held-notes').textContent, 'Play the notes together');
  assert.equal(f.input.onmidimessage, null);
  f.input.state = 'connected'; f.midi.onstatechange(); f.element('dialog').close();
  assert.equal(typeof f.input.onmidimessage, 'function');
  f.events.get('pagehide')();
  assert.equal(f.input.onmidimessage, null);
  assert.equal(f.timers.size, 0);
});

test('sprint ends at 90 seconds and cannot award XP after its deadline', async () => {
  const f = fixture();
  await f.click('midi-connect'); f.element('dialog').close(); f.click('continue');
  for (const note of [60, 64, 67]) f.send(0x90, note);
  f.run(350); f.click('exit'); f.click('arcade');
  f.advance(90001);
  for (const note of [60, 64, 67]) f.send(0x90, note);
  f.run(350);
  assert.equal(f.saved().xp, 5);
  assert.match(f.element('dialog-content').innerHTML, /SPARK SPRINT COMPLETE/);
  assert.equal(f.timers.size, 0);
});

test('missing MIDI API and denied permission keep other controls usable', async () => {
  const f = fixture();
  delete f.navigator.requestMIDIAccess;
  await f.click('midi-connect');
  assert.match(f.element('dialog-content').innerHTML, /does not expose Web MIDI/);
  f.element('dialog').close();
  f.navigator.requestMIDIAccess = async () => { throw Object.assign(new Error('Denied'), { name: 'NotAllowedError' }); };
  await f.click('midi-connect');
  assert.match(f.element('toast').textContent, /permission was denied/);
  f.run(5000);
  f.click('continue');
  f.events.get('keydown')({ key: 'a', target: { tagName: 'BODY' }, preventDefault() {} });
  assert.equal(f.element('held-notes').textContent, 'C');
  f.events.get('blur')();
  assert.equal(f.element('held-notes').textContent, 'Play the notes together');
  f.click('exit');
  assert.equal(f.timers.size, 0);
});

test('lesson completion persists and repeated recall advances a card only once per session', async () => {
  const f = fixture();
  await f.click('midi-connect'); f.element('dialog').close(); f.click('continue');
  const shapes = { 'C major': [60, 64, 67], 'F major': [65, 69, 72], 'G major': [67, 71, 74], 'D major': [62, 66, 69] };
  for (let i = 0; i < 9; i++) {
    const notes = shapes[f.element('chord-name').textContent];
    assert.ok(notes);
    for (const note of notes) f.send(0x90, note);
    f.run(350);
    assert.equal(f.element('next').hidden, false);
    for (const note of notes) f.send(0x80, note, 0);
    f.run(800);
  }
  assert.deepEqual(f.saved().completed, ['key-0-0']);
  assert.equal(f.saved().xp, 105);
  for (const card of Object.values(f.saved().cards)) {
    assert.equal(card.level, 0);
    assert.equal(card.due, 1600000);
  }
  assert.equal(f.timers.size, 0);
  f.selectKey(7);
  assert.match(f.element('world-name').textContent, /G major path/);
  assert.match(f.element('lessons').innerHTML, /disabled/);
  f.click('continue');
  assert.equal(f.element('chord-name').textContent, 'G major');
  for (let i = 0; i < 9; i++) {
    const notes = shapes[f.element('chord-name').textContent];
    for (const note of notes) f.send(0x90, note);
    f.run(350);
    for (const note of notes) f.send(0x80, note, 0);
    f.run(800);
  }
  assert.deepEqual(f.saved().completed, ['key-0-0', 'key-7-0']);
  f.selectKey(0);
  f.click('continue');
  assert.equal(f.element('chord-name').textContent, 'D minor');
  f.click('exit');
  const restored = fixture(f.saved());
  assert.equal(restored.element('world-name').textContent, 'C major path');
  assert.match(restored.element('lessons').innerHTML, /Minor colors/);
  assert.equal(restored.saved().selectedKey, 0);
});
