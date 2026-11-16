"""Turn Rusty's transition sprite sheets into app assets + alignment data.

Input:  art/sprites/sheet-<name>.png — 1536x1024, transparent, 4 columns x 2
        rows of 384x512 cells, read left→right, top→bottom (frames 0..7).
          paint / think / sleep / cook : frame 0 = sitting → frame 7 = the action
          walk-left / -right / -up / -down : frames 0-3 = walk cycle,
                                             frames 4-7 = stop → sitting
Output: assets/rusty/sheets/<name>.webp  (same layout, much smaller)
        src/rusty/sheets.gen.ts          (scale + offset per sheet)

Alignment: every sheet is placed so its *sitting* frame lines up with the
puppet's sitting frame (assets/rusty/frames/neutral.png) — same height, same
feet line, same center — so handing off between the puppet and a sheet is a
soft crossfade instead of a jump. Units are fractions of the puppet's square
box (S), so the app can draw any sheet at any size.

Color: the sheets were painted a little darker and more saturated than the
puppet (and differ from each other). Each sheet is color-matched to the
puppet in Lab space, using the sitting frame (same pose → fair comparison),
so Rusty doesn't change color when the app switches between them.

Handoffs: both ends of a sheet meet a puppet drawing — the sitting frame
meets the puppet's 'neutral', and an activity's last frame meets the puppet's
pose for it (cook, paint, think). Each end is fitted to its puppet drawing
(scale + shift that best overlaps the silhouettes, the head weighted double),
and the frames in between ease from one fit to the other, so neither handoff
jumps. That's SHEET_PLACE: per frame [scale, dx, dy] on top of SHEET_FIT.

Head: for every frame we also record where the top-center of his head is, so the "!" badge can follow his head instead of covering it.

Usage: python3 scripts/build-sprites.py
"""

import re
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.signal import fftconvolve

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "sprites"
OUT = ROOT / "assets" / "rusty" / "sheets"
GEN = ROOT / "src" / "rusty" / "sheets.gen.ts"
OUT.mkdir(parents=True, exist_ok=True)

COLS, ROWS, CW, CH = 4, 2, 384, 512
# Transparent gap between cells in the output, so scaling never lets the
# edge of a neighbouring frame bleed into the one being shown.
GAP = 8
# Each output frame keeps this much room around its grid cell, for drawings
# that cross the grid lines (see split_frames).
MARGIN = 64
# Activity sheets: the last frame → the puppet pose that takes over.
END = {"paint": (7, "paint"), "cook": (7, "cook"), "think": (7, "think")}
# Resolution for fitting silhouettes (px per puppet box), and the search range.
FIT_R = 360
SCALES = np.arange(0.78, 1.26, 0.02)
MAX_SHIFT = 0.14  # box units
# Which frame of each sheet is the plain sitting pose.
SIT_FRAME = {"paint": 0, "think": 0, "sleep": 0, "cook": 0, "walk-left": 7, "walk-right": 7, "walk-up": 7, "walk-down": 7}


def bbox(mask):
    ys, xs = np.where(mask)
    return xs.min(), xs.max(), ys.min(), ys.max()


def cat_mask(alpha):
    """The cat = the largest opaque blob (drops the easel, stray specks)."""
    m = alpha > 100
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


# --- sRGB <-> Lab (D65), numpy only ------------------------------------------
_M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
_WHITE = _M.sum(1)


def to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ _M.T / _WHITE
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def from_lab(lab):
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], -1)
    xyz = np.where(f**3 > 216 / 24389, f**3, (116 * f - 16) / (24389 / 27)) * _WHITE
    c = xyz @ np.linalg.inv(_M).T
    c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(c * 255, 0, 255)


def lab_stats(rgba):
    """Mean/std of the cat's solid pixels, in Lab."""
    m = cat_mask(rgba[..., 3]) & (rgba[..., 3] > 220)
    lab = to_lab(rgba[..., :3][m].astype(float))
    return lab.mean(0), lab.std(0)


