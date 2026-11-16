# Restie visual requirements and image handoff

Scope: requirements and image generation only. No application source, existing assets, rig, sprite build output, or runtime behavior changed.

## User direction

- Stop Rusty changing saturation and appearing randomly fatter/thinner.
- Improve room saturation, time-of-day lighting and weather design.
- Respace hobbies into coherent activity areas.
- Keep original watercolor character identity.
- First seated baking/painting generations were rejected. Refine proportions too, retaining natural standing activity poses.
- Revised standing images are review candidates; user acceptance is not yet recorded.

## Evidence from the repository

Read art/sprites/PROMPT.md and art/room/PROMPT.md, their reference images, and the relevant room, sky, character, rig, asset-map and sprite-processing code.

- art/sprites/PROMPT.md identifies changing faces/stripes/head shape and incompatible endpoints.
- scripts/build-sprites.py fits different silhouettes, interpolates scale/placement and fur corrections, then creates optical-flow morphs. Its comments explicitly note different activity-pose chroma. These operations can contribute to visible shape/color changes; this was a source review, not a runtime diagnosis.
- src/rusty/RustyPuppet.tsx and shader.ts add deformation/breathing; RustyActor.tsx crossfades sheets and poses. New images alone cannot establish that runtime deformation is resolved.
- src/room/Room.tsx paints lighting before Rusty and places several reused hobby icons into the room; the same icons are repeated on the board.
- src/room/Sky.tsx overlays a rectangle onto painted window art, with fixed original coordinates.
- The old room bakes sunlight into its floor. New backgrounds remove those sunlight patches.

## Character acceptance requirements

1. A single stable ginger/cream palette, watercolor density, outline color and thickness across all frames. Lighting belongs to the shared scene, not independently recolored fur.
2. Stable head/body proportions, eye geometry, stripe map and tail thickness. Three forehead stripes; no accidental mirroring or inconsistent pupil direction.
3. Slimmer, believable torso and haunches with clearly defined limbs. Retain original standing baking and painting gestures; do not convert them into inflated seated bodies.
4. Pose changes may articulate joints and rotate anatomy, but must not randomly stretch the torso or rescale the head.
5. Fix canvas scale, registration and foot baseline across each transition. Never normalize each frame independently by its full bounding box (props change that box).
6. For production transition sheets: eight frames in a 4x2 layout, 1536x1024; frame 1 neutral and frame 8 activity must use the actual selected endpoint drawings. Generate six small sequential edits between them and check face, palette, silhouette and baseline at each step. Four walk directions require consistent 4-frame cycles and a stop-to-neutral segment.
7. Transparent background, intact whiskers/tail/props, no cast floor shadow or baked lighting. Adequate margins.
8. Revised stills are not drop-in rig replacements or a validated animation pack. No transition sheets were regenerated in this delivery. Existing transitions will still need the sequential-frame work above after the final character design is chosen.

## Room and spacing requirements

- Portrait composition based on art/room/layout-guide.png; source room canvas is 941x1672.
- Cat-scaled desk/window/door. Main furniture around the middle, clock on desk, empty board and empty keepsake frames.
- Keep rug, bed and all important interactions above the guide's approximately 83.5% card cutoff; lower floor stays quiet.
- Muted honey wood, sage textiles, cream walls and fine watercolor texture; avoid heavy orange saturation.
- Day background uses diffuse even light with no sun patches or shafts.
- Night background preserves furniture positions and uses the visible desk lamp as the warm source, with readable cool shadows elsewhere.
- Blank window area reserves space for layered sky/view/weather. Pane masking and compositing remain future integration tasks.
- One future lighting treatment must cover room, hobby objects and Rusty consistently.

## Weather requirements

| State | Desired treatment |
| --- | --- |
| Dawn | Pale peach/pink sky; long faint sun patch |
| Day | Soft blue sky; restrained short sun patch |
| Golden hour | Warm amber sky and longer sun patch without oversaturating fur |
| Dusk | Muted purple/peach; fade daylight into lamp-lit night |
| Night | Navy sky, optional moon/stars outside; no sunlight |
| Cloudy | Soft moving clouds, reduced sun patch |
| Rain | Grey sky, drops outside/on glass, no sun patch |
| Storm | Rain plus brief localized window/floor flash |
| Snow | Outside flakes and ledge accumulation |
| Fog | Outdoor landscape loses contrast |

Sky, outdoor view and weather must live behind the window boundary instead of obscuring the painted frame. Rain on glass is a separate foreground detail. Animated weather, sun patches and masks are requirements only, not implemented or baked into the new room paintings.

## Hobby homes

| Hobby | Home | Growth stages |
| --- | --- | --- |
| Drawing | Floor below window, left of desk | Sketchbook/pencils → blank easel → painted easel |
| Gardening | Windowsill | Soil/seed packet → sprout → flowering plant |
| Baking | Right desk work zone, clear of lamp | Bowl/spoon → bowl/flour → starter/bread |
| Writing | Left desk work zone, clear of clock | Closed notebook → open notebook/pen → filled notebook stack |
| Reading | Beside cat bed | One book → three books → five books/mug |
| Guitar | Gap between desk and door | Case → guitar/stand → guitar/stool/music book |
| Other | Under desk | Basket → parcels → collected craft items |

Stages correspond to adding a hobby, first milestone and three milestones. Each sheet contains three separated groups, with room-matching perspective and materials. These are source art sheets, not final placed assets. The writing generation depicts five notebooks rather than the prompt's four; growth still reads as a fuller stack. The generic basket includes a cushion; it remains distinguishable by future under-desk placement.

Keep hobby icons on UI cards, not duplicated on the corkboard. Future integration should hide the static easel/bowl when an active cat pose already contains it. Uniform hotspot labels are code-side work only.

## Delivered images

All generated using the built-in image generation tool. Existing assets were not overwritten.

- room/room-day.png
- room/room-night.png
- room/window-view.png
- room/obj-drawing.png
- room/obj-gardening.png
- room/obj-baking.png
- room/obj-writing.png
- room/obj-reading.png
- room/obj-guitar.png
- room/obj-other.png
- rusty/cook-refined-v2.png
- rusty/paint-refined-v2.png

Room day/night were visually checked for composition and lighting consistency. The exported prop alpha channel was inspected; apparent dark preview halos can be RGB data in fully transparent pixels. The rejected seated cat attempts are excluded from this folder.

Exact generation prompts are recorded in PROMPTS.md. No sprite build/cutout scripts were run. No claim of pixel-identical animation endpoints or runtime visual fixes is made.

