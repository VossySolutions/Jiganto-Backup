import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  Clock,
  RefreshCw,
  Users,
  BookOpen,
  Settings,
  FileText,
  Cog,
  PenTool,
  Cloud,
  RotateCcw,
  Database as DatabaseIcon,
  MessageSquare,
  Link2,
  Router,
  Monitor,
  Network,
  Laptop,
  Tablet,
  Smartphone,
  TerminalSquare,
  Building,
  Shield,
  Server,
  Wifi,
  Globe,
  Printer,
  ScanLine,
  MonitorDot,
  type LucideIcon,
} from 'lucide-react';

export type PointerPosition = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right' | 'left' | 'right';

type BpmNodeData = {
  label?: string;
  nodeType?: string;
  pointerPosition?: PointerPosition;
  attributes?: {
    cost?: string | number;
    duration?: string | number;
    frequency?: string | number;
    resources?: string | number;
    learning?: string | number;
    description?: string;
    owner?: string;
    department?: string;
    status?: string;
    automationPercent?: number;
    systemName?: string;
    dataObject?: string;
    outputs?: string[];
    linkedDiagramId?: number;
    linkedDiagramName?: string;
  };
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right';
  };
  imageUrl?: string;
  orientation?: 'horizontal' | 'vertical';
  lanes?: { id: string; label: string }[];
};

type NodeUpdateFn = (nodeId: string, data: any) => void;
const NodeUpdateContext = createContext<NodeUpdateFn | null>(null);
export const NodeUpdateProvider = NodeUpdateContext.Provider;

type DiagramNavigateFn = (diagramId: number) => void;
const DiagramNavigateContext = createContext<DiagramNavigateFn | null>(null);
export const DiagramNavigateProvider = DiagramNavigateContext.Provider;

function EditableCalloutLabel({ nodeId, data, defaultLabel, className }: {
  nodeId: string;
  data: BpmNodeData;
  defaultLabel: string;
  className?: string;
}) {
  const updateNode = useContext(NodeUpdateContext);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.label ?? defaultLabel);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(data.label ?? defaultLabel);
  }, [data.label, defaultLabel]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (!updateNode) return;
    updateNode(nodeId, { ...data, label: text || defaultLabel });
  }, [updateNode, nodeId, data, text, defaultLabel]);

  const align = data.style?.textAlign || 'center';
  const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setText(data.label ?? defaultLabel); setEditing(false); }
        }}
        className={cn(
          'bg-transparent border-none outline-none resize-none font-medium leading-tight w-full',
          'focus:ring-1 focus:ring-primary/50 rounded-sm',
          alignClass,
          className
        )}
        style={{
          color: data.style?.textColor,
          fontSize: data.style?.fontSize ? `${data.style.fontSize}px` : DEFAULT_FONT_SIZE,
          minHeight: '1.2em',
        }}
        data-testid={`input-callout-label-${nodeId}`}
      />
    );
  }

  return (
    <span
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={cn('font-medium leading-tight cursor-text select-none w-full', alignClass, className)}
      style={{
        color: data.style?.textColor,
        fontSize: data.style?.fontSize ? `${data.style.fontSize}px` : DEFAULT_FONT_SIZE,
      }}
      title="Double-click to edit"
      data-testid={`text-callout-label-${nodeId}`}
    >
      {data.label ?? defaultLabel}
    </span>
  );
}

const POINTER_POSITIONS: PointerPosition[] = ['top-left', 'top-center', 'top-right', 'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right'];

const POINTER_DOT_POSITIONS: Record<PointerPosition, { top?: string; bottom?: string; left?: string; right?: string; transform?: string }> = {
  'top-left':      { top: '-12px', left: '15%' },
  'top-center':    { top: '-12px', left: '50%', transform: 'translateX(-50%)' },
  'top-right':     { top: '-12px', right: '15%' },
  'left':          { top: '50%', left: '-12px', transform: 'translateY(-50%)' },
  'right':         { top: '50%', right: '-12px', transform: 'translateY(-50%)' },
  'bottom-left':   { bottom: '-12px', left: '15%' },
  'bottom-center': { bottom: '-12px', left: '50%', transform: 'translateX(-50%)' },
  'bottom-right':  { bottom: '-12px', right: '15%' },
};

function PointerPositionIndicators({ nodeId, data, currentPosition, selected }: { nodeId: string; data: BpmNodeData; currentPosition: PointerPosition; selected: boolean }) {
  const updateNode = useContext(NodeUpdateContext);
  if (!selected || !updateNode) return null;

  return (
    <>
      {POINTER_POSITIONS.map((pos) => (
        <div
          key={pos}
          className={cn(
            'absolute z-30 w-3 h-3 rounded-full border-2 cursor-pointer transition-all',
            pos === currentPosition
              ? 'bg-primary border-primary-foreground scale-110'
              : 'bg-card border-muted-foreground/50 hover:bg-primary/50 hover:border-primary'
          )}
          style={POINTER_DOT_POSITIONS[pos]}
          onClick={(e) => {
            e.stopPropagation();
            updateNode(nodeId, { ...data, pointerPosition: pos });
          }}
          title={`Move pointer: ${pos}`}
          data-testid={`pointer-pos-${pos}-${nodeId}`}
        />
      ))}
    </>
  );
}

function getSquarePath(pp: PointerPosition): string {
  const W = 120, bodyH = 65, tipLen = 23;
  switch (pp) {
    case 'bottom-left':   return `M0 0 L${W} 0 L${W} ${bodyH} L30 ${bodyH} L15 ${bodyH+tipLen} L20 ${bodyH} L0 ${bodyH} Z`;
    case 'bottom-center': return `M0 0 L${W} 0 L${W} ${bodyH} L68 ${bodyH} L60 ${bodyH+tipLen} L52 ${bodyH} L0 ${bodyH} Z`;
    case 'bottom-right':  return `M0 0 L${W} 0 L${W} ${bodyH} L105 ${bodyH} L100 ${bodyH+tipLen} L90 ${bodyH} L0 ${bodyH} Z`;
    case 'top-left':      return `M15 ${tipLen+1} L30 1 L20 ${tipLen+1} L${W} ${tipLen+1} L${W} ${bodyH+tipLen+1} L0 ${bodyH+tipLen+1} L0 ${tipLen+1} Z`;
    case 'top-center':    return `M52 ${tipLen+1} L60 1 L68 ${tipLen+1} L${W} ${tipLen+1} L${W} ${bodyH+tipLen+1} L0 ${bodyH+tipLen+1} L0 ${tipLen+1} Z`;
    case 'top-right':     return `M90 ${tipLen+1} L105 1 L100 ${tipLen+1} L${W} ${tipLen+1} L${W} ${bodyH+tipLen+1} L0 ${bodyH+tipLen+1} L0 ${tipLen+1} Z`;
    case 'left':          return `M0 0 L${W} 0 L${W} ${bodyH} L0 ${bodyH} L0 40 L-15 32 L0 25 Z`;
    case 'right':         return `M0 0 L${W} 0 L${W} 25 L${W+15} 32 L${W} 40 L${W} ${bodyH} L0 ${bodyH} Z`;
    default:              return `M0 0 L${W} 0 L${W} ${bodyH} L30 ${bodyH} L15 ${bodyH+tipLen} L20 ${bodyH} L0 ${bodyH} Z`;
  }
}

function getSquareViewBox(pp: PointerPosition): string {
  switch (pp) {
    case 'top-left': case 'top-center': case 'top-right': return '-1 -1 122 92';
    case 'left': return '-17 -1 139 68';
    case 'right': return '-1 -1 139 68';
    default: return '-1 -1 122 92';
  }
}

