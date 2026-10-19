import { buildButtonFromRow, styleWords } from '../../scripts/buttons.js';
import { labelBareVideoLink, toVideoDialogButton } from '../../scripts/video.js';

/**
 * loads and decorates the buttons block: one row per button (a link cell and an optional style
 * cell); the block options set the default style for every row. Option video dialog: every button
 * opens its link in the video popup (a bare video address is labelled "Watch Video").
 * @param {Element} block The buttons block element
 */
export default function decorate(block) {
  const defaults = styleWords([...block.classList].join(' '));
  const videoDialog = block.classList.contains('video-dialog');
  const buttons = [...block.children]
    .map((row) => {
      if (!videoDialog) return buildButtonFromRow(row, defaults);
      labelBareVideoLink(row.querySelector('a[href]'));
      const button = buildButtonFromRow(row, defaults);
      toVideoDialogButton(button);
      return button;
    })
    .filter(Boolean);
  block.replaceChildren(...buttons);
}