def match_color(img, src_stats, ref_stats):
    """Shift the whole sheet so its cat's Lab mean/std match the puppet's."""
    (sm, ss), (rm, rs) = src_stats, ref_stats
    gain = np.clip(rs / ss, 0.8, 1.25)
    arr = np.array(img).astype(float)
    lab = to_lab(arr[..., :3])
    lab = (lab - sm) * gain + rm
    arr[..., :3] = from_lab(lab)
    return Image.fromarray(arr.round().astype(np.uint8), "RGBA")


def head_anchor(alpha):
    """(center x, top y) of his head, in cell pixels: the biggest blob in the
    top quarter of the cat (a raised tail tip is a smaller blob)."""
    m = cat_mask(alpha)
    ys, _ = np.where(m)
    top, bottom = ys.min(), ys.max()
    band = m.copy()
    band[int(top + 0.25 * (bottom - top)) :] = False
    lab, n = ndimage.label(band)
    sizes = ndimage.sum(band, lab, range(1, n + 1))
    hy, hx = np.where(lab == int(np.argmax(sizes)) + 1)
    return hy.min(), (hx.min() + hx.max()) / 2


def head_weight(mask):
    """1 for the body, 2 for the head (top third of the cat): faces are what
    the eye follows, so the fit favours lining those up."""
    w = mask.astype(float)
    ys, _ = np.where(mask)
    top, bottom = ys.min(), ys.max()
    w[: int(top + (bottom - top) / 3)] *= 2
    return w


RIG_SRC = (ROOT / "src" / "rusty" / "rig.ts").read_text()


def rig_eyes(pose):
    """The puppet's eye centers for a pose (rig.ts, 700-unit grid) in box units."""
    at = RIG_SRC.index("const SHEET: Rig = {") if pose == "neutral" else RIG_SRC.index(f"\n  {pose}: {{")
    nums = re.search(r"eyes: \[\s*\[(\d+), (\d+),[^\]]*\],\s*\[(\d+), (\d+),", RIG_SRC[at:])
    a, b, c, d = (int(v) / 700 for v in nums.groups())
    return np.array([[a, b], [c, d]])


def sheet_eyes(fr):
    """His two pupils in a sheet frame (cell px, [[x, y], [x, y]]): the two
    biggest dark blobs in the top of the cat, after thin lines are opened away."""
    m = cat_mask(fr[..., 3])
    ys, _ = np.where(m)
    top, bottom = ys.min(), ys.max()
    dark = (fr[..., :3].astype(float).mean(-1) < 75) & m
    dark[int(top + 0.45 * (bottom - top)) :] = False
    dark = ndimage.binary_opening(dark, iterations=max(2, int((bottom - top) * 0.012)))
    lab, n = ndimage.label(dark)
    if n < 2:
        return None
    sizes = ndimage.sum(dark, lab, range(1, n + 1))
    cs = [ndimage.center_of_mass(lab == i + 1) for i in np.argsort(sizes)[::-1][:2]]
    return np.array(sorted([(c[1], c[0]) for c in cs]))


def puppet_target(pose):
    a = np.asarray(Image.open(ROOT / "assets" / "rusty" / "frames" / f"{pose}.png").convert("RGBA"))[..., 3]
    a = np.asarray(Image.fromarray(a).resize((FIT_R, FIT_R), Image.BILINEAR))
    return head_weight(cat_mask(a)), rig_eyes(pose)


# How much a box-unit of eye misplacement costs against silhouette overlap
# (IoU, 0..1). Faces are what you notice in a handoff, so it's strong.
EYE_COST = 3.0


