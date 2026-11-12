/*
 * Regions: the booking system's region codes and their names in each site language, as the nav's
 * Locations menu names them. Data, kept apart from the interface texts (scripts/i18n.js), so it
 * can move to a JSON file later.
 */
import { DEFAULT_LANGUAGE, getLanguage } from './i18n.js';

const REGIONS = [
  {
    code: 'CH',
    names: {
      en: 'Chinese Mainland, Hong Kong, Macau and Taiwan regions', zh: '中国内地 -港澳及台地区', 'zh-HK': '中國內地 - 港澳及台地區', ja: '中国本土、香港、マカオおよび台湾地区', pt: 'China – Regiões do Continente, Hong Kong, Macau e Taiwan',
    },
  },
  {
    code: 'AS',
    names: {
      en: 'Americas', zh: '美洲', 'zh-HK': '美洲', ja: 'アメリカ大陸', pt: 'Américas',
    },
  },
  {
    code: 'EP',
    names: {
      en: 'Europe', zh: '欧洲', 'zh-HK': '歐洲', ja: 'ヨーロッパ', pt: 'Europa',
    },
  },
  {
    code: 'AP',
    names: {
      en: 'Asia Pacific', zh: '亚太地区', 'zh-HK': '亞太地區', ja: 'アジア太平洋', pt: 'Ásia-Pacífico',
    },
  },
  {
    code: 'IM',
    names: {
      en: 'India/Middle East/Africa', zh: '印度／中东／非洲', 'zh-HK': '印度／中東／非洲', ja: 'インド・中東・アフリカ', pt: 'Índia/Oriente Médio/África',
    },
  },
  {
    // (not in the Locations menu; English in every language until it's translated)
    code: 'OP',
    names: { en: 'Oceania Pacific' },
  },
];

/**
 * A region's name in the page's language, else its base language, else the default language (as
 * scripts/i18n.js translate looks a text up); '' for a code not listed.
 * @param {string} code e.g. 'EP'
 * @returns {string}
 */
export default function regionName(code) {
  const names = REGIONS.find((region) => region.code === code)?.names;
  if (!names) return '';
  const lang = document.documentElement.lang || getLanguage();
  return names[lang] ?? names[lang.split('-')[0]] ?? names[DEFAULT_LANGUAGE] ?? '';
}
