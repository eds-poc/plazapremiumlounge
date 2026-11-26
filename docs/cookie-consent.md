# The cookie consent banner

The source's cookie banner: along the bottom of every page until the visitor clicks **I agree**.

## How it works

- `scripts/cookie-consent.js` is loaded with the footer (`scripts/scripts.js`, lazy phase). Its
  look is at the end of `blocks/header/header.css`: the header loads on every page, so the banner
  needs no stylesheet of its own.
- No banner when the cookie `CMSCookieLevel=1000` is there: the source's consent cookie (Kentico's
  "all cookies" level), so a visitor who agreed on the source isn't asked again.
- Otherwise the banner shows the locale's fragment (below). **I agree** sets the cookie for 365
  days for the whole site (path `/`, SameSite Lax, Secure) and removes the banner.
- Once the cookie expires or is removed, the banner shows again. To test, delete the
  `CMSCookieLevel` cookie (browser developer tools › Application › Cookies).

## The content: one fragment per locale

Authored in Document Authoring, in the shared folder `/fragments/cookie-consent/`:

| Site | Fragment |
|---|---|
| English | `/fragments/cookie-consent/en-uk` |
| 简体中文 | `/fragments/cookie-consent/zh-cn` |
| 繁體中文 | `/fragments/cookie-consent/zh-hk` |
| 日本語 | `/fragments/cookie-consent/ja-jp` |
| Português | `/fragments/cookie-consent/pt-br` |

A page uses its language site's fragment (`/zh-cn/…` pages use `zh-cn`); pages outside a language
site use `en-uk`. A locale without its fragment shows no banner.

Each fragment is one **Cookie Consent** table, a row per field:

| Cookie Consent | |
|---|---|
| Title | Cookie consent |
| Message | In order to enable certain services … your Personal Data.<br>By continuing to use our website, … in accordance with our {link}. |
| Privacy Link Text | Privacy Policy |
| Privacy Link URL | /en-uk/data-privacy-and-security-policy |
| Button Label | I agree |

- **Title:** the banner's name for screen readers; not shown, as the source's banner has no title.
- **Message:** the text, one or more paragraphs. `{link}` marks where the privacy link goes, so
  it fits each language's word order; without `{link}`, the link goes at the end.
- **Privacy Link Text** and **Privacy Link URL:** the link's words and address (a link or plain
  text). It opens in a new tab, as the source's.
- **Button Label:** the button's text ("I agree" when left empty).

After editing a fragment, preview it (and publish it for the live site).
