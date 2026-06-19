/** Slug for heading anchor links. */
export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return slug || "section";
}

function cloneImg(doc: Document, img: HTMLImageElement): HTMLImageElement {
  const lifted = doc.createElement("img");
  for (const attr of Array.from(img.attributes)) {
    lifted.setAttribute(attr.name, attr.value);
  }
  if (!lifted.getAttribute("alt")) lifted.setAttribute("alt", "Image");
  lifted.removeAttribute("contenteditable");
  return lifted;
}

function paragraphIsImageOnly(el: Element): HTMLImageElement | null {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("br").forEach((br) => br.remove());
  Array.from(clone.querySelectorAll("span, a")).forEach((wrapper) => {
    const text = (wrapper.textContent || "").replace(/\u00a0/g, " ").trim();
    if (!text && wrapper.querySelector("img")) {
      const img = wrapper.querySelector("img");
      if (img) wrapper.replaceWith(img.cloneNode(true));
    }
  });

  const children = Array.from(clone.childNodes).filter((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      return (n.textContent || "").replace(/\u00a0/g, " ").trim().length > 0;
    }
    return true;
  });

  if (children.length !== 1) return null;
  const only = children[0];
  if (only.nodeName === "IMG") return only as HTMLImageElement;
  if (only.nodeName === "SPAN" || only.nodeName === "A") {
    return (only as Element).querySelector("img");
  }
  return null;
}

/**
 * Normalize HTML from Word import so TipTap treats images as editable image nodes.
 */
export function normalizeDocumentHtmlForEditor(html: string): string {
  if (!html || typeof document === "undefined") return html;

  const doc = new DOMParser().parseFromString(`<div id="__doc-root">${html}</div>`, "text/html");
  const root = doc.getElementById("__doc-root");
  if (!root) return html;

  // Unwrap figure elements that only contain an image
  Array.from(root.querySelectorAll("figure")).forEach((figure) => {
    const img = figure.querySelector("img");
    const caption = (figure.querySelector("figcaption")?.textContent || "").trim();
    if (img && !caption) {
      figure.replaceWith(cloneImg(doc, img));
    }
  });

  // Unwrap div/section wrappers that only contain an image
  for (const tag of ["div", "section", "center"]) {
    Array.from(root.querySelectorAll(tag)).forEach((el) => {
      const img = el.querySelector(":scope > img") || (el.children.length === 1 ? el.querySelector("img") : null);
      if (!img) return;
      const text = (el.textContent || "").replace(/\u00a0/g, " ").trim();
      const imgAlt = (img.getAttribute("alt") || "").trim();
      if (text === imgAlt || text.length === 0 || el.querySelectorAll("img").length === 1) {
        const onlyImg = paragraphIsImageOnly(el);
        if (onlyImg || el.querySelectorAll("img").length === 1) {
          el.replaceWith(cloneImg(doc, img));
        }
      }
    });
  }

  // Lift standalone images out of paragraphs
  Array.from(root.querySelectorAll("p")).forEach((p) => {
    const img = paragraphIsImageOnly(p);
    if (img) p.replaceWith(cloneImg(doc, img));
  });

  // Split paragraphs that mix text and images — keep inline structure TipTap can parse
  Array.from(root.querySelectorAll("p")).forEach((p) => {
    const imgs = p.querySelectorAll("img");
    if (imgs.length !== 1) return;
    const img = imgs[0];
    const text = (p.textContent || "").replace(img.alt || "", "").replace(/\u00a0/g, " ").trim();
    if (!text) return;
    const lifted = cloneImg(doc, img);
    img.remove();
    p.parentNode?.insertBefore(lifted, p);
  });

  // Final pass on all images
  root.querySelectorAll("img").forEach((img) => {
    img.removeAttribute("contenteditable");
    img.removeAttribute("contentEditable");
    if (!img.getAttribute("alt")) img.setAttribute("alt", "Image");
    if (!img.getAttribute("src")) img.remove();
  });

  root.querySelectorAll("img[src=''], img:not([src])").forEach((img) => img.remove());

  return root.innerHTML;
}
