import { useEffect, useState } from "react";
import type { DocumentTocHeading } from "@/lib/tiptap-document-extensions";
import {
  findDocumentScrollParent,
  getDocumentHeadingScrollOffset,
} from "@/lib/tiptap-document-extensions";

function normalizeHeadingText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

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
    if (normalizeHeadingText(candidate.textContent || "") === normalizeHeadingText(heading.text)) {
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

      const scrollOffset = getDocumentHeadingScrollOffset(pairs[0].el, rootSelector);

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
    const scrollParent = findDocumentScrollParent(root as HTMLElement);
    if (scrollParent) scrollRoots.add(scrollParent);

    for (const paneId of ["document-word-scroll", "document-header-scroll", "document-footer-scroll"]) {
      const pane = document.querySelector(`[data-testid="${paneId}"]`);
      if (pane instanceof HTMLElement) scrollRoots.add(pane);
    }

    const pageViewport = document.querySelector('[data-testid="scroll-area-viewport"]');
    if (pageViewport instanceof HTMLElement) scrollRoots.add(pageViewport);

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
