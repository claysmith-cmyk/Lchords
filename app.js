import { ROOTS, ROOT_ORDER, KEY_NAMES as MAJOR_KEYS, KEY_STAGES, FAMILIES, chord, chordId, spellNotes, matches, midiEvent, shuffle, lesson, schedule, reviewQueue } from './music.js';

const $ = id => document.getElementById(id);
const STORAGE = 'chord-quest-v1';
let progress = { xp: 0, cards: {}, completed: [], best: 0, selectedKey: 0 };
let storageWarning = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  if (saved && typeof saved === 'object') {
    progress.xp = Number.isFinite(saved.xp) ? Math.max(0, saved.xp) : 0;
    progress.best = Number.isFinite(saved.best) ? Math.max(0, saved.best) : 0;
    progress.completed = Array.isArray(saved.completed) ? saved.completed.filter(id => ROOT_ORDER.some(root => KEY_STAGES.some((_, stage) => id === `key-${root}-${stage}`))) : [];
    progress.selectedKey = Number.isInteger(saved.selectedKey) && saved.selectedKey >= 0 && saved.selectedKey < 12 ? saved.selectedKey : 0;
    for (const [id, card] of Object.entries(saved.cards || {})) {
      try {
        chord(id);
        if (Number.isFinite(card?.due) && Number.isInteger(card.level) && card.level >= -1 && card.level <= 5 && Number.isFinite(card.seen) && Number.isFinite(card.lapses)) progress.cards[id] = card;
      } catch { /* Ignore individual damaged cards while preserving valid progress. */ }
    }
  }
} catch { storageWarning = true; }

let session = null, access = null, selectedInput = null;
let audioContext, autoCheck, advanceTimer, sprintTimer, toastTimer;
const sources = new Map(), voices = new Map();
const keyboardMap = new Map('awsedftgyhujkolp;'.split('').map((key, i) => [key, 60 + i]));
const blackNotes = new Set([1, 3, 6, 8, 10]);
const KEY_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(progress)); }
  catch { if (!storageWarning) toast('Progress could not be saved. Check your browser storage settings.'); storageWarning = true; }
}
function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}
function modal(html) { $('dialog-content').innerHTML = html; if (!$('dialog').open) $('dialog').showModal(); }
$('close-dialog').onclick = () => $('dialog').close();
$('dialog').addEventListener('click', e => { if (e.target === $('dialog')) { const rect = $('dialog').getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) $('dialog').close(); } });

