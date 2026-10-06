# Media Slider: authoring guide

A text panel beside a looping row of square images, as in the homepage "Let's connect!". From
768px the text takes a third of the width (vertically centred) and the images the rest, running off
the right edge; on mobile the text sits above the images. The images can be dragged or swiped and
loop round; there are no arrows or dots, and nothing moves on its own.

## Table: the text panel, then one row per image

| Media Slider |
| --- |
| ## Let's connect!<br>Intro text…<br>[Facebook](https://www.facebook.com/…) [Instagram](https://www.instagram.com/…) [WeChat](/path/wechat-qr.jpeg) [LinkedIn](https://www.linkedin.com/…) [X](https://x.com/…) |
| *image* |
| *image* |

- **First row, the text panel:**
  - **Title:** the first line (a heading or plain text); it always looks the same.
  - **Intro:** the following paragraphs (20px, light).
  - **Social links:** a paragraph with only links. Links to Facebook, Instagram, LinkedIn, X
    (Twitter) and WeChat show as the round maroon icons, recognised by the link address or the link
    text; the link text is read out to screen readers. Websites open in a new tab. A link to an
    image file (e.g. the WeChat QR code) opens the image in a lightbox.
- **Each following row: one image.** It's shown square (cropped to fill), 320px wide (280px on
  mobile). To make it a link, select the image and add the link; no separate cell is needed.
- Keyboard: the image row can be focused and moved with the arrow keys; a focused image link slides
  into view.
