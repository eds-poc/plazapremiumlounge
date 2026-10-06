# Media Slider: authoring guide

A text panel beside a looping row of square images, as in the homepage "Let's connect!". From
768px the text takes a third of the width (vertically centred) and the images the rest, running off
the right edge; on mobile the text sits above the images. The images can be dragged or swiped and
loop round; there are no arrows or dots, and nothing moves on its own.

## Table: the text panel, then one row per image

| Media Slider |
| --- |
| ## Let's connect!<br>Intro text…<br>[:facebook:](https://www.facebook.com/…) [:instagram:](https://www.instagram.com/…) [:wechat:](/path/wechat-qr.jpeg) [:linkedin:](https://www.linkedin.com/…) [:twitter:](https://x.com/…) |
| *image* |
| *image* |

- **First row, the text panel:**
  - **Title:** the first line (a heading or plain text); it always looks the same.
  - **Intro:** the following paragraphs (20px, light).
  - **Icon links:** a paragraph of links that each hold only an icon. Write the icon as
    `:icon-name:` (pick it from the Icons library in the editor), e.g.
    `[:facebook:](https://www.facebook.com/…)`. Each becomes a round maroon button with the
    icon in white. Give each link a title (e.g. "Facebook") so screen readers can name it; without
    one, the icon name is used (without a colour suffix such as `-white`). Websites open in a new tab; a link to an image
    file (e.g. the WeChat QR code) opens the image in a lightbox. Links with text stay text links.
- **Each following row: one image.** It's shown square (cropped to fill), 320px wide (280px on
  mobile). To make it a link, select the image and add the link; no separate cell is needed.
- Keyboard: the image row can be focused and moved with the arrow keys; a focused image link slides
  into view.

## Icons

Icons come from the **icon library** (`/docs/library/icons`, listed in `/docs/library/icons.json`
and in the editor's Icons panel) first; if an icon isn't there, the code `/icons` folder is used.
Coloured variants carry a suffix: `:facebook:` is the plain glyph used here, `:facebook-white:` the
white footer icon.
