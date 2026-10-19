# Сүз дөньясы — Android build

- APK (signed, v2 scheme): `release/suz-donyasy.apk` (27.4 MB). The same file is `release/suz-donyasy-rustore.apk` for RuStore and direct install.
- AAB (signed): `release/suz-donyasy.aab` (27.2 MB), for Google Play. Use Play App Signing; this key becomes the upload key. The base module limit is 150 MB, so this is fine.
- Package `ru.pirogovlab.suzdonyasy` · **versionCode 1 · versionName 1.0.0** · minSdk 24 (Android 7.0) · targetSdk/compileSdk 36.
- Rebuild with `tools/build_android.sh`. Bump `versionCode`/`versionName` in `android/app/build.gradle` for every store update. The script warns if `ads.xml` has no `R-M-` IDs.
- Signing key: `release/keys/suz-donyasy-release.p12` + `keystore.properties` (passwords, chmod 600).
  - Alias `suzdonyasy`, RSA 4096, valid until 2054.
  - Cert SHA-256 `1D:FB:FE:9A:9E:90:DD:92:83:1E:AA:21:1D:35:3E:25:48:DB:9B:73:50:22:15:AC:C0:8A:9C:76:23:A0:78:8D`.
  - **NEW key, separate from Мут тӱня.** Backup: offline, outside the repo. Also keep an offline copy. If you lose it, you can't ship updates on RuStore or to existing APK installs.
- `release/keys/` must never go to git (it is in .gitignore).

## What the app does
- Java WebView shell plus **Yandex Mobile Ads SDK 8.6.0** (`com.yandex.android:mobileads`, which pulls in AppMetrica and play-services-appset).
  - The game is bundled offline in `assets/www` (no noindex, no test badge) and served from `https://appassets.androidplatform.net/`.
  - It works fully offline; only ads need the network.
- UI is Russian only; the game words are Tatar with Russian clues. The first launch shows an interactive tutorial (replay: Настройки → «Как играть»).
- Back button: closes the tutorial, card or dialog, then goes home, then exits.
- The game has no music. Sounds are WebAudio synth and are muted during ads.
- Share: the word-card PNG goes through the Android share sheet (ContentProvider `ru.pirogovlab.suzdonyasy.share`).
- Permissions: INTERNET, ACCESS_NETWORK_STATE, VIBRATE, `com.google.android.gms.permission.AD_ID`, and the install referrer (from the SDK).

## Ads (Yandex Mobile Ads): ⚠ PLACEHOLDER IDs
- **Config file:** `android/app/src/main/res/values/ads.xml`. Right now `ad_banner_id` / `ad_interstitial_id` / `ad_rewarded_id` = `demo-banner-yandex` / `demo-interstitial-yandex` / `demo-rewarded-yandex`, which are Yandex test ads with no revenue.
- Placements (same as Мут тӱня):
  - sticky banner below the WebView, only after the tutorial;
  - interstitial every 3rd level, at least 150 s apart;
  - rewarded: hint letter, ×2 coins, extra wheel spin (up to 3 per day).
- Logcat tag `SuzDonyasyAds`.
- **Steps:**
  1. In partner.yandex.ru → Приложения → add the app «Сүз дөньясы» (Android, `ru.pirogovlab.suzdonyasy`). Create 3 units: banner (adaptive sticky), interstitial, rewarded (reward «1 Подсказка»).
  2. Put the `R-M-<appId>-1/-2/-3` IDs into `ads.xml`, bump the version, run `tools/build_android.sh`, and run `cd test && node test_android_www.js`.
  3. Publish in RuStore / Google Play. In partner.yandex.ru, add the store link (moderation takes up to about 2 days).
  4. `https://pirogovlab.ru/app-ads.txt` is already live (account file, `yandex.com, 1969132, DIRECT`). It works if the app is in the same partner account. Put `https://pirogovlab.ru` as the developer website in the listing.
- Children: `ads_age_restricted=false` (0+, not directed at children). In Play Console → Target audience, choose 13+.

## Tests
- `cd test && node test_android_www.js`: ALL PASS. It checks the bundled html (no noindex), adapter, links and that no music is bundled.
- Emulator, 19.10.2026: AVD android-35 x86_64 with no KVM (`-accel off`). `adb install` gave Success and the app process started.
  - The Ads SDK initialised: logcat `SuzDonyasyAds: ad units real: demo-…`. Ad requests ended in `network error` because the emulator has no network.
  - The WebView renderer crashed with SIGTRAP under software CPU emulation, so the screen stayed black (`release/test_shots/emu_launch*.png`). This is a limitation of the box (no hardware acceleration), not of the APK.
  - **Check on a real phone** before release: the game, banner, interstitial and rewarded.

## Store listings: what you need to do
1. **RuStore** (console.rustore.ru):
   - App «Сүз дөньясы», category Игры → Головоломки/Слова, 0+.
   - APK `suz-donyasy-rustore.apk`.
   - Texts: `release/store/TEXTS_ru.md`.
   - Graphics: `release/rustore_assets/` (icon_512, banner_1920x1080, mobile_1…6).
2. **Google Play:**
   - AAB `suz-donyasy.aab`, Play App Signing.
   - Graphics: `release/play_assets/` (play_icon_512.png, feature_graphic_1024x500.png, screenshots/phone_1…7 1080×1920).
   - Declare "Contains ads" and "Advertising ID". Fill in **Data safety**: device IDs, app interactions and diagnostics, shared with Yandex for advertising.
   - Target audience 13+.
   - New personal account: closed test with 12+ testers for 14 days before production.
3. **Privacy policy:** https://pirogovlab.ru/suz-donyasy/privacy/
   - ⚠ The live page says "no ads". Before publishing the ad version, upload `release/privacy_with_ads/index.html` there (with the edition date set) instead of the current page.
4. The privacy page and test version have noindex. That is fine for the stores, since the URL just has to open.
