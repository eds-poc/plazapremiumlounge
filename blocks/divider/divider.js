/**
 * loads and decorates the divider: a horizontal line between sections, as the live site's hr.
 * The block's content (if any) is ignored, so an empty table is all an author needs.
 * @param {Element} block The divider block element
 */
export default function decorate(block) {
  const line = document.createElement('hr');
  line.className = 'divider-line';
  block.replaceChildren(line);
}
