// @ts-nocheck
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import Mention from '@tiptap/extension-mention';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCellBase from '@tiptap/extension-table-cell';
import TableHeaderBase from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { Extension, type Range } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import CharacterCount from '@tiptap/extension-character-count';
import {
  CalloutNode, CollapsibleNode, VideoEmbedNode, PollEmbedNode, MathBlockNode,
  TextDirectionExtension, SlashCommandExtension, buildSlashSuggestion,
  InlineCommentMark,
  type SlashCommandItem,
} from './editor-extensions';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { uploadDocumentImage } from '@/lib/document-image-upload';
import { normalizeDocumentHtmlForEditor } from '@/lib/document-html-normalize';
import {
  DocumentImage,
  HeadingWithAnchor,
  HeadingAnchorPlugin,
  ImageInteraction,
  extractDocumentHeadings,
  scrollEditorToHeading,
  type DocumentTocHeading,
} from '@/lib/tiptap-document-extensions';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, Heading4, Type, ChevronDown,
  List, ListOrdered, CheckSquare, Quote, Minus,
  Table as TableIcon, Image as ImageIcon, Link2, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, FileDown, FileText, FileCode, Trash2,
  Plus, RowsIcon, ColumnsIcon,
  Indent, Outdent, Palette, RemoveFormatting, Upload,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  WrapText, Baseline, PaintBucket, Eye, EyeOff,
  Search, Replace, X, ChevronUp, ChevronsUpDown, Check,
  Paintbrush, Video, Sigma, Smile, Languages, BookOpen, Layers, Scissors, Combine,
  Info, AlertTriangle, CheckCircle, AlertCircle, ChevronsLeftRight, FileSignature,
  MessageSquare, BarChart2,
} from 'lucide-react';
import { useState, useMemo, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useLocation } from 'wouter';


const lowlight = createLowlight(common);

type HeadingLevel = 1 | 2 | 3 | 4;

const HEADING_LEVELS: HeadingLevel[] = [1, 2, 3, 4];

const HEADING_LEVEL_META: Record<HeadingLevel, { label: string; icon: typeof Heading1 }> = {
  1: { label: 'Heading 1', icon: Heading1 },
  2: { label: 'Heading 2', icon: Heading2 },
  3: { label: 'Heading 3', icon: Heading3 },
  4: { label: 'Heading 4', icon: Heading4 },
};

function getActiveHeadingLevel(editor: { isActive: (name: string, attrs?: Record<string, unknown>) => boolean }): HeadingLevel | null {
  for (const level of HEADING_LEVELS) {
    if (editor.isActive('heading', { level })) return level;
  }
  return null;
}

function suggestHeadingLevelFromBlock(editor: { state: { selection: { $from: any } } }): HeadingLevel {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'heading') {
      const level = Number(node.attrs.level);
      if (level >= 1 && level <= 4) return level as HeadingLevel;
      return 2;
    }
    if (node.type.name === 'paragraph') {
      let hasBold = false;
      let maxFontSize = 16;
      node.descendants((child: { isText: boolean; marks: { type: { name: string }; attrs: Record<string, unknown> }[] }) => {
        if (!child.isText) return;
        child.marks.forEach((mark) => {
          if (mark.type.name === 'bold') hasBold = true;
          if (mark.type.name === 'textStyle' && mark.attrs.fontSize) {
            const px = parseInt(String(mark.attrs.fontSize).replace('px', ''), 10);
            if (!Number.isNaN(px)) maxFontSize = Math.max(maxFontSize, px);
          }
        });
      });
      const textLen = node.textContent.trim().length;
      if (maxFontSize >= 28 || (hasBold && textLen <= 60 && maxFontSize >= 18)) return 1;
      if (maxFontSize >= 22 || (hasBold && textLen <= 100)) return 2;
      if (maxFontSize >= 18 || hasBold) return 3;
      return 2;
    }
  }
  return 2;
}

function canShowHeadingContextMenu(editor: { isActive: (name: string) => boolean }): boolean {
  return editor.isActive('paragraph') || editor.isActive('heading');
}

function focusBlockForHeadingConversion(editor: {
  state: { selection: { $from: any }; doc: { content: { size: number } } };
  chain: () => { focus: () => { setTextSelection: (pos: number) => { setParagraph: () => { run: () => void } } } };
}) {
  if (canShowHeadingContextMenu(editor)) return;

  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.isTextblock) {
      const pos = Math.min($from.before(depth) + 1, editor.state.doc.content.size - 1);
      const chain = editor.chain().focus().setTextSelection(pos);
      if (node.type.name === 'codeBlock') {
        chain.setParagraph().run();
      } else {
        chain.run();
      }
      return;
    }
  }
  editor.chain().focus().setParagraph().run();
}

const TableCell = TableCellBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || element.getAttribute('data-background-color') || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}`, 'data-background-color': attributes.backgroundColor };
        },
      },
    };
  },
});

const TableHeader = TableHeaderBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || element.getAttribute('data-background-color') || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}`, 'data-background-color': attributes.backgroundColor };
        },
      },
    };
  },
});

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, string | null>) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: Record<string, string | null>) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
});

const searchAndReplacePluginKey = new PluginKey('searchAndReplace');

interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: { from: number; to: number }[];
  currentIndex: number;
  caseSensitive: boolean;
}

