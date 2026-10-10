"""Town (Gears & Gilt: brick, terracotta tile, marble, brass) and City (Brass & Steam: sooted brick, iron, glass, copper).
One composer builds the wide buildings from a per-type ladder (floors, roof, wings, landmarks); the round and special types have their own builders."""
import numpy as np
from b2 import *
from vil import hg, hourglass_at, door, crate, gear_on, SANDC

PLASTER = {"light": (244, 222, 176), "base": (228, 196, 140), "shade": (178, 146, 98), "dark": (106, 82, 54)}
PLASTER_C = {"light": (200, 196, 190), "base": (170, 164, 158), "shade": (126, 120, 116), "dark": (74, 70, 68)}
KITS = {
    "town": dict(wall=("brick", BRICK), trim=("marble", MARBLE), roof=("tile", TILE), roof2=("slate", SLATE2), acc=BRASS, glass=GLASSB, fh=15),
    "city": dict(wall=("brick", SOOT), trim=("marble", dict(MARBLE, light=(230, 228, 222), base=(196, 194, 190), shade=(146, 144, 142))), roof=("slate", SLATE2), roof2=("tile", COPPER), acc=BRASS, glass=GLASSB, fh=15),
}


def new(U, hmax, seed):
    return B2(U, hmax, seed)


def window_grid(sp, K, plane, a0, a1, wall_c, floors, fh, win_px=7, h_px=9, pitch=16, door_at=None, lit_every=4, z0=0, skip=None):
    """windows on one wall: plane 'L' (b = wall_c) along a, or 'R' (a = wall_c) along b."""
    cs = sp.bays(a0, a1, pitch)
    for f in range(floors):
        for i, c in enumerate(cs):
            if f == 0 and door_at is not None and i == door_at:
                continue
            if skip and (f, i) in skip:
                continue
            z = z0 + f * fh + (fh - h_px) / 2 + 1
            lit = (i + f) % 4 == 1
            if plane == "L":
                sp.opening("L", c - sp.wu(win_px) / 2, z, sp.wu(win_px), h_px, b1=wall_c, lit=lit, frame=K["trim"][1])
            else:
                sp.opening("R", c - sp.wu(win_px) / 2, z, sp.wu(win_px), h_px, a1=wall_c, lit=lit, frame=K["trim"][1])
    return cs


def trim_lines(sp, K, a0, b0, a1, b1, floors, fh, z0=0):
    P = sp.P
    ramp = K["trim"][1]
    for f in range(1, floors + 1):
        z = z0 + f * fh
        sp.line(P(a0, b1, z), P(a1, b1, z), ramp["light"]); sp.line(P(a1, b1, z), P(a1, b0, z), ramp["base"])
    sp.line(P(a0, b1, z0 + 1), P(a1, b1, z0 + 1), ramp["shade"]); sp.line(P(a1, b1, z0 + 1), P(a1, b0, z0 + 1), ramp["dark"])


def roof(sp, K, kind, a0, b0, a1, b1, z, rise, salt=0, mat=None, ramp=None, ridge="a", k=0.22):
    m, r = (mat, ramp) if mat else K["roof"]
    ov = 0.03
    a0, b0, a1, b1 = a0 - ov, b0 - ov, a1 + ov, b1 + ov
    if kind == "gable":
        sp.gable(a0, b0, a1, b1, z, rise, m, r, ridge=ridge, salt=salt, end_mat=K["wall"][0], end_ramp=K["wall"][1])
    elif kind == "hip":
        sp.hip(a0, b0, a1, b1, z, rise, m, r, k=k, ridge=ridge, salt=salt)
    elif kind == "mansard":
        # steep lower slope, shallow upper: a hip inside a hip
        inset = 0.12
        sp.hip(a0, b0, a1, b1, z, rise * 0.62, m, r, k=0.16, ridge=ridge, salt=salt)
        sp.hip(a0 + inset, b0 + inset * 0.8, a1 - inset, b1 - inset * 0.8, z + rise * 0.62 - 1, rise * 0.4, m, r, k=0.1, ridge=ridge, salt=salt + 3)
    elif kind == "flat":
        sp.box(a0, b0, a1, b1, z, 3, K["trim"][0], K["trim"][1], salt=salt)
    elif kind == "saw":      # sawtooth: three ridges along b, glazed faces toward +a
        n = 3
        da = (a1 - a0) / n
        for i in range(n):
            x0, x1 = a0 + da * i, a0 + da * (i + 1)
            front = [sp.P(x0, b1, z), sp.P(x1, b1, z), sp.P(x0, b1, z + rise)]
            sp.face(front, K["wall"][0], K["wall"][1], "left", salt=salt, uv=lambda x, y: (x, y))
            sl = [sp.P(x0, b0, z + rise), sp.P(x0, b1, z + rise), sp.P(x1, b1, z), sp.P(x1, b0, z)]
            sp.face(sl, m, r, "right", salt=salt + i, uv=lambda x, y: (x, y))
            gl = [sp.P(x0, b0, z), sp.P(x0, b1, z), sp.P(x0, b1, z + rise), sp.P(x0, b0, z + rise)]
            sp.face(gl, "glass", GLASSB, "right", salt=salt, uv=lambda x, y: (x, y))
    elif kind == "pyramid":
        sp.hip(a0, b0, a1, b1, z, rise, m, r, k=0.0, ridge=ridge, salt=salt)


