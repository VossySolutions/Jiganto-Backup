import { useRef, useCallback } from "react";
import { useSurveyColors } from "@/lib/survey-constants";

type Props = {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
  placeholder?: string;
  style?: React.CSSProperties;
};

function exec(cmd: string) {
  document.execCommand(cmd, false);
}

export function RichTextField({ value, onChange, rows = 3, placeholder, style }: Props) {
  const C = useSurveyColors();
  const ref = useRef<HTMLDivElement>(null);

  const sync = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {[
          { label: "B", cmd: "bold", title: "Bold" },
          { label: "I", cmd: "italic", title: "Italic" },
        ].map(b => (
          <button
            key={b.cmd}
            type="button"
            title={b.title}
            onMouseDown={e => { e.preventDefault(); exec(b.cmd); sync(); }}
            style={{
              width: 28, height: 26, border: `1px solid ${C.line2}`, borderRadius: 5,
              background: C.surface, cursor: "pointer", fontWeight: b.cmd === "bold" ? 700 : 400,
              fontStyle: b.cmd === "italic" ? "italic" : "normal", fontSize: 12,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: value || "" }}
        style={{
          minHeight: rows * 22,
          padding: "8px 11px",
          border: `1px solid ${C.line2}`,
          borderRadius: 7,
          fontFamily: "inherit",
          fontSize: 13,
          color: C.ink,
          background: C.surface,
          outline: "none",
          lineHeight: 1.5,
          ...style,
        }}
      />
    </div>
  );
}

/** Strip HTML for plain-text previews. */
export function stripHtml(html: string) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
