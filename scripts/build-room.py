"""Turn the room paintings into app assets.

Input (art/visual-refresh/room/):
  room-day.png, room-night.png   941 x 1672, the same room lit by day / by the desk lamp
  window-view.png                what's outside: branches + hills, transparent sky
  obj-<hobby>.png                3 growth stages side by side, transparent
Output:
  assets/room/day.webp, night.webp   the window glass cut out (transparent), so
                                     the sky, view and weather show through it
  assets/room/view.webp              the outside view, fitted to the glass
  assets/room/view-dark.webp         the same view as a dusky silhouette (dusk / night)
  assets/room/bed-rim-day/night.webp the front rim of the cat bed (drawn over Rusty in bed)
  assets/room/objects/<hobby>-<1..3>.webp
  src/room/room.gen.ts               glass rect + each object's aspect ratio

Usage: python3 scripts/build-room.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "visual-refresh" / "room"
OUT = ROOT / "assets" / "room"
OBJ = OUT / "objects"
GEN = ROOT / "src" / "room" / "room.gen.ts"
OBJ.mkdir(parents=True, exist_ok=True)

W, H = 941, 1672
# Use the newest version of a source if there is one (obj-other-v2.png).
def src(name):
    v = sorted(SRC.glob(f"{name}-v*.png"))
    return v[-1] if v else SRC / f"{name}.png"


day = Image.open(src("room-day")).convert("RGB").resize((W, H), Image.LANCZOS)
night = Image.open(src("room-night")).convert("RGB").resize((W, H), Image.LANCZOS)

# ------------------------------------------------------------- his cat bed
# The painted bed came out smaller than the layout guide's, too small for Rusty
# curled up. Paste a 1.3x copy over it (it fully covers the original), a little
# to the right, standing on the same floor line.
BED = dict(cx=170, cy=1082, rx=127, ry=86, bottom=1166)  # the basket, measured on room-day
BED_SCALE, BED_TO_X = 1.3, 192


def bigger_bed(im):
    x0, y0 = BED["cx"] - BED["rx"] - 6, BED["cy"] - BED["ry"] - 6
    x1, y1 = BED["cx"] + BED["rx"] + 6, BED["bottom"] + 4
    crop = im.crop((x0, y0, x1, y1))
    mask = Image.new("L", crop.size, 0)
    from PIL import ImageDraw

    ImageDraw.Draw(mask).ellipse((6, 6, crop.width - 6, crop.height - 4), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    s = BED_SCALE
    crop = crop.resize((round(crop.width * s), round(crop.height * s)), Image.LANCZOS)
    mask = mask.resize(crop.size, Image.LANCZOS)
    out = im.copy()
    out.paste(crop, (round(BED_TO_X - crop.width / 2), round(y1 - crop.height)), mask)
    return out


day, night = bigger_bed(day), bigger_bed(night)

# The bed's front rim as its own layer: the app draws it over Rusty when he's
# in (or behind) the bed, so he sits IN it instead of floating on top.
# Basket = outer ellipse; the cushion opening = inner ellipse; the rim in front
# of him = inside the outer, outside the inner, front half.
OUTER = (192, 1054, 165, 110)
INNER = (192, 1033, 130, 58)
RIM = (24, 1028, 338, 142)  # x, y, w, h of the cut-out
yy, xx = np.mgrid[RIM[1] : RIM[1] + RIM[3], RIM[0] : RIM[0] + RIM[2]].astype(float)
inside = lambda e: ((xx - e[0]) / e[2]) ** 2 + ((yy - e[1]) / e[3]) ** 2
rim = (inside(OUTER) <= 1.0) & (inside(INNER) > 1.0) & (yy > INNER[1])
rim_a = np.asarray(Image.fromarray((rim * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)))
for name, im in (("day", day), ("night", night)):
    crop = np.asarray(im.crop((RIM[0], RIM[1], RIM[0] + RIM[2], RIM[1] + RIM[3])))
    Image.fromarray(np.dstack([crop, rim_a]), "RGBA").save(OUT / f"bed-rim-{name}.webp", "WEBP", quality=92, method=6)
print("wrote bed-rim-day/night.webp")

# ------------------------------------------------------------ window glass
d = np.asarray(day).astype(int)
# the glass is flat pale blue: blue clearly above red, inside the window area
blue = (d[..., 2] - d[..., 0] > 18) & (d[..., 2] > 150)
blue[:, 330:] = False
blue[700:] = False
lab, n = ndimage.label(blue)
sizes = ndimage.sum(blue, lab, range(1, n + 1))
glass = lab == int(np.argmax(sizes)) + 1
glass = ndimage.binary_fill_holes(ndimage.binary_closing(glass, iterations=3))
ys, xs = np.where(glass)
gx0, gx1, gy0, gy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
print(f"glass: x {gx0}-{gx1}, y {gy0}-{gy1}  ({glass.sum()} px)")
# soft 1px edge so the cut doesn't look jagged; reach 1px under the frame
alpha = 1 - np.asarray(Image.fromarray((ndimage.binary_dilation(glass, iterations=1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))) / 255
for name, im in (("day", day), ("night", night)):
    rgba = np.dstack([np.asarray(im), (alpha * 255).round().astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
    print("wrote", OUT / f"{name}.webp")

# ---------------------------------------------------------------- the view
SCALE = 2  # output px per room px (the glass is small on screen; keep it crisp)
gw, gh = (gx1 - gx0) * SCALE, (gy1 - gy0) * SCALE
view = Image.open(src("window-view")).convert("RGBA")
# cover the glass, anchored to the bottom (keep the hills)
k = max(gw / view.width, gh / view.height)
v = view.resize((round(view.width * k), round(view.height * k)), Image.LANCZOS)
left = (v.width - gw) // 2
v = v.crop((left, v.height - gh, left + gw, v.height))
v.save(OUT / "view.webp", "WEBP", quality=88, method=6)
# dusk/night silhouette: the same shapes, dark and cool, a hint of texture kept
a = np.asarray(v).astype(float)
lum = a[..., :3].mean(-1, keepdims=True) / 255
dark = np.array([22, 28, 54], float) + lum * np.array([30, 34, 50])
Image.fromarray(np.dstack([dark, a[..., 3:]]).round().clip(0, 255).astype(np.uint8), "RGBA").save(
    OUT / "view-dark.webp", "WEBP", quality=88, method=6
)
print("wrote view.webp, view-dark.webp", v.size)

# ------------------------------------------------------- hobby object stages
aspects = {}
for icon in ["drawing", "gardening", "baking", "writing", "reading", "guitar", "other"]:
    im = Image.open(src(f"obj-{icon}")).convert("RGBA")
    arr = np.asarray(im)
    solid = arr[..., 3] > 24
    lab, n = ndimage.label(solid)
    third = im.width / 3
    groups = [[] for _ in range(3)]
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        cx = (sl[1].start + sl[1].stop) / 2
        groups[min(2, int(cx // third))].append(i)
    out = []
    for g, ids in enumerate(groups):
        m = np.isin(lab, ids)
        m = ndimage.binary_dilation(m, iterations=3) & (arr[..., 3] > 0)
        ys, xs = np.where(m)
        x0, x1, y0, y1 = max(0, xs.min() - 2), xs.max() + 3, max(0, ys.min() - 2), ys.max() + 3
        piece = arr[y0:y1, x0:x1].copy()
        piece[~m[y0:y1, x0:x1]] = 0
        # drop specks that aren't part of the object
        Image.fromarray(piece, "RGBA").save(OBJ / f"{icon}-{g + 1}.webp", "WEBP", quality=90, method=6)
        out.append(round((x1 - x0) / (y1 - y0), 4))
    aspects[icon] = out
    print(f"{icon:10s} stages w/h {out}")

GEN.write_text(
    "// Generated by scripts/build-room.py — do not edit by hand.\n"
    "// Room-image px (941 x 1672). GLASS = the window pane cut out of the room paintings.\n"
    f"export const GLASS = {{ x: {gx0}, y: {gy0}, w: {gx1 - gx0}, h: {gy1 - gy0} }} as const;\n\n"
    "// The cat bed's front rim, drawn over Rusty while his feet are behind its front edge (bottom).\n"
    f"export const BED_RIM = {{ x: {RIM[0]}, y: {RIM[1]}, w: {RIM[2]}, h: {RIM[3]}, bottom: {OUTER[1] + OUTER[3] - 6} }} as const;\n\n"
    "// Width / height of each hobby object's 3 stages.\n"
    "export const OBJECT_ASPECT = {\n"
    + "\n".join(f"  {k}: [{', '.join(map(str, v))}]," for k, v in aspects.items())
    + "\n} as const;\n"
)
print("wrote", GEN)
