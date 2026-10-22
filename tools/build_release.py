#!/usr/bin/env python3
"""Release builds of Сүз дөньясы (no test hooks, no test badge, no noindex).
  python3 tools/build_release.py yandex   -> release/build/yandex/ + release/suz-donyasy-yandex.zip
  python3 tools/build_release.py android  -> android/app/src/main/assets/www/
"""
import os, re, sys, shutil, subprocess, time, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
target = sys.argv[1]
V = time.strftime('%Y%m%d%H%M')
out = {'yandex': 'release/build/yandex', 'android': 'android/app/src/main/assets/www'}[target]
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
for d in ('css', 'data', 'img', 'audio'):
    if os.path.isdir(d): shutil.copytree(d, os.path.join(out, d))
os.makedirs(os.path.join(out, 'js/adapters'))
for f in os.listdir('js'):
    if f.endswith('.js') and f != 'ads-config.js': shutil.copy(os.path.join('js', f), os.path.join(out, 'js', f))
shutil.copy(f'js/adapters/{target}.js', os.path.join(out, f'js/adapters/{target}.js'))
shutil.copy('index.html', os.path.join(out, 'index.html'))
for junk in ('audio/SOURCES.json',):
    p = os.path.join(out, junk)
    if os.path.exists(p): os.remove(p)

def edit(rel, fn):
    p = os.path.join(out, rel); s = open(p, encoding='utf-8').read(); s2 = fn(s)
    open(p, 'w', encoding='utf-8').write(s2)

def html(s):
    assert 'testBadge' not in s and 'noindex' not in s
    s = re.sub(r'<script src="js/(?:ads-config|adapters/web)\.js[^"]*"></script>\n', '', s)  # web RTB ads: plain browser only
    s = re.sub(r'(src|href)="((?:js|css|data)/[^"?]+)"', lambda m: f'{m.group(1)}="{m.group(2)}?v={V}"', s)
    pre = f'<script>window.RELEASE=true;window.BUILD_V="{V}";</script>\n'
    if target == 'yandex':
        pre = '<script src="/sdk.js"></script>\n' + pre
    s = s.replace('<script src="js/platform.js', pre + '<script src="js/platform.js', 1)
    s = re.sub(r'(<script src="js/platform\.js[^"]*"></script>)', lambda m: m.group(1) + f'\n<script src="js/adapters/{target}.js?v={V}"></script>', s, count=1)
    if target == 'yandex':
        s = s.replace('<a class="brand" id="hBrand" href="https://pirogovlab.ru" target="_blank" rel="noopener">Проект PirogovLab · pirogovlab.ru</a>',
                      '<a class="brand" id="hBrand">Проект PirogovLab</a>')
    return s
edit('index.html', html)

if target == 'yandex':
    # Yandex rule 8.4.2: no links / domains to external resources anywhere in UI texts
    SUBS = [('\'<a href="https://pirogovlab.ru/suz-donyasy/privacy/" target="_blank" rel="noopener">Политика конфиденциальности</a>\'', "'Политика конфиденциальности'"),
            ('\'<a href="https://pirogovlab.ru" target="_blank" rel="noopener">PirogovLab</a>\'', "'PirogovLab'"),
            ('<a href="https://dict.fu-lab.ru" target="_blank" rel="noopener">dict.fu-lab.ru</a>', 'Fu-Lab'),
            (' · pirogovlab.ru', ''), (' (suno.com)', ''), ('(suno.com)', ''), ('suno.com', 'Suno'),
            ('dict.fu-lab.ru', 'Fu-Lab'), ('en.wiktionary.org', 'English Wiktionary'), ('ru.wiktionary.org', 'Викисловарь'),
            ('tt.wikipedia.org', 'татарская Википедия'), ('kaikki.org', 'Wiktextract'), ("'https://pirogovlab.ru/suz-donyasy/'", 'null')]
    for rel in ('js/i18n.js', 'js/app.js', 'js/tracks.js', 'js/platform.js'):
        def sub(s):
            for a, b in SUBS: s = s.replace(a, b)
            return s
        edit(rel, sub)

# ---- guards
bad = []
for dp, _, fs in os.walk(out):
    for f in fs:
        if not f.endswith(('.html', '.js', '.css', '.json')): continue
        p = os.path.join(dp, f); s = open(p, encoding='utf-8', errors='ignore').read()
        if f.endswith('.html') and ('testBadge' in s or 'noindex' in s): bad.append(p + ': test badge/noindex')
        if target == 'yandex' and '/data/' not in p:
            for m in re.finditer(r'https?://[^\s"\'`<>)]+|\b[\w.-]*(?:pirogovlab|fu-lab|suno|wiktionary|wikipedia|youtube|vk|play\.google|rustore)[\w-]*\.(?:ru|com|org|net|me|io)\b', s, re.I):
                u = m.group(0)
                if 'w3.org' in u or u.startswith('https://yandex.ru/dev/games'): continue
                bad.append(f'{p}: external ref {u}')
# app.js must not expose hooks in release
s = open(os.path.join(out, 'js/app.js'), encoding='utf-8').read()
if 'if (!window.RELEASE) window.suzDonyasy' not in s: bad.append('app.js: test hooks not guarded')
if bad:
    print('\n'.join(bad)); sys.exit('build_release: ABORT')
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
print(f'build_release {target}: {out} v={V} {size/1e6:.1f} MB')
if target == 'yandex':
    assert size < 100e6, 'Yandex limit 100 MB unpacked'
    z = 'release/suz-donyasy-yandex.zip'
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for dp, _, fs in os.walk(out):
            for f in sorted(fs):
                p = os.path.join(dp, f); arc = os.path.relpath(p, out)
                assert re.fullmatch(r'[A-Za-z0-9._/-]+', arc), 'bad filename for Yandex: ' + arc
                zf.write(p, arc, compress_type=zipfile.ZIP_STORED if f.endswith(('.mp3', '.webp', '.png', '.jpg')) else zipfile.ZIP_DEFLATED)
    print(f'zip: {z} {os.path.getsize(z)/1e6:.1f} MB')
