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
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      el?.closest("h1,h2,h3,h4,h5,h6")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    editor.chain().focus().setTextSelection(pos + 1).run();
  } catch {
    // ignore
  }
}
