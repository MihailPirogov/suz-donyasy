#!/usr/bin/env python3
"""Contact sheet of all store screenshots -> shots/screenshots_sheet.jpg"""
import glob, os
from PIL import Image, ImageDraw, ImageFont
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
groups = [('Яндекс Игры — мобильные 1080×1920', sorted(glob.glob('release/yandex_assets/screenshot_mobile_*.png'))),
          ('Google Play / RuStore — телефон 1080×1920', sorted(glob.glob('release/play_assets/screenshots/phone_*.png'))),
          ('Яндекс Игры — десктоп 1920×1080', sorted(glob.glob('release/yandex_assets/screenshot_desktop_*.png')))]
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except Exception: F = f = ImageFont.load_default()
PH, DW, GAP = 400, 380, 14  # portrait thumb height, desktop thumb width
rows = []
for title, files in groups:
    thumbs = []
    for p in files:
        im = Image.open(p).convert('RGB'); w, h = im.size
        s = PH / h if h > w else DW / w
        thumbs.append((os.path.basename(p)[:-4].split('_')[-1], im.resize((round(w * s), round(h * s)), Image.LANCZOS)))
    rows.append((title, thumbs))
W = max(sum(t.width for _, t in th) + GAP * (len(th) + 1) for _, th in rows)
H = sum(40 + max(t.height for _, t in th) + 30 for _, th in rows) + GAP
sheet = Image.new('RGB', (W, H), (24, 32, 74)); d = ImageDraw.Draw(sheet); y = GAP
for title, th in rows:
    d.text((GAP, y), title, font=F, fill=(248, 201, 79)); y += 36; x = GAP; mh = max(t.height for _, t in th)
    for name, t in th:
        sheet.paste(t, (x, y)); d.text((x, y + t.height + 5), name, font=f, fill=(230, 230, 240)); x += t.width + GAP
    y += mh + 30
os.makedirs('shots', exist_ok=True); sheet.save('shots/screenshots_sheet.jpg', quality=86)
print('shots/screenshots_sheet.jpg', sheet.size)
