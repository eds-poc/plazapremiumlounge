/* eslint-disable */
/* global WebImporter */

/**
 * Parser for the branding-card block.
 * Source: https://www.plazapremiumlounge.com/en-uk/your-destination-before-departure
 * Selector: section.branding .grid-wrapper
 * Model: one row per card (.gridBox): the photo | the title (h3), the text, then each button
 * link in bold on its own line ("Discover More", "Watch Video"). The source repeats the title
 * (.gridTitle and .textWrap); it is authored once.
 */
export default function parse(element, { document }) {
  const cards = Array.from(element.querySelectorAll(':scope > .gridBox'));
  const cells = [];

  cards.forEach((card) => {
    // the photo (the source's script shows it as the card background)
    const imageCell = [];
    const sourceImg = card.querySelector(':scope > img, img');
    if (sourceImg && sourceImg.getAttribute('src')) {
      const img = document.createElement('img');
      img.src = sourceImg.getAttribute('src');
      img.alt = sourceImg.getAttribute('alt') || '';
      imageCell.push(img);
    }

    const textCell = [];
    const heading = card.querySelector('.textWrap h3, .gridTitle h3, h3');
    if (heading && heading.textContent.trim()) {
      const h3 = document.createElement('h3');
      h3.textContent = heading.textContent.trim();
      textCell.push(h3);
    }

    // the text; a blank line (<br>&nbsp;<br>) inside a paragraph starts a new paragraph
    card.querySelectorAll('.textWrap p').forEach((p) => {
      p.innerHTML.split(/<br\s*\/?>\s*(?:&nbsp;| )?\s*<br\s*\/?>/i).forEach((part) => {
        const para = document.createElement('p');
        para.innerHTML = part.trim();
        if (para.textContent.trim()) textCell.push(para);
      });
    });

    // the buttons, in bold (the site's button formatting), without the source's icon
    card.querySelectorAll('.btn-wrapper a[href]').forEach((a) => {
      const label = a.textContent.replace(/\s+/g, ' ').trim();
      if (!label) return;
      const link = document.createElement('a');
      link.href = a.getAttribute('href');
      link.textContent = label;
      const strong = document.createElement('strong');
      strong.append(link);
      const p = document.createElement('p');
      p.append(strong);
      textCell.push(p);
    });

    if (imageCell.length || textCell.length) cells.push([imageCell, textCell]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'Branding Card', cells });
  element.replaceWith(block);
}
