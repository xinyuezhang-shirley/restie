"""Test images for Rusty's drawing checks (scripts/qa-art.mjs).

Good: the app's own hobby icons, centered on a transparent canvas with margin
(what a passing generated image looks like). Bad: five deliberate failures.
    python3 scripts/make-qa-images.py <out_dir>
"""
import colorsys
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
icons = Path(__file__).resolve().parent.parent / 'assets' / 'hobbies'


def centered(name, size=512, scale=0.62):
    im = Image.open(icons / f'{name}.png').convert('RGBA')
    k = size * scale / max(im.size)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas


for name in ['guitar', 'drawing', 'reading']:
    centered(name).save(out / f'good-{name}.png')

# 1. white background (no transparency)
white = Image.new('RGBA', (512, 512), (255, 255, 255, 255))
g = centered('guitar')
white.alpha_composite(g)
white.convert('RGB').save(out / 'bad-white-bg.png')

# 2. neon colors
d = centered('drawing')
px = d.load()
for y in range(d.height):
    for x in range(d.width):
        r, gg, b, a = px[x, y]
        if a:
            h, l, s = colorsys.rgb_to_hls(r / 255, gg / 255, b / 255)
            nr, ng, nb = colorsys.hls_to_rgb((h + 0.5) % 1, 0.55, 1.0)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
d.save(out / 'bad-neon.png')

# 3. text on it
t = centered('guitar', scale=0.5)
dr = ImageDraw.Draw(t)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 54)
except OSError:
    font = ImageFont.load_default()
dr.text((70, 410), 'GUITAR SALE!', fill=(220, 20, 20, 255), font=font)
t.save(out / 'bad-text.png')

# 4. wrong subject (a baking icon, checked as "chess")
centered('baking').save(out / 'bad-wrong-subject.png')

# 5. too big: fills the frame and touches the edges
src = Image.open(icons / 'reading.png').convert('RGBA')
big = src.crop(src.getchannel('A').getbbox()).resize((512, 512), Image.LANCZOS)
big.save(out / 'bad-too-big.png')
print('wrote', sorted(p.name for p in out.glob('*.png')))
