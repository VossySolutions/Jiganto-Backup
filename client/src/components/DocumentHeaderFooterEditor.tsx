import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { cn } from "@/lib/utils";

function normalizeEditorHtml(html: string): string {
  return html === "<p></p>" ? "" : html;
}

const REGION_COPY = {
  header: {
    title: "Page header",
    hint: "Top of the page — title, date, logo, or links",
    placeholder: "Add header content…",
  },
  footer: {
    title: "Page footer",
    hint: "Bottom of the page — copyright, page info, or links",
    placeholder: "Add footer content…",
  },
} as const;

export function DocumentHeaderFooterEditor({
  kind,
  content,
  onChange,
  editable,
  showLabel = true,
  variant = "strip",
}: {
  kind: "header" | "footer";
  content: string;
  onChange: (html: string) => void;
  editable: boolean;
  showLabel?: boolean;
  /** `panel` = Properties tab; `strip` = inline content tab chrome */
  variant?: "strip" | "panel";
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const lastExternalContent = useRef(normalizeEditorHtml(content || ""));
  const copy = REGION_COPY[kind];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({ openOnClick: !editable, HTMLAttributes: { class: "text-primary underline underline-offset-2" } }),
      TextAlign.configure({ types: ["paragraph"] }),
      Placeholder.configure({ placeholder: copy.placeholder }),
    ],
    content: content || "",
    editable,
    onUpdate: ({ editor: ed }) => {
      const normalized = normalizeEditorHtml(ed.getHTML());
      lastExternalContent.current = normalized;
      onChange(normalized);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    const incoming = normalizeEditorHtml(content || "");
    if (incoming === lastExternalContent.current) return;
    const current = normalizeEditorHtml(editor.getHTML());
    if (incoming !== current) {
      lastExternalContent.current = incoming;
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    const el = regionRef.current;
    if (!el) return;
    const stopBubble = (e: Event) => e.stopPropagation();
    el.addEventListener("keydown", stopBubble);
    el.addEventListener("keyup", stopBubble);
    return () => {
      el.removeEventListener("keydown", stopBubble);
      el.removeEventListener("keyup", stopBubble);
    };
  }, []);

  const isPanel = variant === "panel";

  return (
    <div
      className={cn(
        "overflow-hidden w-full",
        isPanel
          ? "rounded-lg border border-border/70 bg-card shadow-sm"
          : "rounded-lg border border-dashed border-border/70 bg-muted/15",
        showLabel && !isPanel && (kind === "header" ? "mb-4" : "mt-4"),
        !showLabel && !isPanel && "border-0 rounded-none bg-transparent",
      )}
      data-testid={`document-${kind}-region`}
      data-editable-region={kind}
    >
      {(showLabel || isPanel) && (
        <div
          className={cn(
            "border-b border-border/50 bg-muted/25 shrink-0",
            isPanel ? "px-4 py-3" : "px-3 py-1.5",
          )}
        >
          <p className={cn("font-semibold text-foreground", isPanel ? "text-sm" : "text-[10px] uppercase tracking-wider text-muted-foreground")}>
            {copy.title}
          </p>
          <p className={cn("text-muted-foreground", isPanel ? "text-xs mt-0.5" : "text-[10px] mt-0")}>
            {copy.hint}
          </p>
        </div>
      )}
      <div
        ref={regionRef}
        className={cn(
          "text-sm w-full min-w-0 [&_.ProseMirror]:outline-none [&_.ProseMirror]:w-full [&_.ProseMirror_p]:my-0.5 [&_.ProseMirror_a]:text-primary",
          isPanel ? "px-4 py-3 min-h-[4.5rem]" : "px-2 py-1 min-h-[1.75rem]",
          !editable && "opacity-90",
        )}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <EditorContent editor={editor} className="w-full" />
      </div>
    </div>
  );
}
