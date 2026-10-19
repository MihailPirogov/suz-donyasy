#!/usr/bin/env python3
"""Build all game data for the Tatar word game «Сүз дөньясы» (working title):
   data/levels.js  - window.TT_DATA = {chapters, levels, daily, wotd, meta}
   data/cards/cXXXX.js - word cards chunked by first letter (lazy-loaded)
Usage: build_game.py [N_LEVELS=800] [CHAPTER_SIZE=16]
"""
import sys, os, json, random, itertools, collections, re, time
sys.path.insert(0, os.path.dirname(__file__))
from lexicon import *          # lex, grid_words, bonus_words, score, gloss, layout, UD, UD_COMPLETE, OUT, S
from religion_filter import religious, offensive
# Yandex Games rule 3.4.5: no religious words in crosswords, daily puzzles, bonus words or word of the day
RELIGIOUS = {w for w in set(grid_words) | set(bonus_words) if religious(w, gloss(w)[0] or '') or offensive(w, gloss(w)[0] or '')}
grid_words = {w for w in grid_words if w not in RELIGIOUS}
bonus_words = {w for w in bonus_words if w not in RELIGIOUS}
print('religious stop-list: excluded', len(RELIGIOUS), 'words', file=sys.stderr)
random.seed(7)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 800
CH = int(sys.argv[2]) if len(sys.argv) > 2 else 16
D = f'{OUT}/data'; os.makedirs(f'{D}/cards', exist_ok=True)
t0 = time.time()

def sig(w): return ''.join(sorted(w))
by_sig = collections.defaultdict(list)
for w in grid_words: by_sig[sig(w)].append(w)
bonus_by_sig = collections.defaultdict(list)
for w in bonus_words: bonus_by_sig[sig(w)].append(w)

def sub_sigs(base):
    s = sorted(base); out = set()
    for k in range(3, len(s) + 1):
        for comb in itertools.combinations(range(len(s)), k):
            out.add(''.join(s[i] for i in comb))
    return out

def has_gloss(w): return gloss(w)[0] is not None

# ---- candidate pools per base length ----
pools = {}
for L in range(3, 9):
    seen = set(); cands = []
    for base in grid_words:
        if len(base) != L: continue
        k = sig(base)
        if k in seen: continue
        seen.add(k)
        ss = sub_sigs(base)
        subs = sorted({w for s_ in ss for w in by_sig.get(s_, [])}, key=lambda w: -score(w))
        need = 2 if L == 3 else 3
        if len(subs) < need: continue
        top = subs[:L + 1]
        q_freq = sum(min(score(w), 400) for w in top) / len(top)
        q_gl = sum(has_gloss(w) for w in top) / len(top)
        cands.append(dict(base=base, subs=subs, q=q_freq * (0.35 + q_gl), gl=q_gl, ss=ss))
    cands.sort(key=lambda c: -c['q'])
    pools[L] = cands
    print('pool', L, len(cands), end='; ', file=sys.stderr)

def length_for(i, n):
    x = i / max(1, n - 1)            # 0..1 smooth curve
    for L, edge in ((4, .06), (5, .18), (6, .42), (7, .75), (8, 1.01)):
        if x < edge: return L
    return 8
def max_words(L, x): return {3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8}[L] + (1 if x > .5 and L >= 5 else 0)

# public source codes in shipped data: the dictionaries themselves, not the sites they were read from
SRC_CODE = {'wkru': 'wkru'}
used = set()
USE = collections.Counter()
def take(L, x, strict_top, i=999):
    for LL in [L, L - 1, L + 1, L - 2, L + 2]:
        if LL < 4: continue
        pool = pools.get(LL, [])
        free = [c for c in pool if sig(c['base']) not in used and (i >= 40 or c['gl'] >= 0.99)]
        if i < 15 and free:
            c = free[0]; used.add(sig(c['base'])); return c, LL
        if not free: continue
        # easier (higher quality) bases early inside each length band
        w = max(3, int(len(free) * strict_top))
        c = random.choice(free[:w])
        used.add(sig(c['base'])); return c, LL
    return None, None

