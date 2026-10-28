"""Render Stone Hall (level 1) and the barrow beneath it (level 2)."""
import sys, json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import mapkit
from mapkit import Map, P
import layouts

OUT = sys.argv[1]          # folder for the .webp files
PREV = sys.argv[2]         # folder for grid previews
which = sys.argv[3] if len(sys.argv) > 3 else 'both'


def fallen_column(m, ax, ay, bx, by, rad, color=(160, 152, 140)):
    """A toppled column lying from (ax, ay) to (bx, by) in pixels, shaded like a cylinder."""
    sh = m.layer()
    sh.line([(ax + 6, ay + 8), (bx + 6, by + 8)], (0, 0, 0, 200), rad * 2)
    m.shade_layer(sh, 0.55, 5)
    x1, x2 = int(min(ax, bx) - rad - 2), int(max(ax, bx) + rad + 3)
    y1, y2 = int(min(ay, by) - rad - 2), int(max(ay, by) + rad + 3)
    sy, sx = np.mgrid[y1:y2, x1:x2].astype(np.float32)
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy
    t = np.clip(((sx - ax) * vx + (sy - ay) * vy) / L2, 0, 1)
    px, py = ax + t * vx, ay + t * vy
    nx, ny = -vy / math.sqrt(L2), vx / math.sqrt(L2)
    off = (sx - px) * nx + (sy - py) * ny          # signed distance across the column
    dist = np.hypot(sx - px, sy - py)
    inside = np.clip(rad - dist, 0, 1)
    across = off / rad
    shade = np.clip(1.05 - 0.55 * (across + 0.35) ** 2, 0.35, 1.1)
    flute = 1 - 0.12 * (np.abs(np.sin(across * 5.5)) ** 6)
    col = np.array(color, np.float32) * (shade * flute)[..., None]
    col *= (0.88 + 0.2 * m.fbm(3, 20, 61)[y1:y2, x1:x2])[..., None]
    a = inside[..., None]
    m.img[y1:y2, x1:x2] = m.img[y1:y2, x1:x2] * (1 - a) + col * a
    # broken end face
    lay = m.layer()
    lay.ellipse((bx - rad * 0.55, by - rad, bx + rad * 0.55, by + rad), (130, 124, 114, 255))
    lay.ellipse((bx - rad * 0.4, by - rad * 0.8, bx + rad * 0.4, by + rad * 0.8), (112, 106, 98, 255))
    m.put_layer(lay)


def preview(img, rows, path):
    pv = img.convert('RGBA')
    g = ImageDraw.Draw(pv)
    R, C = len(rows), len(rows[0])
    for i in range(C + 1):
        g.line([(i * P, 0), (i * P, R * P)], fill=(0, 0, 0, 120), width=1)
    for j in range(R + 1):
        g.line([(0, j * P), (C * P, j * P)], fill=(0, 0, 0, 120), width=1)
    pv.convert('RGB').save(path)


def stone_hall():
    rows = layouts.stone_hall()
    m = Map(rows, seed=7)
    m.img = m.flagstones((120, 112, 100), 38, 11, 12, (58, 53, 48), seed=1)
    # the ruined west wing: older, dirtier stone with grass and moss pushing through
    wing = (m.xx < 10 * P).astype(np.float32)
    grime = np.clip((m.fbm(5, 4, 12) - 0.35) * 2.2, 0, 1) * wing
    m.blend(np.array([82, 74, 60], np.float32), grime * 0.45)
    grass = np.clip((m.fbm(5, 6, 13) - 0.58) * 5, 0, 1) * wing * (m.fbm(3, 30, 14) > 0.4)
    m.blend(np.array([74, 92, 50], np.float32), grass * 0.75)
    wm = m.water('w', (78, 112, 108), (28, 62, 74), seed=21)
    m.stairs(0, 5, 2, 7, 'W', color=(126, 118, 106), dark=0.96, steps=11)
    m.rubble('r')
    m.pebbles('.', 34)
    for (y, x) in zip(*np.nonzero(m.cell == 'O')):
        m.column_round(x, y, P * 0.37)
    for (y, x) in zip(*np.nonzero(m.cell == 'B')):
        m.column_broken(x, y, P * 0.33)
    fallen_column(m, 5.0 * P, 9.3 * P, 6.6 * P, 10.6 * P, P * 0.3)
    m.walls((104, 99, 96), (30, 29, 35), band=15.0, seed=31, moss_near=wm)
    m.door_open(10, 6, swing='E')
    # cobwebs and creeping roots in the ruined wing
    m.cobweb(3 * P + 2, 5 * P + 2, 'NW', 40)
    m.cobweb(10 * P - 2, 3 * P + 2, 'NE', 44)
    m.roots(4 * P, 2 * P + 4, 70, 1.2)
    m.roots(10 * P - 4, 9 * P, 60, 2.6)
    # wall torches in the hall
    torches = [((21.5 * P, 3 * P - 4), (21.5 * P, 3 * P + 12)), ((15.5 * P, 1 * P - 4), (15.5 * P, 1 * P + 12)),
               ((21.5 * P, 13 * P + 4), (21.5 * P, 13 * P - 12)), ((29 * P - 4, 6.5 * P), (29 * P - 18, 6.5 * P)),
               ((11 * P + 4, 4.5 * P), (11 * P + 18, 4.5 * P))]
    for (fx, fy), _ in torches:
        m.sconce(fx, fy)
    lights = [dict(x=lx, y=ly, r=270, i=0.42, rgb=(1.25, 1.0, 0.72)) for _, (lx, ly) in torches]
    lights += [dict(x=4.6 * P, y=3.6 * P, r=260, i=0.38, rgb=(0.9, 0.97, 1.1), soft=2.5),   # light through the fallen roof
               dict(x=16.9 * P, y=14.4 * P, r=260, i=0.35, rgb=(0.9, 0.97, 1.1), soft=2.5)]  # the south entrance
    m.light(0.66, (0.95, 0.96, 1.02), lights, block_chars='#')
    img = m.finish(vignette=0.22)
    return rows, img


