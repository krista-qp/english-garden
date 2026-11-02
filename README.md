# Angļu dārzs

A small web app that teaches English to a Latvian speaker on an Android phone, with the focus on speaking. Progress is a garden: each phrase is a plant that grows as it is reviewed. Krista's page (`krista.html`) shows progress, exchanges messages and publishes a weekly topic.

The design decisions are in [`BUILD_BRIEF.md`](BUILD_BRIEF.md). Lessons live in [`content.json`](content.json), the only file you edit to change lessons.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `js/main.js` | The learner's app (all screens, Latvian UI) |
| `krista.html`, `js/krista.js` | Krista's page: progress, inbox, messages, weekly topic |
| `content.json` | Units, phrases, dialogues, sound lessons |
| `config.js` | Firebase web config (public). `null` = offline, this device only |
| `js/check.js` | Speech check ("understood" / "try once more") |
| `js/srs.js` | Review schedule (1, 3, 7, 14, 30 days) |
| `js/garden.js` | The garden drawing (SVG) |
| `js/sync.js`, `js/fb.js` | Firestore sync with an offline outbox |
| `sw.js`, `manifest.webmanifest` | Offline cache and home-screen install |

No build step. Plain HTML, CSS and ES modules.

## Try it locally

```bash
python3 -m http.server 8080
```

Open http://localhost:8080 in Chrome. Without a Firebase config the app runs fully offline and keeps everything on the device.

## Tests

```bash
npm test
```

Unit tests for the speech check, the review schedule and the `content.json` structure (Node 20+, no dependencies).

## Setup (once)

1. **Firebase:** create a project, add Firestore (production mode) and enable **Anonymous** sign-in under Authentication. Paste these Firestore rules:
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
2. **Config:** in Project settings → Your apps, add a Web app and paste its config object into `config.js`.
3. **GitHub Pages:** Settings → Pages → deploy from the `main` branch, root folder.
4. **Family key:** open `…/krista.html` and press "Izveidot jaunu atslēgu". It shows the key and both join links. Keep the key private; it never goes into the repo.
5. **Mum's phone:** open `…/#join=<key>` in Chrome, then menu → *Add to Home screen*. Allow the microphone the first time she presses Runāt.
6. **Your device:** open `…/krista.html#join=<key>`.

After that the `#join` part is stored on the device and removed from the address bar.

## Weekly topic (Saturday)

On `krista.html`: type the topic, press **Kopēt uzvedni Claude** (it copies the prompt with `content.json` attached for reference), paste Claude's JSON reply, press **Priekšskatīt**, check it, then **Publicēt**. It becomes the first unit in her next lesson.

## Notes

- The English voice can be changed in Iestatījumi → Angļu balss. The list shows the British voices installed on that phone; more can be added in the phone's text-to-speech settings.
- Speech recognition on Android Chrome needs internet. Offline, or if the microphone is refused, every speaking step falls back to "Pateicu".
- After changing app files, bump `CACHE` in `sw.js` so phones drop the old cache sooner. The app already fetches fresh files whenever it is online.
