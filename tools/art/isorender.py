"""A tiny pixel-exact isometric 2:1 renderer (no anti-aliasing) for the set pieces that are not generated art:
boxes, prisms, posts, awnings, cones, with material textures and three-step light (top = light, left = base, right = shade).
Lot-local coordinates: (a, b) in 0..1, (0, 0) = back corner, (1, 1) = front corner (the sprite anchor), z = height in px."""
import numpy as np
from PIL import Image, ImageDraw
from pixlib import LOT_W, LOT_H, STEP_X, STEP_Y, hsh, INK

WOOD = {"light": (158, 114, 73), "base": (122, 82, 48), "shade": (86, 56, 32), "dark": (48, 29, 17)}
PLANK = {"light": (176, 134, 88), "base": (140, 100, 62), "shade": (100, 68, 42), "dark": (56, 36, 22)}
CANVAS = {"light": (238, 226, 196), "base": (222, 202, 168), "shade": (176, 156, 124), "dark": (110, 94, 72)}
SLATE = {"light": (133, 126, 120), "base": (110, 101, 97), "shade": (78, 70, 64), "dark": (46, 40, 36)}
TAR = {"light": (84, 74, 66), "base": (62, 54, 48), "shade": (42, 36, 32), "dark": (28, 24, 20)}
STONE = {"light": (176, 172, 160), "base": (146, 142, 132), "shade": (108, 104, 96), "dark": (64, 62, 58)}
BRASS = {"light": (226, 196, 130), "base": (196, 160, 90), "shade": (140, 106, 56), "dark": (86, 62, 30)}
ROPE = {"light": (206, 184, 140), "base": (170, 146, 104), "shade": (120, 98, 68), "dark": (80, 62, 40)}
STRIPE_RED = {"light": (214, 128, 92), "base": (184, 99, 63), "shade": (142, 74, 46), "dark": (90, 46, 30)}
GLASS = {"light": (232, 244, 240), "base": (190, 216, 212), "shade": (130, 160, 160), "dark": (70, 90, 94)}
FACE_STEP = {"top": "light", "left": "base", "right": "shade"}


