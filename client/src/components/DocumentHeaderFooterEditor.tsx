import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function normalizeEditorHtml(html: string): string {
  return html === "<p></p>" ? "" : html;
}

const REGION_COPY = {
  header: {
    title: "Page header",
    hint: "Repeats at the top of every printed / exported page",
    placeholder: "Add header content…",
  },
  footer: {
    title: "Page footer",
    hint: "Repeats at the bottom of every printed / exported page",
    placeholder: "Add footer content…",
  },
} as const;

function MiniToolbarButton({
  icon: Icon,
  label,
  onClick,
  isActive,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={isActive ? "secondary" : "ghost"}
          size="icon"
          className="h-6 w-6"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          data-testid={`header-footer-toolbar-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

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
      TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right"], defaultAlignment: "left" }),
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
      {editable && editor && (
        <div
          className={cn(
            "flex items-center gap-0.5 border-b border-border/40 bg-muted/10 shrink-0",
            isPanel ? "px-3 py-1" : "px-1.5 py-0.5",
          )}
          data-testid={`document-${kind}-toolbar`}
        >
          <MiniToolbarButton icon={Bold} label="Bold" isActive={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
          <MiniToolbarButton icon={Italic} label="Italic" isActive={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <MiniToolbarButton icon={UnderlineIcon} label="Underline" isActive={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
          <div className="w-px h-4 bg-border mx-1" />
          <MiniToolbarButton icon={AlignLeft} label="Align left" isActive={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
          <MiniToolbarButton icon={AlignCenter} label="Align center" isActive={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
          <MiniToolbarButton icon={AlignRight} label="Align right" isActive={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
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
