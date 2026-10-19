#!/usr/bin/env python3
"""Tatar lexicon + crossword layout for the Tatar word game (imported by build_game.py).
Sources (in src/, see SOURCES.md):
  ru_tt.jsonl      - Tatar entries of the Russian Wiktionary (ru.wiktionary.org), extracted by Wiktextract / kaikki.org.
                     CC BY-SA 4.0 (+GFDL). Headwords, Russian translations, examples, forms. The ONLY source of shipped glosses/cards.
  en_tt.jsonl      - Tatar entries of the English Wiktionary (kaikki.org), CC BY-SA 4.0: extra headwords (bonus only), English fallback gloss.
  ttwiki_freq.json - word-form counts from the tt.wikipedia dump (tools/ttwiki_freq.py); only numbers are used.
"""
import json, re, random, collections, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = f'{ROOT}/src'; T = f'{ROOT}/tools'; OUT = ROOT
sys.path.insert(0, T)
from religion_filter import religious, offensive
random.seed(42)
freq = json.load(open(f'{S}/ttwiki_freq.json'))
LET = re.compile(r'^[а-яёәөүҗңһ]{3,8}$')
LOAN_LET = re.compile(r'[цщё]')            # letters found almost only in Russian loans
POS_RU = {'noun': 'сущ.', 'verb': 'гл.', 'adj': 'прил.', 'adv': 'нареч.', 'num': 'числ.', 'pron': 'мест.'}
# special-field labels: such words are valid (bonus) but not crossword words
SPECIAL = ('хим.', 'мед.', 'физ.', 'анат.', 'лингв.', 'книжн.', 'диал.', 'матем.', 'истор.', 'техн.', 'биол.', 'астрон.', 'филол.', 'филос.',
           'биохим.', 'геол.', 'спец.', 'физиол.', 'грам.', 'экон.', 'юр.', 'минер.', 'комп.', 'устар.', 'редк.', 'прост.', 'сл.', 'полит.', 'воен.',
           'геометр.', 'информ.', 'полигр.', 'рег.', 'страд.', 'понуд.', 'деепр.', 'прич.')
LAB_RE = re.compile(r'^((?:[а-яёА-Я]+\.\s*)+)')
REF_RE = re.compile(r'^(?:см\.|то же,? что|словоформа|форма|мн\. ч\.|прич\. от|деепр\. от)', re.I)

def split_label(g):
    m = LAB_RE.match(g)
    if not m: return '', g.strip()
    lab = m.group(1).strip()
    if lab in ('см.',): return '', g.strip()
    return lab, g[m.end():].strip()

def clean_gloss(g):
    g = re.sub(r'\s*\(аналогично русскому слову\)', '', g)
    return re.sub(r'\s+', ' ', g).strip(' ;,')

def verb_stem(j):
    """Tatar verb headword = imperative stem (бар, укы, кил), derived from the past participle form (-ган/-гән/-кан/-кән)."""
    w = j['word']
    for f in j.get('forms', []):
        if 'Причастие прошедшего времени' in f.get('raw_tags', []) and 'Положительная форма' in f.get('raw_tags', []):
            m = re.match(r'^(.+?)(?:ган|гән|кан|кән)$', f['form'])
            if m: return m.group(1), w
    if w.endswith(('ырга', 'ергә')): return None, w           # бар-ырга or укы-рга: ambiguous without the participle
    m = re.match(r'^(.+?)(?:арга|әргә)$', w) or re.match(r'^(.+?[аәоөуүыиеэ])(?:рга|ргә)$', w)
    if m: return m.group(1), w
    return None, w

# ---------- read the Russian Wiktionary ----------
entries = collections.defaultdict(list)    # headword -> list of entry dicts (homonyms)
form_of = {}                               # inflected form -> lemma
def form_count(j):
    return sum(freq.get(f['form'], 0) for f in j.get('forms', []) if 'romanization' not in f.get('tags', []) and ' ' not in f['form'])
