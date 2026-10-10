"""Extra isometric primitives and materials for the village, town and city models (on top of isorender.Sprite):
hip roofs, round towers, cones, domes, windows, doors, chimneys, gears, lamps. Hard pixels, three-step light, no baked base slab.
Footprint coordinates: a model for a U x U claim spans a, b in [1 - U, 1]; its front vertex (1, 1) is the sprite anchor."""
import numpy as np
from isorender import *
from pixlib import hsh, INK, STEP_X, STEP_Y

# ---- era palettes ----------------------------------------------------------------------------------------
THATCH = {"light": (236, 204, 116), "base": (206, 164, 76), "shade": (154, 114, 54), "dark": (96, 66, 34)}
DAUB = {"light": (240, 226, 192), "base": (214, 194, 156), "shade": (164, 146, 112), "dark": (102, 88, 68)}
FIELDSTONE = {"light": (186, 178, 160), "base": (152, 144, 128), "shade": (112, 106, 94), "dark": (70, 66, 58)}
BRICK = {"light": (204, 116, 88), "base": (170, 88, 64), "shade": (126, 62, 46), "dark": (78, 36, 30)}
TILE = {"light": (232, 138, 90), "base": (202, 104, 62), "shade": (148, 70, 44), "dark": (90, 40, 28)}
MARBLE = {"light": (244, 240, 230), "base": (220, 214, 202), "shade": (168, 162, 152), "dark": (100, 96, 90)}
IRON = {"light": (132, 138, 152), "base": (98, 104, 118), "shade": (68, 72, 86), "dark": (36, 38, 48)}
SOOT = {"light": (172, 134, 116), "base": (140, 104, 90), "shade": (100, 72, 64), "dark": (54, 38, 36)}
COPPER = {"light": (150, 214, 180), "base": (110, 176, 148), "shade": (70, 126, 108), "dark": (38, 74, 66)}
SLATE2 = {"light": (140, 148, 160), "base": (108, 116, 130), "shade": (76, 84, 98), "dark": (42, 46, 56)}
GLASSB = {"light": (190, 232, 232), "base": (126, 190, 200), "shade": (80, 132, 150), "dark": (38, 66, 82)}
GOLD = {"light": (255, 230, 150), "base": (230, 190, 90), "shade": (170, 128, 52), "dark": (104, 72, 28)}
TEAL = {"light": (132, 196, 190), "base": (84, 152, 150), "shade": (52, 106, 112), "dark": (30, 62, 70)}
RED = STRIPE_RED
WARM_LIGHT = (246, 206, 112)
WARM_CORE = (255, 246, 196)


