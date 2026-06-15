import { useCallback, useRef, useState, type ReactNode } from "react";

type VirtualOpts = {
  rowHeight?: number;
  maxHeight?: number;
  threshold?: number;
};

export function useVirtualRows<T>(rows: T[], opts: VirtualOpts = {}) {
  const { rowHeight = 38, maxHeight = 480, threshold = 50 } = opts;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [window, setWindow] = useState({ start: 0, end: rows.length });

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || rows.length < threshold) return;
    const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - 2);
    const visible = Math.ceil(maxHeight / rowHeight) + 6;
    setWindow({ start, end: Math.min(rows.length, start + visible) });
  }, [rows.length, rowHeight, maxHeight, threshold]);

  const enabled = rows.length >= threshold;
  const visibleRows = enabled ? rows.slice(window.start, window.end) : rows;
  const padTop = enabled ? window.start * rowHeight : 0;
  const padBottom = enabled ? (rows.length - window.end) * rowHeight : 0;

  return { scrollRef, onScroll, enabled, visibleRows, padTop, padBottom, maxHeight, offset: window.start };
}

export function RpVirtualScrollContainer({
  scrollRef,
  onScroll,
  maxHeight,
  children,
}: {
  scrollRef: React.Ref<HTMLDivElement>;
  onScroll: () => void;
  maxHeight: number;
  children: ReactNode;
}) {
  return (
    <div ref={scrollRef} className="overflow-auto" style={{ maxHeight }} onScroll={onScroll}>
      {children}
    </div>
  );
}

export function RpVirtualPaddingRows({ height }: { height: number }) {
  if (height <= 0) return null;
  return (
    <tr aria-hidden className="pointer-events-none">
      <td colSpan={99} style={{ height, padding: 0, border: 0, lineHeight: 0 }} />
    </tr>
  );
}
