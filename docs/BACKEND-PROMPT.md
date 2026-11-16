# Prompt: finish Restie's backend (Supabase + Claude)

Paste everything below the line into a fresh coding agent session at the repo root, for example Claude Code. It is
self-contained.

---

You are finishing the backend of **Restie**, an Expo SDK 58 / React Native 0.88 app (Expo Router, zustand,
Reanimated, Skia). It's a CS147 project at Stanford, with usability tests on real phones through Expo Go.

Restie helps busy people make time for hobbies without guilt. The person keeps hobbies, each with a goal, 3–5
milestones and tiny steps. A step with a day is a "paw promise". There are also everyday to-dos and photo keepsakes.
**Rusty**, an orange tabby, lives in a room on Home and talks with the person.

## What already exists (read these first)

- `src/lib/supabase.ts`: the client. It's `null` when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  are missing; the app then runs fully on-device. `ensureSession()` signs in anonymously.
- `src/data/store.ts`, `src/data/types.ts`: the local-first store (persisted). Every write goes to an **outbox**.
  `src/data/sync.ts` pushes the outbox (last write wins on `updated_at`), pulls changes, and uploads keepsake photos
  to the private `keepsakes` bucket (`<user_id>/<keepsake_id>.jpg`).
- `supabase/migrations/*.sql`:
  - tables: `profiles`, `hobbies`, `milestones`, `tasks`, `keepsakes`, `activities`, `messages`, `focus_sessions`;
  - Row Level Security with `user_id = auth.uid()`;
  - storage policies for the photo bucket.
