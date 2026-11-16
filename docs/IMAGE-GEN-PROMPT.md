# Prompt: Rusty's image generation (capped), new hobby icons and objects

Paste everything below the line into a fresh coding agent session at the repo root. It assumes the backend from
`docs/BACKEND-PROMPT.md` exists: anonymous auth, the `rusty` Edge Function, and the private storage bucket.

---

You are adding **image generation** to Restie, an Expo SDK 58 app (read `AGENTS.md` and `docs/BACKEND-PROMPT.md`
first). The project owner connects their own image model and sets their own spending cap. Your job is the pipeline
around it: what gets generated, how it's checked, and how the app uses it.

## What to generate

1. **A new hobby's art**, when someone adds a hobby Rusty has no art for. The built-in set is guitar, drawing, baking,
   reading, writing, gardening and other (`src/assets.ts`, `iconFor()`).
   - **Icon:** a round, sticker-like hobby icon in the style of `assets/hobbies/*.png`, used on cards and chips.
   - **Room object, 3 growth stages:** like `art/visual-refresh/room/obj-*.png`. It has a *home* in the room
     (`src/room/layout.ts` `HOMES`): reuse the closest existing home by type (desk item, floor item, wall/sill item),
     or the basket under the desk.
2. **Optional illustrations** for Rusty's diary pages and trip postcards (`src/rusty/journal.ts`,
   `art/life/PROMPT.md`), only within the cap.

## Hard rules

- **Never in the client:** the image model key or endpoint. Generation runs in an Edge Function (new mode `image`
  in `supabase/functions/rusty`, or a separate `rusty-image` function) behind the user's JWT.
- **The cap is the owner's.** Read it from an env var (`IMAGE_MONTHLY_CAP`, e.g. 6 per person per month) and enforce
  it server-side in a `rusty_image_usage(user_id, month, count)` table. At the cap:
  - return `{ error: 'cap' }`;
  - the app quietly uses the built-in "other" art;
  - Rusty says "I'm out of paint this month. I'll draw it soon."
  - Regenerating counts against the cap.
- **Offline first.** Every place that shows generated art falls back to bundled art, instantly, with no spinner
  blocking the UI.
- **Expo Go compatible.** No new native modules. Show images from signed URLs with `expo-image` and cache them.

## The pipeline (server)

For each request (`kind: 'icon' | 'object' | 'illustration'`, `hobby`, optional `stage`):

1. **Reuse first.**
   - If the hobby maps to a built-in icon (extend `iconFor` with a quick model classification: "pottery" → other,
     "ukulele" → guitar), return the built-in. This costs no generation.
   - Also check a shared, de-duplicated cache of previously generated, approved art for the same normalized hobby
     name, for example `generated_assets` rows marked `shared = true` with the owner's consent setting.
2. **Generate**, using a fixed prompt template plus **style references**: 2–3 existing assets of the same kind passed
   as reference images. Templates live in `supabase/functions/rusty/image-prompts.ts`:
   - **Icon:** "a watercolor sticker of {thing for hobby}, same style as the references: soft paper texture, thin brown
     outline, muted warm palette, centered, transparent background, no text".
   - **Object strip:** the 3-stage prompt from `art/room/PROMPT.md` §3, with the stages filled in by the text model
     ("pottery: a lump of clay → a small wobbly bowl → a shelf of three glazed pots").
3. **Automatic quality checks.** Run them all, then retry at most twice, feeding each failure back into the prompt.
   - **Cut-out:**
     - background really transparent (corners alpha = 0);
     - no halo: edge pixels not near-white;
     - at least 40 px margins;
     - for strips, exactly 3 separate pieces, split by thirds.
   - **Relevance:** a vision model answers "Does this show {thing} for the hobby {hobby}? yes/no + reason".
   - **Style fit:** a vision model compares against the reference images using a written rubric:
     - palette within the room's (no neon);
     - outline thickness and color;
     - watercolor texture;
     - perspective (slightly from above, like the furniture);
     - no text.

     It scores 1–5 per item; pass = every item ≥ 4.
   - **Room fit (objects only):**
     - composite the stage-2 object onto `assets/room/day.webp` at its home spot, at the home's height;
     - ask the judge whether it sits on the surface and matches the scale and light of the room;
     - check that it doesn't cover the clock, corkboard, frames or door hotspots.
4. **Store it.**
   - Upload to a private `generated` bucket.
   - Insert into `generated_assets(id, user_id, hobby_id, kind, stage, path, prompt, model, qa jsonb, status)`:
     `status` is `ready` or `failed`.
   - Never log the image or the full prompt with personal text.
5. **Return** `{ status, url (signed, 7 days), qa }`.

## The app

- **A single lookup.** `src/assets.ts` `hobbyArt(hobby)` returns `{ icon, objects: [stage1, stage2, stage3] }`:
  generated art when there is a `ready` row, built-in otherwise. Hobby cards, chips, `src/room/objects.ts` and
  `Room.tsx` all go through it.
- **Generate when needed.** When a hobby is created (`createHobby`) with no built-in match, start generation in the
  background. Until it's ready, the room shows the basket.
- **Rusty asks before anything goes in his room.** When generation finishes, Rusty says "I drew something for your
  {hobby} corner. want to see?" A small sheet shows the icon and the 3 stages.
  - **Keep it:** the art becomes active.
  - **Try again:** shows how many redraws are left this month.
  - **Use the basket:** keeps the built-in art.
- **Settings shows the budget.** "Rusty's paints: 4 of 6 left this month", with no prices.
- **Diary and postcard illustrations** (optional) use the same function with `kind: 'illustration'`. They're only
  generated if there's budget left after hobby art, and the text page always works without them.

## Done means

- Creating "Pottery" gets the user, within the cap:
  - an icon and 3 object stages that pass all checks;
  - shown for approval;
  - placed at a sensible home in the room.
- At the cap, everything still works with built-in art and Rusty's "out of paint" line.
- **Tests:**
  - a script runs the QA checks against the existing approved assets, which must pass, and against 5 deliberately bad
    images (white background, neon colors, text, wrong subject, too big for the home), which must fail;
  - `npx expo lint` and `npx tsc --noEmit` pass.
- `supabase/README.md` documents the env vars (`IMAGE_MODEL_*`, `IMAGE_MONTHLY_CAP`) and how to turn the feature off.