def chimney_stack(sp, a, b, z, h, K, w=0.10, anc=None):
    sp.chimney(a, b, z, h, w, BRICK if K["wall"][1] is BRICK else SOOT, mat="brick", pot=True)


def cupola(sp, K, a, b, z, s=0.14, h=10, dome=True, ramp=None):
    ramp = ramp or K["trim"][1]
    sp.box(a - s, b - s, a + s, b + s, z, h, K["trim"][0], ramp, salt=5)
    sp.opening("L", a - s * 0.5, z + 2, s, h - 4, b1=b + s, lit=True)
    if dome:
        sp.dome(a, b, s * 1.15, z + h, 9, "tile", K["roof2"][1] if K is KITS["city"] else K["roof"][1], salt=3) if False else sp.dome(a, b, s * 1.2, z + h, 10, "marble", COPPER if K is KITS["city"] else TILE, salt=3, ribs=0)


def turret(sp, K, a, b, z, r=0.10, h=26):
    sp.cyl(a, b, r, z, h, K["wall"][0], K["wall"][1], salt=11, top=False)
    sp.cone(a, b, r * 1.35, z + h, 16, K["roof"][0], K["roof"][1], salt=12, droop=1)


# ------------------------------------------------------------------------------------------------ ladders
# per type: (floors, roof kind, rise) for stage 0..6; wings/turrets/dormers follow the stage (see hall()).
LADDER = {
    "cottage":  [(1, "gable", 12), (1, "gable", 14), (2, "gable", 16), (2, "hip", 16), (2, "hip", 18), (3, "mansard", 22), (3, "mansard", 26)],
    "workshop": [(1, "gable", 10), (1, "gable", 12), (1, "saw", 10), (2, "saw", 10), (2, "saw", 12), (2, "saw", 12), (3, "saw", 12)],
    "lantern":  [(1, "gable", 12), (1, "hip", 14), (1, "gable", 16), (2, "hip", 16), (2, "hip", 18), (2, "mansard", 20), (2, "mansard", 24)],
    "trade":    [(1, "gable", 10), (1, "gable", 12), (2, "gable", 14), (2, "gable", 14), (2, "hip", 16), (2, "hip", 18), (3, "hip", 20)],
    "academy":  [(1, "gable", 14), (2, "gable", 14), (2, "hip", 16), (2, "hip", 16), (2, "hip", 18), (3, "hip", 18), (3, "mansard", 22)],
    "hospital": [(1, "gable", 12), (2, "gable", 12), (2, "gable", 14), (2, "hip", 14), (3, "hip", 16), (3, "hip", 16), (3, "mansard", 20)],
    "exchange": [(2, "flat", 0), (2, "hip", 14), (2, "gable", 18), (3, "hip", 18), (3, "mansard", 20), (3, "mansard", 22), (4, "mansard", 24)],
    "harbour":  [(1, "gable", 10), (1, "gable", 12), (2, "gable", 14), (2, "saw", 10), (2, "hip", 14), (3, "hip", 16), (3, "saw", 12)],
}


