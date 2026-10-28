"""A small kit for drawing top-down battlemaps from a terrain grid. No grid lines are baked in."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from scipy.spatial import cKDTree

P = 64  # pixels per 5 ft square
SS = 2  # supersampling for drawn shapes


class Map:
    def __init__(self, rows, seed):
        self.rows = rows
        self.R, self.C = len(rows), len(rows[0])
        self.H, self.W = self.R * P, self.C * P
        self.cell = np.array([list(r) for r in rows])
        self.rng = np.random.default_rng(seed)
        self.seed = seed
        self.yy, self.xx = np.mgrid[0:self.H, 0:self.W]
        self.img = np.zeros((self.H, self.W, 3), np.float32)
        self.emit = np.zeros((self.H, self.W, 3), np.float32)  # added after lighting (fire, glow)

    # ---------- helpers ----------
    def cells(self, chars):
        return np.isin(self.cell, list(chars))

    def up(self, cmask):
        return np.kron(cmask.astype(np.float32), np.ones((P, P), np.float32))

    def fbm(self, octaves, base, seed):
        g = np.random.default_rng(self.seed * 100 + seed)
        out = np.zeros((self.H, self.W), np.float32)
        amp, tot = 1.0, 0.0
        for o in range(octaves):
            n = base * 2 ** o
            small = g.random((max(2, n * self.R // self.C) + 2, n + 2)).astype(np.float32)
            z = ndimage.zoom(small, (self.H / small.shape[0], self.W / small.shape[1]), order=3)[:self.H, :self.W]
            out += amp * z
            tot += amp
            amp *= 0.5
        out /= tot
        return (out - out.min()) / (out.max() - out.min() + 1e-6)

    def smooth(self, cmask, sigma, amt, seed):
        m = ndimage.gaussian_filter(self.up(cmask), sigma)
        m = m + (self.fbm(4, 6, seed) - 0.5) * amt
        return (m > 0.5).astype(np.float32)

    def voronoi(self, spacing, jitter, seed, aspect=1.0):
        g = np.random.default_rng(self.seed * 7 + seed)
        sy = spacing * aspect
        gy, gx = np.mgrid[0:self.H + sy:sy, 0:self.W + spacing:spacing]
        pts = np.stack([gx.ravel() + g.uniform(-jitter, jitter, gx.size),
                        gy.ravel() + g.uniform(-jitter * aspect, jitter * aspect, gy.size)], 1)
        d, idx = cKDTree(pts).query(np.stack([self.xx.ravel(), self.yy.ravel()], 1), k=2, workers=-1)
        edge = (d[:, 1] - d[:, 0]).reshape(self.H, self.W)
        sid = idx[:, 0].reshape(self.H, self.W)
        return edge, sid, len(pts), g

    def blend(self, color, alpha):
        a = alpha[..., None] if alpha.ndim == 2 else alpha
        self.img = self.img * (1 - a) + color * a

    def layer(self):
        return Layer(self.W, self.H)

    def put_layer(self, lay, blur=0):
        rgba = lay.done(blur)
        a = rgba[..., 3:4] / 255.0
        self.img = self.img * (1 - a) + rgba[..., :3] * a

    def shade_layer(self, lay, strength, blur):
        a = lay.done(blur)[..., 3] / 255.0
        self.img *= (1 - strength * a)[..., None]

    # ---------- surfaces ----------
    def flagstones(self, base, spacing, jitter, tone, mortar_rgb, seed, mortar=1.8, bevel=9.0):
        edge, sid, n, g = self.voronoi(spacing, jitter, seed)
        t = g.uniform(-tone, tone, n)[sid]
        hue = g.uniform(-5, 5, n)[sid]
        f = np.zeros((self.H, self.W, 3), np.float32)
        f[:] = np.array(base, np.float32)
        f[..., 0] += t + hue
        f[..., 1] += t
        f[..., 2] += t - hue
        f *= (0.82 + 0.3 * self.fbm(5, 10, seed + 1))[..., None]
        f *= (0.92 + 0.12 * self.fbm(3, 24, seed + 2))[..., None]
        f *= (0.78 + 0.22 * np.clip(edge / bevel, 0, 1))[..., None]
        m = np.clip(1 - edge / mortar, 0, 1)[..., None]
        f = f * (1 - m) + np.array(mortar_rgb, np.float32) * m
        # hairline cracks across some stones
        cr = np.clip(1 - np.abs(self.fbm(5, 14, seed + 3) - 0.5) * 90, 0, 1) * (self.fbm(3, 6, seed + 4) > 0.62)
        f *= (1 - 0.18 * cr)[..., None]
        stain = np.clip((self.fbm(4, 5, seed + 5) - 0.62) * 4, 0, 1)
        f *= (1 - 0.25 * stain)[..., None]
        return f

    def dirt(self, amount, color, seed):
        m = np.clip((self.fbm(5, 4, seed) - (1 - amount)) * 3, 0, 1)
        m *= self.fbm(4, 18, seed + 1) * 0.6 + 0.4
        self.blend(np.array(color, np.float32), m * 0.7)

    def water(self, chars, shallow, deep, seed, sigma=11, amt=0.7, mix_floor=True):
        cm = self.cells(chars)
        w = self.smooth(cm, sigma, amt, seed) * (1 - self.up(self.cells('#')))
        wd = ndimage.distance_transform_edt(w)
        depth = np.clip(wd / 40.0, 0, 1)[..., None]
        col = np.array(shallow, np.float32) * (1 - depth) + np.array(deep, np.float32) * depth
        n2 = self.fbm(5, 10, seed + 2)
        rip = 0.5 + 0.5 * np.sin(n2 * 46 + (self.yy + self.xx * 0.3) / 7.0)
        col *= (0.86 + 0.2 * rip)[..., None]
        col *= (0.9 + 0.2 * self.fbm(3, 24, seed + 3))[..., None]
        if mix_floor:
            shore = (np.clip(1 - wd / 10.0, 0, 1) * w)[..., None]
            col = col * (1 - 0.35 * shore) + self.img * 0.35 * shore
        wet = ndimage.gaussian_filter(w, 6) * (1 - w)
        self.img *= (1 - 0.35 * wet)[..., None]
        self.blend(col, w)
        foam = np.clip(1 - np.abs(wd - 2.5) / 2.0, 0, 1) * w
        self.img += (foam * 34)[..., None]
        return w

    # ---------- walls ----------
    def walls(self, brick_rgb, rock_rgb, band=15.0, seed=31, moss_near=None, earthy=0.0):
        wall = self.smooth(self.cells('#'), 3, 0.6, seed)
        wd = ndimage.distance_transform_edt(wall)
        edge, sid, n, g = self.voronoi(13, 5, seed + 1)
        t = g.uniform(-16, 16, n)[sid]
        brick = np.zeros((self.H, self.W, 3), np.float32)
        brick[:] = np.array(brick_rgb, np.float32)
        brick += t[..., None]
        brick *= (0.72 + 0.28 * np.clip(edge / 5.0, 0, 1))[..., None]
        brick *= (0.85 + 0.25 * self.fbm(5, 10, seed + 2))[..., None]
        bm = np.clip(1 - edge / 1.4, 0, 1)[..., None]
        brick = brick * (1 - bm) + np.array([40, 37, 38], np.float32) * bm
        brick *= (1.0 + 0.22 * np.clip(1 - wd / 3.0, 0, 1))[..., None]
        brick *= (1.0 - 0.35 * np.clip((wd - band + 4) / 4.0, 0, 1))[..., None]
        rock = np.zeros((self.H, self.W, 3), np.float32)
        rock[:] = np.array(rock_rgb, np.float32)
        rock *= (0.6 + 0.7 * self.fbm(6, 3, seed + 3))[..., None]
        cracks = np.clip(1 - np.abs(self.fbm(5, 7, seed + 4) - 0.5) * 30, 0, 1)
        rock *= (1 - 0.4 * cracks)[..., None]
        if earthy:
            soil = self.fbm(4, 8, seed + 5)
            rock = rock * (1 - earthy * soil[..., None]) + np.array([46, 36, 28], np.float32) * (earthy * soil[..., None])
        inband = np.clip((band - wd) / 1.5, 0, 1)[..., None]
        col = rock * (1 - inband) + brick * inband
        if moss_near is not None:
            moss = np.clip(ndimage.gaussian_filter(moss_near, 22) * 3.0 - 0.15, 0, 1) * np.clip(1 - wd / band, 0, 1) * (self.fbm(3, 24, seed + 6) > 0.45)
            col = col * (1 - 0.55 * moss[..., None]) + np.array([62, 90, 50], np.float32) * (0.55 * moss[..., None])
        # shadow the walls cast, light from the upper left
        open_space = 1 - wall
        sh = ndimage.shift(ndimage.gaussian_filter(wall, 5), (6, 5), order=1, mode='nearest')
        ao = ndimage.gaussian_filter(wall, 14)
        self.img *= (1 - 0.55 * sh * open_space)[..., None]
        self.img *= (1 - 0.22 * ao * open_space)[..., None]
        self.blend(col, wall)
        self.wall = wall
        self.wd = wd
        return wall

    # ---------- lighting with walls blocking light ----------
    def light(self, ambient, ambient_rgb, lights, block_chars='#', ds=4, steps=56):
        H4, W4 = self.H // ds, self.W // ds
        occ = ndimage.zoom(self.up(self.cells(block_chars)), 1 / ds, order=1)[:H4, :W4]
        occ = ndimage.binary_erosion(occ > 0.5, iterations=max(1, int(18 / ds))).astype(np.float32)
        occ = ndimage.gaussian_filter(occ, 0.6)
        gy, gx = np.mgrid[0:H4, 0:W4].astype(np.float32)
        total = np.zeros((H4, W4, 3), np.float32)
        total += np.array(ambient_rgb, np.float32) * ambient
        for L in lights:
            lx, ly = L['x'] / ds, L['y'] / ds
            vis = np.ones((H4, W4), np.float32)
            for t in np.linspace(0.0, 0.93, steps):
                sx = np.clip(lx + (gx - lx) * t, 0, W4 - 1).astype(np.int32)
                sy = np.clip(ly + (gy - ly) * t, 0, H4 - 1).astype(np.int32)
                vis = np.minimum(vis, 1 - np.clip((occ[sy, sx] - 0.45) * 4, 0, 1))
            vis = ndimage.gaussian_filter(vis, L.get('soft', 1.6))
            d = np.hypot(gx - lx, gy - ly) * ds / (L['r'])
            fall = np.exp(-d * d * 1.6) + 0.18 / (1 + d * d * 4)
            total += np.array(L['rgb'], np.float32)[None, None] * (L['i'] * fall * vis)[..., None]
        full = ndimage.zoom(total, (self.H / H4, self.W / W4, 1), order=1)[:self.H, :self.W]
        self.img *= full
        self.img += self.emit

    def finish(self, vignette=0.25, grain=2.5):
        vx, vy = (self.xx / self.W - 0.5), (self.yy / self.H - 0.5)
        vig = 1 - vignette * np.clip((vx ** 2 + vy ** 2) * 2.2, 0, 1)
        self.img *= vig[..., None]
        self.img += self.rng.normal(0, grain, (self.H, self.W, 1)).astype(np.float32)
        return Image.fromarray(np.clip(self.img, 0, 255).astype(np.uint8))

    # ---------- features ----------
    def center(self, x, y):
        return x * P + P / 2, y * P + P / 2

    def components(self, ch):
        lab, n = ndimage.label(self.cell == ch)
        out = []
        for i in range(1, n + 1):
            ys, xs = np.nonzero(lab == i)
            out.append((xs.min(), ys.min(), xs.max(), ys.max()))
        return out

    def rock(self, lay, sh, x, y, r, base=(85, 150), tint=(1.0, 0.95, 0.88)):
        rng = self.rng
        k = rng.integers(5, 9)
        a0 = rng.uniform(0, 6.28)
        pts = []
        for i in range(k):
            a = a0 + i * 6.283 / k
            rr = r * rng.uniform(0.65, 1.15)
            pts.append((x + rr * math.cos(a), y + rr * math.sin(a) * rng.uniform(0.7, 1.0)))
        tone = int(rng.uniform(*base))
        col = tuple(int(min(255, tone * c)) for c in tint) + (255,)
        sh.polygon([(px + r * 0.45, py + r * 0.6) for px, py in pts], (0, 0, 0, 150))
        lay.polygon(pts, col)
        hl = [(x + (px - x) * 0.55 - r * 0.18, y + (py - y) * 0.55 - r * 0.22) for px, py in pts]
        lay.polygon(hl, tuple(min(255, c + 32) for c in col[:3]) + (170,))

    def rubble(self, ch='r', per=26, big=2, tint=(1.0, 0.95, 0.88), dust_rgb=(140, 128, 110)):
        dust = ndimage.gaussian_filter(self.up(self.cell == ch), 10)
        self.blend(np.array(dust_rgb, np.float32), dust * 0.22)
        lay, sh = self.layer(), self.layer()
        for (cy, cx) in zip(*np.nonzero(self.cell == ch)):
            for _ in range(per):
                self.rock(lay, sh, cx * P + self.rng.uniform(4, P - 4), cy * P + self.rng.uniform(4, P - 4), self.rng.uniform(3, 11), tint=tint)
            for _ in range(big):
                self.rock(lay, sh, cx * P + self.rng.uniform(14, P - 14), cy * P + self.rng.uniform(14, P - 14), self.rng.uniform(12, 18), tint=tint)
        self.shade_layer(sh, 0.55, 2.2)
        self.put_layer(lay)

    def pebbles(self, chars, count, tint=(1.0, 0.95, 0.88)):
        cells = list(zip(*np.nonzero(np.isin(self.cell, list(chars)))))
        lay, sh = self.layer(), self.layer()
        for i in self.rng.choice(len(cells), min(count, len(cells)), replace=False):
            cy, cx = cells[i]
            for _ in range(self.rng.integers(1, 4)):
                self.rock(lay, sh, cx * P + self.rng.uniform(6, P - 6), cy * P + self.rng.uniform(6, P - 6), self.rng.uniform(2, 4.5), tint=tint)
        self.shade_layer(sh, 0.5, 1.5)
        self.put_layer(lay)

    def column_round(self, x, y, rad, color=(172, 164, 150)):
        cx, cy = self.center(x, y)
        sh = self.layer()
        sh.ellipse((cx - rad + 7, cy - rad + 9, cx + rad + 9, cy + rad + 11), (0, 0, 0, 210))
        self.shade_layer(sh, 0.6, 5)
        pl = self.layer()
        pl.rect((cx - rad - 3, cy - rad - 3, cx + rad + 3, cy + rad + 3), (96, 90, 84, 255))
        pl.rect((cx - rad - 1, cy - rad - 1, cx + rad + 1, cy + rad + 1), (112, 106, 98, 255))
        self.put_layer(pl)
        self._drum(cx, cy, rad, color)

    def _drum(self, x0, y0, rad, color, jag=0.0):
        y1, y2 = int(y0 - rad - 3), int(y0 + rad + 4)
        x1, x2 = int(x0 - rad - 3), int(x0 + rad + 4)
        sy, sx = np.mgrid[y1:y2, x1:x2]
        ang = np.arctan2(sy - y0, sx - x0)
        rr = np.hypot(sx - x0, sy - y0) / (rad * (1 + jag * np.sin(ang * 7 + 1.3) * 0.12 + jag * np.sin(ang * 13) * 0.06))
        inside = np.clip((1 - rr) * rad, 0, 1)
        lx, ly = (sx - (x0 - rad * 0.35)) / rad, (sy - (y0 - rad * 0.4)) / rad
        light = np.clip(1.15 - 0.55 * np.hypot(lx, ly), 0.45, 1.15)
        ring = np.clip(1 - np.abs(rr - 0.78) / 0.06, 0, 1) * (1 - jag)
        col = np.array(color, np.float32) * light[..., None] * (1 - 0.22 * ring[..., None])
        if jag:  # broken top: rough fractured surface
            col *= (0.75 + 0.45 * np.random.default_rng(3).random(col.shape[:2]))[..., None] ** 0.5
        a = inside[..., None]
        self.img[y1:y2, x1:x2] = self.img[y1:y2, x1:x2] * (1 - a) + col * a

    def column_broken(self, x, y, rad):
        cx, cy = self.center(x, y)
        sh = self.layer()
        sh.ellipse((cx - rad + 5, cy - rad + 7, cx + rad + 7, cy + rad + 9), (0, 0, 0, 200))
        self.shade_layer(sh, 0.55, 4)
        self._drum(cx, cy, rad, (168, 160, 148), jag=0.6)
        lay, s2 = self.layer(), self.layer()
        for _ in range(6):
            a = self.rng.uniform(0, 6.28)
            d = rad + self.rng.uniform(4, 16)
            self.rock(lay, s2, cx + d * math.cos(a), cy + d * math.sin(a), self.rng.uniform(3, 7))
        self.shade_layer(s2, 0.5, 2)
        self.put_layer(lay)

    def column_square(self, x, y, half, color=(120, 122, 128)):
        cx, cy = self.center(x, y)
        sh = self.layer()
        sh.rect((cx - half + 6, cy - half + 8, cx + half + 8, cy + half + 10), (0, 0, 0, 220))
        self.shade_layer(sh, 0.65, 5)
        lay = self.layer()
        c = color
        lay.rect((cx - half, cy - half, cx + half, cy + half), (int(c[0] * 0.7), int(c[1] * 0.7), int(c[2] * 0.7), 255))
        lay.rect((cx - half + 3, cy - half + 3, cx + half - 3, cy + half - 3), c + (255,))
        # carved knot ring on the capital
        lay.rect((cx - half + 9, cy - half + 9, cx + half - 9, cy + half - 9), (int(c[0] * 0.8), int(c[1] * 0.8), int(c[2] * 0.8), 255))
        lay.rect((cx - half + 12, cy - half + 12, cx + half - 12, cy + half - 12), (int(c[0] * 1.05), int(c[1] * 1.05), int(c[2] * 1.05), 255))
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            lay.line([(cx + math.cos(a) * 6, cy + math.sin(a) * 6), (cx + math.cos(a) * (half - 4), cy + math.sin(a) * (half - 4))], (int(c[0] * 0.6), int(c[1] * 0.6), int(c[2] * 0.6), 220), 2)
        lay.line([(cx - half + 3, cy - half + 3), (cx + half - 3, cy - half + 3)], (min(255, c[0] + 40), min(255, c[1] + 40), min(255, c[2] + 40), 200), 2)
        lay.line([(cx - half + 3, cy - half + 3), (cx - half + 3, cy + half - 3)], (min(255, c[0] + 30), min(255, c[1] + 30), min(255, c[2] + 30), 180), 2)
        self.put_layer(lay)

    def stairs(self, x0, y0, x1, y1, toward, color=(124, 116, 104), dark=0.9, steps=10):
        """Steps over the cell rect, descending toward 'W','E','N','S'. Darkens with depth."""
        X0, Y0, X1, Y1 = x0 * P, y0 * P, (x1 + 1) * P, (y1 + 1) * P
        horiz = toward in 'WE'
        length = (X1 - X0) if horiz else (Y1 - Y0)
        step = length / steps
        sub = self.img[Y0:Y1, X0:X1]
        h, w = sub.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        u = xx if horiz else yy
        if toward in 'WN':
            u = length - u  # distance travelled down the stairs
        k = np.floor(u / step)
        frac = (u - k * step) / step
        g = np.random.default_rng(int(x0 * 31 + y0 * 17))
        tone = g.uniform(-10, 10, steps + 2)[k.astype(int).clip(0, steps)]
        col = np.zeros((h, w, 3), np.float32)
        col[:] = np.array(color, np.float32)
        col += tone[..., None]
        col *= (0.88 + 0.22 * self.fbm(4, 14, 77)[Y0:Y1, X0:X1])[..., None]
        nose = np.clip(1 - frac / 0.16, 0, 1)            # lit edge at the top of each step
        riser = np.clip((frac - 0.74) / 0.26, 0, 1)      # shadowed drop to the next step
        col *= (1 + 0.35 * nose - 0.6 * riser)[..., None]
        depth = (k * step + frac * step) / length
        col *= (1 - dark * depth ** 1.3)[..., None]
        # side walls of the stairwell
        side = yy if horiz else xx
        span = h if horiz else w
        edge = np.minimum(side, span - 1 - side)
        sw = np.clip(1 - edge / 9.0, 0, 1)
        col *= (1 - 0.55 * sw)[..., None]
        self.img[Y0:Y1, X0:X1] = col

    def door_open(self, x, y, hinge='N', swing='E', wood=(96, 62, 38)):
        """An open wooden door in a 1-square gap of a vertical wall. Threshold plus a leaf swung against the wall."""
        X, Y = x * P, y * P
        lay, sh = self.layer(), self.layer()
        # threshold slab
        lay.rect((X + 4, Y + 2, X + P - 4, Y + P - 2), (118, 110, 98, 255))
        lay.rect((X + 7, Y + 5, X + P - 7, Y + P - 5), (132, 124, 110, 255))
        # jambs
        lay.rect((X + 2, Y - 6, X + P - 2, Y + 4), (92, 86, 82, 255))
        lay.rect((X + 2, Y + P - 4, X + P - 2, Y + P + 6), (92, 86, 82, 255))
        # leaf: hinged at the north jamb on the east face, swung ~80 degrees to lie near the wall
        hx, hy = (X + P - 4, Y + 4) if swing == 'E' else (X + 4, Y + 4)
        ang = math.radians(-62 if swing == 'E' else -118)
        Lw, T = P + 2, 14
        dx, dy = math.cos(ang), math.sin(ang)
        nx, ny = -dy, dx
        corners = [(hx, hy), (hx + dx * Lw, hy + dy * Lw), (hx + dx * Lw + nx * T, hy + dy * Lw + ny * T), (hx + nx * T, hy + ny * T)]
        sh.polygon([(px + 5, py + 6) for px, py in corners], (0, 0, 0, 170))
        lay.polygon(corners, wood + (255,))
        for f in (0.25, 0.5, 0.75):  # plank seams
            a = (hx + dx * Lw * f, hy + dy * Lw * f)
            lay.line([a, (a[0] + nx * T, a[1] + ny * T)], (70, 45, 26, 255), 1)
        for f in (0.15, 0.85):  # iron straps
            a = (hx + dx * Lw * f, hy + dy * Lw * f)
            lay.line([a, (a[0] + nx * T, a[1] + ny * T)], (48, 48, 52, 255), 3)
        lay.line([corners[0], corners[1]], (150, 104, 66, 255), 1)
        self.shade_layer(sh, 0.6, 3)
        self.put_layer(lay)

    def sealed_door(self, x0, y0, x1, y1):
        """A round stone puzzle door set into the wall, with three carved rings."""
        X0, Y0, X1, Y1 = x0 * P, y0 * P, (x1 + 1) * P, (y1 + 1) * P
        cx, cy = (X0 + X1) / 2, (Y0 + Y1) / 2 + 6
        lay = self.layer()
        lay.rect((X0 - 6, Y0 + 10, X1 + 6, Y1 + 2), (70, 70, 76, 255))
        R = (X1 - X0) / 2 - 6
        lay.rect((X0 - 10, Y0 + 4, X1 + 10, Y0 + 14), (104, 104, 110, 255))   # lintel
        for i, (r, c) in enumerate([(R, (118, 120, 128)), (R * 0.74, (140, 142, 150)), (R * 0.5, (118, 120, 128)), (R * 0.26, (150, 152, 160))]):
            lay.ellipse((cx - r - 2, cy - r * 0.62 - 2, cx + r + 2, cy + r * 0.62 + 2), (44, 44, 50, 255))   # groove
            lay.ellipse((cx - r, cy - r * 0.62, cx + r, cy + r * 0.62), c + (255,))
            if i < 3:
                for k in range(3):  # carved animal-symbol notches
                    a = k * 2.094 + i * 0.6
                    lay.ellipse((cx + math.cos(a) * r * 0.86 - 4, cy + math.sin(a) * r * 0.86 * 0.62 - 3, cx + math.cos(a) * r * 0.86 + 4, cy + math.sin(a) * r * 0.86 * 0.62 + 3), (58, 60, 66, 255))
        lay.ellipse((cx - 5, cy - 4, cx + 5, cy + 4), (40, 42, 48, 255))
        self.put_layer(lay)
        # faint cold glow in the carvings
        self.glow(cx, cy, R * 1.3, (40, 90, 120), 0.35)

    def glow(self, x, y, r, rgb, strength):
        d = np.hypot(self.xx - x, self.yy - y) / r
        g = np.exp(-d * d * 2.2) * strength
        self.emit += g[..., None] * np.array(rgb, np.float32)

    def sarcophagus(self, x0, y0, x1, y1, stone=(118, 116, 112), effigy=True, big=False):
        X0, Y0, X1, Y1 = x0 * P, y0 * P, (x1 + 1) * P, (y1 + 1) * P
        inset = 7 if not big else 10
        a, b, c, d = X0 + inset, Y0 + inset, X1 - inset, Y1 - inset
        sh, lay = self.layer(), self.layer()
        sh.rect((a + 7, b + 9, c + 9, d + 11), (0, 0, 0, 230))
        self.shade_layer(sh, 0.6, 5)
        s = stone
        dk = tuple(int(v * 0.68) for v in s)
        lt = tuple(min(255, int(v * 1.12)) for v in s)
        lay.rect((a, b, c, d), dk + (255,))
        lay.rect((a + 3, b + 3, c - 3, d - 3), s + (255,))
        lay.rect((a + 7, b + 7, c - 7, d - 7), lt + (255,))
        lay.line([(a + 3, b + 3), (c - 3, b + 3)], (min(255, s[0] + 45), min(255, s[1] + 45), min(255, s[2] + 45), 220), 2)
        lay.line([(a + 3, b + 3), (a + 3, d - 3)], (min(255, s[0] + 35), min(255, s[1] + 35), min(255, s[2] + 35), 200), 2)
        if effigy:
            vertical = (d - b) >= (c - a)
            mx, my = (a + c) / 2, (b + d) / 2
            L = ((d - b) if vertical else (c - a)) - 26
            Wd = ((c - a) if vertical else (d - b)) - 26
            ec = tuple(int(v * 0.82) for v in s) + (255,)
            hc = tuple(min(255, int(v * 1.2)) for v in s) + (255,)
            if vertical:
                hy = b + 13 + Wd * 0.35
                lay.ellipse((mx - Wd * 0.28, hy - Wd * 0.28, mx + Wd * 0.28, hy + Wd * 0.28), ec)
                lay.ellipse((mx - Wd * 0.22, hy - Wd * 0.25, mx + Wd * 0.18, hy + Wd * 0.2), hc)
                lay.rounded((mx - Wd * 0.45, hy + Wd * 0.3, mx + Wd * 0.45, d - 12), Wd * 0.3, ec)
                lay.line([(mx, hy + Wd * 0.45), (mx, d - 16)], (int(s[0] * 0.55), int(s[1] * 0.55), int(s[2] * 0.6), 255), 3)  # sword
                lay.line([(mx - Wd * 0.25, hy + Wd * 0.8), (mx + Wd * 0.25, hy + Wd * 0.8)], (int(s[0] * 0.55), int(s[1] * 0.55), int(s[2] * 0.6), 255), 3)
            else:
                hx = a + 13 + Wd * 0.35
                lay.ellipse((hx - Wd * 0.28, my - Wd * 0.28, hx + Wd * 0.28, my + Wd * 0.28), ec)
                lay.rounded((hx + Wd * 0.3, my - Wd * 0.45, c - 12, my + Wd * 0.45), Wd * 0.3, ec)
                lay.line([(hx + Wd * 0.45, my), (c - 16, my)], (int(s[0] * 0.55), int(s[1] * 0.55), int(s[2] * 0.6), 255), 3)
        if big:  # carved border band
            lay.outline((a + 12, b + 12, c - 12, d - 12), (int(s[0] * 0.7), int(s[1] * 0.7), int(s[2] * 0.7), 255), 2)
        self.put_layer(lay)

    def dais(self, x0, y0, x1, y1, stone=(104, 104, 110)):
        X0, Y0, X1, Y1 = x0 * P + 4, y0 * P + 4, (x1 + 1) * P - 4, (y1 + 1) * P - 4
        sh, lay = self.layer(), self.layer()
        sh.rect((X0 + 4, Y0 + 6, X1 + 6, Y1 + 8), (0, 0, 0, 160))
        self.shade_layer(sh, 0.45, 4)
        lay.rect((X0, Y0, X1, Y1), tuple(int(v * 0.75) for v in stone) + (255,))
        lay.rect((X0 + 4, Y0 + 4, X1 - 4, Y1 - 4), stone + (255,))
        # flagstone joints
        for gx in range(int(X0) + 48, int(X1) - 10, 48):
            lay.line([(gx, Y0 + 4), (gx, Y1 - 4)], tuple(int(v * 0.7) for v in stone) + (200,), 1)
        for gy in range(int(Y0) + 40, int(Y1) - 10, 40):
            lay.line([(X0 + 4, gy), (X1 - 4, gy)], tuple(int(v * 0.7) for v in stone) + (200,), 1)
        lay.line([(X0 + 4, Y0 + 4), (X1 - 4, Y0 + 4)], tuple(min(255, v + 40) for v in stone) + (220,), 2)
        self.put_layer(lay)
        tex = (0.88 + 0.22 * self.fbm(4, 12, 91))[Y0:Y1, X0:X1]
        self.img[int(Y0):int(Y1), int(X0):int(X1)] *= tex[..., None]

    def niche(self, x, y, facing, body=True):
        """A burial alcove cut into the wall square (x, y), open toward 'S' or 'N'."""
        X, Y = x * P, y * P
        lay = self.layer()
        if facing == 'S':
            box = (X + 5, Y + 14, X + P - 5, Y + P + 2)
        else:
            box = (X + 5, Y - 2, X + P - 5, Y + P - 14)
        lay.rect((box[0] - 3, box[1] - 3, box[2] + 3, box[3] + 3), (78, 74, 72, 255))
        lay.rect(box, (30, 28, 30, 255))
        lay.rect((box[0] + 2, box[1] + 2, box[2] - 2, box[3] - 2), (40, 37, 38, 255))
        if body:
            by = (box[1] + box[3]) / 2
            lay.rounded((box[0] + 6, by - 8, box[2] - 6, by + 8), 7, (146, 134, 108, 255))
            for k in range(7):
                wx = box[0] + 12 + k * (box[2] - box[0] - 24) / 6
                lay.line([(wx - 3, by - 7), (wx + 3, by + 7)], (112, 100, 80, 255), 1)
            lay.ellipse((box[0] + 5, by - 7, box[0] + 17, by + 7), (128, 116, 92, 255))
        self.put_layer(lay)

    def bones(self, ch='b', per=6):
        lay, sh = self.layer(), self.layer()
        bone = (206, 198, 174, 255)
        for (cy, cx) in zip(*np.nonzero(self.cell == ch)):
            for _ in range(per):
                x = cx * P + self.rng.uniform(10, P - 10)
                y = cy * P + self.rng.uniform(10, P - 10)
                a = self.rng.uniform(0, math.pi)
                L = self.rng.uniform(9, 20)
                p1 = (x - math.cos(a) * L / 2, y - math.sin(a) * L / 2)
                p2 = (x + math.cos(a) * L / 2, y + math.sin(a) * L / 2)
                sh.line([(p1[0] + 2, p1[1] + 3), (p2[0] + 2, p2[1] + 3)], (0, 0, 0, 160), 4)
                lay.line([p1, p2], bone, 3)
                for p in (p1, p2):
                    lay.ellipse((p[0] - 2.6, p[1] - 2.6, p[0] + 2.6, p[1] + 2.6), bone)
            # a skull and a few ribs
            x, y = cx * P + self.rng.uniform(18, P - 18), cy * P + self.rng.uniform(18, P - 18)
            sh.ellipse((x - 8 + 3, y - 9 + 4, x + 8 + 3, y + 8 + 4), (0, 0, 0, 170))
            lay.ellipse((x - 8, y - 9, x + 8, y + 7), (214, 206, 182, 255))
            lay.rect((x - 5, y + 3, x + 5, y + 9), (200, 192, 168, 255))
            lay.ellipse((x - 5.5, y - 4, x - 1.5, y), (40, 34, 30, 255))
            lay.ellipse((x + 1.5, y - 4, x + 5.5, y), (40, 34, 30, 255))
            rx, ry = x + self.rng.uniform(-14, 14), y + self.rng.uniform(10, 16)
            for k in range(4):
                lay.arc((rx - 10, ry - 6 + k * 4, rx + 10, ry + 10 + k * 4), 200, 340, (196, 188, 164, 255), 2)
        self.shade_layer(sh, 0.5, 1.5)
        self.put_layer(lay)

    def brazier(self, x, y):
        cx, cy = self.center(x, y)
        sh, lay = self.layer(), self.layer()
        sh.ellipse((cx - 20 + 5, cy - 20 + 7, cx + 20 + 7, cy + 20 + 9), (0, 0, 0, 200))
        for k in range(3):  # tripod feet
            a = k * 2.094 + 0.5
            lay.line([(cx, cy), (cx + math.cos(a) * 26, cy + math.sin(a) * 26)], (38, 34, 32, 255), 4)
        self.shade_layer(sh, 0.6, 4)
        lay.ellipse((cx - 20, cy - 20, cx + 20, cy + 20), (46, 40, 38, 255))
        lay.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), (70, 60, 54, 255))
        lay.ellipse((cx - 15, cy - 15, cx + 15, cy + 15), (60, 28, 14, 255))
        self.put_layer(lay)
        # coals and flame, bright after lighting
        d = np.hypot(self.xx - cx, self.yy - cy)
        core = np.clip(1 - d / 15, 0, 1)
        flick = 0.6 + 0.4 * self.fbm(3, 40, 5)
        coal = core * flick
        self.img = self.img * (1 - core[..., None] * 0.9) + np.array([90, 30, 6], np.float32) * (core[..., None] * 0.9)
        self.emit += (coal ** 1.2)[..., None] * np.array([255, 150, 50], np.float32)
        self.emit += (np.clip(1 - d / 7, 0, 1) ** 1.5)[..., None] * np.array([120, 110, 70], np.float32)
        self.glow(cx, cy, 44, (120, 60, 15), 0.6)

    def sconce(self, x, y):
        """A wall torch at pixel position (x, y): small iron bracket plus flame and glow."""
        lay = self.layer()
        lay.ellipse((x - 6, y - 6, x + 6, y + 6), (40, 36, 34, 255))
        self.put_layer(lay)
        d = np.hypot(self.xx - x, self.yy - y)
        self.emit += (np.clip(1 - d / 6, 0, 1) ** 1.3)[..., None] * np.array([255, 190, 90], np.float32)
        self.glow(x, y, 46, (140, 70, 20), 0.5)

    def candles(self, x, y, n=3, spread=10):
        for _ in range(n):
            cx, cy = x + self.rng.uniform(-spread, spread), y + self.rng.uniform(-spread * 0.4, spread * 0.4)
            lay = self.layer()
            lay.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), (214, 204, 176, 255))
            self.put_layer(lay)
            d = np.hypot(self.xx - cx, self.yy - cy)
            self.emit += (np.clip(1 - d / 4, 0, 1) ** 1.4)[..., None] * np.array([255, 200, 110], np.float32)
        self.glow(x, y, 30, (120, 70, 25), 0.35)

    def eyes(self, x, y, gap=6, rgb=(150, 215, 255)):
        """A pair of glowing eyes (a body that may not stay down), centered at pixel (x, y), lying east-west."""
        for ey in (y - gap / 2, y + gap / 2):
            d = np.hypot(self.xx - x, self.yy - ey)
            self.emit += (np.clip(1 - d / 2.6, 0, 1) ** 1.2)[..., None] * np.array(rgb, np.float32)
        self.glow(x, y, 18, (30, 70, 110), 0.6)

    def fungus(self, x, y, n=9, spread=22):
        lay = self.layer()
        for _ in range(n):
            cx, cy = x + self.rng.uniform(-spread, spread), y + self.rng.uniform(-spread, spread)
            r = self.rng.uniform(2, 5)
            lay.ellipse((cx - r, cy - r, cx + r, cy + r), (110, 210, 190, 255))
            d = np.hypot(self.xx - cx, self.yy - cy)
            self.emit += (np.clip(1 - d / (r + 2), 0, 1))[..., None] * np.array([60, 140, 120], np.float32)
        self.put_layer(lay)
        self.glow(x, y, 60, (20, 70, 60), 0.5)

    def urns(self, x, y, n=3):
        lay, sh = self.layer(), self.layer()
        for i in range(n):
            cx = x * P + self.rng.uniform(16, P - 16)
            cy = y * P + self.rng.uniform(16, P - 16)
            r = self.rng.uniform(9, 14)
            clay = (int(self.rng.uniform(130, 160)), int(self.rng.uniform(84, 100)), int(self.rng.uniform(56, 68)))
            sh.ellipse((cx - r + 4, cy - r + 5, cx + r + 4, cy + r + 5), (0, 0, 0, 190))
            lay.ellipse((cx - r, cy - r, cx + r, cy + r), clay + (255,))
            lay.ellipse((cx - r * 0.75, cy - r * 0.75, cx + r * 0.55, cy + r * 0.55), tuple(min(255, v + 22) for v in clay) + (255,))
            lay.ellipse((cx - r * 0.42, cy - r * 0.42, cx + r * 0.42, cy + r * 0.42), (int(clay[0] * 0.6), int(clay[1] * 0.6), int(clay[2] * 0.6), 255))
            lay.ellipse((cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3), (24, 18, 16, 255))
        # shards of a broken one
        for _ in range(5):
            sx, sy = x * P + self.rng.uniform(8, P - 8), y * P + self.rng.uniform(8, P - 8)
            a = self.rng.uniform(0, 6.28)
            pts = [(sx + math.cos(a + k * 2.1) * self.rng.uniform(2, 5), sy + math.sin(a + k * 2.1) * self.rng.uniform(2, 5)) for k in range(3)]
            lay.polygon(pts, (150, 92, 62, 255))
        self.shade_layer(sh, 0.55, 3)
        self.put_layer(lay)

    def cobweb(self, x, y, corner, size=46, alpha=70):
        """A web in a room corner at pixel (x, y). corner: 'NW','NE','SW','SE' (where the walls are)."""
        lay = self.layer()
        sx = 1 if 'W' in corner else -1
        sy = 1 if 'N' in corner else -1
        col = (225, 225, 230, alpha)
        spokes = []
        for k in range(6):
            a = (k / 5) * (math.pi / 2)
            spokes.append((x + sx * math.cos(a) * size, y + sy * math.sin(a) * size))
            lay.line([(x, y), spokes[-1]], col, 1)
        for r in (0.3, 0.5, 0.7, 0.9):
            pts = [(x + (px - x) * r, y + (py - y) * r) for px, py in spokes]
            for i in range(len(pts) - 1):
                mx = (pts[i][0] + pts[i + 1][0]) / 2 - sx * 2
                my = (pts[i][1] + pts[i + 1][1]) / 2 - sy * 2
                lay.line([pts[i], (mx, my), pts[i + 1]], col, 1)
        self.put_layer(lay)

    def roots(self, x, y, length, angle, count=3):
        lay = self.layer()
        for k in range(count):
            px, py = x, y
            a = angle + self.rng.uniform(-0.5, 0.5)
            w = 4
            for s in range(int(length / 6)):
                nx_, ny_ = px + math.cos(a) * 6, py + math.sin(a) * 6
                lay.line([(px, py), (nx_, ny_)], (62, 44, 30, 255), max(1, int(w)))
                px, py = nx_, ny_
                a += self.rng.uniform(-0.35, 0.35)
                w *= 0.93
        self.put_layer(lay)


class Layer:
    """RGBA drawing surface at 2x for smooth edges; coordinates in map pixels."""
    def __init__(self, W, H):
        self.im = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.W, self.H = W, H

    def _p(self, pts):
        return [(x * SS, y * SS) for x, y in pts]

    def _b(self, box):
        return [box[0] * SS, box[1] * SS, box[2] * SS, box[3] * SS]

    def polygon(self, pts, fill):
        self.d.polygon(self._p(pts), fill=fill)

    def ellipse(self, box, fill):
        self.d.ellipse(self._b(box), fill=fill)

    def rect(self, box, fill):
        self.d.rectangle(self._b(box), fill=fill)

    def outline(self, box, color, width):
        self.d.rectangle(self._b(box), outline=color, width=width * SS)

    def rounded(self, box, r, fill):
        self.d.rounded_rectangle(self._b(box), radius=r * SS, fill=fill)

    def line(self, pts, fill, width):
        self.d.line(self._p(pts), fill=fill, width=max(1, int(width * SS)), joint='curve')

    def arc(self, box, a0, a1, fill, width):
        self.d.arc(self._b(box), a0, a1, fill=fill, width=max(1, int(width * SS)))

    def done(self, blur=0):
        im = self.im.resize((self.W, self.H), Image.LANCZOS)
        if blur:
            im = im.filter(ImageFilter.GaussianBlur(blur))
        return np.asarray(im, np.float32)
