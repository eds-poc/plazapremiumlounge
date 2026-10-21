/* eslint-disable */
/* global WebImporter */

/**
 * Transformer for the sign up confirmation page (/en-uk/sign-up-successful-page).
 * beforeTransform: keeps only the thank-you card (section.thank-you-section) as default content:
 * the H1, the confirmation line, the bold "Verification Email Sent" line and its text, and the
 * Back to Home link in bold, so the site makes it its primary button (the source's btn-primary).
 * The empty icon placeholder, the newsletter band and the page chrome are left out.
 * afterTransform: the page metadata.
 */
export default function transform(hookName, element, payload) {
  const { document } = payload;

  if (hookName === 'beforeTransform') {
    const card = element.querySelector('section.thank-you-section .thank-you-card');
    if (!card) return;
    const nodes = [];
    const h1 = card.querySelector('h1');
    if (h1) {
      const heading = document.createElement('h1');
      heading.textContent = h1.textContent.trim();
      nodes.push(heading);
    }
    card.querySelectorAll('p.thank-you-message, .verification-info-box p').forEach((p) => {
      if (!p.textContent.trim()) return;
      const para = document.createElement('p');
      const strong = p.querySelector(':scope > strong');
      if (strong && strong.textContent.trim() === p.textContent.trim()) {
        para.append(Object.assign(document.createElement('strong'), { textContent: strong.textContent.trim() }));
      } else {
        para.textContent = p.textContent.trim();
      }
      nodes.push(para);
    });
    card.querySelectorAll('.action-buttons-group a[href]').forEach((a) => {
      const link = document.createElement('a');
      link.href = a.getAttribute('href');
      link.textContent = a.textContent.trim();
      const strong = document.createElement('strong');
      strong.append(link);
      const para = document.createElement('p');
      para.append(strong);
      nodes.push(para);
    });
    element.replaceChildren(...nodes);
    return;
  }

  if (hookName !== 'afterTransform') return;
  const metadata = WebImporter.Blocks.createBlock(document, {
    name: 'Metadata',
    cells: {
      Title: 'Sign Up Successful Page | Plaza Premium Lounge',
      Description: 'Sign Up Successful Page',
    },
  });
  element.append(metadata);
}
