/*
 * Page language and the few interface texts the scripts add (for screen readers).
 * The language is the page metadata `language` (e.g. zh-CN) when set, else it comes from the
 * page's site folder (/zh-cn/… → zh-CN, /en-uk/… → en-GB, as the source's sites), else English.
 */
import { getMetadata } from './aem.js';

// the source's language sites (folder → language tag)
const SITES = {
  'en-uk': 'en-GB',
  'zh-cn': 'zh-CN',
  'zh-hk': 'zh-HK',
  'ja-jp': 'ja-JP',
  'pt-br': 'pt-BR',
};
const DEFAULT_LANGUAGE = 'en';

// texts by language tag, or by its base language (zh-HK, then zh, then en)
const TEXTS = {
  opensInNewTab: {
    en: ' (opens in a new tab)',
    zh: '（在新标签页中打开）',
    'zh-HK': '（在新分頁中開啟）',
    ja: '（新しいタブで開きます）',
    pt: ' (abre em uma nova guia)',
  },
};

/**
 * The language of the current page, as a language tag (e.g. zh-CN).
 * @returns {string}
 */
export function getLanguage() {
  const authored = getMetadata('language').trim();
  if (authored) return authored;
  const folder = window.location.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return SITES[folder] || DEFAULT_LANGUAGE;
}

/**
 * An interface text in the page's language (falls back to its base language, then English).
 * @param {string} key e.g. `opensInNewTab`
 * @returns {string}
 */
export function translate(key) {
  const texts = TEXTS[key];
  if (!texts) return '';
  const lang = document.documentElement.lang || getLanguage();
  const base = lang.split('-')[0];
  return texts[lang] ?? texts[base] ?? texts[DEFAULT_LANGUAGE];
}