for l in open(f'{S}/ru_tt.jsonl', encoding='utf-8'):
    j = json.loads(l); w = j['word'].lower().strip(); pos = j.get('pos')
    if pos not in POS_RU: continue
    inf = ''
    if pos == 'verb' and re.search(r'(?:рга|ргә)$', w):
        st, inf = verb_stem(j)
        if not st: continue
        w = st
    senses = []
    for s in j.get('senses', []):
        gl = [x for x in s.get('glosses', []) if x]
        if not gl: continue
        lab, d = split_label(clean_gloss(gl[0]))
        if not d: continue
        ex = []
        for e in s.get('examples', [])[:3]:
            t = (e.get('text') or '').strip(); tr = (e.get('translation') or '').strip()
            if t and tr and len(t) < 160: ex.append([t, tr, ''])
        senses.append(dict(lab=lab, d=d, ex=ex))
    if not senses: continue
    extra = []
    for key, name in (('synonyms', 'Синонимы'), ('antonyms', 'Антонимы'), ('derived', 'Производные')):
        it = [x['word'] for x in j.get(key, []) if x.get('word') and not religious(x['word'])][:6]
        if it: extra.append(dict(kind=name, items=it))
    e = dict(pos=pos, inf=inf, senses=senses, extra=extra, f=form_count(j) + freq.get(w, 0) + (freq.get(inf, 0) if inf else 0))
    entries[w].append(e)
    for f in j.get('forms', []):
        fw = f['form'].lower()
        if 'romanization' in f.get('tags', []) or not LET.match(fw) or fw == w: continue
        form_of.setdefault(fw, w)

wk_en = {}
for l in open(f'{S}/en_tt.jsonl', encoding='utf-8'):
    j = json.loads(l)
    if j.get('pos') not in POS_RU: continue
    gl = [g for s in j.get('senses', []) for g in s.get('glosses', []) if 'letter of the' not in g]
    if gl: wk_en.setdefault(j['word'].lower(), gl)

# ---------- cards ----------
def all_text(es): return ' '.join(s['lab'] + ' ' + s['d'] + ' ' + ' '.join(x[1] for x in s['ex']) for e in es for s in e['senses'])
def resolve_ref(d, depth=0):
    """'см. X' -> X's first gloss"""
    m = re.match(r'^см\.\s*([а-яёәөүҗңһ]+)', d)
    if m and depth < 2 and m.group(1) in entries:
        return resolve_ref(entries[m.group(1)][0]['senses'][0]['d'], depth + 1)
    return d

UD = {}   # word -> {g: first gloss, loan, card, special, f}
BANNED = set(); NAMES = set()
for w, es in entries.items():
    if not LET.match(w): continue
    first_txt = es[0]['senses'][0]['lab'] + ' ' + es[0]['senses'][0]['d']
    if re.search(r'(?:мужское|женское) имя|^[А-ЯЁ]', es[0]['senses'][0]['d']): NAMES.add(w); continue   # personal / place names
    if religious(w, first_txt) or offensive(w, first_txt, es[0]['senses'][0]['lab']): BANNED.add(w); continue
    hom = []
    for e in es:
        ss = []
        for s in e['senses'][:6]:
            d = resolve_ref(s['d'])
            if religious('', s['lab'] + ' ' + d) or offensive('', d, s['lab']): continue      # drop the sense, keep the word
            ex = [x for x in s['ex'] if not (religious(x[0], x[1]) or offensive('', x[1]) or any(religious(t) or offensive(t) for t in re.findall(r'[а-яёәөүҗңһ]+', x[0].lower())))]
            ss.append(dict(n=len(ss) + 1, lab=s['lab'], d=d[:200], ex=ex[:2]))
        if ss: hom.append(dict(pos=e['pos'], senses=ss))
    if not hom: BANNED.add(w); continue
    first = hom[0]['senses'][0]
    g = first['d']
    loan = bool(LOAN_LET.search(w)) or w in re.findall(r'[а-яё]+', ' '.join(s['d'].lower() for h in hom for s in h['senses'][:1]))
    special = all(any(x in s['lab'] for x in SPECIAL) for h in hom for s in h['senses'][:1])
    ref_only = all(REF_RE.match(s['d']) for h in hom for s in h['senses'])
    gram = ', '.join(sorted({POS_RU[e['pos']] for e in es}))
    inf = next((e['inf'] for e in es if e['inf']), '')
    if inf: gram += ' (инф. ' + inf + ')'
    ex_by = {}
    for e in es:
        for x in e['extra']:
            lst = ex_by.setdefault(x['kind'], [])
            lst += [i for i in x['items'] if i not in lst]
    extra = [dict(kind=k, items=v[:6]) for k, v in ex_by.items()][:3]
    UD[w] = dict(g=None if ref_only else g, loan=loan, special=special or ref_only, f=sum(e['f'] for e in es),
                 card=dict(stress='', gram=gram, hill='', hom=hom, extra=extra, src='wkru'))
UD_COMPLETE = True

