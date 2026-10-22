/* Веб-реклама РСЯ (Yandex.RTB) только для обычного браузера: https://pirogovlab.ru/suz-donyasy/
 * Вставьте ID блоков из кабинета РСЯ (вид 'R-A-XXXXXXXX-N'). Пустая строка = блок выключен.
 * Не действует в Android WebView (там нативный SDK, ads.xml) и в сборке Яндекс Игр (там только их SDK);
 * tools/build_release.py не кладёт этот файл и js/adapters/web.js в эти сборки. */
window.SUZ_WEB_ADS = {
  banner: '',      // Floor Ad (type: 'floorAd') — липкий баннер внизу; игра сжимается, колесо не перекрывается
  fullscreen: '',  // Fullscreen (type: 'fullscreen') — между уровнями и для «Подсказка ×1» (в вебе нет rewarded)
};
