import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import {
  Info,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  PlayCircle,
  Sigma,
  BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Callout Node ──────────────────────────────────────────────────────────────

export type CalloutType = 'info' | 'warning' | 'success' | 'danger';

const CALLOUT_CONFIG: Record<CalloutType, { bg: string; border: string; icon: any; iconColor: string; label: string }> = {
  info:    { bg: 'bg-blue-50 dark:bg-blue-950/40',   border: 'border-l-blue-400',   icon: Info,          iconColor: 'text-blue-500',   label: 'Info' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-l-amber-400',  icon: AlertTriangle, iconColor: 'text-amber-500',  label: 'Warning' },
  success: { bg: 'bg-green-50 dark:bg-green-950/40', border: 'border-l-green-400',  icon: CheckCircle,   iconColor: 'text-green-500',  label: 'Success' },
  danger:  { bg: 'bg-red-50 dark:bg-red-950/40',     border: 'border-l-red-400',    icon: AlertCircle,   iconColor: 'text-red-500',    label: 'Danger' },
};

const CALLOUT_ORDER: CalloutType[] = ['info', 'warning', 'success', 'danger'];

function CalloutComponent({ node, updateAttributes }: any) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const type = (node.attrs.type || 'info') as CalloutType;
  const cfg = CALLOUT_CONFIG[type];
  const Icon = cfg.icon;

  const cycleType = () => {
    const idx = CALLOUT_ORDER.indexOf(type);
    const next = CALLOUT_ORDER[(idx + 1) % CALLOUT_ORDER.length];
    updateAttributes({ type: next });
  };

  return (
    <NodeViewWrapper as="div">
      <div
        className={cn('rounded-lg border-l-4 p-4 my-2 relative group', cfg.bg, cfg.border)}
        data-callout={type}
      >
        {/* Hover colour picker — top-right dots */}
        <div
          className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          contentEditable={false}
        >
          {CALLOUT_ORDER.map(t => (
            <button
              key={t}
              onClick={() => { updateAttributes({ type: t }); setPickerOpen(false); }}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2 border-white/60 transition-all hover:scale-125',
                t === type && 'ring-2 ring-offset-1 ring-current scale-110',
              )}
              style={{ background: t === 'info' ? '#3b82f6' : t === 'warning' ? '#f59e0b' : t === 'success' ? '#22c55e' : '#ef4444' }}
              title={`Change to ${CALLOUT_CONFIG[t].label}`}
              data-testid={`callout-type-${t}`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {/* Single-click on icon cycles; Ctrl+click opens inline picker */}
          <div className="relative" contentEditable={false}>
            <button
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  setPickerOpen(p => !p);
                } else {
                  cycleType();
                }
              }}
              title={`${cfg.label} — click to cycle, Ctrl+click to pick`}
              className="mt-0.5 cursor-pointer hover:opacity-70 transition-opacity focus:outline-none"
              data-testid="callout-icon-cycle"
            >
              <Icon className={cn('h-5 w-5', cfg.iconColor)} />
            </button>
            {pickerOpen && (
              <div className="absolute left-0 top-7 z-50 flex gap-1 rounded-lg border bg-card shadow-lg p-1.5" data-testid="callout-inline-picker">
                {CALLOUT_ORDER.map(t => (
                  <button
                    key={t}
                    onClick={() => { updateAttributes({ type: t }); setPickerOpen(false); }}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 border-white/60 transition-all hover:scale-125',
                      t === type && 'ring-2 ring-primary ring-offset-1 scale-110',
                    )}
                    style={{ background: t === 'info' ? '#3b82f6' : t === 'warning' ? '#f59e0b' : t === 'success' ? '#22c55e' : '#ef4444' }}
                    title={CALLOUT_CONFIG[t].label}
                  />
                ))}
              </div>
            )}
          </div>
          <NodeViewContent className="flex-1 min-w-0" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: el => el.getAttribute('data-callout') || 'info',
        renderHTML: attrs => ({ 'data-callout': attrs.type }),
      },
    };
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes), 0]; },
  addNodeView() { return ReactNodeViewRenderer(CalloutComponent); },
  addCommands() {
    return {
      insertCallout: (type: CalloutType = 'info') => ({ chain }: any) =>
        chain().insertContent({ type: 'callout', attrs: { type }, content: [{ type: 'paragraph' }] }).run(),
    } as any;
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': ({ editor }) => {
        const { selection } = editor.state;
        const node = selection.$anchor.node(-1);
        if (node?.type.name !== 'callout') return false;
        const current = (node.attrs.type || 'info') as CalloutType;
        const idx = CALLOUT_ORDER.indexOf(current);
        const next = CALLOUT_ORDER[(idx + 1) % CALLOUT_ORDER.length];
        return editor.chain().updateAttributes('callout', { type: next }).run();
      },
    };
  },
});

