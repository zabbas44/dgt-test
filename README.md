# Test DGT · Permiso B — offline theory trainer

A mobile-first study app for the Spanish DGT theory exam (permiso B). React + Vite,
runs entirely offline, no account and no server required.

- **2,947 questions** from the official DGT bank, each with its real exam photograph.
- **Spanish and English** — question, options and explanation in both, one tap to switch.
- **An explanation on every question.** The ones the DGT bank ships with (cleaned up), plus
  written explanations for the 1,613 questions that had none.
- **Review every 10 questions**: block score, session score, all-time accuracy, best streak,
  average time, a per-section breakdown and every question you missed with the reason.
- **14 sections** you can study or test one at a time, each with its own **badge**
  (🥉 20+, 🥈 25+, 🥇 27+, 💎 30/30 on that section's 30-question test).
- **Mock exam** in the real format: 30 questions across sections, 30-minute clock,
  pass mark 3 mistakes, numbered question badges to jump around, answers changeable
  until you submit.
- **Mistake drilling** — re-runs only the questions you last got wrong.
- **Progress saved per device** for 60 days of inactivity, then deleted automatically.

## Running it

### On this Mac — double-click `Start-DGT.command`

Starts a small local web server, opens the app, and prints an address you can open on
your **phone** over the same Wi-Fi. This is the recommended way: a real `http://` address
means every browser saves your progress reliably. Leave the terminal window open while
you study; close it when you are done.

### Or just open `Test-DGT.html`

Double-click it. The whole app and all 2,947 questions are inlined in that one file, and
the photos are read from `public/img/`, so keep the two together. Progress still saves in
Chrome and Safari; if a browser blocks storage for local files the app says so at the top.

### Or run the dev server

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # production build into dist/
npm run build:offline  # regenerate Test-DGT.html after changing code or data
```

## Tests

```bash
npm test          # 11 unit tests on the state machine (counting invariants, badges, queues)
npm run test:e2e  # 24 browser checks on an iPhone 12 viewport and on desktop
npm run test:file # verifies the single-file build works from file://
```

The unit tests are the guard against miscounting: they assert that one answer produces
exactly one attempt, that a submitted paper grades exactly 30 answers once, that a locked
answer cannot be changed while a test answer can, and that resuming lands on the first
unanswered question.

## How it is put together

```
src/state/store.js       reducer + selectors + persistence. All state lives here and every
                         transition is a pure function, so nothing can double-count.
src/state/badges.js      badge tiers
src/ui/QuizScreen.jsx    question view: photo, options, feedback, numbered badge strip
src/ui/CheckpointScreen  the every-10-questions review
src/ui/ResultScreen      test result with per-section breakdown and full review
src/ui/HomeScreen        progress ring, quick actions, the 14 sections
src/ui/TestsScreen       mock exam + one 30-question test per section
src/ui/ProgressScreen    stats, badges, history, device storage and retention
src/lib/i18n.js          every interface string, ES + EN
src/lib/topics.js        the 14 sections
public/data/questions.json   the question bank
public/img/                  2,683 exam photographs (WebP)
scripts/                 offline build + the test suites
```

### Question format

```jsonc
{
  "i": 1,                    // id
  "img": "6288.webp",        // photo in public/img (null for text-only questions)
  "t": "estacionamiento",    // section key, see src/lib/topics.js
  "c": 2,                    // index of the correct option
  "es": { "q": "…", "o": ["…","…","…"], "e": "explanation" },
  "en": { "q": "…", "o": ["…","…","…"], "e": "explanation" }
}
```

### Saved progress

Kept in this browser's `localStorage` under `dgt.trainer.v2`, tied to a random device id
generated on first use. Nothing is sent anywhere. The record carries an expiry that moves
60 days forward every time you use the app; open it after 60 idle days and the old progress
is deleted and you start clean. "Delete my progress" on the Progress tab wipes it now.

## Where the content comes from

Questions, answers and photographs are the publicly available DGT test material, taken from
the open `anki-carnet-conducir` bank (<https://github.com/donmerendolo/anki-carnet-conducir>),
which mirrors the official DGT practice tests at
<https://sede.dgt.gob.es/es/permisos-de-conducir/test-de-examenes/>. English translations and
the added explanations were generated for this app: study aids, not official DGT text. For
anything legally binding, check the Reglamento General de Circulación. Personal study use.