class Sprite:
    def __init__(self, w, h, ax, ay, seed=1):
        self.w, self.h, self.ax, self.ay, self.seed = w, h, ax, ay, seed
        self.a = np.zeros((h, w, 4), np.uint8)

    def P(self, a, b, z=0.0):
        return (self.ax + (a - b) * STEP_X, self.ay + (a + b - 2) * STEP_Y - z)

    def _mask(self, pts):
        im = Image.new("L", (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([(round(x), round(y)) for x, y in pts], fill=255)
        return np.array(im) > 0

    def fill(self, pts, color_fn, edge=None):
        """Fill a polygon; color_fn(x, y) -> rgb. Edge: rgb drawn as a 1 px polygon outline."""
        m = self._mask(pts)
        yy, xx = np.nonzero(m)
        for y, x in zip(yy, xx):
            self.a[y, x] = (*color_fn(x, y), 255)
        if edge is not None:
            im = Image.new("L", (self.w, self.h), 0)
            d = ImageDraw.Draw(im)
            d.line([(round(x), round(y)) for x, y in list(pts) + [pts[0]]], fill=255, width=1)
            e = np.array(im) > 0
            e &= m | True
            for y, x in zip(*np.nonzero(e & m)):
                self.a[y, x] = (*edge, 255)

    # ---- materials -------------------------------------------------------------------------------------------
    def tex(self, mat, ramp, face, u, v, salt=0):
        """Colour of material `mat` on a face at face coordinates (u along, v down in px)."""
        step = FACE_STEP[face]
        base = ramp[step]
        r = hsh(int(u) // 1, int(v) // 1, salt + self.seed)
        if mat == "plank":                  # vertical planks, ~6 px wide, tonal shift per plank, grain ticks, dark seams
            pu = int(u) // 6
            seam = int(u) % 6 == 0
            c = base
            sh = hsh(pu, salt, self.seed)
            if sh < 0.3:
                c = ramp["shade" if face != "right" else "dark"]
            elif sh > 0.78:
                c = ramp["light" if face != "right" else "base"]
            if seam:
                c = ramp["dark"]
            elif r < 0.07:
                c = ramp["dark"]
            return c
        if mat == "hplank":                 # horizontal boards
            pv = int(v) // 4
            c = base
            sh = hsh(pv, salt, self.seed)
            if sh < 0.3:
                c = ramp["shade" if face != "right" else "dark"]
            elif sh > 0.75:
                c = ramp["light" if face != "right" else "base"]
            if int(v) % 4 == 0:
                c = ramp["dark"]
            elif r < 0.05:
                c = ramp["dark"]
            return c
        if mat == "stone":                  # coursed blocks with mortar
            course = int(v) // 5
            off = 4 if course % 2 else 0
            bx = (int(u) + off) // 8
            c = ramp["base"] if hsh(bx, course, salt) < 0.5 else ramp[step] if face != "top" else ramp["light"]
            if int(v) % 5 == 0 or (int(u) + off) % 8 == 0:
                c = ramp["dark"] if face != "top" else ramp["shade"]
            return c
        if mat == "cloth":                  # canvas: folds as soft diagonal bands, a few stitches
            band = (int(u) + int(v) // 2) % 9
            c = ramp["light"] if band in (0, 1) else base
            if band in (5, 6):
                c = ramp["shade"]
            if r < 0.03:
                c = ramp["shade"]
            return c
        return base

    def face(self, pts, mat, ramp, face, edge=None, salt=0, origin=None, uv=None):
        o = origin or pts[0]

        def fn(x, y):
            if uv is not None:
                u, v = uv(x, y)
            else:
                u, v = x - o[0], y - o[1]
            return self.tex(mat, ramp, face, u, v, salt)

        self.fill(pts, fn, edge if edge is not None else ramp["dark"])

    # ---- solids -----------------------------------------------------------------------------------------------
    def box(self, a0, b0, a1, b1, z0, h, mat="plank", ramp=PLANK, top_mat=None, top_ramp=None, salt=0):
        P = self.P
        z1 = z0 + h
        # left face: plane b = b1 (spans a0..a1), right face: plane a = a1 (spans b0..b1)
        L = [P(a0, b1, z1), P(a1, b1, z1), P(a1, b1, z0), P(a0, b1, z0)]
        R = [P(a1, b1, z1), P(a1, b0, z1), P(a1, b0, z0), P(a1, b1, z0)]
        T = [P(a0, b0, z1), P(a1, b0, z1), P(a1, b1, z1), P(a0, b1, z1)]
        lx, ly = L[0]
        self.face(L, mat, ramp, "left", salt=salt, uv=lambda x, y: (x - lx, y - (ly + (x - lx) * 0.5)))
        rx, ry = R[1]
        self.face(R, mat, ramp, "right", salt=salt + 1, uv=lambda x, y: (x - rx, y - (ry - (x - rx) * 0.5)))
        self.face(T, top_mat or ("hplank" if mat in ("plank", "hplank") else mat), top_ramp or ramp, "top", salt=salt + 2, uv=lambda x, y: (x, y))

    def prism(self, a0, b0, a1, b1, z0, rise, ridge_along="a", mat="cloth", ramp=CANVAS, salt=0, overhang=0.0):
        """Gable roof: ridge runs along `a` (ridge at b = mid) or along `b`. Draws the two slopes; gable ends are left to the caller."""
        P = self.P
        z1 = z0 + rise
        if ridge_along == "a":
            bm = (b0 + b1) / 2
            front = [P(a0, b1, z0), P(a1, b1, z0), P(a1, bm, z1), P(a0, bm, z1)]       # slope facing +b (left-front)
            back = [P(a0, bm, z1), P(a1, bm, z1), P(a1, b0, z0), P(a0, b0, z0)]
            end_r = [P(a1, b1, z0), P(a1, b0, z0), P(a1, bm, z1)]                      # right gable end (a = a1)
            self.face(back, mat, ramp, "top", salt=salt, uv=lambda x, y: (x, y))
            self.face(front, mat, ramp, "left", salt=salt + 1, uv=lambda x, y: (x, y))
            self.face(end_r, "plank", WOOD, "right", salt=salt + 2, uv=lambda x, y: (x, y))
        else:
            am = (a0 + a1) / 2
            front = [P(a1, b0, z0), P(a1, b1, z0), P(am, b1, z1), P(am, b0, z1)]       # slope facing +a (right-front)
            back = [P(am, b0, z1), P(am, b1, z1), P(a0, b1, z0), P(a0, b0, z0)]
            end_l = [P(a0, b1, z0), P(a1, b1, z0), P(am, b1, z1)]                      # left gable end (b = b1)
            self.face(back, mat, ramp, "top", salt=salt, uv=lambda x, y: (x, y))
            self.face(end_l, "plank", WOOD, "left", salt=salt + 2, uv=lambda x, y: (x, y))
            self.face(front, mat, ramp, "right", salt=salt + 1, uv=lambda x, y: (x, y))

    def post(self, a, b, z0, h, w=3, ramp=WOOD, cap=True):
        x, y = self.P(a, b, z0)
        x0 = round(x - w / 2)
        for dy in range(int(h)):
            for dx in range(w):
                c = ramp["light"] if dx == 0 else ramp["shade"] if dx == w - 1 else ramp["base"]
                if dy % 7 == 6:
                    c = ramp["dark"]
                self._px(x0 + dx, round(y) - dy, c)
        if cap:
            for dx in range(w):
                self._px(x0 + dx, round(y) - int(h), ramp["light"])

    def line(self, p, q, color, width=1):
        im = Image.new("L", (self.w, self.h), 0)
        ImageDraw.Draw(im).line([(round(p[0]), round(p[1])), (round(q[0]), round(q[1]))], fill=255, width=width)
        for y, x in zip(*np.nonzero(np.array(im) > 0)):
            self.a[y, x] = (*color, 255)

    def disc(self, cx, cy, r, color):
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        m = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r + 0.3
        self.a[m] = (*color, 255)

    def _px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = (*c, 255)

    def rect(self, x, y, w, h, color):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self._px(xx, yy, color)

    def shadow(self, a0=0.1, b0=0.1, a1=0.95, b1=0.95, alpha=0.0):
        """Contact shadow: a dithered fringe hugging the base of the sprite to the lower right (drawn into empty pixels only, after finish())."""
        m = self.a[..., 3] > 0
        zone = np.zeros_like(m)
        zone[max(0, self.ay - 34):, :] = True
        sh = np.zeros_like(m)
        for dx, dy in ((2, 1), (3, 1), (4, 2), (1, 1), (5, 2)):
            sh |= np.roll(np.roll(m & zone, dy, 0), dx, 1)
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        sh &= ~m & (((xx + yy) % 2) == 0)
        self.a[sh] = (28, 36, 22, 255)

    def finish(self, outline=True):
        a = self.a
        if outline:
            m = a[..., 3] > 0
            from scipy import ndimage as ndi
            ring = ndi.binary_dilation(m, structure=ndi.generate_binary_structure(2, 1)) & ~m
            a[ring] = (*INK, 255)
        return a
