import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOTS, KEY_STAGES, FAMILIES, chord, chordId, spellNotes, keyNotes, matches, midiEvent, lesson, schedule, reviewQueue, INTERVALS } from './music.js';

test('all 60 chords have the right pitches and accept inversions/octave doubling', () => {
  const expected = [[0, 4, 7], [0, 3, 7], [0, 3, 6], [0, 4, 8], [0, 4, 7, 10]];
  for (const [i, f] of FAMILIES.entries()) for (let root = 0; root < 12; root++) {
    const c = chord(chordId(f.id, root));
    assert.deepEqual(c.notes, expected[i].map(n => (root + n) % 12));
    assert.equal(matches(c.notes.map((n, j) => n + 48 + j * 12), c.notes), true);
    assert.equal(matches([...c.notes, c.notes[0] + 12], c.notes), true);
    assert.equal(matches(c.notes.slice(1), c.notes), false);
    assert.equal(matches([...c.notes, (c.notes[0] + 1) % 12], c.notes), false);
  }
});

test('spells thirds and fifths correctly, including enharmonic edge cases', () => {
  assert.deepEqual(spellNotes(chord('major:0')), ['C', 'E', 'G']);
  assert.deepEqual(spellNotes(chord('minor:1')), ['D♭', 'F♭', 'A♭']);
  assert.deepEqual(spellNotes(chord('diminished:6')), ['G♭', 'B♭♭', 'D♭♭']);
  assert.deepEqual(spellNotes(chord('augmented:11')), ['B', 'D♯', 'F♯♯']);
  assert.deepEqual(spellNotes(chord('dominant7:10')), ['B♭', 'D', 'F', 'A♭']);
});

test('12 independent key paths cover all 60 chords with guided and recall rounds', () => {
  const covered = new Set();
  for (let root = 0; root < 12; root++) for (let stage = 0; stage < KEY_STAGES.length; stage++) {
    const queue = lesson(root, stage);
    assert.equal(queue.length, 9);
    assert.equal(queue.filter(p => p.guided).length, 3);
    for (const prompt of queue.slice(0, 3)) {
      covered.add(prompt.id);
      assert.ok(prompt.role);
      assert.equal(prompt.keyName, keyNotes(root)[0]);
      assert.equal(queue.filter(p => p.id === prompt.id && !p.guided).length, 2);
    }
  }
  assert.equal(covered.size, ROOTS.length * FAMILIES.length);
  assert.deepEqual(keyNotes(7), ['G', 'A', 'B', 'C', 'D', 'E', 'F♯']);
  assert.deepEqual(keyNotes(6), ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']);
  assert.deepEqual(spellNotes(chord('minor:10'), 'A♯'), ['A♯', 'C♯', 'E♯']);
  assert.throws(() => lesson(12, 0));
  assert.throws(() => lesson(0, 4));
});

test('MIDI handles channels, velocity-zero releases, panic and ignores pedals', () => {
  assert.deepEqual(midiEvent([0x92, 60, 100]), { note: 60, down: true, channel: 2 });
  assert.deepEqual(midiEvent([0x92, 60, 0]), { note: 60, down: false, channel: 2 });
  assert.deepEqual(midiEvent([0x82, 60, 64]), { note: 60, down: false, channel: 2 });
  assert.deepEqual(midiEvent([0xb2, 123, 0]), { reset: true, channel: 2 });
  assert.equal(midiEvent([0xb0, 64, 127]), null);
  assert.equal(midiEvent([0xf8]), null);
  assert.equal(midiEvent([0x90, 200, 100]), null);
});

test('spaced review expands with success, resets after mistakes, and caps at 30 days', () => {
  const now = 1000000;
  let card;
  for (const interval of INTERVALS) { card = schedule(card, true, now); assert.equal(card.due, now + interval); }
  assert.equal(schedule(card, true, now).level, 5);
  const forgotten = schedule(card, false, now);
  assert.equal(forgotten.level, 0);
  assert.equal(forgotten.due, now + 120000);
  assert.equal(forgotten.lapses, 1);
  assert.deepEqual(reviewQueue({ later: { due: now + 1000, level: 1 }, overdue: { due: now - 100, level: 0 }, oldest: { due: now - 200, level: 2 } }, now), ['oldest', 'overdue', 'later']);
});