def make_level(c, L, x, lid):
    mx = max_words(L, x)
    # prefer sub-words that were used less often in earlier levels (more variety across 1000 levels)
    subs = sorted([w for w in c['subs'] if w != c['base']], key=lambda w: -score(w) / (1 + USE[w]))
    chosen = [c['base']] + subs[:mx - 1]
    for w in chosen: USE[w] += 1
    _, placed, h, wd = layout(chosen, tries=160)
    placed_words = {p[0] for p in placed}
    bonus = sorted({w for s_ in c['ss'] for w in bonus_by_sig.get(s_, [])} - placed_words)
    letters = list(c['base']); random.shuffle(letters)
    while ''.join(letters) == c['base'] and len(set(letters)) > 1: random.shuffle(letters)
    gl = {}
    for w in list(placed_words) + bonus:
        g, lang = gloss(w)
        if g: gl[w] = [g, lang]
    return dict(id=lid, l=''.join(letters), r=h, c=wd, w=[[w, r, cc, d] for w, r, cc, d in placed], b=bonus, g=gl)

levels = []
for i in range(N):
    x = i / max(1, N - 1); L = length_for(i, N)
    c, LL = take(L, x, 0.10 if x < .3 else 0.25, i)
    if not c: print('pools exhausted at', i, file=sys.stderr); break
    levels.append(make_level(c, LL, x, i + 1))
    if i % 100 == 99: print('levels', i + 1, round(time.time() - t0), 's', file=sys.stderr)

daily = []
for i in range(366):
    c, LL = take(5 if i % 3 else 6, .5, 0.6)
    if not c: break
    daily.append(make_level(c, LL, .5, 'd%d' % (i + 1)))
print('daily', len(daily), file=sys.stderr)

