/*
 * Language sites: the page language, the few interface texts the scripts add (screen-reader
 * labels such as Open menu or Close), and the language-specific shared pages (nav, footer).
 * The language is the page metadata `language` (e.g. zh-CN) when set, else it comes from the
 * page's site folder (/zh-cn/… → zh-CN, /en-uk/… → en-GB, as the source's sites), else English.
 * Each site folder has its own nav, footer and modals (/zh-cn/nav, /zh-cn/modals/login …);
 * pages outside a site folder use the default site, en-uk.
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
export const DEFAULT_SITE = 'en-uk';

// texts by language tag, or by its base language (zh-HK, then zh, then en)
const TEXTS = {
  opensInNewTab: {
    en: ' (opens in a new tab)',
    zh: '（在新标签页中打开）',
    'zh-HK': '（在新分頁中開啟）',
    ja: '（新しいタブで開きます）',
    pt: ' (abre em uma nova guia)',
  },
  // header and modal controls
  back: {
    en: 'Back', zh: '返回', 'zh-HK': '返回', ja: '戻る', pt: 'Voltar',
  },
  close: {
    en: 'Close', zh: '关闭', 'zh-HK': '關閉', ja: '閉じる', pt: 'Fechar',
  },
  openMenu: {
    en: 'Open menu', zh: '打开菜单', 'zh-HK': '開啟選單', ja: 'メニューを開く', pt: 'Abrir menu',
  },
  closeMenu: {
    en: 'Close menu', zh: '关闭菜单', 'zh-HK': '關閉選單', ja: 'メニューを閉じる', pt: 'Fechar menu',
  },
  mainNav: {
    en: 'Main', zh: '主要', 'zh-HK': '主要', ja: 'メイン', pt: 'Principal',
  },
  home: {
    en: 'Home', zh: '首页', 'zh-HK': '首頁', ja: 'ホーム', pt: 'Início',
  },
  account: {
    en: '{name}, account', zh: '{name}，账户', 'zh-HK': '{name}，帳戶', ja: '{name}、アカウント', pt: '{name}, conta',
  },
  accountTitle: {
    en: 'Account', zh: '账户', 'zh-HK': '帳戶', ja: 'アカウント', pt: 'Conta',
  },
  backToTop: {
    en: 'Back to top', zh: '返回顶部', 'zh-HK': '返回頂部', ja: 'ページの先頭へ戻る', pt: 'Voltar ao topo',
  },
  // lounge badges in the menu (icon name in camel case)
  railwayLounge: {
    en: 'Railway lounge', zh: '铁路贵宾室', 'zh-HK': '鐵路貴賓室', ja: '鉄道ラウンジ', pt: 'Lounge ferroviário',
  },
  airportDining: {
    en: 'Airport dining', zh: '机场餐饮', 'zh-HK': '機場餐飲', ja: '空港ダイニング', pt: 'Restaurantes do aeroporto',
  },
  // property list (city lounge listing)
  propertyFilters: {
    en: 'Filters', zh: '筛选', 'zh-HK': '篩選', ja: '絞り込み', pt: 'Filtros',
  },
  propertyAll: {
    en: 'All', zh: '全部', 'zh-HK': '全部', ja: 'すべて', pt: 'Todos',
  },
  propertyClear: {
    en: 'Clear', zh: '清除', 'zh-HK': '清除', ja: 'クリア', pt: 'Limpar',
  },
  propertyAirport: {
    en: 'Airport / Rail Station', zh: '机场 / 火车站', 'zh-HK': '機場 / 鐵路站', ja: '空港 / 駅', pt: 'Aeroporto / Estação ferroviária',
  },
  propertyService: {
    en: 'Service Type', zh: '服务类型', 'zh-HK': '服務類型', ja: 'サービスの種類', pt: 'Tipo de serviço',
  },
  propertyFeatures: {
    en: 'Features', zh: '设施', 'zh-HK': '設施', ja: '設備', pt: 'Comodidades',
  },
  propertyFrom: {
    en: 'from', zh: '起', 'zh-HK': '起', ja: '〜', pt: 'a partir de',
  },
  propertyView: {
    en: 'View', zh: '查看', 'zh-HK': '查看', ja: '詳細', pt: 'Ver',
  },
  propertyMore: {
    en: '+{n} more', zh: '+{n} 项', 'zh-HK': '+{n} 項', ja: '他 {n} 件', pt: '+{n} mais',
  },
  propertyOtherFeatures: {
    en: 'Other Features', zh: '其他设施', 'zh-HK': '其他設施', ja: 'その他の設備', pt: 'Outras comodidades',
  },
  propertyResults: {
    en: '{n} results', zh: '{n} 个结果', 'zh-HK': '{n} 個結果', ja: '{n} 件', pt: '{n} resultados',
  },
  propertyEmpty: {
    en: 'No lounges found.', zh: '未找到贵宾室。', 'zh-HK': '找不到貴賓室。', ja: 'ラウンジが見つかりません。', pt: 'Nenhum lounge encontrado.',
  },
  propertyNoMatch: {
    en: 'No lounges match these filters.', zh: '没有符合筛选条件的贵宾室。', 'zh-HK': '沒有符合篩選條件的貴賓室。', ja: '条件に合うラウンジはありません。', pt: 'Nenhum lounge corresponde a estes filtros.',
  },
  propertyError: {
    en: 'We couldn’t load the lounges.', zh: '无法加载贵宾室。', 'zh-HK': '無法載入貴賓室。', ja: 'ラウンジを読み込めませんでした。', pt: 'Não foi possível carregar os lounges.',
  },
  propertyRetry: {
    en: 'Try again', zh: '重试', 'zh-HK': '重試', ja: '再試行', pt: 'Tentar novamente',
  },
  propertyPrevious: {
    en: 'Previous photo', zh: '上一张照片', 'zh-HK': '上一張相片', ja: '前の写真', pt: 'Foto anterior',
  },
  propertyNext: {
    en: 'Next photo', zh: '下一张照片', 'zh-HK': '下一張相片', ja: '次の写真', pt: 'Próxima foto',
  },
  propertyPhoto: {
    en: 'Photo {n} of {total}', zh: '第 {n} 张，共 {total} 张', 'zh-HK': '第 {n} 張，共 {total} 張', ja: '写真 {n} / {total}', pt: 'Foto {n} de {total}',
  },
  propertyDeparture: {
    en: 'Departures Lounge', zh: '出发贵宾室', 'zh-HK': '離境貴賓室', ja: '出発ラウンジ', pt: 'Lounge de embarque',
  },
  propertyDepartureTip: {
    en: 'Located after security & immigration — you’ll need your boarding pass to enter.',
    zh: '位于安检和出境检查之后，需凭登机牌进入。',
    'zh-HK': '位於保安及出境檢查之後，須憑登機證進入。',
    ja: '保安検査・出国審査の後にあります。ご入場には搭乗券が必要です。',
    pt: 'Fica após a segurança e a imigração — você precisará do cartão de embarque para entrar.',
  },
  propertyArrival: {
    en: 'Arrivals Lounge', zh: '到达贵宾室', 'zh-HK': '抵港貴賓室', ja: '到着ラウンジ', pt: 'Lounge de desembarque',
  },
  propertyArrivalTip: {
    en: 'Located in the arrivals area.', zh: '位于到达区。', 'zh-HK': '位於抵港區。', ja: '到着エリアにあります。', pt: 'Fica na área de desembarque.',
  },
};

/**
 * The language site folder of the current page (e.g. `zh-cn`), or '' outside a site folder.
 * @returns {string}
 */
