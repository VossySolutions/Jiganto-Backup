import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import type Konva from "konva";
import type { StickyNote, WhiteboardDetail, NoteType } from "@shared/models/whiteboard";
import {
  NOTE_TYPE_CONFIG, NOTE_TYPES_ORDER, getNoteColors, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP,
  SNAP_GRID, NOTE_MIN, NOTE_MAX, NOTE_DEFAULT, LAST_NOTE_COLOR_KEY,
  userColorFromId, ARROW_NUDGE, dedupeNotes, mergeNotes, patchNoteInList,
} from "@/lib/whiteboard-constants";
import { apiRequest } from "@/lib/queryClient";

export type WhiteboardCanvasHandle = {
  addNote: () => void;
  fitToScreen: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  getZoom: () => number;
};

function snap(v: number) {
  return Math.round(v / SNAP_GRID) * SNAP_GRID;
}

function StickyNoteNode({
  note, selected, scale, canEdit, isEditing, onSelect, onDragEnd, onResizeEnd, onDblClick, onContextMenu,
}: {
  note: StickyNote;
  selected: boolean;
  scale: number;
  canEdit: boolean;
  isEditing?: boolean;
  onSelect: (id: number, additive: boolean) => void;
  onDragEnd: (id: number, x: number, y: number) => void;
  onResizeEnd: (id: number, w: number, h: number) => void;
  onDblClick: (id: number) => void;
  onContextMenu: (id: number, x: number, y: number) => void;
}) {
  const colors = getNoteColors(note.noteType as NoteType, note.colourHex);
  const cfg = NOTE_TYPE_CONFIG[note.noteType as NoteType] ?? NOTE_TYPE_CONFIG.idea;
  const fontSize = Math.max(11, Math.min(14, 200 / Math.max(note.text.length, 1) * 8));

  return (
    <Group
      x={note.xPosition}
      y={note.yPosition}
      draggable={canEdit && !isEditing}
      onClick={(e) => { e.cancelBubble = true; onSelect(note.id, e.evt.shiftKey); }}
      onTap={(e) => { e.cancelBubble = true; onSelect(note.id, false); }}
      onDblClick={(e) => { e.cancelBubble = true; onDblClick(note.id); }}
      onDblTap={(e) => { e.cancelBubble = true; onDblClick(note.id); }}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        onContextMenu(note.id, e.evt.clientX, e.evt.clientY);
      }}
      onDragEnd={(e) => onDragEnd(note.id, e.target.x(), e.target.y())}
    >
      <Rect
        width={note.width}
        height={note.height}
        fill={colors.background}
        stroke={selected ? "#6366f1" : colors.border}
        strokeWidth={selected ? 2.5 / scale : 1.5 / scale}
        cornerRadius={6}
        shadowColor="black"
        shadowBlur={selected ? 8 : 4}
        shadowOpacity={0.12}
      />
      <Text text={cfg.icon} x={8} y={6} fontSize={14 / scale} listening={false} />
      <Text
        text={cfg.label.toUpperCase()}
        x={8}
        y={8}
        width={note.width - 16}
        fontSize={9 / scale}
        fill={colors.border}
        align="right"
        listening={false}
      />
      {!isEditing && (
        <Text
          text={note.text || "Double-click to edit"}
          x={10}
          y={28}
          width={note.width - 20}
          height={note.height - 36}
          fontSize={fontSize / scale}
          fill="#1f2937"
          wrap="word"
          fontStyle={note.text ? "normal" : "italic"}
          listening={false}
        />
      )}
      {selected && canEdit && !isEditing && (
        <Rect
          x={note.width - 14}
          y={note.height - 14}
          width={12}
          height={12}
          fill="#6366f1"
          cornerRadius={2}
          draggable
          onDragMove={(e) => {
            const node = e.target;
            const newW = Math.min(NOTE_MAX, Math.max(NOTE_MIN, node.x() + 12));
            const newH = Math.min(NOTE_MAX, Math.max(NOTE_MIN, node.y() + 12));
            node.x(newW - 12);
            node.y(newH - 12);
          }}
          onDragEnd={(e) => {
            const node = e.target;
            onResizeEnd(note.id, node.x() + 12, node.y() + 12);
            node.position({ x: note.width - 14, y: note.height - 14 });
          }}
        />
      )}
    </Group>
  );
}

