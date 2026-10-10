import math, sys, numpy as np
from PIL import Image
sys.path.insert(0, '.')
from terrain import *
from pixlib import *

def hcell(i, j):
    h = ((i * 73856093) ^ (j * 19349663)) & 0xFFFFFFFF
    h = (h * 0x9e3779b1) & 0xFFFFFFFF
    h ^= h >> 15
    return (h & 0xFFFFFFFF) / 4294967296.0

def vnoise(x, y):
    xi, yi = math.floor(x), math.floor(y)
    fx, fy = x - xi, y - yi
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    v = lambda a, b: hcell(a + 1000, b + 1000)
    return (v(xi, yi) * (1 - sx) + v(xi + 1, yi) * sx) * (1 - sy) + (v(xi, yi + 1) * (1 - sx) + v(xi + 1, yi + 1) * sx) * sy

def nbw2(i, j, land):
    return any(((i + a, j + b) not in land) for a in range(-2, 3) for b in range(-2, 3))

def land_set(r):
    R0 = (r + 1) * 1.32 + 3.3
    S = int(R0 * 1.5) + 2
    land = set()
    for i in range(-S, S + 1):
        for j in range(-S, S + 1):
            m = max(abs(i), abs(j))
            if m <= r + 1:
                land.add((i, j)); continue
            th = math.atan2(j, i)
            d4 = (abs(i) ** 2.5 + abs(j) ** 2.5) ** 0.4
            rt = R0 * (1 + .07 * math.sin(2 * th + .7) + .05 * math.sin(3 * th + 2.1) + .03 * math.sin(5 * th + 4.0)) + 3.0 * (vnoise(i / 2.6, j / 2.6) - .5)
            if d4 <= rt: land.add((i, j))
    land.add((r + 2, -r + 1))
    core = lambda c: max(abs(c[0]), abs(c[1])) <= r + 1
    n4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for _ in range(3):
        rem = [c for c in land if not core(c) and sum(((c[0] + d[0], c[1] + d[1]) in land) for d in n4) <= 1]
        for c in rem: land.discard(c)
        add = []
        for i in range(-S, S + 1):
            for j in range(-S, S + 1):
                c = (i, j)
                if c in land: continue
                k = sum(((i + d[0], j + d[1]) in land) for d in n4)
                chan = ((i + 1, j) in land and (i - 1, j) in land) or ((i, j + 1) in land and (i, j - 1) in land)
                if k >= 3 or chan: add.append(c)
        land.update(add)
    return land

if __name__ == '__main__':
    r = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    land = land_set(r)
    frames, names, cells = all_shore_frames()
    print(len(frames), 'unique shore frames')
    S = max(max(abs(i), abs(j)) for i, j in land) + 3
    W = (2 * S + 1) * 96 + 200; H = (2 * S + 1) * 48 + 200
    cx, cy = W // 2, H // 2
    canvas = Image.new('RGBA', (W, H), (44, 128, 140, 255))
    sea = sea_tiles()[0]
    for y in range(0, H, 32):
        for x in range(0, W, 32): canvas.paste(Image.fromarray(sea), (x, y))
    tiles = {}
    def gt(k, v):
        if (k, v) not in tiles: tiles[(k, v)] = Image.fromarray(ground_tile(k, v))
        return tiles[(k, v)]
    shore = {k: Image.fromarray(v) for k, v in frames.items()}
    order = sorted(land, key=lambda c: (c[0] + c[1], c[0] - c[1]))
    for (i, j) in order:
        ccx = cx + (i - j) * 48; ccy = cy + (i + j) * 24   # cell centre
        m = max(abs(i), abs(j))
        nbw = sum(((i + a, j + b) not in land) for a in (-1,0,1) for b in (-1,0,1))
        kind = 'sand' if (m >= r + 2 and (nbw > 0 or (nbw2(i,j,land) and hcell(i,j) < .5))) else 'grass'
        v = int(hcell(i, j) * 3)
        canvas.alpha_composite(gt(kind, v), (ccx - GANCHOR[0], ccy + 24 - GANCHOR[1]))
    for (i, j) in order:
        ccx = cx + (i - j) * 48; ccy = cy + (i + j) * 24
        mask = 0
        for k, (di, dj) in enumerate(cells):
            if (i + di, j + dj) in land: mask |= 1 << k
        if mask in names:
            canvas.alpha_composite(shore[names[mask]], (ccx - SANCHOR[0], ccy - SANCHOR[1]))
    canvas.save('/workspace/btv3-tmp/proto_island.png')
    print(canvas.size, len(land))