def gloss(w):
    if w in UD and UD[w]['g']: return UD[w]['g'][:90], 'ud'
    if w in form_of and form_of[w] in UD and UD[form_of[w]]['g']:
        return ('форма слова ' + form_of[w] + ' — ' + UD[form_of[w]]['g'])[:90], 'ru'
    if w in wk_en: return '; '.join(wk_en[w][:2])[:80], 'en'
    return None, None

# ---------- lexicon ----------
lex = {}
for w, v in UD.items():
    lex[w] = dict(f=v['f'], b=v['loan'] or v['special'] or not v['g'])
for w in wk_en:            # extra headwords from en.wiktionary: bonus only
    if w in lex or w in BANNED or not LET.match(w): continue
    if religious(w, ' '.join(wk_en[w])) or offensive(w, ' '.join(wk_en[w])): BANNED.add(w); continue
    lex[w] = dict(f=freq.get(w, 0), b=True)
for fw, lw in form_of.items():   # attested inflected forms of dictionary words: bonus only
    if fw in lex or lw not in UD or fw in BANNED or freq.get(fw, 0) < 30: continue
    if religious(fw) or offensive(fw): continue
    lex[fw] = dict(f=freq.get(fw, 0), b=True)

def score(w):
    e = lex[w]; f = e['f']
    return (0 if f <= 0 else 4 * len(str(int(f)))) + min(f, 3000) / 30 + (6 if w in UD else 0) + (3 if w in UD and UD[w]['card']['hom'][0]['senses'][0]['ex'] else 0)
grid_words = {w for w, e in lex.items() if not e['b'] and e['f'] >= 20}
bonus_words = set(lex) | grid_words
print('lexicon', len(lex), 'grid', len(grid_words), 'bonus', len(bonus_words), 'banned', len(BANNED), file=sys.stderr)
_cc = {}
def can_make(word, pool):
    c = _cc.get(word)
    if c is None: c = _cc[word] = collections.Counter(word)
    return all(pool[k] >= v for k, v in c.items())

# --- crossword layout ---
def layout(words, tries=300):
    best = None
    for t in range(tries):
        ws = sorted(words, key=lambda w: -len(w)) if t == 0 else random.sample(words, len(words))
        if t and random.random() < .5: ws = sorted(ws, key=lambda w: -len(w) + random.random() * 2)
        grid = {}; placed = []
        def fits(w, r, c, d):
            dr, dc = (0, 1) if d == 'h' else (1, 0)
            if (r - dr, c - dc) in grid or (r + dr * len(w), c + dc * len(w)) in grid: return False
            cross = 0
            for i, ch in enumerate(w):
                p = (r + dr * i, c + dc * i)
                if p in grid:
                    if grid[p][0] != ch or grid[p][1] == d: return False
                    cross += 1
                else:
                    n1 = (p[0] + dc, p[1] + dr); n2 = (p[0] - dc, p[1] - dr)
                    if n1 in grid or n2 in grid: return False
            return cross
        def put(w, r, c, d):
            dr, dc = (0, 1) if d == 'h' else (1, 0)
            for i, ch in enumerate(w):
                p = (r + dr * i, c + dc * i)
                grid[p] = (ch, 'x' if p in grid else d)
            placed.append((w, r, c, d))
        put(ws[0], 0, 0, 'h')
        left = ws[1:]; progress = True
        while left and progress:
            progress = False
            for w in list(left):
                opts = []
                for (pr, pc), (ch, pd) in list(grid.items()):
                    if pd == 'x': continue
                    nd = 'v' if pd == 'h' else 'h'
                    for i, wc in enumerate(w):
                        if wc != ch: continue
                        r, c = (pr - i, pc) if nd == 'v' else (pr, pc - i)
                        x = fits(w, r, c, nd)
                        if x: opts.append((x, random.random(), r, c, nd))
                if opts:
                    opts.sort(reverse=True); _, _, r, c, d = opts[0]
                    put(w, r, c, d); left.remove(w); progress = True
        rs = [p[0] for p in grid]; cs = [p[1] for p in grid]
        h = max(rs) - min(rs) + 1; wd = max(cs) - min(cs) + 1
        sc = len(placed) * 100 - abs(h - wd) * 3 - h * wd * 0.5 - max(0, wd - 10) * 50 - max(0, h - 10) * 50
        if best is None or sc > best[0]:
            mr, mc = min(rs), min(cs)
            best = (sc, [(w, r - mr, c - mc, d) for w, r, c, d in placed], h, wd)
        if len(placed) == len(words) and t > 60: break
    return best

