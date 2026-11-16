# Regenerating Rusty's transition sheets

Why the current sheets look janky: their 8 frames aren't in-betweens of one
drawing. Eyes point a different way in every frame, stripes and head shape
change, and none of them start or end on the puppet's drawings. The app now
uses sheets only for the short moves, lets the puppet do the looping part, and
fits each end of a sheet onto the puppet's drawing (scripts/build-sprites.py),
but every handoff is still a swap between two different drawings.

The fix is transitions that **start and end on the puppet's own drawings**.
The app then hands off with no visible change.

## What to make

| Sheet file (`art/sprites/`) | Attach as image A (frame 1)  | Attach as image B (frame 8)     |
| --------------------------- | ---------------------------- | ------------------------------- |
| `sheet-cook.png`            | `art/puppet/neutral.webp`    | `art/puppet/cook.webp`          |
| `sheet-paint.png`           | `art/puppet/neutral.webp`    | `art/puppet/paint.webp`         |
| `sheet-think.png`           | `art/puppet/neutral.webp`    | `art/puppet/think.webp`         |
| `sheet-sleep.png`           | `art/puppet/neutral.webp`    | (none: curled up on the floor)  |
| `sheet-walk-left.png` etc.  | `art/puppet/neutral.webp`    | (it is frame 8: stop and sit)   |

Loops are not needed. The app animates the puppet's cook/paint/think poses
itself (breathing, blinking, stirring paw, brush arm).

## Method that works: edit one frame at a time

Image models can't keep 8 drawings identical in one go. They can keep one
drawing identical while changing a small part. So build each sheet frame by
frame, every time **editing the previous frame**, then lay the 8 frames out
on the grid yourself (or ask me to).

### Prompt for each in-between (attach the previous frame and image B)

> Edit the attached image of the cat (image 1). Make the next frame of a
> smooth animation toward the pose in image 2. Move only these parts, and only
> about one-sixth of the way: **[e.g. "the right front paw lifts toward the
> bowl and the body leans 5° forward"]**.
>
> Keep everything else pixel-identical to image 1:
> - the face: same eye shape, size, spacing and pupil direction (both eyes look the same way as in image 1), same mouth, same blush
> - the stripes: same count, positions and widths
> - the colors, line weight, watercolor texture and outline color
> - the size of the cat, and its feet on the same baseline
>
> Do not mirror or flip anything. Do not redraw the cat or change the style.
> Transparent background, no shadow, no floor, no text. Same canvas size as
> image 1, with the whole cat and any props at least 40 px from every edge.

Plan the 6 in-betweens before you start. Write one line per frame for which
parts move. Each step should be small and even, for example:

- **cook:** 2 paws reach forward · 3 bowl appears in paws, low · 4 bowl lifts · 5 body rises from sitting · 6 standing, bowl at chest · 7 spoon paw comes up
- **paint:** 2 turns toward the easel · 3 rises onto hind legs · 4 standing · 5 palette paw comes up · 6 brush paw lifts · 7 brush reaches the canvas
- **think:** 2 head starts tilting up · 3 eyes look up · 4 head tilted, eyes up · 5 one paw lifts slightly · 6 thought cloud appears small · 7 cloud grows

### Prompt for a whole sheet at once (faster, less consistent)

Use this only if the frame-by-frame method is too slow. Check every frame
against image A, and redo any frame whose eyes, stripes or colors drift.

> Create an animation sprite sheet of the cat in image A turning into the pose
> in image B. 1536×1024 px, transparent background, 4 columns × 2 rows of
> 384×512 cells, read left→right then top→bottom. Frame 1 is an exact copy of
> image A, frame 8 is an exact copy of image B, and frames 2–7 are evenly
> spaced in-betweens where only the limbs, body angle and props move.
> In every frame the cat has exactly the same face (eye shape, size, and both
> pupils looking the same direction), the same stripes, colors, line weight
> and size, and its feet on the same baseline. Nothing is mirrored. Every
> drawing stays fully inside its own cell with 24 px of empty space around
> it; nothing crosses into a neighbouring cell. No shadow, floor or text.

### Walk sheets

> Same cat as image A (copy its face, stripes, colors and line weight
> exactly). Sprite sheet, 1536×1024, transparent, 4×2 cells of 384×512.
> Frames 1–4: a 4-frame walk cycle seen from the **[left side / right side /
> back / front]**, loopable (frame 4 flows into frame 1), the head steady and
> the same height in all four. Frames 5–8: he stops and sits down, and frame 8
> is an exact copy of image A. Every drawing fully inside its own cell with
> 24 px of space around it.

## After you have them

Put them in `art/sprites/` with the same names, run
`python3 scripts/build-sprites.py`, and reload. The script handles scale,
alignment, color matching and stray pieces. A new sheet whose last frame is
the puppet's pose will hand off with no visible change.