# ---- chapters ----
CHAPTERS = [  # (tatar, russian, theme) - Tatar nature, places, seasons and folk (non-religious) culture
 ('Болын', 'Луг', 'meadow'), ('Урман', 'Лес', 'forest'), ('Күл', 'Озеро', 'lake'), ('Елга', 'Река', 'river'),
 ('Тау', 'Гора', 'hills'), ('Кыр', 'Поле', 'field'), ('Каенлык', 'Березняк', 'grove'), ('Авыл', 'Деревня', 'village'),
 ('Көз', 'Осень', 'autumn'), ('Кыш', 'Зима', 'winter'), ('Яз', 'Весна', 'spring'), ('Җәй', 'Лето', 'summer'),
 ('Төн', 'Ночь', 'night'), ('Кич', 'Вечер', 'sunset'), ('Иртә', 'Утро', 'dawn'), ('Идел', 'Волга', 'idel'),
 ('Чулман', 'Кама', 'river'), ('Казан', 'Казань', 'kremlin'), ('Алабуга', 'Елабуга', 'hills'), ('Чистай', 'Чистополь', 'idel'),
 ('Сабантуй', 'Сабантуй', 'sabantuy'), ('Каен', 'Берёза', 'grove'), ('Чыршы', 'Ель', 'winter'), ('Чәчәк', 'Цветок', 'spring'),
 ('Йолдыз', 'Звезда', 'night'), ('Ай', 'Луна', 'night'), ('Кояш', 'Солнце', 'summer'), ('Бал корты', 'Пчела', 'meadow'),
 ('Кош', 'Птица', 'dawn'), ('Бәйрәм', 'Праздник', 'sabantuy'), ('Җыр', 'Песня', 'kurai'), ('Курай', 'Курай', 'kurai'),
 ('Бизәк', 'Узор', 'autumn'), ('Туй', 'Свадьба', 'village'), ('Җир', 'Земля', 'field'), ('Яңгыр', 'Дождь', 'spring'),
 ('Җил', 'Ветер', 'hills'), ('Кар', 'Снег', 'winter'), ('Су', 'Вода', 'idel'), ('Ут', 'Огонь', 'sunset'),
 ('Көмеш', 'Серебро', 'winter'), ('Алтын', 'Золото', 'autumn'), ('Күк', 'Небо', 'dawn'), ('Юл', 'Дорога', 'hills'),
 ('Бакча', 'Сад', 'spring'), ('Уңыш', 'Урожай', 'field'), ('Чишмә', 'Родник', 'river'), ('Ат', 'Конь', 'field'),
 ('Халык', 'Народ', 'sabantuy'), ('Дөнья', 'Мир', 'night'),
]
chapters = []
for k in range(0, len(levels), CH):
    m, r, th = CHAPTERS[(k // CH) % len(CHAPTERS)]
    n = k // CH + 1
    if k // CH >= len(CHAPTERS): m, r = f'{m} {k // CH // len(CHAPTERS) + 1}', f'{r} {k // CH // len(CHAPTERS) + 1}'
    chapters.append(dict(n=n, tt=m, ru=r, theme=th, start=k + 1, end=min(k + CH, len(levels))))

# ---- word of the day pool ----
def good_card(w):
    if w not in UD or UD[w]['loan'] or not UD[w]['g']: return False
    return any(x['ex'] for h in UD[w]['card']['hom'] for x in h['senses']) and not UD[w]['special']
in_game = {x[0] for lv in levels for x in lv['w']}
wotd = sorted([w for w in in_game if good_card(w) and len(w) >= 3], key=lambda w: -score(w))[:600]
random.shuffle(wotd); wotd = wotd[:366]
if len(wotd) < 366:   # not enough cards with examples: top up with well-known words that have a translation card
    more = sorted([w for w in in_game if w in UD and UD[w]['g'] and not UD[w]['loan'] and not UD[w]['special'] and w not in wotd and len(w) >= 3], key=lambda w: -score(w))
    wotd += more[:366 - len(wotd)]

# ---- cards (chunked) ----
def compact(card):
    homs = []
    for h in card['hom']:
        ss = []
        for x in h['senses'][:5]:
            if not x['d'] and not x['ex']: continue
            ss.append(dict(n=x['n'], l=x['lab'], d=x['d'][:200], e=[[e[0][:160], e[1][:160], e[2][:30]] for e in x['ex'][:2]]))
        if ss: homs.append(ss)
    ex = [dict(k=e['kind'], i=e['items'][:6]) for e in card.get('extra', []) if e['items']][:3]
    return dict(s=card.get('stress', ''), g=card.get('gram', ''), h=card.get('hill', ''), m=homs[:3], x=ex, src=SRC_CODE.get(card.get('src', ''), 'wkru'))
words_needed = set(in_game) | set(wotd) | {w for lv in levels + daily for w in lv['b']} | {x[0] for lv in daily for x in lv['w']}
chunks = collections.defaultdict(dict)
for w in words_needed:
    if w in UD: chunks[ord(w[0])][w] = compact(UD[w]['card'])
for f in os.listdir(f'{D}/cards'): os.remove(f'{D}/cards/{f}')
for k, v in chunks.items():
    with open(f'{D}/cards/c{k}.js', 'w') as f:
        f.write('TT_CARDS_PUSH(' + json.dumps(v, ensure_ascii=False, separators=(',', ':')) + ');\n')

grid_total = sum(len(lv['w']) for lv in levels)
grid_gl = sum(1 for lv in levels for x in lv['w'] if x[0] in lv['g'])
grid_ud = sum(1 for lv in levels for x in lv['w'] if lv['g'].get(x[0], ['', ''])[1] == 'ud')
meta = dict(built=time.strftime('%Y-%m-%d %H:%M'), full_dictionary=UD_COMPLETE, levels=len(levels), chapters=len(chapters), daily=len(daily),
            grid_words=grid_total, grid_with_translation=grid_gl, grid_from_dictionary=grid_ud, cards=sum(len(v) for v in chunks.values()),
            card_chunks=sorted(chunks))
data = dict(meta=meta, chapters=chapters, levels=levels, daily=daily, wotd=wotd)
with open(f'{D}/levels.js', 'w') as f:
    f.write('window.TT_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
json.dump(meta, open(f'{D}/meta.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(meta, ensure_ascii=False), file=sys.stderr)
print('time', round(time.time() - t0), 's', file=sys.stderr)