def barrow():
    rows = layouts.barrow()
    m = Map(rows, seed=11)
    m.img = m.flagstones((96, 96, 102), 46, 14, 10, (38, 38, 44), seed=2, bevel=11)
    soil = np.clip((m.fbm(5, 5, 20) - 0.5) * 3, 0, 1)
    m.blend(np.array([66, 54, 42], np.float32), soil * 0.55)
    m.dais(6, 12, 9, 15, stone=(90, 90, 96))
    wm = m.water('w', (58, 80, 72), (20, 36, 38), seed=22)
    m.stairs(23, 8, 25, 9, 'W', color=(112, 110, 112), dark=0.55, steps=9)
    m.rubble('r', tint=(0.96, 0.96, 1.0), dust_rgb=(110, 106, 104))
    m.pebbles('.', 30, tint=(0.95, 0.95, 1.0))
    m.bones('b')
    for (y, x) in zip(*np.nonzero(m.cell == 'O')):
        m.column_square(x, y, 22)
    for (x0, y0, x1, y1) in m.components('c'):
        m.sarcophagus(x0, y0, x1, y1, big=(x1 - x0 >= 1 and y1 - y0 >= 1), stone=(124, 122, 118) if (x1 - x0 >= 1) else (112, 112, 112))
    for (y, x) in zip(*np.nonzero(m.cell == 'u')):
        m.urns(x, y)
    m.walls((88, 88, 94), (22, 22, 26), band=15.0, seed=41, moss_near=wm, earthy=0.35)
    for (y, x) in zip(*np.nonzero(m.cell == 'n')):
        m.niche(x, y, 'S' if m.cell[y + 1][x] in '.b' else 'N')
    m.sealed_door(7, 2, 8, 2)
    braz = list(zip(*np.nonzero(m.cell == 'f')))
    for (y, x) in braz:
        m.brazier(x, y)
    m.cobweb(2 * P + 2, 3 * P + 2, 'NW', 54, 80)
    m.cobweb(14 * P - 2, 16 * P - 2, 'SE', 50, 70)
    m.cobweb(16 * P + 2, 12 * P + 2, 'NW', 40, 70)
    m.cobweb(22 * P - 2, 12 * P + 2, 'NE', 40, 70)
    m.cobweb(23 * P - 2, 7 * P + 2, 'NE', 36, 60)
    m.roots(14 * P - 4, 5.6 * P, 80, 3.3)
    m.roots(2 * P + 4, 12 * P, 70, 0.1)
    m.roots(18.5 * P, 15.9 * P, 50, -1.6)
    # candles left in the burial niches, glowing fungus by the flooded crypt
    niches = list(zip(*np.nonzero(m.cell == 'n')))
    cand = []
    for (y, x) in niches:
        if m.cell[y + 1][x] in '.b' and x in (15, 19):   # two of the dead have their eyes open
            m.eyes(x * P + 13, y * P + 40)
            cand.append((x * P + 13, y * P + 56))
    fun = [(17.2 * P, 12.4 * P), (20.6 * P, 15.5 * P), (19.4 * P, 12.3 * P)]
    for fx, fy in fun:
        m.fungus(fx, fy)
    lights = [dict(x=x * P + P / 2, y=y * P + P / 2, r=270, i=0.8, rgb=(1.5, 1.0, 0.62)) for (y, x) in braz]
    lights += [dict(x=cx, y=cy, r=90, i=0.3, rgb=(0.6, 0.85, 1.2)) for cx, cy in cand]
    lights += [dict(x=fx, y=fy, r=170, i=0.45, rgb=(0.5, 1.05, 0.95)) for fx, fy in fun]
    lights += [dict(x=25.4 * P, y=9.0 * P, r=230, i=0.8, rgb=(0.7, 0.82, 1.05), soft=2.5),   # daylight down the stairs
               dict(x=7.5 * P + 32, y=3.6 * P, r=120, i=0.35, rgb=(0.6, 0.9, 1.2))]          # the door's cold glow
    m.light(0.25, (0.72, 0.8, 0.98), lights, block_chars='#Onx')
    img = m.finish(vignette=0.32, grain=3.0)
    return rows, img


if __name__ == '__main__':
    out = {}
    for name, fn in [('stone-hall-2', stone_hall), ('barrow', barrow)]:
        if which not in ('both', name):
            continue
        rows, img = fn()
        img.save(f'{OUT}/{name}.webp', 'WEBP', quality=84, method=6)
        preview(img, rows, f'{PREV}/{name}-grid.png')
        out[name] = rows
    print(json.dumps(out))