class S2(Sprite):
    """Sprite with extra materials."""

    def tex(self, mat, ramp, face, u, v, salt=0):
        step = FACE_STEP[face]
        base = ramp[step]
        r = hsh(int(u), int(v), salt + self.seed)
        if mat == "brick":                       # coursed bricks, 3 rows tall, running bond
            row = int(v) // 3
            off = 4 if row % 2 else 0
            if int(v) % 3 == 0 or (int(u) + off) % 8 == 0:
                return ramp["dark"] if face != "top" else ramp["shade"]
            sh = hsh((int(u) + off) // 8, row, salt)
            return ramp["light" if face == "left" else "base"] if sh > 0.78 else ramp["shade"] if sh < 0.2 else base
        if mat == "tile":                         # roof tiles: scalloped rows
            row = int(v) // 4
            off = 3 if row % 2 else 0
            if int(v) % 4 == 0:
                return ramp["dark"]
            if (int(u) + off) % 6 == 0:
                return ramp["shade"]
            sh = hsh((int(u) + off) // 6, row, salt)
            return ramp["light"] if sh > 0.8 else base
        if mat == "thatch":                       # straw: short vertical ticks in staggered rows, ragged shade
            row = int(v) // 3
            off = 2 if row % 2 else 0
            if int(v) % 3 == 0:
                return ramp["shade"] if r > 0.35 else ramp["dark"]
            if (int(u) + off) % 4 == 0:
                return ramp["light"] if face != "right" else ramp["base"]
            return base if r > 0.12 else ramp["shade"]
        if mat == "daub":                         # plaster with a little speckle and a timber-frame feel left to the caller
            return ramp["shade"] if r < 0.05 else ramp["light"] if r > 0.94 else base
        if mat == "iron":                         # riveted plates: seams every 12 px, rivet dots
            if int(u) % 12 == 0 or int(v) % 10 == 0:
                return ramp["dark"]
            if int(u) % 12 == 2 and int(v) % 10 == 2:
                return ramp["light"]
            return base if r > 0.1 else ramp["shade"]
        if mat == "marble":                       # smooth ashlar, faint veins
            if int(v) % 9 == 0 and face != "top":
                return ramp["shade"]
            return ramp["shade"] if r < 0.04 else base
        if mat == "slate":                        # slate shingles: long rows, offset
            row = int(v) // 3
            off = 4 if row % 2 else 0
            if int(v) % 3 == 0:
                return ramp["dark"]
            if (int(u) + off) % 8 == 0:
                return ramp["shade"]
            return ramp["light"] if hsh((int(u) + off) // 8, row, salt) > 0.85 else base
        if mat == "glass":                        # panes: dark mullions, a bright streak
            if int(u) % 6 == 0 or int(v) % 6 == 0:
                return ramp["dark"]
            return ramp["light"] if (int(u) + int(v)) % 11 == 0 else base
        return super().tex(mat, ramp, face, u, v, salt)

    # ---- roofs ------------------------------------------------------------------------------------------------------------
    def hip(self, a0, b0, a1, b1, z0, rise, mat="tile", ramp=TILE, k=0.0, ridge="a", salt=0, end_ramp=None):
        """Hipped roof. ridge along a: the visible faces are the front slope (plane b = b1) and the right hip end. k = how far the ridge ends sit in from the eaves (0 = pyramid)."""
        P, z1 = self.P, z0 + rise
        er = end_ramp or ramp
        if ridge == "a":
            bm = (b0 + b1) / 2
            slope = [P(a0, b1, z0), P(a1, b1, z0), P(a1 - k, bm, z1), P(a0 + k, bm, z1)]
            end = [P(a1, b1, z0), P(a1, b0, z0), P(a1 - k, bm, z1)]
            self.face(slope, mat, ramp, "left", salt=salt, uv=lambda x, y: (x, y))
            self.face(end, mat, er, "right", salt=salt + 1, uv=lambda x, y: (x, y))
        else:
            am = (a0 + a1) / 2
            slope = [P(a1, b0, z0), P(a1, b1, z0), P(am, b1 - k, z1), P(am, b0 + k, z1)]
            end = [P(a0, b1, z0), P(a1, b1, z0), P(am, b1 - k, z1)]
            self.face(end, mat, er, "left", salt=salt + 1, uv=lambda x, y: (x, y))
            self.face(slope, mat, ramp, "right", salt=salt, uv=lambda x, y: (x, y))

    def gable(self, a0, b0, a1, b1, z0, rise, mat="tile", ramp=TILE, ridge="a", salt=0, end_mat="daub", end_ramp=DAUB, over=0.0):
        """Gable roof with a proper wall-material gable end (the base prism paints it as planks)."""
        P, z1 = self.P, z0 + rise
        a0, b0, a1, b1 = a0 - over, b0 - over, a1 + over, b1 + over
        if ridge == "a":
            bm = (b0 + b1) / 2
            front = [P(a0, b1, z0), P(a1, b1, z0), P(a1, bm, z1), P(a0, bm, z1)]
            end = [P(a1, b1, z0), P(a1, b0, z0), P(a1, bm, z1)]
            self.face(end, end_mat, end_ramp, "right", salt=salt + 2, uv=lambda x, y: (x, y))
            self.face(front, mat, ramp, "left", salt=salt, uv=lambda x, y: (x, y))
            # eave line + ridge cap
            self.line(P(a0, b1, z0), P(a1, b1, z0), ramp["dark"])
            self.line(P(a0, bm, z1), P(a1, bm, z1), ramp["light"])
        else:
            am = (a0 + a1) / 2
            front = [P(a1, b0, z0), P(a1, b1, z0), P(am, b1, z1), P(am, b0, z1)]
            end = [P(a0, b1, z0), P(a1, b1, z0), P(am, b1, z1)]
            self.face(end, end_mat, end_ramp, "left", salt=salt + 2, uv=lambda x, y: (x, y))
            self.face(front, mat, ramp, "right", salt=salt, uv=lambda x, y: (x, y))
            self.line(P(a1, b1, z0), P(a1, b0, z0), ramp["dark"])
            self.line(P(am, b1, z1), P(am, b0, z1), ramp["light"])

    def flat_roof(self, a0, b0, a1, b1, z, ramp=SLATE2, mat="slate", parapet=0, salt=0):
        P = self.P
        self.face([P(a0, b0, z), P(a1, b0, z), P(a1, b1, z), P(a0, b1, z)], mat, ramp, "top", salt=salt, uv=lambda x, y: (x, y))

    # ---- round things -----------------------------------------------------------------------------------------------------
    def _ellipse(self, ac, bc, rho):
        cx, cy0 = self.P(ac, bc, 0)
        return cx, cy0, rho * STEP_X * 1.414, rho * STEP_Y * 1.414

    def cyl(self, ac, bc, rho, z0, h, mat="stone", ramp=STONE, salt=0, top=True, top_ramp=None):
        cx, cy0, rx, ry = self._ellipse(ac, bc, rho)
        for x in range(int(cx - rx), int(cx + rx) + 1):
            t = (x + 0.5 - cx) / rx
            if abs(t) > 1:
                continue
            fy = ry * np.sqrt(1 - t * t)
            y_bot = int(round(cy0 - z0 + fy))
            y_top = int(round(cy0 - z0 - h + (fy if not top else -fy)))
            for y in range(y_top, y_bot + 1):
                face = "left" if t < -0.15 else "right" if t > 0.35 else "left"
                step = "light" if t < -0.5 else "base" if t < 0.25 else "shade"
                c = self.tex(mat, {"light": ramp["light"], "base": ramp["base"], "shade": ramp["shade"], "dark": ramp["dark"]}, "left" if step != "shade" else "right", x - (cx - rx), y - y_top + (x % 2), salt)
                if step == "light" and hsh(x, y, salt) > 0.5 and mat in ("stone", "brick", "marble"):
                    c = ramp["light"]
                self._px(x, y, c)
            if abs(t) > 0.97:
                for y in range(y_top, y_bot + 1):
                    self._px(x, y, ramp["dark"])
        if top:
            for x in range(int(cx - rx), int(cx + rx) + 1):
                t = (x + 0.5 - cx) / rx
                if abs(t) > 1:
                    continue
                fy = ry * np.sqrt(1 - t * t)
                for y in range(int(round(cy0 - z0 - h - fy)), int(round(cy0 - z0 - h + fy)) + 1):
                    self._px(x, y, (top_ramp or ramp)["light"] if (x + y) % 5 else (top_ramp or ramp)["base"])

    def cone(self, ac, bc, rho, z0, rise, mat="thatch", ramp=THATCH, salt=0, droop=0):
        cx, cy0, rx, ry = self._ellipse(ac, bc, rho)
        apex = cy0 - z0 - rise
        for x in range(int(cx - rx), int(cx + rx) + 1):
            t = (x + 0.5 - cx) / rx
            if abs(t) > 1:
                continue
            fy = ry * np.sqrt(1 - t * t)
            y_bot = int(round(cy0 - z0 + fy + droop * (1 - abs(t))))
            y_top = int(round(apex + abs(t) * (rise)))
            for y in range(y_top, y_bot + 1):
                step = "light" if t < -0.4 else "base" if t < 0.2 else "shade"
                c = self.tex(mat, ramp, "left" if step != "shade" else "right", x - (cx - rx), y - apex, salt)
                self._px(x, y, c)
            self._px(x, y_bot, ramp["dark"])
            if abs(t) > 0.97:
                self._px(x, y_top, ramp["dark"])

    def dome(self, ac, bc, rho, z0, rise, mat="marble", ramp=MARBLE, salt=0, ribs=0):
        cx, cy0, rx, ry = self._ellipse(ac, bc, rho)
        for x in range(int(cx - rx), int(cx + rx) + 1):
            t = (x + 0.5 - cx) / rx
            if abs(t) > 1:
                continue
            fy = ry * np.sqrt(1 - t * t)
            y_bot = int(round(cy0 - z0 + fy))
            y_top = int(round(cy0 - z0 - rise * np.sqrt(1 - t * t)))
            for y in range(y_top, y_bot + 1):
                step = "light" if t < -0.45 else "base" if t < 0.2 else "shade"
                c = ramp[step]
                if mat == "tile" or mat == "slate":
                    c = self.tex(mat, ramp, "left" if step != "shade" else "right", x - (cx - rx), y - y_top, salt)
                if ribs and int(round((t + 1) * ribs)) % 2 == 0 and abs(((t + 1) * ribs) % 1) < 0.18:
                    c = ramp["dark"] if step == "shade" else ramp["shade"]
                self._px(x, y, c)
            self._px(x, y_bot, ramp["dark"])
            self._px(x, y_top, ramp["dark"])

    # ---- openings, props ----------------------------------------------------------------------------------------------------
    def opening(self, plane, at, z, w, h, b1=1.0, a1=1.0, glass=True, lit=False, arch=False, frame=WOOD, door=False):
        """A window or door on a wall. plane 'L' (wall b = b1, `at` = a of the left edge, w along a) or 'R' (wall a = a1, `at` = b)."""
        P = self.P
        if plane == "L":
            pts = [P(at, b1, z + h), P(at + w, b1, z + h), P(at + w, b1, z), P(at, b1, z)]
        else:
            pts = [P(a1, at, z + h), P(a1, at + w, z + h), P(a1, at + w, z), P(a1, at, z)]
        inner = (WARM_LIGHT if lit else (GLASSB["shade"] if glass else TAR["base"])) if not door else TAR["base"]
        edge = frame["dark"]
        self.fill(pts, lambda x, y: inner, edge=edge)
        if lit:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            self._px(int(np.mean(xs)), int(np.mean(ys)), WARM_CORE)
        if glass and not lit and not door:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            self._px(int(min(xs)) + 1, int(min(ys)) + 1, GLASSB["light"])

    def sill_rows(self, plane, a_from, a_to, z, h, n, w, b1=1.0, a1=1.0, lit=False, every_lit=3):
        """n evenly spaced windows between a_from..a_to at height z."""
        if n <= 0:
            return
        step = (a_to - a_from) / n
        for i in range(n):
            at = a_from + step * i + (step - w) / 2
            self.opening(plane, at, z, w, h, b1=b1, a1=a1, lit=lit and i % every_lit == 0)

    def chimney(self, a, b, z0, h, w=0.14, ramp=FIELDSTONE, cap=True, mat="stone", pot=False):
        self.box(a, b, a + w, b + w, z0, h, mat, ramp, salt=int(a * 50))
        if cap:
            self.box(a - 0.015, b - 0.015, a + w + 0.015, b + w + 0.015, z0 + h, 3, "stone", ramp, salt=7)
        if pot:
            x, y = self.P(a + w / 2, b + w / 2, z0 + h + 3)
            self.rect(int(x) - 2, int(y) - 4, 4, 4, TAR["base"])

    def gear(self, cx, cy, r, ramp=BRASS, teeth=8, hub=True, spin=0.0):
        self.disc(cx, cy, r + 2, ramp["dark"])
        for k in range(teeth):
            ang = k * 2 * np.pi / teeth + spin
            x, y = cx + np.cos(ang) * (r + 2), cy + np.sin(ang) * (r + 2)
            self.rect(int(round(x)) - 1, int(round(y)) - 1, 2, 2, ramp["base"])
        self.disc(cx, cy, r, ramp["base"])
        self.disc(cx, cy, max(1, r - 2), ramp["light"])
        if hub:
            self.disc(cx, cy, max(1, r // 2 - 1), ramp["dark"])
        for k in range(4):
            ang = k * np.pi / 2 + spin
            self.line((cx, cy), (cx + np.cos(ang) * r, cy + np.sin(ang) * r), ramp["shade"])

    def lamp_post(self, a, b, h=24):
        self.post(a, b, 0, h, 3, IRON)
        x, y = self.P(a, b, h)
        self.rect(int(x) - 2, int(y) - 6, 5, 6, GOLD["dark"])
        self.rect(int(x) - 1, int(y) - 5, 3, 4, WARM_LIGHT)
        self.rect(int(x) - 3, int(y) - 7, 7, 1, IRON["dark"])

    def pennant(self, a, b, z, h, ramp=RED):
        """Static pennant on a pole (the animated flag is drawn by the game at the `pole` anchor)."""
        self.post(a, b, z, h, 2, WOOD, cap=False)
        x, y = self.P(a, b, z + h)
        for i in range(8):
            self.rect(int(x) + 1 + i, int(y) + i // 3, 1, 5 - i // 2, ramp["base"] if i % 2 else ramp["light"])
        return float(x), float(y)

    def stripe(self, plane, a_from, a_to, z, ramp, b1=1.0, a1=1.0):
        """a horizontal trim line along a wall"""
        P = self.P
        if plane == "L":
            self.line(P(a_from, b1, z), P(a_to, b1, z), ramp)
        else:
            self.line(P(a1, a_from, z), P(a1, a_to, z), ramp)
