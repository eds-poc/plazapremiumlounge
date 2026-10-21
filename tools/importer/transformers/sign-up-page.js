/* eslint-disable */
/* global WebImporter */

/**
 * Transformer for the sign up page (/en-uk/sign-up).
 * beforeTransform: keeps only the page title (h2.title.text-lg "Sign Up") and the sign up form
 * (#formBookingRegistration, parsed into a Custom Form block); the Smart Traveller benefits panel,
 * the newsletter band and the page chrome are left out.
 * afterTransform: the title becomes a Title (text-lg) block with the page's H1, and the page gets
 * its metadata.
 */
export default function transform(hookName, element, payload) {
  const { document } = payload;

  if (hookName === 'beforeTransform') {
    const heading = element.querySelector('section.news .title-wrapper h2, h2.title');
    const form = element.querySelector('#formBookingRegistration');
    if (!form) return;
    const h1 = document.createElement('h1');
    h1.textContent = (heading?.textContent || 'Sign Up').trim();
    element.replaceChildren(h1, form);
    return;
  }

  if (hookName !== 'afterTransform') return;
  const h1 = element.querySelector('h1');
  if (h1) {
    const title = WebImporter.Blocks.createBlock(document, { name: 'Title (text-lg)', cells: [[h1.cloneNode(true)]] });
    h1.replaceWith(title);
  }
  const metadata = WebImporter.Blocks.createBlock(document, {
    name: 'Metadata',
    cells: {
      Title: 'Sign Up | Plaza Premium Lounge',
      Description: 'Join Smart Traveller, Plaza Premium Group’s global airport rewards programme.',
    },
  });
  element.append(metadata);
}
