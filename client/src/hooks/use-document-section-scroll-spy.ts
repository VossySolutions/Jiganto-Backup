import { useEffect, useState } from "react";
import type { DocumentTocHeading } from "@/lib/tiptap-document-extensions";
import {
  findDocumentScrollParent,
  getDocumentHeadingScrollOffset,
  getEditorContentScrollOffset,
} from "@/lib/tiptap-document-extensions";

function resolveHeadingElement(
  root: Element,
  heading: DocumentTocHeading,
): HTMLElement | null {
  const byId = (() => {
    try {
      return root.querySelector(`#${CSS.escape(heading.id)}`);
    } catch {
      return root.querySelector(`#${heading.id}`);
    }
  })();

  if (byId instanceof HTMLElement) return byId;

  const byToc = root.querySelector(`[data-toc-id="${heading.id}"]`);
  if (byToc instanceof HTMLElement) return byToc;

  for (const candidate of root.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    if (candidate.textContent?.trim() === heading.text) {
      return candidate as HTMLElement;
    }
  }

  return null;
}

export function useDocumentSectionScrollSpy(
  headings: DocumentTocHeading[],
  rootSelector = '[data-testid="tiptap-editor"]',
) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(
    headings[0]?.id ?? null,
  );

  useEffect(() => {
    setActiveHeadingId(headings[0]?.id ?? null);
  }, [headings]);

  useEffect(() => {
    if (headings.length === 0) return;

    const root = document.querySelector(rootSelector);
    if (!root) return;

    const updateActive = () => {
      const pairs = headings
        .map((heading) => ({
          heading,
          el: resolveHeadingElement(root, heading),
        }))
        .filter((pair): pair is { heading: DocumentTocHeading; el: HTMLElement } => pair.el instanceof HTMLElement);

      if (pairs.length === 0) return;

      const editorScrollEl = pairs[0].el.closest('[data-testid="editor-content-scroll"]');
      const scrollOffset = editorScrollEl instanceof HTMLElement
        ? getEditorContentScrollOffset(editorScrollEl)
        : getDocumentHeadingScrollOffset(pairs[0].el, rootSelector);

      let current = pairs[0].heading.id;
      for (const { heading, el } of pairs) {
        if (!el.id) {
          el.id = heading.id;
          el.setAttribute("data-toc-id", heading.id);
        }
        const top = el.getBoundingClientRect().top;
        if (top <= scrollOffset) {
          current = heading.id;
        }
      }

      setActiveHeadingId(current);
    };

    const scrollRoots = new Set<HTMLElement | Window>();
    const editorScroll = root.querySelector('[data-testid="editor-content-scroll"]');
    if (editorScroll instanceof HTMLElement) scrollRoots.add(editorScroll);

    const scrollParent = findDocumentScrollParent(root as HTMLElement);
    if (scrollParent) scrollRoots.add(scrollParent);

    let ancestor: HTMLElement | null = root as HTMLElement;
    while (ancestor) {
      if (ancestor.hasAttribute("data-radix-scroll-area-viewport")) {
        scrollRoots.add(ancestor);
        break;
      }
      ancestor = ancestor.parentElement;
    }
    scrollRoots.add(window);

    for (const target of scrollRoots) {
      target.addEventListener("scroll", updateActive, { passive: true });
    }
    window.addEventListener("resize", updateActive);
    updateActive();

    const observer = new MutationObserver(() => {
      updateActive();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      for (const target of scrollRoots) {
        target.removeEventListener("scroll", updateActive);
      }
      window.removeEventListener("resize", updateActive);
      observer.disconnect();
    };
  }, [headings, rootSelector]);

  return activeHeadingId;
}
