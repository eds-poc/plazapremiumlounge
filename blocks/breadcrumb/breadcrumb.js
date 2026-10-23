export default function decorate(block) {
  const items = [...block.querySelectorAll('p')];

  const ol = document.createElement('ol');
  ol.className = 'breadcrumb-list';

  items.forEach((item, index) => {
    const li = document.createElement('li');
    const isLast = index === items.length - 1;

    const link = item.querySelector('a');

    if (link && !isLast) {
      li.append(link.cloneNode(true));
    } else {
      li.textContent = item.textContent.trim();

      if (isLast) {
        li.setAttribute('aria-current', 'page');
      }
    }

    ol.append(li);
  });

  block.replaceChildren(ol);
}
