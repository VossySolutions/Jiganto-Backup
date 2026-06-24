import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";

function normalizeEditorHtml(html: string): string {
  return html === "<p></p>" ? "" : html;
}

export function DocumentHeaderFooterEditor({
  kind,
  content,
  onChange,
  editable,
}: {
  kind: "header" | "footer";
  content: string;
  onChange: (html: string) => void;
  editable: boolean;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const lastExternalContent = useRef(normalizeEditorHtml(content || ""));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      TextAlign.configure({ types: ["paragraph"] }),
      Placeholder.configure({
        placeholder:
          kind === "header"
            ? "Add header text (title, date, logo)…"
            : "Add footer text (copyright, page info)…",
      }),
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
    const incoming = normalizeEditorHtml(content || "");
    if (incoming === lastExternalContent.current) return;
    lastExternalContent.current = incoming;
    const current = normalizeEditorHtml(editor.getHTML());
    if (incoming !== current) {
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

  const label = kind === "header" ? "Header" : "Footer";

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/70 bg-muted/15 overflow-hidden w-full",
        kind === "header" ? "mb-4" : "mt-4",
      )}
      data-testid={`document-${kind}-region`}
      data-editable-region={kind}
    >
      <div className="px-3 py-1.5 border-b border-border/50 bg-muted/25 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        ref={regionRef}
        className={cn(
          "px-3 py-2 min-h-[2.75rem] text-sm [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-0.5",
          !editable && "opacity-90",
        )}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
