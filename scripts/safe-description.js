/*
 * API HTML (an add-on's description, a product's terms) as safe content, shared by the booking
 * blocks (Edit Booking, Checkout).
 */
import { safeHtml } from './properties.js';

/**
 * API HTML as safe content: paragraphs, lists, bold and italic, and links to web pages only
 * (opening in a new tab).
 * @param {string} html
 * @returns {DocumentFragment}
 */
export default function safeDescription(html) {
  // scripts, styles and frames dropped with their text (the rest keeps only its text)
  const source = new DOMParser().parseFromString(html || '', 'text/html').body;
  source.querySelectorAll('script, style, template, noscript, iframe, object').forEach((n) => n.remove());
  const content = safeHtml(source.innerHTML, { blocks: true });
  content.querySelectorAll('a').forEach((a) => {
    let url;
    try {
      url = new URL(a.getAttribute('href') || '', window.location.href);
    } catch {
      url = null;
    }
    if (!url || !/^https?:$/.test(url.protocol)) {
      a.replaceWith(...a.childNodes);
      return;
    }
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
  return content;
}
