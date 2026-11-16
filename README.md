# Restie — hi-fi prototype

Restie helps you make time for what matters, with a little companion who grows alongside you, one hobby at a time.
CS 147, Autumn 2026 · Shirley Z. & Ziyu R.

Rusty, an orange tabby, lives in a cozy room. He learns your hobbies, helps you break goals into tiny steps, checks in
without guilt, works beside you on a quiet timer, and keeps your memories on his wall.

Built with **Expo SDK 58 (React Native + TypeScript)**, **Supabase** (anonymous auth, Postgres, Storage, Edge Function),
**Claude** (Rusty's replies, via the Edge Function) and **React Native Skia** (Rusty's animated puppet).

---

## Run it

### On your phone (camera, notifications and location are real here)

1. Install **Expo Go** from the App Store / Play Store.
2. On your laptop:
   ```sh
   npm install
   cp .env.example .env.local   # fill in Supabase values (optional, see below)
   npx expo start               # add --tunnel if phone and laptop aren't on the same Wi-Fi
   ```
3. Scan the QR code with the iPhone Camera (or Expo Go on Android).

### In a browser (for the class website / usability tests)

```sh
npm run build:web        # → dist/
npx serve -s dist        # try it locally
```

`dist/` is a static site — upload it to the team's AFS folder. Rusty's puppet needs `canvaskit.wasm`, which is copied
into `public/` by `npm install` and from there into `dist/`. If the site lives in a subfolder (e.g.
`/class/cs147/projects/.../Restie/app/`), set `"experiments": { "baseUrl": "/class/cs147/projects/.../Restie/app" }` in
`app.json` before building.

### Without Supabase

Leave `.env.local` empty and everything still works on-device: data persists locally, and Rusty answers with
hand-written offline replies. Good for quick demos; set up Supabase for real AI and sync.

---

## Supabase + Claude setup (once)

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers → enable "Anonymous sign-ins".** Restie has no login screen; each device gets
   a private anonymous account, and Row Level Security keeps each person's rows private.
3. **SQL Editor** → paste and run `supabase/migrations/20261113000000_init.sql` (tables, RLS policies, private
   `keepsakes` photo bucket), then `supabase/migrations/20261114000000_substeps.sql` (substeps on steps).