// ── Collapsible (Details) Node ────────────────────────────────────────────────

function CollapsibleComponent({ node, updateAttributes }: any) {
  const isOpen = node.attrs.open !== false;
  const title = node.attrs.title || '';
  return (
    <NodeViewWrapper as="div">
      <div className="border border-border rounded-lg my-2 overflow-hidden" data-collapsible="">
        <div
          className="flex items-center gap-2 px-3 py-2 bg-muted/60 cursor-pointer select-none"
          contentEditable={false}
          onClick={() => updateAttributes({ open: !isOpen })}
          data-testid="collapsible-header"
        >
          <ChevronRight
            className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150', isOpen && 'rotate-90')}
          />
          <input
            value={title}
            onChange={e => updateAttributes({ title: e.target.value })}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            onKeyUp={e => e.stopPropagation()}
            placeholder="Section title..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-muted-foreground min-w-0 cursor-text"
            data-testid="collapsible-title-input"
          />
          <span className="text-xs text-muted-foreground shrink-0">{isOpen ? 'Collapse' : 'Expand'}</span>
        </div>
        <div className={cn('px-4 py-3', !isOpen && 'hidden')}>
          <NodeViewContent />
        </div>
        {!isOpen && <NodeViewContent className="hidden sr-only" />}
      </div>
    </NodeViewWrapper>
  );
}