function renderHome() {
  const ids = Object.keys(progress.cards), due = ids.filter(id => progress.cards[id].due <= Date.now());
  $('xp').textContent = `✦ ${progress.xp} XP`;
  $('learned').textContent = `${ids.length} / 60`;
  $('level-count').textContent = `${progress.completed.length} / 48`;
  $('due-count').textContent = `${due.length} ready`;
  const keyDone = KEY_STAGES.filter((_, stage) => progress.completed.includes(`key-${progress.selectedKey}-${stage}`)).length;
  $('continue').innerHTML = `${keyDone === KEY_STAGES.length ? 'Review chords' : `${keyDone ? 'Continue' : 'Start'} ${MAJOR_KEYS[progress.selectedKey]}`} <span>↗</span>`;
  $('worlds').innerHTML = ROOT_ORDER.map(root => {
    const count = KEY_STAGES.filter((_, stage) => progress.completed.includes(`key-${root}-${stage}`)).length;
    return `<button class="world-card ${root === progress.selectedKey ? 'selected' : ''}" data-key="${root}" aria-pressed="${root === progress.selectedKey}"><div class="world-art">${MAJOR_KEYS[root]}</div><h3>${MAJOR_KEYS[root]} major</h3><p>${count}/4 lessons complete</p><div class="world-bar"><span style="width:${count * 25}%"></span></div></button>`;
  }).join('');
  document.querySelectorAll('[data-key]').forEach(button => button.onclick = () => selectKey(Number(button.dataset.key)));
  const root = progress.selectedKey;
  $('world-name').textContent = `${MAJOR_KEYS[root]} major path`;
  $('world-formula').textContent = 'Finish a lesson to open the next. Start another key whenever you like.';
  $('lessons').innerHTML = KEY_STAGES.map((stage, index) => {
    const done = progress.completed.includes(`key-${root}-${index}`);
    const locked = index > 0 && !progress.completed.includes(`key-${root}-${index - 1}`);
    const names = lesson(root, index).slice(0, 3).map(p => `${p.role} ${p.name}`).join(' · ');
    return `<button class="lesson-button ${done ? 'complete' : ''}" data-stage="${index}" ${locked ? 'disabled' : ''}><span class="lesson-number">${done ? '✓' : index + 1}</span><span><strong>${stage.name}</strong><small>${names}</small></span><span class="arrow">→</span></button>`;
  }).join('');
  document.querySelectorAll('[data-stage]').forEach(button => button.onclick = () => startLesson(root, Number(button.dataset.stage)));
  renderBook();
}
function selectKey(root) { progress.selectedKey = root; save(); renderHome(); }
function renderBook() {
  const f = FAMILIES[Number($('book-family').value) || 0];
  $('chord-book').innerHTML = ROOTS.map((_, root) => {
    const c = chord(chordId(f.id, root)), card = progress.cards[c.id];
    const state = !card ? 'New' : card.level < 1 ? 'Practicing' : card.due <= Date.now() ? 'Review due' : 'Practiced';
    return `<button class="book-card" data-chord="${c.id}"><h3>${c.name}</h3><p>${spellNotes(c).join(' · ')}</p><small>${state} ↗</small></button>`;
  }).join('');
  document.querySelectorAll('[data-chord]').forEach(button => button.onclick = () => startSession('practice', [{ id: button.dataset.chord, guided: true }, { id: button.dataset.chord, guided: false }], 'Chord book practice'));
}
$('book-family').innerHTML = FAMILIES.map((f, i) => `<option value="${i}">${f.name}</option>`).join('');
$('book-family').onchange = renderBook;
document.querySelectorAll('[data-page]').forEach(button => button.onclick = () => {
  if (session) { stopSession(); showHome(); }
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b === button));
  $('adventure-page').hidden = button.dataset.page !== 'adventure';
  $('collection-page').hidden = button.dataset.page !== 'collection'; renderBook();
});
$('continue').onclick = () => {
  for (let stage = 0; stage < KEY_STAGES.length; stage++) if (!progress.completed.includes(`key-${progress.selectedKey}-${stage}`)) { startLesson(progress.selectedKey, stage); return; }
  startReview();
};
function startLesson(root, stage) {
  if (stage > 0 && !progress.completed.includes(`key-${root}-${stage - 1}`)) return;
  const queue = lesson(root, stage);
  startSession('lesson', queue, `${MAJOR_KEYS[root]} major · ${KEY_STAGES[stage].name}`, `key-${root}-${stage}`);
}
function startSession(mode, queue, title, lessonId = null) {
  stopSession(); $('dialog').close();
  ensureAudio();
  session = { mode, queue, index: 0, title, lessonId, xp: 0, correct: 0, mistakes: 0, assisted: 0, scheduled: new Set(), complete: false, hint: false, failed: false, streak: 0, end: Date.now() + 90000 };
  $('home').hidden = true; $('play').hidden = false;
  window.scrollTo({ top: 0, behavior: 'instant' });
  renderPrompt();
  if (mode === 'sprint') sprintTimer = setInterval(() => {
    if (!session) return;
    const seconds = Math.max(0, Math.ceil((session.end - Date.now()) / 1000));
    $('session-title').textContent = `Spark sprint · ${seconds}s left`;
    $('session-progress').style.width = `${(90 - seconds) / 90 * 100}%`;
    if (!seconds) finish();
  }, 200);
}
function startReview() {
  const queue = reviewQueue(progress.cards).slice(0, 12).map(id => ({ id, guided: false }));
  if (!queue.length) { modal('<h2>No chords to review yet</h2><p>Complete a lesson to start reviewing.</p><button class="primary" id="garden-start">Start lesson →</button>'); $('garden-start').onclick = () => $('continue').click(); return; }
  startSession('review', queue, 'Memory garden · Recall & grow');
}
$('review').onclick = startReview;
$('arcade').onclick = () => {
  const ids = Object.keys(progress.cards);
  if (!ids.length) { toast('Discover a few chords in a lesson before your first sprint.'); return; }
  const queue = shuffle(ids).map(id => ({ id, guided: false }));
  startSession('sprint', queue, 'Spark sprint · 90s left');
};
function renderPrompt() {
  clearNotes();
  const s = session, prompt = s.queue[s.index], c = chord(prompt.id);
  s.complete = false; s.hint = false; s.failed = false;
  $('arena').classList.remove('success');
  $('session-title').textContent = s.mode === 'sprint' ? `Spark sprint · ${Math.ceil((s.end - Date.now()) / 1000)}s left` : s.title;
  $('session-score').textContent = `✦ ${s.xp} XP`;
  if (s.mode !== 'sprint') $('session-progress').style.width = `${s.index / s.queue.length * 100}%`;
  $('prompt-kind').textContent = prompt.guided ? `DISCOVER · ${s.index + 1} / ${s.queue.length}` : s.mode === 'sprint' ? `${s.streak} CHORD STREAK` : `RECALL · ${s.index + 1} / ${s.queue.length}`;
  $('chord-name').textContent = `${prompt.rootName || ROOTS[c.root]} ${c.family.name.toLowerCase()}`;
  $('prompt-description').textContent = prompt.role ? `${prompt.role} in ${prompt.keyName} major${prompt.guided ? ` · ${c.family.formula}` : ''}` : prompt.guided ? `${c.family.formula} · ${c.family.steps} semitones` : '';
  $('note-chips').innerHTML = prompt.guided ? spellNotes(c, prompt.rootName).map(n => `<span class="note-chip">${n}</span>`).join('') : '';
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('next').hidden = true; $('hint').hidden = prompt.guided; $('listen').disabled = false; $('check').disabled = false;
  $('hint').disabled = false;
  highlightPiano();
}
function reveal() {
  if (!session || session.complete) return;
  const prompt = session.queue[session.index], c = chord(prompt.id);
  session.hint = true;
  $('note-chips').innerHTML = spellNotes(c, prompt.rootName).map(n => `<span class="note-chip">${n}</span>`).join('');
  $('prompt-description').textContent = `${c.family.formula} · ${c.family.steps} semitones from ${prompt.rootName || ROOTS[c.root]}.`;
  $('feedback').textContent = '';
  $('hint').disabled = true; highlightPiano();
}
$('hint').onclick = reveal;
function heldNotes() { return new Set(sources.values()); }
function check(automatic = false) {
  clearTimeout(autoCheck);
  if (!session || session.complete || $('dialog').open) return;
  if (session.mode === 'sprint' && Date.now() >= session.end) { finish(); return; }
  const s = session, prompt = s.queue[s.index], c = chord(prompt.id), notes = heldNotes();
  if (!notes.size) { if (!automatic) $('feedback').textContent = 'Play or click some notes first, then check your chord.'; return; }
  if (!matches(notes, c.notes)) {
    if (automatic) return;
    const firstFailure = !s.failed;
    if (firstFailure) s.mistakes++;
    s.failed = true; s.streak = 0;
    $('feedback').className = 'feedback';
    $('feedback').textContent = notes.size < c.notes.length ? `Keep building — this chord needs ${c.notes.length} different notes.` : 'Almost. Release any extra notes and try a different shape, or ask for a hint.';
    if (!prompt.guided && firstFailure) { progress.cards[c.id] = schedule(progress.cards[c.id], false); s.scheduled.add(c.id); save(); }
    return;
  }
  s.complete = true; s.correct++; s.streak++;
  const independent = !prompt.guided && !s.hint && !s.failed;
  const reward = independent ? 15 + (s.mode === 'sprint' ? Math.min(s.streak - 1, 5) * 2 : 0) : 5;
  if (s.hint || s.failed) s.assisted++;
  s.xp += reward; progress.xp += reward;
  if (prompt.guided && !progress.cards[c.id]) progress.cards[c.id] = { level: -1, due: Date.now(), seen: 1, lapses: 0 };
  if (!prompt.guided && (!s.scheduled.has(c.id) || !independent)) { progress.cards[c.id] = schedule(progress.cards[c.id], independent); s.scheduled.add(c.id); }
  // Retry assisted recall later in the same session, with a bounded session length.
  if (!prompt.guided && !independent && s.mode !== 'sprint' && s.queue.length < 18) s.queue.push({ id: c.id, guided: false });
  save();
  $('arena').classList.add('success');
  $('feedback').className = 'feedback success';
  $('feedback').textContent = `Correct · +${reward} XP`;
  $('session-score').textContent = `✦ ${s.xp} XP`;
  $('next').hidden = false; $('check').disabled = true; $('hint').disabled = true;
  $('next').textContent = s.mode !== 'sprint' && s.index === s.queue.length - 1 ? 'Finish session ✦' : 'Keep going →';
}
$('check').onclick = () => check();
$('next').onclick = next;
function next() {
  if (!session?.complete) return;
  if (session.mode === 'sprint' && Date.now() >= session.end) { finish(); return; }
  session.index++;
  if (session.index >= session.queue.length) {
    if (session.mode === 'sprint') {
      const previous = session.queue.at(-1).id;
      const ids = shuffle(Object.keys(progress.cards));
      if (ids.length > 1 && ids[0] === previous) [ids[0], ids[1]] = [ids[1], ids[0]];
      session.queue.push(...ids.map(id => ({ id, guided: false })));
    } else { finish(); return; }
  }
  renderPrompt();
}
function finish() {
  const s = session;
  if (!s) return;
  if (s.lessonId && !progress.completed.includes(s.lessonId)) progress.completed.push(s.lessonId);
  if (s.mode === 'sprint') progress.best = Math.max(progress.best, s.correct);
  save(); stopSession(); showHome();
  modal(`<h2>${s.mode === 'sprint' ? 'SPARK SPRINT COMPLETE' : 'Session complete'}</h2><div class="result-number">+${s.xp} <span style="font-size:22px">XP</span></div><div class="result-stats"><span>${s.correct} chords played</span><span>${s.assisted} assisted</span>${s.mode === 'sprint' ? `<span>Best: ${progress.best}</span>` : ''}</div><button class="primary" id="result-done">Back to adventure →</button>`);
  $('result-done').onclick = () => $('dialog').close();
}
function stopSession() { clearInterval(sprintTimer); clearTimeout(autoCheck); clearNotes(); session = null; }
function showHome() { $('home').hidden = false; $('play').hidden = true; renderHome(); }
$('exit').onclick = () => { stopSession(); showHome(); };
document.querySelector('.brand').onclick = e => { e.preventDefault(); stopSession(); showHome(); };

