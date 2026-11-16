# Rusty's room: redesign and image prompts

This file has three parts:
1. what's wrong with the room now;
2. how the redesign fixes each problem;
3. a copy-ready prompt for every new image.

Make the images in the order listed. Each prompt says which files to attach.

---

## 1. What's wrong now

| # | Problem | Why it looks janky |
| - | ------- | ------------------ |
| 1 | **Rusty is out of scale.** A sitting Rusty is taller than the desk, and the bed is tiny next to him. | He reads as a giant cat pasted in front of a dollhouse, not a cat living in his room. |
| 2 | **The useful things sit too high and too small.** The clock, corkboard and frames are in the top third of the room. The clock is in the top-left corner. | They look like decoration, not things to tap. The top-left corner is the hardest place to reach with a thumb. |
| 3 | **The floor is empty, and its bottom is hidden.** About 40% of the room is bare floor, and the "Gentle plans" card covers most of the rug. | It's wasted space, and Rusty's main spot sits half under a card. |
| 4 | **Sunlight is painted into the room.** Sun patches on the floor and lit leaves are part of the picture. | Night is just a sunny room made darker: the sun patches are still there at midnight. |
| 5 | **Rusty isn't lit like the room.** The darkening is drawn under him. | At night he glows, so he looks cut out and pasted on. |
| 6 | **Weather is a colored box on top of the window.** The painted trees stay underneath. | Rain or night looks like a mask over the window, not a sky outside. |
| 7 | **Hobby objects are stickers.** Half of them are the round hobby icons reused. They float in random spots with no surface under them, at different sizes and styles. | They look scattered, not like things Rusty owns. Nothing connects an object to where he does that hobby. |
| 8 | **Hobby icons are also on the corkboard.** | The same icons appear in two places, and the board looks cluttered. |
| 9 | **Button labels are inconsistent.** "Focus timer" and "Keepsakes" have labels; the door and window don't. "Focus timer" covers the curtain. | You can't tell what's tappable by looking. |

## 2. How the redesign fixes it

**A. Rusty's room, built to his size** (fixes 1, 2, 3)
- Furniture is cat-sized: a sitting Rusty's head is level with the desk top and the windowsill.
- That brings the corkboard and frames down to the middle of the screen. The clock moves onto the desk.
- The floor gets a rug in the middle and a cat bed in front. Everything important stays above the card's top edge.
- `layout-guide.png` shows where everything goes, with Rusty drawn to scale at each spot.

**B. Wall for buttons, floor and furniture for Rusty's life** (fixes 2, 7, 8)
- The wall holds only the tappable things, and they never change: the window (weather), the corkboard (Hobbies, To-dos), the clock (Focus), the frames (Keepsakes) and the door (walks).
- Hobbies show up only on furniture and the floor.
- The hobby icons come off the corkboard; they stay on cards.

**C. Every light comes from something you can see** (fixes 4, 5)
- The room is painted with no sunlight. The app adds the sun patch from the window by code, which moves and changes color with the time of day.
- At night it switches to a second painting where the desk lamp is on.
- One lighting layer covers the room, the objects and Rusty, so he's lit like everything around him.

| Time | Window | Sun patch on the floor | Room |
| ---- | ------ | ---------------------- | ---- |
| Dawn | pink to peach | long, pale | day painting, slightly warm |
| Day | blue | short, white-gold | day painting |
| Golden hour | amber | long, orange, strongest | day painting, warm |
| Dusk | purple to orange | fades out | day painting fades to night painting, lamp turns on |
| Night | navy, moon, stars | none | night painting |

**D. Weather happens outside the glass** (fixes 6)
- The window panes are cut out of the room painting. Behind them sit the sky (drawn by code), a painted view (a tree and hills) and the weather.
- Rain also runs down the glass. The sun patch on the floor dims or disappears with clouds and rain.

| Weather | What you see |
| ------- | ------------ |
| Cloudy | clouds drift past, sun patch soft |
| Rain | grey sky, drops on the glass, no sun patch |
| Storm | rain plus a brief flash lighting the window and floor |
| Snow | flakes outside, snow building on the outside ledge |
| Fog | the view washes out |

**E. Each hobby has a home, and it grows** (fixes 7)

| Hobby | Home | Rusty's activity there |
| ----- | ---- | ---------------------- |
| Drawing | floor between the window and the desk | paints at the easel |
| Gardening | windowsill | sits at the window |
| Baking | right half of the desk | bakes at the desk |
| Writing | left half of the desk, by the lamp | daydreams at the desk |
| Reading | beside the cat bed | daydreams on his bed |
| Guitar | gap between the desk and the door | sits by it |
| Your own hobbies | basket under the desk | — |

