# Chord Quest

A musical adventure for a USB MIDI keyboard, desktop computer keys, or an on-screen piano. No account required.

## Windows desktop app

Open `release/Chord Quest-win32-x64/Chord Quest.exe`. Keep the entire folder together: the executable needs its neighboring files. The packaged app includes its runtime, so it requires neither Node.js nor a separate browser. Closing its window quits the app, including audio and MIDI; nothing runs in the background afterward.

Choose **Connect keyboard** for USB MIDI, or play with computer keys and the on-screen piano. The game works offline; optional online fonts have local fallbacks. Progress saves in the app's own Windows profile, separately from browser progress, and survives closing and reopening the app.

To develop or rebuild, use Node.js 22.12+: `npm ci`, then `npm run desktop` or `npm run package:desktop`. Build output lives in `release/`. Close the app before rebuilding; a rebuild replaces the generated app folder. Run `npm test` for game checks and `npm run test:desktop` for real Electron startup, MIDI permissions, audio state, gameplay, persistence across restarts, and shutdown checks. Desktop checks use a temporary profile and leave your progress untouched.

## Play

Double-click **Start Chord Quest.cmd**, then open **http://localhost:4173** in desktop Chrome or Edge. Alternatively run `npm start` from this directory. Requires Node.js 20 or newer. Press Ctrl+C in the launcher terminal when finished; the game does not install a service or start itself in the background.

Choose **Connect keyboard**, allow MIDI, and select your MIDI input. Hold the notes together for 350 ms to validate a correct chord automatically, then release every key to advance after a short celebration. Note-off and velocity-zero note-on messages release keys; sustain is ignored to keep physical fingering clear. Any octave, inversion, and octave doubling is accepted; extra pitch classes are rejected. Wrong shapes can be corrected freely; **Check chord** explicitly submits an attempt. Turn Sound off if your instrument already produces sound.

Without MIDI, hold the displayed computer keys together, or click piano notes to toggle them. Click **Check chord** to submit. **Release all notes** clears held notes. Computer keyboards can have hardware limits on simultaneous key presses; use the mouse piano if a combination fails. The notes of one octave map to `A W S E D F T G Y H U J`; the next five notes map to `K O L P ;`.

Web MIDI needs a supported browser and a secure context: localhost is supported, and a deployed copy needs HTTPS. See [MDN Web MIDI](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API). A hardware keyboard and browser permission are necessary for an end-to-end hardware test.

If notes register but you hear nothing, click **Test sound** above the piano. MIDI input alone may not satisfy the browser's audio activation policy. The audio status reports whether playback is running or paused. If it says **Audio ready** but the test tone is silent, check the browser/app volume and selected output in Windows. See [Web Audio activation guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## The adventure

- Choose any of the 12 major keys. Each key has its own four-lesson path: **I–IV–V**, **ii–iii–vi**, **vii°–V7–I**, then **I+–IV–V7**. The augmented tonic in the last lesson is a color chord outside the major scale.
- Each lesson introduces three chords, then asks for each twice without note hints. Finish a lesson to open the next lesson in that key. Start and continue other keys at any time; their lesson progress is independent.
- Across the key paths you can encounter all **60 chord identities**: major, minor, diminished, augmented, and dominant seventh chords in all 12 roots. Chords shared by several keys keep one review card.
- Mistakes and hints trigger extra recall within the session (up to 18 rounds), plus earlier future review. Hearing a chord in a recall round also counts as assistance.
- Memory garden prioritizes due cards. Successful recall schedules reviews after 10 minutes, 1, 3, 7, 14, and 30 days; mistakes bring them back after 2 minutes. Each chord advances at most once per session. This is a simple fixed-interval schedule, not an individualized forgetting prediction.
- Spark sprint offers 90 seconds of recall with streak bonuses using discovered chords. The chord book offers all formulas and individual practice.
- XP and progress save locally in this browser. They do not sync across devices. Lesson completion records practice, not certified mastery. Existing chord cards and XP carry over from the older family-based curriculum; old lesson completion cannot map to a key path, so key lessons start fresh. Note names match the piano everywhere: natural notes or a single sharp, such as C-sharp minor with C-sharp, E and G-sharp. Enharmonic names are simplified (for example, F instead of E-sharp).

The app uses native Web Audio for synthesized tone and has no runtime dependencies. Optional Google Fonts enhance the appearance; fallback fonts work without network access.

## Verify

Run `npm test` for nine checks covering chord construction, inversions, key spellings, curriculum coverage, MIDI parsing, review scheduling, MIDI gameplay, permission failures, sprint expiry and independent key progress. Game integration tests simulate DOM, MIDI and time; physical input and audible output are checked separately. Run `node --check app.js` to check syntax. See `TESTING.md` for the completed checks.

## Files

- `music.js`: chord theory, per-key lessons, MIDI message parsing and review schedule.
- `app.js`: gameplay, MIDI/Web Audio, persistence and interface.
- `index.html` / `style.css`: responsive game interface and vector artwork.
- `server.js`: local-only static server, bound to 127.0.0.1 with an explicit file allowlist.
