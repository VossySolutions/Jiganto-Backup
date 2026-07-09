import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { slugifyHeading } from "@/lib/document-html-normalize";
import { DocumentImageNodeView } from "@/components/editor/DocumentImageNodeView";

export const HeadingWithAnchor = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tocId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-toc-id") || element.getAttribute("id"),
        renderHTML: (attributes) => {
          if (!attributes.tocId) return {};
          return { id: attributes.tocId, "data-toc-id": attributes.tocId };
        },
      },
    };
  },
});

/** Assign stable anchor ids to headings for in-document navigation. */
export const HeadingAnchorPlugin = Extension.create({
  name: "headingAnchorPlugin",
  onCreate() {
    this.storage.ready = false;
    queueMicrotask(() => {
      this.storage.ready = true;
    });
  },
  addStorage() {
    return { ready: false };
  },
  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: new PluginKey("headingAnchorPlugin"),
        appendTransaction(_transactions, _oldState, newState) {
          if (!extension.storage.ready) return null;

          const tr = newState.tr;
          let changed = false;
          const usedIds = new Set<string>();

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "heading") return;
            const text = node.textContent.trim();
            if (!text) return;

            const base = slugifyHeading(text);
            let tocId = node.attrs.tocId || base;
            if (!node.attrs.tocId || usedIds.has(tocId)) {
              let index = 2;
              while (usedIds.has(tocId)) {
                tocId = `${base}-${index++}`;
              }
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, tocId });
              changed = true;
            }
            usedIds.add(tocId);
          });

          return changed ? tr : null;
        },
      }),
    ];
  },
});

export const DocumentImage = Image.extend({
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: "Image",
        parseHTML: (element) => element.getAttribute("alt") || "Image",
        renderHTML: (attributes) => ({ alt: attributes.alt || "Image" }),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(DocumentImageNodeView);
  },
}).configure({
  inline: false,
  allowBase64: true,
  HTMLAttributes: {
    class: "max-w-full h-auto rounded-lg cursor-pointer",
  },
});

function selectImageNode(view: any, nodePos: number) {
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
}

/** Click an image to select it (enables delete/replace). */
export const ImageInteraction = Extension.create({
  name: "imageInteraction",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClickOn(_view, _pos, node, nodePos) {
            if (node.type.name !== "image") return false;
            selectImageNode(_view, nodePos);
            return true;
          },
          handleDOMEvents: {
            click(view, event) {
              const target = event.target as HTMLElement | null;
              if (!target || target.tagName !== "IMG") return false;
              const pos = view.posAtDOM(target, 0);
              const node = view.state.doc.nodeAt(pos);
              if (node?.type.name === "image") {
                selectImageNode(view, pos);
                return true;
              }
              // Walk up to find image node position
              for (let p = pos; p >= Math.max(0, pos - 4); p--) {
                const n = view.state.doc.nodeAt(p);
                if (n?.type.name === "image") {
                  selectImageNode(view, p);
                  return true;
                }
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

export type DocumentTocHeading = {
  level: number;
  text: string;
  id: string;
  pos: number;
};

export function extractDocumentHeadings(doc: { descendants: (fn: (node: any, pos: number) => void) => void }): DocumentTocHeading[] {
  const headings: DocumentTocHeading[] = [];
  const usedIds = new Set<string>();

  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent.trim();
    if (!text) return;

    let id = node.attrs.tocId || slugifyHeading(text);
    if (usedIds.has(id)) {
      let index = 2;
      while (usedIds.has(`${slugifyHeading(text)}-${index}`)) index++;
      id = `${slugifyHeading(text)}-${index}`;
    }
    usedIds.add(id);

    headings.push({
      level: node.attrs.level,
      text,
      id,
      pos,
    });
  });

  return headings;
}

export function scrollEditorToHeading(editor: any, pos: number) {
  if (!editor) return;
  try {
    const domAt = editor.view.domAtPos(pos + 1);
    let el: HTMLElement | null = null;
    if (domAt.node instanceof HTMLElement) {
      el = domAt.node;
    } else if (domAt.node?.parentElement instanceof HTMLElement) {
      el = domAt.node.parentElement;
    }
    if (el?.tagName?.match(/^H[1-6]$/i)) {
      scrollHeadingElementIntoView(el);
    } else {
      const heading = el?.closest("h1,h2,h3,h4,h5,h6");
      if (heading instanceof HTMLElement) scrollHeadingElementIntoView(heading);
    }
    editor.chain().focus().setTextSelection(pos + 1).run();
  } catch {
    // ignore
  }
}

/** Parse stored HTML and build a section list for page-level navigation. */
export function extractHeadingsFromHtml(html: string): DocumentTocHeading[] {
  if (!html?.trim() || typeof document === "undefined") return [];

  const root = new DOMParser()
    .parseFromString(`<div id="__toc-root">${html}</div>`, "text/html")
    .getElementById("__toc-root");
  if (!root) return [];

  const headings: DocumentTocHeading[] = [];
  const usedIds = new Set<string>();

  root.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((el) => {
    const text = (el.textContent || "").trim();
    if (!text) return;

    const level = parseInt(el.tagName.charAt(1), 10);
    let id =
      el.getAttribute("id") ||
      el.getAttribute("data-toc-id") ||
      slugifyHeading(text);

    if (usedIds.has(id)) {
      let index = 2;
      const base = slugifyHeading(text);
      while (usedIds.has(`${base}-${index}`)) index++;
      id = `${base}-${index}`;
    }
    usedIds.add(id);

    headings.push({ level, text, id, pos: 0 });
  });

  return headings;
}

export function findDocumentScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const testId = node.getAttribute("data-testid");
    if (
      testId === "document-word-scroll" ||
      testId === "document-header-scroll" ||
      testId === "document-footer-scroll"
    ) {
      return node;
    }
    if (node.hasAttribute("data-radix-scroll-area-viewport")) {
      return node;
    }
    if (node.getAttribute("data-testid") === "scroll-area-viewport") {
      return node;
    }
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function normalizeHeadingText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function getEditorContentScrollOffset(scrollContainer: HTMLElement): number {
  const containerTop = scrollContainer.getBoundingClientRect().top;
  let offset = 16;
  scrollContainer.querySelectorAll<HTMLElement>('[data-testid="find-replace-bar"]').forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.height > 0 && rect.top <= containerTop + 4 && rect.bottom > containerTop) {
      offset = Math.max(offset, rect.bottom - containerTop + 8);
    }
  });
  return offset;
}

