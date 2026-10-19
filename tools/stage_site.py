#!/usr/bin/env python3
"""Stage (NOT publish) the public pages for «Сүз дөньясы» on pirogovlab.ru.
Input: read-only copies of the live pages in site_stage/live/ (fetched from the server; Mari pages are templates only).
Output: site_stage/out/ — new folders suz-donyasy-igra/, en/suz-donyasy-igra/, blog/2026-10-DD-suz-donyasy/, en/blog/…,
and patched copies of index.html, en/index.html, blog/index.html, en/blog/index.html, blog/rss.xml, en/blog/rss.xml, sitemap.xml."""
import re, os, html, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = ROOT + '/site_stage/live/'; O = ROOT + '/site_stage/out/'
DATE = sys.argv[1] if len(sys.argv) > 1 else '2026-10-19'   # publication date (YYYY-MM-DD)
Y, M, D = DATE.split('-'); MRU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][int(M)-1]
MEN = ['January','February','March','April','May','June','July','August','September','October','November','December'][int(M)-1]
DRU = f'{int(D)} {MRU} {Y}'; DEN = f'{MEN} {int(D)}, {Y}'
import datetime; dt = datetime.date(int(Y), int(M), int(D)); RFC = dt.strftime('%a, %d %b %Y') + ' 14:00:00 +0300'
SLUG = f'{DATE}-suz-donyasy'; VER = '1.0.0'
APK = '/suz-donyasy/suz-donyasy.apk'; SIZE_RU = '27 МБ'; SIZE_EN = '27 MB'
GAME = '/suz-donyasy/'; PRIV = '/suz-donyasy/privacy/'
RU_P = 'https://pirogovlab.ru/suz-donyasy-igra/'; EN_P = 'https://pirogovlab.ru/en/suz-donyasy-igra/'
OG = 'https://pirogovlab.ru/suz-donyasy-igra/img/og-suz-donyasy.jpg'
e = html.escape
def rd(p): return open(L + p, encoding='utf-8').read()
def wr(p, s):
    os.makedirs(os.path.dirname(O + p), exist_ok=True); open(O + p, 'w', encoding='utf-8').write(s)
def sub1(pat, rep, s, flags=0):
    n, k = re.subn(pat, rep, s, count=1, flags=flags); assert k == 1, pat; return n