export function getSiteFolder() {
  const folder = window.location.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return folder in SITES ? folder : '';
}

/**
 * The path of a shared page (`nav`, `footer`) for the current page: its metadata of that name
 * (set per site in the bulk metadata sheet, or on the page), else the one in the page's site
 * folder, else the default site's (/en-uk/nav).
 * @param {string} name `nav` or `footer`
 * @returns {string}
 */
export function getSharedPagePath(name) {
  const authored = getMetadata(name);
  if (authored) return new URL(authored, window.location).pathname;
  return `/${getSiteFolder() || DEFAULT_SITE}/${name}`;
}

/**
 * The default site's shared page (/en-uk/nav), used when a site has none yet.
 * @param {string} name `nav` or `footer`
 * @returns {string}
 */
export function getDefaultSharedPagePath(name) {
  return `/${DEFAULT_SITE}/${name}`;
}

/**
 * The language of the current page, as a language tag (e.g. zh-CN).
 * @returns {string}
 */
export function getLanguage() {
  const authored = getMetadata('language').trim();
  if (authored) return authored;
  return SITES[getSiteFolder()] || DEFAULT_LANGUAGE;
}

/**
 * An interface text in the page's language (falls back to its base language, then English), with
 * its `{placeholders}` filled in.
 * @param {string} key e.g. `opensInNewTab`
 * @param {Object<string, string>} [values] e.g. `{ name: 'Kunal Jaiswal' }` for `{name}`
 * @returns {string} '' for an unknown key
 */
export function translate(key, values = {}) {
  const texts = TEXTS[key];
  if (!texts) return '';
  const lang = document.documentElement.lang || getLanguage();
  const base = lang.split('-')[0];
  const text = texts[lang] ?? texts[base] ?? texts[DEFAULT_LANGUAGE];
  return text.replace(/\{(\w+)\}/g, (all, name) => values[name] ?? all);
}
