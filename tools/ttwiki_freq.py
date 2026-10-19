#!/usr/bin/env python3
"""Word-form frequencies from the tt.wikipedia dump (src/ttwiki.xml.bz2) -> src/ttwiki_freq.json (forms with count>=3)."""
import bz2, re, collections, json, os
S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src')
# normalise look-alike letters often typed in Tatar texts (Latin/other Cyrillic) to the standard Tatar Cyrillic ones
TR = str.maketrans({'ə': 'ә', 'Ə': 'Ә', 'ҙ': 'з', 'ӊ': 'ң', 'ӈ': 'ң', 'ҫ': 'с', 'ӂ': 'җ', 'ұ': 'ү', 'ө': 'ө'})
TOK = re.compile(r'[а-яёәөүҗңһ]+')
c = collections.Counter(); intext = False
with bz2.open(f'{S}/ttwiki.xml.bz2', 'rt', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if '<text' in line: intext = True
        if intext:
            c.update(TOK.findall(line.translate(TR).lower()))
        if '</text>' in line: intext = False
json.dump({w: n for w, n in c.items() if n >= 3}, open(f'{S}/ttwiki_freq.json', 'w'), ensure_ascii=False)
print('forms', len(c), 'kept', sum(1 for n in c.values() if n >= 3))
