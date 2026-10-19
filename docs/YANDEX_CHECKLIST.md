# Сүз дөньясы — Yandex Games: what to fill in the console

Archive: `release/suz-donyasy-yandex.zip`: index.html in the root, 147 files, 20.0 MB zipped / 22.9 MB unpacked (limit 100 MB).

Rebuild with `python3 tools/build_release.py yandex`. It:
- adds `/sdk.js`, the Yandex adapter and `window.RELEASE`;
- strips test hooks, badge, noindex and every external link or domain;
- leaves out Mobile Ads entirely (only Yandex Games SDK ads).

Test: `cd test && node test_release.js` (mock SDK). Result: ALL PASS.

Console: https://games.yandex.ru/console → «Добавить приложение».

## 1. General (Общее)
| Field | What to enter |
|---|---|
| Языки | Only Russian (ru). The UI is Russian; game words are Tatar with Russian clues. |
| Архив | `suz-donyasy-yandex.zip` |
| Версия | 1.0.0 |
| Категории | Головоломки / Словесные (optionally Образовательные) |
| Платформы | Мобильные + Десктоп (portrait mobile, 16:9 desktop) |
| Ориентация (mobile) | Портретная |
| Возрастной рейтинг | 0+ |
| Облачные сохранения | **ON** (rule 1.11): progress is saved in player data |
| Реклама | Fullscreen (between levels, every 3rd, at least 150 s apart) + Rewarded (🎬 hint, ×2 coins, extra spin) + **Sticky banner**: enable *Sticky-баннеры* and tick **«Использовать API для показа sticky-баннера»**. The game calls `showBannerAdv()` only after the tutorial. No ads before the tutorial ends. |
| Инап-покупки | none |
| Лидерборд | technical name **`levels`**, numeric, descending, «Пройдено уровней» |
| Политика конфиденциальности | https://pirogovlab.ru/suz-donyasy/privacy/. ⚠ First upload the ads version (`release/privacy_with_ads/index.html`). |
| Email | contact email (rule 6.1) |

## 2. Description and promo (ru)
- **Название:** Сүз дөньясы (exactly as in the game and on the cover). If it is taken, use «Сүз дөньясы — татарские слова» and change `<title>` too.
- **Об игре / Как играть / SEO / теги:** see `release/store/TEXTS_ru.md`.
- **Иконка 512×512:** `yandex_assets/icon_512x512.png`
- **Обложка 800×470:** `yandex_assets/cover_800x470.png`
- **Скриншоты** (no ads):
  - `yandex_assets/screenshot_mobile_{1_tutorial,2_game,3_card,4_map,5_daily,6_spin,7_home}.png` (1080×1920);
  - `yandex_assets/screenshot_desktop_*.png` (1920×1080).
- **Видео:** `yandex_assets/trailer_1920x1080.mp4`.
  - 27.3 s, H.264 1920×1080 30 fps + AAC, 10.6 MB; contact sheet `trailer_contact_sheet.jpg`.
  - Real gameplay: home → swipes → word card → map → daily puzzle → wheel of fortune.
  - The music is an original pentatonic melody synthesised by `tools/make_trailer.py` (numpy), with no third-party audio. No religious imagery.
  - Re-record: `Xvfb :99 -screen 0 1920x1080x24 & cd test && XGRAB=:99 node trailer_rec.js && python3 ../tools/make_trailer.py`.

## 3. Check before you submit
1. **Religion (rule 3.4.5):**
   - `tools/scan_religion.py` on the shipped data finds 0 hits.
   - Chapter names are neutral (nature, cities, Sabantuy, kurai, ornament).
   - Backgrounds have no mosques, minarets, crescents, churches or domes; ch38 was regenerated.
2. **AI content:** the 50 chapter backgrounds are generated images (allowed, rule 1.23). There is no music.
3. **Links:** the Yandex build has no links or domains (checked by build_release.py). `shareUrl = null`.
4. **Share:** in the iframe the game falls back to saving the PNG and copying the text. If moderators object, hide the button for yandex.
5. Run from the draft with `?debug-mode=16` and check:
   - the loader shows IT;
   - the tutorial runs, and the sticky banner appears only after it;
   - fullscreen and rewarded ads show;
   - sound stops when you switch tabs.
6. Dictionary licence CC BY-SA 4.0 (Wiktionary): the in-game credits carry the attribution.
