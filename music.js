export const ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const FAMILIES = [
  { id: 'major', name: 'Major', symbol: '', intervals: [0, 4, 7], formula: '1 · 3 · 5', steps: '4 + 3', world: 'Sunlit Grove', color: '#b7e6a3', icon: '☀', description: 'Bright beginnings. Build a root, a major third, and a perfect fifth.' },
  { id: 'minor', name: 'Minor', symbol: 'm', intervals: [0, 3, 7], formula: '1 · ♭3 · 5', steps: '3 + 4', world: 'Moonlight Marsh', color: '#b7afff', icon: '☾', description: 'A softer shade. Lower the major chord’s third by one semitone.' },
  { id: 'diminished', name: 'Diminished', symbol: 'dim', intervals: [0, 3, 6], formula: '1 · ♭3 · ♭5', steps: '3 + 3', world: 'Crystal Caverns', color: '#8edee4', icon: '◇', description: 'A little tension. Stack two minor thirds, three semitones each.' },
  { id: 'augmented', name: 'Augmented', symbol: 'aug', intervals: [0, 4, 8], formula: '1 · 3 · ♯5', steps: '4 + 4', world: 'Ember Peaks', color: '#ffb693', icon: '△', description: 'An otherworldly sound. Stack two major thirds, four semitones each.' },
  { id: 'dominant7', name: 'Dominant 7', symbol: '7', intervals: [0, 4, 7, 10], formula: '1 · 3 · 5 · ♭7', steps: '4 + 3 + 3', world: 'Starlight Summit', color: '#f3d586', icon: '✦', description: 'Ready to go somewhere. Add a minor seventh to a major triad.' },
];
export const ROOT_ORDER = [0, 5, 7, 2, 9, 4, 11, 10, 3, 8, 1, 6];
export const chordId = (family, root) => `${family}:${root}`;
export function chord(id) {
  const [familyId, rootText] = id.split(':');
  const family = FAMILIES.find(f => f.id === familyId);
  const root = Number(rootText);
  if (!family || !Number.isInteger(root) || root < 0 || root > 11) throw new Error('Invalid chord');
  return { id, family, root, name: `${ROOTS[root]}${family.symbol}`, notes: family.intervals.map(n => (root + n) % 12) };
}
// Spelling follows chord degrees, including double flats/sharps where theory requires them.
export function spellNotes(c) {
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const naturals = [0, 2, 4, 5, 7, 9, 11];
  const start = letters.indexOf(ROOTS[c.root][0]);
  return c.notes.map((note, i) => {
    const index = (start + i * 2) % 7;
    let delta = (note - naturals[index] + 12) % 12;
    if (delta > 6) delta -= 12;
    return letters[index] + (delta < 0 ? '♭'.repeat(-delta) : '♯'.repeat(delta));
  });
}
export function matches(notes, target) {
  const actual = new Set([...notes].map(n => ((n % 12) + 12) % 12));
  return actual.size === target.length && target.every(n => actual.has(n));
}
export function midiEvent(data) {
  const [status, note, velocity] = data;
  if (data.length < 3 || note > 127 || velocity > 127) return null;
  const type = status & 0xf0;
  if (type === 0x90 || type === 0x80) return { note, down: type === 0x90 && velocity > 0, channel: status & 15 };
  if (type === 0xb0 && (note === 120 || note === 123)) return { reset: true, channel: status & 15 };
  return null;
}
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function lesson(family, group) {
  const ids = ROOT_ORDER.slice(group * 3, group * 3 + 3).map(root => chordId(family, root));
  return [...ids.map(id => ({ id, guided: true })), ...shuffle(ids).map(id => ({ id, guided: false })), ...shuffle(ids).map(id => ({ id, guided: false }))];
}
export const INTERVALS = [10 * 60000, 86400000, 3 * 86400000, 7 * 86400000, 14 * 86400000, 30 * 86400000];
export function schedule(previous, success, now = Date.now()) {
  const level = success ? Math.min((previous?.level ?? -1) + 1, INTERVALS.length - 1) : 0;
  return { level, due: now + (success ? INTERVALS[level] : 2 * 60000), seen: (previous?.seen || 0) + 1, lapses: (previous?.lapses || 0) + (success ? 0 : 1) };
}
export function reviewQueue(cards, now = Date.now()) {
  return Object.keys(cards).sort((a, b) => {
    const aDue = cards[a].due <= now, bDue = cards[b].due <= now;
    return Number(bDue) - Number(aDue) || cards[a].due - cards[b].due || cards[a].level - cards[b].level;
  });
}
