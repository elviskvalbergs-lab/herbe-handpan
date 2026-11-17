# Cuts the instrument thumbnail sheet (docs/design/instrument-thumbnails-sheet.webp, 3 x 2,
# white background) into one transparent 512 x 512 WebP per instrument in brand/instruments/.
# Needs numpy, scipy and Pillow:  python3 scripts/cut-instrument-thumbnails.py <sheet> brand/instruments
# Each picture keeps only its own instrument (the flute and recorder overlap on the sheet).
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
h, w, _ = im.shape
whiteness = 255 - im.min(axis=2)          # 0 = pure white
near_white = whiteness < 22
# background: near-white connected to the border
lab, n = ndi.label(near_white)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
fg = ~bg
fg = ndi.binary_closing(fg, iterations=2)
fg = ndi.binary_fill_holes(fg) | (fg)
# soft edge: alpha ramps over pixels next to the background, by how far from white they are
alpha = np.where(fg, 255.0, 0.0)
edge = fg & ndi.binary_dilation(~fg, iterations=2)
alpha[edge] = np.clip(whiteness[edge] * 255 / 40, 0, 255)
alpha = ndi.gaussian_filter(alpha, 0.6)
alpha[~ndi.binary_dilation(fg, iterations=1)] = 0
# components = instruments (big ones only)
comp, k = ndi.label(fg)
sizes = ndi.sum(np.ones_like(comp), comp, range(1, k + 1))
big = [i + 1 for i in np.argsort(sizes)[::-1][:6]]
boxes = ndi.find_objects(comp)
items = []
members = []
for i in big:
    sl = boxes[i - 1]
    items.append((sl[0].start, sl[0].stop, sl[1].start, sl[1].stop))
    members.append([i])
# merge any small components into the nearest big box
for j in range(1, k + 1):
    if j in big or sizes[j - 1] < 30: continue
    sl = boxes[j - 1]; cy = (sl[0].start + sl[0].stop) / 2; cx = (sl[1].start + sl[1].stop) / 2
    d = [abs(cy - (a + b) / 2) + abs(cx - (c + e) / 2) for a, b, c, e in items]
    t = int(np.argmin(d)); a, b, c, e = items[t]
    items[t] = (min(a, sl[0].start), max(b, sl[0].stop), min(c, sl[1].start), max(e, sl[1].stop))
    members[t].append(j)
# order: top row left→right, then bottom row
order = sorted(range(len(items)), key=lambda t: (0 if (items[t][0] + items[t][1]) / 2 < h / 2 else 1, (items[t][2] + items[t][3]) / 2))
items = [items[t] for t in order]; members = [members[t] for t in order]
names = ['handpan', 'ocarina', 'tongue-drum', 'native-american-flute', 'recorder', 'kalimba']
for name, (y0, y1, x0, x1), mem in zip(names, items, members):
    own = ndi.binary_dilation(np.isin(comp, mem), iterations=2)  # only this instrument's pixels
    rgba = np.dstack([im, alpha * own]).astype(np.uint8)
    crop = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
    side = 512; pad = 32
    scale = (side - 2 * pad) / max(crop.size)
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)
    canvas.save(f'{out}/{name}.webp', 'WEBP', quality=88, method=6)
    print(name, (x0, y0, x1, y1))
