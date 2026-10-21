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
  // video links and the video popup
  watchVideo: {
    en: 'Watch Video', zh: '观看视频', 'zh-HK': '觀看影片', ja: '動画を見る', pt: 'Assistir ao vídeo',
  },
  playVideo: {
    en: 'Play video: {name}', zh: '播放视频：{name}', 'zh-HK': '播放影片：{name}', ja: '動画を再生：{name}', pt: 'Reproduzir vídeo: {name}',
  },
  video: {
    en: 'Video', zh: '视频', 'zh-HK': '影片', ja: '動画', pt: 'Vídeo',
  },
  videoUnavailable: {
    en: 'This video can’t be played here.',
    zh: '此视频无法在此播放。',
    'zh-HK': '此影片無法在此播放。',
    ja: 'この動画はここでは再生できません。',
    pt: 'Este vídeo não pode ser reproduzido aqui.',
  },
  watchOn: {
    en: 'Watch on {provider}',
    zh: '在 {provider} 上观看',
    'zh-HK': '在 {provider} 上觀看',
    ja: '{provider} で見る',
    pt: 'Assistir no {provider}',
  },
  openVideo: {
    en: 'Open the video', zh: '打开视频', 'zh-HK': '開啟影片', ja: '動画を開く', pt: 'Abrir o vídeo',
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
  // custom form (scripts/forms.js): default field messages, each can be replaced in the authoring
  formRequired: {
    en: 'Please fill in {label}.', zh: '请填写{label}。', 'zh-HK': '請填寫{label}。', ja: '{label}を入力してください。', pt: 'Preencha {label}.',
  },
  formRequiredChoice: {
    en: 'Please select {label}.', zh: '请选择{label}。', 'zh-HK': '請選擇{label}。', ja: '{label}を選択してください。', pt: 'Selecione {label}.',
  },
  formRequiredCheck: {
    en: 'Please tick this box to continue.', zh: '请勾选此项以继续。', 'zh-HK': '請剔選此項以繼續。', ja: '続行するにはチェックを入れてください。', pt: 'Marque esta caixa para continuar.',
  },
  formEmail: {
    en: 'Please enter a valid email address.', zh: '请输入有效的电子邮箱地址。', 'zh-HK': '請輸入有效的電郵地址。', ja: '有効なメールアドレスを入力してください。', pt: 'Insira um endereço de e-mail válido.',
  },
  formMatch: {
    en: '{label} does not match.', zh: '{label}不一致。', 'zh-HK': '{label}不一致。', ja: '{label}が一致しません。', pt: '{label} não corresponde.',
  },
  formName: {
    en: 'Only alphabetic characters, apostrophes, and hyphens are allowed.',
    zh: '只能输入字母、撇号和连字符。',
    'zh-HK': '只可輸入字母、撇號及連字號。',
    ja: '使用できるのは英字、アポストロフィ、ハイフンのみです。',
    pt: 'Só são permitidas letras, apóstrofos e hífens.',
  },
  formPassword: {
    en: 'Password must contain at least 1 lower case, 1 upper case, 1 numeric and 8 to 15 length character.',
    zh: '密码须为 8 至 15 个字符，并至少包含 1 个小写字母、1 个大写字母和 1 个数字。',
    'zh-HK': '密碼須為 8 至 15 個字元，並至少包含 1 個小楷字母、1 個大楷字母及 1 個數字。',
    ja: 'パスワードは 8〜15 文字で、小文字・大文字・数字をそれぞれ 1 文字以上含めてください。',
    pt: 'A senha deve ter de 8 a 15 caracteres, com pelo menos 1 letra minúscula, 1 maiúscula e 1 número.',
  },
  formPhone: {
    en: 'Please fill in valid contact number', zh: '请填写有效的联系电话', 'zh-HK': '請填寫有效的聯絡電話', ja: '有効な電話番号を入力してください', pt: 'Preencha um número de contato válido',
  },
  formUrl: {
    en: 'Please enter a valid web address.', zh: '请输入有效的网址。', 'zh-HK': '請輸入有效的網址。', ja: '有効な URL を入力してください。', pt: 'Insira um endereço web válido.',
  },
  formPostcode: {
    en: 'Please enter a valid postcode.', zh: '请输入有效的邮政编码。', 'zh-HK': '請輸入有效的郵政編碼。', ja: '有効な郵便番号を入力してください。', pt: 'Insira um código postal válido.',
  },
  formPattern: {
    en: 'Please check the format of {label}.', zh: '请检查{label}的格式。', 'zh-HK': '請檢查{label}的格式。', ja: '{label}の形式を確認してください。', pt: 'Verifique o formato de {label}.',
  },
  formMinLength: {
    en: 'Please enter at least {n} characters.', zh: '请至少输入 {n} 个字符。', 'zh-HK': '請至少輸入 {n} 個字元。', ja: '{n} 文字以上で入力してください。', pt: 'Insira pelo menos {n} caracteres.',
  },
  formMaxLength: {
    en: 'Please enter no more than {n} characters.', zh: '最多输入 {n} 个字符。', 'zh-HK': '最多輸入 {n} 個字元。', ja: '{n} 文字以内で入力してください。', pt: 'Insira no máximo {n} caracteres.',
  },
  formMin: {
    en: 'Please enter {n} or more.', zh: '请输入不小于 {n} 的值。', 'zh-HK': '請輸入不小於 {n} 的值。', ja: '{n} 以上を入力してください。', pt: 'Insira {n} ou mais.',
  },
  formMax: {
    en: 'Please enter {n} or less.', zh: '请输入不大于 {n} 的值。', 'zh-HK': '請輸入不大於 {n} 的值。', ja: '{n} 以下を入力してください。', pt: 'Insira {n} ou menos.',
  },
  formMinDate: {
    en: 'Please choose {n} or later.', zh: '请选择 {n} 或之后的日期。', 'zh-HK': '請選擇 {n} 或之後的日期。', ja: '{n} 以降の日付を選択してください。', pt: 'Escolha {n} ou depois.',
  },
  formMaxDate: {
    en: 'Please choose {n} or earlier.', zh: '请选择 {n} 或之前的日期。', 'zh-HK': '請選擇 {n} 或之前的日期。', ja: '{n} 以前の日付を選択してください。', pt: 'Escolha {n} ou antes.',
  },
  formMinAge: {
    en: 'You must be at least {n} years old.', zh: '您必须年满 {n} 岁。', 'zh-HK': '您必須年滿 {n} 歲。', ja: '{n} 歳以上である必要があります。', pt: 'Você deve ter pelo menos {n} anos.',
  },
  formMinSelected: {
    en: 'Please choose at least {n}.', zh: '请至少选择 {n} 项。', 'zh-HK': '請至少選擇 {n} 項。', ja: '{n} 件以上選択してください。', pt: 'Escolha pelo menos {n}.',
  },
  formSummary: {
    en: 'Please check the {n} highlighted fields.', zh: '请检查标出的 {n} 个字段。', 'zh-HK': '請檢查標示的 {n} 個欄位。', ja: '強調表示された {n} 件の項目を確認してください。', pt: 'Verifique os {n} campos destacados.',
  },
  formLoading: {
    en: 'Loading…', zh: '加载中…', 'zh-HK': '載入中…', ja: '読み込み中…', pt: 'Carregando…',
  },
  formLoadError: {
    en: 'We couldn’t load this list.', zh: '无法加载此列表。', 'zh-HK': '無法載入此清單。', ja: 'リストを読み込めませんでした。', pt: 'Não foi possível carregar esta lista.',
  },
  formRetry: {
    en: 'Try again', zh: '重试', 'zh-HK': '重試', ja: '再試行', pt: 'Tentar novamente',
  },
  formPhoneCode: {
    en: 'Country code', zh: '国家/地区代码', 'zh-HK': '國家/地區代碼', ja: '国番号', pt: 'Código do país',
  },
  formShowPassword: {
    en: 'Show password', zh: '显示密码', 'zh-HK': '顯示密碼', ja: 'パスワードを表示', pt: 'Mostrar senha',
  },
  formHidePassword: {
    en: 'Hide password', zh: '隐藏密码', 'zh-HK': '隱藏密碼', ja: 'パスワードを隠す', pt: 'Ocultar senha',
  },
  formSending: {
    en: 'Sending…', zh: '提交中…', 'zh-HK': '提交中…', ja: '送信中…', pt: 'Enviando…',
  },
  formError: {
    en: 'Something went wrong. Please try again.', zh: '出现问题，请重试。', 'zh-HK': '出現問題，請重試。', ja: '問題が発生しました。もう一度お試しください。', pt: 'Algo deu errado. Tente novamente.',
  },
  formNetworkError: {
    en: 'We couldn’t reach the server. Please check your connection and try again.',
    zh: '无法连接服务器，请检查网络后重试。',
    'zh-HK': '無法連接伺服器，請檢查網絡後重試。',
    ja: 'サーバーに接続できませんでした。接続を確認して、もう一度お試しください。',
    pt: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
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