export const CollapsibleNode = Node.create({
  name: 'collapsible',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      open:  { default: true,  parseHTML: el => el.getAttribute('data-open') !== 'false',  renderHTML: attrs => ({ 'data-open': attrs.open ? 'true' : 'false' }) },
      title: { default: '',    parseHTML: el => el.getAttribute('data-title') || '',        renderHTML: attrs => ({ 'data-title': attrs.title || '' }) },
    };
  },
  parseHTML() { return [{ tag: 'div[data-collapsible]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes), 0]; },
  addNodeView() { return ReactNodeViewRenderer(CollapsibleComponent); },
  addCommands() {
    return {
      insertCollapsible: () => ({ chain }: any) =>
        chain().insertContent({ type: 'collapsible', attrs: { open: true, title: 'Collapsible Section' }, content: [{ type: 'paragraph' }] }).run(),
    } as any;
  },
});

// ── Video Embed Node ──────────────────────────────────────────────────────────

function convertToEmbedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

function VideoEmbedComponent({ node, updateAttributes, selected }: any) {
  const [editing, setEditing] = useState(!node.attrs.src);
  const [urlInput, setUrlInput] = useState(node.attrs.src || '');
  const embedUrl = node.attrs.src ? convertToEmbedUrl(node.attrs.src) : '';

  const save = () => {
    if (!urlInput.trim()) return;
    updateAttributes({ src: urlInput.trim() });
    setEditing(false);
  };

  return (
    <NodeViewWrapper as="div" contentEditable={false}>
      <div
        className={cn('my-3 rounded-lg overflow-hidden border border-border', selected && 'ring-2 ring-primary ring-offset-2')}
        data-video-embed=""
        data-testid="video-embed-node"
      >
        {editing || !embedUrl ? (
          <div className="p-4 bg-muted/40 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <PlayCircle className="h-4 w-4" /> Video Embed
            </div>
            <div className="flex gap-2">
              <input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); e.stopPropagation(); }}
                placeholder="YouTube or Vimeo URL..."
                className="flex-1 h-8 px-3 text-sm rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
                data-testid="video-url-input"
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={save} data-testid="video-embed-btn">Embed</Button>
              {node.attrs.src && (
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative group">
            <div className="aspect-video">
              <iframe
                src={embedUrl}
                title={node.attrs.title || 'Video'}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
            <button
              onClick={() => setEditing(true)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 rounded px-2 py-1 text-xs border border-border"
              data-testid="video-edit-btn"
            >
              Edit URL
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const VideoEmbedNode = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src:   { default: null, parseHTML: el => el.getAttribute('data-src')   || null, renderHTML: attrs => ({ 'data-src':   attrs.src }) },
      title: { default: '',   parseHTML: el => el.getAttribute('data-title') || '',   renderHTML: attrs => ({ 'data-title': attrs.title }) },
    };
  },
  parseHTML() { return [{ tag: 'div[data-video-embed]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes)]; },
  addNodeView() { return ReactNodeViewRenderer(VideoEmbedComponent); },
  addCommands() {
    return {
      insertVideoEmbed: () => ({ chain }: any) =>
        chain().insertContent({ type: 'videoEmbed', attrs: { src: '' } }).run(),
    } as any;
  },
});

// ── Poll Embed Node (Module 17 — meeting notes) ─────────────────────────────

function PollEmbedComponent({ node, updateAttributes, selected }: any) {
  const [editing, setEditing] = useState(!node.attrs.token);
  const [tokenInput, setTokenInput] = useState(node.attrs.token || '');

  const save = () => {
    const raw = tokenInput.trim();
    const token = raw.includes('/poll/') ? raw.split('/poll/').pop()?.split(/[?#]/)[0] ?? raw : raw;
    if (!token) return;
    updateAttributes({ token });
    setEditing(false);
  };

  const pollUrl = node.attrs.token ? `/poll/${node.attrs.token}` : null;

  return (
    <NodeViewWrapper as="div" contentEditable={false}>
      <div
        className={cn('my-3 rounded-lg overflow-hidden border border-border', selected && 'ring-2 ring-primary ring-offset-2')}
        data-poll-embed=""
        data-testid="poll-embed-node"
      >
        {editing || !pollUrl ? (
          <div className="p-4 bg-muted/40 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <BarChart2 className="h-4 w-4" /> Live Poll Embed
            </div>
            <div className="flex gap-2">
              <input
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); e.stopPropagation(); }}
                placeholder="Poll link or token…"
                className="flex-1 h-8 px-3 text-sm rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
                data-testid="poll-embed-token-input"
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={save} data-testid="poll-embed-btn">Embed</Button>
              {node.attrs.token && (
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative group">
            <iframe
              src={pollUrl}
              title="Embedded poll"
              className="w-full border-0"
              style={{ minHeight: 280 }}
              data-testid="poll-embed-iframe"
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 rounded px-2 py-1 text-xs border border-border"
              data-testid="poll-embed-edit-btn"
            >
              Change poll
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const PollEmbedNode = Node.create({
  name: 'pollEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      token: { default: null, parseHTML: el => el.getAttribute('data-token') || null, renderHTML: attrs => ({ 'data-token': attrs.token }) },
    };
  },
  parseHTML() { return [{ tag: 'div[data-poll-embed]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes)]; },
  addNodeView() { return ReactNodeViewRenderer(PollEmbedComponent); },
  addCommands() {
    return {
      insertPollEmbed: () => ({ chain }: any) =>
        chain().insertContent({ type: 'pollEmbed', attrs: { token: '' } }).run(),
    } as any;
  },
});

// ── Math Block Node ───────────────────────────────────────────────────────────

function MathBlockComponent({ node, updateAttributes, selected }: any) {
  const [editing, setEditing] = useState(!node.attrs.formula);
  const [formulaInput, setFormulaInput] = useState(node.attrs.formula || '');
  const [rendered, setRendered] = useState('');
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    const formula = node.attrs.formula;
    setFormulaInput(formula || '');
    if (!formula) { setRendered(''); setRenderError(''); return; }
    import('katex').then(({ default: katex }) => {
      try {
        const html = katex.renderToString(formula, { displayMode: true, throwOnError: true, output: 'html' });
        setRendered(html);
        setRenderError('');
      } catch (e: any) {
        setRenderError(e.message?.split('\n')[0] || 'Invalid formula');
        setRendered('');
      }
    });
  }, [node.attrs.formula]);

  const save = () => {
    updateAttributes({ formula: formulaInput });
    setEditing(false);
  };

  return (
    <NodeViewWrapper as="div" contentEditable={false}>
      <div
        className={cn('my-3 rounded-lg border border-border overflow-hidden', selected && 'ring-2 ring-primary ring-offset-2')}
        data-math-block=""
        data-testid="math-block-node"
      >
        {editing ? (
          <div className="p-4 bg-muted/30 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Sigma className="h-3.5 w-3.5" /> LaTeX Formula
            </div>
            <textarea
              value={formulaInput}
              onChange={e => setFormulaInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') save(); e.stopPropagation(); }}
              placeholder={`e.g.  E = mc^2  or  \\int_0^\\infty e^{-x} dx`}
              rows={3}
              className="w-full text-sm font-mono px-3 py-2 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary resize-none"
              data-testid="math-formula-input"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={save} data-testid="math-render-btn">Render</Button>
              {node.attrs.formula && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setFormulaInput(node.attrs.formula); setEditing(false); }}>Cancel</Button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="px-6 py-4 flex items-center justify-center cursor-pointer group hover:bg-muted/20 transition-colors relative min-h-[56px]"
            onClick={() => setEditing(true)}
            data-testid="math-rendered"
          >
            {rendered ? (
              <div dangerouslySetInnerHTML={{ __html: rendered }} className="overflow-x-auto max-w-full katex-display-wrapper" />
            ) : renderError ? (
              <span className="text-destructive text-xs font-mono">{renderError}</span>
            ) : (
              <span className="text-muted-foreground text-sm italic">Click to enter formula</span>
            )}
            <span className="absolute top-1 right-2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity">Edit</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const MathBlockNode = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      formula: { default: '', parseHTML: el => el.getAttribute('data-formula') || '', renderHTML: attrs => ({ 'data-formula': attrs.formula || '' }) },
    };
  },
  parseHTML() { return [{ tag: 'div[data-math-block]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes)]; },
  addNodeView() { return ReactNodeViewRenderer(MathBlockComponent); },
  addCommands() {
    return {
      insertMathBlock: () => ({ chain }: any) =>
        chain().insertContent({ type: 'mathBlock', attrs: { formula: '' } }).run(),
    } as any;
  },
});

// ── Text Direction Extension ──────────────────────────────────────────────────

const DIR_NODES = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote'];

export const TextDirectionExtension = Extension.create({
  name: 'textDirection',
  addGlobalAttributes() {
    return [{
      types: DIR_NODES,
      attributes: {
        dir: {
          default: null,
          parseHTML: (el: HTMLElement) => el.dir || null,
          renderHTML: (attrs: Record<string, any>) => attrs.dir ? { dir: attrs.dir } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setTextDirection: (dir: 'ltr' | 'rtl') => ({ tr, state, dispatch }: any) => {
        const { from, to } = state.selection;
        state.doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (DIR_NODES.includes(node.type.name)) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir });
          }
        });
        if (dispatch) dispatch(tr);
        return true;
      },
      toggleTextDirection: () => ({ editor }: any) => {
        const { from } = editor.state.selection;
        let currentDir: string | null = null;
        editor.state.doc.nodesBetween(from, from, (node: any) => {
          if (node.attrs?.dir) currentDir = node.attrs.dir;
        });
        return (editor.commands as any).setTextDirection(currentDir === 'rtl' ? 'ltr' : 'rtl');
      },
    } as any;
  },
});

// ── Slash Command Extension ───────────────────────────────────────────────────

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ElementType;
  keywords?: string[];
  command: (editor: any, range: any) => void;
}

interface SlashListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

interface SlashListRef { onKeyDown: (props: { event: KeyboardEvent }) => boolean; }

export const SlashList = forwardRef<SlashListRef, SlashListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback((index: number) => {
    const item = items[index];
    if (item) command(item);
  }, [items, command]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp')   { setSelectedIndex(i => (i + items.length - 1) % items.length); return true; }
      if (event.key === 'ArrowDown') { setSelectedIndex(i => (i + 1) % items.length); return true; }
      if (event.key === 'Enter')     { selectItem(selectedIndex); return true; }
      return false;
    },
  }));

  useEffect(() => setSelectedIndex(0), [items]);

  if (!items.length) return (
    <div className="z-50 bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-sm text-muted-foreground min-w-[180px]">
      No results
    </div>
  );

  return (
    <div className="z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[240px] max-w-[300px] max-h-[360px] overflow-y-auto">
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b">
        Insert Block
      </div>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors',
              index === selectedIndex && 'bg-primary/10 text-primary',
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectItem(index)}
            data-testid={`slash-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/60">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="font-medium text-xs leading-none mb-0.5">{item.title}</div>
              <div className="text-[11px] text-muted-foreground leading-none">{item.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

SlashList.displayName = 'SlashList';

export function buildSlashSuggestion(getItems: () => SlashCommandItem[]) {
  return {
    char: '/',
    pluginKey: new PluginKey('slashCommand'),
    startOfLine: false,
    command: ({ editor, range, props: item }: { editor: any; range: any; props: SlashCommandItem }) => {
      item.command(editor, range);
    },
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      const all = getItems();
      if (!q) return all;
      return all.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.keywords?.some(k => k.includes(q))
      );
    },
    render: () => {
      let reactRenderer: ReactRenderer<SlashListRef> | null = null;
      let popup: HTMLDivElement | null = null;

      const positionPopup = (clientRect: (() => DOMRect | null) | null | undefined) => {
        if (!popup || !clientRect) return;
        const rect = clientRect();
        if (!rect) return;
        const spaceBelow = window.innerHeight - rect.bottom;
        const popupHeight = popup.offsetHeight || 360;
        popup.style.top = spaceBelow < popupHeight + 8
          ? `${rect.top - popupHeight - 4 + window.scrollY}px`
          : `${rect.bottom + 4 + window.scrollY}px`;
        popup.style.left = `${rect.left + window.scrollX}px`;
      };

      return {
        onStart: (props: any) => {
          reactRenderer = new ReactRenderer(SlashList, { props, editor: props.editor });
          popup = document.createElement('div');
          popup.style.cssText = 'position:absolute;z-index:9999;';
          document.body.appendChild(popup);
          popup.appendChild(reactRenderer.element);
          positionPopup(props.clientRect);
        },
        onUpdate: (props: any) => {
          reactRenderer?.updateProps(props);
          positionPopup(props.clientRect);
        },
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') { popup?.remove(); reactRenderer?.destroy(); return true; }
          return (reactRenderer?.ref as SlashListRef | null)?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.remove(); popup = null;
          reactRenderer?.destroy(); reactRenderer = null;
        },
      };
    },
  };
}

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',
  addOptions() { return { suggestion: {} }; },
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
  },
});

// Re-export callout config for toolbar use
export { CALLOUT_CONFIG };

// ── Inline Comment Mark ────────────────────────────────────────────────────────
// Highlights selected text with a coloured underline; commentId is stored as attr.

import { Mark } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineComment: {
      setInlineComment: (commentId: string) => ReturnType;
      unsetInlineComment: (commentId: string) => ReturnType;
    };
  }
}

export const InlineCommentMark = Mark.create({
  name: 'inlineComment',
  spanning: true,
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: el => el.getAttribute('data-comment-id'),
        renderHTML: attrs => attrs.commentId ? { 'data-comment-id': attrs.commentId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      style: 'background: rgba(251,191,36,0.25); border-bottom: 2px solid #f59e0b; cursor: pointer;',
    }), 0];
  },

  addCommands() {
    return {
      setInlineComment:
        (commentId: string) =>
        ({ commands }: any) =>
          commands.setMark(this.name, { commentId }),
      unsetInlineComment:
        () =>
        ({ commands }: any) =>
          commands.unsetMark(this.name),
    } as any;
  },
});