/** Offset for in-page jumps so headings sit below sticky toolbars. */
export function getDocumentHeadingScrollOffset(
  anchorEl: HTMLElement,
  _rootSelector = '[data-testid="tiptap-editor"]',
): number {
  const scrollParent = findDocumentScrollParent(anchorEl);
  const viewportTop = scrollParent?.getBoundingClientRect().top ?? 0;
  let offset = 16;

  const toolbar = document.querySelector('[data-testid="tiptap-toolbar"]');
  if (
    toolbar instanceof HTMLElement &&
    scrollParent &&
    scrollParent.contains(toolbar)
  ) {
    offset = Math.max(offset, toolbar.offsetHeight + 12);
  }

  const stickySelectors = [
    '[data-testid="find-replace-bar"]',
    '[data-testid="document-section-nav"]',
  ];

  const searchRoot = scrollParent ?? document;
  for (const selector of stickySelectors) {
    searchRoot.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      const style = window.getComputedStyle(node);
      if (style.position !== "sticky" && style.position !== "fixed") return;
      const rect = node.getBoundingClientRect();
      if (rect.height <= 0) return;
      if (rect.top <= viewportTop + 8 && rect.bottom > viewportTop) {
        offset = Math.max(offset, rect.bottom - viewportTop + 12);
      }
    });
  }

  return offset;
}

function scrollHeadingElementIntoView(el: HTMLElement) {
  const scrollParent = findDocumentScrollParent(el);
  const offset = getDocumentHeadingScrollOffset(el);

  if (scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetScroll = scrollParent.scrollTop + (elRect.top - parentRect.top) - offset;
    scrollParent.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
  } else {
    const top = window.scrollY + el.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  el.classList.add("document-heading-jump-target");
  window.setTimeout(() => el.classList.remove("document-heading-jump-target"), 1600);
}

/** Scroll to a section by id or heading text (Confluence-style in-page links). */
export function scrollToDocumentHeading(
  heading: DocumentTocHeading,
  rootSelector = '[data-testid="tiptap-editor"]',
) {
  if (typeof document === "undefined") return;

  const root = document.querySelector(rootSelector) ?? document;

  const queryById = (id: string) => {
    try {
      return root.querySelector(`#${CSS.escape(id)}`);
    } catch {
      return root.querySelector(`#${id}`);
    }
  };

  let el =
    queryById(heading.id) ||
    root.querySelector(`[data-toc-id="${heading.id}"]`);

  if (!el) {
    const targetText = normalizeHeadingText(heading.text);
    root.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((candidate) => {
      if (!el && normalizeHeadingText(candidate.textContent || "") === targetText) {
        el = candidate;
      }
    });
  }

  if (el instanceof HTMLElement) {
    if (!el.id) {
      el.id = heading.id;
      el.setAttribute("data-toc-id", heading.id);
    }
    scrollHeadingElementIntoView(el);
  }
}
