# The cookie consent banner

The source's cookie banner: along the bottom of every page until the visitor clicks **I agree**.

## How it works

- `scripts/cookie-consent.js` is loaded with the footer (`scripts/scripts.js`, lazy phase); the look
  is `styles/cookie-consent.css`.
- No banner when the cookie `CMSCookieLevel=1000` is there: the source's consent cookie (Kentico's
  "all cookies" level), so a visitor who agreed on the source isn't asked again.
- Otherwise the banner shows the language site's `/<site>/cookie-consent` page. **I agree** sets the
  cookie for 365 days for the whole site (path `/`, SameSite Lax, Secure) and removes the banner.
- Once the cookie expires or is removed, the banner shows again. To test, delete the
  `CMSCookieLevel` cookie (browser developer tools › Application › Cookies).

## The content

One page per language site in Document Authoring: `/en-uk/cookie-consent`, `/zh-cn/cookie-consent`,
`/zh-hk/cookie-consent`, `/ja-jp/cookie-consent`, `/pt-br/cookie-consent`.

```
## Cookie consent
In order to enable certain services or features and to improve your website experience, …
By continuing to use our website, you agree … in accordance with our Privacy Policy.
**I agree**
```

- **The heading:** the banner's name for screen readers (not shown).
- **The paragraphs:** the text; links open in a new tab, as the source's.
- **The last line, in bold:** the button's label.

After editing a page, preview it (and publish it for the live site). A site without its page shows
no banner.