function getRoundedPath(pp: PointerPosition): string {
  const R = 10, W = 120, bodyH = 65, tipLen = 23;
  switch (pp) {
    case 'bottom-left':   return `M${R} 0 L${W-R} 0 Q${W} 0 ${W} ${R} L${W} ${bodyH-R} Q${W} ${bodyH} ${W-R} ${bodyH} L30 ${bodyH} L15 ${bodyH+tipLen} L20 ${bodyH} L${R} ${bodyH} Q0 ${bodyH} 0 ${bodyH-R} L0 ${R} Q0 0 ${R} 0 Z`;
    case 'bottom-center': return `M${R} 0 L${W-R} 0 Q${W} 0 ${W} ${R} L${W} ${bodyH-R} Q${W} ${bodyH} ${W-R} ${bodyH} L68 ${bodyH} L60 ${bodyH+tipLen} L52 ${bodyH} L${R} ${bodyH} Q0 ${bodyH} 0 ${bodyH-R} L0 ${R} Q0 0 ${R} 0 Z`;
    case 'bottom-right':  return `M${R} 0 L${W-R} 0 Q${W} 0 ${W} ${R} L${W} ${bodyH-R} Q${W} ${bodyH} ${W-R} ${bodyH} L105 ${bodyH} L100 ${bodyH+tipLen} L90 ${bodyH} L${R} ${bodyH} Q0 ${bodyH} 0 ${bodyH-R} L0 ${R} Q0 0 ${R} 0 Z`;
    case 'top-left':      return `M${R} 24 L15 24 L30 1 L20 24 L${W-R} 24 Q${W} 24 ${W} ${24+R} L${W} ${bodyH+24-R} Q${W} ${bodyH+24} ${W-R} ${bodyH+24} L${R} ${bodyH+24} Q0 ${bodyH+24} 0 ${bodyH+24-R} L0 ${24+R} Q0 24 ${R} 24 Z`;
    case 'top-center':    return `M${R} 24 L52 24 L60 1 L68 24 L${W-R} 24 Q${W} 24 ${W} ${24+R} L${W} ${bodyH+24-R} Q${W} ${bodyH+24} ${W-R} ${bodyH+24} L${R} ${bodyH+24} Q0 ${bodyH+24} 0 ${bodyH+24-R} L0 ${24+R} Q0 24 ${R} 24 Z`;
    case 'top-right':     return `M${R} 24 L90 24 L105 1 L100 24 L${W-R} 24 Q${W} 24 ${W} ${24+R} L${W} ${bodyH+24-R} Q${W} ${bodyH+24} ${W-R} ${bodyH+24} L${R} ${bodyH+24} Q0 ${bodyH+24} 0 ${bodyH+24-R} L0 ${24+R} Q0 24 ${R} 24 Z`;
    case 'left':          return `M${R} 0 L${W-R} 0 Q${W} 0 ${W} ${R} L${W} ${bodyH-R} Q${W} ${bodyH} ${W-R} ${bodyH} L${R} ${bodyH} Q0 ${bodyH} 0 ${bodyH-R} L0 40 L-15 32 L0 25 L0 ${R} Q0 0 ${R} 0 Z`;
    case 'right':         return `M${R} 0 L${W-R} 0 Q${W} 0 ${W} ${R} L${W} 25 L${W+15} 32 L${W} 40 L${W} ${bodyH-R} Q${W} ${bodyH} ${W-R} ${bodyH} L${R} ${bodyH} Q0 ${bodyH} 0 ${bodyH-R} L0 ${R} Q0 0 ${R} 0 Z`;
    default:              return getRoundedPath('bottom-left');
  }
}

function getRoundedViewBox(pp: PointerPosition): string {
  switch (pp) {
    case 'top-left': case 'top-center': case 'top-right': return '-1 -1 122 92';
    case 'left': return '-17 -1 139 68';
    case 'right': return '-1 -1 139 68';
    default: return '-1 -1 122 92';
  }
}

function getOvalElements(pp: PointerPosition): { cx: number; cy: number; rx: number; ry: number; tipPath: string; coverLine: string; viewBox: string } {
  const rx = 58, ry = 28;
  switch (pp) {
    case 'bottom-left':   return { cx: 60, cy: 30, rx, ry, tipPath: 'M45 55 L35 85 L55 52', coverLine: 'M45 55 L55 52', viewBox: '-1 -1 122 92' };
    case 'bottom-center': return { cx: 60, cy: 30, rx, ry, tipPath: 'M55 57 L60 85 L65 57', coverLine: 'M55 57 L65 57', viewBox: '-1 -1 122 92' };
    case 'bottom-right':  return { cx: 60, cy: 30, rx, ry, tipPath: 'M75 55 L85 85 L65 52', coverLine: 'M75 55 L65 52', viewBox: '-1 -1 122 92' };
    case 'top-left':      return { cx: 60, cy: 60, rx, ry, tipPath: 'M45 35 L35 5 L55 38', coverLine: 'M45 35 L55 38', viewBox: '-1 -1 122 92' };
    case 'top-center':    return { cx: 60, cy: 60, rx, ry, tipPath: 'M55 33 L60 5 L65 33', coverLine: 'M55 33 L65 33', viewBox: '-1 -1 122 92' };
    case 'top-right':     return { cx: 60, cy: 60, rx, ry, tipPath: 'M75 35 L85 5 L65 38', coverLine: 'M75 35 L65 38', viewBox: '-1 -1 122 92' };
    case 'left':          return { cx: 70, cy: 40, rx, ry, tipPath: 'M14 35 L-10 50 L14 45', coverLine: 'M14 35 L14 45', viewBox: '-15 -1 140 92' };
    case 'right':         return { cx: 50, cy: 40, rx, ry, tipPath: 'M106 35 L130 50 L106 45', coverLine: 'M106 35 L106 45', viewBox: '-1 -1 140 92' };
    default:              return getOvalElements('bottom-left');
  }
}

function getCloudBubbles(pp: PointerPosition): { b1: { cx: number; cy: number }; b2: { cx: number; cy: number }; b3: { cx: number; cy: number } } {
  switch (pp) {
    case 'bottom-left':   return { b1: { cx: 35, cy: 78 }, b2: { cx: 22, cy: 88 }, b3: { cx: 12, cy: 95 } };
    case 'bottom-center': return { b1: { cx: 65, cy: 78 }, b2: { cx: 65, cy: 88 }, b3: { cx: 65, cy: 95 } };
    case 'bottom-right':  return { b1: { cx: 95, cy: 78 }, b2: { cx: 108, cy: 88 }, b3: { cx: 118, cy: 95 } };
    case 'top-left':      return { b1: { cx: 35, cy: 12 }, b2: { cx: 22, cy: 5 }, b3: { cx: 12, cy: -2 } };
    case 'top-center':    return { b1: { cx: 65, cy: 12 }, b2: { cx: 65, cy: 5 }, b3: { cx: 65, cy: -2 } };
    case 'top-right':     return { b1: { cx: 95, cy: 12 }, b2: { cx: 108, cy: 5 }, b3: { cx: 118, cy: -2 } };
    case 'left':          return { b1: { cx: 8, cy: 50 }, b2: { cx: -3, cy: 55 }, b3: { cx: -12, cy: 58 } };
    case 'right':         return { b1: { cx: 122, cy: 50 }, b2: { cx: 133, cy: 55 }, b3: { cx: 142, cy: 58 } };
    default:              return getCloudBubbles('bottom-left');
  }
}

function getCloudViewBox(pp: PointerPosition): string {
  switch (pp) {
    case 'top-left': case 'top-center': case 'top-right': return '-1 -8 134 80';
    case 'left': return '-18 -1 152 102';
    case 'right': return '-1 -1 152 102';
    default: return '-1 -1 134 102';
  }
}

const handleClass = "!w-2.5 !h-2.5 !bg-primary !border-2 !border-primary-foreground !opacity-0 hover:!opacity-100 transition-opacity";
const handleClassVisible = "!w-2.5 !h-2.5 !bg-primary !border-2 !border-primary-foreground";