def fit_frame(fr, k, ox, oy, target):
    """Best scale m + shift for a frame placed at (k, ox, oy) so it lands on the
    puppet drawing: silhouettes overlapping and eyes in the same place. Scales
    about the cat's center; returns (m, new top-left x, y)."""
    weight, t_eyes = target
    m0 = cat_mask(fr[..., 3])
    eyes = sheet_eyes(fr)
    x0, x1, y0, y1 = bbox(m0)
    cx, cy = ox + k * (x0 + x1) / 2, oy + k * (y0 + y1) / 2  # cat center, box units
    pad = int(FIT_R * MAX_SHIFT) + 2
    area_t = weight.sum()
    shifts = (pad - np.arange(2 * pad + 1)) / FIT_R  # frame moves by this for corr index j
    best = (-np.inf, 1.0, 0.0, 0.0)
    for m in SCALES:
        kk = k * m
        x, y = cx + m * (ox - cx), cy + m * (oy - cy)  # top-left after scaling about the center
        w, h = max(1, round(fr.shape[1] * kk * FIT_R)), max(1, round(fr.shape[0] * kk * FIT_R))
        a = np.asarray(Image.fromarray((m0 * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)) > 127
        canvas = np.zeros((FIT_R + 2 * pad, FIT_R + 2 * pad), bool)
        px, py = round(x * FIT_R) + pad, round(y * FIT_R) + pad
        sx0, sy0 = max(0, -px), max(0, -py)
        dx0, dy0 = max(0, px), max(0, py)
        cw = min(w - sx0, canvas.shape[1] - dx0)
        ch = min(h - sy0, canvas.shape[0] - dy0)
        if cw > 0 and ch > 0:
            canvas[dy0 : dy0 + ch, dx0 : dx0 + cw] = a[sy0 : sy0 + ch, sx0 : sx0 + cw]
        # weighted overlap for every shift in ±pad
        inter = fftconvolve(canvas.astype(float), weight[::-1, ::-1], mode="valid")
        area_a = canvas.sum() * (area_t / (weight > 0).sum())  # same weighting scale as the target
        score = inter / (area_a + area_t - inter)
        if eyes is not None:
            e = np.array([x, y]) + eyes * kk  # eyes in box units before the shift
            mid = e.mean(0) - t_eyes.mean(0)
            dxs, dys = shifts[None, :] + mid[0], shifts[:, None] + mid[1]
            spread = abs(np.linalg.norm(e[1] - e[0]) - np.linalg.norm(t_eyes[1] - t_eyes[0]))
            score = score - EYE_COST * (np.hypot(dxs, dys) + spread)
        j = np.unravel_index(np.argmax(score), score.shape)
        if score[j] > best[0]:
            best = (score[j], m, shifts[j[1]], shifts[j[0]])
    _, m, dx, dy = best
    return m, cx + m * (ox - cx) + dx, cy + m * (oy - cy) + dy


def split_frames(img):
    """Cut the sheet into frames by what belongs to each frame, not by the grid.

    Drawings sometimes cross the grid lines (a tail swinging into the next
    cell). Cutting on the grid chops it off with a straight edge and leaves the
    piece inside the neighbour. Instead, every connected piece of the whole
    sheet goes to the cell holding most of it, and each frame is cut with a
    MARGIN around its cell so pieces that stick out come along.
    """
    arr = np.array(img)
    solid = arr[..., 3] > 40
    lab, n = ndimage.label(solid)
    owner = np.full(n + 1, -1)
    ys, xs = np.nonzero(lab)
    cell_of = (ys // CH) * COLS + (xs // CW)
    for i in range(1, n + 1):
        counts = np.bincount(cell_of[lab[ys, xs] == i], minlength=COLS * ROWS)
        owner[i] = int(np.argmax(counts))
    frames = []
    for f in range(COLS * ROWS):
        r, c = divmod(f, COLS)
        keep = np.isin(lab, np.nonzero(owner == f)[0])
        # soft edge pixels (alpha <= 40) around the kept pieces come along too
        keep = ndimage.binary_dilation(keep, iterations=3)
        # ...but never into another frame's pieces
        keep &= ~np.isin(lab, np.nonzero((owner != f) & (owner >= 0))[0])
        out = np.zeros((CH + 2 * MARGIN, CW + 2 * MARGIN, 4), np.uint8)
        y0, x0 = r * CH - MARGIN, c * CW - MARGIN
        sy0, sx0 = max(0, y0), max(0, x0)
        sy1, sx1 = min(arr.shape[0], y0 + out.shape[0]), min(arr.shape[1], x0 + out.shape[1])
        piece = arr[sy0:sy1, sx0:sx1].copy()
        piece[~keep[sy0:sy1, sx0:sx1]] = 0
        out[sy0 - y0 : sy1 - y0, sx0 - x0 : sx1 - x0] = piece
        frames.append(out)
    return frames


# ------------------------------------------------------------- frame color
#
# The global match above lines a sheet up with the puppet's *sitting* drawing.
# The puppet's activity drawings are painted lighter and paler than that
# (orange chroma ~51-55 vs ~59), so each frame is also nudged toward whichever
# end of the move it's closer to: the start toward 'neutral', the end toward
# the pose that takes over. Orange fur and cream fur are matched separately.


def fur_stats(rgba):
    a = rgba[..., 3] > 230
    lab = to_lab(rgba[..., :3][a].astype(float))
    c = np.hypot(lab[:, 1], lab[:, 2])
    h = np.arctan2(lab[:, 2], lab[:, 1])
    o = c > 35
    cr = (c < 20) & (lab[:, 0] > 75)
    return dict(oL=lab[o, 0].mean(), oC=c[o].mean(), oh=h[o].mean(), cL=lab[cr, 0].mean(), cC=c[cr].mean())


def fur_correction(src, ref):
    return dict(oL=ref["oL"] - src["oL"], oC=ref["oC"] / src["oC"], oh=ref["oh"] - src["oh"], cL=ref["cL"] - src["cL"], cC=ref["cC"] / src["cC"])


def lerp_corr(a, b, t):
    return {k: a[k] + (b[k] - a[k]) * t for k in a}


def apply_fur(rgba, corr):
    out = rgba.copy()
    lab = to_lab(rgba[..., :3].astype(float))
    c = np.hypot(lab[..., 1], lab[..., 2])
    h = np.arctan2(lab[..., 2], lab[..., 1])
    w_o = np.clip((c - 15) / 20, 0, 1)  # orange-ish
    w_c = np.clip((lab[..., 0] - 70) / 10, 0, 1) * (1 - w_o)  # bright, pale
    L = lab[..., 0] + w_o * corr["oL"] + w_c * corr["cL"]
    c = c * (1 + w_o * (corr["oC"] - 1) + w_c * (corr["cC"] - 1))
    h = h + w_o * corr["oh"]
    out[..., :3] = from_lab(np.stack([L, c * np.cos(h), c * np.sin(h)], -1)).round().astype(np.uint8)
    return out


# -------------------------------------------------------- box space + morph
#
# Every frame is rendered into "box space" (the puppet's square, R px per box
# unit), where the puppet's own drawings live too. That's what lets a move
# start and end on the puppet's exact image, and lets each pair of frames be
# morphed: optical flow says where every bit of frame A goes in frame B, and
# the in-betweens warp A toward B (and B back toward A) while blending them.

R = 440  # px per puppet-box unit in the output (the box is ~195pt on a phone)
STEPS = 3  # frames per original step: the original + 2 morphed in-betweens


def premul(rgba):
    f = rgba.astype(np.float32) / 255
    f[..., :3] *= f[..., 3:4]
    return f


def unpremul(f):
    out = f.copy()
    a = np.maximum(out[..., 3:4], 1e-6)
    out[..., :3] = np.where(out[..., 3:4] > 1e-4, out[..., :3] / a, 0)
    return (np.clip(out, 0, 1) * 255).round().astype(np.uint8)


def render_sheet_frame(fr, k, x, y, region):
    """A sheet frame (cell px) placed at top-left (x, y), k box units per px →
    premultiplied float image of the region (rx, ry, w, h in box units)."""
    rx, ry, rw, rh = region
    W, H = round(rw * R), round(rh * R)
    s = k * R  # output px per cell px
    im = Image.fromarray(fr, "RGBA").convert("RGBa")
    # inverse affine: output px → cell px
    a = 1 / s
    tx = (rx - x) * R / s
    ty = (ry - y) * R / s
    out = im.transform((W, H), Image.AFFINE, (a, 0, tx, 0, a, ty), resample=Image.BICUBIC)
    return np.asarray(out.convert("RGBa"), dtype=np.float32) / 255


def render_puppet(pose, region):
    rx, ry, rw, rh = region
    im = Image.open(ROOT / "assets" / "rusty" / "frames" / f"{pose}.png").convert("RGBA")
    n = im.size[0]  # its square is the box
    return render_sheet_frame(np.asarray(im), 1 / n, 0, 0, region)


def _warp(img, fx, fy):
    """Sample img at (x + fx, y + fy) for every output pixel (bilinear)."""
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    coords = [yy + fy, xx + fx]
    if img.ndim == 2:
        return ndimage.map_coordinates(img, coords, order=1, mode="constant")
    return np.stack([ndimage.map_coordinates(img[..., c], coords, order=1, mode="constant") for c in range(img.shape[2])], -1)


_AVG = np.array([[1, 2, 1], [2, 0, 2], [1, 2, 1]], np.float32) / 12


def flow(A, B, levels=6, warps=4, iters=80, smooth=0.02):
    """Dense flow from A to B (premultiplied RGBA float): A(p) ≈ B(p + F(p)).
    Coarse-to-fine Horn-Schunck on blurred color + alpha, computed at half
    resolution. Returns (fx, fy) in full-res px."""
    def feats(X):
        X = X[::2, ::2]
        return np.stack([ndimage.gaussian_filter(X[..., c], 1.2) for c in range(4)], -1)

    fa, fb = feats(A), feats(B)
    pyr = [(fa, fb)]
    for _ in range(levels - 1):
        a, b = pyr[-1]
        if min(a.shape[:2]) < 32:
            break
        pyr.append((ndimage.zoom(a, (0.5, 0.5, 1), order=1), ndimage.zoom(b, (0.5, 0.5, 1), order=1)))
    u = v = None
    for a, b in reversed(pyr):
        H, W = a.shape[:2]
        if u is None:
            u = np.zeros((H, W), np.float32)
            v = np.zeros((H, W), np.float32)
        else:
            u = ndimage.zoom(u, (H / u.shape[0], W / u.shape[1]), order=1) * 2
            v = ndimage.zoom(v, (H / v.shape[0], W / v.shape[1]), order=1) * 2
        for _ in range(warps):
            bw = _warp(b, u, v)
            m = (a + bw) / 2
            Ix = np.stack([ndimage.sobel(m[..., c], 1) / 8 for c in range(4)], -1)
            Iy = np.stack([ndimage.sobel(m[..., c], 0) / 8 for c in range(4)], -1)
            It = bw - a
            # per pixel: minimize the color mismatch + smoothness (a 2x2 solve)
            j11 = (Ix * Ix).sum(-1) + smooth
            j22 = (Iy * Iy).sum(-1) + smooth
            j12 = (Ix * Iy).sum(-1)
            j13 = (Ix * It).sum(-1)
            j23 = (Iy * It).sum(-1)
            det = j11 * j22 - j12 * j12
            du = np.zeros_like(u)
            dv = np.zeros_like(v)
            for _ in range(iters):
                ub = ndimage.convolve(u + du, _AVG, mode="nearest") - u
                vb = ndimage.convolve(v + dv, _AVG, mode="nearest") - v
                r1 = smooth * ub - j13
                r2 = smooth * vb - j23
                du = (j22 * r1 - j12 * r2) / det
                dv = (j11 * r2 - j12 * r1) / det
            u = ndimage.median_filter(u + du, 5)
            v = ndimage.median_filter(v + dv, 5)
    H, W = A.shape[:2]
    return (
        ndimage.zoom(u, (H / u.shape[0], W / u.shape[1]), order=1) * 2,
        ndimage.zoom(v, (H / v.shape[0], W / v.shape[1]), order=1) * 2,
    )


def trust(fab, fba, tol=4.0):
    """Keep the flow only where it agrees with the reverse flow (going A→B→A
    lands back where it started). Where it doesn't — a part with no match,
    like the thought cloud appearing — that part fades in place instead of
    being dragged out of something else."""
    bx = _warp(fba[0], fab[0], fab[1])
    by = _warp(fba[1], fab[0], fab[1])
    err = np.hypot(fab[0] + bx, fab[1] + by)
    w = ndimage.gaussian_filter(np.clip(1.5 - err / tol, 0, 1).astype(np.float32), 3)
    return fab[0] * w, fab[1] * w


def morph(A, B, t, fab, fba):
    """The frame a fraction t of the way from A to B: A pushed forward along
    its flow, B pulled back along its own, blended."""
    a = _warp(A, -t * fab[0], -t * fab[1])
    b = _warp(B, -(1 - t) * fba[0], -(1 - t) * fba[1])
    # steep blend: an in-between is mostly ONE drawing, distorted toward the
    # other (t=1/3 → 6% of B), so you never see two sets of eyes at once
    w = t**4 / (t**4 + (1 - t) ** 4)
    return (1 - w) * a + w * b


def content_box(f, thresh=0.01):
    ys, xs = np.where(f[..., 3] > thresh)
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def pack(images, max_w=2048, pad=4):
    """Shelf-pack images (H x W x 4) → (atlas, rects [x, y, w, h])."""
    order = sorted(range(len(images)), key=lambda i: -images[i].shape[0])
    rects = [None] * len(images)
    x = y = shelf = pad
    y = pad
    row_h = 0
    for i in order:
        h, w = images[i].shape[:2]
        if x + w + pad > max_w:
            x = pad
            y += row_h + pad
            row_h = 0
        rects[i] = (x, y, w, h)
        x += w + pad
        row_h = max(row_h, h)
    H = y + row_h + pad
    W = max(r[0] + r[2] for r in rects) + pad
    atlas = np.zeros((H, W, 4), np.uint8)
    for im, (x, y, w, h) in zip(images, rects):
        atlas[y : y + h, x : x + w] = im
    return atlas, rects


# ------------------------------------------------------------------ moves
#
# Each sheet becomes a list of "keys" (an original frame number, or "P:<pose>"
# for the puppet's own drawing), walked in order with morphs in between:
#   activity: P:neutral → 0..7 → P:<its pose>     (played backwards to stop)
#   sleep:    P:neutral → 0..7                     (holds 7, breathing)
#   walk:     start  P:neutral → 7 6 5 4 → 0
#             cycle  0 1 2 3 → (0)                 (looped by distance)
#             stop   3 → 4 5 6 7 → P:neutral
WALK = {
    "start": ["P:neutral", 7, 6, 5, 4, 0],
    "cycle": [0, 1, 2, 3, 0],
    "stop": [3, 4, 5, 6, 7, "P:neutral"],
}


def moves_for(name):
    if name.startswith("walk"):
        return WALK
    seq = ["P:neutral", *range(8)]
    if name in END:
        seq.append(f"P:{END[name][1]}")
    return {"enter": seq}


# ------------------------------------------------------------------- build

sit = np.asarray(Image.open(ROOT / "assets" / "rusty" / "frames" / "neutral.png").convert("RGBA"))
P = sit.shape[0]
x0, x1, y0, y1 = bbox(sit[..., 3] > 128)
P_H, P_CX, P_BOTTOM = (y1 - y0) / P, (x0 + x1) / 2 / P, y1 / P
REF = lab_stats(sit)
st, sx = head_anchor(sit[..., 3])
PUPPET_HEAD = (sx / P, st / P)
NEUTRAL = puppet_target("neutral")
FUR = {p: fur_stats(np.asarray(Image.open(ROOT / "assets" / "rusty" / "frames" / f"{p}.png").convert("RGBA"))) for p in ["neutral", "cook", "paint", "think"]}

gen = []
for f in sorted(SRC.glob("sheet-*.png")):
    name = f.stem.removeprefix("sheet-")
    key = "".join(p.capitalize() if j else p for j, p in enumerate(name.split("-")))
    img = Image.open(f).convert("RGBA")
    i = SIT_FRAME[name]
    r, c = divmod(i, COLS)
    sit_cell = np.asarray(img)[r * CH : (r + 1) * CH, c * CW : (c + 1) * CW]
    img = match_color(img, lab_stats(sit_cell), REF)
    frames = split_frames(img)
    cx0, cx1, cy0, cy1 = bbox(cat_mask(frames[i][..., 3]))
    k = P_H / (cy1 - cy0)
    ox = P_CX - k * (cx0 + cx1) / 2
    oy = P_BOTTOM - k * cy1

    # where each frame goes, and how its fur is colored: start fitted to the
    # puppet's sitting drawing, an activity's end to its pose, eased between
    a_m, a_x, a_y = fit_frame(frames[i], k, ox, oy, NEUTRAL)
    c_start = fur_correction(fur_stats(frames[i]), FUR["neutral"])
    place = [(a_m, a_x, a_y)] * len(frames)
    corr = [c_start] * len(frames)
    if name in END:
        e, pose = END[name]
        b_m, b_x, b_y = fit_frame(frames[e], k, ox, oy, puppet_target(pose))
        c_end = fur_correction(fur_stats(frames[e]), FUR[pose])
        for j in range(len(frames)):
            t = min(j, e) / e
            t = t * t * (3 - 2 * t)
            place[j] = (a_m + (b_m - a_m) * t, a_x + (b_x - a_x) * t, a_y + (b_y - a_y) * t)
            corr[j] = lerp_corr(c_start, c_end, t)
    frames = [apply_fur(fr, corr[j]) for j, fr in enumerate(frames)]

    # every drawing this sheet uses, in box space
    moves = moves_for(name)
    keys = []
    for seq in moves.values():
        for kk in seq:
            if kk not in keys:
                keys.append(kk)
    # region: everything any frame covers (+ margin), in box units
    big = (-0.6, -0.8, 2.2, 2.2)
    boxes = []
    for kk in keys:
        if isinstance(kk, str):
            im = render_puppet(kk[2:], big)
        else:
            m, px, py = place[kk]
            im = render_sheet_frame(frames[kk], k * m, px, py, big)
        bx0, bx1, by0, by1 = content_box(im)
        boxes.append((bx0 / R + big[0], bx1 / R + big[0], by0 / R + big[1], by1 / R + big[1]))
    m_ = 0.03
    region = (min(b[0] for b in boxes) - m_, min(b[2] for b in boxes) - m_, 0, 0)
    region = (region[0], region[1], max(b[1] for b in boxes) + m_ - region[0], max(b[3] for b in boxes) + m_ - region[1])
    img_of = {}
    for kk in keys:
        if isinstance(kk, str):
            img_of[kk] = render_puppet(kk[2:], region)
        else:
            m, px, py = place[kk]
            img_of[kk] = render_sheet_frame(frames[kk], k * m, px, py, region)

    # morph every consecutive pair (each pair once; reversed moves reuse it)
    out_frames = []  # premultiplied float images
    index = {}

    def add(tag, im):
        if tag not in index:
            index[tag] = len(out_frames)
            out_frames.append(im)
        return index[tag]

    clips = {}
    for mv, seq in moves.items():
        idx = []
        for a_k, b_k in zip(seq, seq[1:]):
            idx.append(add(("f", a_k), img_of[a_k]))
            if ("m", a_k, b_k, 1) in index:  # already morphed: reuse
                idx += [index[("m", a_k, b_k, s)] for s in range(1, STEPS)]
                continue
            if ("m", b_k, a_k, 1) in index:  # morphed the other way: reuse, reversed
                idx += [index[("m", b_k, a_k, s)] for s in range(STEPS - 1, 0, -1)]
                continue
            A, B = img_of[a_k], img_of[b_k]
            fab, fba = flow(A, B), flow(B, A)
            fab, fba = trust(fab, fba), trust(fba, fab)
            for s in range(1, STEPS):
                idx.append(add(("m", a_k, b_k, s), morph(A, B, s / STEPS, fab, fba)))
        idx.append(add(("f", seq[-1]), img_of[seq[-1]]))
        if mv == "cycle":
            idx = idx[:-1]  # the last frame is the first again: loop
        clips[mv] = idx
        print(f"   {name} {mv}: {len(idx)} frames")

    # crop each frame to what it covers, pack, and record where it sits
    crops, offs, heads = [], [], []
    for im in out_frames:
        bx0, bx1, by0, by1 = content_box(im)
        bx0, by0 = max(0, bx0 - 2), max(0, by0 - 2)
        bx1, by1 = min(im.shape[1], bx1 + 2), min(im.shape[0], by1 + 2)
        crop = unpremul(im[by0:by1, bx0:bx1])
        crops.append(crop)
        offs.append((region[0] + bx0 / R, region[1] + by0 / R))
        top, hx = head_anchor(crop[..., 3])
        heads.append((region[0] + (bx0 + hx) / R, region[1] + (by0 + top) / R))
    atlas, rects = pack(crops)
    Image.fromarray(atlas, "RGBA").save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
    rows = ", ".join(f"[{x}, {y}, {w}, {h}, {ox_:.4f}, {oy_:.4f}]" for (x, y, w, h), (ox_, oy_) in zip(rects, offs))
    hrows = ", ".join(f"[{hx:.3f}, {hy:.3f}]" for hx, hy in heads)
    crow = ", ".join(f"{mv}: [{', '.join(map(str, ix))}]" for mv, ix in clips.items())
    gen.append(
        f"  {key}: {{\n    w: {atlas.shape[1]},\n    h: {atlas.shape[0]},\n"
        f"    frames: [{rows}],\n    head: [{hrows}],\n    clips: {{ {crow} }},\n  }},"
    )
    print(f"{name:11s} {len(out_frames)} frames, atlas {atlas.shape[1]}x{atlas.shape[0]} -> {OUT / (name + '.webp')}")

GEN.write_text(
    "// Generated by scripts/build-sprites.py — do not edit by hand.\n"
    "// Per sheet: the atlas size (px) and every frame as [x, y, w, h] in the atlas\n"
    "// plus where its top-left sits in the puppet's box (box units; R atlas px per\n"
    "// box unit). head = top-center of his head per frame. clips = frame indices\n"
    f"// per move, {STEPS} frames per original drawing (morphed in-betweens).\n"
    f"export const R = {R};\n"
    f"export const STEPS = {STEPS};\n"
    f"export const PUPPET_HEAD = [{PUPPET_HEAD[0]:.3f}, {PUPPET_HEAD[1]:.3f}] as const;\n\n"
    "export const SHEET_DATA = {\n" + "\n".join(gen) + "\n} as const;\n"
)
print("wrote", GEN)
