#!/usr/bin/env python3
"""Scan generated data/levels.js for religious words (stop-list + Russian clue patterns). Exit 1 if any found."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from religion_filter import religious, offensive, GLOSS_RE, BAD_RU
import glob, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(ROOT, 'data/levels.js'), encoding='utf-8').read()
D = json.loads(s[s.index('=') + 1:s.rstrip().rindex(';')])
hits = []; n = {'grid': 0, 'bonus': 0, 'daily_grid': 0, 'daily_bonus': 0, 'wotd': 0, 'clues': 0, 'chapters': 0}
for kind, lvs in (('', D['levels']), ('daily_', D['daily'])):
    for lv in lvs:
        for w in [x[0] for x in lv['w']]:
            n[kind + 'grid'] += 1
            if religious(w, (lv['g'].get(w) or [''])[0]) or offensive(w, (lv['g'].get(w) or [''])[0]): hits.append((kind + 'grid', lv['id'], w))
        for w in lv['b']:
            n[kind + 'bonus'] += 1
            if religious(w, (lv['g'].get(w) or [''])[0]) or offensive(w, (lv['g'].get(w) or [''])[0]): hits.append((kind + 'bonus', lv['id'], w))
        for w, g in lv['g'].items():
            n['clues'] += 1
            if GLOSS_RE.search((g[0] or '').lower()) or BAD_RU.search((g[0] or '').lower()): hits.append(('clue', lv['id'], w + ': ' + g[0][:50]))
for w in D['wotd']:
    n['wotd'] += 1
    if religious(w): hits.append(('wotd', '', w))
for c in D['chapters']:
    n['chapters'] += 1
    if religious(c['tt'].lower(), c['ru']): hits.append(('chapter', c['n'], c['tt'] + '/' + c['ru']))
# word cards: senses, examples and extra word lists
n['cards'] = 0
for f in glob.glob(os.path.join(ROOT, 'data/cards/c*.js')):
    t = open(f, encoding='utf-8').read(); C = json.loads(t[t.index('(') + 1:t.rstrip().rindex(')')])
    for w, c in C.items():
        n['cards'] += 1
        for hom in c['m']:
            for x in hom:
                txt = (x.get('l') or '') + ' ' + x['d'] + ' ' + ' '.join(e[1] for e in x['e'])
                toks = re.findall(r'[а-яёәөүҗңһ]+', ' '.join(e[0] for e in x['e']).lower())
                if GLOSS_RE.search(txt.lower()) or BAD_RU.search(txt.lower()) or any(religious(t) for t in toks): hits.append(('card', w, txt[:60]))
        for xx in c['x']:
            for it in xx['i']:
                if religious(it): hits.append(('card-extra', w, it))
print('scanned', json.dumps(n, ensure_ascii=False), '-> hits', len(hits))
for h in hits[:50]: print('  ', *h)
sys.exit(1 if hits else 0)