- Each home has **3 stages**:
  - stage 1 when you add the hobby;
  - stage 2 at its first milestone;
  - stage 3 at three milestones.
- When a stage grows, Rusty walks over and celebrates.
- When he's painting or baking, the room's own easel or bowl fades out, so there aren't two.

**F. Labels** (fixes 9): every tappable thing gets the same small label, placed where it doesn't cover the art. This one is code only, no image needed.

---

## 3. Images to make

| Order | File to save in `art/room/` | Attach |
| ----- | --------------------------- | ------ |
| 1 | `room-day.png` | `art/room/layout-guide.png`, `assets/room/room.jpg` |
| 2 | `room-night.png` | `room-day.png` |
| 3 | `window-view.png` | `room-day.png` |
| 4–10 | `obj-drawing.png`, `obj-gardening.png`, `obj-baking.png`, `obj-writing.png`, `obj-reading.png`, `obj-guitar.png`, `obj-other.png` | `room-day.png` |

Tips:
- **Size:** the room must be portrait, 941 × 1672, or the same shape (1024 × 1820, or 1024 × 1792 is close enough). I'll resize it.
- **Backgrounds:** if your tool can't make a transparent background, ask for a flat plain white one and I'll cut it out.
- **Edits:** if an edit moves furniture, redo it. Positions matter more than details.

### 1. `room-day.png`

Attach `art/room/layout-guide.png` first, then `assets/room/room.jpg`.

```text
Paint a cozy cat's bedroom in exactly the style of the second image: the same
watercolor paper texture, warm honey wood, sage green fabric, cream walls,
thin brown outlines and soft muted colors.

Follow the layout of the first image exactly. Every labeled shape is where that
object goes, at that size. The cats in the first image only show the scale:
this room's furniture is built for a cat that size. Do not paint the cats, the
labels, the red line or the grey area at the bottom.

- Left: a window with sage green curtains tied back, and a deep wooden
  windowsill under it. Through the glass, a simple leafy tree in soft daylight.
- Center: a large cork board in a wooden frame, hanging right above a low
  wooden desk. On the desk, a small round wooden clock on the left and a small
  table lamp with a cream fabric shade, switched off, on the right. The rest of
  the desk top is empty.
- Right: three empty wooden picture frames on the wall, above a small arched
  wooden door that is about as tall as the desk is wide.
- Between the desk and the door: an empty space against the wall.
- Floor: honey-colored wooden boards, a round cream rug in the middle, and a
  round woven cat bed with a sage cushion at the front left.

Lighting: even, soft daylight from no particular direction. No sun patches,
no beams of light, no leaf shadows on the floor or walls.

Portrait, 941 x 1672 px. The cork board and frames are empty. No people, no
cats, no text, no hobby items.
```

### 2. `room-night.png`

Attach `room-day.png`.

```text
Edit this image. It is the same room at night. Keep every object, its
position, size and the watercolor style exactly the same. Make only these
changes:

- The desk lamp is on. It casts a warm, soft pool of light on the desk, the
  cork board and the floor in front of the desk. The light fades gradually
  across about half the room.
- Everything outside that pool is in cool, dusky blue shadow. The room is
  cozy, not black: every object is still easy to see.
- The window glass is a flat dark navy. The curtains catch a little lamp light
  on the side facing the desk.

Do not add a moon, stars or any new objects. Same canvas size.
```

### 3. `window-view.png`

Attach `room-day.png`. This is what's outside the window. The app draws the sky
behind it and darkens it for dusk and night.

```text
Watercolor painting in exactly the style of the attached room: the view
through its window. A leafy tree branch coming in from the left edge and
another from the right edge, and soft rolling green hills along the bottom
quarter. Evenly lit, no sun, no shadows.

The sky must be completely transparent (if you can't do transparency, make
the sky flat pure white with nothing in it). No window frame, no curtains, no
clouds, no birds, no text.

Portrait, 500 x 820 px.
```

### 4–10. Hobby objects

Attach `room-day.png` to each. Every prompt makes one image with the 3 growth
stages side by side, so they come out in the same style.

**`obj-drawing.png`**

```text
Watercolor illustration in exactly the style of the attached room: the same
soft paper texture, warm wood tones, thin brown outlines and muted colors.
Draw 3 objects side by side in a row, evenly spaced, with no overlap and
plenty of empty space around each:
1. a closed sketchbook lying flat with a small cup of pencils beside it,
2. a small wooden easel holding a blank canvas,
3. the same easel holding a finished painting of soft green hills and a sun.
The easel is sized for a small cat (about as tall as the desk in the room).
Seen from slightly above, the same angle as the furniture in the room. Soft
light from the top left. Each object stands on its own: no floor, no table,
no cast shadow, no text. Transparent background (or flat pure white).
```

**`obj-gardening.png`**

