# Angļu dārzs: build brief

A web app that teaches English to a 68-year-old Latvian speaker on her Android phone. She understands German (A2/B1) and Russian but speaks neither, so the app's main job is getting her to speak. Her daughter, Krista, lives in Sweden and uses the app to stay in touch: she sends a topic every Saturday and listens to her mother's spoken answers.

Concept doc (product reasoning, kept up to date): https://claude.ai/artifact/FPVPGrz6MimdjSVJj5Posj
Lesson content: `content.json` in this folder (3 units, 30 phrases, dialogues, sound lessons).

## Fixed decisions

- **Platform:** a standalone web app (PWA) on GitHub Pages, installed to her home screen from Chrome on Android. No app store.
- **Interface language:** Latvian everywhere. English appears only as the thing being learned.
- **English:** British. The pronunciation model is the browser's `en-GB` speech-synthesis voice; Krista's own voice comes later.
- **Sound hints:** each phrase has a hint line in Latvian letters (`hint`). Letters in `[brackets]` are underlined: they mark th and w, which have no Latvian letter. Hints show while she hears and repeats a phrase, and are hidden in review and dialogues.
- **German:** every card shows the whole phrase in German (`de`), with its own play button (`de-DE` voice), plus a cognate hook (`hook`) where one exists. No Russian.
- **Speaking is never scored.** Feedback is "understood" or "try once more", never a percentage. After two tries the app moves on: "Lieliski, ejam tālāk."
- **Progress is a garden, not a streak.** Each phrase is a plant that grows as she reviews it. A missed day costs nothing.

## Stack

- Vanilla HTML, CSS and ES modules, with no build step, so Krista can edit `content.json` by hand.
- Firebase (free Spark plan): **Firestore** and **anonymous Auth** only. Audio is stored as base64 inside Firestore documents, because new Firebase Storage buckets need the paid plan. Keep recordings at 60 seconds or less, opus at 24 kbps (about 250 KB base64, under the 1 MiB document limit).
- `config.js` holds only the Firebase web config, which is public by design. The secret `familyId` never goes in the repo: Krista opens a one-time link `…/#join=<familyId>` on each phone, the app stores the id on the device and clears the hash. Without a config or a `familyId`, the app runs fully offline and local-only.
- A service worker caches the app shell for offline use.
- Web Speech API:
  - `speechSynthesis` for playback: `en-GB` at rate 0.9 for normal speed and 0.6 for "Lēnāk" (slower).
  - `webkitSpeechRecognition` for the speech check: `lang: 'en-GB'`, `maxAlternatives: 5`, tap to start, auto-stop on silence.
  - `MediaRecorder` for "compare my voice" and for the recordings she sends Krista. Recognition and recording must never run at the same time.
- Fallback when recognition is unavailable or denied: she says the phrase aloud, then taps **"Pateicu"** (I said it), which counts as spoken.

## Speech check