const SearchAndReplace = Extension.create<{}, SearchAndReplaceStorage>({
  name: 'searchAndReplace',

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      results: [],
      currentIndex: 0,
      caseSensitive: false,
    };
  },

  addCommands() {
    return {
      setSearchTerm: (searchTerm: string) => ({ editor }: { editor: any }) => {
        editor.storage.searchAndReplace.searchTerm = searchTerm;
        editor.storage.searchAndReplace.currentIndex = 0;
        updateSearchResults(editor);
        return true;
      },
      setReplaceTerm: (replaceTerm: string) => ({ editor }: { editor: any }) => {
        editor.storage.searchAndReplace.replaceTerm = replaceTerm;
        return true;
      },
      setCaseSensitive: (caseSensitive: boolean) => ({ editor }: { editor: any }) => {
        editor.storage.searchAndReplace.caseSensitive = caseSensitive;
        editor.storage.searchAndReplace.currentIndex = 0;
        updateSearchResults(editor);
        return true;
      },
      nextSearchResult: () => ({ editor }: { editor: any }) => {
        const { results, currentIndex } = editor.storage.searchAndReplace;
        if (results.length === 0) return false;
        editor.storage.searchAndReplace.currentIndex = (currentIndex + 1) % results.length;
        scrollToResult(editor);
        return true;
      },
      previousSearchResult: () => ({ editor }: { editor: any }) => {
        const { results, currentIndex } = editor.storage.searchAndReplace;
        if (results.length === 0) return false;
        editor.storage.searchAndReplace.currentIndex = (currentIndex - 1 + results.length) % results.length;
        scrollToResult(editor);
        return true;
      },
      replaceCurrentResult: () => ({ editor }: { editor: any }) => {
        const { results, currentIndex, replaceTerm } = editor.storage.searchAndReplace;
        if (results.length === 0) return false;
        const result = results[currentIndex];
        if (!result) return false;
        const { state } = editor.view;
        const tr = state.tr.insertText(replaceTerm, result.from, result.to);
        editor.view.dispatch(tr);
        setTimeout(() => updateSearchResults(editor), 0);
        return true;
      },
      replaceAllResults: () => ({ editor }: { editor: any }) => {
        const { results, replaceTerm } = editor.storage.searchAndReplace;
        if (results.length === 0) return false;
        const { state } = editor.view;
        const tr = state.tr;
        let offset = 0;
        for (const result of results) {
          tr.insertText(replaceTerm, result.from + offset, result.to + offset);
          offset += replaceTerm.length - (result.to - result.from);
        }
        editor.view.dispatch(tr);
        setTimeout(() => updateSearchResults(editor), 0);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;
    return [
      new Plugin({
        key: searchAndReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldState) {
            const meta = tr.getMeta(searchAndReplacePluginKey);
            if (meta) return meta;
            if (tr.docChanged) {
              return oldState.map(tr.mapping, tr.doc);
            }
            return oldState;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function computeSearchResults(doc: any, searchTerm: string, caseSensitive: boolean): { from: number; to: number }[] {
  const results: { from: number; to: number }[] = [];
  if (!searchTerm) return results;
  const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = caseSensitive ? node.text! : node.text!.toLowerCase();
      let index = text.indexOf(searchText);
      while (index !== -1) {
        results.push({ from: pos + index, to: pos + index + searchTerm.length });
        index = text.indexOf(searchText, index + 1);
      }
    }
  });
  return results;
}

function buildDecorations(doc: any, results: { from: number; to: number }[], activeIndex: number) {
  const decorations = results.map((result, i) => {
    const isActive = i === activeIndex;
    return Decoration.inline(result.from, result.to, {
      class: isActive ? 'search-result-active' : 'search-result',
    });
  });
  return DecorationSet.create(doc, decorations);
}

function updateSearchResults(editor: any) {
  const { searchTerm, caseSensitive } = editor.storage.searchAndReplace;
  const results = computeSearchResults(editor.state.doc, searchTerm, caseSensitive);

  editor.storage.searchAndReplace.results = results;
  if (editor.storage.searchAndReplace.currentIndex >= results.length) {
    editor.storage.searchAndReplace.currentIndex = 0;
  }

  const decorationSet = buildDecorations(editor.state.doc, results, editor.storage.searchAndReplace.currentIndex);
  const tr = editor.state.tr;
  tr.setMeta(searchAndReplacePluginKey, decorationSet);
  editor.view.dispatch(tr);
}

function scrollToResult(editor: any) {
  updateSearchResults(editor);
  const { results, currentIndex } = editor.storage.searchAndReplace;
  if (results.length > 0 && results[currentIndex]) {
    const result = results[currentIndex];
    editor.commands.setTextSelection(result);
    const domAtPos = editor.view.domAtPos(result.from);
    if (domAtPos && domAtPos.node) {
      const el = domAtPos.node instanceof Element ? domAtPos.node : domAtPos.node.parentElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Black', value: '#000000' },
  { label: 'Dark Gray', value: '#4a4a4a' },
  { label: 'Gray', value: '#9b9b9b' },
  { label: 'Red', value: '#e03131' },
  { label: 'Dark Red', value: '#a51d1d' },
  { label: 'Orange', value: '#e8590c' },
  { label: 'Yellow', value: '#fab005' },
  { label: 'Green', value: '#2f9e44' },
  { label: 'Dark Green', value: '#1e7a34' },
  { label: 'Teal', value: '#0c8599' },
  { label: 'Blue', value: '#1971c2' },
  { label: 'Dark Blue', value: '#1347a0' },
  { label: 'Purple', value: '#7048e8' },
  { label: 'Pink', value: '#c2255c' },
  { label: 'Brown', value: '#8b4513' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#fff3a3' },
  { label: 'Light Green', value: '#b2f2bb' },
  { label: 'Light Blue', value: '#a5d8ff' },
  { label: 'Light Purple', value: '#d0bfff' },
  { label: 'Light Pink', value: '#fcc2d7' },
  { label: 'Light Orange', value: '#ffd8a8' },
  { label: 'Light Red', value: '#ffc9c9' },
  { label: 'Light Teal', value: '#96f2d7' },
  { label: 'Peach', value: '#ffe0cc' },
  { label: 'Lavender', value: '#e8d5f5' },
];

const CELL_BG_COLORS = [
  { label: 'None', value: '' },
  { label: 'Light Gray', value: '#f1f3f5' },
  { label: 'Medium Gray', value: '#dee2e6' },
  { label: 'Light Blue', value: '#d0ebff' },
  { label: 'Blue', value: '#a5d8ff' },
  { label: 'Sky Blue', value: '#74c0fc' },
  { label: 'Light Green', value: '#d3f9d8' },
  { label: 'Green', value: '#b2f2bb' },
  { label: 'Mint', value: '#8ce99a' },
  { label: 'Light Yellow', value: '#fff9db' },
  { label: 'Yellow', value: '#ffec99' },
  { label: 'Gold', value: '#ffe066' },
  { label: 'Light Red', value: '#ffe3e3' },
  { label: 'Red', value: '#ffc9c9' },
  { label: 'Rose', value: '#ffa8a8' },
  { label: 'Light Purple', value: '#e5dbff' },
  { label: 'Purple', value: '#d0bfff' },
  { label: 'Grape', value: '#b197fc' },
  { label: 'Light Orange', value: '#ffe8cc' },
  { label: 'Orange', value: '#ffd8a8' },
  { label: 'Tangerine', value: '#ffc078' },
  { label: 'Light Pink', value: '#fcc2d7' },
  { label: 'Pink', value: '#faa2c1' },
  { label: 'Hot Pink', value: '#f783ac' },
  { label: 'Light Teal', value: '#c3fae8' },
  { label: 'Teal', value: '#96f2d7' },
  { label: 'Aqua', value: '#63e6be' },
  { label: 'Light Indigo', value: '#dbe4ff' },
  { label: 'Indigo', value: '#bac8ff' },
  { label: 'Periwinkle', value: '#91a7ff' },
];

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sans Serif', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: '"Fira Code", "Courier New", monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
];

const FONT_SIZES = [
  { label: '8', value: '8px' },
  { label: '9', value: '9px' },
  { label: '10', value: '10px' },
  { label: '11', value: '11px' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
  { label: '36', value: '36px' },
  { label: '48', value: '48px' },
  { label: '72', value: '72px' },
];

const LINE_SPACINGS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3' },
];

const PAGE_SIZES = {
  A4: { label: 'A4', width: 8.27, height: 11.69, description: '210 x 297 mm' },
  Letter: { label: 'Letter', width: 8.5, height: 11, description: '8.5 x 11 in' },
  Legal: { label: 'Legal', width: 8.5, height: 14, description: '8.5 x 14 in' },
} as const;

type PageSizeKey = keyof typeof PAGE_SIZES;

const PRINT_MARGIN_INCHES = 1;
const DPI = 96;

function usePageDimensions(pageSize: PageSizeKey) {
  return useMemo(() => {
    const size = PAGE_SIZES[pageSize];
    const pageWidthPx = size.width * DPI;
    const pageHeightPx = size.height * DPI;
    const marginPx = PRINT_MARGIN_INCHES * DPI;
    const printableHeightPx = pageHeightPx - (marginPx * 2);
    return { pageWidthPx, pageHeightPx, marginPx, printableHeightPx };
  }, [pageSize]);
}

function usePageCount(editorContentRef: React.RefObject<HTMLDivElement | null>, pageHeightPx: number) {
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    const el = editorContentRef.current;
    if (!el) return;
    const calculatePages = () => {
      const totalHeight = el.scrollHeight;
      const pages = Math.max(1, Math.ceil(totalHeight / pageHeightPx));
      setPageCount(pages);
    };
    calculatePages();
    const observer = new ResizeObserver(calculatePages);
    observer.observe(el);
    const mutationObserver = new MutationObserver(calculatePages);
    mutationObserver.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [editorContentRef, pageHeightPx]);

  return pageCount;
}

function PrintPageCount({ editorContentRef, pageSize }: { editorContentRef: React.RefObject<HTMLDivElement | null>; pageSize: PageSizeKey }) {
  const { pageHeightPx } = usePageDimensions(pageSize);
  const pageCount = usePageCount(editorContentRef, pageHeightPx);

  return (
    <span className="text-muted-foreground font-medium" data-testid="print-page-count">
      {pageCount} {pageCount === 1 ? 'page' : 'pages'}
    </span>
  );
}

function PrintPreviewOverlay({ editorContentRef, pageSize }: { editorContentRef: React.RefObject<HTMLDivElement | null>; pageSize: PageSizeKey }) {
  const { pageWidthPx, pageHeightPx, marginPx } = usePageDimensions(pageSize);
  const pageCount = usePageCount(editorContentRef, pageHeightPx);

  return (
    <div className="absolute inset-0 pointer-events-none z-10" data-testid="print-preview-overlay" aria-hidden="true">
      {Array.from({ length: pageCount }).map((_, i) => {
        const pageTop = i * pageHeightPx;
        return (
          <div key={i}>
            <div
              className="absolute border border-border/50"
              style={{
                top: `${pageTop}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${pageWidthPx}px`,
                height: `${pageHeightPx}px`,
                boxShadow: '0 1px 4px hsl(var(--primary) / 0.08)',
              }}
            >
              <div
                className="absolute"
                style={{
                  top: `${marginPx}px`,
                  left: `${marginPx}px`,
                  right: `${marginPx}px`,
                  bottom: `${marginPx}px`,
                  border: '1px dashed hsl(var(--primary) / 0.25)',
                }}
              />
              <div
                className="absolute top-0 left-0 right-0"
                style={{
                  height: `${marginPx}px`,
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, hsl(var(--primary) / 0.04) 4px, hsl(var(--primary) / 0.04) 5px)',
                }}
              />
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{
                  height: `${marginPx}px`,
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, hsl(var(--primary) / 0.04) 4px, hsl(var(--primary) / 0.04) 5px)',
                }}
              />
              <div
                className="absolute left-0"
                style={{
                  top: `${marginPx}px`,
                  bottom: `${marginPx}px`,
                  width: `${marginPx}px`,
                  background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, hsl(var(--primary) / 0.04) 4px, hsl(var(--primary) / 0.04) 5px)',
                }}
              />
              <div
                className="absolute right-0"
                style={{
                  top: `${marginPx}px`,
                  bottom: `${marginPx}px`,
                  width: `${marginPx}px`,
                  background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, hsl(var(--primary) / 0.04) 4px, hsl(var(--primary) / 0.04) 5px)',
                }}
              />
            </div>
            <div
              className="absolute flex items-center gap-1"
              style={{
                top: `${pageTop + 6}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${pageWidthPx}px`,
                justifyContent: 'flex-end',
                paddingRight: '8px',
              }}
            >
              <span className="bg-background/90 px-1.5 py-0.5 rounded text-[10px] font-medium border border-border text-muted-foreground" data-testid={`page-number-${i + 1}`}>
                Page {i + 1} of {pageCount}
              </span>
            </div>
            {i < pageCount - 1 && (
              <div
                className="absolute left-0 right-0"
                style={{
                  top: `${pageTop + pageHeightPx - 1}px`,
                  height: '2px',
                  background: 'hsl(var(--destructive) / 0.2)',
                  borderTop: '1px dashed hsl(var(--destructive) / 0.4)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── @Mention support ─────────────────────────────────────────────────────────
export interface MentionUser {
  id: string;
  name: string;
  email?: string;
}

interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
}

interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback((index: number) => {
    const item = items[index];
    if (item) command({ id: item.id, label: item.name });
  }, [items, command]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => setSelectedIndex(0), [items]);

  if (!items.length) return null;

  return (
    <div className="mention-dropdown z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[180px] max-w-[260px]">
      {items.map((item, index) => (
        <button
          key={item.id}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors',
            index === selectedIndex && 'bg-primary/10 text-primary'
          )}
          onClick={() => selectItem(index)}
          data-testid={`mention-item-${item.id}`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {item.name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate font-medium">{item.name}</span>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';

function buildMentionSuggestion(usersRef: { current: MentionUser[] }) {
  return {
    items: ({ query }: { query: string }) => {
      const users = usersRef.current || [];
      const q = (query || '').toLowerCase();
      return users
        .filter(u => typeof u.name === 'string' && u.name.toLowerCase().includes(q))
        .slice(0, 8);
    },
    render: () => {
      let reactRenderer: ReactRenderer<MentionListRef> | null = null;
      let popup: HTMLDivElement | null = null;

      const positionPopup = (clientRect: (() => DOMRect | null) | null | undefined) => {
        if (!popup || !clientRect) return;
        const rect = clientRect();
        if (!rect) return;
        const viewportHeight = window.innerHeight;
        const popupHeight = popup.offsetHeight || 200;
        const spaceBelow = viewportHeight - rect.bottom;
        if (spaceBelow < popupHeight + 8) {
          popup.style.top = `${rect.top - popupHeight - 4 + window.scrollY}px`;
        } else {
          popup.style.top = `${rect.bottom + 4 + window.scrollY}px`;
        }
        popup.style.left = `${rect.left + window.scrollX}px`;
      };

      return {
        onStart: (props: any) => {
          reactRenderer = new ReactRenderer(MentionList, { props, editor: props.editor });
          popup = document.createElement('div');
          popup.style.position = 'absolute';
          popup.style.zIndex = '9999';
          document.body.appendChild(popup);
          popup.appendChild(reactRenderer.element);
          positionPopup(props.clientRect);
        },
        onUpdate: (props: any) => {
          reactRenderer?.updateProps(props);
          positionPopup(props.clientRect);
        },
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') {
            popup?.remove();
            reactRenderer?.destroy();
            return true;
          }
          return (reactRenderer?.ref as MentionListRef | null)?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.remove();
          popup = null;
          reactRenderer?.destroy();
          reactRenderer = null;
        },
      };
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────────

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onExport?: (format: 'pdf' | 'html' | 'markdown' | 'docx') => void;
  editable?: boolean;
  placeholder?: string;
  users?: MentionUser[];
  documentId?: number;
  documentTitle?: string;
  onAnchorComment?: (commentId: string, selectedText: string) => void;
}

export function TipTapEditor({ 
  content, 
  onChange, 
  onExport,
  editable = true,
  placeholder = 'Start writing your document...',
  users = [],
  documentId,
  documentTitle,
  onAnchorComment,
}: TipTapEditorProps) {
  const [, setLocation] = useLocation();
  const usersRef = useRef<MentionUser[]>(users);
  usersRef.current = users;
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [customTextColor, setCustomTextColor] = useState('#1e3a5f');
  const [customHighlightColor, setCustomHighlightColor] = useState('#e6f0ff');
  const [customCellBgColor, setCustomCellBgColor] = useState('#d0ebff');
  const [printPreview, setPrintPreview] = useState(false);
  const [pageSize, setPageSize] = useState<PageSizeKey>('A4');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showReplaceRow, setShowReplaceRow] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const lastExternalContent = useRef(content || '');

  // Format painter
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const capturedMarks = useRef<Array<{ type: string; attrs: Record<string, any> }>>([]);
  const capturedNodeType = useRef<{ type: string; level?: number } | null>(null);
  // TOC
  const [tocHeadings, setTocHeadings] = useState<DocumentTocHeading[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  // Emoji picker
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  // Insert blocks dropdown
  const [insertBlocksOpen, setInsertBlocksOpen] = useState(false);

  // Slash command items (stable ref)
  const getSlashItems = useCallback((): SlashCommandItem[] => [
    { title: 'Heading 1',        description: 'Large section heading',       icon: Heading1,      keywords: ['h1','header'],    command: (ed, range) => ed.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run() },
    { title: 'Heading 2',        description: 'Medium section heading',      icon: Heading2,      keywords: ['h2','header'],    command: (ed, range) => ed.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run() },
    { title: 'Heading 3',        description: 'Small section heading',       icon: Heading3,      keywords: ['h3','header'],    command: (ed, range) => ed.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run() },
    { title: 'Bullet List',      description: 'Unordered list',              icon: List,          keywords: ['ul','list'],      command: (ed, range) => ed.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: 'Numbered List',    description: 'Ordered list',                icon: ListOrdered,   keywords: ['ol','numbered'],  command: (ed, range) => ed.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: 'Task List',        description: 'Checkbox checklist',          icon: CheckSquare,   keywords: ['todo','checkbox'], command: (ed, range) => ed.chain().focus().deleteRange(range).toggleTaskList().run() },
    { title: 'Blockquote',       description: 'Quote block',                 icon: Quote,         keywords: ['quote'],          command: (ed, range) => ed.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { title: 'Code Block',       description: 'Syntax-highlighted code',     icon: Code,          keywords: ['code','pre'],     command: (ed, range) => ed.chain().focus().deleteRange(range).toggleCodeBlock().run() },
    { title: 'Divider',          description: 'Horizontal rule',             icon: Minus,         keywords: ['hr','rule'],      command: (ed, range) => ed.chain().focus().deleteRange(range).setHorizontalRule().run() },
    { title: 'Callout — Info',   description: 'Blue info callout',           icon: Info,          keywords: ['callout','info','note'],    command: (ed, range) => ed.chain().focus().deleteRange(range).insertCallout('info').run() },
    { title: 'Callout — Warning',description: 'Amber warning callout',       icon: AlertTriangle, keywords: ['callout','warn','alert'],   command: (ed, range) => ed.chain().focus().deleteRange(range).insertCallout('warning').run() },
    { title: 'Callout — Success',description: 'Green success callout',       icon: CheckCircle,   keywords: ['callout','success','tip'],  command: (ed, range) => ed.chain().focus().deleteRange(range).insertCallout('success').run() },
    { title: 'Callout — Danger', description: 'Red danger callout',          icon: AlertCircle,   keywords: ['callout','danger','error'], command: (ed, range) => ed.chain().focus().deleteRange(range).insertCallout('danger').run() },
    { title: 'Collapsible',      description: 'Expandable/collapsible block',icon: Layers,        keywords: ['collapse','toggle','detail'], command: (ed, range) => ed.chain().focus().deleteRange(range).insertCollapsible().run() },
    { title: 'Video',            description: 'Embed YouTube or Vimeo',      icon: Video,         keywords: ['youtube','vimeo','embed'],  command: (ed, range) => ed.chain().focus().deleteRange(range).insertVideoEmbed().run() },
    { title: 'Live Poll',        description: 'Embed a live poll in meeting notes', icon: BarChart2, keywords: ['poll','vote','survey'], command: (ed, range) => ed.chain().focus().deleteRange(range).insertPollEmbed().run() },
    { title: 'Math / LaTeX',     description: 'Mathematical formula',        icon: Sigma,         keywords: ['math','latex','formula'],  command: (ed, range) => ed.chain().focus().deleteRange(range).insertMathBlock().run() },
  ], []);

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: false,
      }),
      HeadingWithAnchor.configure({
        levels: [1, 2, 3, 4],
      }),
      HeadingAnchorPlugin,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      DocumentImage,
      ImageInteraction,
      Extension.create({
        name: 'imagePasteHandler',
        addProseMirrorPlugins() {
          const uploadImage = uploadDocumentImage;

          return [
            new Plugin({
              key: new PluginKey('imagePasteHandler'),
              props: {
                handlePaste: (view, event) => {
                  const items = event.clipboardData?.items;
                  if (!items) return false;

                  const imageItems: DataTransferItem[] = [];
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                      imageItems.push(items[i]);
                    }
                  }

                  if (imageItems.length === 0) {
                    const html = event.clipboardData?.getData('text/html');
                    if (html) {
                      const base64Matches = html.match(/src="data:image\/[^"]+"/g);
                      if (base64Matches && base64Matches.length > 0) {
                        event.preventDefault();
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = html;
                        const imgs = tempDiv.querySelectorAll('img[src^="data:image"]');
                        const processImages = async () => {
                          for (const img of Array.from(imgs)) {
                            const src = img.getAttribute('src');
                            if (!src) continue;
                            try {
                              const resp = await fetch(src);
                              const blob = await resp.blob();
                              const ext = blob.type.split('/')[1] || 'png';
                              const file = new File([blob], `pasted-image.${ext}`, { type: blob.type });
                              const url = await uploadImage(file);
                              if (url) {
                                img.setAttribute('src', url);
                              }
                            } catch {
                              // keep base64 src as fallback
                            }
                          }
                          const { schema } = view.state;
                          const parser = ProseMirrorDOMParser.fromSchema(schema);
                          const parsed = parser.parse(tempDiv);
                          const { Slice } = await import('@tiptap/pm/model');
                          const slice = new Slice(parsed.content, 0, 0);
                          const tr = view.state.tr.replaceSelection(slice);
                          view.dispatch(tr);
                        };
                        processImages();
                        return true;
                      }
                    }
                    return false;
                  }

                  event.preventDefault();
                  const processClipboardImages = async () => {
                    const urls: { url: string; name: string }[] = [];
                    for (const item of imageItems) {
                      const file = item.getAsFile();
                      if (!file) continue;
                      const url = await uploadImage(file);
                      if (url) urls.push({ url, name: file.name });
                    }
                    if (urls.length > 0) {
                      const { schema } = view.state;
                      let tr = view.state.tr;
                      let insertPos = tr.selection.from;
                      for (const { url, name } of urls) {
                        const node = schema.nodes.image.create({ src: url, alt: name });
                        tr = tr.insert(insertPos, node);
                        insertPos += node.nodeSize;
                      }
                      view.dispatch(tr);
                    }
                  };
                  processClipboardImages();
                  return true;
                },
                handleDrop: (view, event) => {
                  const files = event.dataTransfer?.files;
                  if (!files || files.length === 0) return false;

                  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
                  if (imageFiles.length === 0) return false;

                  event.preventDefault();
                  const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                  for (const file of imageFiles) {
                    uploadImage(file).then((url) => {
                      if (url && pos) {
                        const { schema } = view.state;
                        const node = schema.nodes.image.create({ src: url, alt: file.name });
                        const tr = view.state.tr.insert(pos.pos, node);
                        view.dispatch(tr);
                      }
                    });
                  }
                  return true;
                },
              },
            }),
          ];
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-fixed w-full',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border bg-muted font-semibold p-2 text-left',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border p-2',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'list-none pl-0',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      SearchAndReplace,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-chip',
        },
        renderLabel({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: buildMentionSuggestion(usersRef),
      }),
      CharacterCount,
      CalloutNode,
      CollapsibleNode,
      VideoEmbedNode,
      PollEmbedNode,
      MathBlockNode,
      TextDirectionExtension,
      InlineCommentMark,
      SlashCommandExtension.configure({
        suggestion: buildSlashSuggestion(getSlashItems),
      }),
    ],
    content: normalizeDocumentHtmlForEditor(content || ''),
    editable: true,
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
    },
    editorProps: {
      attributes: {
        spellcheck: 'true',
      },
      handleKeyDown: (_view, event) => {
        const ed = editorRef.current;
        if (!ed) return false;
        if ((event.key === 'Backspace' || event.key === 'Delete') && ed.isActive('image')) {
          ed.chain().focus().deleteSelection().run();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      onChange(editor.getHTML());
    },
    onSelectionUpdate: () => {
      // intentional noop — causes component re-render so toolbar reads
      // fresh getAttributes() for fontFamily, fontSize, color, etc.
    },
  });

  // Force-refresh editor content when the document ID changes.
  // This bypasses the isInternalUpdate guard which can otherwise block
  // content updates when the user switches documents quickly.
  const prevDocumentId = useRef(documentId);
  useEffect(() => {
    if (!editor) return;
    if (documentId !== undefined && documentId !== prevDocumentId.current) {
      prevDocumentId.current = documentId;
      isInternalUpdate.current = false;
      lastExternalContent.current = content || '';
      const nextContent = normalizeDocumentHtmlForEditor(content || '');
      queueMicrotask(() => {
        if (editor.isDestroyed) return;
        editor.commands.setContent(nextContent, { emitUpdate: false });
      });
      return;
    }
    prevDocumentId.current = documentId;
  }, [documentId, editor, content]);

  // Sync content changes from outside the editor (e.g. programmatic updates)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editor && content !== lastExternalContent.current) {
      lastExternalContent.current = content || '';
      const nextContent = normalizeDocumentHtmlForEditor(content || '');
      queueMicrotask(() => {
        if (editor.isDestroyed) return;
        editor.commands.setContent(nextContent, { emitUpdate: false });
      });
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  const scrollToHeading = useCallback((heading: DocumentTocHeading) => {
    scrollEditorToHeading(editor, heading.pos);
  }, [editor]);

  // Format painter — apply captured marks on next mouseup inside the editor content area
  useEffect(() => {
    if (!formatPainterActive || !editor) return;
    const editorDom = editor.view.dom;
    const handleMouseUp = () => {
      const { schema } = editor.state;
      const { from, to } = editor.state.selection;
      let applyFrom = from;
      let applyTo = to;
      // When user single-clicks (cursor only, no drag selection), expand to the word at cursor
      if (from === to) {
        const $pos = editor.state.doc.resolve(from);
        const parent = $pos.parent;
        const textOffset = $pos.parentOffset;
        const nodeStart = from - textOffset;
        const text = parent.textContent;
        let wStart = textOffset;
        let wEnd = textOffset;
        while (wStart > 0 && /\S/.test(text[wStart - 1])) wStart--;
        while (wEnd < text.length && /\S/.test(text[wEnd])) wEnd++;
        if (wStart === wEnd) { setFormatPainterActive(false); return; }
        applyFrom = nodeStart + wStart;
        applyTo = nodeStart + wEnd;
      }
      // 1. Apply block node type (heading level or revert to paragraph)
      if (capturedNodeType.current) {
        const nt = capturedNodeType.current;
        if (nt.type === 'heading' && nt.level) {
          editor.chain().focus().setHeading({ level: nt.level as 1 | 2 | 3 | 4 }).run();
        } else if (nt.type === 'paragraph') {
          editor.chain().focus().setParagraph().run();
        }
      }
      // 2. Apply inline marks over the target range
      editor.chain().focus().command(({ tr, dispatch }) => {
        if (!dispatch) return false;
        // Strip all existing marks from the target range
        Object.values(schema.marks).forEach((markType) => {
          tr.removeMark(applyFrom, applyTo, markType as any);
        });
        // Re-apply each captured mark via the ProseMirror schema
        capturedMarks.current.forEach((m) => {
          const markType = schema.marks[m.type];
          if (markType) {
            try { tr.addMark(applyFrom, applyTo, markType.create(m.attrs)); } catch { /* skip */ }
          }
        });
        dispatch(tr);
        return true;
      }).run();
      setFormatPainterActive(false);
    };
    editorDom.addEventListener('mouseup', handleMouseUp);
    return () => editorDom.removeEventListener('mouseup', handleMouseUp);
  }, [formatPainterActive, editor]);

  // TOC — extract headings from editor on each update
  useEffect(() => {
    if (!editor) return;
    const extractHeadings = () => {
      setTocHeadings(extractDocumentHeadings(editor.state.doc));
    };
    extractHeadings();
    editor.on('update', extractHeadings);
    return () => { editor.off('update', extractHeadings); };
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkUrl('');
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl, alt: imageAlt || 'Image' }).run();
    setImageUrl('');
    setImageAlt('');
  }, [editor, imageUrl, imageAlt]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) return;

    setIsUploading(true);
    try {
      const url = await uploadDocumentImage(file);
      if (!url) throw new Error('Upload failed');
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch {
      // silently fail
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [editor]);

  const handleReplaceImageFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) return;

    setIsUploading(true);
    try {
      const url = await uploadDocumentImage(file);
      if (!url) throw new Error('Upload failed');
      editor.chain().focus().updateAttributes('image', { src: url, alt: file.name }).run();
    } catch {
      // silently fail
    } finally {
      setIsUploading(false);
      if (replaceImageInputRef.current) replaceImageInputRef.current.value = '';
    }
  }, [editor]);

  const setLineSpacing = useCallback((spacing: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const { tr } = editor.state;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: spacing });
      }
    });
    editor.view.dispatch(tr);
  }, [editor]);

  const handleFindTextChange = useCallback((text: string) => {
    setFindText(text);
    if (editor) {
      (editor.commands as any).setSearchTerm(text);
    }
  }, [editor]);

  const handleCaseSensitiveToggle = useCallback(() => {
    const newVal = !caseSensitive;
    setCaseSensitive(newVal);
    if (editor) {
      (editor.commands as any).setCaseSensitive(newVal);
    }
  }, [editor, caseSensitive]);

  const handleFindNext = useCallback(() => {
    if (editor) (editor.commands as any).nextSearchResult();
  }, [editor]);

  const handleFindPrev = useCallback(() => {
    if (editor) (editor.commands as any).previousSearchResult();
  }, [editor]);

  const handleReplaceCurrent = useCallback(() => {
    if (!editor) return;
    const { searchTerm, caseSensitive, results, currentIndex } = editor.storage.searchAndReplace;
    if (results.length === 0) return;
    const result = results[currentIndex];
    if (!result) return;
    const { state } = editor.view;
    const tr = state.tr.insertText(replaceText, result.from, result.to);
    const newResults = computeSearchResults(tr.doc, searchTerm, caseSensitive);
    editor.storage.searchAndReplace.results = newResults;
    const newIndex = currentIndex >= newResults.length ? 0 : currentIndex;
    editor.storage.searchAndReplace.currentIndex = newIndex;
    tr.setMeta(searchAndReplacePluginKey, buildDecorations(tr.doc, newResults, newIndex));
    editor.view.dispatch(tr);
  }, [editor, replaceText]);

  const handleReplaceAll = useCallback(() => {
    if (!editor) return;
    const { searchTerm, caseSensitive, results } = editor.storage.searchAndReplace;
    if (results.length === 0) return;
    const { state } = editor.view;
    const tr = state.tr;
    let offset = 0;
    for (const result of results) {
      tr.insertText(replaceText, result.from + offset, result.to + offset);
      offset += replaceText.length - (result.to - result.from);
    }
    const newResults = computeSearchResults(tr.doc, searchTerm, caseSensitive);
    editor.storage.searchAndReplace.results = newResults;
    editor.storage.searchAndReplace.currentIndex = 0;
    tr.setMeta(searchAndReplacePluginKey, buildDecorations(tr.doc, newResults, 0));
    editor.view.dispatch(tr);
  }, [editor, replaceText]);

  const closeFindReplace = useCallback(() => {
    setShowFindReplace(false);
    setFindText('');
    setReplaceText('');
    if (editor) (editor.commands as any).setSearchTerm('');
  }, [editor]);

  useEffect(() => {
    if (showFindReplace && findInputRef.current) {
      findInputRef.current.focus();
    }
  }, [showFindReplace]);

  useEffect(() => {
    const el = editorContentRef.current;
    if (!el) return;
    const stopBubble = (e: Event) => e.stopPropagation();
    el.addEventListener("keydown", stopBubble);
    el.addEventListener("keyup", stopBubble);
    return () => {
      el.removeEventListener("keydown", stopBubble);
      el.removeEventListener("keyup", stopBubble);
    };
  }, [editor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
        setShowReplaceRow(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowFindReplace(true);
        setShowReplaceRow(true);
      }
      if (e.key === 'Escape' && showFindReplace) {
        closeFindReplace();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showFindReplace, closeFindReplace]);

  const [tableCtxMenu, setTableCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [headingCtxMenu, setHeadingCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
  const [tableGridHover, setTableGridHover] = useState({ rows: 0, cols: 0 });

  useEffect(() => {
    if (!tableCtxMenu) return;
    const close = () => setTableCtxMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, [tableCtxMenu]);

  useEffect(() => {
    if (!headingCtxMenu) return;
    const close = () => setHeadingCtxMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, [headingCtxMenu]);

  const convertBlockToHeading = useCallback((level: HeadingLevel) => {
    if (!editor) return;
    if (editor.isActive('listItem')) editor.chain().focus().liftListItem('listItem').run();
    if (editor.isActive('blockquote')) editor.chain().focus().lift('blockquote').run();
    if (!canShowHeadingContextMenu(editor)) focusBlockForHeadingConversion(editor);
    editor.chain().focus().setHeading({ level }).run();
    setHeadingCtxMenu(null);
  }, [editor]);

  const convertBlockToParagraph = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().setParagraph().run();
    setHeadingCtxMenu(null);
  }, [editor]);

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    if (!editor || !editable) return;

    const target = e.target as HTMLElement;
    if (!target.closest('.ProseMirror')) return;

    if (editor.isActive('table')) {
      e.preventDefault();
      setHeadingCtxMenu(null);
      setTableCtxMenu({ x: e.clientX, y: e.clientY });
      return;
    }

    e.preventDefault();
    setTableCtxMenu(null);

    const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (coords) {
      editor.chain().focus().setTextSelection(coords.pos).run();
    }
    focusBlockForHeadingConversion(editor);
    setHeadingCtxMenu({ x: e.clientX, y: e.clientY });
  };

  if (!editor) {
    return null;
  }

  const searchResults = editor.storage.searchAndReplace?.results || [];
  const currentSearchIndex = editor.storage.searchAndReplace?.currentIndex || 0;

  const currentTextColor = editor.getAttributes('textStyle').color || '';
  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || '';
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '';
  const activeHeadingLevel = getActiveHeadingLevel(editor);
  const suggestedHeadingLevel = headingCtxMenu ? suggestHeadingLevelFromBlock(editor) : null;

  const ToolbarTooltip = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );

  const ToolbarButton = ({ 
    icon: Icon, 
    label, 
    onClick, 
    isActive = false,
    disabled = false,
    children,
  }: { 
    icon?: React.ElementType; 
    label: string; 
    onClick: () => void; 
    isActive?: boolean;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          size="icon"
          onMouseDown={(e) => {
            e.preventDefault();
            onClick();
          }}
          disabled={disabled}
          data-testid={`toolbar-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {children || (Icon && <Icon className="h-4 w-4" />)}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );

  const ColorGrid = ({ colors, onSelect, activeColor }: { colors: typeof TEXT_COLORS; onSelect: (color: string) => void; activeColor?: string }) => (
    <div className="grid grid-cols-8 gap-1 p-1">
      {colors.map((c) => (
        <button
          key={c.value || 'default'}
          className={cn(
            "w-6 h-6 rounded-sm border border-border cursor-pointer transition-transform",
            activeColor === c.value && "ring-2 ring-primary ring-offset-1"
          )}
          style={{ backgroundColor: c.value || 'transparent' }}
          onClick={() => onSelect(c.value)}
          title={c.label}
          data-testid={`color-${c.label.toLowerCase().replace(/\s+/g, '-')}`}
        />
      ))}
    </div>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-background w-full flex flex-col" data-testid="tiptap-editor" data-editable-region="document-body">
      {editable && (
        <div className="border-b bg-muted shrink-0 z-10" data-testid="tiptap-toolbar">
          <TooltipProvider delayDuration={250}>
          <div className="flex flex-wrap items-center gap-0.5 p-1.5">
            <ToolbarButton 
              icon={Undo2} 
              label="Undo" 
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
            />
            <ToolbarButton 
              icon={Redo2} 
              label="Redo" 
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
            />
            
            <Separator orientation="vertical" className="h-6 mx-0.5" />

            <DropdownMenu>
              <ToolbarTooltip label="Heading style — creates sections for On this page links">
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-2 min-w-[80px]" data-testid="toolbar-headings">
                  <Type className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">
                    {activeHeadingLevel ? `H${activeHeadingLevel}` : 'Heading'}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </Button>
                </DropdownMenuTrigger>
              </ToolbarTooltip>
              <DropdownMenuContent>
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().setParagraph().run()}
                  className={editor.isActive('paragraph') ? 'bg-accent' : ''}
                  data-testid="toolbar-paragraph"
                >
                  <Type className="h-4 w-4 mr-2" /> Paragraph
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}
                  data-testid="toolbar-h1"
                >
                  <Heading1 className="h-4 w-4 mr-2" /> <span className="text-xl font-bold">Heading 1</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}
                  data-testid="toolbar-h2"
                >
                  <Heading2 className="h-4 w-4 mr-2" /> <span className="text-lg font-bold">Heading 2</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={editor.isActive('heading', { level: 3 }) ? 'bg-accent' : ''}
                  data-testid="toolbar-h3"
                >
                  <Heading3 className="h-4 w-4 mr-2" /> <span className="text-base font-semibold">Heading 3</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                  className={editor.isActive('heading', { level: 4 }) ? 'bg-accent' : ''}
                  data-testid="toolbar-h4"
                >
                  <Heading4 className="h-4 w-4 mr-2" /> <span className="text-sm font-semibold">Heading 4</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-6 mx-0.5" />

            <DropdownMenu>
              <ToolbarTooltip label="Font family">
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-2" data-testid="toolbar-font-family">
                  <span className="text-xs truncate max-w-[80px]">
                    {currentFontFamily
                      ? FONT_FAMILIES.find(f => f.value === currentFontFamily)?.label || 'Custom'
                      : 'Default'}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                </DropdownMenuTrigger>
              </ToolbarTooltip>
              <DropdownMenuContent className="max-h-64 overflow-y-auto">
                {FONT_FAMILIES.map((font) => {
                  const isActive = currentFontFamily === font.value;
                  return (
                    <DropdownMenuItem
                      key={font.label}
                      onClick={() => {
                        if (font.value) {
                          editor.chain().focus().setFontFamily(font.value).run();
                        } else {
                          editor.chain().focus().unsetFontFamily().run();
                        }
                      }}
                      className={cn('flex items-center justify-between gap-3', isActive && 'bg-accent')}
                      style={font.value ? { fontFamily: font.value } : undefined}
                      data-testid={`font-${font.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span className={cn(isActive && 'font-semibold')}>{font.label}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <ToolbarTooltip label="Font size">
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-2 min-w-[50px]" data-testid="toolbar-font-size">
                  <span className="text-xs">{currentFontSize ? currentFontSize.replace('px', '') : '16'}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                </DropdownMenuTrigger>
              </ToolbarTooltip>
              <DropdownMenuContent className="max-h-64 overflow-y-auto">
                {FONT_SIZES.map((size) => {
                  const isActive = currentFontSize === size.value;
                  return (
                    <DropdownMenuItem
                      key={size.value}
                      onClick={() => {
                        (editor.chain().focus() as any).setFontSize(size.value).run();
                      }}
                      className={cn('flex items-center justify-between gap-3', isActive && 'bg-accent')}
                      data-testid={`font-size-${size.label}`}
                    >
                      <span className={cn(isActive && 'font-semibold')} style={{ fontSize: Math.min(parseInt(size.label), 20) }}>{size.label}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolbarButton 
              icon={Bold} 
              label="Bold" 
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
            />
            <ToolbarButton 
              icon={Italic} 
              label="Italic" 
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
            />
            <ToolbarButton 
              icon={UnderlineIcon} 
              label="Underline" 
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
            />
            <ToolbarButton 
              icon={Strikethrough} 
              label="Strikethrough" 
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
            />
            <ToolbarButton 
              icon={SubscriptIcon} 
              label="Subscript" 
              onClick={() => editor.chain().focus().toggleSubscript().run()}
              isActive={editor.isActive('subscript')}
            />
            <ToolbarButton 
              icon={SuperscriptIcon} 
              label="Superscript" 
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
              isActive={editor.isActive('superscript')}
            />
            <ToolbarButton 
              icon={Code} 
              label="Code" 
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive('code')}
            />

            <Separator orientation="vertical" className="h-6 mx-0.5" />

            <Popover>
              <ToolbarTooltip label="Text color">
                <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="toolbar-text-color">
                  <div className="flex flex-col items-center">
                    <Baseline className="h-3.5 w-3.5" />
                    <div className="w-4 h-1 rounded-sm mt-0.5" style={{ backgroundColor: currentTextColor || 'currentColor' }} />
                  </div>
                </Button>
                </PopoverTrigger>
              </ToolbarTooltip>
              <PopoverContent className="w-auto p-2">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Text Color</p>
                <ColorGrid 
                  colors={TEXT_COLORS} 
                  onSelect={(color) => {
                    if (color) {
                      editor.chain().focus().setColor(color).run();
                    } else {
                      editor.chain().focus().unsetColor().run();
                    }
                  }}
                  activeColor={currentTextColor}
                />
                <div className="border-t mt-2 pt-2">
                  <p className="text-xs font-medium mb-1.5 text-muted-foreground">Custom Color</p>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        value={customTextColor}
                        onChange={(e) => setCustomTextColor(e.target.value)}
                        className="w-7 h-7 rounded-sm border border-border cursor-pointer p-0"
                        data-testid="custom-text-color-picker"
                      />
                    </div>
                    <Input
                      value={customTextColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomTextColor(val);
                      }}
                      placeholder="#1e3a5f"
                      className="h-7 text-xs font-mono w-24"
                      data-testid="custom-text-color-input"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        const color = customTextColor.startsWith('#') ? customTextColor : `#${customTextColor}`;
                        editor.chain().focus().setColor(color).run();
                      }}
                      data-testid="apply-custom-text-color"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <ToolbarTooltip label="Highlight color">
                <PopoverTrigger asChild>
                <Button variant={editor.isActive('highlight') ? 'secondary' : 'ghost'} size="icon" data-testid="toolbar-highlight">
                  <div className="flex flex-col items-center">
                    <Highlighter className="h-3.5 w-3.5" />
                    <div className="w-4 h-1 rounded-sm mt-0.5 bg-yellow-300" />
                  </div>
                </Button>
                </PopoverTrigger>
              </ToolbarTooltip>
              <PopoverContent className="w-auto p-2">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Highlight Color</p>
                <div className="grid grid-cols-5 gap-1 p-1">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      className={cn(
                        "w-6 h-6 rounded-sm border border-border cursor-pointer transition-transform",
                        editor.isActive('highlight', { color: c.value }) && "ring-2 ring-primary ring-offset-1"
                      )}
                      style={{ backgroundColor: c.value }}
                      onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
                      title={c.label}
                      data-testid={`highlight-${c.label.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                  ))}
                </div>
                {editor.isActive('highlight') && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-1"
                    onClick={() => editor.chain().focus().unsetHighlight().run()}
                    data-testid="toolbar-remove-highlight"
                  >
                    <RemoveFormatting className="h-3 w-3 mr-1" /> Remove Highlight
                  </Button>
                )}
                <div className="border-t mt-2 pt-2">
                  <p className="text-xs font-medium mb-1.5 text-muted-foreground">Custom Color</p>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        value={customHighlightColor}
                        onChange={(e) => setCustomHighlightColor(e.target.value)}
                        className="w-7 h-7 rounded-sm border border-border cursor-pointer p-0"
                        data-testid="custom-highlight-color-picker"
                      />
                    </div>
                    <Input
                      value={customHighlightColor}
                      onChange={(e) => setCustomHighlightColor(e.target.value)}
                      placeholder="#e6f0ff"
                      className="h-7 text-xs font-mono w-24"
                      data-testid="custom-highlight-color-input"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        const color = customHighlightColor.startsWith('#') ? customHighlightColor : `#${customHighlightColor}`;
                        editor.chain().focus().toggleHighlight({ color }).run();
                      }}
                      data-testid="apply-custom-highlight-color"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <ToolbarTooltip label="Table cell background color">
                <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!editor.isActive('tableCell') && !editor.isActive('tableHeader')}
                  data-testid="toolbar-cell-background"
                >
                  <div className="flex flex-col items-center">
                    <PaintBucket className="h-3.5 w-3.5" />
                    <div className="w-4 h-1 rounded-sm mt-0.5 bg-blue-200" />
                  </div>
                </Button>
                </PopoverTrigger>
              </ToolbarTooltip>
              <PopoverContent className="w-auto p-2">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Cell Background</p>
                <div className="grid grid-cols-6 gap-1 p-1">
                  {CELL_BG_COLORS.map((c) => (
                    <button
                      key={c.value || 'none'}
                      className={cn(
                        "w-6 h-6 rounded-sm border border-border cursor-pointer transition-transform"
                      )}
                      style={{ backgroundColor: c.value || 'transparent' }}
                      onClick={() => {
                        editor.chain().focus().setCellAttribute('backgroundColor', c.value || '').run();
                      }}
                      title={c.label}
                      data-testid={`cell-bg-${c.label.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                  ))}
                </div>
                <div className="border-t mt-2 pt-2">
                  <p className="text-xs font-medium mb-1.5 text-muted-foreground">Custom Color</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customCellBgColor}
                      onChange={(e) => setCustomCellBgColor(e.target.value)}
                      className="w-7 h-7 rounded-sm border border-border cursor-pointer p-0"
                      data-testid="custom-cell-bg-color-picker"
                    />
                    <Input
                      value={customCellBgColor}
                      onChange={(e) => setCustomCellBgColor(e.target.value)}
                      placeholder="#d0ebff"
                      className="h-7 text-xs font-mono w-24"
                      data-testid="custom-cell-bg-color-input"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        const color = customCellBgColor.startsWith('#') ? customCellBgColor : `#${customCellBgColor}`;
                        editor.chain().focus().setCellAttribute('backgroundColor', color).run();
                      }}
                      data-testid="apply-custom-cell-bg-color"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <ToolbarButton
              icon={RemoveFormatting}
              label="Clear Formatting"
              onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            />
            <ToolbarButton
              icon={Paintbrush}
              label={formatPainterActive ? 'Click text to apply format (Esc to cancel)' : 'Format Painter'}
              isActive={formatPainterActive}
              onClick={() => {
                if (formatPainterActive) {
                  setFormatPainterActive(false);
                  return;
                }
                const { from, to } = editor.state.selection;
                const marks: Array<{ type: string; attrs: Record<string, any> }> = [];
                const seen = new Set<string>();
                if (from !== to) {
                  // Capture from a text selection
                  editor.state.doc.nodesBetween(from, to, (node) => {
                    node.marks.forEach(m => {
                      if (!seen.has(m.type.name)) {
                        seen.add(m.type.name);
                        marks.push({ type: m.type.name, attrs: m.attrs });
                      }
                    });
                  });
                } else {
                  // Capture from cursor position (no selection needed)
                  editor.state.doc.resolve(from).marks().forEach(m => {
                    marks.push({ type: m.type.name, attrs: m.attrs });
                  });
                }
                capturedMarks.current = marks;
                // Also capture the block node type (heading level or paragraph)
                // so format painter can transfer H1/H2/H3 styles, not just inline marks
                const $src = editor.state.doc.resolve(from);
                let srcNodeType: { type: string; level?: number } | null = null;
                for (let d = $src.depth; d >= 0; d--) {
                  const node = $src.node(d);
                  if (node.type.name === 'heading') {
                    srcNodeType = { type: 'heading', level: node.attrs.level };
                    break;
                  }
                  if (node.type.name === 'paragraph') {
                    srcNodeType = { type: 'paragraph' };
                    break;
                  }
                }
                capturedNodeType.current = srcNodeType;
                setFormatPainterActive(true);
              }}
              data-testid="toolbar-format-painter"
            />
            
            <Separator orientation="vertical" className="h-6 mx-0.5" />
            
            <ToolbarButton 
              icon={List} 
              label="Bullet List" 
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
            />
            <ToolbarButton 
              icon={ListOrdered} 
              label="Numbered List" 
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
            />
            <ToolbarButton 
              icon={CheckSquare} 
              label="Task List" 
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              isActive={editor.isActive('taskList')}
            />

            <Separator orientation="vertical" className="h-6 mx-0.5" />

            <ToolbarButton 
              icon={Indent} 
              label="Indent" 
              onClick={() => {
                if (editor.isActive('bulletList') || editor.isActive('orderedList')) {
                  editor.chain().focus().sinkListItem('listItem').run();
                } else {
                  const { from, to } = editor.state.selection;
                  const { tr } = editor.state;
                  editor.state.doc.nodesBetween(from, to, (node, pos) => {
                    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                      const currentMargin = parseInt(node.attrs.style?.match(/margin-left:\s*(\d+)px/)?.[1] || '0', 10);
                      tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: `margin-left: ${currentMargin + 40}px` });
                    }
                  });
                  editor.view.dispatch(tr);
                }
              }}
            />
            <ToolbarButton 
              icon={Outdent} 
              label="Outdent" 
              onClick={() => {
                if (editor.isActive('bulletList') || editor.isActive('orderedList')) {
                  editor.chain().focus().liftListItem('listItem').run();
                } else {
                  const { from, to } = editor.state.selection;
                  const { tr } = editor.state;
                  editor.state.doc.nodesBetween(from, to, (node, pos) => {
                    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                      const currentMargin = parseInt(node.attrs.style?.match(/margin-left:\s*(\d+)px/)?.[1] || '0', 10);
                      const newMargin = Math.max(0, currentMargin - 40);
                      tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: newMargin > 0 ? `margin-left: ${newMargin}px` : '' });
                    }
                  });
                  editor.view.dispatch(tr);
                }
              }}
            />
            
            <Separator orientation="vertical" className="h-6 mx-0.5" />

            <ToolbarButton 
              icon={AlignLeft} 
              label="Align Left" 
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              isActive={editor.isActive({ textAlign: 'left' })}
            />
            <ToolbarButton 
              icon={AlignCenter} 
              label="Align Center" 
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              isActive={editor.isActive({ textAlign: 'center' })}
            />
            <ToolbarButton 
              icon={AlignRight} 
              label="Align Right" 
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              isActive={editor.isActive({ textAlign: 'right' })}
            />
            <ToolbarButton 
              icon={AlignJustify} 
              label="Justify" 
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              isActive={editor.isActive({ textAlign: 'justify' })}
            />

            <DropdownMenu>
              <ToolbarTooltip label="Line spacing">
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-2" data-testid="toolbar-line-spacing">
                  <WrapText className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
                </DropdownMenuTrigger>
              </ToolbarTooltip>
              <DropdownMenuContent>
                <DropdownMenuLabel className="text-xs">Line Spacing</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LINE_SPACINGS.map((spacing) => (
                  <DropdownMenuItem
                    key={spacing.value}
                    onClick={() => setLineSpacing(spacing.value)}
                    data-testid={`line-spacing-${spacing.label.replace('.', '-')}`}
                  >
                    {spacing.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Separator orientation="vertical" className="h-6 mx-0.5" />
            
            <ToolbarButton 
              icon={Quote} 
              label="Blockquote" 
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
            />
            <ToolbarButton 
              icon={Minus} 
              label="Horizontal Rule" 
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            />
            
            <Separator orientation="vertical" className="h-6 mx-0.5" />
            
            <DropdownMenu open={tableDropdownOpen} onOpenChange={(o) => { setTableDropdownOpen(o); if (!o) setTableGridHover({ rows: 0, cols: 0 }); }}>
              <ToolbarTooltip label="Table">
                <DropdownMenuTrigger asChild>
                <Button 
                  variant={editor.isActive('table') ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="gap-1 px-2" 
                  data-testid="toolbar-table"
                >
                  <TableIcon className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
                </DropdownMenuTrigger>
              </ToolbarTooltip>
              <DropdownMenuContent>
                {/* ── Hover grid picker ── */}
                <div
                  className="px-2 pt-2 pb-1 select-none"
                  onMouseLeave={() => setTableGridHover({ rows: 0, cols: 0 })}
                >
                  <div className="text-xs text-center mb-1.5 font-medium text-muted-foreground min-h-[16px]">
                    {tableGridHover.rows > 0 && tableGridHover.cols > 0
                      ? `${tableGridHover.cols} × ${tableGridHover.rows} table`
                      : 'Insert Table'}
                  </div>
                  <div
                    className="grid gap-[3px]"
                    style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}
                  >
                    {Array.from({ length: 8 }).map((_, row) =>
                      Array.from({ length: 8 }).map((_, col) => (
                        <div
                          key={`${row}-${col}`}
                          className={cn(
                            "w-5 h-5 rounded-sm border cursor-pointer transition-colors",
                            row < tableGridHover.rows && col < tableGridHover.cols
                              ? "bg-primary/30 border-primary"
                              : "bg-muted/40 border-border hover:bg-primary/15 hover:border-primary/50"
                          )}
                          onMouseEnter={() => setTableGridHover({ rows: row + 1, cols: col + 1 })}
                          onClick={() => {
                            if (tableGridHover.rows > 0 && tableGridHover.cols > 0) {
                              editor.chain().focus().insertTable({
                                rows: tableGridHover.rows,
                                cols: tableGridHover.cols,
                                withHeaderRow: true,
                              }).run();
                            }
                            setTableGridHover({ rows: 0, cols: 0 });
                            setTableDropdownOpen(false);
                          }}
                          data-testid={`table-grid-${row + 1}-${col + 1}`}
                        />
                      ))
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  disabled={!editor.can().addColumnAfter()}
                  data-testid="toolbar-add-column"
                >
                  <ColumnsIcon className="h-4 w-4 mr-2" /> Add Column
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  disabled={!editor.can().addRowAfter()}
                  data-testid="toolbar-add-row"
                >
                  <RowsIcon className="h-4 w-4 mr-2" /> Add Row
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  disabled={!editor.can().deleteColumn()}
                >
                  <ColumnsIcon className="h-4 w-4 mr-2" /> Delete Column
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  disabled={!editor.can().deleteRow()}
                >
                  <RowsIcon className="h-4 w-4 mr-2" /> Delete Row
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  disabled={!editor.can().deleteTable()}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Table
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Merge / Split</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().mergeCells().run()}
                  disabled={!editor.can().mergeCells()}
                  data-testid="toolbar-merge-cells"
                >
                  <Combine className="h-4 w-4 mr-2" /> Merge Selected Cells
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().splitCell().run()}
                  disabled={!editor.can().splitCell()}
                  data-testid="toolbar-split-cell"
                >
                  <Scissors className="h-4 w-4 mr-2" /> Split Cell
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Header Row</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                  data-testid="toolbar-toggle-header-row"
                >
                  <BookOpen className="h-4 w-4 mr-2" /> Toggle Header Row
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
                  data-testid="toolbar-toggle-header-col"
                >
                  <BookOpen className="h-4 w-4 mr-2" /> Toggle Header Column
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Cell Background</DropdownMenuLabel>
                <div className="grid grid-cols-5 gap-1 p-2">
                  {[
                    { label: 'None', value: '' },
                    { label: 'Light Gray', value: '#f1f3f5' },
                    { label: 'Light Blue', value: '#d0ebff' },
                    { label: 'Light Green', value: '#d3f9d8' },
                    { label: 'Light Yellow', value: '#fff9db' },
                    { label: 'Light Red', value: '#ffe3e3' },
                    { label: 'Light Purple', value: '#e5dbff' },
                    { label: 'Light Orange', value: '#ffe8cc' },
                    { label: 'Light Pink', value: '#fcc2d7' },
                    { label: 'Light Teal', value: '#c3fae8' },
                  ].map((c) => (
                    <button
                      key={c.value || 'none'}
                      className={cn(
                        "w-6 h-6 rounded-sm border border-border cursor-pointer"
                      )}
                      style={{ backgroundColor: c.value || 'transparent' }}
                      onClick={() => {
                        if (c.value) {
                          editor.chain().focus().setCellAttribute('backgroundColor', c.value).run();
                        } else {
                          editor.chain().focus().setCellAttribute('backgroundColor', '').run();
                        }
                      }}
                      title={c.label}
                      data-testid={`table-bg-${c.label.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Separator orientation="vertical" className="h-6 mx-0.5" />
            
            <Popover>
              <ToolbarTooltip label="Insert link">
                <PopoverTrigger asChild>
                <Button 
                  variant={editor.isActive('link') ? 'secondary' : 'ghost'} 
                  size="icon"
                  data-testid="toolbar-link"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
                </PopoverTrigger>
              </ToolbarTooltip>
              <PopoverContent className="w-72">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Insert Link</h4>
                  <div className="space-y-2">
                    <Label className="text-xs">URL</Label>
                    <Input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="h-8"
                      data-testid="input-link-url"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={setLink} data-testid="button-set-link">
                      Set Link
                    </Button>
                    {editor.isActive('link') && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => editor.chain().focus().unsetLink().run()}
                        data-testid="button-remove-link"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Popover>
              <ToolbarTooltip label="Insert image">
                <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="toolbar-image">
                  <ImageIcon className="h-4 w-4" />
                </Button>
                </PopoverTrigger>
              </ToolbarTooltip>
              <PopoverContent className="w-80">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">{editor.isActive('image') ? 'Edit Image' : 'Insert Image'}</h4>
                  {editor.isActive('image') && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={() => replaceImageInputRef.current?.click()}
                        disabled={isUploading}
                        data-testid="toolbar-replace-image"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Replace
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1.5"
                        onClick={() => editor.chain().focus().deleteSelection().run()}
                        data-testid="toolbar-delete-image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs mb-1 block">Upload from device</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        data-testid="input-image-file"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        data-testid="button-upload-image"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Choose File'}
                      </Button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-popover px-2 text-muted-foreground">or</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Image URL</Label>
                      <Input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="h-8"
                        data-testid="input-image-url"
                      />
                      <Label className="text-xs">Alt Text</Label>
                      <Input
                        value={imageAlt}
                        onChange={(e) => setImageAlt(e.target.value)}
                        placeholder="Image description"
                        className="h-8"
                        data-testid="input-image-alt"
                      />
                    </div>
                    <Button size="sm" className="w-full" onClick={addImage} data-testid="button-insert-image">
                      Insert Image
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6 mx-0.5" />

            {/* ── Insert Blocks ── */}
            <DropdownMenu open={insertBlocksOpen} onOpenChange={setInsertBlocksOpen}>
              <ToolbarTooltip label="Insert block (callout, video, math…)">
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-2" data-testid="toolbar-insert-blocks">
                  <Plus className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">Insert</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                </DropdownMenuTrigger>
              </ToolbarTooltip>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel className="text-xs">Content Blocks</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { editor.chain().focus().insertCallout('info').run(); setInsertBlocksOpen(false); }} data-testid="insert-callout-info">
                  <Info className="h-4 w-4 mr-2 text-blue-500" /> Callout — Info
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { editor.chain().focus().insertCallout('warning').run(); setInsertBlocksOpen(false); }} data-testid="insert-callout-warning">
                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" /> Callout — Warning
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { editor.chain().focus().insertCallout('success').run(); setInsertBlocksOpen(false); }} data-testid="insert-callout-success">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> Callout — Success
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { editor.chain().focus().insertCallout('danger').run(); setInsertBlocksOpen(false); }} data-testid="insert-callout-danger">
                  <AlertCircle className="h-4 w-4 mr-2 text-red-500" /> Callout — Danger
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { editor.chain().focus().insertCollapsible().run(); setInsertBlocksOpen(false); }} data-testid="insert-collapsible">
                  <Layers className="h-4 w-4 mr-2" /> Collapsible Section
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { editor.chain().focus().insertVideoEmbed().run(); setInsertBlocksOpen(false); }} data-testid="insert-video">
                  <Video className="h-4 w-4 mr-2" /> Video Embed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { editor.chain().focus().insertMathBlock().run(); setInsertBlocksOpen(false); }} data-testid="insert-math">
                  <Sigma className="h-4 w-4 mr-2" /> Math / LaTeX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ── Emoji Picker ── */}
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <ToolbarTooltip label="Insert emoji">
                <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="toolbar-emoji">
                  <Smile className="h-4 w-4" />
                </Button>
                </PopoverTrigger>
              </ToolbarTooltip>
              <PopoverContent className="w-72 p-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Emoji</p>
                <div className="grid grid-cols-10 gap-0.5 max-h-52 overflow-y-auto">
                  {[
                    '😀','😁','😂','🤣','😊','😍','🥰','😎','🤔','😅',
                    '👍','👎','👏','🙌','🤝','🙏','💪','✌️','🤞','👌',
                    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯',
                    '🔥','⚡','✨','🌟','💫','🎉','🎊','🎯','🚀','💡',
                    '📌','📍','📎','🔗','📝','📋','📊','📈','📉','🗂️',
                    '✅','❌','⚠️','ℹ️','🔴','🟡','🟢','🔵','⭐','🏆',
                    '😢','😭','😤','😠','😡','🤯','😱','😴','🥱','🤗',
                  ].map(emoji => (
                    <button
                      key={emoji}
                      className="text-xl hover:bg-muted rounded p-1 transition-colors leading-none"
                      onClick={() => { editor.chain().focus().insertContent(emoji).run(); setEmojiPickerOpen(false); }}
                      data-testid={`emoji-${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* ── RTL / LTR Toggle ── */}
            <ToolbarButton
              icon={ChevronsLeftRight}
              label={editor.isActive({ dir: 'rtl' }) ? 'Switch to LTR' : 'Toggle RTL (Right-to-Left)'}
              isActive={editor.isActive({ dir: 'rtl' })}
              onClick={() => (editor.commands as any).toggleTextDirection()}
              data-testid="toolbar-rtl-toggle"
            />

            {/* ── Table of Contents ── */}
            <Popover open={tocOpen} onOpenChange={setTocOpen}>
              <ToolbarTooltip label="Table of contents (jump to sections)">
                <PopoverTrigger asChild>
                <Button variant={tocOpen ? 'secondary' : 'ghost'} size="icon" data-testid="toolbar-toc">
                  <BookOpen className="h-4 w-4" />
                </Button>
                </PopoverTrigger>
              </ToolbarTooltip>
              <PopoverContent className="w-72 p-0" align="end">
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-medium">Table of Contents</p>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {tocHeadings.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-4 text-center">No headings found</p>
                  ) : (
                    tocHeadings.map((h, i) => (
                      <button
                        key={`${h.id}-${i}`}
                        className="flex items-baseline gap-2 w-full text-left px-3 py-1.5 hover:bg-muted transition-colors text-sm text-primary underline underline-offset-2"
                        style={{ paddingLeft: `${(h.level - 1) * 12 + 12}px` }}
                        onClick={() => {
                          scrollToHeading(h);
                          setTocOpen(false);
                        }}
                        data-testid={`toc-item-${i}`}
                      >
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">H{h.level}</span>
                        <span className="truncate">{h.text}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6 mx-0.5" />
            <div className="flex items-center">
              <ToolbarButton
                icon={printPreview ? EyeOff : Eye}
                label={printPreview ? 'Exit Print Preview' : 'Print Preview'}
                onClick={() => setPrintPreview(!printPreview)}
                isActive={printPreview}
              />
              <DropdownMenu>
                <ToolbarTooltip label="Page size (print preview)">
                  <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-0.5 px-1.5 text-xs text-muted-foreground" 
                    data-testid="toolbar-pagesize-select"
                  >
                    {PAGE_SIZES[pageSize].label}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  </DropdownMenuTrigger>
                </ToolbarTooltip>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Page Size</DropdownMenuLabel>
                  {(Object.keys(PAGE_SIZES) as PageSizeKey[]).map((key) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => {
                        setPageSize(key);
                        if (!printPreview) setPrintPreview(true);
                      }}
                      data-testid={`toolbar-pagesize-${key.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {pageSize === key && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                          <span>{PAGE_SIZES[key].label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{PAGE_SIZES[key].description}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ToolbarButton
              icon={Search}
              label="Find & Replace"
              onClick={() => {
                setShowFindReplace(!showFindReplace);
                if (!showFindReplace) setShowReplaceRow(false);
              }}
              isActive={showFindReplace}
            />

            {onExport && (
              <>
                <DropdownMenu>
                  <ToolbarTooltip label="Export document">
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 px-2" data-testid="toolbar-export">
                      <FileDown className="h-4 w-4" />
                      <span className="text-xs">Export</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    </DropdownMenuTrigger>
                  </ToolbarTooltip>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onExport('pdf')} data-testid="toolbar-export-pdf">
                      <FileText className="h-4 w-4 mr-2" /> Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('docx')} data-testid="toolbar-export-docx">
                      <FileText className="h-4 w-4 mr-2" /> Export as Word (.docx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('html')} data-testid="toolbar-export-html">
                      <FileCode className="h-4 w-4 mr-2" /> Export as HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('markdown')} data-testid="toolbar-export-md">
                      <FileText className="h-4 w-4 mr-2" /> Export as Markdown
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {onAnchorComment && (
              <>
                <Separator orientation="vertical" className="h-6 mx-0.5" />
                <ToolbarTooltip label="Anchor comment to selected text">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 px-2"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!editor) return;
                        const { from, to, empty } = editor.state.selection;
                        if (empty) return;
                        const selectedText = editor.state.doc.textBetween(from, to, ' ');
                        const commentId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                        editor.chain().focus().setInlineComment(commentId).run();
                        onAnchorComment(commentId, selectedText);
                      }}
                      data-testid="toolbar-anchor-comment"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs">Comment</span>
                    </Button>
                </ToolbarTooltip>
              </>
            )}

            {documentId && (
              <>
                <Separator orientation="vertical" className="h-6 mx-0.5" />
                <ToolbarTooltip label="Send this document for sign-off">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 px-2 text-primary hover:bg-primary/10"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const params = new URLSearchParams({
                          compose: '1',
                          jigantoDocId: String(documentId),
                          jigantoDocTitle: documentTitle || 'Untitled',
                        });
                        setLocation(`/modules/e-sign?${params.toString()}`);
                      }}
                      data-testid="toolbar-send-signoff"
                    >
                      <FileSignature className="h-4 w-4" />
                      <span className="text-xs font-medium">Send for Sign-off</span>
                    </Button>
                </ToolbarTooltip>
              </>
            )}
          </div>
          </TooltipProvider>
        </div>
      )}
      
      {printPreview && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-primary/5 border-b text-xs" data-testid="print-preview-bar">
          <div className="flex items-center gap-3">
            <span className="font-medium text-foreground">Print Preview</span>
            <span className="text-muted-foreground">
              {PAGE_SIZES[pageSize].label} ({PAGE_SIZES[pageSize].description}) &middot; {PRINT_MARGIN_INCHES}" margins
            </span>
          </div>
          <PrintPageCount editorContentRef={editorContentRef} pageSize={pageSize} />
        </div>
      )}

      <div
        ref={editorContentRef}
        className={cn(
          "relative bg-background flex-1 min-h-[400px]",
          editable && "overflow-y-auto max-h-[calc(100vh-14rem)]",
          printPreview && "print-preview-container",
        )}
        data-testid="editor-content-scroll"
        onKeyDown={(e) => e.stopPropagation()}
      >
        {showFindReplace && editable && (
          <div className="shrink-0 border-b bg-background/95 px-3 py-2 space-y-2" data-testid="find-replace-bar">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setShowReplaceRow(!showReplaceRow)}
                data-testid="toggle-replace-row"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={findInputRef}
                  value={findText}
                  onChange={(e) => handleFindTextChange(e.target.value)}
                  placeholder="Find in document..."
                  className="h-8 pl-7 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.shiftKey) handleFindPrev();
                      else handleFindNext();
                    }
                  }}
                  data-testid="input-find-text"
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] text-center" data-testid="search-result-count">
                {searchResults.length > 0 ? `${currentSearchIndex + 1} of ${searchResults.length}` : findText ? 'No results' : ''}
              </span>
              <Button variant="ghost" size="icon" onClick={handleFindPrev} disabled={searchResults.length === 0} data-testid="button-find-prev">
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleFindNext} disabled={searchResults.length === 0} data-testid="button-find-next">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant={caseSensitive ? 'secondary' : 'ghost'}
                size="sm"
                className="text-xs px-2 shrink-0"
                onClick={handleCaseSensitiveToggle}
                data-testid="toggle-case-sensitive"
              >
                Aa
              </Button>
              <Button variant="ghost" size="icon" onClick={closeFindReplace} data-testid="button-close-find">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {showReplaceRow && (
              <div className="flex items-center gap-2 pl-9">
                <div className="relative flex-1">
                  <Replace className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="Replace with..."
                    className="h-8 pl-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleReplaceCurrent();
                      }
                    }}
                    data-testid="input-replace-text"
                  />
                </div>
                <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={handleReplaceCurrent} disabled={searchResults.length === 0} data-testid="button-replace">
                  Replace
                </Button>
                <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={handleReplaceAll} disabled={searchResults.length === 0} data-testid="button-replace-all">
                  Replace All
                </Button>
              </div>
            )}
          </div>
        )}
        {printPreview && <PrintPreviewOverlay editorContentRef={editorContentRef} pageSize={pageSize} />}
        <div className="relative" onContextMenu={handleEditorContextMenu}>
        {editor && editable && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: ed, state }) => {
              const { from, to, empty } = state.selection;
              if (empty || from === to) return false;
              if (ed.isActive('table') || ed.isActive('image')) return false;
              return true;
            }}
            options={{ placement: 'top' }}
          >
            <div className="flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md">
              <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                Section
              </span>
              {HEADING_LEVELS.map((level) => {
                const meta = HEADING_LEVEL_META[level];
                const Icon = meta.icon;
                return (
                  <Button
                    key={level}
                    type="button"
                    size="sm"
                    variant={activeHeadingLevel === level ? 'secondary' : 'ghost'}
                    className="h-7 px-1.5"
                    onClick={() => convertBlockToHeading(level)}
                    title={meta.label}
                    data-testid={`bubble-heading-${level}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                );
              })}
            </div>
          </BubbleMenu>
        )}
        {editor && editable && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: ed }) => ed.isActive('image')}
            options={{ placement: 'top' }}
          >
            <div className="flex items-center gap-1 rounded-md border bg-popover p-1 shadow-md">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5"
                onClick={() => replaceImageInputRef.current?.click()}
                disabled={isUploading}
                data-testid="bubble-replace-image"
              >
                <Upload className="h-3.5 w-3.5" />
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-destructive hover:text-destructive"
                onClick={() => editor.chain().focus().deleteSelection().run()}
                data-testid="bubble-delete-image"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </BubbleMenu>
        )}
        <input
          ref={replaceImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleReplaceImageFile}
          data-testid="input-replace-image-file"
        />
        <EditorContent
          editor={editor} 
          className={cn(
            "prose prose-neutral dark:prose-invert max-w-none p-4 min-h-[400px] focus:outline-none bg-background",
            "[&_.ProseMirror]:min-h-[380px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:leading-[1.4] [&_.ProseMirror]:bg-background",
            "[&_.ProseMirror_strong]:!text-inherit [&_.ProseMirror_b]:!text-inherit [&_.ProseMirror_em]:!text-inherit [&_.ProseMirror_i]:!text-inherit",
            "[&_.ProseMirror_p]:my-1 [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h3]:mb-1.5 [&_.ProseMirror_h4]:mb-1",
            "[&_.ProseMirror_h1]:mt-4 [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h3]:mt-2.5 [&_.ProseMirror_h4]:mt-2",
            "[&_.ProseMirror_h1]:scroll-mt-4 [&_.ProseMirror_h2]:scroll-mt-4 [&_.ProseMirror_h3]:scroll-mt-4 [&_.ProseMirror_h4]:scroll-mt-4",
            "[&_.ProseMirror_h1.document-heading-jump-target]:ring-2 [&_.ProseMirror_h1.document-heading-jump-target]:ring-primary/30 [&_.ProseMirror_h1.document-heading-jump-target]:rounded-sm",
            "[&_.ProseMirror_h2.document-heading-jump-target]:ring-2 [&_.ProseMirror_h2.document-heading-jump-target]:ring-primary/30 [&_.ProseMirror_h2.document-heading-jump-target]:rounded-sm",
            "[&_.ProseMirror_h3.document-heading-jump-target]:ring-2 [&_.ProseMirror_h3.document-heading-jump-target]:ring-primary/30 [&_.ProseMirror_h3.document-heading-jump-target]:rounded-sm",
            "[&_.ProseMirror_h4.document-heading-jump-target]:ring-2 [&_.ProseMirror_h4.document-heading-jump-target]:ring-primary/30 [&_.ProseMirror_h4.document-heading-jump-target]:rounded-sm",
            "[&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ol]:my-1 [&_.ProseMirror_li]:my-0.5",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
            "[&_table]:border-collapse [&_table]:w-full [&_table]:table-fixed",
            "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold",
            "[&_td]:border [&_td]:border-border [&_td]:p-2",
            "[&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:break-words [&_th]:[overflow-wrap:anywhere]",
            "[&_.selectedCell]:!bg-primary/15 [&_.selectedCell]:!outline [&_.selectedCell]:!outline-2 [&_.selectedCell]:!-outline-offset-2 [&_.selectedCell]:!outline-primary/40",
            "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0",
            "[&_ul[data-type='taskList']_li]:flex [&_ul[data-type='taskList']_li]:items-start [&_ul[data-type='taskList']_li]:gap-2",
            "[&_ul[data-type='taskList']_li_label]:mt-0.5",
            "[&_ul[data-type='taskList']_li_input]:mt-1",
            "[&_mark]:rounded-sm",
            "[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto",
            "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm",
            "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
            "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic",
            "[&_hr]:border-border [&_hr]:my-4",
            "[&_img]:rounded-lg [&_img]:max-w-full",
            "[&_.ProseMirror-selectednode]:outline [&_.ProseMirror-selectednode]:outline-2 [&_.ProseMirror-selectednode]:outline-primary/50 [&_.ProseMirror-selectednode]:outline-offset-2",
            "[&_sub]:text-xs",
            "[&_sup]:text-xs",
            printPreview && "relative z-0"
          )}
          data-testid="tiptap-content"
        />
        {tableCtxMenu && (
          <div
            style={{ position: 'fixed', top: tableCtxMenu.y, left: tableCtxMenu.x, zIndex: 9999 }}
            className="bg-popover border border-border rounded-md shadow-md py-1 min-w-[200px] text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
              onClick={() => { editor.chain().focus().addRowBefore().run(); setTableCtxMenu(null); }}
              data-testid="ctx-add-row-above"
            >
              <RowsIcon className="h-3.5 w-3.5 text-muted-foreground" /> Add Row Above
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
              onClick={() => { editor.chain().focus().addRowAfter().run(); setTableCtxMenu(null); }}
              data-testid="ctx-add-row-below"
            >
              <RowsIcon className="h-3.5 w-3.5 text-muted-foreground" /> Add Row Below
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
              onClick={() => { editor.chain().focus().addColumnBefore().run(); setTableCtxMenu(null); }}
              data-testid="ctx-add-col-left"
            >
              <ColumnsIcon className="h-3.5 w-3.5 text-muted-foreground" /> Add Column Left
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
              onClick={() => { editor.chain().focus().addColumnAfter().run(); setTableCtxMenu(null); }}
              data-testid="ctx-add-col-right"
            >
              <ColumnsIcon className="h-3.5 w-3.5 text-muted-foreground" /> Add Column Right
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left text-destructive"
              onClick={() => { editor.chain().focus().deleteRow().run(); setTableCtxMenu(null); }}
              data-testid="ctx-delete-row"
            >
              <RowsIcon className="h-3.5 w-3.5" /> Delete Row
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left text-destructive"
              onClick={() => { editor.chain().focus().deleteColumn().run(); setTableCtxMenu(null); }}
              data-testid="ctx-delete-col"
            >
              <ColumnsIcon className="h-3.5 w-3.5" /> Delete Column
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left text-destructive"
              onClick={() => { editor.chain().focus().deleteTable().run(); setTableCtxMenu(null); }}
              data-testid="ctx-delete-table"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Table
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
              onClick={() => { editor.chain().focus().mergeCells().run(); setTableCtxMenu(null); }}
              data-testid="ctx-merge-cells"
            >
              <Combine className="h-3.5 w-3.5 text-muted-foreground" /> Merge Cells
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
              onClick={() => { editor.chain().focus().splitCell().run(); setTableCtxMenu(null); }}
              data-testid="ctx-split-cell"
            >
              <Scissors className="h-3.5 w-3.5 text-muted-foreground" /> Split Cell
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
              onClick={() => { editor.chain().focus().toggleHeaderRow().run(); setTableCtxMenu(null); }}
              data-testid="ctx-toggle-header-row"
            >
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" /> Toggle Header Row
            </button>
          </div>
        )}
        {headingCtxMenu && editable && (
          <div
            style={{ position: 'fixed', top: headingCtxMenu.y, left: headingCtxMenu.x, zIndex: 9999 }}
            className="bg-popover border border-border rounded-md shadow-md py-1 min-w-[220px] text-sm"
            onClick={(e) => e.stopPropagation()}
            data-testid="heading-context-menu"
          >
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Convert to section
            </p>
            {HEADING_LEVELS.map((level) => {
              const meta = HEADING_LEVEL_META[level];
              const Icon = meta.icon;
              const isActive = activeHeadingLevel === level;
              const isSuggested = suggestedHeadingLevel === level && activeHeadingLevel !== level;
              return (
                <button
                  key={level}
                  type="button"
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left',
                    isActive && 'bg-accent/60',
                  )}
                  onClick={() => convertBlockToHeading(level)}
                  data-testid={`ctx-convert-heading-${level}`}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1">{meta.label}</span>
                  {isSuggested && (
                    <span className="text-[10px] font-medium text-primary shrink-0">Suggested</span>
                  )}
                  {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
            {activeHeadingLevel !== null && (
              <>
                <div className="h-px bg-border my-1" />
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
                  onClick={convertBlockToParagraph}
                  data-testid="ctx-convert-paragraph"
                >
                  <Type className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>Normal paragraph</span>
                </button>
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ── Word / Character Count status bar ── */}
      {editable && editor && (
        <div className="flex items-center justify-between px-4 py-1 border-t bg-muted/30 text-[11px] text-muted-foreground select-none" data-testid="editor-wordcount-bar">
          <div className="flex items-center gap-3">
            <span data-testid="wordcount-words">
              {(() => {
                const text = editor.getText();
                const words = text.trim() ? text.trim().split(/\s+/).length : 0;
                return `${words.toLocaleString()} word${words !== 1 ? 's' : ''}`;
              })()}
            </span>
            <span className="text-border">·</span>
            <span data-testid="wordcount-chars">
              {(editor.storage.characterCount as any)?.characters?.() ?? editor.getText().length} characters
            </span>
          </div>
          {formatPainterActive && (
            <span className="text-primary font-medium animate-pulse">
              Format Painter active — select text to apply
            </span>
          )}
        </div>
      )}
    </div>
  );
}