def hall(era, typ, st, U=1):
    K = KITS[era]
    fl, rk, rise = LADDER[typ][min(st, 6)]
    if era == "city" and st >= 4:
        fl += 1
    fh = K["fh"]
    hmax = 78 + fl * fh * (1 if U == 1 else 1.3) + rise + 40 + (U - 1) * 30
    sp = new(U, int(hmax), 300 + st * 7 + (hash(typ) % 50))
    P = sp.P
    anc = {}
    H = fl * fh + 3
    a0, a1 = (0.20, 0.80) if st == 0 else (0.10, 0.90) if st == 1 else (0.05, 0.95)
    wing = U >= 2 and st >= 4
    b0, b1 = (0.46, 0.80) if wing else (0.28, 0.76)
    wm, wr = K["wall"]
    pick = (st + len(typ)) % 3
    if era == "town" and pick == 0:
        wm, wr = "daub", PLASTER
    elif era == "city" and pick == 0:
        wm, wr = "daub", PLASTER_C
    if typ in ("hospital", "academy", "exchange") and era == "town":
        wm, wr = ("marble", MARBLE)
    Kw = dict(K, wall=(wm, wr))
    # the back wing first (it sits behind)
    if wing:
        wa1, wb0 = 0.36, 0.08
        sp.box(a0, wb0, wa1, b1, 0, H, wm, wr, salt=40)
        window_grid(sp, K, "L", a0, wa1, b0 if False else b1, fl, fh, pitch=15, door_at=None)
        roof(sp, Kw, "gable" if rk != "saw" else "gable", a0, wb0, wa1, b1, H, rise, salt=41, ridge="b")
    sp.box(a0, b0, a1, b1, 0, H, wm, wr, salt=42)
    trim_lines(sp, K, a0, b0, a1, b1, fl, fh)
    if st >= 2:      # quoins: stone corners up the front corner and the left end
        for aa, bb in ((a0, b1), (a1, b1), (a1, b0)):
            sp.line(P(aa, bb, 0), P(aa, bb, H), K["trim"][1]["light"], 2)
    cs = window_grid(sp, K, "L", (0.40 if wing else a0), a1, b1, fl, fh, door_at=None, pitch=15 if U > 1 else 16)
    # door on the centre-ish bay of the left wall
    di = len(cs) // 2
    dc = cs[di]
    sp.opening("L", dc - sp.wu(4.5), 0, sp.wu(9), 12, b1=b1, door=True, frame=WOOD)
    sp.line(P(dc - sp.wu(5.5), b1, 13), P(dc + sp.wu(5.5), b1, 13), K["trim"][1]["light"])
    sp.opening("L", dc - sp.wu(4.5), 0, sp.wu(9), 12, b1=b1, door=True, frame=WOOD) if False else None
    # (windows were drawn over the door bay; redraw it on top)
    cr = sp.bays(b0, b1, 16)
    for f in range(fl):
        for i, c in enumerate(cr):
            sp.opening("R", c - sp.wu(3.5), f * fh + (fh - 9) / 2 + 1, sp.wu(7), 9, a1=a1, lit=(i + f) % 4 == 1, frame=K["trim"][1])
    roof(sp, Kw, rk, a0 if not wing else a0, b0, a1, b1, H, rise, salt=43, ridge="a")
    geom = dict(a0=a0, a1=a1, b0=b0, b1=b1, H=H, fl=fl, fh=fh, rise=rise, wing=wing, dc=dc, cs=cs)
    SIG[typ](sp, K, era, st, U, geom, anc)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc


def stacks(sp, K, era, st, geom, anc, n=1):
    H, rise = geom["H"], geom["rise"]
    for i in range(n):
        a = 0.62 - 0.30 * i
        sp.chimney(a, geom["b0"] + 0.06, H + rise * 0.3, 14 + 3 * st // 2, 0.10, BRICK if era == "town" else SOOT, mat="brick", pot=True)
    anc["chimney"] = P_(sp, 0.62 + 0.05, geom["b0"] + 0.11, H + rise * 0.3 + 14 + 3 * st // 2 + 4)


def P_(sp, a, b, z):
    x, y = sp.P(a, b, z)
    return (float(x), float(y))


def dormers(sp, K, geom, n):
    if n <= 0:
        return
    H, rise, b1 = geom["H"], geom["rise"], geom["b1"]
    for i in range(n):
        c = geom["a0"] + (geom["a1"] - geom["a0"]) * (i + 1) / (n + 1)
        wdt = sp.wu(11)
        sp.box(c - wdt / 2, b1 - 0.14, c + wdt / 2, b1 - 0.08, H + 2, 9, K["wall"][0], K["wall"][1], salt=60 + i)
        sp.opening("L", c - sp.wu(3), H + 4, sp.wu(6), 5, b1=b1 - 0.08, lit=i % 2 == 0)
        sp.gable(c - wdt / 2 - 0.01, b1 - 0.16, c + wdt / 2 + 0.01, b1 - 0.06, H + 11, 6, K["roof"][0], K["roof"][1], ridge="b" if False else "a", salt=61, end_mat=K["wall"][0], end_ramp=K["wall"][1])


def sig_cottage(sp, K, era, st, U, g, anc):
    stacks(sp, K, era, st, g, anc, 1 + (st >= 3) + (st >= 5))
    dormers(sp, K, g, max(0, min(3, st - 1)))
    if st >= 3:   # balcony rail in marble above the door
        P = sp.P
        dc = g["dc"]
        sp.line(P(dc - sp.wu(10), g["b1"] + 0.03, g["fh"] + 3), P(dc + sp.wu(10), g["b1"] + 0.03, g["fh"] + 3), K["trim"][1]["light"], 1)
    if st >= 5:
        turret(sp, K, g["a1"] - 0.08, g["b0"] + 0.1, g["H"] - 4, 0.09, 24 if U > 1 else 18)


def sig_workshop(sp, K, era, st, U, g, anc):
    P = sp.P
    # tall smokestack at the back-right
    h = 26 + 7 * st
    sp.chimney(0.76, g["b0"] - 0.0, g["H"] * 0.3, g["H"] * 0.7 + h, 0.09 if st < 3 else 0.11, BRICK if era == "town" else SOOT, mat="brick", pot=True)
    anc["chimney"] = P_(sp, 0.76 + 0.045, g["b0"] + 0.045, g["H"] * 0.3 + g["H"] * 0.7 + h + 4)
    # gear wheel on the right wall; a second, interlocking one from stage 3, a clock-size wheel on big claims
    r = 7 + st // 2 + (3 if U > 1 else 0)
    x, y = P(g["a1"], (g["b0"] + g["b1"]) / 2, g["H"] * 0.55)
    sp.gear(int(x), int(y), r, K["acc"], teeth=8 + st)
    if st >= 3:
        sp.gear(int(x) + r + 2, int(y) - r - 1, max(4, r // 2 + 1), BRASS, teeth=6, spin=0.4)
    if st >= 4:      # belt line up to the roof
        sp.line((x, y - r), (x, y - r - 8), IRON["base"], 2)
    # wide door
    P = sp.P
    sp.opening("L", g["dc"] - sp.wu(7), 0, sp.wu(14), 14, b1=g["b1"], door=True, frame=IRON if era == "city" else WOOD)


def sig_lantern(sp, K, era, st, U, g, anc):
    P = sp.P
    n = len(g["cs"]) * (1 if st < 3 else 2)
    for i in range(n):
        a = g["a0"] + (g["a1"] - g["a0"]) * (i + 0.5) / n
        x, y = P(a, g["b1"] + 0.025, g["H"] - 2)
        sp.line((x, y), (x, y + 3), BRASS["dark"])
        sp.rect(int(x) - 2, int(y) + 3, 4, 5, BRASS["dark"]); sp.rect(int(x) - 1, int(y) + 4, 2, 3, WARM_LIGHT)
    # arcade pilasters on the ground floor
    for a in np.linspace(g["a0"], g["a1"], len(g["cs"]) + 1):
        sp.line(P(a, g["b1"], 1), P(a, g["b1"], g["fh"] - 1), K["trim"][1]["light"])
    if st >= 3:
        cupola(sp, K, 0.5, (g["b0"] + g["b1"]) / 2, g["H"] + g["rise"] - 4, 0.10, 9, dome=True)
    sp.post(0.9, g["b0"] + 0.05, g["H"], 26, 2, IRON if era == "city" else WOOD, cap=False)
    x, y = P(0.9, g["b0"] + 0.05, g["H"] + 26)
    for i in range(10): sp.rect(int(x) + 1 + i, int(y) + i // 3, 1, 8 - i // 2, STRIPE_RED["base"] if i % 3 else STRIPE_RED["light"])
    anc["pole"] = (float(x), float(y))
    stacks(sp, K, era, st, g, anc, 1) if era == "city" or st >= 4 else None


def sig_trade(sp, K, era, st, U, g, anc):
    P = sp.P
    # striped awnings over the shopfront
    n = 1 + (st >= 2) + (st >= 4) * 2
    wdt = (g["a1"] - g["a0"]) / (n + 0.5)
    for i in range(n):
        a = g["a0"] + wdt * (i + 0.25)
        z = g["fh"] - 3
        sp.fill([P(a, g["b1"] + 0.10, z - 3), P(a + wdt * 0.9, g["b1"] + 0.10, z - 3), P(a + wdt * 0.9, g["b1"], z + 2), P(a, g["b1"], z + 2)],
                lambda x, y, i=i: STRIPE_RED["light"] if (int(x) // 4 + i) % 2 else CANVAS["light"], edge=STRIPE_RED["dark"])
    for i in range(min(4, 1 + st)):
        crate(sp, g["a0"] + 0.04 + 0.2 * i, g["b1"] + 0.02, 0, 0.10, 7, 20 + i)
    if st >= 2 or era == "city":      # crane / hoist arm on the gable end, rope and hook
        x, y = P(g["a1"], (g["b0"] + g["b1"]) / 2, g["H"] + 4)
        sp.line((x, y), (x + 8, y - 6), WOOD["dark"] if era == "town" else IRON["dark"], 2); sp.line((x + 8, y - 6), (x + 8, y + 5), ROPE["base"])
    sp.post(0.12, g["b0"] + 0.06, g["H"], 24, 2, WOOD, cap=False)
    x, y = P(0.12, g["b0"] + 0.06, g["H"] + 24)
    for i in range(9): sp.rect(int(x) + 1 + i, int(y) + 1 + i // 4, 1, 10 - i // 2, CANVAS["light"] if i % 3 else CANVAS["base"])
    anc["pole"] = (float(x), float(y))
    stacks(sp, K, era, st, g, anc, 1) if st >= 3 else None


def portico(sp, K, g, n=4, h=None, pediment=True, ramp=None):
    P = sp.P
    ramp = ramp or MARBLE
    h = h or g["fh"] + 2
    b = g["b1"] + 0.10
    c0, c1 = 0.5 - 0.30, 0.5 + 0.30
    sp.box(c0 - 0.03, g["b1"], c1 + 0.03, b + 0.03, 0, 3, "marble", ramp, salt=70)           # steps / stylobate
    for i in range(n):
        a = c0 + (c1 - c0) * i / (n - 1)
        sp.cyl(a, b, 0.018, 3, h, "marble", ramp, salt=71, top=False)
    sp.box(c0 - 0.03, g["b1"] - 0.02, c1 + 0.03, b + 0.03, 3 + h, 3, "marble", ramp, salt=72)  # entablature
    if pediment:
        z = 6 + h
        tri = [P(c0 - 0.03, b + 0.03, z), P(c1 + 0.03, b + 0.03, z), P(0.5, b + 0.03, z + 9)]
        sp.fill(tri, lambda x, y: ramp["base"], edge=ramp["dark"])


def sig_academy(sp, K, era, st, U, g, anc):
    portico(sp, K, g, 4 if st < 4 else 6, ramp=MARBLE if era == "town" else dict(MARBLE, base=(200, 200, 198)))
    stacks(sp, K, era, st, g, anc, 1) if st >= 3 else None
    if st >= 2:
        cupola(sp, K, 0.5, (g["b0"] + g["b1"]) / 2 - 0.02, g["H"] + g["rise"] - 2, 0.11 + 0.02 * (st >= 4), 12 + 4 * (st >= 4), dome=True)
    if era == "city" and st >= 4:      # a clock face on the front gable
        x, y = sp.P(0.82, g["b1"], g["H"] + 6)
        sp.disc(int(x), int(y), 5, IRON["dark"]); sp.disc(int(x), int(y), 4, MARBLE["light"])
        sp.line((x, y), (x, y - 3), IRON["dark"]); sp.line((x, y), (x + 2, y), IRON["dark"])


def sig_hospital(sp, K, era, st, U, g, anc):
    P = sp.P
    # red cross panel on the front gable / roof face
    cx, cy = P(0.74, g["b1"], g["H"] * 0.62)
    cx, cy = int(cx), int(cy)
    sp.rect(cx - 6, cy - 6, 12, 12, MARBLE["light"]); sp.rect(cx - 6, cy - 6, 12, 1, MARBLE["dark"]); sp.rect(cx - 6, cy + 5, 12, 1, MARBLE["dark"])
    sp.rect(cx - 6, cy - 6, 1, 12, MARBLE["dark"]); sp.rect(cx + 5, cy - 6, 1, 12, MARBLE["dark"])
    sp.rect(cx - 1, cy - 4, 3, 8, (204, 62, 52)); sp.rect(cx - 4, cy - 1, 9, 3, (204, 62, 52))
    # entrance canopy
    dc = g["dc"]
    sp.fill([P(dc - sp.wu(10), g["b1"] + 0.08, 15), P(dc + sp.wu(10), g["b1"] + 0.08, 15), P(dc + sp.wu(10), g["b1"], 17), P(dc - sp.wu(10), g["b1"], 17)], lambda x, y: MARBLE["light"], edge=MARBLE["dark"])
    for s in (-1, 1): sp.post(dc + s * sp.wu(10), g["b1"] + 0.08, 0, 15, 2, MARBLE, cap=False)
    if st >= 2:
        sp.box(0.50, g["b0"] + 0.04, 0.62, g["b0"] + 0.16, g["H"] + g["rise"] * 0.4, 8, "marble", MARBLE, salt=3)
    if era == "city" and st >= 4:       # glass atrium on the ridge
        sp.box(0.18, g["b0"] + 0.04, 0.46, g["b1"] - 0.10, g["H"] + g["rise"] * 0.3, 8, "glass", GLASSB, salt=9)
        sp.hip(0.16, g["b0"] + 0.02, 0.48, g["b1"] - 0.08, g["H"] + g["rise"] * 0.3 + 8, 7, "glass", GLASSB, k=0.1)
    stacks(sp, K, era, st, g, anc, 1)


def sig_exchange(sp, K, era, st, U, g, anc):
    portico(sp, K, g, 6, h=g["fh"] * 2 - 2, ramp=dict(MARBLE, base=(214, 210, 200)))
    P = sp.P
    # the gold bull/pillar sign on the pediment and a flag
    x, y = P(0.5, g["b1"] + 0.13, g["fh"] * 2 + 12)
    sp.disc(int(x), int(y) - 1, 3, GOLD["base"]); sp.disc(int(x), int(y) - 1, 1, GOLD["light"])
    if st >= 3:
        cupola(sp, K, 0.5, (g["b0"] + g["b1"]) / 2, g["H"] + g["rise"] - 3, 0.12, 12, dome=True)
    sp.post(0.9, g["b0"] + 0.04, g["H"], 26, 2, IRON, cap=False)
    x, y = P(0.9, g["b0"] + 0.04, g["H"] + 26)
    for i in range(10): sp.rect(int(x) + 1 + i, int(y) + i // 3, 1, 8 - i // 2, GOLD["base"] if i % 3 else GOLD["light"])
    anc["pole"] = (float(x), float(y))
    stacks(sp, K, era, st, g, anc, 1)


def sig_harbour(sp, K, era, st, U, g, anc):
    P = sp.P
    # a plank pier flush in front of the hall, bollards, a crane and a mast with a furled sail
    fl = [P(0.0, g["b1"] + 0.04, 0), P(1.0, g["b1"] + 0.04, 0), P(1.0, 1.06, 0), P(0.0, 1.06, 0)]
    sp.fill(fl, lambda x, y: PLANK["base"] if (int(x) // 5 + int(y) // 2) % 2 else PLANK["shade"], edge=PLANK["dark"])
    for a in (0.12, 0.88):
        sp.post(a, 1.0, 0, 5, 3, TAR, cap=True)
    cx, cy = P(0.86, g["b0"] + 0.02, g["H"])
    sp.line((cx, cy), (cx, cy - 22 - 3 * st), IRON["base"] if era == "city" else WOOD["base"], 3)
    sp.line((cx, cy - 22 - 3 * st), (cx - 20, cy - 16 - 3 * st), IRON["base"] if era == "city" else WOOD["base"], 2)
    sp.line((cx - 20, cy - 16 - 3 * st), (cx - 20, cy - 4), ROPE["base"])
    sp.rect(int(cx) - 22, int(cy) - 4, 5, 4, TAR["base"])
    # mast with a sail beyond the pier
    mx, my = P(0.2, 1.02, 3)
    sp.line((mx, my), (mx, my - 40 - 4 * st), WOOD["base"], 2)
    for k in range(18):
        sp.rect(int(mx) + 1, int(my) - 38 - 4 * st + k, 10 - k // 3, 1, CANVAS["light"] if k % 4 else CANVAS["base"])
    anc["pole"] = (float(mx), float(my) - 40 - 4 * st)
    stacks(sp, K, era, st, g, anc, 1) if st >= 3 else None


SIG = {"cottage": sig_cottage, "workshop": sig_workshop, "lantern": sig_lantern, "trade": sig_trade, "academy": sig_academy, "hospital": sig_hospital, "exchange": sig_exchange, "harbour": sig_harbour}


# ------------------------------------------------------------------------------------------------ specials
def bank_ladder():
    LADDER["bank"] = [(1, "hip", 8), (1, "hip", 10), (2, "hip", 10), (2, "hip", 12), (2, "hip", 12), (3, "hip", 14), (3, "hip", 14)]


bank_ladder()


def sig_bank(sp, K, era, st, U, g, anc):
    P = sp.P
    portico(sp, K, g, 4 if st < 4 else 6, ramp=MARBLE)
    drum_r = 0.14 + 0.02 * (st >= 3) + 0.03 * (U > 1)
    zc = g["H"] + g["rise"] * 0.6
    sp.cyl(0.5, (g["b0"] + g["b1"]) / 2, drum_r, zc, 8 + 2 * (st >= 2), "marble", MARBLE, salt=3, top=False)
    dome = COPPER if era == "city" else dict(TEAL)
    sp.dome(0.5, (g["b0"] + g["b1"]) / 2, drum_r * 1.1, zc + 8 + 2 * (st >= 2), 12 + 3 * (st >= 3) + 4 * (U > 1), "marble", dome, salt=4, ribs=6)
    # the golden hourglass sign above the door (the bank's tell)
    x, y = P(0.5, g["b1"] + 0.13, g["fh"] + 10)
    hg(sp, int(x), int(y), 12, 7)
    top = P(0.5, (g["b0"] + g["b1"]) / 2, zc + 8 + 2 * (st >= 2) + 12 + 3 * (st >= 3) + 4 * (U > 1))
    sp.post(0.5, (g["b0"] + g["b1"]) / 2, zc + 8 + 2 * (st >= 2) + 12 + 3 * (st >= 3) + 4 * (U > 1) - 3, 8, 2, GOLD, cap=False)
    anc["pole"] = (float(top[0]), float(top[1]) - 8)
    stacks(sp, K, era, st, g, anc, 1) if st >= 4 else None


SIG["bank"] = sig_bank


def tower(era, st, U=1):
    K = KITS[era]
    wm, wr = K["wall"]
    city = era == "city"
    H0 = 44 + st * 9 + (8 if city else 0)
    sp = new(U, int(H0 + 90 + (U - 1) * 40), 500 + st)
    P = sp.P
    anc = {}
    big = U >= 2
    if big:       # the attached hall behind/left of the tower
        sp.box(0.06, 0.30, 0.52, 0.80, 0, 22 + st * 2, wm, wr, salt=3)
        window_grid(sp, K, "L", 0.06, 0.52, 0.80, 1, 22 + st * 2, pitch=14)
        roof(sp, K, "gable", 0.06, 0.30, 0.52, 0.80, 22 + st * 2, 14, salt=4, ridge="a")
    a0, a1, b0, b1 = (0.52, 0.92, 0.30, 0.74) if big else (0.28, 0.72, 0.28, 0.72)
    sp.box(a0, b0, a1, b1, 0, H0, wm, wr, salt=5)
    P = sp.P
    # stone bands, arrow slits, door
    for z in range(14, int(H0) - 10, 18):
        sp.line(P(a0, b1, z), P(a1, b1, z), K["trim"][1]["light"]); sp.line(P(a1, b1, z), P(a1, b0, z), K["trim"][1]["base"])
    for z in range(22, int(H0) - 14, 18):
        for pl in ("L", "R"):
            c = (a0 + a1) / 2 if pl == "L" else (b0 + b1) / 2
            if pl == "L": sp.opening("L", c - sp.wu(2), z, sp.wu(4), 8, b1=b1, frame=K["trim"][1])
            else: sp.opening("R", c - sp.wu(2), z, sp.wu(4), 8, a1=a1, frame=K["trim"][1])
    sp.opening("L", (a0 + a1) / 2 - sp.wu(5), 0, sp.wu(10), 13, b1=b1, door=True, frame=K["trim"][1])
    for aa, bb in ((a0, b1), (a1, b1), (a1, b0)):
        sp.line(P(aa, bb, 0), P(aa, bb, H0), K["trim"][1]["light"], 2)
    # clock faces from stage 2 (town) / 1 (city)
    if st >= (1 if city else 2):
        for pl in ("L", "R"):
            x, y = P((a0 + a1) / 2, b1, H0 - 14) if pl == "L" else P(a1, (b0 + b1) / 2, H0 - 14)
            sp.disc(int(x), int(y), 6, IRON["dark"]); sp.disc(int(x), int(y), 5, MARBLE["light"])
            sp.line((x, y), (x, y - 4), IRON["dark"]); sp.line((x, y), (x + 3 if pl == "L" else x - 3, y), IRON["dark"])
    # belfry: an open arcade section above the shaft from stage 3
    z = H0
    if st >= 3:
        sp.box(a0 + 0.03, b0 + 0.03, a1 - 0.03, b1 - 0.03, z, 16, "marble", MARBLE, salt=6)
        for pl in ("L", "R"):
            for k in (-1, 1):
                if pl == "L": sp.opening("L", (a0 + a1) / 2 + k * sp.wu(7) - sp.wu(3), z + 3, sp.wu(6), 10, b1=b1 - 0.03, frame=MARBLE)
                else: sp.opening("R", (b0 + b1) / 2 + k * sp.wu(7) - sp.wu(3), z + 3, sp.wu(6), 10, a1=a1 - 0.03, frame=MARBLE)
        bx, by = P((a0 + a1) / 2, b1 - 0.03, z + 5)
        sp.disc(int(bx), int(by) + 2, 2, BRASS["base"])
        z += 16
    # cap
    ctr = ((a0 + a1) / 2, (b0 + b1) / 2)
    if st < 2:
        sp.box(a0 - 0.03, b0 - 0.03, a1 + 0.03, b1 + 0.03, z, 4, "stone", STONE, salt=7)         # parapet, flat
        for k in range(4):
            sp.box(a0 - 0.03 + 0.14 * k, b1 - 0.03, a0 + 0.04 + 0.14 * k, b1 + 0.03, z + 4, 4, "stone", STONE, salt=8)
        anc["pole"] = P(ctr[0], ctr[1], z + 22); sp.post(ctr[0], ctr[1], z + 4, 18, 2, IRON if city else WOOD, cap=False)
        top = z + 22
    else:
        rise = 26 + 3 * st
        roof(sp, K, "hip", a0 + (0.03 if st >= 3 else 0), b0 + (0.03 if st >= 3 else 0), a1 - (0.03 if st >= 3 else 0), b1 - (0.03 if st >= 3 else 0), z, rise, salt=9, mat=K["roof2"][0] if city else None, ramp=K["roof2"][1] if city else None, k=0.0)
        sp.post(ctr[0], ctr[1], z + rise - 2, 12, 2, GOLD, cap=True)
        anc["pole"] = P(ctr[0], ctr[1], z + rise + 10)
        top = z + rise + 10
    if city and st >= 4:       # a big gear on the face of the tower
        x, y = P((a0 + a1) / 2, b1, H0 * 0.45)
        sp.gear(int(x), int(y), 7, BRASS, teeth=10)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc


def dish(sp, cx, cy, r, ramp=BRASS, tilt=0.92):
    """a sun-mirror dish: tilted ellipse, bright inner bowl, rim, a spoke pattern of rays"""
    ry = max(3, int(r * tilt))
    yy, xx = np.mgrid[0:sp.h, 0:sp.w]
    m = ((xx - cx) / r) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    inner = ((xx - cx) / (r - 2)) ** 2 + ((yy - cy) / max(1, ry - 2)) ** 2 <= 1.0
    sp.a[m] = (*ramp["dark"], 255)
    sp.a[inner] = (*ramp["base"], 255)
    for k in range(6):
        ang = k * np.pi / 3
        sp.line((cx, cy), (cx + np.cos(ang) * (r - 2), cy + np.sin(ang) * (ry - 2)), ramp["light"])
    sp.disc(cx, cy, 2, (255, 244, 200))
    for i in range(4):
        sp._px(int(cx - r * 0.5 + i), int(cy - ry * 0.4 + i // 2), (255, 255, 230))


def mirror(era, st, U=1):
    K = KITS[era]
    city = era == "city"
    sp = new(U, 110 + (U - 1) * 40, 600 + st)
    P = sp.P
    anc = {}
    wm, wr = K["wall"]
    n = [1, 1, 1, 2, 3, 5, 5][st]
    base_h = [14, 20, 28, 28, 24, 24, 26][st]
    plat = (0.10, 0.10, 0.90, 0.90) if U > 1 else (0.2, 0.2, 0.8, 0.8)
    sp.box(*plat[:2], plat[2], plat[3], 0, base_h, wm, wr, salt=2)
    trim_lines(sp, K, plat[0], plat[1], plat[2], plat[3], 1, base_h)
    for aa, bb in ((plat[0], plat[3]), (plat[2], plat[3]), (plat[2], plat[1])):
        sp.line(P(aa, bb, 0), P(aa, bb, base_h), K["trim"][1]["light"], 2)
    sp.opening("L", 0.5 - sp.wu(4), 0, sp.wu(8), min(11, base_h - 2), b1=plat[3], door=True, frame=K["trim"][1]) if base_h >= 12 else None
    pos = {1: [(0.5, 0.5)], 2: [(0.38, 0.5), (0.64, 0.5)], 3: [(0.36, 0.5), (0.62, 0.5), (0.5, 0.30)], 5: [(0.28, 0.5), (0.5, 0.5), (0.72, 0.5), (0.39, 0.30), (0.61, 0.30)]}[n]
    r0 = [13, 16, 20, 15, 14, 13, 15][st] * (1.0 + 0.2 * (U - 1))
    order = sorted(pos, key=lambda p: p[0] + p[1])
    for (a, b) in order:
        x, y = P(a, b, base_h)
        mast = 14 + (6 if st >= 2 else 0)
        sp.line((x, y), (x, y - mast), IRON["base"] if city else WOOD["base"], 2)
        dish(sp, int(x), int(y - mast - r0 * 0.4), int(r0), BRASS if not city else dict(COPPER, light=(190, 232, 210)))
        if st >= 3 and city:
            sp.line((x, y - mast + 4), (x + 4, y - mast + 10), IRON["dark"])
    top = P(0.5, 0.5, base_h + 10 + r0 * 2)
    anc["pole"] = (float(top[0]), float(top[1]) - 6)
    if city:
        sp.chimney(0.82, 0.22, base_h, 18, 0.09, IRON, mat="iron", pot=True)
        anc["chimney"] = P(0.865, 0.265, base_h + 22)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc


def observatory(era, st, U=1):
    K = KITS[era]
    sp = new(U, 140 + (U - 1) * 50, 700 + st)
    P = sp.P
    anc = {}
    wm, wr = K["wall"]
    hh = 30 + 6 * st
    if U >= 2:
        sp.box(0.06, 0.44, 0.40, 0.88, 0, 22, wm, wr, salt=3)
        window_grid(sp, K, "L", 0.06, 0.40, 0.88, 1, 22, pitch=14)
        sp.hip(0.04, 0.42, 0.42, 0.90, 22, 12, "slate", SLATE2, k=0.1)
        cr, cb = 0.64, 0.50
    else:
        cr, cb = 0.5, 0.5
    rho = 0.27 if U == 1 else 0.20
    sp.cyl(cr, cb, rho, 0, hh, "brick", wr, salt=4, top=False)
    x, y = P(cr, cb + rho, 0)
    sp.rect(int(x) - 4, int(y) - 13, 8, 13, TAR["base"]); sp.rect(int(x) - 4, int(y) - 13, 8, 1, MARBLE["light"])
    for z in range(14, int(hh) - 6, 14):
        x, y = P(cr - 0.06, cb + rho * 0.97, z); sp.rect(int(x), int(y) - 3, 3, 6, GLASSB["shade"]); sp.rect(int(x), int(y) - 3, 1, 6, MARBLE["light"])
    sp.cyl(cr, cb, rho + 0.03, hh, 3, "marble", MARBLE, salt=5, top=False)
    domer = rho + 0.02
    dome = dict(COPPER) if era == "city" else dict(MARBLE)
    sp.dome(cr, cb, domer, hh + 3, 18 + 2 * st, "marble", dome, salt=6, ribs=8)
    # the slit and the telescope barrel poking out of it
    x, y = P(cr - 0.05, cb + domer * 0.8, hh + 14)
    sp.rect(int(x), int(y) - 9, 3, 12, TAR["base"])
    sp.line((x + 2, y - 4), (x + 15, y - 14), IRON["base"], 4); sp.line((x + 2, y - 5), (x + 15, y - 15), IRON["light"], 1)
    sp.disc(int(x + 15), int(y - 14), 2, GLASSB["light"])
    anc["pole"] = P(cr, cb, hh + 3 + 18 + 2 * st + 6)
    sp.post(cr, cb, hh + 3 + 18 + 2 * st - 2, 8, 2, GOLD, cap=True)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc
