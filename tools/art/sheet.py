import sys, numpy as np
from PIL import Image
def sheet(frames, path, cols=6, bg=(86, 128, 62), scale=2, pad=6):
    ims = []
    for a in frames:
        im = Image.fromarray(a, "RGBA")
        ims.append(im)
    cw = max(i.width for i in ims) + pad
    ch = max(i.height for i in ims) + pad
    rows = (len(ims) + cols - 1) // cols
    out = Image.new("RGBA", (cw * cols, ch * rows), (*bg, 255))
    for k, im in enumerate(ims):
        out.alpha_composite(im, ((k % cols) * cw + pad // 2, (k // cols) * ch + (ch - im.height) - pad // 2))
    out = out.resize((out.width * scale, out.height * scale), Image.NEAREST)
    out.save(path)