- `supabase/functions/rusty/index.ts`: a Deno Edge Function that calls Claude.
  - Modes `chat | goals | path | steps | lines`, each with a JSON schema (structured outputs).
  - The system prompt (Rusty's character) is cached.
  - It uses a per-mode `effort` and the server-side fallback beta.
  - JWT verification is on.
  - The key comes from the `ANTHROPIC_API_KEY` secret; the model from `RUSTY_MODEL` (default `claude-opus-5-5`).
- `src/ai/rusty.ts`: the client side. It builds a short context, calls `supabase.functions.invoke('rusty')` with a
  time-out, and falls back to hand-written lines (`src/rusty/personality.ts`) on any failure.
- `src/rusty/life.ts`, `src/rusty/brain.ts`: Rusty's planned day and trips (device-side, deterministic per date).
  `profile.mind` holds `lines`, `tripIdea`, `tripDone`, `lastTripAt`, `skipLedger`, `lessons`, `reports`.

## Hard rules

1. **The Anthropic API key never ships in the app** (no `EXPO_PUBLIC_*` for it, nothing in the bundle). It lives only
   as a Supabase secret. The project owner sets it themselves; never ask for it or print it.
2. **Expo Go compatible.** No new native modules. Use `npx expo install` for any package; read
   `https://docs.expo.dev/versions/v58.0.0/` before touching Expo APIs.
3. **Offline first.** Every AI call keeps a hand-written fallback, and the app must work with Supabase unset.
4. **Privacy.**
   - Send the model only the context it needs: hobby names, goals, milestones, this week's steps, Rusty's lessons.
     No photos, no device info.
   - No personal data in function logs.
   - RLS on every table and bucket.
5. **Voice.** Never "tasks" or "productivity" in user-facing words; no streaks or guilt (see `src/copy.ts`).
6. Run `npx expo lint` and `npx tsc --noEmit` before calling anything done. Don't commit unless asked.

## Work to do

### A. Make it run end to end (document every step in `supabase/README.md`)
1. Link and deploy:
   ```
   supabase link
   supabase db push
   supabase functions deploy rusty
   ```
   Then confirm Anonymous sign-ins are enabled and the `keepsakes` bucket exists and is private.
2. A smoke-test script, `scripts/smoke-supabase.ts` (run with `npx tsx`, using env vars):
   - sign in anonymously;
   - insert and read back one row per table;
   - prove that another anonymous user can't read it (RLS);
   - upload and read a photo;
   - call each `rusty` mode and validate the JSON shape.
3. Make sure `profiles.mind` round-trips: it's JSON, and the newer fields `tripIdea`, `tripDone` and `reports` must
   survive sync. Add a migration if any column is missing; never edit old migrations.

### B. Sync you can trust
1. **Pull on foreground and on Home focus** (debounced), not only at start. Keep the push → pull order.
2. **Deletes:**
   - verify tombstones (`deleted_at`) sync both ways;
   - verify a row deleted on device A disappears on device B;
   - add a cleanup (SQL job or function) that hard-deletes tombstones older than 30 days.
3. **Conflicts:** keep last-write-wins per row. Use a server `updated_at` trigger so client clocks can't win
   unfairly, and have the client accept the server value after push.
4. A visible but quiet **sync state**: Settings shows "Saved to your account / Saved on this phone / Syncing…" from
   `syncStatus`.
5. Retry with backoff; never block the UI; never lose outbox items when the app is killed mid-sync.

### C. Accounts: "Save your room"
Anonymous users lose everything when they reinstall. Add an optional upgrade that **links** the anonymous user, so
data stays attached to the same `user_id`:
- email one-time code via `supabase.auth.updateUser({ email })` plus `verifyOtp`;
- Sign in with Apple only if it works in Expo Go; otherwise email only, with a note.
- Settings gets "Save your room" (with a reason: keep Rusty when you switch phones) and "Sign in on another phone"
  (an email code that pulls the room down).
- Handle "this email already has a room": offer to switch to it, warning that the local unsynced room will be
  replaced, with a confirm step.

### D. Rusty's brain (the Edge Function)
1. **Models.** Keep `RUSTY_MODEL` (default `claude-opus-5-5`). Add an optional `RUSTY_MODEL_FAST` for the small,
   frequent modes (`lines`, `goals`, `steps`). If it's unset, fall back to `RUSTY_MODEL`. Document the cost trade-off.
   Keep structured outputs, the cached system prompt, per-mode `effort`, and the server-side fallback.
2. **Chat streams.** Stream the `chat` mode to the client (server-sent events from the function; the client shows the
   reply as it arrives). Keep the non-streaming JSON path as a fallback for the suggestion card.
3. **Limits.**
   - Per-user rate limit in a `rusty_usage(user_id, day, calls, input_tokens, output_tokens)` table, for example
     60 calls a day and a maximum of 4 a minute. Return 429 with a friendly code; the app then uses offline lines and
     Rusty says he's "napping, try again in a bit".
   - Cap input size: context at most 6 000 characters, at most 16 earlier turns.
   - Server time-out of 25 s.
4. **Safety.** If a message suggests the person may be in crisis (self-harm, abuse, emergencies), Rusty answers gently
   and briefly, points to real help (988 in the US; a general "local emergency number" otherwise), and doesn't try to
   counsel. Add it to the system prompt *and* a light server-side keyword check that adds a `care: true` flag; the app
   then shows a small resources card under the message. Write 10 test messages covering this.
5. **New modes.**
   - `postcard`: given a trip place, a 1–2 sentence postcard from Rusty plus a 5-word caption.
   - `recap`: a monthly diary page from Rusty about what you both worked on (input: that month's activities and
     milestones; no numbers or percentages in the output).
   - Update `lines`: it now always returns a souvenir idea, because the app plans trips itself.
6. **Logging without personal data.** Log mode, latency, tokens, stop reason and error class only. Add a tiny eval set,
   `supabase/functions/rusty/evals.json`: 20 inputs across modes with expected properties (e.g. "no streak language",
   "≤ 3 sentences", "steps start with a verb"), plus a script that runs them and prints pass/fail.

### E. Client polish (`src/ai/rusty.ts`)
- One shared `invoke` helper:
  - time-out of 12 s (chat) or 8 s (others);
  - one retry on network errors only;
  - parse and validate the JSON shape;
  - offline fallback on any failure;
  - never show raw errors to the person.
- Build the context from the store with a strict budget. Include Rusty's `lessons` (things the person told him).
- Cache `lines` once a day (already done) and `goals` / `path` per hobby name for a day.

### F. Reminders (optional, after A–E)
Promise check-ins are local notifications today (`src/lib/notifications.ts`). Keep them local. Add only "Rusty is back
from his trip" as a *local* notification scheduled at the trip's end time (no server push needed). Respect quiet
hours (10 pm–8 am) and the Gentle reminders switch in Settings.

## Done means
- **Fresh install:**
  - anonymous user created;
  - make a hobby with Rusty's suggested path (AI);
  - add a paw promise;
  - take a keepsake photo;
  - everything appears in the Supabase tables and bucket under that user.
- **Second device:** after "Sign in on another phone", the same room appears: hobbies, promises, keepsakes and
  photos.
- **Offline:** airplane mode — everything works, Rusty uses his offline lines, and the outbox syncs when back online.
- **Edge cases:**
  - a rate-limited user gets offline lines, not an error;
  - the crisis test messages produce the care card.
- `npx expo lint` and `npx tsc --noEmit` pass; `scripts/smoke-supabase.ts` and the eval script pass.
- `supabase/README.md` explains setup in under 15 steps for a teammate.
