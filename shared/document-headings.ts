export type DocumentHeadingLink = {
  level: number;
  text: string;
  id: string;
};

export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return slug || "section";
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueHeadingId(text: string, usedIds: Set<string>): string {
  const base = slugifyHeading(text);
  let id = base;
  let index = 2;
  while (usedIds.has(id)) {
    id = `${base}-${index++}`;
  }
  usedIds.add(id);
  return id;
}

/** Server-safe heading extraction from stored HTML. */
export function extractHeadingsFromHtmlString(html: string): DocumentHeadingLink[] {
  if (!html?.trim()) return [];

  const headings: DocumentHeadingLink[] = [];
  const usedIds = new Set<string>();
  const regex = /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const attrs = match[2] || "";
    const text = stripHtmlTags(match[3]);
    if (!text) continue;

    const idAttr = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
    const tocAttr = attrs.match(/data-toc-id=["']([^"']+)["']/i)?.[1];
    let id = idAttr || tocAttr || uniqueHeadingId(text, usedIds);
    if (idAttr || tocAttr) usedIds.add(id);
    else if (!usedIds.has(id)) usedIds.add(id);
    else id = uniqueHeadingId(text, usedIds);

    headings.push({ level, text, id });
  }

  return headings;
}

/** Ensure every heading in HTML has stable anchor ids for in-page links. */
export function injectHeadingAnchorIds(html: string): string {
  if (!html?.trim()) return html;

  const usedIds = new Set<string>();

  return html.replace(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (full, levelStr, attrs = "", inner) => {
    const text = stripHtmlTags(inner);
    if (!text) return full;

    const hasId = /\bid\s*=/.test(attrs) || /data-toc-id\s*=/.test(attrs);
    if (hasId) {
      const existing =
        attrs.match(/\bid=["']([^"']+)["']/i)?.[1] ||
        attrs.match(/data-toc-id=["']([^"']+)["']/i)?.[1];
      if (existing) usedIds.add(existing);
      return full;
    }

    const id = uniqueHeadingId(text, usedIds);
    const trimmedAttrs = attrs.trim();
    const attrPrefix = trimmedAttrs ? ` ${trimmedAttrs}` : "";
    return `<h${levelStr}${attrPrefix} id="${id}" data-toc-id="${id}">${inner}</h${levelStr}>`;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPublicSectionNavHtml(headings: DocumentHeadingLink[]): string {
  if (headings.length === 0) return "";

  const items = headings
    .map((h) => {
      const indent = (h.level - 1) * 14;
      return `<a href="#${escapeHtml(h.id)}" data-section-id="${escapeHtml(h.id)}" class="section-jump-link" style="margin-left:${indent}px">${escapeHtml(h.text)}</a>`;
    })
    .join("");

  return `<nav class="on-this-page" aria-label="On this page">
    <p class="on-this-page-title">On this page</p>
    <p class="on-this-page-count">${headings.length} section${headings.length === 1 ? "" : "s"}</p>
    <div class="on-this-page-links">${items}</div>
  </nav>`;
}

export const PUBLIC_DOCUMENT_SECTION_NAV_STYLES = `
  .page-layout { display: block; }
  .page-main { min-width: 0; }
  .page-sidebar { display: none; }
  .on-this-page { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 1.5rem; }
  .on-this-page-title { font-size: 0.875rem; font-weight: 600; margin: 0; color: #0f172a; }
  .on-this-page-count { font-weight: 400; color: #64748b; font-size: 0.75rem; margin: 4px 0 8px; }
  .on-this-page-links { display: flex; flex-direction: column; gap: 2px; }
  .section-jump-link { color: #2563eb; text-decoration: none; font-size: 0.875rem; line-height: 1.4; display: block; padding: 4px 8px; border-radius: 4px; border-left: 2px solid transparent; }
  .section-jump-link:hover { color: #1d4ed8; text-decoration: underline; text-underline-offset: 2px; }
  .section-jump-link.is-active { color: #1d4ed8; font-weight: 600; background: #eff6ff; border-left-color: #2563eb; }
  h1, h2, h3, h4, h5, h6 { scroll-margin-top: 1.5rem; }
  .document-heading-jump-target { outline: 2px solid rgba(37, 99, 235, 0.35); outline-offset: 2px; border-radius: 4px; }
  @media (min-width: 1024px) {
    body.has-section-nav { max-width: 1120px; }
    .page-layout.has-section-nav { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 2rem; align-items: start; }
    .page-layout.has-section-nav .on-this-page { display: none; }
    .page-sidebar { display: block; position: sticky; top: 1.5rem; }
    .page-sidebar .on-this-page { margin-bottom: 0; }
  }
`;

export const PUBLIC_DOCUMENT_SECTION_NAV_SCRIPT = `
(function() {
  var links = Array.prototype.slice.call(document.querySelectorAll('.section-jump-link'));
  if (!links.length) return;

  links.forEach(function(link) {
    link.addEventListener('click', function(e) {
      var id = link.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('document-heading-jump-target');
      setTimeout(function() { target.classList.remove('document-heading-jump-target'); }, 1600);
    });
  });

  function updateActive() {
    var offset = 120;
    var currentId = links[0].getAttribute('data-section-id');
    links.forEach(function(link) {
      var id = link.getAttribute('data-section-id');
      var target = document.getElementById(id);
      if (target && target.getBoundingClientRect().top <= offset) {
        currentId = id;
      }
    });
    links.forEach(function(link) {
      link.classList.toggle('is-active', link.getAttribute('data-section-id') === currentId);
    });
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  window.addEventListener('resize', updateActive);
  updateActive();
})();
`;