4. **Project Settings → API**: copy the URL and the publishable (anon) key into `.env.local`.
5. Deploy Rusty's brain and add your Anthropic API key (it stays on the server, never in the app):
   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_REF
   npx supabase functions deploy rusty
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # optional: npx supabase secrets set RUSTY_MODEL=claude-sonnet-5-5   (default: claude-opus-5-5)
   ```

Settings → "Your data" shows whether sync is working.

---

## Words we use (one vocabulary everywhere — `src/copy.ts`)

| Word | Means | Example |
| --- | --- | --- |
| Hobby | something you love doing | Guitar |
| Goal | what you're working toward | Play the movie song |
| Milestone | a stage on the way to the goal | Learn verse 3 |
| Step | one small thing you can do in a sitting | Find chords for verse 3 |
| Substep | a checklist item inside a step | Look up the chord chart |
| Paw promise 🐾 | a step with a day you promised Rusty | 🐾 Today · 10 min |
| To-do | an everyday, non-hobby thing | Problem set 6 |

Progress always reads "*n* of *m*" with a bar. Milestones are only marked done by you (Rusty asks when every step is
done). Every completion, deletion and milestone change has **Undo**.

## What you can do (tasks)

| Task | Steps |
| --- | --- |
| **1 · Log progress (simple)** | Home → **Log** → pick the step. Or Hobbies → Rusty check-in → **Did it**, or tick a step's box on the hobby page. The **Step done** screen lists the milestone's steps ("3 of 4 steps", this one marked *just now*), offers **Undo**, and — if it was the last step — asks whether the milestone is done. "See guitar's path" opens the hobby. |
| **2 · Start a new hobby (moderate)** | Hobbies → **+ New hobby** → chat with Rusty (tap any earlier answer to change it, or skip): pick or type a hobby → "Working toward a goal" → pick/type a goal → Rusty suggests a path (editable) → pick a tiny first step → when → plan summary → **🐾 I promise**. A new card appears and an object shows up in Rusty's room. |
| **3 · Get unstuck + save a keepsake (complex)** | Press and hold Rusty (or tap the **!** / 💬 badge next to him) → **Talk to Rusty** → "Don't know where to start" → **Do it now with me** → Start → (timer) → **Did it** → **Save a keepsake** → take a photo → caption → Save → **Pin**. The photo hangs in Rusty's wall frames. |

Also: the **hobby page** is the hobby's path: each milestone shows "2 of 4 steps" and opens to its steps; tick a step to
mark it done (Undo in the toast); tap a step to rename it, add/check/reorder **substeps**, give it a day (paw promise) or
none, move it to another milestone, or delete it; **Edit path** renames, reorders, adds and removes milestones; "Step
ideas from Rusty" and "Break it down with Rusty" suggest steps and substeps. The **bottom nav** is on every page except
onboarding, the camera and the focus timer. **To-dos** (two sections: 🐾 paw promises (hobby steps) and everyday to-dos; when your day is full Rusty suggests an everyday to-do that can wait, never a promise), **Keepsakes**
(photos, notes, Rusty's souvenirs from his walks; pin up to 3 to the wall), hobby pages (edit goal and milestones, plan
steps, rest or delete a hobby), the **"Not yet" ladder** (move it → make it smaller → let it go), **Settings** (reminders,
location, demo speed, room preview, replay tour, load demo, start over).

**Help:** the **?** on Home (and Settings) opens *How Restie works*; Rusty's menu and Settings have **Something's not
right? Tell Rusty** (undo today's logs, or send the team a report, saved with the profile).

**First run:** onboarding (name → interests → permissions) and then Rusty's guided tour of Home, which spotlights each
control. The spotlighted control really works: open it, and Back (or the Home tab) returns you to the same tour step.
Replay it from Settings.

**Usability tests:** on the welcome screen tap **"Explore with demo data (Sam)"** (or Settings → Load Sam's demo) to get
the med-fi state: Guitar + Drawing in progress, "Find chords for verse 3" due today, a full to-do list. Turn on
Settings → **Demo speed** so the focus timer runs 20× faster.

---

## How it's built

```
src/app/            screens (Expo Router). (tabs)/ = Home, Hobbies, To-dos, Keepsakes
src/room/           Rusty's room: hotspots, hobby objects, sky + lighting
src/rusty/          the puppet (Skia shader), rig data, brain (what he does), personality lines
src/ai/rusty.ts     calls the `rusty` Edge Function; every call has an offline fallback
src/data/           types, zustand store (local-first), Supabase sync, selectors, actions, demo seed
src/world/          sun phase + Open-Meteo weather
src/tutorial/       first-run tour (coach marks)
supabase/           schema migration + Edge Function (Claude)
scripts/cutout-frames.py   removes the paper background from puppet frames
art/                source art (med-fi exports, puppet frames)
```

- **Storage:** writes land in a zustand store (cached on-device with `expo-sqlite`'s localStorage) and sync to Supabase
  in the background (outbox push + incremental pull, last-write-wins). The app never waits on the network.
- **Rusty's puppet:** one painted frame per pose, warped by an SkSL shader (breathing, blinking, head turn, tail sway),
  ported from our WebGL prototype. Poses crossfade. **Tap** him to play (head = pet with hearts, body = boop; many
  taps in a row make him giddy). **Press and hold** him, or tap the **!** badge, to open his menu (talk, check-in).
- **Rusty's life:** every 20–40 s he picks something to do based on time of day, weather and your hobbies (paints if you
  draw, bakes if you bake), hops to that spot, and sometimes says something. He sleeps late at night. Once a day he may
  come back from a walk with a souvenir keepsake.
- **AI:** modes `chat`, `goals`, `path`, `steps`, `lines`, each with a JSON schema (structured outputs) and a character
  prompt that encodes our design values (no guilt, tiny steps, never "productivity").

### Adding art

- **Rusty's movement** has two layers (`src/rusty/RustyActor.tsx`):
  - the **live puppet** (one painted frame per pose, warped by a Skia shader: breathing, blinking, head turn, tail
    sway) for sitting and quick reactions;
  - **sprite sheets** for everything in between: sit → paint / bake / nap / daydream, and walking left / right / up /
    down. Every change goes through sitting (action → sit → stand up facing the way → walk cycle while he moves → stop
    and sit → next action); the walk cycle advances with distance walked so his feet don't slide. Every move starts
    and ends on the puppet's own drawing, and between drawings are morphed in-betweens (each drawing warped toward the
    next), so the moves flow and the handoff to the live puppet doesn't change the picture. The long part of each
    activity is the puppet's own pose (stirring paw, brush arm, thought cloud). He rests in the `neutral` pose, which
    shares its body with every tap reaction, so petting only changes his face. To regenerate sheets, see
    `art/sprites/PROMPT.md`.
- **Sprite sheets:** 1536×1024, transparent, 4×2 cells of 384×512, frames left→right, top→bottom. Activity sheets:
  frame 1 sitting → frame 8 doing it. Walk sheets: frames 1–4 walk cycle, 5–8 stop and sit. Put them in
  `art/sprites/sheet-<name>.png` and run `python3 scripts/build-sprites.py` (~4 min). For each sheet it:
  - gives each frame back the parts of its drawing that cross the grid lines;
  - fits both ends of the move onto the puppet's drawings (outline + eye positions) and eases the frames between;
  - color-matches the fur: the start toward the puppet's sitting pose, the end toward the pose that takes over;
  - morphs every pair of neighbouring drawings (optical flow, 2 in-betweens) and adds the puppet's drawings at the ends;
  - packs the frames into `assets/rusty/sheets/*.webp` and writes `src/rusty/sheets.gen.ts` (frame rects, head
    position per frame for the "!" badge and speech bubble, and each move's frame list). Timing is in
    `src/rusty/sprites.ts`.
- **New puppet pose:** 1000×1000 frame on a cream background → `art/puppet/`, run
  `python3 scripts/cutout-frames.py art/puppet assets/rusty/frames 640`, add it to `FRAMES` and `RIG` in
  `src/rusty/rig.ts`.
- **Demo it:** Settings → **Make Rusty…** sends him to paint, bake, nap, daydream or sit somewhere right away.
- **The room** (`src/room/`): `layout.ts` has every position (measured on `art/visual-refresh/room/room-day.png`),
  `Sky.tsx` the window (sky, view, weather behind the cut-out glass) and the light (sun patch, night painting with the
  desk lamp, the same light on Rusty and objects), `Room.tsx` puts it together. Each hobby has a home whose object grows
  in 3 stages (added → first milestone → three milestones). New room art: `python3 scripts/build-room.py` cuts the
  window glass out, enlarges the cat bed, fits the outside view and splits the hobby strips into stages. Prompts:
  `art/room/PROMPT.md`. Settings → **Preview the room** shows any time of day / weather.

---

## Wizard of Oz / hard-coded (for the A8 README)

- The **demo data (Sam)** is preset (hobbies, milestones, history, four keepsakes) — only when you choose it.
- **Demo speed** (optional) shortens timers.
- **Offline Rusty:** without Supabase/API key, replies, goal ideas and paths come from hand-written templates.
- Rusty's poses are a fixed set of 16 puppet frames plus 8 sprite sheets; reactions (pet, poke) show only while he's sitting.
- Hobby objects in the room exist for 6 hobby types; other hobbies show only on the corkboard.

## Limitations

- No home-screen widget yet (needs a native development build, not Expo Go).
- No calendar import; "busy days" come from the in-app To-dos.
- Notifications: local only (no push); on the web, no reminders.
- One person per device; anonymous accounts don't carry over to a new phone.

## Accessibility

- All controls have labels and roles; Rusty's speech bubble and toasts are announced (live regions).
- Touch targets ≥ 44 pt; text respects Dynamic Type (capped at 1.6×); body text 17 pt.
- Reduce Motion lowers Rusty's animation and turns off particles and rain.
- Colors follow the med-fi design system (dark brown on cream, ≥ 4.5:1 for text). Orange accent is never used behind text.
- Known gaps: the room is visual-first (each hotspot is labeled, but the scene itself isn't described in detail); the
  puppet canvas isn't reachable by screen readers except as a single "Rusty" button.

## AI use

Implementation was done with Claude Code (Anthropic), credited per the A8 policy. Rusty's in-app replies are generated by
Claude via the `rusty` Edge Function.
