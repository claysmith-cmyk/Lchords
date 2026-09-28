# Chord Quest

A musical adventure for a USB MIDI keyboard, desktop computer keys, or an on-screen piano. No packages or account required.

## Play

Double-click **Start Chord Quest.cmd**, then open **http://localhost:4173** in desktop Chrome or Edge. Alternatively run `npm start` from this directory. Requires Node.js 20 or newer. Press Ctrl+C in the launcher terminal when finished; the game does not install a service or start itself in the background.

Choose **Connect keyboard**, allow MIDI, and select your MIDI input. Hold the notes together for 350 ms to validate a correct chord automatically, then release every key to advance after a short celebration. Note-off and velocity-zero note-on messages release keys; sustain is ignored to keep physical fingering clear. Any octave, inversion, and octave doubling is accepted; extra pitch classes are rejected. Wrong shapes can be corrected freely; **Check chord** explicitly submits an attempt. Turn Sound off if your instrument already produces sound.

Without MIDI, hold the displayed computer keys together, or click piano notes to toggle them. Click **Check chord** to submit. **Release all notes** clears held notes. Computer keyboards can have hardware limits on simultaneous key presses; use the mouse piano if a combination fails. The notes of one octave map to `A W S E D F T G Y H U J`; the next five notes map to `K O L P ;`.

Web MIDI needs a supported browser and a secure context: localhost is supported, and a deployed copy needs HTTPS. See [MDN Web MIDI](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API). A hardware keyboard and browser permission are necessary for an end-to-end hardware test.

If notes register but you hear nothing, click **Test sound** above the piano. MIDI input alone may not satisfy the browser's audio activation policy. The audio status reports whether playback is running or paused. If it says **Audio ready** but the test tone is silent, check the browser/app volume and selected output in Windows. See [Web Audio activation guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## The adventure

- Five worlds cover major, minor, diminished triads, augmented triads, and dominant sevenths in all 12 roots: **60 chord identities**.
- Twenty lessons introduce three chords each, then retrieve each twice without note hints. Up to two older chords are mixed into later lessons.
- All worlds and lessons are available from the beginning, so experienced players can jump ahead.
- Mistakes and hints trigger extra recall within the session (up to 18 rounds), plus earlier future review. Hearing a chord in a recall round also counts as assistance.
- Memory garden prioritizes due cards. Successful recall schedules reviews after 10 minutes, 1, 3, 7, 14, and 30 days; mistakes bring them back after 2 minutes. Each chord advances at most once per session. This is a simple fixed-interval schedule, not an individualized forgetting prediction.
- Spark sprint offers 90 seconds of recall with streak bonuses using discovered chords. The chord book offers all formulas and individual practice.
- XP and progress save locally in this browser. They do not sync across devices. Lesson completion records practice, not certified mastery. Chord spelling follows musical degrees; for example, D-flat minor contains F-flat, the same piano key as E.

The app uses native Web Audio for synthesized tone and has no runtime dependencies. Optional Google Fonts enhance the appearance; fallback fonts work without network access.

## Verify

Run `npm test` for nine checks covering chord construction, inversions, enharmonic spelling, curriculum coverage, MIDI parsing, review scheduling, MIDI gameplay, permission failures, sprint expiry and lesson persistence. Game integration tests simulate DOM, MIDI and time; physical input and audible output are checked separately. Run `node --check app.js` to check syntax. See `TESTING.md` for the completed checks.

## Files

- `music.js`: chord theory, curriculum, MIDI message parsing and review schedule.
- `app.js`: gameplay, MIDI/Web Audio, persistence and interface.
- `index.html` / `style.css`: responsive game interface and vector artwork.
- `server.js`: local-only static server, bound to 127.0.0.1 with an explicit file allowlist.
