# Verification — 2026-09-28

## Sharp note names — 2026-09-29

- All 60 chords and all 48 key lessons use natural notes or single sharps, matching the piano. Lowered degrees in chord formulas are written in words.
- `npm test`: 9 passed, including all chord names, note labels, lesson roots, key names, pitch matching and saved progress.
- `npm run test:desktop`: passed, including sharp key labels, all five chord-book families, C-sharp major hints **C♯–F–G♯**, MIDI/audio and persistence after restart.
- Rebuilt the Windows executable and synchronized the prepared website's game files. Verified that the executable's bundled game files match the tested source and that no project app processes remained.

## Windows desktop — 2026-09-29

- Built `release/Chord Quest-win32-x64/Chord Quest.exe` with Electron 44.4.5. The package contains only the game assets, desktop entry point and package metadata; development tools and repository files are excluded.
- `npm test`: all 9 existing game checks passed. Desktop entry point and packaging script syntax checks passed.
- `npm run test:desktop`: passed using real Electron and an isolated temporary profile. Checked the secure app origin, sandboxed renderer without Node access, asset allowlist, denied microphone permission, MIDI access without SysEx, all 12 key paths, C-major acceptance, running audio context, saved XP/key selection after a full restart, and normal process exit.
- Opened the packaged executable through Windows Computer Use. Adventure and lesson screens rendered correctly. The connection dialog detected **MPK mini 3**; the live lesson accepted C major, awarded 5 XP and advanced to F major on release. Audio status showed **Audio ready**; audible output was not independently measured in this desktop check.
- The packaged app was closed after verification; checked that no project Electron or Chord Quest processes remained.

## Automated

`npm test`: 9 passed, 0 failed.

- Every combination of 12 roots and five chord families, inversions, octave doubling, missing notes and extra notes.
- Piano-friendly natural or single-sharp note names, including enharmonic edge cases.
- Forty-eight lessons across 12 independent major-key paths cover all 60 chord identities, each with guided discovery and two recalls. G and F-sharp key spellings checked.
- MIDI note-on, note-off, velocity-zero note-on, multiple channels, panic messages and ignored sustain.
- Review intervals, failures and due-order prioritization.
- Full MIDI handler flow with simulated input, 350 ms hold validation, release-to-advance, disconnect/reconnect and cleanup.
- Sprint deadline prevents late XP and clears its interval.
- Missing/denied MIDI access and computer-key fallback.
- Full C and G first lessons, independent completion, reopening C's next lesson, and at-most-once review advancement per chord per session.

`node --check app.js`, `node --check music.js`, `node --check server.js`: passed.

HTTP checks: game asset served with 200; unlisted file returned 404. Server binds only to 127.0.0.1.

## Browser

Key-path browser check: all 12 keys appeared in a two-row desktop grid. Selecting G showed its I–IV–V, ii–iii–vi, vii°–V7–I, and I+–IV–V7 lesson lists; later lessons were disabled. Starting G opened the guided G major chord with G–B–D note hints. Returning to the key map and selecting C restored its own path. No browser console errors were captured. The local test server was stopped afterward.

Earlier browser checks for the family-based curriculum:

- Full first lesson, wrong answer feedback, hinted recall, additional retry and completion summary.
- First-inversion C major accepted; hidden recall rounds have no target-key highlights.
- Progress survives page reload.
- Guided C major, C minor, C diminished, C augmented and C dominant 7 accepted using the on-screen instrument.
- Chord book family selection and dominant seventh spellings inspected.
- Memory garden starts recall and Spark sprint starts its countdown.
- Desktop (1366px) and narrow (390px) layouts inspected, without horizontal page overflow; world cards scroll horizontally on small screens.
- No captured browser runtime errors during these checks.

## Physical keyboard and audio

The browser detected the user's **MPK mini 3**. Physical C-major input awarded 5 XP and advanced to F major after release, observed in the game. The user initially reported silent audio. An explicit sound-enable/test-tone control, audio state feedback, activation on lesson start, and increased synth output were added. The user then confirmed: **“Yes, sound works now.”**

Other MIDI hardware/browser combinations have not been physically tested. Disconnect/reconnect behavior was tested with simulated MIDI ports. Review intervals were verified with controlled time; no multi-day study or retention measurement is claimed.

Screenshots: `screenshots/adventure.png`, `screenshots/lesson.png`.
