"""Cut the cream background out of Rusty's puppet frames.

The puppet frames (art/puppet/*.webp, 1000x1000, opaque) share one rig whose
coordinates are normalized to the frame, so the output must keep the exact
framing: same canvas, background made transparent.

Background = pixels connected to the border whose color is close to the paper
color. Edges get a soft alpha ramp so the watercolor outline stays clean.

Usage: python3 scripts/cutout-frames.py art/puppet assets/rusty/frames 640
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC, DST, SIZE = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
DST.mkdir(parents=True, exist_ok=True)

# Distance (RGB) from the paper color: below LO is surely paper, above HI is ink.
LO, HI = 10.0, 34.0
# Silhouette edge band (px) and its wider ramp: an anti-aliased outline pixel
# only counts as fully ink at EDGE_HI from the paper color.
EDGE_BAND, EDGE_HI = 4, 190.0

for f in sorted(SRC.glob("*.webp")):
    rgb = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    paper = np.median(border, axis=0)
    dist = np.sqrt(((rgb - paper) ** 2).sum(axis=2))

    # Paper region = loose-threshold pixels connected to the frame edge.
    # Watercolor outlines have small gaps (the painting pose's cheek), so first
    # seal the ink with a closing, flood from the edge, then grow back a few
    # pixels so the gaps between whiskers still clear.
    loose = dist < HI
    ink_sealed = ndimage.binary_closing(~loose, structure=np.ones((3, 3)), iterations=6)
    labels, _ = ndimage.label(~ink_sealed)
    edge_ids = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    seed = np.isin(labels, edge_ids[edge_ids > 0])
    paper_region = ndimage.binary_dilation(seed, iterations=7, mask=loose)

    # Inside the paper region, alpha ramps from 0 (paper) to 1 (ink).
    ramp = np.clip((dist - LO) / (HI - LO), 0.0, 1.0)
    alpha = np.where(paper_region, ramp, 1.0)
    # The first pixels past the paper are often still mostly paper: an outline
    # or a whisker anti-aliased into the cream (e.g. 233,206,190 next to a
    # 167,89,52 outline). With only the narrow ramp they stayed fully opaque,
    # which left a pale ring around the tail and grey whiskers. In a thin band
    # at the silhouette, use a much wider ramp so those mixed pixels get
    # partial alpha (and the paper is un-blended from their color below).
    band = ndimage.binary_dilation(paper_region, iterations=EDGE_BAND) & ~paper_region
    wide = np.clip((dist - LO) / (EDGE_HI - LO), 0.0, 1.0)
    alpha = np.where(band, np.minimum(alpha, wide), alpha)
    # Remove isolated specks of paper noise and soften the cut by one pixel.
    solid = ndimage.binary_opening(alpha > 0.5, iterations=2)
    alpha = np.where(solid | (~paper_region), alpha, alpha * 0.0)
    alpha = ndimage.gaussian_filter(alpha, 0.6)

    # Un-blend the paper from semi-transparent edge pixels so edges don't glow.
    a = np.clip(alpha, 1e-3, 1.0)[..., None]
    color = np.clip((rgb - paper * (1 - a)) / a, 0, 255)
    color = np.where(alpha[..., None] > 0.98, rgb, color)

    out = np.dstack([color, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    img.save(DST / (f.stem + ".png"), optimize=True)
    print(f.stem, f"paper={paper.astype(int).tolist()}", f"opaque={float((alpha > 0.5).mean()):.2f}")