export const WhiteboardCanvas = forwardRef<WhiteboardCanvasHandle, {
  board: WhiteboardDetail;
  canEdit: boolean;
  userId: string;
  userName: string;
  showMinimap?: boolean;
  onSaved?: () => void;
  onZoomChange?: (pct: number) => void;
}>(function WhiteboardCanvas({
  board, canEdit, userId, userName, showMinimap = true, onSaved, onZoomChange,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorThrottleRef = useRef(0);

  const [size, setSize] = useState({ w: 800, h: 600 });
  const [notes, setNotes] = useState<StickyNote[]>(board.notes);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [spaceDown, setSpaceDown] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { userName: string; x: number; y: number; ts: number }>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; noteId: number } | null>(null);
  const undoStack = useRef<{ type: string; note?: StickyNote; noteId?: number }[]>([]);
  const redoStack = useRef<typeof undoStack.current>([]);

  const pushUndo = (action: { type: string; note?: StickyNote; noteId?: number }) => {
    undoStack.current.push(action);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  };

  const [lastNoteType, setLastNoteType] = useState<NoteType>(() => {
    try { return (localStorage.getItem(LAST_NOTE_COLOR_KEY) as NoteType) || "idea"; }
    catch { return "idea"; }
  });
  const [customColor, setCustomColor] = useState("#A855F7");

  useEffect(() => { setNotes(dedupeNotes(board.notes)); }, [board.notes]);
  const visibleNotes = useMemo(() => dedupeNotes(notes), [notes]);
  useEffect(() => { onZoomChange?.(Math.round(scale * 100)); }, [scale, onZoomChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const flashSaved = useCallback(() => {
    onSaved?.();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, [onSaved]);

  const patchNote = useCallback(async (noteId: number, data: Record<string, unknown>) => {
    const res = await apiRequest("PATCH", `/api/whiteboard/notes/${noteId}`, data);
    return res.json() as Promise<StickyNote>;
  }, []);

  const viewportCenter = useCallback(() => ({
    x: (-stagePos.x + size.w / 2) / scale,
    y: (-stagePos.y + size.h / 2) / scale,
  }), [stagePos, size, scale]);

  const createNoteAt = useCallback(async (x: number, y: number) => {
    if (!canEdit) return;
    const colors = getNoteColors(lastNoteType);
    const res = await apiRequest("POST", `/api/whiteboard/${board.id}/notes`, {
      xPosition: snap(x),
      yPosition: snap(y),
      noteType: lastNoteType,
      colourHex: lastNoteType === "custom" ? colors.border : null,
      width: NOTE_DEFAULT,
      height: NOTE_DEFAULT,
      text: "",
    });
    const note = await res.json() as StickyNote;
    setNotes((prev) => mergeNotes(prev, note));
    pushUndo({ type: "create", noteId: note.id });
    setSelectedIds(new Set([note.id]));
    flashSaved();
  }, [board.id, canEdit, lastNoteType, flashSaved]);

  const fitToScreen = useCallback(() => {
    if (!visibleNotes.length) { setScale(1); setStagePos({ x: size.w / 2, y: size.h / 2 }); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visibleNotes.forEach((n) => {
      minX = Math.min(minX, n.xPosition);
      minY = Math.min(minY, n.yPosition);
      maxX = Math.max(maxX, n.xPosition + n.width);
      maxY = Math.max(maxY, n.yPosition + n.height);
    });
    const margin = 60;
    const bw = maxX - minX + margin * 2;
    const bh = maxY - minY + margin * 2;
    const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(size.w / bw, size.h / bh)));
    setScale(newScale);
    setStagePos({
      x: size.w / 2 - ((minX + maxX) / 2) * newScale,
      y: size.h / 2 - ((minY + maxY) / 2) * newScale,
    });
  }, [visibleNotes, size]);

  useImperativeHandle(ref, () => ({
    addNote: () => { const c = viewportCenter(); void createNoteAt(c.x, c.y); },
    fitToScreen,
    zoomIn: () => setScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP)),
    zoomOut: () => setScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP)),
    resetZoom: () => setScale(1),
    getZoom: () => scale,
  }), [viewportCenter, createNoteAt, fitToScreen, scale]);

  // WebSocket realtime
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const params = new URLSearchParams({ userId, userName });
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/whiteboard?${params}`);
      wsRef.current = ws;
      ws.onopen = () => {
        setReconnecting(false);
        ws?.send(JSON.stringify({ type: "join", payload: { whiteboardId: board.id } }));
      };
      ws.onclose = () => {
        setReconnecting(true);
        if (!closed) reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "cursor:moved" && data.payload.userId !== userId) {
            setRemoteCursors((prev) => {
              const next = new Map(prev);
              next.set(data.payload.userId, {
                userName: data.payload.userName,
                x: data.payload.x,
                y: data.payload.y,
                ts: Date.now(),
              });
              return next;
            });
          }
          if (data.type === "note:created" && data.payload.note) {
            const n = data.payload.note as StickyNote;
            setNotes((prev) => mergeNotes(prev, n));
          }
          if (data.type === "note:updated" || data.type === "note:moved") {
            const { note, note_id, ...fields } = data.payload;
            const id = note_id ?? note?.id;
            if (id) {
              setNotes((prev) => {
                const existing = prev.find((n) => n.id === id);
                return mergeNotes(prev, { ...existing, ...note, ...fields, id } as StickyNote);
              });
            }
          }
          if (data.type === "note:deleted") {
            setNotes((prev) => prev.filter((n) => n.id !== data.payload.note_id));
          }
        } catch { /* ignore */ }
      };
    };
    connect();
    return () => { closed = true; clearTimeout(reconnectTimer); ws?.close(); wsRef.current = null; };
  }, [board.id, userId, userName]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.forEach((v, k) => { if (now - v.ts > 10_000) next.delete(k); });
        return next.size === prev.size ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - stagePos.x) / scale,
    y: (sy - stagePos.y) / scale,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingNoteId) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceDown(e.type === "keydown"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && canEdit) {
        e.preventDefault();
        const action = undoStack.current.pop();
        if (!action) return;
        redoStack.current.push(action);
        if (action.type === "create" && action.noteId) {
          void apiRequest("DELETE", `/api/whiteboard/notes/${action.noteId}`);
          setNotes((prev) => prev.filter((n) => n.id !== action.noteId));
        }
        if (action.type === "delete" && action.note) {
          const { id: _id, ...rest } = action.note;
          void apiRequest("POST", `/api/whiteboard/${board.id}/notes`, {
            text: rest.text,
            noteType: rest.noteType,
            colourHex: rest.colourHex,
            xPosition: rest.xPosition,
            yPosition: rest.yPosition,
            width: rest.width,
            height: rest.height,
          }).then(async (res) => {
            const recreated = await res.json() as StickyNote;
            setNotes((prev) => mergeNotes(prev, recreated));
          });
        }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size && canEdit) {
        e.preventDefault();
        const ids = [...selectedIds];
        if (ids.length >= 3 && !window.confirm(`Delete ${ids.length} notes?`)) return;
        ids.forEach((id) => {
          const note = visibleNotes.find((n) => n.id === id);
          if (note) pushUndo({ type: "delete", note });
        });
        void apiRequest("POST", "/api/whiteboard/notes/bulk-delete", { noteIds: ids, whiteboardId: board.id });
        setNotes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
        setSelectedIds(new Set());
        flashSaved();
      }
      if (e.key.startsWith("Arrow") && !selectedIds.size) {
        setStagePos((p) => ({
          x: p.x + (e.key === "ArrowLeft" ? ARROW_NUDGE : e.key === "ArrowRight" ? -ARROW_NUDGE : 0),
          y: p.y + (e.key === "ArrowUp" ? ARROW_NUDGE : e.key === "ArrowDown" ? -ARROW_NUDGE : 0),
        }));
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, [editingNoteId, selectedIds, canEdit, board.id, flashSaved, visibleNotes]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale + dir * ZOOM_STEP));
    const mousePointTo = { x: (pointer.x - stagePos.x) / scale, y: (pointer.y - stagePos.y) / scale };
    setScale(newScale);
    setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  };

  const finishEditing = useCallback(() => {
    if (editingNoteId == null) return;
    const text = editText;
    setNotes((prev) => patchNoteInList(prev, editingNoteId, { text }));
    void patchNote(editingNoteId, { text }).then(() => flashSaved());
    setEditingNoteId(null);
  }, [editingNoteId, editText, patchNote, flashSaved]);

  const editingNote = visibleNotes.find((n) => n.id === editingNoteId);
  const editColors = editingNote
    ? getNoteColors(editingNote.noteType as NoteType, editingNote.colourHex)
    : null;
  const editFontSize = editingNote
    ? Math.max(11, Math.min(14, 200 / Math.max(editText.length, 1) * 8))
    : 14;
  const editScreenPos = editingNote ? {
    left: editingNote.xPosition * scale + stagePos.x,
    top: editingNote.yPosition * scale + stagePos.y,
    width: editingNote.width * scale,
    height: editingNote.height * scale,
  } : null;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden wb-dot-grid bg-background" onClick={() => setContextMenu(null)}>
      {reconnecting && <div className="wb-reconnect-banner">Reconnecting…</div>}

      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={spaceDown}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (spaceDown) return;
          if (e.target === e.target.getStage()) {
            setSelectedIds(new Set());
            const pos = screenToWorld(e.evt.offsetX, e.evt.offsetY);
            setSelStart(pos);
            setSelectionRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
          }
        }}
        onMouseMove={(e) => {
          const now = Date.now();
          if (now - cursorThrottleRef.current > 66) {
            cursorThrottleRef.current = now;
            const pos = screenToWorld(e.evt.offsetX, e.evt.offsetY);
            wsRef.current?.readyState === WebSocket.OPEN &&
              wsRef.current.send(JSON.stringify({ type: "cursor:moved", payload: { x: pos.x, y: pos.y } }));
          }
          if (selStart) {
            const pos = screenToWorld(e.evt.offsetX, e.evt.offsetY);
            setSelectionRect({
              x: Math.min(selStart.x, pos.x),
              y: Math.min(selStart.y, pos.y),
              w: Math.abs(pos.x - selStart.x),
              h: Math.abs(pos.y - selStart.y),
            });
          }
        }}
        onMouseUp={() => {
          if (selectionRect && selStart) {
            const hits = visibleNotes.filter((n) =>
              n.xPosition < selectionRect.x + selectionRect.w &&
              n.xPosition + n.width > selectionRect.x &&
              n.yPosition < selectionRect.y + selectionRect.h &&
              n.yPosition + n.height > selectionRect.y,
            );
            if (hits.length) setSelectedIds(new Set(hits.map((h) => h.id)));
          }
          setSelStart(null);
          setSelectionRect(null);
        }}
        onDblClick={(e) => {
          if (!canEdit || e.target !== e.target.getStage()) return;
          const pos = screenToWorld(e.evt.offsetX, e.evt.offsetY);
          void createNoteAt(pos.x, pos.y);
        }}
        onDragEnd={(e) => { if (spaceDown) setStagePos({ x: e.target.x(), y: e.target.y() }); }}
        style={{ cursor: spaceDown ? "grab" : "default" }}
      >
        <Layer>
          {visibleNotes.map((note) => (
            <StickyNoteNode
              key={note.id}
              note={note}
              selected={selectedIds.has(note.id)}
              isEditing={editingNoteId === note.id}
              scale={scale}
              canEdit={canEdit}
              onSelect={(id, additive) => {
                setSelectedIds((prev) => {
                  if (additive) {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  }
                  return new Set([id]);
                });
              }}
              onDragEnd={async (id, x, y) => {
                const snapped = { x: snap(x), y: snap(y) };
                setNotes((prev) => patchNoteInList(prev, id, { xPosition: snapped.x, yPosition: snapped.y }));
                await patchNote(id, snapped);
                flashSaved();
              }}
              onResizeEnd={async (id, w, h) => {
                const dims = { width: Math.round(w), height: Math.round(h) };
                setNotes((prev) => patchNoteInList(prev, id, dims));
                await patchNote(id, dims);
                flashSaved();
              }}
              onDblClick={(id) => {
                if (!canEdit) return;
                const n = visibleNotes.find((x) => x.id === id);
                if (n) { setEditingNoteId(id); setEditText(n.text); }
              }}
              onContextMenu={(id, x, y) => setContextMenu({ noteId: id, x, y })}
            />
          ))}
          {selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.w}
              height={selectionRect.h}
              fill="rgba(99,102,241,0.1)"
              stroke="#6366f1"
              strokeWidth={1 / scale}
              dash={[4 / scale, 4 / scale]}
            />
          )}
          {[...remoteCursors.entries()].map(([uid, c]) => (
            <Group key={uid} x={c.x} y={c.y} opacity={Date.now() - c.ts > 3000 ? 0.4 : 1}>
              <Line points={[0, 0, 12, 12, 0, 16]} fill={userColorFromId(uid)} closed />
              <Text text={c.userName} x={14} y={0} fontSize={11 / scale} fill={userColorFromId(uid)} />
            </Group>
          ))}
        </Layer>
      </Stage>

      {editingNote && editScreenPos && editColors && (
        <textarea
          className="wb-note-editor absolute z-30 resize-none outline-none"
          style={{
            left: editScreenPos.left + 10 * scale,
            top: editScreenPos.top + 28 * scale,
            width: Math.max(40, editScreenPos.width - 20 * scale),
            height: Math.max(24, editScreenPos.height - 36 * scale),
            fontSize: `${editFontSize * scale}px`,
            lineHeight: 1.35,
            color: "#1f2937",
            background: editColors.background,
            borderRadius: 4,
          }}
          value={editText}
          placeholder="Type your note…"
          autoFocus
          onChange={(e) => setEditText(e.target.value)}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              setEditText(editingNote.text);
              setEditingNoteId(null);
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              finishEditing();
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {selectedIds.size === 1 && canEdit && editingNoteId == null && (() => {
        const n = visibleNotes.find((x) => selectedIds.has(x.id));
        if (!n) return null;
        return (
          <div
            className="wb-note-color-bar absolute z-20 flex gap-1 p-1.5 rounded-full bg-card border shadow-md"
            style={{
              left: Math.max(8, Math.min(n.xPosition * scale + stagePos.x, size.w - 280)),
              top: Math.max(8, n.yPosition * scale + stagePos.y - 40),
            }}
          >
            {NOTE_TYPES_ORDER.filter((t) => t !== "custom").map((t) => (
              <button
                key={t}
                type="button"
                title={NOTE_TYPE_CONFIG[t].label}
                className="w-6 h-6 rounded-full border-2"
                style={{ background: NOTE_TYPE_CONFIG[t].background, borderColor: NOTE_TYPE_CONFIG[t].border }}
                onClick={async () => {
                  const id = [...selectedIds][0];
                  setLastNoteType(t);
                  localStorage.setItem(LAST_NOTE_COLOR_KEY, t);
                  await patchNote(id, { noteType: t });
                  setNotes((prev) => patchNoteInList(prev, id, { noteType: t }));
                  flashSaved();
                }}
              />
            ))}
            <input
              type="color"
              title="Custom color"
              className="w-6 h-6 rounded-full border-2 cursor-pointer p-0"
              value={customColor}
              onChange={async (e) => {
                const id = [...selectedIds][0];
                const hex = e.target.value;
                setCustomColor(hex);
                setLastNoteType("custom");
                localStorage.setItem(LAST_NOTE_COLOR_KEY, "custom");
                await patchNote(id, { noteType: "custom", colourHex: hex });
                setNotes((prev) => patchNoteInList(prev, id, { noteType: "custom", colourHex: hex }));
                flashSaved();
              }}
            />
          </div>
        );
      })()}

      {contextMenu && (
        <div
          className="absolute z-40 bg-card border rounded-lg shadow-lg py-1 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="block w-full px-4 py-1.5 text-left hover:bg-muted" onClick={async () => {
            const res = await apiRequest("POST", `/api/whiteboard/notes/${contextMenu.noteId}/duplicate`);
            const note = await res.json() as StickyNote;
            setNotes((prev) => mergeNotes(prev, note));
            flashSaved();
            setContextMenu(null);
          }}>Duplicate</button>
          <button type="button" className="block w-full px-4 py-1.5 text-left hover:bg-muted text-destructive" onClick={async () => {
            await apiRequest("DELETE", `/api/whiteboard/notes/${contextMenu.noteId}`);
            setNotes((prev) => prev.filter((n) => n.id !== contextMenu.noteId));
            setContextMenu(null);
            flashSaved();
          }}>Delete</button>
        </div>
      )}

      {showMinimap && visibleNotes.length > 0 && (
        <div className="wb-minimap">
          <svg width="160" height="100" className="cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const cx = (e.clientX - rect.left) / 160;
            const cy = (e.clientY - rect.top) / 100;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            visibleNotes.forEach((n) => {
              minX = Math.min(minX, n.xPosition); minY = Math.min(minY, n.yPosition);
              maxX = Math.max(maxX, n.xPosition + n.width); maxY = Math.max(maxY, n.yPosition + n.height);
            });
            const wx = minX + cx * (maxX - minX);
            const wy = minY + cy * (maxY - minY);
            setStagePos({ x: size.w / 2 - wx * scale, y: size.h / 2 - wy * scale });
          }}>
            {(() => {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              visibleNotes.forEach((n) => {
                minX = Math.min(minX, n.xPosition); minY = Math.min(minY, n.yPosition);
                maxX = Math.max(maxX, n.xPosition + n.width); maxY = Math.max(maxY, n.yPosition + n.height);
              });
              const bw = maxX - minX || 1;
              const bh = maxY - minY || 1;
              return visibleNotes.map((n) => {
                const colors = getNoteColors(n.noteType as NoteType, n.colourHex);
                return (
                  <rect
                    key={n.id}
                    x={((n.xPosition - minX) / bw) * 150 + 5}
                    y={((n.yPosition - minY) / bh) * 90 + 5}
                    width={Math.max(4, (n.width / bw) * 150)}
                    height={Math.max(4, (n.height / bh) * 90)}
                    fill={colors.background}
                    stroke={colors.border}
                    strokeWidth={0.5}
                  />
                );
              });
            })()}
          </svg>
        </div>
      )}
    </div>
  );
});
