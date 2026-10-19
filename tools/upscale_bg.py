#!/usr/bin/env python3
"""Upscale staged 1280x720 chapter photos with Real-ESRGAN realesr-general-x4v3 on CPU (pure torch, compact arch inline).
src/bg_stage/chNN.jpg -> chNN_p.png (1080x1920 from a 405x720 crop) and chNN_w.png (1920x1080).
Setup: python3 -m venv esr/venv && pip install torch (cpu) numpy pillow; weights:
https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth (BSD-3-Clause).
Run: esr/venv/bin/python tools/upscale_bg.py [chapter numbers...]"""
import sys, os, torch, numpy as np, torch.nn as nn, torch.nn.functional as F
from PIL import Image
torch.set_num_threads(8)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); S = os.path.join(ROOT, 'src', 'bg_stage')
FX = {8: .38, 15: .6, 37: .75, 48: .42}  # keep in sync with tools/import_bg.py
W8 = os.environ.get('ESR_WEIGHTS', 'esr/x4v3.pth')
class SRVGGNetCompact(nn.Module):
    def __init__(s, nf=64, nc=32, up=4):
        super().__init__(); s.up = up; b = [nn.Conv2d(3, nf, 3, 1, 1), nn.PReLU(nf)]
        for _ in range(nc): b += [nn.Conv2d(nf, nf, 3, 1, 1), nn.PReLU(nf)]
        b += [nn.Conv2d(nf, 3 * up * up, 3, 1, 1)]; s.body = nn.ModuleList(b); s.ps = nn.PixelShuffle(up)
    def forward(s, x):
        o = x
        for m in s.body: o = m(o)
        return s.ps(o) + F.interpolate(x, scale_factor=s.up, mode='nearest')
model = SRVGGNetCompact(); sd = torch.load(W8, map_location='cpu'); model.load_state_dict(sd.get('params', sd)); model.eval()
def up(im):
    t = torch.from_numpy(np.asarray(im, dtype=np.float32) / 255).permute(2, 0, 1)[None]
    with torch.no_grad(): o = model(t)
    return Image.fromarray((o[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255 + .5).astype(np.uint8))
def tiled(im, T=360, P=16):
    W, H = im.size; out = Image.new('RGB', (W * 4, H * 4))
    for y in range(0, H, T):
        for x in range(0, W, T):
            b = (max(0, x - P), max(0, y - P), min(W, x + T + P), min(H, y + T + P)); u = up(im.crop(b))
            ox, oy = (x - b[0]) * 4, (y - b[1]) * 4; w, h = min(T, W - x) * 4, min(T, H - y) * 4
            out.paste(u.crop((ox, oy, ox + w, oy + h)), (x * 4, y * 4))
    return out
for n in [int(a) for a in sys.argv[1:]] or range(1, 51):
    im = Image.open(os.path.join(S, 'ch%02d.jpg' % n)).convert('RGB'); x = int((im.width - 405) * FX.get(n, .5))
    tiled(im.crop((x, 0, x + 405, 720))).resize((1080, 1920), Image.LANCZOS).save(os.path.join(S, 'ch%02d_p.png' % n))
    tiled(im.resize((640, 360), Image.LANCZOS)).resize((1920, 1080), Image.LANCZOS).save(os.path.join(S, 'ch%02d_w.png' % n))
    print('ok', n, flush=True)
