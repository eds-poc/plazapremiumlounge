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
    en: 'All', zh: '全部', 'zh-HK': '全部', ja: 'すべて', pt: 'Todo',
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
  // property detail (one lounge); the wording is the source detail pages' in each language
  propertyLounges: {
    en: 'Lounges', zh: '贵宾室', 'zh-HK': '貴賓室', ja: 'すべてのラウンジ', pt: 'Lounges',
  },
  propertyLoungeIn: {
    en: 'Lounge in {city}', zh: '{city}机场贵宾室', 'zh-HK': '{city}機場貴賓室', ja: '{city}のラウンジ', pt: 'Sala VIP em {city}',
  },
  propertyBookVisit: {
    en: 'Book your visit', zh: '预订您的行程', 'zh-HK': '預訂您的行程', ja: '予約する', pt: 'Reserve sua visita',
  },
  propertyBookVisitButton: {
    en: 'Book Your Visit', zh: '预订您的行程', 'zh-HK': '預訂您的行程', ja: '予約する', pt: 'Reserve sua visita',
  },
  propertyDate: {
    en: 'Date', zh: '日期', 'zh-HK': '日期', ja: '日付', pt: 'Data',
  },
  propertyTime: {
    en: 'Time', zh: '时间', 'zh-HK': '時間', ja: '時間', pt: 'Hora',
  },
  propertyHours: {
    en: 'hrs', zh: 'hrs', 'zh-HK': 'hrs', ja: 'hrs', pt: 'hrs',
  },
  propertyAdults: {
    en: 'Adult(s)', zh: '成人', 'zh-HK': '成人', ja: '大人', pt: 'Adulto(s)',
  },
  propertyChildren: {
    en: 'Child(ren)', zh: '儿童', 'zh-HK': '兒童', ja: '子供', pt: 'Criança(s)',
  },
  propertyChildNote: {
    en: 'Complimentary for under 2 years old', zh: '2 岁以下免费', 'zh-HK': '2 歲以下免費', ja: '2歳未満は無料', pt: 'Gratuito para menores de 2 anos',
  },
  propertyFewer: {
    en: 'Fewer {group}', zh: '减少{group}', 'zh-HK': '減少{group}', ja: '{group}を減らす', pt: 'Menos {group}',
  },
  propertyMoreOf: {
    en: 'More {group}', zh: '增加{group}', 'zh-HK': '增加{group}', ja: '{group}を増やす', pt: 'Mais {group}',
  },
  propertyServices: {
    en: 'Services', zh: '服务', 'zh-HK': '服務', ja: 'サービス', pt: 'Serviços',
  },
  propertyServiceDetails: {
    en: 'Service Details', zh: '服务详情', 'zh-HK': '服務詳情', ja: 'サービス詳細', pt: 'Detalhes do Serviço',
  },
  propertyPromo: {
    en: 'Promo Code', zh: '促销代码', 'zh-HK': '促銷代碼', ja: 'プロモーションコード', pt: 'Código Promocional',
  },
  propertyPromoPlaceholder: {
    en: 'Enter Code', zh: '输入代码', 'zh-HK': '輸入代碼', ja: 'コードを入力', pt: 'Digite o Código',
  },
  propertyGetPrice: {
    en: 'Get Price', zh: '获取价格', 'zh-HK': '獲取價格', ja: '料金を確認', pt: 'Obter Preço',
  },
  propertyNoServices: {
    en: 'Online booking isn’t available for this lounge.', zh: '此贵宾室暂不提供网上预订。', 'zh-HK': '此貴賓室暫不提供網上預訂。', ja: 'このラウンジはオンライン予約をご利用いただけません。', pt: 'A reserva online não está disponível para este lounge.',
  },
  propertyLoading: {
    en: 'Loading…', zh: '加载中…', 'zh-HK': '載入中…', ja: '読み込み中…', pt: 'Carregando…',
  },
  propertySubtotal: {
    en: 'Subtotal', zh: '小计', 'zh-HK': '小計', ja: '小計', pt: 'Subtotal',
  },
  propertyReserveNow: {
    en: 'Reserve Now', zh: '立即预约', 'zh-HK': '立即預約', ja: '今すぐ予約', pt: 'Reserve Agora',
  },
  propertyPriceUnavailable: {
    en: 'This option isn’t available at the selected time.', zh: '所选时间无法提供此选项。', 'zh-HK': '所選時間無法提供此選項。', ja: '選択した時間にはこのオプションをご利用いただけません。', pt: 'Esta opção não está disponível no horário selecionado.',
  },
  propertyPromoRejected: {
    en: 'This promo code isn’t valid.', zh: '此促销代码无效。', 'zh-HK': '此促銷代碼無效。', ja: 'このプロモーションコードは無効です。', pt: 'Este código promocional não é válido.',
  },
  propertyPriceError: {
    en: 'We couldn’t get the price. Please try again.', zh: '无法获取价格，请重试。', 'zh-HK': '無法獲取價格，請重試。', ja: '料金を取得できませんでした。もう一度お試しください。', pt: 'Não foi possível obter o preço. Tente novamente.',
  },
  propertyServicesError: {
    en: 'We couldn’t load the services.', zh: '无法加载服务。', 'zh-HK': '無法載入服務。', ja: 'サービスを読み込めませんでした。', pt: 'Não foi possível carregar os serviços.',
  },
  propertyPanelLounge: {
    en: 'The Lounge', zh: '贵宾室', 'zh-HK': '貴賓室', ja: 'ラウンジ', pt: 'O Lounge',
  },
  propertyPanelFeatures: {
    en: 'Lounge Features', zh: '贵宾室特色', 'zh-HK': '貴賓室特色', ja: 'ラウンジの特徴', pt: 'Comodidades de lounge',
  },
  propertyPanelServices: {
    en: 'Available Services', zh: '服务', 'zh-HK': '服務', ja: '利用可能なサービス', pt: 'Serviços Disponíveis',
  },
  propertyPanelDetails: {
    en: 'Details', zh: '详情', 'zh-HK': '詳情', ja: '詳細', pt: 'Detalhes',
  },
  propertyLocation: {
    en: 'Location', zh: '位置', 'zh-HK': '位置', ja: '場所', pt: 'Localização',
  },
  propertyContact: {
    en: 'Contact', zh: '联络', 'zh-HK': '聯絡', ja: '連絡先', pt: 'Contato',
  },
  propertyPhone: {
    en: 'Phone', zh: '电话', 'zh-HK': '電話', ja: '電話番号', pt: 'Telefone',
  },
  propertyPriceFrom: {
    en: 'from', zh: '自', 'zh-HK': '自', ja: 'から', pt: 'de',
  },
  propertyNotFound: {
    en: 'This lounge isn’t available.', zh: '此贵宾室暂不可用。', 'zh-HK': '此貴賓室暫不可用。', ja: 'このラウンジはご利用いただけません。', pt: 'Este lounge não está disponível.',
  },
  propertyDetailError: {
    en: 'We couldn’t load this lounge.', zh: '无法加载此贵宾室。', 'zh-HK': '無法載入此貴賓室。', ja: 'このラウンジを読み込めませんでした。', pt: 'Não foi possível carregar este lounge.',
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