function ensureAudio() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    audioContext.onstatechange = audioStatus;
    if (audioContext.state !== 'running') audioContext.resume().then(audioStatus).catch(() => { $('audio-status').textContent = 'Audio blocked. Click Test sound, or open in Chrome / Edge.'; });
    audioStatus();
  } catch { $('audio-status').textContent = 'Audio unavailable here. Open the game in Chrome or Edge.'; }
}
function audioStatus() {
  $('audio-status').textContent = !$('sound').checked ? 'Sound off' : audioContext?.state === 'running' ? 'Audio ready' : 'Audio paused';
}
$('audio-enable').onclick = () => {
  $('sound').checked = true;
  ensureAudio(); if (!audioContext) return;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), t = audioContext.currentTime;
  oscillator.type = 'triangle'; oscillator.frequency.value = 440;
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.2, t + .02); gain.gain.exponentialRampToValueAtTime(.0001, t + 1);
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start(t); oscillator.stop(t + 1.1);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
};
function soundOn(note) {
  if (!$('sound').checked || voices.has(note)) return;
  ensureAudio(); if (!audioContext) return;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  oscillator.type = 'triangle'; oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
  const t = audioContext.currentTime;
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.18, t + .015); gain.gain.exponentialRampToValueAtTime(.085, t + .7);
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start();
  voices.set(note, { oscillator, gain });
}
function soundOff(note) {
  const voice = voices.get(note); if (!voice) return;
  voice.gain.gain.cancelScheduledValues(audioContext.currentTime);
  voice.gain.gain.setTargetAtTime(0, audioContext.currentTime, .025);
  voice.oscillator.stop(audioContext.currentTime + .15);
  voice.oscillator.onended = () => { voice.oscillator.disconnect(); voice.gain.disconnect(); };
  voices.delete(note);
}
$('sound').onchange = () => { if (!$('sound').checked) [...voices.keys()].forEach(soundOff); else ensureAudio(); audioStatus(); };
$('listen').onclick = () => {
  if (!session) return;
  if (!session.queue[session.index].guided && !session.complete) { session.hint = true; $('feedback').textContent = 'Assisted recall · review sooner'; }
  ensureAudio(); if (!audioContext) { toast('Audio is unavailable in this browser.'); return; }
  const c = chord(session.queue[session.index].id);
  c.family.intervals.forEach((interval, i) => {
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), t = audioContext.currentTime + i * .08;
    oscillator.type = 'triangle'; oscillator.frequency.value = 440 * 2 ** ((60 + c.root + interval - 69) / 12);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime($('sound').checked ? .08 : 0, t + .02); gain.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
    oscillator.connect(gain).connect(audioContext.destination); oscillator.start(t); oscillator.stop(t + 1.5);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
};
function setNote(source, note, down, automatic = false) {
  clearTimeout(advanceTimer);
  const before = heldNotes();
  if (down) sources.set(source, note); else sources.delete(source);
  const after = heldNotes();
  for (const n of before) if (!after.has(n)) soundOff(n);
  for (const n of after) if (!before.has(n)) soundOn(n);
  highlightPiano();
  clearTimeout(autoCheck);
  if (automatic && session && !session.complete) autoCheck = setTimeout(() => check(true), 350);
  if (automatic && session?.complete && !down && !after.size) advanceTimer = setTimeout(next, 800);
}
function clearNotes() { clearTimeout(autoCheck); clearTimeout(advanceTimer); sources.clear(); [...voices.keys()].forEach(soundOff); highlightPiano(); }
$('clear-notes').onclick = clearNotes;
function highlightPiano() {
  const notes = heldNotes(), pitchClasses = new Set([...notes].map(n => n % 12));
  const prompt = session?.queue[session.index];
  const target = prompt && (prompt.guided || session.hint) ? chord(prompt.id).notes : [];
  document.querySelectorAll('.key').forEach(key => {
    const note = Number(key.dataset.note);
    key.classList.toggle('pressed', notes.has(note));
    key.classList.toggle('target', target.includes(note % 12));
    key.setAttribute('aria-pressed', String(notes.has(note)));
  });
  $('held-notes').textContent = notes.size ? [...pitchClasses].sort((a, b) => a - b).map(n => KEY_NAMES[n]).join(' · ') : 'Play the notes together';
}
function buildPiano() {
  let white = 0;
  const whiteCount = 15;
  for (let note = 60; note <= 84; note++) {
    const black = blackNotes.has(note % 12), key = document.createElement('button');
    key.className = `key ${black ? 'black' : 'white'}`; key.dataset.note = note;
    key.setAttribute('aria-label', `${KEY_NAMES[note % 12]}${Math.floor(note / 12) - 1}`);
    key.setAttribute('aria-pressed', 'false');
    key.innerHTML = `<span>${KEY_NAMES[note % 12]}</span><small>${[...keyboardMap].find(([, n]) => n === note)?.[0].toUpperCase() || '·'}</small>`;
    if (black) key.style.left = `${white / whiteCount * 100 - 2.075}%`; else white++;
    key.onclick = () => { if (!session || session.complete) return; ensureAudio(); setNote(`click:${note}`, note, !sources.has(`click:${note}`)); };
    $('piano').append(key);
  }
}
document.addEventListener('keydown', e => {
  if (!session || $('dialog').open || e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'Enter' && !e.repeat) {
    // Preserve native Enter behavior on focused controls.
    if (e.target.closest('button')) return;
    e.preventDefault(); session.complete ? next() : check(); return;
  }
  const key = e.key.toLowerCase(), note = keyboardMap.get(key);
  if (note !== undefined) { e.preventDefault(); if (!e.repeat && !session.complete) setNote(`key:${key}`, note, true, true); }
});
document.addEventListener('keyup', e => { const key = e.key.toLowerCase(), note = keyboardMap.get(key); if (note !== undefined) setNote(`key:${key}`, note, false, true); });
window.addEventListener('blur', clearNotes);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearNotes(); });