function AllHandles({ id, alwaysVisible }: { id?: string; alwaysVisible?: boolean }) {
  const prefix = id ? `${id}-` : '';
  const cls = alwaysVisible ? handleClassVisible : handleClass;
  return (
    <>
      <Handle type="source" position={Position.Top} id={`${prefix}top`} className={cls} />
      <Handle type="source" position={Position.Bottom} id={`${prefix}bottom`} className={cls} />
      <Handle type="source" position={Position.Left} id={`${prefix}left`} className={cls} />
      <Handle type="source" position={Position.Right} id={`${prefix}right`} className={cls} />
    </>
  );
}

const ATTR_ICONS = [
  { key: 'cost', Icon: DollarSign },
  { key: 'duration', Icon: Clock },
  { key: 'frequency', Icon: RefreshCw },
  { key: 'resources', Icon: Users },
  { key: 'learning', Icon: BookOpen },
] as const;

const DEFAULT_FONT_SIZE = '8px';

const BpmAttrVisibilityContext = createContext(false);
export const BpmAttrVisibilityProvider = BpmAttrVisibilityContext.Provider;

const SequenceNumberContext = createContext<Map<string, number>>(new Map());
export const SequenceNumberProvider = SequenceNumberContext.Provider;

function SequenceBadge({ nodeId }: { nodeId: string }) {
  const seqMap = useContext(SequenceNumberContext);
  const num = seqMap.get(nodeId);
  if (num === undefined) return null;
  return (
    <div
      className="absolute -top-2.5 -left-2.5 z-30 bg-primary text-primary-foreground rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold shadow-sm pointer-events-none"
      data-testid={`badge-sequence-${nodeId}`}
    >
      {num}
    </div>
  );
}

function AttrRow({ attrs }: { attrs: Record<string, any> }) {
  const showAttrs = useContext(BpmAttrVisibilityContext);
  if (!showAttrs) return null;
  const hasAttrs = ATTR_ICONS.some(({ key }) => attrs[key]);
  if (!hasAttrs) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2">
      {ATTR_ICONS.map(({ key, Icon }) =>
        attrs[key] ? <Icon key={key} className="w-3 h-3 text-muted-foreground" /> : null
      )}
    </div>
  );
}

function TaskNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const attrs = d.attributes ?? {};
  const fs = d.style?.fontSize;
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-md border bg-card text-card-foreground shadow-sm',
        'w-full h-full min-w-[80px] min-h-[40px] px-2 py-1',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor, color: d.style?.textColor }}
      data-testid={`bpm-node-task-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-6 max-w-[80%] object-contain mb-1" />}
      <span className="font-medium text-center leading-tight" style={{ fontSize: fs ? `${fs}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Task'}</span>
      <AttrRow attrs={attrs} />
    </div>
  );
}

function SubProcessNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const fs = d.style?.fontSize;
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center',
        'w-full h-full min-w-[100px] min-h-[50px] px-3 py-2',
        'rounded-md border-2 border-dashed bg-card text-card-foreground shadow-sm',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor, color: d.style?.textColor }}
      data-testid={`bpm-node-subprocess-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={100} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-6 max-w-[80%] object-contain mb-1" />}
      <span className="font-medium text-center leading-tight" style={{ fontSize: fs ? `${fs}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Sub-Process'}</span>
      <span className="text-[10px] text-muted-foreground mt-1">[+]</span>
    </div>
  );
}

function ManualProcessNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const attrs = d.attributes ?? {};
  const fs = d.style?.fontSize;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div
      className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[80px] min-h-[40px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')}
      data-testid={`bpm-node-manual-process-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 160 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path d="M0 15 L20 0 L160 0 L160 80 L0 80 Z" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <div className="relative z-10 flex flex-col items-center px-4 py-2" style={{ color: d.style?.textColor }}>
        <div className="flex items-center gap-1.5 mb-1">
          <PenTool className="w-3 h-3 text-muted-foreground" />
        </div>
        {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-6 max-w-[80%] object-contain mb-1" />}
        <span className="font-medium text-center leading-tight" style={{ fontSize: fs ? `${fs}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Manual Task'}</span>
        <AttrRow attrs={attrs} />
      </div>
    </div>
  );
}

function AutomatedProcessNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const attrs = d.attributes ?? {};
  const fs = d.style?.fontSize;
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-md border bg-card text-card-foreground shadow-sm',
        'w-full h-full min-w-[80px] min-h-[40px] px-2 py-1',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor, color: d.style?.textColor }}
      data-testid={`bpm-node-automated-process-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <div className="flex items-center gap-1.5 mb-1">
        <Cog className="w-3.5 h-3.5 text-brand-blue" />
      </div>
      {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-6 max-w-[80%] object-contain mb-1" />}
      <span className="font-medium text-center leading-tight" style={{ fontSize: fs ? `${fs}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Automated Task'}</span>
      {attrs.automationPercent !== undefined && (
        <div className="mt-1.5 w-full max-w-[80px] h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-brand-green" style={{ width: `${attrs.automationPercent}%` }} />
        </div>
      )}
      <AttrRow attrs={attrs} />
    </div>
  );
}

function DiamondWrapper({ children, selected, id, className, style, testId }: {
  children: React.ReactNode; selected?: boolean; id?: string; className?: string; style?: React.CSSProperties; testId?: string;
}) {
  return (
    <div className={cn('relative flex items-center justify-center overflow-visible', 'w-full h-full')} data-testid={testId}>
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <div className={cn('absolute inset-[15%] rotate-45 border bg-card shadow-sm', selected && 'ring-2 ring-primary ring-offset-1', className)} style={style} />
      <div className="relative z-10 flex items-center justify-center">{children}</div>
    </div>
  );
}

function DecisionNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const fs = d.style?.fontSize;
  return (
    <DiamondWrapper selected={selected} id={id} style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor }} testId={`bpm-node-decision-${id}`}>
      <span className="font-medium text-center max-w-[40px] leading-tight" style={{ color: d.style?.textColor, fontSize: fs ? `${fs}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Decision'}</span>
    </DiamondWrapper>
  );
}

function GatewayParallelNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  return (
    <DiamondWrapper selected={selected} id={id} className="!bg-foreground" style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor }} testId={`bpm-node-gateway-parallel-${id}`}>
      <span className="text-lg font-bold text-background">+</span>
    </DiamondWrapper>
  );
}

function GatewayExclusiveNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  return (
    <DiamondWrapper selected={selected} id={id} className="!bg-foreground" style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor }} testId={`bpm-node-gateway-exclusive-${id}`}>
      <span className="text-lg font-bold text-background">X</span>
    </DiamondWrapper>
  );
}

function StartNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const fs = d.style?.fontSize;
  return (
    <div
      className={cn('relative flex items-center justify-center', 'w-full h-full min-w-[50px] min-h-[50px] rounded-full border-2 shadow-sm', selected && 'ring-2 ring-primary ring-offset-1')}
      style={{ backgroundColor: d.style?.backgroundColor ?? 'hsl(var(--accent-green) / 0.25)', borderColor: d.style?.borderColor ?? 'hsl(var(--accent-green))' }}
      data-testid={`bpm-node-start-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={50} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <span className="font-semibold" style={{ color: d.style?.textColor, fontSize: fs ? `${fs}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Start'}</span>
    </div>
  );
}

function EndNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const fs = d.style?.fontSize;
  return (
    <div
      className={cn('relative flex items-center justify-center', 'w-full h-full min-w-[50px] min-h-[50px] rounded-full border-[3px] shadow-sm', selected && 'ring-2 ring-primary ring-offset-1')}
      style={{ backgroundColor: d.style?.backgroundColor ?? 'hsl(var(--accent-green) / 0.5)', borderColor: d.style?.borderColor ?? 'hsl(var(--accent-green))' }}
      data-testid={`bpm-node-end-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={50} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <span className="font-semibold" style={{ color: d.style?.textColor, fontSize: fs ? `${fs}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'End'}</span>
    </div>
  );
}

function DataObjectNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex items-center justify-center w-full h-full min-w-[35px] min-h-[45px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-data-object-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={35} minHeight={45} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 80 100" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <path d="M0 4 C0 2 2 0 4 0 L56 0 L80 24 L80 96 C80 98 78 100 76 100 L4 100 C2 100 0 98 0 96 Z" fill={bg} stroke={border} strokeWidth="1.5" />
        <path d="M56 0 L56 24 L80 24" fill="hsl(var(--muted))" stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center px-2 mt-3 leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Data'}</span>
    </div>
  );
}

function DocumentNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[40px] min-h-[50px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-document-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 90 100" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <path d="M0 4 C0 2 2 0 4 0 L62 0 L90 28 L90 96 C90 98 88 100 86 100 L4 100 C2 100 0 98 0 96 Z" fill={bg} stroke={border} strokeWidth="1.5" />
        <path d="M62 0 L62 28 L90 28" fill="hsl(var(--muted))" stroke={border} strokeWidth="1.5" />
        <line x1="14" y1="42" x2="60" y2="42" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.4" />
        <line x1="14" y1="54" x2="70" y2="54" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.4" />
        <line x1="14" y1="66" x2="55" y2="66" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.4" />
      </svg>
      <div className="relative z-10 flex flex-col items-center mt-1">
        <FileText className="w-4 h-4 text-muted-foreground mb-1" />
        <span className="font-medium text-center px-2 leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Document'}</span>
      </div>
    </div>
  );
}

function SystemNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-md border bg-card text-card-foreground shadow-sm',
        'w-full h-full min-w-[80px] min-h-[40px] px-2 py-1',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor, color: d.style?.textColor }}
      data-testid={`bpm-node-system-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-6 max-w-[80%] object-contain mb-1" />}
      <div className="flex items-center gap-1.5">
        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium text-center leading-tight" style={{ fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'System'}</span>
      </div>
    </div>
  );
}

function DatabaseNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[40px] min-h-[45px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-database-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={45} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 80 100" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="40" cy="15" rx="38" ry="13" fill={bg} stroke={border} strokeWidth="1.5" />
        <path d="M2 15 L2 85 C2 92 19 98 40 98 C61 98 78 92 78 85 L78 15" fill={bg} stroke={border} strokeWidth="1.5" />
        <ellipse cx="40" cy="85" rx="38" ry="13" fill="none" stroke={border} strokeWidth="1.5" />
      </svg>
      <div className="relative z-10 flex flex-col items-center mt-4">
        <DatabaseIcon className="w-3.5 h-3.5 text-muted-foreground mb-1" />
        <span className="font-medium text-center px-2 leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Database'}</span>
      </div>
    </div>
  );
}

function ManualInputNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[80px] min-h-[40px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-manual-input-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 160 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path d="M0 20 L160 0 L160 80 L0 80 Z" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <div className="relative z-10 flex flex-col items-center px-4 py-3" style={{ color: d.style?.textColor }}>
        <span className="font-medium text-center leading-tight" style={{ fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Manual Input'}</span>
      </div>
    </div>
  );
}

function AnnotationNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const border = d.style?.borderColor ?? 'hsl(var(--muted-foreground))';
  const notes = d.attributes?.description || '';
  return (
    <div className={cn('relative flex items-start w-full h-full min-w-[80px] min-h-[30px] py-1 px-2', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-annotation-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={30} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <div className="border-l-2 pl-3 h-full flex flex-col justify-center overflow-hidden" style={{ borderColor: border }}>
        <div className="flex items-start gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-muted-foreground leading-tight font-medium" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Annotation'}</span>
        </div>
        {notes && (
          <p className="text-muted-foreground/70 leading-tight mt-1 pl-5 text-[10px] whitespace-pre-wrap overflow-hidden">{notes}</p>
        )}
      </div>
    </div>
  );
}

function CalloutSquareNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  const pp = d.pointerPosition ?? 'bottom-left';
  const notes = d.attributes?.description || '';
  const align = d.style?.textAlign || 'center';
  const alignItems = align === 'left' ? 'items-start' : align === 'right' ? 'items-end' : 'items-center';
  const textAlignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  return (
    <div className={cn('relative flex flex-col items-center justify-start w-full h-full min-w-[60px] min-h-[50px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-callout-square-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <PointerPositionIndicators nodeId={id} data={d} currentPosition={pp} selected={!!selected} />
      <svg viewBox={getSquareViewBox(pp)} className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <path d={getSquarePath(pp)} fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <div className={cn('relative z-10 flex flex-col w-full px-3 py-2 overflow-hidden', alignItems)} style={{ color: d.style?.textColor }}>
        <EditableCalloutLabel nodeId={id} data={d} defaultLabel="Callout" />
        {notes && <p className={cn('text-[9px] leading-tight mt-0.5 opacity-70 whitespace-pre-wrap max-w-full overflow-hidden w-full', textAlignClass)}>{notes}</p>}
      </div>
    </div>
  );
}

function CalloutRoundedNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  const pp = d.pointerPosition ?? 'bottom-left';
  const notes = d.attributes?.description || '';
  const align = d.style?.textAlign || 'center';
  const alignItems = align === 'left' ? 'items-start' : align === 'right' ? 'items-end' : 'items-center';
  const textAlignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  return (
    <div className={cn('relative flex flex-col items-center justify-start w-full h-full min-w-[60px] min-h-[50px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-callout-rounded-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <PointerPositionIndicators nodeId={id} data={d} currentPosition={pp} selected={!!selected} />
      <svg viewBox={getRoundedViewBox(pp)} className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <path d={getRoundedPath(pp)} fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <div className={cn('relative z-10 flex flex-col w-full px-3 py-2 overflow-hidden', alignItems)} style={{ color: d.style?.textColor }}>
        <EditableCalloutLabel nodeId={id} data={d} defaultLabel="Callout" />
        {notes && <p className={cn('text-[9px] leading-tight mt-0.5 opacity-70 whitespace-pre-wrap max-w-full overflow-hidden w-full', textAlignClass)}>{notes}</p>}
      </div>
    </div>
  );
}

function CalloutOvalNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  const pp = d.pointerPosition ?? 'bottom-left';
  const notes = d.attributes?.description || '';
  const oval = getOvalElements(pp);
  const align = d.style?.textAlign || 'center';
  const alignItems = align === 'left' ? 'items-start' : align === 'right' ? 'items-end' : 'items-center';
  const textAlignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  return (
    <div className={cn('relative flex flex-col items-center justify-start w-full h-full min-w-[60px] min-h-[50px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-callout-oval-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <PointerPositionIndicators nodeId={id} data={d} currentPosition={pp} selected={!!selected} />
      <svg viewBox={oval.viewBox} className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <ellipse cx={oval.cx} cy={oval.cy} rx={oval.rx} ry={oval.ry} fill={bg} stroke={border} strokeWidth="1.5" />
        <path d={oval.tipPath} fill={bg} stroke={border} strokeWidth="1.5" />
        <path d={oval.coverLine} stroke={bg} strokeWidth="3" fill="none" />
      </svg>
      <div className={cn('relative z-10 flex flex-col w-full px-4 py-2 overflow-hidden', alignItems)} style={{ color: d.style?.textColor }}>
        <EditableCalloutLabel nodeId={id} data={d} defaultLabel="Callout" />
        {notes && <p className={cn('text-[9px] leading-tight mt-0.5 opacity-70 whitespace-pre-wrap max-w-full overflow-hidden w-full', textAlignClass)}>{notes}</p>}
      </div>
    </div>
  );
}

function CalloutCloudNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  const pp = d.pointerPosition ?? 'bottom-left';
  const notes = d.attributes?.description || '';
  const bubbles = getCloudBubbles(pp);
  const align = d.style?.textAlign || 'center';
  const alignItems = align === 'left' ? 'items-start' : align === 'right' ? 'items-end' : 'items-center';
  const textAlignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  return (
    <div className={cn('relative flex flex-col items-center justify-start w-full h-full min-w-[70px] min-h-[55px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-callout-cloud-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={70} minHeight={55} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <PointerPositionIndicators nodeId={id} data={d} currentPosition={pp} selected={!!selected} />
      <svg viewBox={getCloudViewBox(pp)} className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid meet">
        <path d="M30 65 Q10 65 10 50 Q10 38 22 35 Q18 22 30 15 Q42 5 58 10 Q68 3 80 8 Q92 3 100 15 Q115 18 118 32 Q125 40 118 52 Q122 62 110 65 Z" fill={bg} stroke={border} strokeWidth="1.5" />
        <ellipse cx={bubbles.b1.cx} cy={bubbles.b1.cy} rx="7" ry="5" fill={bg} stroke={border} strokeWidth="1.2" />
        <ellipse cx={bubbles.b2.cx} cy={bubbles.b2.cy} rx="5" ry="3.5" fill={bg} stroke={border} strokeWidth="1.2" />
        <ellipse cx={bubbles.b3.cx} cy={bubbles.b3.cy} rx="3" ry="2.5" fill={bg} stroke={border} strokeWidth="1" />
      </svg>
      <div className={cn('relative z-10 flex flex-col w-full px-4 py-2 overflow-hidden', alignItems)} style={{ color: d.style?.textColor }}>
        <EditableCalloutLabel nodeId={id} data={d} defaultLabel="Thought" />
        {notes && <p className={cn('text-[9px] leading-tight mt-0.5 opacity-70 whitespace-pre-wrap max-w-full overflow-hidden w-full', textAlignClass)}>{notes}</p>}
      </div>
    </div>
  );
}

function NoteFoldedNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[50px] min-h-[50px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-note-folded-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={50} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path d="M0 0 L80 0 L100 20 L100 100 L0 100 Z" fill={bg} stroke={border} strokeWidth="1.5" />
        <path d="M80 0 L80 20 L100 20" fill="none" stroke={border} strokeWidth="1.5" />
        <path d="M80 0 L80 20 L100 20 Z" fill="hsl(var(--muted))" stroke={border} strokeWidth="0.5" opacity="0.5" />
      </svg>
      <div className="relative z-10 flex flex-col items-center px-3 py-2" style={{ color: d.style?.textColor }}>
        <EditableCalloutLabel nodeId={id} data={d} defaultLabel="Note" />
      </div>
    </div>
  );
}

function NoteLinedNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[50px] min-h-[50px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-note-lined-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={50} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="100" fill={bg} stroke={border} strokeWidth="1.5" />
        <line x1="8" y1="0" x2="0" y2="20" stroke={border} strokeWidth="1.5" />
      </svg>
      <div className="relative z-10 flex flex-col items-center px-3 py-2" style={{ color: d.style?.textColor }}>
        <EditableCalloutLabel nodeId={id} data={d} defaultLabel="Note" />
      </div>
    </div>
  );
}

function CloudSystemNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[70px] min-h-[45px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-cloud-system-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={70} minHeight={45} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 160 100" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <path d="M32 80 C10 80 2 68 6 56 C2 48 8 36 22 34 C24 18 42 8 62 10 C78 4 100 8 110 22 C130 18 152 28 150 48 C158 56 154 72 138 78 C136 80 134 80 132 80 Z" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <div className="relative z-10 flex flex-col items-center" style={{ color: d.style?.textColor }}>
        <Cloud className="w-4 h-4 text-muted-foreground mb-1" />
        <span className="font-medium text-center px-2 leading-tight" style={{ fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'External System'}</span>
      </div>
    </div>
  );
}

function LoopNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const attrs = d.attributes ?? {};
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-md border bg-card text-card-foreground shadow-sm',
        'w-full h-full min-w-[80px] min-h-[40px] px-2 py-1',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor, color: d.style?.textColor }}
      data-testid={`bpm-node-loop-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-6 max-w-[80%] object-contain mb-1" />}
      <span className="font-medium text-center leading-tight" style={{ fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Loop'}</span>
      <RotateCcw className="w-3.5 h-3.5 text-muted-foreground mt-1" />
      <AttrRow attrs={attrs} />
    </div>
  );
}

function DelayNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[70px] min-h-[36px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-delay-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={70} minHeight={36} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 160 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path d="M0 0 L120 0 C160 0 160 80 120 80 L0 80 Z" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Delay'}</span>
    </div>
  );
}

function DisplayNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[70px] min-h-[36px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-display-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={70} minHeight={36} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 160 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path d="M30 0 L120 0 C160 0 160 80 120 80 L30 80 C10 40 10 40 30 0 Z" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Display'}</span>
    </div>
  );
}

function PredefinedProcessNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const attrs = d.attributes ?? {};
  const fs = d.style?.fontSize;
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-md border bg-card text-card-foreground shadow-sm',
        'w-full h-full min-w-[80px] min-h-[40px] px-3 py-1',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor, color: d.style?.textColor }}
      data-testid={`bpm-node-predefined-process-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <div className="absolute left-2 top-0 bottom-0 w-px" style={{ backgroundColor: d.style?.borderColor ?? 'hsl(var(--border))' }} />
      <div className="absolute right-2 top-0 bottom-0 w-px" style={{ backgroundColor: d.style?.borderColor ?? 'hsl(var(--border))' }} />
      {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-6 max-w-[80%] object-contain mb-1" />}
      <span className="font-medium text-center leading-tight" style={{ fontSize: fs ? `${fs}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Predefined Process'}</span>
      <AttrRow attrs={attrs} />
    </div>
  );
}

function MultiDocumentNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[45px] min-h-[55px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-multi-document-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={45} minHeight={55} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 100 110" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <rect x="16" y="0" width="76" height="85" rx="3" fill={bg} stroke={border} strokeWidth="1" opacity="0.5" />
        <rect x="8" y="8" width="76" height="85" rx="3" fill={bg} stroke={border} strokeWidth="1" opacity="0.7" />
        <rect x="0" y="16" width="76" height="85" rx="3" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <div className="relative z-10 flex flex-col items-center mt-2">
        <FileText className="w-4 h-4 text-muted-foreground mb-1" />
        <span className="font-medium text-center px-2 leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Multi-Doc'}</span>
      </div>
    </div>
  );
}

function InternalStorageNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-md border bg-card text-card-foreground shadow-sm',
        'w-full h-full min-w-[45px] min-h-[40px] px-2 py-1',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor, color: d.style?.textColor }}
      data-testid={`bpm-node-internal-storage-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={45} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <div className="absolute left-3 top-0 bottom-0 w-px" style={{ backgroundColor: d.style?.borderColor ?? 'hsl(var(--border))' }} />
      <div className="absolute left-0 right-0 top-3 h-px" style={{ backgroundColor: d.style?.borderColor ?? 'hsl(var(--border))' }} />
      <span className="font-medium text-center leading-tight mt-1" style={{ fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Internal Storage'}</span>
    </div>
  );
}

function ExtractNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex items-center justify-center w-[100px] h-[90px]', selected && 'ring-2 ring-primary ring-offset-1')} data-testid={`bpm-node-extract-${id}`}>
      <AllHandles id={id} />
      <svg viewBox="0 0 100 90" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <polygon points="50,0 100,90 0,90" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center mt-6 leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Extract'}</span>
    </div>
  );
}

function MergeNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex items-center justify-center w-[100px] h-[90px]', selected && 'ring-2 ring-primary ring-offset-1')} data-testid={`bpm-node-merge-${id}`}>
      <AllHandles id={id} />
      <svg viewBox="0 0 100 90" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <polygon points="0,0 100,0 50,90" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center mb-4 leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Merge'}</span>
    </div>
  );
}

function SortNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex items-center justify-center w-[100px] h-[100px]', selected && 'ring-2 ring-primary ring-offset-1')} data-testid={`bpm-node-sort-${id}`}>
      <AllHandles id={id} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <polygon points="50,0 100,50 50,100 0,50" fill={bg} stroke={border} strokeWidth="1.5" />
        <line x1="0" y1="50" x2="100" y2="50" stroke={border} strokeWidth="1" />
      </svg>
      <span className="relative z-10 font-medium text-center leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Sort'}</span>
    </div>
  );
}

function CollateNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex items-center justify-center w-[100px] h-[100px]', selected && 'ring-2 ring-primary ring-offset-1')} data-testid={`bpm-node-collate-${id}`}>
      <AllHandles id={id} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
        <polygon points="0,0 100,0 50,50" fill={bg} stroke={border} strokeWidth="1.5" />
        <polygon points="50,50 100,100 0,100" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Collate'}</span>
    </div>
  );
}

function StoredDataNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex flex-col items-center justify-center w-full h-full min-w-[60px] min-h-[36px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-stored-data-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={36} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 140 80" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="none">
        <path d="M20 0 L140 0 L140 80 L20 80 C0 80 0 0 20 0 Z" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center leading-tight pl-2" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Stored Data'}</span>
    </div>
  );
}

function OffPageRefNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  const attrs = d.attributes ?? {};
  const navigateToDiagram = useContext(DiagramNavigateContext);
  const isLinked = !!attrs.linkedDiagramId;

  const handleDoubleClick = useCallback(() => {
    if (isLinked && attrs.linkedDiagramId && navigateToDiagram) {
      navigateToDiagram(attrs.linkedDiagramId);
    }
  }, [isLinked, attrs.linkedDiagramId, navigateToDiagram]);

  return (
    <div
      className={cn('relative flex flex-col items-center w-full h-full min-w-[40px] min-h-[50px]', selected && 'ring-2 ring-primary ring-offset-1')}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: isLinked ? 'pointer' : undefined }}
      data-testid={`bpm-node-off-page-ref-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <div className="relative flex items-center justify-center w-full h-full">
        <AllHandles id={id} />
        <svg viewBox="0 0 70 80" className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
          <polygon points="0,0 70,0 70,55 35,80 0,55" fill={bg} stroke={border} strokeWidth="1.5" />
        </svg>
        <span className="relative z-10 font-medium text-center leading-tight mb-2" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>{d.label ?? 'Off-Page'}</span>
        {isLinked && (
          <div className="absolute top-0.5 right-0.5 z-20">
            <Link2 className="w-3 h-3 text-primary" />
          </div>
        )}
      </div>
      {isLinked && attrs.linkedDiagramName && (
        <span className="text-[8px] text-primary truncate max-w-full text-center mt-0.5 leading-tight" title={`Go to: ${attrs.linkedDiagramName}`}>
          {attrs.linkedDiagramName}
        </span>
      )}
    </div>
  );
}

function TerminatorNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex items-center justify-center w-full h-full min-w-[70px] min-h-[30px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-full')} data-testid={`bpm-node-terminator-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={70} minHeight={30} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 160 60" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <rect x="1" y="1" width="158" height="58" rx="29" ry="29" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Terminator'}</span>
    </div>
  );
}

function PreparationNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--card))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative flex items-center justify-center w-full h-full min-w-[70px] min-h-[36px]', selected && 'ring-2 ring-primary ring-offset-1')} data-testid={`bpm-node-preparation-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={70} minHeight={36} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 160 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <polygon points="25,0 135,0 160,40 135,80 25,80 0,40" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <span className="relative z-10 font-medium text-center leading-tight" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? 'Preparation'}</span>
    </div>
  );
}

function SwimlanePoolNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const orientation = d.orientation || 'horizontal';
  const bg = d.style?.backgroundColor ?? 'hsl(var(--muted) / 0.3)';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'relative border-2 rounded-md',
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
      style={{
        backgroundColor: bg,
        borderColor: border,
        minWidth: isHorizontal ? 800 : 300,
        minHeight: isHorizontal ? 200 : 600,
        width: '100%',
        height: '100%',
      }}
      data-testid={`bpm-node-swimlane-pool-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={isHorizontal ? 400 : 200} minHeight={isHorizontal ? 150 : 300} lineClassName="!border-primary" handleClassName="!w-2.5 !h-2.5 !bg-primary !border-white" />
      {isHorizontal ? (
        <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center border-r" style={{ borderColor: border, backgroundColor: 'hsl(var(--primary) / 0.08)' }}>
          <span className="font-semibold text-foreground [writing-mode:vertical-rl] rotate-180 whitespace-nowrap" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>
            {d.label ?? 'Pool'}
          </span>
        </div>
      ) : (
        <div className="absolute left-0 right-0 top-0 h-8 flex items-center justify-center border-b" style={{ borderColor: border, backgroundColor: 'hsl(var(--primary) / 0.08)' }}>
          <span className="font-semibold text-foreground whitespace-nowrap" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>
            {d.label ?? 'Pool'}
          </span>
        </div>
      )}
    </div>
  );
}

function SwimlaneLaneNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const orientation = d.orientation || 'horizontal';
  const bg = d.style?.backgroundColor ?? 'transparent';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn('relative border', selected && 'ring-2 ring-primary ring-offset-1')}
      style={{
        backgroundColor: bg,
        borderColor: border,
        minWidth: isHorizontal ? 700 : 250,
        minHeight: isHorizontal ? 150 : 200,
        width: '100%',
        height: '100%',
      }}
      data-testid={`bpm-node-swimlane-lane-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={isHorizontal ? 300 : 150} minHeight={isHorizontal ? 100 : 150} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      {isHorizontal ? (
        <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center border-r bg-muted/30" style={{ borderColor: border }}>
          <span className="font-medium text-muted-foreground [writing-mode:vertical-rl] rotate-180 whitespace-nowrap" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>
            {d.label ?? 'Lane'}
          </span>
        </div>
      ) : (
        <div className="absolute left-0 right-0 top-0 h-6 flex items-center justify-center border-b bg-muted/30" style={{ borderColor: border }}>
          <span className="font-medium text-muted-foreground whitespace-nowrap" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>
            {d.label ?? 'Lane'}
          </span>
        </div>
      )}
    </div>
  );
}

function createInfraNode(Icon: LucideIcon, defaultLabel: string, testIdSuffix: string) {
  return function InfraNode({ data, selected, id }: NodeProps) {
    const d = data as BpmNodeData;
    return (
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-md border bg-card text-card-foreground shadow-sm',
          'w-full h-full min-w-[80px] min-h-[50px] px-2 py-1',
          selected && 'ring-2 ring-primary ring-offset-1'
        )}
        style={{ backgroundColor: d.style?.backgroundColor, borderColor: d.style?.borderColor, color: d.style?.textColor }}
        data-testid={`bpm-node-${testIdSuffix}-${id}`}
      >
        <NodeResizer isVisible={!!selected} minWidth={80} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
        <AllHandles id={id} />
        <Icon className="w-5 h-5 text-muted-foreground mb-1" />
        <span className="font-medium text-center leading-tight" style={{ fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : DEFAULT_FONT_SIZE }}>{d.label ?? defaultLabel}</span>
      </div>
    );
  };
}

const RouterNode = createInfraNode(Router, 'Router', 'router');
const WorkstationNode = createInfraNode(Monitor, 'Workstation', 'workstation');
const EthernetSwitchNode = createInfraNode(Network, 'Ethernet Switch', 'ethernet-switch');
const ComputerNode = createInfraNode(Monitor, 'Computer', 'computer');
const LaptopNode = createInfraNode(Laptop, 'Laptop', 'laptop');
const MobileDeviceNode = createInfraNode(Tablet, 'Mobile Device', 'mobile-device');
const SmartPhoneNode = createInfraNode(Smartphone, 'Smart Phone', 'smartphone');
const TerminalNode = createInfraNode(TerminalSquare, 'Terminal', 'terminal');
const IspNode = createInfraNode(Building, 'ISP', 'isp');
const SwitchNode = createInfraNode(Network, 'Switch', 'switch');
const FirewallNode = createInfraNode(Shield, 'Firewall', 'firewall');
const ServerNode = createInfraNode(Server, 'Server', 'server');
const WirelessApNode = createInfraNode(Wifi, 'Wireless AP', 'wireless-ap');
const InternetNode = createInfraNode(Globe, 'The Internet', 'internet');
const CloudNode = createInfraNode(Cloud, 'The Cloud', 'cloud');
const PrinterNode = createInfraNode(Printer, 'Printer', 'printer');
const ScannerNode = createInfraNode(ScanLine, 'Scanner', 'scanner');
const DesktopPcNode = createInfraNode(MonitorDot, 'Desktop PC', 'desktop-pc');

function BasicRectangleNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'transparent';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div
      className={cn('relative border-2 rounded-sm', selected && 'ring-2 ring-primary ring-offset-2')}
      style={{ backgroundColor: bg, borderColor: border, minWidth: 120, minHeight: 80, width: '100%', height: '100%' }}
      data-testid={`bpm-node-basic-rect-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <div className="absolute top-1 left-2 text-[10px] font-medium text-muted-foreground" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>
        {d.label || ''}
      </div>
    </div>
  );
}

function BasicRoundedRectNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'transparent';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div
      className={cn('relative border-2 rounded-xl', selected && 'ring-2 ring-primary ring-offset-2')}
      style={{ backgroundColor: bg, borderColor: border, minWidth: 120, minHeight: 80, width: '100%', height: '100%' }}
      data-testid={`bpm-node-basic-rounded-rect-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <div className="absolute top-1 left-2 text-[10px] font-medium text-muted-foreground" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>
        {d.label || ''}
      </div>
    </div>
  );
}

function BasicCircleNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'transparent';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div
      className={cn('relative rounded-full border-2', selected && 'ring-2 ring-primary ring-offset-2')}
      style={{ backgroundColor: bg, borderColor: border, minWidth: 100, minHeight: 100, width: '100%', height: '100%', aspectRatio: '1' }}
      data-testid={`bpm-node-basic-circle-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={60} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>
        {d.label || ''}
      </div>
    </div>
  );
}

function BasicOvalNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'transparent';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div
      className={cn('relative border-2', selected && 'ring-2 ring-primary ring-offset-2')}
      style={{ backgroundColor: bg, borderColor: border, borderRadius: '50%', minWidth: 140, minHeight: 80, width: '100%', height: '100%' }}
      data-testid={`bpm-node-basic-oval-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={80} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>
        {d.label || ''}
      </div>
    </div>
  );
}

function BasicTriangleNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'transparent';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative w-full h-full min-w-[80px] min-h-[70px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-basic-triangle-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={50} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 100 87" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <polygon points="50,2 98,85 2,85" fill={bg} stroke={border} strokeWidth="2" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pt-4 text-[10px] font-medium text-muted-foreground" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>
        {d.label || ''}
      </div>
    </div>
  );
}

function HorizontalLineNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const border = d.style?.borderColor ?? 'hsl(var(--foreground))';
  return (
    <div className={cn('relative flex items-center w-full h-full min-w-[100px] min-h-[20px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-h-line-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={10} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-primary !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-primary !border-white" />
      <div className="w-full" style={{ borderTop: `2px solid ${border}` }} />
    </div>
  );
}

function HorizontalDashedLineNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const border = d.style?.borderColor ?? 'hsl(var(--foreground))';
  return (
    <div className={cn('relative flex items-center w-full h-full min-w-[100px] min-h-[20px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-h-dashed-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={10} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-primary !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-primary !border-white" />
      <div className="w-full" style={{ borderTop: `2px dashed ${border}` }} />
    </div>
  );
}

function VerticalLineNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const border = d.style?.borderColor ?? 'hsl(var(--foreground))';
  return (
    <div className={cn('relative flex justify-center w-full h-full min-w-[20px] min-h-[100px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-v-line-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={10} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 !bg-primary !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-primary !border-white" />
      <div className="h-full" style={{ borderLeft: `2px solid ${border}` }} />
    </div>
  );
}

function VerticalDashedLineNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const border = d.style?.borderColor ?? 'hsl(var(--foreground))';
  return (
    <div className={cn('relative flex justify-center w-full h-full min-w-[20px] min-h-[100px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-v-dashed-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={10} minHeight={40} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 !bg-primary !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-primary !border-white" />
      <div className="h-full" style={{ borderLeft: `2px dashed ${border}` }} />
    </div>
  );
}

function TextLabelNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  return (
    <div
      className={cn('relative flex items-center justify-center w-full h-full min-w-[60px] min-h-[24px] px-2 py-1', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')}
      data-testid={`bpm-node-text-label-${id}`}
    >
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={20} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <EditableCalloutLabel nodeId={id} data={d} defaultLabel="Text" className={cn('font-medium text-center leading-tight')} />
    </div>
  );
}

function ArrowShapeNode({ data, selected, id }: NodeProps) {
  const d = data as BpmNodeData;
  const bg = d.style?.backgroundColor ?? 'hsl(var(--muted))';
  const border = d.style?.borderColor ?? 'hsl(var(--border))';
  return (
    <div className={cn('relative w-full h-full min-w-[100px] min-h-[40px]', selected && 'ring-2 ring-primary ring-offset-1 rounded-sm')} data-testid={`bpm-node-arrow-shape-${id}`}>
      <NodeResizer isVisible={!!selected} minWidth={60} minHeight={30} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-primary !border-white" />
      <AllHandles id={id} />
      <svg viewBox="0 0 120 50" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <polygon points="0,10 85,10 85,0 120,25 85,50 85,40 0,40" fill={bg} stroke={border} strokeWidth="1.5" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pr-4 text-[10px] font-medium text-muted-foreground" style={{ color: d.style?.textColor, fontSize: d.style?.fontSize ? `${d.style.fontSize}px` : '10px' }}>
        {d.label || ''}
      </div>
    </div>
  );
}

function withSequenceBadge<P extends NodeProps>(Component: React.ComponentType<P>) {
  return function WrappedNode(props: P) {
    return (
      <>
        <SequenceBadge nodeId={props.id} />
        <Component {...props} />
      </>
    );
  };
}

const NO_ROTATION_TYPES = new Set(['swimlane_pool', 'swimlane_lane']);

function withRotation<P extends NodeProps>(Component: React.ComponentType<P>) {
  return function RotatedNode(props: P) {
    const rotation = Number((props.data as any)?.style?.rotation) || 0;
    if (rotation === 0 || NO_ROTATION_TYPES.has(props.type || '')) {
      return <Component {...props} />;
    }
    return (
      <div style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center', width: '100%', height: '100%' }}>
        <Component {...props} />
      </div>
    );
  };
}

const SWIMLANE_NODE_TYPES = new Set([
  'swimlane_pool', 'swimlane_lane',
  'basic_rectangle', 'basic_rounded_rect', 'basic_circle', 'basic_oval', 'basic_triangle',
  'line_horizontal', 'line_horizontal_dashed', 'line_vertical', 'line_vertical_dashed',
  'basic_text_label', 'basic_arrow',
]);

function wrapNodeTypes(types: Record<string, React.ComponentType<any>>) {
  const wrapped: Record<string, React.ComponentType<any>> = {};
  for (const [key, Component] of Object.entries(types)) {
    const rotated = withRotation(Component);
    wrapped[key] = SWIMLANE_NODE_TYPES.has(key) ? rotated : withSequenceBadge(rotated);
  }
  return wrapped;
}

export const nodeTypes = wrapNodeTypes({
  task: TaskNode,
  decision: DecisionNode,
  gateway_parallel: GatewayParallelNode,
  gateway_exclusive: GatewayExclusiveNode,
  start: StartNode,
  end: EndNode,
  subprocess: SubProcessNode,
  data_object: DataObjectNode,
  document: DocumentNode,
  system: SystemNode,
  manual_process: ManualProcessNode,
  automated_process: AutomatedProcessNode,
  database: DatabaseNode,
  manual_input: ManualInputNode,
  annotation: AnnotationNode,
  callout_square: CalloutSquareNode,
  callout_rounded: CalloutRoundedNode,
  callout_oval: CalloutOvalNode,
  callout_cloud: CalloutCloudNode,
  note_folded: NoteFoldedNode,
  note_lined: NoteLinedNode,
  cloud_system: CloudSystemNode,
  loop: LoopNode,
  delay: DelayNode,
  display: DisplayNode,
  predefined_process: PredefinedProcessNode,
  multi_document: MultiDocumentNode,
  internal_storage: InternalStorageNode,
  extract: ExtractNode,
  merge: MergeNode,
  sort: SortNode,
  collate: CollateNode,
  stored_data: StoredDataNode,
  off_page_ref: OffPageRefNode,
  terminator: TerminatorNode,
  preparation: PreparationNode,
  swimlane_pool: SwimlanePoolNode,
  swimlane_lane: SwimlaneLaneNode,
  infra_router: RouterNode,
  infra_workstation: WorkstationNode,
  infra_ethernet_switch: EthernetSwitchNode,
  infra_computer: ComputerNode,
  infra_laptop: LaptopNode,
  infra_mobile_device: MobileDeviceNode,
  infra_smartphone: SmartPhoneNode,
  infra_terminal: TerminalNode,
  infra_isp: IspNode,
  infra_switch: SwitchNode,
  infra_firewall: FirewallNode,
  infra_server: ServerNode,
  infra_wireless_ap: WirelessApNode,
  infra_internet: InternetNode,
  infra_cloud: CloudNode,
  infra_printer: PrinterNode,
  infra_scanner: ScannerNode,
  infra_desktop_pc: DesktopPcNode,
  basic_rectangle: BasicRectangleNode,
  basic_rounded_rect: BasicRoundedRectNode,
  basic_circle: BasicCircleNode,
  basic_oval: BasicOvalNode,
  basic_triangle: BasicTriangleNode,
  line_horizontal: HorizontalLineNode,
  line_horizontal_dashed: HorizontalDashedLineNode,
  line_vertical: VerticalLineNode,
  line_vertical_dashed: VerticalDashedLineNode,
  basic_text_label: TextLabelNode,
  basic_arrow: ArrowShapeNode,
});

export const NODE_DEFAULTS: Record<string, { width: number; height: number; label: string; resizable?: boolean }> = {
  start: { width: 60, height: 60, label: 'Start', resizable: true },
  end: { width: 60, height: 60, label: 'End', resizable: true },
  task: { width: 100, height: 50, label: 'Task', resizable: true },
  subprocess: { width: 120, height: 60, label: 'Sub-Process', resizable: true },
  manual_process: { width: 100, height: 50, label: 'Manual Task', resizable: true },
  automated_process: { width: 100, height: 50, label: 'Automated Task', resizable: true },
  decision: { width: 80, height: 80, label: 'Decision', resizable: true },
  gateway_parallel: { width: 60, height: 60, label: '', resizable: true },
  gateway_exclusive: { width: 60, height: 60, label: '', resizable: true },
  data_object: { width: 45, height: 55, label: 'Data', resizable: true },
  document: { width: 50, height: 60, label: 'Document', resizable: true },
  database: { width: 50, height: 55, label: 'Database', resizable: true },
  manual_input: { width: 100, height: 50, label: 'Manual Input', resizable: true },
  annotation: { width: 120, height: 36, label: 'Annotation', resizable: true },
  callout_square: { width: 100, height: 70, label: 'Callout', resizable: true },
  callout_rounded: { width: 100, height: 70, label: 'Callout', resizable: true },
  callout_oval: { width: 100, height: 70, label: 'Callout', resizable: true },
  callout_cloud: { width: 110, height: 80, label: 'Thought', resizable: true },
  note_folded: { width: 80, height: 80, label: 'Note', resizable: true },
  note_lined: { width: 80, height: 80, label: 'Note', resizable: true },
  cloud_system: { width: 90, height: 55, label: 'External System', resizable: true },
  loop: { width: 100, height: 50, label: 'Loop', resizable: true },
  system: { width: 100, height: 50, label: 'System', resizable: true },
  delay: { width: 90, height: 45, label: 'Delay', resizable: true },
  display: { width: 90, height: 45, label: 'Display', resizable: true },
  predefined_process: { width: 100, height: 50, label: 'Predefined Process', resizable: true },
  multi_document: { width: 55, height: 65, label: 'Multi-Doc', resizable: true },
  internal_storage: { width: 55, height: 50, label: 'Internal Storage', resizable: true },
  extract: { width: 55, height: 50, label: 'Extract' },
  merge: { width: 55, height: 50, label: 'Merge' },
  sort: { width: 55, height: 55, label: 'Sort' },
  collate: { width: 55, height: 55, label: 'Collate' },
  stored_data: { width: 80, height: 45, label: 'Stored Data', resizable: true },
  off_page_ref: { width: 40, height: 50, label: 'Off-Page', resizable: true },
  terminator: { width: 90, height: 36, label: 'Terminator', resizable: true },
  preparation: { width: 90, height: 45, label: 'Preparation', resizable: true },
  swimlane_pool: { width: 800, height: 400, label: 'Pool', resizable: true },
  swimlane_lane: { width: 700, height: 150, label: 'Lane', resizable: true },
  infra_router: { width: 90, height: 60, label: 'Router', resizable: true },
  infra_workstation: { width: 90, height: 60, label: 'Workstation', resizable: true },
  infra_ethernet_switch: { width: 100, height: 60, label: 'Ethernet Switch', resizable: true },
  infra_computer: { width: 90, height: 60, label: 'Computer', resizable: true },
  infra_laptop: { width: 90, height: 60, label: 'Laptop', resizable: true },
  infra_mobile_device: { width: 90, height: 60, label: 'Mobile Device', resizable: true },
  infra_smartphone: { width: 90, height: 60, label: 'Smart Phone', resizable: true },
  infra_terminal: { width: 90, height: 60, label: 'Terminal', resizable: true },
  infra_isp: { width: 90, height: 60, label: 'ISP', resizable: true },
  infra_switch: { width: 90, height: 60, label: 'Switch', resizable: true },
  infra_firewall: { width: 90, height: 60, label: 'Firewall', resizable: true },
  infra_server: { width: 90, height: 60, label: 'Server', resizable: true },
  infra_wireless_ap: { width: 100, height: 60, label: 'Wireless AP', resizable: true },
  infra_internet: { width: 90, height: 60, label: 'The Internet', resizable: true },
  infra_cloud: { width: 90, height: 60, label: 'The Cloud', resizable: true },
  infra_printer: { width: 90, height: 60, label: 'Printer', resizable: true },
  infra_scanner: { width: 90, height: 60, label: 'Scanner', resizable: true },
  infra_desktop_pc: { width: 90, height: 60, label: 'Desktop PC', resizable: true },
  basic_rectangle: { width: 200, height: 120, label: '', resizable: true },
  basic_rounded_rect: { width: 200, height: 120, label: '', resizable: true },
  basic_circle: { width: 120, height: 120, label: '', resizable: true },
  basic_oval: { width: 160, height: 100, label: '', resizable: true },
  basic_triangle: { width: 100, height: 87, label: '', resizable: true },
  line_horizontal: { width: 200, height: 20, label: '', resizable: true },
  line_horizontal_dashed: { width: 200, height: 20, label: '', resizable: true },
  line_vertical: { width: 20, height: 200, label: '', resizable: true },
  line_vertical_dashed: { width: 20, height: 200, label: '', resizable: true },
  basic_text_label: { width: 120, height: 30, label: 'Text', resizable: true },
  basic_arrow: { width: 140, height: 50, label: '', resizable: true },
};