Normalise both texts: lowercase, strip punctuation, expand contractions (i'm → i am, don't → do not, it's → it is, what's → what is, that's → that is). A phrase passes if any alternative contains at least 60% of the expected tokens. A phrase of one or two tokens must match all of them, allowing hello/hallo/hullo. `{name}` is replaced with her name before comparing; if her name is not recognised, the rest of the phrase still has to match.

## Screens (all copy in Latvian)

1. **First run:** "Kā tevi sauc?" (what's your name?), one text field and one button. The name is stored and used in `{name}`.
2. **Mans dārzs (home)**
   - A greeting by time of day: "Labrīt" (good morning), "Labdien" (good afternoon), "Labvakar" (good evening), plus her name.
   - A card for an unread message from Krista.
   - The garden drawing.
   - "Šonedēļ: N teikumi angliski · N dienas" (this week: N sentences in English · N days).
   - A large **"Sākt nodarbību"** button (start lesson).
   - Secondary: **"Ceļojuma vārdnīca"** (travel phrasebook: every phrase she has met, tap to hear it at normal or slow speed, for use abroad) and **"Gribu iemācīties…"** (I want to learn…).
   - A settings button: name, German line on/off, sound hints on/off.
3. **Phrase card:** a large picture (`pic`), the English (at least 24 sp), the hint, the Latvian, and the German with its play button and hook. Buttons: **Klausīties** (listen, plays once automatically), **Lēnāk** (slower), and the primary **Runāt** (speak). An optional **Salīdzināt balsi** (compare voice) records 4 seconds and plays her recording, then the model.
   - The first time a phrase containing th or w appears, show that sound's mini-lesson (`soundLessons`) once.
4. **Review card:** the picture and the Latvian only. She says the English, and the model plays afterwards.
5. **Dialogue:** a chat-style scene. Other lines play automatically ("fast" = rate 1.05, "slow" = 0.6), and a **"Ko viņš teica?"** (what did they say?) toggle reveals the Latvian. On her turn, the first time through, two answer options are shown (the correct one and one distractor from the same unit), she picks one and says it. In later sessions there are no options.
6. **Mani vārdi (my own words):** the unit's `question` in English and Latvian. She records an answer of up to 60 seconds, plays it back, then taps **"Sūtīt Kristai"** (send to Krista) or **"Vēlreiz"** (again). Nothing is sent without that tap.
7. **Close:** "Šodien tu angliski pateici N teikumus" (today you said N sentences in English), and the garden shows what grew.

Every screen has one primary button in the lower half and a visible **Atpakaļ** (back) or **Beigt** (end) button. There are no timers and no swipes. Buttons are at least 56 dp tall, and every icon has a word. Contrast is WCAG AA or better. Leaving mid-session keeps her place.

## Session (about 10 minutes)

1. **Warm-up:** up to 5 phrases due for review (review cards).
2. **New:** up to 5 new phrases from the current unit. A `listenOnly` phrase is heard and understood, with no Runāt button.
3. **Dialogue:** the unit's dialogue, once all its phrases have been introduced.
4. **My own words:** the unit's question (or Krista's weekly question when one is active).
5. **Close.**

Unit order: Krista's newest weekly unit first, until its phrases are all introduced, then u1 → u2 → u3.

## Review schedule

Each phrase stores `{level 0–5, due, timesSaid, firstSeen}`. Passing a review raises the level by one and sets the next review 1, 3, 7, 14 or 30 days ahead for levels 1–5. Failing twice drops the level by one (not below 1) and sets the review for tomorrow. "Sentences said" counts every pass or "Pateicu", including in dialogues.

## Garden drawing

An SVG with one bed per unit, laid out as rows of plants (one per phrase that is not `listenOnly`). The plant's stage follows its level: 0 = bare soil, 1 = sprout, 2 = leaves, 3 = bud, 4–5 = flower in the unit's colour. Draw it from simple shapes, without images. A weekly-topic unit gets its own bed.

## Sync: Firestore layout

```
families/{familyId}/learner/state      {name, stats:{sentencesTotal, byDay:{'2026-11-01': 14}}, units:{u1:{introduced:n}}, updatedAt}
families/{familyId}/messages/{auto}    {from:'krista'|'learner', kind:'text'|'audio'|'request', text?, audio?(data URL), unitId?, createdAt, readAt?}
families/{familyId}/units/{unitId}     {unit (same shape as content.json units), createdAt}
```

Per-phrase review state stays local (IndexedDB) and is mirrored to `learner/state` at the end of each session, so a new phone can restore it.

Security rules (the long random `familyId` acts as the key, which is enough at family scale):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{familyId}/{document=**} {
      allow read, write: if request.auth != null && familyId.size() >= 24;
    }
  }
}
```

## Krista's page (`krista.html`, same config)

- Her mother's progress: sentences this week, days practised, units and plants grown.
- Inbox, newest first: audio answers with a player, "Gribu iemācīties…" requests, and a reply box under each.
- Send a message: Latvian text that appears on her mother's home screen.
- **Weekly topic (Saturday):**
  - Paste unit JSON, preview it as her mother will see it, then press Publicēt (publish).
  - A **"Kopēt uzvedni Claude"** (copy prompt for Claude) button copies the prompt below with the topic filled in.

Prompt template for the weekly unit:

> Make one lesson unit for Angļu dārzs as JSON in exactly the shape of the units in content.json. Topic: «TOPIC». Learner: Latvian, English A1, understands German. 6–8 short, useful British-English phrases; for each: en, lv, hint (Latvian-letter pronunciation, [s]/[z] for th, [w] for w), de (whole phrase in German), hook (English–German cognate, only if real), pic (one emoji). Add a dialogue of 6–10 lines that uses only these phrases or ones from units u1–u3 on the learner's turns, and a question that invites a spoken answer. id = "topic-YYYY-MM-DD".

## Acceptance checks

- Works on Chrome for Android, held one-handed, at 360–412 px wide, in light and dark mode.
- Fully usable offline after the first load; messages sync when the phone is back online.
- With recognition denied, every speaking step still completes through "Pateicu".
- No English instruction text anywhere in the learner's interface.
- `content.json` is the only file that needs editing to change lessons.

## Not in v1

Units 4–9 (airport, hotel, museum, getting around, about me, when something goes wrong), voice notes from Krista, a cloned voice, an AI conversation partner, photos of her own garden, and YouTube clips (planned: 30–90-second garden-design clips opened in the YouTube app at a start time; channel shortlist in the concept doc).

## Setup Krista does once

1. Create a Firebase project with Firestore (production mode) and Anonymous sign-in enabled, then paste the rules above.
2. Fill in `config.js` with the Firebase web config and deploy to GitHub Pages.
3. Make a random `familyId` of 32 or more characters, and keep it private.
4. On her mother's phone, open `…/#join=<familyId>` in Chrome, then choose Add to Home screen. Allow the microphone on first use. Open `…/krista.html#join=<familyId>` on her own phone or computer.