function attachMidi() {
  clearNotes();
  for (const input of access.inputs.values()) input.onmidimessage = null;
  const inputs = [...access.inputs.values()].filter(input => input.state === 'connected');
  selectedInput = inputs.find(input => input.id === selectedInput?.id) || inputs[0] || null;
  $('midi-connect').classList.toggle('connected', Boolean(selectedInput));
  $('midi-label').textContent = selectedInput ? selectedInput.name || 'MIDI connected' : 'No keyboard detected';
  $('input-label').textContent = selectedInput ? 'MIDI CONNECTED' : 'PIANO';
  if (selectedInput) selectedInput.onmidimessage = e => {
    if (!session || $('dialog').open) return;
    const event = midiEvent(e.data); if (!event) return;
    if (event.reset) {
      for (const [source, note] of sources) if (source.startsWith(`midi:${event.channel}:`)) setNote(source, note, false);
      return;
    }
    if (!session.complete || !event.down) setNote(`midi:${event.channel}:${event.note}`, event.note, event.down, true);
  };
  return inputs;
}
$('midi-connect').onclick = async () => {
  if (!navigator.requestMIDIAccess) { modal('<div class="eyebrow">CONNECT YOUR INSTRUMENT</div><h2>Let’s find your keyboard.</h2><p>This browser does not expose Web MIDI. Open the game in desktop Chrome or Edge at localhost, plug in your USB MIDI keyboard, then try again. You can also play with computer keys or click the piano.</p>'); return; }
  try {
    ensureAudio();
    access ||= await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = () => { attachMidi(); if ($('midi-select')) showMidiDialog(); };
    attachMidi(); showMidiDialog();
  } catch (e) {
    toast(e.name === 'NotAllowedError' ? 'MIDI permission was denied. Allow MIDI in browser site settings, then reconnect.' : 'Could not connect MIDI. Check the cable and try again.');
  }
};
function showMidiDialog() {
  const inputs = [...access.inputs.values()].filter(i => i.state === 'connected');
  modal(`<h2>${inputs.length ? 'Keyboard connected' : 'Waiting for keyboard…'}</h2><p>${inputs.length ? 'Choose an input. Hold chords briefly to check them.' : 'Plug in and turn on your USB MIDI keyboard.'}</p><label for="midi-select">MIDI input</label><select id="midi-select" style="display:block;width:100%;margin-top:10px"></select>`);
  const select = $('midi-select');
  if (!inputs.length) { const option = new Option('Waiting for a MIDI device', ''); select.add(option); select.disabled = true; }
  for (const input of inputs) select.add(new Option(input.name || 'MIDI keyboard', input.id, false, input.id === selectedInput?.id));
  select.onchange = () => { selectedInput = access.inputs.get(select.value); attachMidi(); };
}
$('help').onclick = () => modal('<div class="eyebrow">WELCOME, EXPLORER</div><h2>A keyboard. A little curiosity.</h2><ol><li><strong>Choose a key:</strong> every major key has its own four-lesson path. Start several keys and continue each one independently.</li><li><strong>Discover:</strong> begin with I, IV and V. Later lessons add minor chords, tension, and an augmented color chord. Glowing piano keys show the notes.</li><li><strong>Recall:</strong> the note hints disappear. Play the whole chord together in any octave or inversion. Extra notes don’t count.</li><li><strong>Connect:</strong> choose “Connect keyboard” for USB MIDI in Chrome or Edge, or use computer keys or the on-screen piano.</li><li><strong>Review:</strong> revisit learned chords in the Memory garden or try Spark sprint.</li></ol><p>Progress saves in this browser on this device. A completed lesson means you practiced it; spaced recall builds lasting memory.</p>');
window.addEventListener('pagehide', () => { stopSession(); clearTimeout(toastTimer); if (access) { access.onstatechange = null; for (const input of access.inputs.values()) input.onmidimessage = null; } audioContext?.close(); });
buildPiano(); renderHome();
if (storageWarning) toast('Saved progress could not be read. New progress will be saved if browser storage is available.');