```text
Watercolor illustration in exactly the style of the attached room: the same
soft paper texture, warm wood tones, thin brown outlines and muted colors.
Draw 3 objects side by side in a row, evenly spaced, with no overlap and
plenty of empty space around each:
1. a small terracotta pot of soil with a seed packet leaning against it,
2. the same pot with a small green sprout,
3. the same pot with a leafy plant in bloom with a few small flowers.
Small enough to sit on a windowsill. Seen from slightly above, the same angle
as the furniture in the room. Soft light from the top left. Each object
stands on its own: no floor, no table, no cast shadow, no text. Transparent
background (or flat pure white).
```

**`obj-baking.png`**

```text
Watercolor illustration in exactly the style of the attached room: the same
soft paper texture, warm wood tones, thin brown outlines and muted colors.
Draw 3 objects side by side in a row, evenly spaced, with no overlap and
plenty of empty space around each:
1. a pale blue mixing bowl with a wooden spoon in it,
2. the same bowl with a small paper bag of flour beside it,
3. a glass jar of sourdough starter beside a round loaf of bread on a small
   wire cooling rack.
Small enough to sit on a desk. Seen from slightly above, the same angle as the
furniture in the room. Soft light from the top left. Each object stands on its
own: no floor, no table, no cast shadow, no text. Transparent background (or
flat pure white).
```

**`obj-writing.png`**

```text
Watercolor illustration in exactly the style of the attached room: the same
soft paper texture, warm wood tones, thin brown outlines and muted colors.
Draw 3 objects side by side in a row, evenly spaced, with no overlap and
plenty of empty space around each:
1. a closed notebook with a sage green cover lying flat,
2. the same notebook lying open with handwriting lines and a pen across it,
3. a small stack of four filled notebooks with a pen resting on top.
Small enough to sit on a desk. Seen from slightly above, the same angle as the
furniture in the room. Soft light from the top left. Each object stands on its
own: no floor, no table, no cast shadow, no text. Transparent background (or
flat pure white).
```

**`obj-reading.png`**

```text
Watercolor illustration in exactly the style of the attached room: the same
soft paper texture, warm wood tones, thin brown outlines and muted colors.
Draw 3 objects side by side in a row, evenly spaced, with no overlap and
plenty of empty space around each:
1. one closed book lying flat,
2. a stack of three books in soft colors,
3. a stack of five books with a ribbon bookmark hanging out and a small mug
   on top.
Sized for a small cat's room. Seen from slightly above, the same angle as the
furniture in the room. Soft light from the top left. Each object stands on its
own: no floor, no table, no cast shadow, no text. Transparent background (or
flat pure white).
```

**`obj-guitar.png`**

```text
Watercolor illustration in exactly the style of the attached room: the same
soft paper texture, warm wood tones, thin brown outlines and muted colors.
Draw 3 objects side by side in a row, evenly spaced, with no overlap and
plenty of empty space around each:
1. a closed brown guitar case lying flat,
2. a small acoustic guitar standing upright on a guitar stand,
3. the same guitar on its stand next to a small wooden stool with an open
   music book on it.
The guitar is sized for a small cat (about as tall as the desk in the room).
Seen from slightly above, the same angle as the furniture in the room. Soft
light from the top left. Each object stands on its own: no floor, no wall, no
cast shadow, no text. Transparent background (or flat pure white).
```

**`obj-other.png`**

```text
Watercolor illustration in exactly the style of the attached room: the same
soft paper texture, warm wood tones, thin brown outlines and muted colors.
Draw 3 objects side by side in a row, evenly spaced, with no overlap and
plenty of empty space around each:
1. an empty round woven basket,
2. the same basket with two small wrapped parcels in it,
3. the same basket overflowing with small items, each with a little blank
   paper tag on a string.
Small enough to fit under a desk. Seen from slightly above, the same angle as
the furniture in the room. Soft light from the top left. Each object stands on
its own: no floor, no table, no cast shadow, no text. Transparent background
(or flat pure white).
```

---

## 4. Before you hand them over

Check each image against this list, and redo any that fail:
- [ ] **Room:** the window, desk, corkboard, frames, door, rug and cat bed are where `layout-guide.png` puts them. Nothing important sits below the red line.
- [ ] **Room:** no sun patches or light beams anywhere.
- [ ] **Night room:** same furniture in the same places as the day room. Only the light changes.
- [ ] **Window view:** the sky is transparent or plain white.
- [ ] **Objects:** 3 separate objects per image, not touching, in the room's style, with no shadow or floor.

Put them in `art/room/` and tell me. Then I'll do the code side:
- cut out the window panes;
- move the buttons and Rusty's spots to where things landed;
- build the lighting, weather and hobby homes with their stages;
- remove the corkboard icons and fix the labels.