def head(s, title, desc, canon, ogt, ogd, ogimg, ru, en):
    s = sub1(r'<title>.*?</title>', f'<title>{e(title)}</title>', s)
    s = sub1(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{e(desc)}">', s)
    s = sub1(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{canon}">', s)
    s = sub1(r'<link rel="alternate" hreflang="ru" href="[^"]*">', f'<link rel="alternate" hreflang="ru" href="{ru}">', s)
    s = sub1(r'<link rel="alternate" hreflang="en" href="[^"]*">', f'<link rel="alternate" hreflang="en" href="{en}">', s)
    s = sub1(r'<link rel="alternate" hreflang="x-default" href="[^"]*">', f'<link rel="alternate" hreflang="x-default" href="{ru}">', s)
    s = sub1(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{e(ogt)}">', s)
    s = sub1(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{e(ogd)}">', s)
    s = sub1(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{canon}">', s)
    s = sub1(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{ogimg}">', s)
    s = sub1(r'<meta name="twitter:image" content="[^"]*">', f'<meta name="twitter:image" content="{ogimg}">', s)
    return s

# ---- 3D tilt for the hero phone screenshot (same technique as the .ct-card on the home page) ----
TILT_CSS = '''<style>
.hero-app{perspective:1000px}
.tilt{position:relative;transform-style:preserve-3d;transform:rotateX(var(--rx,4deg)) rotateY(var(--ry,-8deg));transition:transform .5s cubic-bezier(.2,.8,.2,1);will-change:transform;border-radius:1.4rem}
.tilt.live{transition:transform .08s linear}
.tilt img{transform:translateZ(30px)}
.tilt::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;transform:translateZ(31px);background:radial-gradient(circle at var(--gx,30%) var(--gy,20%),rgba(255,255,255,.38),rgba(255,255,255,0) 55%)}
@media (prefers-reduced-motion:reduce){.tilt{transform:none}}
</style>
'''
TILT_JS = '''<script>(function(){var c=document.querySelector(".tilt");if(!c||!window.matchMedia||matchMedia("(prefers-reduced-motion: reduce)").matches)return;var r=0,M=12;
function set(x,y){if(r)return;r=requestAnimationFrame(function(){r=0;c.style.setProperty("--ry",(x*M).toFixed(2)+"deg");c.style.setProperty("--rx",(-y*M).toFixed(2)+"deg");c.style.setProperty("--gx",(50+x*50)+"%");c.style.setProperty("--gy",(50+y*50)+"%")})}
var s=document.querySelector("main header")||c.parentNode;s.addEventListener("pointermove",function(e){if(e.pointerType!=="mouse")return;var b=c.getBoundingClientRect();c.classList.add("live");set(Math.max(-1,Math.min(1,(e.clientX-b.left)/b.width*2-1)),Math.max(-1,Math.min(1,(e.clientY-b.top)/b.height*2-1)))});
s.addEventListener("pointerleave",function(){c.classList.remove("live");c.style.removeProperty("--rx");c.style.removeProperty("--ry")});
if(matchMedia("(hover: none)").matches){window.addEventListener("deviceorientation",function(e){if(e.gamma==null)return;c.classList.add("live");set(Math.max(-1,Math.min(1,e.gamma/30)),Math.max(-1,Math.min(1,(e.beta-45)/30)))},{passive:true})}})();</script>
'''
GP_SVG = '<svg viewBox="0 0 24 26" aria-hidden="true" width="26" height="28"><path fill="#00d7fe" d="M1 .6 13.4 13 1 25.4C.6 25.2.4 24.7.4 24.1V1.9C.4 1.3.6.8 1 .6z"/><path fill="#ffce00" d="m17.5 8.9 4.3 2.4c1.3.8 1.3 2 0 2.8l-4.3 2.4L13.4 13z"/><path fill="#ff3a44" d="M17.5 17.1 13.4 13 1 25.4c.5.4 1.2.4 2 0z"/><path fill="#00f076" d="M17.5 8.9 3 .6C2.2.2 1.5.2 1 .6L13.4 13z"/></svg>'
def stores(lang):
    t = (lambda ru, en: ru if lang == 'ru' else en)
    return ('<!-- PLACEHOLDER stores: set href and remove "hidden" when each listing is live -->\n      <div class="stores-row">'
      f'<a class="store rs" href="#rustore" rel="noopener" hidden><i>R</i><span><small>{t("Скачать в","Get it on")}</small><b>RuStore</b></span></a>'
      f'<a class="store gp" href="#google-play" rel="noopener" hidden>{GP_SVG}<span><small>{t("Доступно в","Get it on")}</small><b>Google Play</b></span></a>'
      f'<a class="store yg" href="#yandex-games" rel="noopener" hidden><i>Я</i><span><small>{t("Играть в","Play on")}</small><b>{t("Яндекс Играх","Yandex Games")}</b></span></a></div>')
SH = {'ru': [('game','Кроссворд и круг с буквами'),('card','Карточка слова с переводом'),('map','Карта: 50 глав'),('daily','Задача дня'),('spin','Колесо удачи'),('home','Главный экран'),('tutorial','Обучение при первом запуске')],
      'en': [('game','Crossword and the letter wheel'),('card','Word card with translation'),('map','Map: 50 chapters'),('daily','Daily puzzle'),('spin','Fortune wheel'),('home','Home screen'),('tutorial','First-launch tutorial')]}
def gal(lang): return '<div class="gal">' + ''.join(f'<figure class="shot"><img src="/suz-donyasy-igra/img/screen-{k}.webp" width="540" height="960" loading="lazy" alt="{c}"><figcaption>{c}</figcaption></figure>' for k, c in SH[lang]) + '</div>'

def landing(lang):
    s = rd(('en/' if lang == 'en' else '') + 'mut-tunya-igra/index.html')
    pre, post = s[:s.index('<main')], s[s.index('</main>') + len('</main>'):]
    if lang == 'ru':
        pre = head(pre, 'Сүз дөньясы — словесная игра на татарском языке | Pirogov Lab',
          'Сүз дөньясы («Мир слов») — бесплатная словесная головоломка: составляйте татарские слова из букв, 1000 уровней в 50 главах, перевод каждого слова. Игра в браузере, скоро в RuStore, Google Play и Яндекс Играх.',
          RU_P, 'Сүз дөньясы — словесная игра на татарском языке', 'Соединяйте буквы, составляйте татарские слова и заполняйте кроссворд. 1000 уровней, карточки слов с переводом, задача дня и колесо удачи.', OG, RU_P, EN_P)
        pre = pre.replace('<span class="crumb">Мут тӱня</span>', '<span class="crumb">Сүз дөньясы</span>').replace('href="/en/mut-tunya-igra/"', 'href="/en/suz-donyasy-igra/"')
        main = f'''<main class="wrap">
  <header>
    <div>
      <img class="applogo" src="/suz-donyasy-igra/img/logo.webp" width="256" height="256" alt="Сүз дөньясы">
      <p class="eyebrow"><span>Татар теле · Android · Браузер</span></p>
      <h1>Сүз дөньясы — мир татарских слов</h1>
      <p class="lead">Словесная головоломка на <b>татарском языке</b>: соединяйте буквы на круге, составляйте слова и заполняйте кроссворд. <b>1000 уровней</b>, а у каждого слова — карточка с переводом на русский.</p>
      <div class="dl"><a class="btn" href="{GAME}">▶ Играть в браузере</a><a class="btn ghost" href="{APK}" download>⬇ Скачать APK ({VER}, {SIZE_RU})</a></div>
      {stores('ru')}
      <div class="meta"><span class="pill">Версия {VER}</span><span class="pill">{DRU}</span><span class="pill">Android 7.0+</span><span class="pill">Бесплатно</span></div>
    </div>
    <figure class="hero-app"><div class="tilt"><img src="/suz-donyasy-igra/img/screen-game.webp" width="540" height="960" alt="Сүз дөньясы — уровень с кроссвордом и кругом букв" fetchpriority="high"></div></figure>
  </header>
  <hr class="rule" style="margin-top:1rem">
  <section aria-labelledby="f"><h2 id="f">Возможности</h2><div class="card"><ul style="padding-left:1.2rem;margin:0">
    <li><b>1000 уровней в 50 главах</b> — Болын, Урман, Идел, Чулман, Казан, Сабантуй, Курай, Бизәк…; у каждой главы свой живописный фон с природой и деревнями</li>
    <li><b>Татарские буквы Ә, Ө, Ү, Җ, Ң, Һ</b> — прямо на колесе, ничего набирать не нужно</li>
    <li><b>Карточки слов</b> — нажмите на найденное слово: перевод на русский, значения и примеры</li>
    <li><b>«Мой словарь»</b> — все выученные слова в одном месте; бонусные слова попадают в копилку</li>
    <li><b>Каждый день</b> — задача дня, слово дня, ежедневная награда, задания, колесо удачи и достижения</li>
    <li>Подсказки: 💡 открыть букву, 🎯 открыть слово, ⟳ перемешать; короткое обучение при первом запуске; работает <b>без интернета</b></li>
  </ul></div></section>
  <section aria-labelledby="s"><h2 id="s">Скриншоты</h2><figure class="shot" style="margin-bottom:1.5rem"><img src="/suz-donyasy-igra/img/feature-graphic.webp" width="1024" height="500" loading="lazy" alt="Сүз дөньясы — татарча сүз уены"></figure>
  {gal('ru')}
  <div class="wide"><figure class="shot"><img src="/suz-donyasy-igra/img/desktop-game.webp" width="1280" height="720" loading="lazy" alt="Версия для компьютера"><figcaption>В браузере на компьютере</figcaption></figure><figure class="shot"><img src="/suz-donyasy-igra/img/desktop-card.webp" width="1280" height="720" loading="lazy" alt="Карточка слова на компьютере"><figcaption>Карточка слова</figcaption></figure></div></section>
  <section aria-labelledby="i"><h2 id="i">Где играть</h2><div class="card"><p style="margin:0">Прямо сейчас — <a href="{GAME}">в браузере</a> на телефоне или компьютере (прогресс сохраняется на устройстве) или на Android: скачайте <a href="{APK}" download>suz-donyasy.apk</a> ({VER}, {SIZE_RU}), откройте файл и разрешите установку из этого источника. Скоро «Сүз дөньясы» появится в RuStore, Google Play и Яндекс Играх.</p></div></section>
  <section aria-labelledby="src"><h2 id="src">Словарь</h2><div class="card"><ul class="src" style="padding-left:1.2rem;margin:0"><li>Слова, переводы и примеры — татарские статьи <a href="https://ru.wiktionary.org" target="_blank" rel="noopener">Викисловаря</a> (CC BY-SA 4.0; данные Wiktextract / kaikki.org), дополнительно English Wiktionary</li><li>Частоты слов — татарская Википедия</li></ul>
  <p class="note">В мобильных версиях будет ненавязчивая реклама (после обучения, между уровнями и по желанию — за подсказку). <a href="{PRIV}">Политика конфиденциальности</a>.</p></div></section>
  <aside class="callout" role="note" style="margin-top:3rem"><div class="callout-ico" aria-hidden="true">✦</div><p><b>PirogovLab лабораториясе проекты</b> · Проект лаборатории <a href="https://pirogovlab.ru">PirogovLab</a>. Нашли ошибку в слове или переводе? Напишите в <a href="/contacts/">Telegram</a>.</p></aside>
</main>'''
        post = post.replace('/mut-tunya/privacy/', PRIV)
        wr('suz-donyasy-igra/index.html', pre.replace('</head>', TILT_CSS + '</head>', 1) + main + post.replace('</body>', TILT_JS + '</body>', 1))
    else:
        pre = head(pre, 'Süz Dönyası — a word game in the Tatar language | Pirogov Lab',
          'Süz Dönyası (“World of Words”) is a free word puzzle: build Tatar words from letters, 1000 levels in 50 chapters, a translation for every word. Play in the browser; RuStore, Google Play and Yandex Games coming soon.',
          EN_P, 'Süz Dönyası — a word game in the Tatar language', 'Connect letters, build Tatar words and fill the crossword. 1000 levels, word cards with translations, a daily puzzle and a fortune wheel.', OG, RU_P, EN_P)
        pre = pre.replace('<span class="crumb">Mut Tünya</span>', '<span class="crumb">Süz Dönyası</span>').replace('href="/mut-tunya-igra/"', 'href="/suz-donyasy-igra/"')
        main = f'''<main class="wrap">
  <header>
    <div>
      <img class="applogo" src="/suz-donyasy-igra/img/logo.webp" width="256" height="256" alt="Süz Dönyası">
      <p class="eyebrow"><span>Tatar language · Android · Browser</span></p>
      <h1>Süz Dönyası — the world of Tatar words</h1>
      <p class="lead">A word puzzle in the <b>Tatar language</b>: connect letters on the wheel, build words and fill the crossword. <b>1000 levels</b>, and every word has a card with its Russian translation.</p>
      <div class="dl"><a class="btn" href="{GAME}" hreflang="ru">▶ Play in the browser</a><a class="btn ghost" href="{APK}" download>⬇ Download APK ({VER}, {SIZE_EN})</a></div>
      {stores('en')}
      <div class="meta"><span class="pill">Version {VER}</span><span class="pill">{DEN}</span><span class="pill">Android 7.0+</span><span class="pill">Free</span></div>
    </div>
    <figure class="hero-app"><div class="tilt"><img src="/suz-donyasy-igra/img/screen-game.webp" width="540" height="960" alt="Süz Dönyası — a level with the crossword and the letter wheel" fetchpriority="high"></div></figure>
  </header>
  <hr class="rule" style="margin-top:1rem">
  <section aria-labelledby="f"><h2 id="f">Features</h2><div class="card"><ul style="padding-left:1.2rem;margin:0">
    <li><b>1000 levels in 50 chapters</b>, each with its own scenic background of Tatarstan's nature and villages</li>
    <li><b>Tatar letters Ә, Ө, Ү, Җ, Ң, Һ</b> right on the wheel, no typing needed</li>
    <li><b>Word cards</b>: tap a found word to see its Russian translation, meanings and examples</li>
    <li><b>“My dictionary”</b>: every word you have learned; bonus words go into a jar</li>
    <li><b>Every day</b>: a daily puzzle, a word of the day, a daily reward, quests, a fortune wheel and achievements</li>
    <li>Hints: 💡 reveal a letter, 🎯 reveal a word, ⟳ shuffle; a short tutorial; works <b>offline</b>; the interface is in Russian</li>
  </ul></div></section>
  <section aria-labelledby="s"><h2 id="s">Screenshots</h2><figure class="shot" style="margin-bottom:1.5rem"><img src="/suz-donyasy-igra/img/feature-graphic.webp" width="1024" height="500" loading="lazy" alt="Süz Dönyası"></figure>
  {gal('en')}
  <div class="wide"><figure class="shot"><img src="/suz-donyasy-igra/img/desktop-game.webp" width="1280" height="720" loading="lazy" alt="Desktop browser version"><figcaption>In a desktop browser</figcaption></figure><figure class="shot"><img src="/suz-donyasy-igra/img/desktop-card.webp" width="1280" height="720" loading="lazy" alt="A word card on desktop"><figcaption>A word card</figcaption></figure></div></section>
  <section aria-labelledby="i"><h2 id="i">Where to play</h2><div class="card"><p style="margin:0">Right now: <a href="{GAME}" hreflang="ru">in the browser</a> on a phone or computer (progress is saved on the device), or on Android: download <a href="{APK}" download>suz-donyasy.apk</a> ({VER}, {SIZE_EN}), open it and allow installs from this source. RuStore, Google Play and Yandex Games are coming soon.</p></div></section>
  <section aria-labelledby="src"><h2 id="src">Dictionary</h2><div class="card"><ul class="src" style="padding-left:1.2rem;margin:0"><li>Words, translations and examples: Tatar entries of the Russian <a href="https://ru.wiktionary.org" target="_blank" rel="noopener">Wiktionary</a> (CC BY-SA 4.0; Wiktextract / kaikki.org data), plus English Wiktionary</li><li>Word frequencies: Tatar Wikipedia</li></ul>
  <p class="note">The mobile versions will show unobtrusive ads (after the tutorial, between levels and, if you choose, for a hint). <a href="{PRIV}" hreflang="ru">Privacy policy</a>.</p></div></section>
  <aside class="callout" role="note" style="margin-top:3rem"><div class="callout-ico" aria-hidden="true">✦</div><p>A <a href="https://pirogovlab.ru/en/">PirogovLab</a> project. Found a mistake in a word or translation? Message me on <a href="/en/contacts/">Telegram</a>.</p></aside>
</main>'''
        post = post.replace('/mut-tunya/privacy/', PRIV)
        wr('en/suz-donyasy-igra/index.html', pre.replace('</head>', TILT_CSS + '</head>', 1) + main + post.replace('</body>', TILT_JS + '</body>', 1))

def blogpost(lang):
    s = rd(('en/' if lang == 'en' else '') + 'blog/2026-10-18-mut-tunya/index.html')
    pre, post = s[:s.index('<main')], s[s.index('</main>') + len('</main>'):]
    ru_u = f'https://pirogovlab.ru/blog/{SLUG}/'; en_u = f'https://pirogovlab.ru/en/blog/{SLUG}/'; img = 'https://pirogovlab.ru/blog/media/suz-donyasy.jpg'
    if lang == 'ru':
        T = '«Сүз дөньясы»: словесная игра на татарском языке'
        DS = 'Сделал «Сүз дөньясы» — словесную головоломку на татарском: 1000 уровней, перевод каждого слова, задача дня и колесо удачи. Играть можно в браузере, скоро — RuStore, Google Play и Яндекс Игры.'
        pre = head(pre, T + ' | Pirogov Lab', DS, ru_u, T, DS, img, ru_u, en_u)
        pre = pre.replace('href="/en/blog/2026-10-18-mut-tunya/"', f'href="/en/blog/{SLUG}/"')
        main = f'''<main class="wrap">
<article class="full">
  <p class="eyebrow"><a href="/blog/">Микроблог</a></p>
  <h1>{T}</h1>
  <time class="date" datetime="{DATE}T14:00:00+03:00">{DRU}</time>
  <figure class="media"><img src="/blog/media/suz-donyasy.jpg" width="1200" height="630" alt="{T}"></figure>
  <div class="body">
<p>После марийской «Мут тӱня» сделал игру для соседей — <b>«Сүз дөньясы»</b> («Мир слов»), словесную головоломку на татарском языке. Соединяете буквы на круге, составляете татарские слова и заполняете ими кроссворд.</p>
<h2>Что внутри</h2>
<ul>
<li><b>1000 уровней в 50 главах</b>: Болын, Урман, Идел, Чулман, Казан, Сабантуй, Курай, Бизәк… У каждой главы свой фон — луга, леса, реки и деревни.</li>
<li>Буквы <b>Ә, Ө, Ү, Җ, Ң, Һ</b> прямо на колесе.</li>
<li><b>Карточки слов</b>: нажмите на найденное слово — перевод на русский, значения и примеры из Викисловаря. Выученные слова собираются в «Мой словарь».</li>
<li><b>Каждый день</b> — задача дня, слово дня, ежедневная награда, задания, колесо удачи и достижения.</li>
<li>Подсказки, бонусные слова, короткое обучение при первом запуске. Работает <b>без интернета</b>.</li>
</ul>
<p>Слова и переводы взяты из открытого Викисловаря (CC BY-SA 4.0); религиозная и ненормативная лексика из игры исключена. Сейчас играть можно <b>прямо в браузере</b> на телефоне и компьютере, скоро «Сүз дөньясы» появится в RuStore, Google Play и Яндекс Играх.</p>
<p>Нашли ошибку в слове или переводе? Напишите мне в <a href="/contacts/">Telegram</a> — буду исправлять. Рәхмәт!</p>
  </div>
  <div class="stores"><a class="btn" href="{GAME}">▶ Играть в браузере</a></div>
  <div class="meta"><span class="pill">Версия {VER}</span><span class="pill">Браузер · Android скоро</span><span class="pill">Бесплатно</span></div>
  <a class="proj" href="/suz-donyasy-igra/"><img src="/suz-donyasy-igra/img/kartochka-suz-donyasy.webp" width="480" height="320" alt=""><div><b>Сүз дөньясы</b><span>Страница игры: возможности, скриншоты, где играть</span></div><span class="go" aria-hidden="true">→</span></a>
  <a class="backlink" href="/blog/">← Все записи</a>
</article>
</main>'''
        wr(f'blog/{SLUG}/index.html', pre + main + post)
    else:
        T = 'Süz Dönyası: a word game in the Tatar language'
        DS = 'I made Süz Dönyası, a word puzzle in Tatar: 1000 levels, a translation for every word, a daily puzzle and a fortune wheel. Play in the browser; RuStore, Google Play and Yandex Games coming soon.'
        pre = head(pre, T + ' | Pirogov Lab', DS, en_u, T, DS, img, ru_u, en_u)
        pre = pre.replace('href="/blog/2026-10-18-mut-tunya/"', f'href="/blog/{SLUG}/"')
        main = f'''<main class="wrap">
<article class="full">
  <p class="eyebrow"><a href="/en/blog/">Microblog</a></p>
  <h1>{T}</h1>
  <time class="date" datetime="{DATE}T14:00:00+03:00">{DEN}</time>
  <figure class="media"><img src="/blog/media/suz-donyasy.jpg" width="1200" height="630" alt="{T}"></figure>
  <div class="body">
<p>After the Mari game Mut Tünya I made one for our neighbours: <b>Süz Dönyası</b> (“World of Words”), a word puzzle in the Tatar language. Connect letters on the wheel, build Tatar words and fill the crossword with them.</p>
<h2>What's inside</h2>
<ul>
<li><b>1000 levels in 50 chapters</b>, each with its own background of meadows, forests, rivers and villages.</li>
<li>The letters <b>Ә, Ө, Ү, Җ, Ң, Һ</b> right on the wheel.</li>
<li><b>Word cards</b>: tap a found word to see its Russian translation, meanings and examples from Wiktionary. Learned words go into “My dictionary”.</li>
<li><b>Every day</b>: a daily puzzle, a word of the day, a daily reward, quests, a fortune wheel and achievements.</li>
<li>Hints, bonus words and a short tutorial on first launch. Works <b>offline</b>.</li>
</ul>
<p>Words and translations come from the open Wiktionary (CC BY-SA 4.0). You can <b>play right in the browser</b> now; RuStore, Google Play and Yandex Games are coming soon. The interface is in Russian.</p>
<p>Found a mistake in a word or translation? Message me on <a href="/en/contacts/">Telegram</a>.</p>
  </div>
  <div class="stores"><a class="btn" href="{GAME}" hreflang="ru">▶ Play in the browser</a></div>
  <div class="meta"><span class="pill">Version {VER}</span><span class="pill">Browser · Android soon</span><span class="pill">Free</span></div>
  <a class="proj" href="/en/suz-donyasy-igra/"><img src="/suz-donyasy-igra/img/kartochka-suz-donyasy.webp" width="480" height="320" alt=""><div><b>Süz Dönyası</b><span>Game page: features, screenshots, where to play</span></div><span class="go" aria-hidden="true">→</span></a>
  <a class="backlink" href="/en/blog/">← All posts</a>
</article>
</main>'''
        wr(f'en/blog/{SLUG}/index.html', pre + main + post)

def patch(rel, fn):
    s = rd(rel); n = fn(s); assert n != s, rel; wr(rel, n)
def home_ru(s):
    mb = f'<a class="mbf" href="/blog/{SLUG}/"><img src="/blog/media/suz-donyasy-thumb.webp" width="960" height="540" alt=""><div><time datetime="{DATE}">{DRU}</time><b>«Сүз дөньясы»: словесная игра на татарском</b><span>Соединяйте буквы, составляйте татарские слова и заполняйте кроссворд: 1000 уровней и перевод каждого слова — играть в браузере</span></div></a>\n      '
    i = s.index('<a class="mbf"'); s = s[:i] + mb + s[i:]
    # keep the same number of feed items: drop the last one
    items = list(re.finditer(r'      <a class="mbf" href="[^"]*".*?</a>\n', s, re.S)); last = items[-1]; s = s[:last.start()] + s[last.end():]
    pj = '<a class="proj" href="/suz-donyasy-igra/"><img src="/suz-donyasy-igra/img/kartochka-suz-donyasy.webp" width="480" height="320" alt="Сүз дөньясы — словесная игра на татарском языке"><div><b>Сүз дөньясы — мир татарских слов</b><span>Словесная головоломка на татарском: 1000 уровней и перевод каждого слова — игра в браузере</span></div><span class="go" aria-hidden="true">→</span></a>\n  '
    i = s.index('<a class="proj" href="/mut-tunya-igra/"'); return s[:i] + pj + s[i:]
def home_en(s):
    mb = f'<a class="mbf" href="/en/blog/{SLUG}/"><img src="/blog/media/suz-donyasy-thumb.webp" width="960" height="540" alt=""><div><time datetime="{DATE}">{DEN}</time><b>Süz Dönyası: a word game in Tatar</b><span>Connect letters, build Tatar words and fill the crossword: 1000 levels and a translation for every word — play in the browser</span></div></a>\n      '
    i = s.index('<a class="mbf"'); s = s[:i] + mb + s[i:]
    items = list(re.finditer(r'      <a class="mbf" href="[^"]*".*?</a>\n', s, re.S))
    if len(items) > 5: last = items[-1]; s = s[:last.start()] + s[last.end():]
    pj = '<a class="proj" href="/en/suz-donyasy-igra/"><img src="/suz-donyasy-igra/img/kartochka-suz-donyasy.webp" width="480" height="320" alt="Süz Dönyası — a word game in the Tatar language"><div><b>Süz Dönyası — the world of Tatar words</b><span>A word puzzle in Tatar: 1000 levels and a translation for every word — browser play</span></div><span class="go" aria-hidden="true">→</span></a>\n  '
    i = s.index('<a class="proj" href="/en/mut-tunya-igra/"'); return s[:i] + pj + s[i:]
def blog_idx(lang):
    def f(s):
        if lang == 'ru':
            a = f'''  <article class="card post">
    <time class="date" datetime="{DATE}T14:00:00+03:00">{DRU}</time>
    <h2><a href="/blog/{SLUG}/">«Сүз дөньясы»: словесная игра на татарском языке</a></h2>
    <figure class="media"><img src="/blog/media/suz-donyasy.jpg" width="1200" height="630" alt="Сүз дөньясы — мир татарских слов" loading="lazy"></figure>
    <p>Словесная головоломка на татарском: соединяйте буквы, составляйте слова и заполняйте кроссворд. 1000 уровней в 50 главах, перевод каждого слова, задача дня и колесо удачи. Играть можно в браузере, скоро — RuStore, Google Play и Яндекс Игры.</p>
    <a class="more" href="/blog/{SLUG}/">Читать полностью →</a>
  </article>
'''
        else:
            a = f'''  <article class="card post">
    <time class="date" datetime="{DATE}T14:00:00+03:00">{DEN}</time>
    <h2><a href="/en/blog/{SLUG}/">Süz Dönyası: a word game in the Tatar language</a></h2>
    <figure class="media"><img src="/blog/media/suz-donyasy.jpg" width="1200" height="630" alt="Süz Dönyası — the world of Tatar words" loading="lazy"></figure>
    <p>A word puzzle in Tatar: connect letters, build words and fill the crossword. 1000 levels in 50 chapters, a translation for every word, a daily puzzle and a fortune wheel. Play in the browser; RuStore, Google Play and Yandex Games coming soon.</p>
    <a class="more" href="/en/blog/{SLUG}/">Read more →</a>
  </article>
'''
        return s.replace('  <div class="feed">\n', '  <div class="feed">\n' + a, 1)
    return f
def rss(lang):
    def f(s):
        base = f'https://pirogovlab.ru/blog/{SLUG}/' if lang == 'ru' else f'https://pirogovlab.ru/en/blog/{SLUG}/'
        t = '«Сүз дөньясы»: словесная игра на татарском языке' if lang == 'ru' else 'Süz Dönyası: a word game in the Tatar language'
        d = ('Словесная головоломка на татарском: 1000 уровней, перевод каждого слова, задача дня и колесо удачи. Игра в браузере.' if lang == 'ru'
             else 'A word puzzle in Tatar: 1000 levels, a translation for every word, a daily puzzle and a fortune wheel. Browser play.')
        item = f'    <item>\n      <title>{t}</title>\n      <link>{base}</link>\n      <guid isPermaLink="true">{base}</guid>\n      <pubDate>{RFC}</pubDate>\n      <description>{d}</description>\n    </item>\n'
        s = re.sub(r'<lastBuildDate>.*?</lastBuildDate>', f'<lastBuildDate>{RFC}</lastBuildDate>', s, count=1)
        i = s.index('    <item>'); return s[:i] + item + s[i:]
    return f
def sitemap(s):
    add = ''.join(f'  <url><loc>https://pirogovlab.ru/{u}</loc><lastmod>{DATE}</lastmod></url>\n' for u in
        ['suz-donyasy-igra/', 'en/suz-donyasy-igra/', f'blog/{SLUG}/', f'en/blog/{SLUG}/', 'suz-donyasy/', 'suz-donyasy/privacy/'])
    for u in ['', 'en/', 'blog/', 'en/blog/']:
        s = re.sub(rf'(<url><loc>https://pirogovlab.ru/{re.escape(u)}</loc><lastmod>)[^<]*', rf'\g<1>{DATE}', s)
    return s.replace('</urlset>', add + '</urlset>')

landing('ru'); landing('en'); blogpost('ru'); blogpost('en')
patch('index.html', home_ru); patch('en/index.html', home_en)
patch('blog/index.html', blog_idx('ru')); patch('en/blog/index.html', blog_idx('en'))
patch('blog/rss.xml', rss('ru')); patch('en/blog/rss.xml', rss('en')); patch('sitemap.xml', sitemap)
print('staged ->', O, 'slug', SLUG)
