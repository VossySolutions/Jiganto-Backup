import { useState, useCallback, useRef, useEffect, useMemo, Fragment, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { DOCX_MAMMOTH_STYLE_MAP, prepareDocxImport, applyDocxStyles, isIgnorableMammothWarning, extractDocxHeaderFooter } from "@/lib/docx-import";
import {
  ALLOW_UNCATEGORISED_DOCS,
  UNCATEGORISED_FOLDER_VALUE,
  folderSelectValue,
  parseFolderSelectValue,
} from "@/lib/document-folder-policy";
import {
  findDocumentByTitleInFolder,
  suggestUniqueDocumentTitle,
  type DocumentImportConflictAction,
} from "@/lib/document-names";
import { normalizeDocumentHtmlForEditor } from "@/lib/document-html-normalize";
import { useToast } from "@/hooks/use-toast";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  modulePageBannerWrapClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
  ModulePageLoadingShell,
} from "@/components/ModulePageChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FormDialogShell,
  FormDialogViewShell,
  FieldLabel
} from "@/components/ui/form-dialog-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  FileText, Folder, FolderPlus, FilePlus, Search, Star, Clock, ChevronRight, ChevronDown,
  MoreHorizontal, Edit, Trash2, Share2, MessageSquare, ArrowLeft, Plus,
  FolderOpen, Hash, Download, Link2, 
  Pencil, ExternalLink, PanelLeftClose, PanelLeft,
  FolderInput, Save, X, FileUp,
  File, FileImage, FileSpreadsheet, FileArchive,
  Mail, Copy, Check, BookCopy, Globe, Building2, Layers, Palette, Users,
  FileSignature, Bell, XCircle, Eye, Loader2, RotateCcw, Info, Maximize2, Minimize2, AlertTriangle, LayoutTemplate
} from "lucide-react";
import type { MentionUser } from "@/components/TipTapEditor";
const TipTapEditor = lazy(() =>
  import("@/components/TipTapEditor").then((m) => ({ default: m.TipTapEditor })),
);
import { DocumentHeaderFooterEditor } from "@/components/DocumentHeaderFooterEditor";
import { DocumentAccessSection, DocumentAccessHeaderChip } from "@/components/documents/DocumentAccessSection";
import { DocumentPageSectionNavTop, DocumentPageSectionAside, DocumentSectionSidebarToggle } from "@/components/editor/DocumentPageSectionNav";
import { DocumentScrollRegion } from "@/components/editor/DocumentContentPane";
import { DocumentPageLayoutPanel } from "@/components/editor/DocumentPageLayoutPanel";
import { FolderPageLayoutDialog, readFolderPageLayoutFromFolder } from "@/components/documents/FolderPageLayoutDialog";
import { resolveEffectivePageLayout, resolveFolderPageLayoutFromTree, resolvePageLayoutFieldsForSave, mergeDocumentMetadataWithPageLayout } from "@shared/document-page-layout";
import { buildPrintableDocumentHtml } from "@shared/document-export";
import { buildDocumentDocxBlob } from "@/lib/document-docx-export";
import type { Document, DocumentFolder, DocumentVersion, DocumentComment, DocumentFile, DocumentTemplate } from "@shared/schema";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

function PdfCanvasViewer({ fileId }: { fileId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetchWithAuth(`/api/document-files/${fileId}/download?inline=true`);
        if (!response.ok) throw new Error("Failed to fetch PDF");
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const containerWidth = container.clientWidth || 800;
          const scale = Math.min((containerWidth - 48) / page.getViewport({ scale: 1 }).width, 2);
          const viewport = page.getViewport({ scale });

          const canvas = window.document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mx-auto shadow-sm rounded-sm border mb-4";
          canvas.style.maxWidth = "100%";
          canvas.setAttribute("data-testid", `pdf-page-${i}`);
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          }
        }
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to render PDF");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fileId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" data-testid="file-preview-pdf-error">
        <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Unable to render PDF preview.</p>
        <Button variant="outline" onClick={() => window.open(`/api/document-files/${fileId}/download`, '_blank')} data-testid="button-download-pdf-fallback">
          <Download className="h-4 w-4 mr-1.5" /> Download PDF
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="file-preview-pdf">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Rendering PDF...</div>
        </div>
      )}
      {!loading && pageCount > 0 && (
        <div className="px-6 py-2 text-xs text-muted-foreground shrink-0">
          {pageCount} page{pageCount !== 1 ? "s" : ""}
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-auto px-3 sm:px-6 pb-4 sm:pb-6" />
    </div>
  );
}

interface FolderTreeItem extends DocumentFolder {
  children?: FolderTreeItem[];
  docs?: Document[];
  files?: DocumentFile[];
}

function TabLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="tab-loading">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ExplorerLoadingSkeleton() {
  return (
    <div className="px-2 pb-2 space-y-3" data-testid="explorer-loading">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-1.5">
            <Skeleton className="h-7 w-7 rounded-md shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-16" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function DocumentManagementPage() {
  const { toast } = useToast();
  const { isMobile } = useShellLayout();
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [highlightedDocument, setHighlightedDocument] = useState<Document | null>(null);
  const [, setIsPreviewMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#f97316");
  const [newFolderParentId, setNewFolderParentId] = useState<number | null | "root">(null);
  const [renamingFolderColor, setRenamingFolderColor] = useState<string>("#f97316");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState("document");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContentState] = useState("");
  const [editHeaderContent, setEditHeaderContentState] = useState("");
  const [editFooterContent, setEditFooterContentState] = useState("");
  const editHeaderContentRef = useRef("");
  const editFooterContentRef = useRef("");
  const editContentRef = useRef("");
  const lastAutoSavedContent = useRef<string>("");
  const selectedDocumentRef = useRef<Document | null>(null);
  const isEditingRef = useRef(false);
  const pageLayoutEditGenerationRef = useRef(0);
  const lastSyncedDocIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedDocument?.id || selectedDocument.content != null) return;
    let cancelled = false;
    void fetchWithAuth(`/api/documents/${selectedDocument.id}`)
      .then(async (res) => {
        if (cancelled) return null;
        if (res.status === 404) {
          setSelectedDocument(null);
          return null;
        }
        if (!res.ok) return null;
        return res.json() as Promise<Document>;
      })
      .then((full) => {
        if (cancelled || !full) return;
        setSelectedDocument(full);
        if (!isEditingRef.current || !editContentRef.current.trim()) {
          setEditContentState(full.content || "");
          editContentRef.current = full.content || "";
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDocument?.id, selectedDocument?.content]);

  const setEditContent = useCallback((val: string) => {
    editContentRef.current = val;
    setEditContentState(val);
  }, []);
  const [activeTab, setActiveTab] = useState<"content" | "comments" | "versions" | "properties" | "signoff" | "members">("content");
  const [, setLocation] = useLocation();
  const [selectedTagColor, setSelectedTagColor] = useState("#3B82F6");
  const [renamingFolder, setRenamingFolder] = useState<DocumentFolder | null>(null);
  const [renamingDocument, setRenamingDocument] = useState<Document | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isFolderPanelOpen, setIsFolderPanelOpen] = useState(true);
  const [isDocumentFullScreen, setIsDocumentFullScreen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null | "root">(null);
  const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null);
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [saveAsTitle, setSaveAsTitle] = useState("");
  const [saveAsFolderId, setSaveAsFolderId] = useState<number | null>(null);
  const [newDocFolderId, setNewDocFolderId] = useState<number | null>(null);
  const [isSaveLocationOpen, setIsSaveLocationOpen] = useState(false);
  const [saveLocationFolderId, setSaveLocationFolderId] = useState<number | null>(null);
  const [saveLocationTitle, setSaveLocationTitle] = useState("");
  const [recentDocsExpanded, setRecentDocsExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem("jiganto:documents:explorer-recent-expanded");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const [mainRecentExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem("jiganto:documents:main-recent-expanded");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const [recentCollapseHintDismissed, setRecentCollapseHintDismissed] = useState(() => {
    try {
      return localStorage.getItem("jiganto:documents:recent-collapse-hint") === "dismissed";
    } catch {
      return false;
    }
  });

  const dismissRecentCollapseHint = () => {
    setRecentCollapseHintDismissed(true);
    try {
      localStorage.setItem("jiganto:documents:recent-collapse-hint", "dismissed");
    } catch { /* ignore */ }
  };
  const FOLDER_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#f59e0b", "#ec4899", "#6b7280"] as const;

  const [pendingAnchoredComment, setPendingAnchoredComment] = useState<{ id: string; text: string } | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [importSourceTitle, setImportSourceTitle] = useState("");
  const [importConflictAction, setImportConflictAction] = useState<DocumentImportConflictAction>("keep_both");
  const [importFolderId, setImportFolderId] = useState<number | null>(null);
  const [importContent, setImportContent] = useState("");
  const [importHeaderContent, setImportHeaderContent] = useState("");
  const [importFooterContent, setImportFooterContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogUrl, setShareDialogUrl] = useState("");
  const [shareDialogName, setShareDialogName] = useState("");
  const [shareDialogDocId, setShareDialogDocId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [publicLinkLoading, setPublicLinkLoading] = useState(false);
  const [shareTokenLoading, setShareTokenLoading] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [, setIsCreateTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [newTemplateScope, setNewTemplateScope] = useState("global");
  const [newTemplateDepartment, setNewTemplateDepartment] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("");
  const [explorerSearch, setExplorerSearch] = useState("");
  const [activeChip, setActiveChip] = useState<"recent" | "starred" | "shared">("recent");
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [moveToFolderId, setMoveToFolderId] = useState<number | null>(null);
  const [isMoveFolderOpen, setIsMoveFolderOpen] = useState(false);
  const [movingFolder, setMovingFolder] = useState<any>(null);
  const [moveFolderTargetId, setMoveFolderTargetId] = useState<number | null>(null);
  const [folderPageLayoutFolder, setFolderPageLayoutFolder] = useState<DocumentFolder | null>(null);
  const [folderLayoutHeader, setFolderLayoutHeader] = useState("");
  const [folderLayoutFooter, setFolderLayoutFooter] = useState("");
  const docClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);
  const [docxExportDialogOpen, setDocxExportDialogOpen] = useState(false);
  const [docxFontSizePt, setDocxFontSizePt] = useState<string>("11");

  const runDocxExport = async (fontSizePt: number) => {
    if (!selectedDocument) return;
    const content = editContentRef.current || editContent || selectedDocument.content || "";
    const headerHtml = editHeaderContentRef.current || editHeaderContent || "";
    const footerHtml = editFooterContentRef.current || editFooterContent || "";
    const filename = selectedDocument.title.replace(/[^a-z0-9]/gi, '_');
    toast({ title: "Generating Word documentâ€¦" });
    try {
      const buffer = await buildDocumentDocxBlob({
        title: selectedDocument.title,
        contentHtml: content,
        headerHtml,
        footerHtml,
        bodyFontSizePt: fontSizePt,
      });
      const url = URL.createObjectURL(buffer);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Word document downloaded", description: `${selectedDocument.title}.docx` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message || "Failed to generate Word file", variant: "destructive" });
    }
  };

  const handleExport = async (format: "pdf" | "html" | "markdown" | "docx") => {
    if (!selectedDocument) return;

    if (format === "docx") {
      setDocxFontSizePt("11");
      setDocxExportDialogOpen(true);
      return;
    }

    const content = editContentRef.current || editContent || selectedDocument.content || "";
    const headerHtml = editHeaderContentRef.current || editHeaderContent || "";
    const footerHtml = editFooterContentRef.current || editFooterContent || "";
    const filename = selectedDocument.title.replace(/[^a-z0-9]/gi, '_');

    if (format === "html") {
      const exportHtml = buildPrintableDocumentHtml({
        title: selectedDocument.title,
        content: `<div class="content">${content}</div>`,
        headerHtml,
        footerHtml,
        updatedAt: selectedDocument.updatedAt,
      });
      const blob = new Blob([exportHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Document Exported", description: `${selectedDocument.title} exported as HTML` });
      return;
    } else if (format === "markdown") {
      // Convert HTML to Markdown using DOM traversal
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      const htmlToMd = (el: Element | null): string => {
        if (!el) return "";
        let md = "";
        el.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            md += node.textContent || "";
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const n = node as Element;
            const tag = n.tagName.toLowerCase();
            const inner = htmlToMd(n);
            if (tag === "h1") md += `\n# ${inner}\n`;
            else if (tag === "h2") md += `\n## ${inner}\n`;
            else if (tag === "h3") md += `\n### ${inner}\n`;
            else if (tag === "h4") md += `\n#### ${inner}\n`;
            else if (tag === "p") md += `\n${inner}\n`;
            else if (tag === "strong" || tag === "b") md += `**${inner}**`;
            else if (tag === "em" || tag === "i") md += `_${inner}_`;
            else if (tag === "code" && n.closest("pre")) md += inner;
            else if (tag === "code") md += `\`${inner}\``;
            else if (tag === "pre") md += `\n\`\`\`\n${inner}\n\`\`\`\n`;
            else if (tag === "blockquote") md += `\n> ${inner.trim()}\n`;
            else if (tag === "li") md += `- ${inner}\n`;
            else if (tag === "ul" || tag === "ol") md += `\n${inner}`;
            else if (tag === "br") md += "\n";
            else if (tag === "hr") md += "\n---\n";
            else if (tag === "a") md += `[${inner}](${n.getAttribute("href") || ""})`;
            else if (tag === "img") md += `![${n.getAttribute("alt") || ""}](${n.getAttribute("src") || ""})`;
            else if (n.getAttribute("data-callout")) md += `\n> **${n.getAttribute("data-callout")?.toUpperCase()}:** ${inner.trim()}\n`;
            else md += inner;
          }
        });
        return md;
      };
      const mdBody = htmlToMd(tempDiv).trim();
      let mdHeader = "";
      let mdFooter = "";
      if (headerHtml.trim()) {
        const headerDiv = document.createElement("div");
        headerDiv.innerHTML = headerHtml;
        mdHeader = `---\n**Page header:** ${htmlToMd(headerDiv).trim()}\n\n`;
      }
      if (footerHtml.trim()) {
        const footerDiv = document.createElement("div");
        footerDiv.innerHTML = footerHtml;
        mdFooter = `\n\n---\n**Page footer:** ${htmlToMd(footerDiv).trim()}\n`;
      }
      const markdown = `# ${selectedDocument.title}\n\n${mdHeader}${mdBody}${mdFooter}\n`;
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Document Exported", description: `${selectedDocument.title} exported as MARKDOWN` });
      return;
    } else if (format === "pdf") {
      toast({ title: "Generating PDF..." });
      try {
        const pdfRes = await fetchWithAuth(`/api/documents/${selectedDocument.id}/export-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, headerHtml, footerHtml }),
        });
        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${filename}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: "PDF downloaded", description: `${selectedDocument.title}.pdf` });
          return;
        }
      } catch { /* fall through to browser print */ }
      toast({ title: "Server PDF unavailable â€” using browser print instead" });
      const printHtml = buildPrintableDocumentHtml({
        title: selectedDocument.title,
        content: `<div class="content">${content}</div>`,
        headerHtml,
        footerHtml,
        updatedAt: selectedDocument.updatedAt,
      });
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
      return;
    }
  };

  const { data: folders = [], isLoading: foldersLoading } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/documents/folders"],
  });

  const { isLoading: docsLoading } = useQuery<(Document & { ownerName: string | null })[]>({
    queryKey: ["/api/documents", selectedFolderId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFolderId !== null) {
        params.append("folderId", String(selectedFolderId));
      } else {
        params.append("folderId", "null");
      }
      const res = await fetchWithAuth(`/api/documents?${params}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const { data: allDocuments = [], isLoading: allDocsLoading } = useQuery<(Document & { ownerName: string | null })[]>({
    queryKey: ["/api/documents/all"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/documents");
      if (!res.ok) throw new Error("Failed to fetch all documents");
      return res.json();
    },
  });

  const importNameConflict = useMemo(() => {
    if (!importSourceTitle.trim()) return null;
    return findDocumentByTitleInFolder(allDocuments, importSourceTitle, importFolderId) ?? null;
  }, [allDocuments, importSourceTitle, importFolderId]);

  const importTitleDuplicate = useMemo(() => {
    if (!importTitle.trim() || importConflictAction === "replace") return null;
    return findDocumentByTitleInFolder(allDocuments, importTitle, importFolderId) ?? null;
  }, [allDocuments, importTitle, importFolderId, importConflictAction]);

  const folderLayoutNodes = useMemo(
    () => folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId ?? null, metadata: f.metadata })),
    [folders],
  );

  const resolvedPageLayout = useMemo(() => {
    if (!selectedDocument) return null;
    return resolveEffectivePageLayout(selectedDocument.metadata, selectedDocument.folderId, folderLayoutNodes);
  }, [selectedDocument, folderLayoutNodes]);

  const applyResolvedPageLayoutToEditor = useCallback((doc: Document | null) => {
    if (!doc) return;
    const resolved = resolveEffectivePageLayout(doc.metadata, doc.folderId, folderLayoutNodes);
    editHeaderContentRef.current = resolved.headerHtml;
    editFooterContentRef.current = resolved.footerHtml;
    setEditHeaderContentState(resolved.headerHtml);
    setEditFooterContentState(resolved.footerHtml);
    pageLayoutEditGenerationRef.current = 0;
  }, [folderLayoutNodes]);

  const openFolderPageLayout = useCallback((folder: DocumentFolder) => {
    const layout = readFolderPageLayoutFromFolder(folder);
    setFolderLayoutHeader(layout.header);
    setFolderLayoutFooter(layout.footer);
    setFolderPageLayoutFolder(folder);
  }, []);

  const resetImportDialog = useCallback(() => {
    setImportContent("");
    setImportHeaderContent("");
    setImportFooterContent("");
    setImportTitle("");
    setImportSourceTitle("");
    setImportConflictAction("keep_both");
    setImportWarnings([]);
  }, []);

  const handleImportFolderChange = useCallback((folderId: number | null) => {
    setImportFolderId(folderId);
    const existing = findDocumentByTitleInFolder(allDocuments, importSourceTitle, folderId);
    if (!existing) {
      setImportConflictAction("keep_both");
      setImportTitle(importSourceTitle);
      return;
    }
    if (importConflictAction === "replace") {
      setImportTitle(existing.title);
      return;
    }
    setImportTitle(suggestUniqueDocumentTitle(importSourceTitle, folderId, allDocuments));
  }, [allDocuments, importSourceTitle, importConflictAction]);

  const handleImportConflictActionChange = useCallback((action: DocumentImportConflictAction) => {
    setImportConflictAction(action);
    if (action === "replace" && importNameConflict) {
      setImportTitle(importNameConflict.title);
      return;
    }
    setImportTitle(suggestUniqueDocumentTitle(importSourceTitle, importFolderId, allDocuments));
  }, [importNameConflict, importSourceTitle, importFolderId, allDocuments]);

  useQuery<(Document & { ownerName: string | null })[]>({
    queryKey: ["/api/documents/search", searchQuery],
    enabled: searchQuery.length > 2,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/documents/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery<DocumentVersion[]>({
    queryKey: ["/api/documents", selectedDocument?.id, "versions"],
    enabled: !!selectedDocument,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/documents/${selectedDocument!.id}/versions`);
      if (!res.ok) throw new Error("Failed to fetch versions");
      return res.json();
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      const res = await apiRequest(
        "POST",
        `/api/documents/${selectedDocument!.id}/versions/${versionId}/restore`,
        {},
      );
      return res.json() as Promise<Document>;
    },
    onSuccess: (doc) => {
      setSelectedDocument(doc);
      setEditContent(doc.content || "");
      lastSyncedDocIdRef.current = doc.id;
      pageLayoutEditGenerationRef.current = 0;
      applyResolvedPageLayoutToEditor(doc);
      queryClient.invalidateQueries({ queryKey: ["/api/documents", doc.id, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/all"] });
      toast({ title: "Version restored", description: `Document restored to v${(doc as { version?: number }).version ?? "?"}` });
    },
    onError: (err: Error) => {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<(DocumentComment & { author: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]>({
    queryKey: ["/api/documents", selectedDocument?.id, "comments"],
    enabled: !!selectedDocument,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/documents/${selectedDocument!.id}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
  });

  const { data: recentDocs = [], isLoading: recentDocsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/recent"],
  });

  const { data: favoriteDocs = [], isLoading: favoriteDocsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/favorites"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/documents/favorites");
      if (!res.ok) throw new Error("Failed to fetch favorites");
      return res.json();
    },
  });

  const { data: sharedWithMeDocs = [], isLoading: sharedDocsLoading } = useQuery<(Document & { sharedBy?: string; sharedAt?: string })[]>({
    queryKey: ["/api/documents/shared-with-me"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/documents/shared-with-me");
      if (!res.ok) throw new Error("Failed to fetch shared documents");
      return res.json();
    },
  });

  const [selectedFile, setSelectedFile] = useState<DocumentFile | null>(null);

  useEffect(() => {
    if (isMobile) setIsFolderPanelOpen(false);
  }, [isMobile]);

  useEffect(() => {
    try {
      localStorage.setItem("jiganto:documents:explorer-recent-expanded", String(recentDocsExpanded));
    } catch { /* ignore */ }
  }, [recentDocsExpanded]);

  useEffect(() => {
    try {
      localStorage.setItem("jiganto:documents:main-recent-expanded", String(mainRecentExpanded));
    } catch { /* ignore */ }
  }, [mainRecentExpanded]);

  const prevMobileSelectionRef = useRef<{ docId?: number; fileId?: number }>({});
  useEffect(() => {
    if (!isMobile) return;
    const docId = selectedDocument?.id;
    const fileId = selectedFile?.id;
    const prev = prevMobileSelectionRef.current;
    if (docId !== prev.docId || fileId !== prev.fileId) {
      if (docId || fileId) setIsFolderPanelOpen(false);
      prevMobileSelectionRef.current = { docId, fileId };
    }
  }, [isMobile, selectedDocument?.id, selectedFile?.id]);

  useQuery<DocumentFile[]>({
    queryKey: ["/api/document-files", selectedFolderId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFolderId !== null) {
        params.append("folderId", String(selectedFolderId));
      } else {
        params.append("folderId", "null");
      }
      const res = await fetchWithAuth(`/api/document-files?${params}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
  });

  const { data: allFiles = [] } = useQuery<DocumentFile[]>({
    queryKey: ["/api/document-files/all"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/documents/templates"],
  });

  const { data: allSignoffRequests = [], isLoading: signoffLoading } = useQuery<any[]>({
    queryKey: ["/api/signoff"],
    enabled: !!selectedDocument,
  });

  const explorerChipLoading =
    activeChip === "starred" ? favoriteDocsLoading
    : activeChip === "shared" ? sharedDocsLoading
    : recentDocsLoading;
  const docSignoffRequests = allSignoffRequests
    .filter((r: any) => r.sourceDocumentId === selectedDocument?.id)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const signoffRemindMutation = useMutation({
    mutationFn: (requestId: number) => apiRequest("POST", `/api/signoff/${requestId}/remind`, {}),
    onSuccess: () => toast({ title: "Reminder sent", description: "Pending signers have been notified." }),
    onError: () => toast({ title: "Failed to send reminder", variant: "destructive" }),
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/documents/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/templates"] });
      setIsCreateTemplateOpen(false);
      setNewTemplateName("");
      setNewTemplateDesc("");
      setNewTemplateScope("global");
      setNewTemplateDepartment("");
      setNewTemplateCategory("");
      toast({ title: "Template created", description: "Your template has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template.", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const toggleFolderExpanded = (folderId: number) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; parentId: number | null; color?: string }) => 
      apiRequest("POST", "/api/documents/folders", { ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/folders"] });
      setIsNewFolderOpen(false);
      setNewFolderName("");
      setNewFolderColor("#f97316");
      toast({ title: "Folder created" });
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: number; name: string; color?: string }) =>
      apiRequest("PUT", `/api/documents/folders/${id}`, { name, ...(color ? { color } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/folders"] });
      setRenamingFolder(null);
      setRenameValue("");
      toast({ title: "Folder updated" });
    },
  });

  const saveFolderPageLayoutMutation = useMutation({
    mutationFn: async ({
      id,
      defaultHeaderHtml,
      defaultFooterHtml,
    }: {
      id: number;
      defaultHeaderHtml: string | null;
      defaultFooterHtml: string | null;
    }) => {
      const folder = folders.find((f) => f.id === id);
      const existingMeta = (folder?.metadata as Record<string, unknown> | undefined) || {};
      return apiRequest("PUT", `/api/documents/folders/${id}`, {
        metadata: {
          ...existingMeta,
          defaultHeaderHtml,
          defaultFooterHtml,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/folders"] });
      setFolderPageLayoutFolder(null);
      toast({ title: "Folder page layout saved" });
    },
    onError: () => {
      toast({ title: "Failed to save folder page layout", variant: "destructive" });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: async ({ id, parentId }: { id: number; parentId: number | null }) =>
      apiRequest("PUT", `/api/documents/folders/${id}`, { parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/folders"] });
      toast({ title: "Folder moved" });
    },
    onError: () => {
      toast({ title: "Failed to move folder", variant: "destructive" });
    },
  });

  const createDocMutation = useMutation({
    mutationFn: async (data: { title: string; type: string; folderId: number | null; content?: string; openAfterCreate?: boolean }) => {
      const res = await apiRequest("POST", "/api/documents", { ...data, content: data.content || "", status: "draft" });
      return res.json() as Promise<Document & { openAfterCreate?: boolean }>;
    },
    onSuccess: (doc: Document & { openAfterCreate?: boolean }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedFolderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/recent"] });
      if (variables.folderId !== null && variables.folderId !== selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ["/api/documents", variables.folderId] });
      }
      setIsNewDocOpen(false);
      setNewDocTitle("");
      if (variables.openAfterCreate !== false) {
        setSelectedDocument(doc);
        setIsEditing(true);
        setIsPreviewMode(false);
        setEditContent(variables.content || "");
        lastSyncedDocIdRef.current = doc.id;
        pageLayoutEditGenerationRef.current = 0;
        applyResolvedPageLayoutToEditor(doc);
        setActiveTab("content");
        setSelectedFile(null);
        toast({ title: "Document created" });
      }
    },
  });

  const updateDocMutation = useMutation({
    mutationFn: async ({ id, updates, silent: _silent }: { id: number; updates: Partial<Document>; silent?: boolean }) => {
      let lastError: Error | null = null;
      const hasContent = "content" in updates && updates.content !== undefined;
      const hasOtherUpdates = Object.keys(updates).some(k => k !== "content");
      const maxAttempts = 6;
      const delays = [500, 1000, 1500, 2500, 4000, 6000];

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (attempt > 0) {
            try {
              await fetch("/api/auth/user", { credentials: "include", signal: AbortSignal.timeout(5000) });
            } catch {
              await new Promise(r => setTimeout(r, delays[attempt] || 2000));
              continue;
            }
          }

          let contentDoc: Document | null = null;
          
          if (hasContent) {
            const contentStr = updates.content || "";
            const formData = new FormData();
            let useCompression = false;
            try {
              if (typeof CompressionStream !== "undefined" && contentStr.length > 1024) {
                const rawBlob = new Blob([contentStr], { type: "text/html" });
                const cs = new CompressionStream("gzip");
                const compressedStream = rawBlob.stream().pipeThrough(cs);
                const compressedBlob = await new Response(compressedStream).blob();
                formData.append("content", compressedBlob, "content.html.gz");
                useCompression = true;
              }
            } catch {}
            if (!useCompression) {
              formData.append("content", new Blob([contentStr], { type: "text/html" }), "content.html");
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            try {
              const contentRes = await fetchWithAuth(`/api/documents/${id}/content`, {
                method: "POST",
                body: formData,
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              if (!contentRes.ok) {
                const text = (await contentRes.text()) || contentRes.statusText;
                throw new Error(`${contentRes.status}: ${text}`);
              }
              contentDoc = await contentRes.json();
            } catch (err) {
              clearTimeout(timeoutId);
              throw err;
            }
          }

          if (hasOtherUpdates) {
            const metaUpdates = { ...updates };
            delete metaUpdates.content;
            const res = await apiRequest("PUT", `/api/documents/${id}`, metaUpdates);
            return res.json() as Promise<Document>;
          }

          return contentDoc as Document;
        } catch (err) {
          lastError = err as Error;
          const msg = lastError.message || "";
          const isRetryable = msg.includes("Failed to fetch") || 
            msg.includes("aborted") || 
            lastError.name === "AbortError" ||
            msg.includes("network") ||
            msg.includes("ECONNRESET") ||
            msg.includes("TypeError") ||
            msg.includes("500:") ||
            msg.includes("Failed to save document content");
          if (attempt < maxAttempts - 1 && isRetryable) {
            await new Promise(r => setTimeout(r, delays[attempt] || 2000));
            continue;
          }
          throw lastError;
        }
      }
      throw lastError;
    },
    retry: false,
    onSuccess: (updatedDoc: Document, variables) => {
      if ("content" in variables.updates && variables.updates.content !== undefined) {
        lastAutoSavedContent.current = variables.updates.content ?? "";
      }
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedFolderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedDocument?.id, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/favorites"] });
      if (variables.silent) {
        if (highlightedDocument?.id === updatedDoc.id) {
          setHighlightedDocument(updatedDoc);
        }
        if (selectedDocument?.id === updatedDoc.id) {
          setSelectedDocument(updatedDoc);
          if ("metadata" in variables.updates) {
            applyResolvedPageLayoutToEditor(updatedDoc);
          }
        }
      } else {
        setSelectedDocument(updatedDoc);
        setEditContent(updatedDoc.content || "");
        applyResolvedPageLayoutToEditor(updatedDoc);
        setIsEditing(false);
        setIsPreviewMode(true);
      }
      setRenamingDocument(null);
      setRenameValue("");
      if (!variables.silent) {
        toast({ title: "Document saved" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const buildDocumentMetadataWithHeaderFooter = useCallback((baseMetadata?: Record<string, unknown>) => {
    const layout = resolvePageLayoutFieldsForSave(
      editHeaderContentRef.current,
      editFooterContentRef.current,
      baseMetadata ?? selectedDocument?.metadata,
      selectedDocument?.folderId ?? null,
      folderLayoutNodes,
    );
    return mergeDocumentMetadataWithPageLayout(baseMetadata, layout);
  }, [selectedDocument?.metadata, selectedDocument?.folderId, folderLayoutNodes]);

  const setEditHeaderContent = useCallback((val: string) => {
    pageLayoutEditGenerationRef.current += 1;
    editHeaderContentRef.current = val;
    setEditHeaderContentState(val);
  }, []);

  const setEditFooterContent = useCallback((val: string) => {
    pageLayoutEditGenerationRef.current += 1;
    editFooterContentRef.current = val;
    setEditFooterContentState(val);
  }, []);

  const handleUseFolderPageLayoutDefaults = useCallback(() => {
    if (!selectedDocument) return;
    const folderLayout = resolveFolderPageLayoutFromTree(folderLayoutNodes, selectedDocument.folderId);
    pageLayoutEditGenerationRef.current = 0;
    editHeaderContentRef.current = folderLayout.headerHtml;
    editFooterContentRef.current = folderLayout.footerHtml;
    setEditHeaderContentState(folderLayout.headerHtml);
    setEditFooterContentState(folderLayout.footerHtml);
    updateDocMutation.mutate({
      id: selectedDocument.id,
      updates: {
        metadata: mergeDocumentMetadataWithPageLayout(
          (selectedDocument.metadata as Record<string, unknown>) || {},
          { headerHtml: null, footerHtml: null },
        ),
      },
      silent: true,
    });
  }, [selectedDocument, folderLayoutNodes, updateDocMutation]);

  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetchWithAuth(`/api/document-files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-files", selectedFolderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-files/all"] });
      setSelectedFile(null);
      toast({ title: "File deleted" });
    },
  });

  const handleDocxUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast({ title: "Invalid file type", description: "Please select a .docx Word document", variant: "destructive" });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 25MB", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    setImportWarnings([]);
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (typeof globalThis.Buffer === "undefined") {
        const { Buffer } = await import("buffer");
        (globalThis as any).Buffer = Buffer;
      }
      const mammothModule = await import("mammoth");
      const mammoth = mammothModule.default || mammothModule;
      const pendingImages: Array<{ placeholder: string; buffer: any; contentType: string }> = [];
      let imgIndex = 0;

      const importPrep = await prepareDocxImport(arrayBuffer);
      const pageRegions = await extractDocxHeaderFooter(arrayBuffer);
      const combinedStyleMap = [
        ...(importPrep?.styleMapEntries ?? []),
        ...DOCX_MAMMOTH_STYLE_MAP,
      ];

      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: combinedStyleMap,
          ...(importPrep?.transformDocument ? { transformDocument: importPrep.transformDocument } : {}),
          convertImage: mammoth.images.imgElement(async (image: any) => {
            try {
              const imageBuffer = await image.read();
              let contentType = image.contentType || "image/png";
              const extMap: Record<string, string> = { "image/x-emf": "png", "image/x-wmf": "png", "image/emf": "png", "image/wmf": "png" };
              if (extMap[contentType]) { contentType = "image/png"; }
              const placeholder = `__DOCX_IMG_${imgIndex++}__`;
              pendingImages.push({ placeholder, buffer: imageBuffer, contentType });
              return { src: placeholder };
            } catch (imgErr: any) {
              console.warn("Image extraction error:", imgErr?.message || imgErr);
              return { src: "" };
            }
          }),
        },
      );

      let html = applyDocxStyles(result.value || "", importPrep);
      html = normalizeDocumentHtmlForEditor(html);
      html = html.replace(/<img[^>]*src=["'](?:\s*)["'][^>]*\/?>/gi, '');
      let imageFailCount = 0;
      for (const img of pendingImages) {
        try {
          const ext = img.contentType.split("/")[1]?.replace(/\+.*/, '') || "png";
          const blob = new globalThis.Blob([img.buffer], { type: img.contentType });
          const imageFile = new globalThis.File([blob], `docx-image-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`, { type: img.contentType });
          const formData = new FormData();
          formData.append("image", imageFile);
          let uploadUrl = "";
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const uploadRes = await fetchWithAuth("/api/documents/upload-image", {
                method: "POST",
                body: formData,
              });
              if (uploadRes.ok) {
                const data = await uploadRes.json();
                uploadUrl = data.url;
                break;
              }
            } catch {
              if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            }
          }
          if (uploadUrl) {
            html = html.replace(img.placeholder, uploadUrl);
          } else {
            html = html.replace(new RegExp(`<img[^>]*src=["']${img.placeholder}["'][^>]*/?>`, 'gi'), '');
            imageFailCount++;
          }
        } catch (uploadErr: any) {
          console.warn("Image upload error:", uploadErr?.message || uploadErr);
          html = html.replace(new RegExp(`<img[^>]*src=["']${img.placeholder}["'][^>]*/?>`, 'gi'), '');
          imageFailCount++;
        }
      }
      if (imageFailCount > 0) {
        setImportWarnings(prev => [...prev, `${imageFailCount} image(s) could not be imported`]);
      }
      const baseTitle = file.name.replace(/\.docx$/i, "") || "Imported Document";
      const targetFolderId = selectedFolderId ?? (ALLOW_UNCATEGORISED_DOCS ? null : folders[0]?.id ?? null);
      const existingDoc = findDocumentByTitleInFolder(allDocuments, baseTitle, targetFolderId);
      setImportSourceTitle(baseTitle);
      setImportConflictAction("keep_both");
      setImportTitle(
        existingDoc
          ? suggestUniqueDocumentTitle(baseTitle, targetFolderId, allDocuments)
          : baseTitle,
      );
      setImportContent(html);
      setImportHeaderContent(pageRegions.headerHtml);
      setImportFooterContent(pageRegions.footerHtml);
      setImportFolderId(targetFolderId);
      const warnings = result.messages
        .filter((m: any) => m.type === "warning")
        .map((m: any) => m.message as string)
        .filter((msg: string) => !isIgnorableMammothWarning(msg));
      if (warnings.length > 0) {
        setImportWarnings(warnings);
      }
      setIsImportOpen(true);
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message || "Failed to convert document", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (docxInputRef.current) docxInputRef.current.value = "";
    }
  }, [selectedFolderId, folders, toast, allDocuments]);

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        await apiRequest("DELETE", `/api/documents/${id}`);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("404:")) return;
        throw err;
      }
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedFolderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/favorites"] });
      if (selectedDocumentRef.current?.id === deletedId) {
      setSelectedDocument(null);
      setHighlightedDocument(null);
      setIsPreviewMode(false);
      }
      toast({ title: "Document deleted" });
    },
    onError: (err) => {
      toast({
        title: "Failed to delete document",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  const handleDeleteDocument = useCallback((id: number) => {
    if (deleteDocMutation.isPending) return;
    deleteDocMutation.mutate(id);
  }, [deleteDocMutation]);

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/documents/folders/${id}`),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/all"] });
      if (selectedFolderId === deletedId) setSelectedFolderId(null);
      toast({ title: "Folder deleted" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ documentId, content, position }: { documentId: number; content: string; position?: { commentId: string; anchoredText: string } }) =>
      apiRequest("POST", `/api/documents/${documentId}/comments`, { content, ...(position ? { position } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedDocument?.id, "comments"] });
      toast({ title: "Comment added" });
    },
  });

  const toggleFavorite = async (doc: Document, silent?: boolean) => {
    await updateDocMutation.mutateAsync({ id: doc.id, updates: { isFavorite: !doc.isFavorite }, silent });
    queryClient.invalidateQueries({ queryKey: ["/api/documents/favorites"] });
  };

  const handleShareLink = async (type: "folder" | "document", id: number, name: string) => {
    const url = `${window.location.origin}/modules/documents?${type}=${id}`;
    setShareDialogUrl(url);
    setShareDialogName(name);
    setLinkCopied(false);
    setPublicToken(null);
    setShareDialogOpen(true);
    if (type === "document") {
      setShareDialogDocId(id);
      setShareTokenLoading(true);
      try {
        const res = await fetchWithAuth(`/api/documents/${id}/public-token`);
        if (res.ok) {
          const data = await res.json() as { token: string | null };
          setPublicToken(data.token);
        }
      } catch { /* ignore */ } finally {
        setShareTokenLoading(false);
      }
    } else {
      setShareDialogDocId(null);
      setShareTokenLoading(false);
    }
  };

  const generatePublicLink = async () => {
    if (!shareDialogDocId) return;
    setPublicLinkLoading(true);
    try {
      const res = await fetchWithAuth(`/api/documents/${shareDialogDocId}/public-token`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate public link");
      const data = await res.json() as { token: string };
      setPublicToken(data.token);
      queryClient.invalidateQueries({ queryKey: ["/api/documents", shareDialogDocId, "access"] });
      toast({ title: "Public link created", description: "Anyone with this link can view the document (read-only)." });
    } catch {
      toast({ title: "Failed to generate public link", variant: "destructive" });
    } finally {
      setPublicLinkLoading(false);
    }
  };

  const revokePublicLink = async () => {
    if (!shareDialogDocId) return;
    setPublicLinkLoading(true);
    try {
      await fetchWithAuth(`/api/documents/${shareDialogDocId}/public-token`, { method: "DELETE" });
      setPublicToken(null);
      queryClient.invalidateQueries({ queryKey: ["/api/documents", shareDialogDocId, "access"] });
      toast({ title: "Public link revoked" });
    } catch { /* ignore */ } finally {
      setPublicLinkLoading(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareDialogUrl);
      setLinkCopied(true);
      toast({ title: "Link copied", description: `Link to "${shareDialogName}" copied to clipboard` });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard. Please copy the link manually.", variant: "destructive" });
    }
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Shared: ${shareDialogName}`);
    const body = encodeURIComponent(`I'd like to share "${shareDialogName}" with you:\n\n${shareDialogUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleDownloadDocument = (doc: Document) => {
    const content = doc.content || "";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download started", description: `Downloading "${doc.title}"` });
  };

  const isDescendantOf = (folderId: number, potentialParentId: number): boolean => {
    let current = folders.find(f => f.id === folderId);
    while (current) {
      if (current.parentId === potentialParentId) return true;
      if (!current.parentId) return false;
      current = folders.find(f => f.id === current!.parentId);
    }
    return false;
  };

  const handleFolderDragStart = (e: React.DragEvent, folderId: number) => {
    e.dataTransfer.setData("text/plain", String(folderId));
    e.dataTransfer.setData("application/x-folder-id", String(folderId));
    e.dataTransfer.effectAllowed = "move";
    setDraggingFolderId(folderId);
  };

  const handleFolderDragOver = (e: React.DragEvent, targetFolderId: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.types.includes("application/x-folder-id")) return;
    if (draggingFolderId === targetFolderId) return;
    if (targetFolderId !== null && draggingFolderId !== null && isDescendantOf(targetFolderId, draggingFolderId)) return;
    const draggedFolder = draggingFolderId !== null ? folders.find(f => f.id === draggingFolderId) : null;
    if (draggedFolder && draggedFolder.parentId === targetFolderId) return;
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(targetFolderId === null ? "root" : targetFolderId);
  };

  const handleFolderDrop = (e: React.DragEvent, targetParentId: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    const folderIdStr = e.dataTransfer.getData("application/x-folder-id");
    if (!folderIdStr) return;
    const folderId = Number(folderIdStr);
    if (folderId === targetParentId) return;
    if (targetParentId !== null && isDescendantOf(targetParentId, folderId)) {
      toast({ title: "Cannot move folder into its own subfolder", variant: "destructive" });
      return;
    }
    const folder = folders.find(f => f.id === folderId);
    if (folder && folder.parentId === targetParentId) return;
    moveFolderMutation.mutate({ id: folderId, parentId: targetParentId });
    setDragOverFolderId(null);
    setDraggingFolderId(null);
  };

  const handleDragEnd = () => {
    setDragOverFolderId(null);
    setDraggingFolderId(null);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const related = e.relatedTarget as HTMLElement;
    if (related && e.currentTarget.contains(related)) return;
    setDragOverFolderId(null);
  };

  const openNewFolderDialog = (parentId: number | null) => {
    setNewFolderParentId(parentId);
    setNewFolderName("");
    setIsNewFolderOpen(true);
  };

  const buildFolderTree = (parentId: number | null = null): FolderTreeItem[] => {
    return folders
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map(f => ({
        ...f,
        children: buildFolderTree(f.id),
        docs: allDocuments.filter(d => d.folderId === f.id),
        files: allFiles.filter(file => file.folderId === f.id),
      }));
  };

  const folderTree = buildFolderTree();

  const flatFolderList = useMemo(() => {
    const flat: { id: number; name: string; depth: number }[] = [];
    const flatten = (items: FolderTreeItem[], depth: number) => {
      for (const item of items) {
        flat.push({ id: item.id, name: item.name, depth });
        if (item.children?.length) flatten(item.children, depth + 1);
      }
    };
    flatten(folderTree, 0);
    return flat;
  }, [folderTree]);

  const defaultFolderId = selectedFolderId ?? flatFolderList[0]?.id ?? null;

  /** Folder pre-selected when creating a doc from the current explorer context. */
  const newDocDefaultFolderId = selectedFolderId ?? (ALLOW_UNCATEGORISED_DOCS ? null : defaultFolderId);

  const openNewDocInFolder = useCallback((folderId: number) => {
    setSelectedFolderId(folderId);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.add(folderId);
      return next;
    });
    setNewDocFolderId(folderId);
    setIsNewDocOpen(true);
  }, []);

  const promptSaveLocation = useCallback(() => {
    setSaveLocationFolderId(
      selectedDocumentRef.current?.folderId ??
      selectedFolderId ??
      (ALLOW_UNCATEGORISED_DOCS ? null : defaultFolderId),
    );
    setSaveLocationTitle(selectedDocumentRef.current?.title ?? "");
    setIsSaveLocationOpen(true);
  }, [selectedFolderId, defaultFolderId]);

  const closeDocumentView = useCallback(() => {
    setSelectedDocument(null);
    setIsEditing(false);
    setIsPreviewMode(false);
    setIsFolderPanelOpen(true);
    setIsDocumentFullScreen(false);
    setEditHeaderContentState("");
    setEditFooterContentState("");
    editHeaderContentRef.current = "";
    editFooterContentRef.current = "";
  }, []);

  const toggleDocumentFullScreen = useCallback(() => {
    setIsDocumentFullScreen((prev) => {
      const next = !prev;
      if (next) setIsFolderPanelOpen(false);
      return next;
    });
  }, []);

  const saveDocumentContent = useCallback((doc: Document) => {
    const metadata = buildDocumentMetadataWithHeaderFooter(
      (doc.metadata as Record<string, unknown>) || {},
    );
    if (doc.folderId != null) {
      updateDocMutation.mutate(
        {
          id: doc.id,
          updates: {
            content: editContentRef.current,
            metadata: metadata as Document["metadata"],
          },
          silent: true,
        },
        { onSuccess: () => toast({ title: "Document saved" }) },
      );
      return;
    }
    promptSaveLocation();
  }, [buildDocumentMetadataWithHeaderFooter, promptSaveLocation, updateDocMutation, toast]);

  useEffect(() => {
    if (isNewDocOpen) setNewDocFolderId(newDocDefaultFolderId);
  }, [isNewDocOpen, newDocDefaultFolderId]);

  useEffect(() => {
    if (!selectedDocument) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        toggleDocumentFullScreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDocument, toggleDocumentFullScreen]);

  useEffect(() => {
    if (isImportOpen && importFolderId == null && !ALLOW_UNCATEGORISED_DOCS) {
      setImportFolderId(defaultFolderId);
    }
  }, [isImportOpen, importFolderId, defaultFolderId]);

  const renderFolderSelectItems = (
    testIdPrefix: string,
    options?: { includeUncategorised?: boolean },
  ) => {
    const showUncategorised = options?.includeUncategorised ?? ALLOW_UNCATEGORISED_DOCS;
    return (
      <Fragment>
        {showUncategorised && (
          <SelectItem value={UNCATEGORISED_FOLDER_VALUE} data-testid={`${testIdPrefix}-uncategorised`}>
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              Uncategorised
            </span>
          </SelectItem>
        )}
        {flatFolderList.map((f) => (
          <SelectItem key={f.id} value={String(f.id)} data-testid={`${testIdPrefix}-${f.id}`}>
            <span className="flex items-center gap-1.5" style={{ paddingLeft: `${f.depth * 16}px` }}>
              <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {f.name}
            </span>
          </SelectItem>
        ))}
      </Fragment>
    );
  };

  // Keep refs in sync when opening or switching documents
  useEffect(() => {
    const prevDocId = selectedDocumentRef.current?.id ?? null;
    const nextDocId = selectedDocument?.id ?? null;

    selectedDocumentRef.current = selectedDocument;
    lastAutoSavedContent.current = selectedDocument?.content ?? "";

    if (nextDocId !== prevDocId) {
      const body = selectedDocument?.content || "";
      editContentRef.current = body;
      setEditContentState(body);
      lastSyncedDocIdRef.current = nextDocId;
      pageLayoutEditGenerationRef.current = 0;
      applyResolvedPageLayoutToEditor(selectedDocument);
    }
  }, [selectedDocument?.id, selectedDocument?.content, applyResolvedPageLayoutToEditor, selectedDocument]);

  useEffect(() => {
    if (!selectedDocument) return;
    if (lastSyncedDocIdRef.current !== selectedDocument.id) return;
    if (pageLayoutEditGenerationRef.current > 0 && isEditingRef.current) return;
    applyResolvedPageLayoutToEditor(selectedDocument);
  }, [
    selectedDocument?.metadata,
    selectedDocument?.folderId,
    folderLayoutNodes,
    selectedDocument,
    applyResolvedPageLayoutToEditor,
  ]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Fetch users for @mention suggestions
  const { data: settingsUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/settings/users"],
    staleTime: 60_000,
  });
  const mentionUsers: MentionUser[] = settingsUsers
    .map((u: any) => ({
      id: String(u.id),
      name: ([u.firstName, u.lastName].filter(Boolean).join(" ").trim()) || u.email || String(u.id),
      email: u.email,
    }))
    .filter((u: MentionUser) => typeof u.name === 'string' && u.name.length > 0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get("document") ?? params.get("doc");
    const folderId = params.get("folder");
    if (docId && allDocuments.length > 0) {
      const doc = allDocuments.find(d => d.id === Number(docId));
      if (doc) {
        setSelectedDocument(doc);
        setSelectedFolderId(doc.folderId);
        setEditContent(doc.content || "");
        if (doc.folderId) {
          setExpandedFolders(prev => { const next = new Set(Array.from(prev)); next.add(doc.folderId!); return next; });
        }
        window.history.replaceState({}, "", window.location.pathname);
      }
    } else if (folderId && folders.length > 0) {
      const fId = Number(folderId);
      setSelectedFolderId(fId);
      setExpandedFolders(prev => { const next = new Set(Array.from(prev)); next.add(fId); return next; });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [allDocuments.length, folders.length]);

  const getBreadcrumbs = (): { id: number | null; name: string }[] => {
    const crumbs: { id: number | null; name: string }[] = [{ id: null, name: "Documents" }];
    if (selectedFolderId) {
      const findPath = (folderId: number, path: { id: number; name: string }[] = []): { id: number; name: string }[] => {
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return path;
        const newPath = [{ id: folder.id, name: folder.name }, ...path];
        if (folder.parentId) return findPath(folder.parentId, newPath);
        return newPath;
      };
      crumbs.push(...findPath(selectedFolderId));
    }
    return crumbs;
  };

  const getSmallDocTypeIcon = (type: string) => {
    const iconClass = "h-3.5 w-3.5";
    switch (type) {
      case "wiki": return <FileText className={`${iconClass} text-primary`} />;
      case "template": return <Hash className={`${iconClass} text-brand-purple`} />;
      case "sop": return <FileText className={`${iconClass} text-brand-green`} />;
      case "policy": return <FileText className={`${iconClass} text-brand-orange`} />;
      case "contract": return <FileText className={`${iconClass} text-destructive`} />;
      default: return <FileText className={`${iconClass} text-muted-foreground`} />;
    }
  };

  const getDocBadgeColor = (type: string): string => {
    switch (type) {
      case "wiki": return "bg-primary/10";
      case "template": return "bg-purple-100 dark:bg-purple-950/30";
      case "sop": return "bg-green-100 dark:bg-green-950/30";
      case "policy": return "bg-orange-100 dark:bg-orange-950/30";
      case "contract": return "bg-red-100 dark:bg-red-950/30";
      default: return "bg-muted";
    }
  };

  const getFolderColor = (name: string): string => {
    const n = name.toLowerCase();
    if (/business|management|strategy|enterprise|initiative/.test(n)) return "text-blue-500";
    if (/customer|client|crm|sales|account|contact/.test(n)) return "text-green-500";
    if (/project|delivery|implementation|deployment|sprint/.test(n)) return "text-purple-500";
    if (/finance|budget|invoice|cost|billing|accounting|financial/.test(n)) return "text-amber-500";
    if (/test|qa|quality|validation/.test(n)) return "text-rose-500";
    if (/bpm|process|workflow|procedure|sop/.test(n)) return "text-indigo-500";
    return "text-brand-orange";
  };

  const getRelativeTime = (date: string | Date): string => {
    const d = typeof date === "string" ? new Date(date) : date;
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return "yesterday";
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getFileIcon = (mimeType: string, size?: "sm" | "md") => {
    const cls = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    if (mimeType.startsWith("image/")) return <FileImage className={`${cls} text-brand-green`} />;
    if (mimeType === "application/pdf") return <FileText className={`${cls} text-destructive`} />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return <FileSpreadsheet className={`${cls} text-brand-green`} />;
    if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) return <FileArchive className={`${cls} text-brand-orange`} />;
    if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className={`${cls} text-primary`} />;
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileText className={`${cls} text-brand-orange`} />;
    return <File className={`${cls} text-muted-foreground`} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileClick = (file: DocumentFile) => {
    setSelectedFile(file);
    setSelectedDocument(null);
    setHighlightedDocument(null);
  };

  const rootDocs = allDocuments.filter(d => d.folderId === null);

  const renderExplorerDocMenu = (doc: Document, testIdPrefix: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-6 w-6 text-muted-foreground hover:text-foreground"
          data-testid={`${testIdPrefix}-menu-${doc.id}`}
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingDocument(doc); setRenameValue(doc.title); }}>
          <Pencil className="h-4 w-4 mr-2" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareLink("document", doc.id, doc.title); }}>
          <Share2 className="h-4 w-4 mr-2" /> Share Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadDocument(doc); }}>
          <Download className="h-4 w-4 mr-2" /> Download
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDocument(doc);
            setMoveToFolderId(doc.folderId ?? defaultFolderId);
            setIsMoveToFolderOpen(true);
          }}
          data-testid={`${testIdPrefix}-move-${doc.id}`}
        >
          <FolderInput className="h-4 w-4 mr-2" /> Move to Folder
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderExplorerFileMenu = (file: DocumentFile, testIdPrefix: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-6 w-6 text-muted-foreground hover:text-foreground"
          data-testid={`${testIdPrefix}-menu-${file.id}`}
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/api/document-files/${file.id}/download`, "_blank"); }}>
          <Download className="h-4 w-4 mr-2" /> Download
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareLink("document", file.id, file.originalName); }}>
          <Share2 className="h-4 w-4 mr-2" /> Share Link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={(e) => { e.stopPropagation(); deleteFileMutation.mutate(file.id); }}
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderFolderTreeItem = (folder: FolderTreeItem, depth: number = 0): React.ReactNode => {
    const hasChildren = (folder.children && folder.children.length > 0) || (folder.docs && folder.docs.length > 0) || (folder.files && folder.files.length > 0);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id && !selectedDocument;
    const isDragOver = dragOverFolderId === folder.id;
    const isDragging = draggingFolderId === folder.id;

    return (
      <div key={folder.id} className={isDragging ? "opacity-40" : ""}>
        <div
          className={cn(
            "flex items-center gap-1 py-0.5 px-2 rounded-md cursor-pointer group transition-colors",
            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
            isDragOver && "bg-primary/20 ring-1 ring-primary/40"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => { setSelectedFolderId(folder.id); setSelectedDocument(null); setHighlightedDocument(null); }}
          draggable
          onDragStart={(e) => handleFolderDragStart(e, folder.id)}
          onDragOver={(e) => handleFolderDragOver(e, folder.id)}
          onDrop={(e) => handleFolderDrop(e, folder.id)}
          onDragEnd={handleDragEnd}
          onDragLeave={handleDragLeave}
          data-testid={`tree-folder-${folder.id}`}
        >
          {hasChildren ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); toggleFolderExpanded(folder.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleFolderExpanded(folder.id); }}}
              className="p-0.5 hover:bg-muted-foreground/10 rounded cursor-pointer"
              data-testid={`tree-toggle-${folder.id}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </span>
          ) : (
            <span className="w-4" />
          )}
          {isExpanded ? (
            <FolderOpen className={cn("h-4 w-4 shrink-0", getFolderColor(folder.name))} />
          ) : (
            <Folder className={cn("h-4 w-4 shrink-0", getFolderColor(folder.name))} />
          )}
          <span className="text-sm truncate flex-1">{folder.name}</span>
          {!isExpanded && ((folder.docs?.length || 0) + (folder.files?.length || 0)) > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{(folder.docs?.length || 0) + (folder.files?.length || 0)}</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openNewFolderDialog(folder.id); }}>
                <FolderPlus className="h-4 w-4 mr-2" /> New Subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openNewFolderDialog(folder.parentId); }}>
                <FolderPlus className="h-4 w-4 mr-2" /> New Sibling Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openNewDocInFolder(folder.id); }} data-testid={`tree-folder-new-doc-${folder.id}`}>
                <FilePlus className="h-4 w-4 mr-2" /> New Document
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingFolder(folder); setRenameValue(folder.name); setRenamingFolderColor(folder.color || "#f97316"); }}>
                <Pencil className="h-4 w-4 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openFolderPageLayout(folder); }} data-testid={`tree-folder-page-layout-${folder.id}`}>
                <LayoutTemplate className="h-4 w-4 mr-2" /> Page layout defaults
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareLink("folder", folder.id, folder.name); }}>
                <Share2 className="h-4 w-4 mr-2" /> Share Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMovingFolder(folder); setMoveFolderTargetId(folder.parentId ?? null); setIsMoveFolderOpen(true); }} data-testid={`tree-folder-move-${folder.id}`}>
                <FolderInput className="h-4 w-4 mr-2" /> Move Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); deleteFolderMutation.mutate(folder.id); }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isExpanded && (
          <div>
            {folder.children && folder.children.map(child => renderFolderTreeItem(child, depth + 1))}
            {folder.docs && folder.docs.map(doc => (
              <div
                key={`doc-${doc.id}`}
                className={cn(
                  "flex items-center gap-1.5 py-0.5 px-2 rounded-md cursor-pointer transition-colors group",
                  (selectedDocument?.id === doc.id || highlightedDocument?.id === doc.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                onClick={() => {
                  if (docClickTimer.current) { clearTimeout(docClickTimer.current); docClickTimer.current = null; return; }
                  docClickTimer.current = setTimeout(() => { docClickTimer.current = null; setSelectedDocument(doc); setIsPreviewMode(true); setEditContent(doc.content || ""); setActiveTab("content"); setIsEditing(false); setSelectedFile(null); setHighlightedDocument(null); }, 250);
                }}
                onDoubleClick={(e) => { e.stopPropagation(); if (docClickTimer.current) { clearTimeout(docClickTimer.current); docClickTimer.current = null; } setSelectedDocument(doc); setIsPreviewMode(false); setIsEditing(true); setEditContent(doc.content || ""); setActiveTab("content"); setSelectedFile(null); setHighlightedDocument(null); }}
                data-testid={`tree-doc-${doc.id}`}
              >
                <span className="w-4" />
                {getSmallDocTypeIcon(doc.type)}
                <span className="text-xs truncate flex-1">{doc.title}</span>
                {renderExplorerDocMenu(doc, "tree-doc")}
              </div>
            ))}
            {folder.files && folder.files.map(file => (
              <div
                key={`file-${file.id}`}
                className={cn(
                  "flex items-center gap-1.5 py-0.5 px-2 rounded-md cursor-pointer transition-colors group",
                  selectedFile?.id === file.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                onClick={() => handleFileClick(file)}
                data-testid={`tree-file-${file.id}`}
              >
                <span className="w-4" />
                {getFileIcon(file.mimeType, "sm")}
                <span className="text-xs truncate flex-1">{file.originalName}</span>
                {renderExplorerFileMenu(file, "tree-file")}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExplorerPanel = () => {
    const baseChipDocs = activeChip === "starred" ? favoriteDocs : activeChip === "shared" ? sharedWithMeDocs : recentDocs;
    const displayChipDocs = explorerSearch.length > 0
      ? allDocuments.filter(d => d.title.toLowerCase().includes(explorerSearch.toLowerCase())).slice(0, 7)
      : (baseChipDocs as any[]).slice(0, 8);

    const chipSection = explorerSearch
      ? { label: "Matching documents", icon: Search, count: displayChipDocs.length }
      : activeChip === "starred"
        ? { label: "Starred", icon: Star, count: displayChipDocs.length }
        : activeChip === "shared"
          ? { label: "Shared with me", icon: Users, count: displayChipDocs.length }
          : { label: "Recent", icon: Clock, count: displayChipDocs.length };
    const ChipSectionIcon = chipSection.icon;
    const collapsedPreview = displayChipDocs
      .slice(0, 2)
      .map((d) => d.title)
      .join(" Â· ");
    const collapsedMoreCount = Math.max(0, displayChipDocs.length - 2);

    const statusBadgeColors: Record<string, string> = {
      draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      archived: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
      review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      awaiting_approval: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    };

    const openDoc = (doc: Document) => {
      setSelectedDocument(doc as any);
      setIsPreviewMode(true);
      setEditContent(doc.content || "");
      setActiveTab("content");
      setIsEditing(false);
      setSelectedFile(null);
      setHighlightedDocument(null);
    };

    const editDoc = (doc: Document) => {
      setSelectedDocument(doc as any);
      setIsPreviewMode(false);
      setIsEditing(true);
      setEditContent(doc.content || "");
      setActiveTab("content");
      setSelectedFile(null);
      setHighlightedDocument(null);
    };

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-3 py-2 border-b flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold">Explorer</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsFolderPanelOpen(false)} data-testid="button-close-folder-panel">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-2 pt-2 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Search documents..."
              value={explorerSearch}
              onChange={e => setExplorerSearch(e.target.value)}
              className="w-full pl-8 pr-7 h-8 text-xs rounded-md border border-input bg-background px-3 py-1 shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="input-explorer-search"
            />
            {explorerSearch && (
              <button onClick={() => setExplorerSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick-access chips */}
        {!explorerSearch && (
          <div className="px-2 pb-2 flex items-center gap-1 shrink-0 flex-wrap">
            {([
              { key: "recent", label: "Recent", mobileLabel: "Recent", icon: Clock },
              { key: "starred", label: "Starred", mobileLabel: "Starred", icon: Star },
              { key: "shared", label: "Shared with me", mobileLabel: "Shared", icon: Users },
            ] as const).map(({ key, label, mobileLabel, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveChip(key as "recent" | "starred" | "shared")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                  activeChip === key
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
                data-testid={`chip-${key}`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{mobileLabel}</span>
              </button>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-2 pb-2 space-y-3">

            {/* Recent / Starred / Search results */}
            {!explorerSearch && !recentCollapseHintDismissed && (
              <div
                className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2"
                data-testid="recent-collapse-hint"
              >
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground flex-1 leading-relaxed">
                  <span className="font-medium text-foreground">Tip:</span> Use{" "}
                  <span className="font-medium text-foreground">Hide</span> on the Recent list below to collapse it â€” click{" "}
                  <span className="font-medium text-foreground">Show</span> to expand again.
                </p>
                <button
                  type="button"
                  onClick={dismissRecentCollapseHint}
                  className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded"
                  aria-label="Dismiss tip"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {(explorerSearch ? allDocsLoading : explorerChipLoading) ? (
              <ExplorerLoadingSkeleton />
            ) : displayChipDocs.length > 0 ? (
              <Collapsible
                open={recentDocsExpanded}
                onOpenChange={(open) => {
                  setRecentDocsExpanded(open);
                  if (!open) dismissRecentCollapseHint();
                }}
                className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden"
                data-testid="explorer-recent-section"
              >
                <CollapsibleTrigger
                  className="group/trigger flex items-center gap-1.5 w-full px-2 py-2 text-left hover:bg-muted/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  title={recentDocsExpanded ? "Click to hide this list" : "Click to show this list"}
                >
                  {recentDocsExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <ChipSectionIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-[11px] font-semibold text-foreground truncate">{chipSection.label}</span>
                  <Badge variant="secondary" className="h-5 min-w-[1.25rem] px-1.5 text-[10px] font-medium shrink-0">
                    {chipSection.count}
                  </Badge>
                  <span className="text-[10px] font-semibold text-primary shrink-0 min-w-[2.25rem] text-right group-hover/trigger:underline">
                    {recentDocsExpanded ? "Hide" : "Show"}
                  </span>
                </CollapsibleTrigger>
                {!recentDocsExpanded && collapsedPreview && (
                  <p className="px-2.5 pb-2 text-[10px] text-muted-foreground leading-snug truncate" title={displayChipDocs.map((d) => d.title).join(", ")}>
                    {collapsedPreview}
                    {collapsedMoreCount > 0 ? ` +${collapsedMoreCount} more` : ""}
                  </p>
                )}
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="space-y-0.5 px-1 pb-1.5">
                  {displayChipDocs.map(doc => {
                    const isActive = selectedDocument?.id === doc.id || highlightedDocument?.id === doc.id;
                    const status = (doc as any).status as string | undefined;
                    return (
                      <ContextMenu key={doc.id}>
                        <ContextMenuTrigger asChild>
                          <div
                            className={cn(
                              "flex items-start gap-2 p-1.5 rounded-md cursor-pointer transition-colors group",
                              isActive ? "bg-primary/10" : "hover:bg-muted"
                            )}
                            onClick={() => openDoc(doc as any)}
                            onDoubleClick={() => editDoc(doc as any)}
                            data-testid={`explorer-doc-${doc.id}`}
                          >
                            <div className={cn("h-7 w-7 shrink-0 rounded-md flex items-center justify-center mt-0.5", getDocBadgeColor(doc.type))}>
                              {getSmallDocTypeIcon(doc.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-medium leading-tight", isActive && "text-primary", "truncate")}>{doc.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {doc.updatedAt ? `edited ${getRelativeTime(doc.updatedAt)}` : ""}
                              </p>
                            </div>
                            {status && statusBadgeColors[status] && (
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5", statusBadgeColors[status])}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </span>
                            )}
                            {renderExplorerDocMenu(doc as Document, "explorer-doc")}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem onClick={() => { setRenamingDocument(doc as any); setRenameValue(doc.title); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Rename
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleShareLink("document", doc.id, doc.title)}>
                            <Share2 className="h-4 w-4 mr-2" /> Share Link
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleDownloadDocument(doc as any)}>
                            <Download className="h-4 w-4 mr-2" /> Download
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => { setSelectedDocument(doc as any); setMoveToFolderId((doc as any).folderId ?? defaultFolderId); setIsMoveToFolderOpen(true); }}>
                            <FolderInput className="h-4 w-4 mr-2" /> Move to Folder
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem className="text-destructive" onClick={() => handleDeleteDocument(doc.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </div>
                </CollapsibleContent>
              </Collapsible>
            ) : explorerSearch ? (
              <p className="text-xs text-muted-foreground px-1.5 py-2">No matching documents</p>
            ) : null}

            {/* Folders section */}
            {!explorerSearch && (
              <div>
                <div className="flex items-center justify-between mb-1.5 group/fh">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Folders <span className="font-normal text-muted-foreground/60">Ã‚Â· {folders.length}</span>
                  </p>
                  <button
                    onClick={() => openNewFolderDialog(null)}
                    className="opacity-0 group-hover/fh:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    title="New root folder"
                    data-testid="tree-add-root-folder-inline"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div
                  className="space-y-0.5"
                  onDragOver={(e) => handleFolderDragOver(e, null)}
                  onDrop={(e) => handleFolderDrop(e, null)}
                  onDragLeave={handleDragLeave}
                >
                  {folderTree.length > 0 ? (
                    folderTree.map(folder => renderFolderTreeItem(folder, 0))
                  ) : (
                    <p className="text-xs text-muted-foreground px-1 py-2">No folders yet</p>
                  )}
                </div>

                {/* Uncategorised docs (was "Unfiled Documents") */}
                {rootDocs.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Uncategorised</p>
                    <div className="space-y-0.5">
                      {rootDocs.map(doc => {
                        const isActive = selectedDocument?.id === doc.id || highlightedDocument?.id === doc.id;
                        return (
                          <ContextMenu key={doc.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                className={cn(
                                  "flex items-center gap-1.5 py-1 px-1.5 rounded-md cursor-pointer transition-colors group",
                                  isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                )}
                                onClick={() => {
                                  if (docClickTimer.current) { clearTimeout(docClickTimer.current); docClickTimer.current = null; return; }
                                  docClickTimer.current = setTimeout(() => { docClickTimer.current = null; openDoc(doc as any); }, 250);
                                }}
                                onDoubleClick={(e) => { e.stopPropagation(); if (docClickTimer.current) { clearTimeout(docClickTimer.current); docClickTimer.current = null; } editDoc(doc as any); }}
                                data-testid={`tree-root-doc-${doc.id}`}
                              >
                                {getSmallDocTypeIcon(doc.type)}
                                <span className="text-xs truncate flex-1">{doc.title}</span>
                                {renderExplorerDocMenu(doc as Document, "tree-root-doc")}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48">
                              <ContextMenuItem onClick={() => { setRenamingDocument(doc as any); setRenameValue(doc.title); }}>
                                <Pencil className="h-4 w-4 mr-2" /> Rename
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleShareLink("document", doc.id, doc.title)}>
                                <Share2 className="h-4 w-4 mr-2" /> Share Link
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleDownloadDocument(doc as any)}>
                                <Download className="h-4 w-4 mr-2" /> Download
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => { setSelectedDocument(doc as any); setMoveToFolderId((doc as any).folderId ?? defaultFolderId); setIsMoveToFolderOpen(true); }}>
                                <FolderInput className="h-4 w-4 mr-2" /> Move to Folder
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem className="text-destructive" onClick={() => handleDeleteDocument(doc.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Unfiled Files */}
                {allFiles.filter(f => f.folderId === null).length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Unfiled Files</p>
                    <div className="space-y-0.5">
                      {allFiles.filter(f => f.folderId === null).map(file => (
                        <div
                          key={file.id}
                          className={cn("flex items-center gap-1.5 py-1 px-1.5 rounded-md cursor-pointer hover:bg-muted group", selectedFile?.id === file.id && "bg-primary/10")}
                          onClick={() => handleFileClick(file)}
                          data-testid={`tree-root-file-${file.id}`}
                        >
                          {getFileIcon(file.mimeType, "sm")}
                          <span className="text-xs truncate flex-1">{file.originalName}</span>
                          {renderExplorerFileMenu(file, "tree-root-file")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search: matching folders */}
            {explorerSearch && folderTree.filter(f => f.name.toLowerCase().includes(explorerSearch.toLowerCase())).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Matching Folders</p>
                <div className="space-y-0.5">
                  {folderTree
                    .filter(f => f.name.toLowerCase().includes(explorerSearch.toLowerCase()))
                    .map(folder => renderFolderTreeItem(folder, 0))}
                </div>
              </div>
            )}

            {/* Empty search state */}
            {explorerSearch && displayChipDocs.length === 0 && folderTree.filter(f => f.name.toLowerCase().includes(explorerSearch.toLowerCase())).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No results for "{explorerSearch}"</p>
            )}

          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderDocumentView = () => {
    if (!selectedDocument) return null;
    const docTags = ((selectedDocument.metadata as any)?.tags || []) as Array<{name: string; color: string}>;
    const folderName = folders.find(f => f.id === selectedDocument.folderId)?.name || "Uncategorised";
    const statusColors: Record<string, string> = {
      draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
      review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      awaiting_approval: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    };
    const STATUS_OPTIONS = [
      { value: "draft", label: "Draft" },
      { value: "review", label: "Under Review" },
      { value: "awaiting_approval", label: "Awaiting Approval" },
      { value: "published", label: "Published" },
      { value: "archived", label: "Archived" },
    ];
    const statusLabel = STATUS_OPTIONS.find(s => s.value === selectedDocument.status)?.label
      ?? (selectedDocument.status.charAt(0).toUpperCase() + selectedDocument.status.slice(1));
    // Word count + reading time from HTML content
    const contentHtml = editContent || selectedDocument.content || "";
    const tmpDiv = typeof document !== "undefined" ? document.createElement("div") : null;
    if (tmpDiv) tmpDiv.innerHTML = contentHtml;
    const plainText = tmpDiv?.textContent || tmpDiv?.innerText || "";
    const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
    const openPageLayoutEditor = () => {
      setIsEditing(true);
      setIsPreviewMode(false);
      setEditContent(selectedDocument.content || "");
      setActiveTab("properties");
    };
    const templateSource = (selectedDocument as any).templateId
      ? templates.find(t => t.id === (selectedDocument as any).templateId)
      : null;

    return (
      <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
        <div className="border-b px-3 sm:px-4 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-card sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={closeDocumentView}
              data-testid="button-back-to-list"
              title="Close document"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border shrink-0" />
            <span
              className="text-sm font-medium truncate min-w-0 cursor-pointer hover:text-primary"
              onClick={() => { setRenamingDocument(selectedDocument); setRenameValue(selectedDocument.title); }}
              title="Click to rename"
              data-testid="document-title-clickable"
            >
              {selectedDocument.title}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto max-w-full">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  onClick={() => saveDocumentContent(selectedDocument)}
                  disabled={updateDocMutation.isPending}
                  className="gap-1.5 shrink-0"
                  data-testid="button-save-document"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{updateDocMutation.isPending ? "Saving..." : "Save"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSaveAsTitle(selectedDocument.title + " (Copy)");
                    setSaveAsFolderId(selectedDocument.folderId ?? selectedFolderId ?? (ALLOW_UNCATEGORISED_DOCS ? null : defaultFolderId));
                    setIsSaveAsOpen(true);
                  }}
                  className="gap-1.5 shrink-0 hidden md:inline-flex"
                  data-testid="button-save-as"
                >
                  <FilePlus className="h-3.5 w-3.5" /> Save As
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsEditing(false); setIsPreviewMode(true); setEditContent(selectedDocument.content || ""); }}
                  className="gap-1.5 shrink-0"
                  data-testid="button-cancel-edit"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeDocumentView}
                  className="gap-1.5 shrink-0"
                  data-testid="button-close-document"
                >
                  Close
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => { setIsEditing(true); setIsPreviewMode(false); setEditContent(selectedDocument.content || ""); }}
                className="gap-1.5 shrink-0"
                data-testid="button-edit-document"
              >
                <Edit className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit Document</span>
              </Button>
            )}
            <div className="h-4 w-px bg-border mx-1 hidden sm:block shrink-0" />
            {docTags.length > 0 && (
              <div className="hidden md:flex items-center gap-1 mr-1 shrink-0">
                {docTags.slice(0, 3).map((tag, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                    style={{ borderColor: tag.color, color: tag.color }}
                    data-testid={`header-tag-${i}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </Badge>
                ))}
                {docTags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{docTags.length - 3}</span>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex shrink-0"
              onClick={() => handleDownloadDocument(selectedDocument)}
              data-testid="button-download-document"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="hidden sm:inline-flex shrink-0"
              onClick={() => handleShareLink("document", selectedDocument.id, selectedDocument.title)}
              data-testid="button-share-document"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(selectedDocument, true)}
              data-testid="button-toggle-favorite"
            >
              <Star className={`h-4 w-4 ${selectedDocument.isFavorite ? "fill-brand-orange text-brand-orange" : ""}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-document-menu">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isEditing && (
                  <DropdownMenuItem
                    className="md:hidden"
                    onClick={() => {
                      setSaveAsTitle(selectedDocument.title + " (Copy)");
                      setSaveAsFolderId(selectedDocument.folderId ?? selectedFolderId ?? (ALLOW_UNCATEGORISED_DOCS ? null : defaultFolderId));
                      setIsSaveAsOpen(true);
                    }}
                    data-testid="button-save-as-mobile"
                  >
                    <FilePlus className="h-4 w-4 mr-2" /> Save As
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => { setRenamingDocument(selectedDocument); setRenameValue(selectedDocument.title); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShareLink("document", selectedDocument.id, selectedDocument.title)}>
                  <Link2 className="h-4 w-4 mr-2" /> Share Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadDocument(selectedDocument)}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setMoveToFolderId(selectedDocument.folderId ?? defaultFolderId);
                  setIsMoveToFolderOpen(true);
                }} data-testid="button-move-to-folder">
                  <FolderInput className="h-4 w-4 mr-2" /> Move to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => { handleDeleteDocument(selectedDocument.id); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDocumentFullScreen}
              title={isDocumentFullScreen ? "Exit full screen (Ctrl+Shift+F)" : "Full screen (Ctrl+Shift+F)"}
              data-testid="document-fullscreen-toggle"
            >
              {isDocumentFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {isEditing && activeTab === "content" && (
          <div
            id="document-editor-toolbar-anchor"
            className="shrink-0 border-b bg-muted/95 backdrop-blur-sm relative z-[60] overflow-visible"
            data-testid="document-pinned-toolbar"
          />
        )}

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden"
        >
          <div className="shrink-0 border-b bg-background w-full min-w-0" data-testid="document-view-header">
            {selectedDocument.folderId == null && isEditing && (
              <div className="mx-4 sm:mx-6 lg:mx-8 mt-2 flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-1.5">
                <p className="text-xs text-blue-900 dark:text-blue-200">Uncategorised â€” pick a folder when saving.</p>
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={promptSaveLocation} data-testid="button-choose-folder-to-save">
                  <FolderInput className="h-3.5 w-3.5 mr-1" /> Save locationâ€¦
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 py-2">
              <div className="overflow-x-auto min-w-0 flex-1">
                <TabsList className="bg-muted inline-flex w-max min-w-0 h-8 p-0.5">
                  <TabsTrigger value="content" className="shrink-0 text-xs sm:text-sm px-2.5 sm:px-3 gap-1.5" data-testid="tab-content">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Content</span>
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="shrink-0 text-xs sm:text-sm px-2.5 sm:px-3 gap-1" data-testid="tab-comments">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Comments </span>({comments.length})
                  </TabsTrigger>
                  <TabsTrigger value="versions" className="shrink-0 text-xs sm:text-sm px-2.5 sm:px-3 gap-1.5" data-testid="tab-versions">
                    <Clock className="h-4 w-4" />
                    <span className="hidden sm:inline">History</span>
                  </TabsTrigger>
                  <TabsTrigger value="properties" className="shrink-0 text-xs sm:text-sm px-2.5 sm:px-3 gap-1.5" data-testid="tab-properties">
                    <Hash className="h-4 w-4" />
                    <span className="hidden sm:inline">Properties</span>
                  </TabsTrigger>
                  <TabsTrigger value="signoff" className="shrink-0 text-xs sm:text-sm px-2.5 sm:px-3 gap-1" data-testid="tab-signoff">
                    <FileSignature className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign-off</span>
                    {docSignoffRequests.length > 0 && (
                      <span className={cn(
                        "ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                        docSignoffRequests.some((r: any) => r.status === "pending" || r.status === "partially_signed") 
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                          : docSignoffRequests.some((r: any) => r.status === "completed")
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {docSignoffRequests.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="members" className="shrink-0 text-xs sm:text-sm px-2.5 sm:px-3 gap-1.5" data-testid="tab-members">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Members</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold cursor-pointer hover:opacity-75", statusColors[selectedDocument.status] || statusColors.draft)}
                      data-testid="text-doc-status-badge"
                    >
                      {statusLabel}
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {STATUS_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => updateDocMutation.mutate({ id: selectedDocument.id, updates: { status: opt.value as any } })}
                        className="flex items-center justify-between gap-3"
                        data-testid={`doc-status-option-${opt.value}`}
                      >
                        <span>{opt.label}</span>
                        {selectedDocument.status === opt.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span>v{selectedDocument.currentVersion}</span>
                <DocumentAccessHeaderChip
                  documentId={selectedDocument.id}
                  onOpenMembers={() => setActiveTab("members")}
                />
                {activeTab === "content" && (
                  <DocumentSectionSidebarToggle content={editContent || selectedDocument.content || ""} />
                )}
                {activeTab === "properties" ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 text-xs gap-1.5 shrink-0"
                    onClick={() => setActiveTab("content")}
                    data-testid="button-back-to-document"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Document</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 shrink-0"
                    onClick={() => (isEditing ? setActiveTab("properties") : openPageLayoutEditor())}
                    data-testid="button-page-layout"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Page layout</span>
                  </Button>
                )}
              </div>
            </div>
            {activeTab === "content" && (isEditing || docTags.length > 0) && (
              <div
                className="px-4 sm:px-6 lg:px-8 pb-2 flex flex-wrap items-center gap-2 border-t"
                data-testid="inline-tags-section"
              >
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  {docTags.length > 0 ? (
                    docTags.map((tag, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="gap-1 text-xs"
                        style={{ borderColor: tag.color, color: tag.color }}
                        data-testid={`inline-tag-${i}`}
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                        {isEditing && (
                          <button
                            className="ml-0.5 hover:opacity-70"
                            onClick={() => {
                              const newTags = docTags.filter((_, idx) => idx !== i);
                              const newMetadata = { ...(selectedDocument.metadata as any || {}), tags: newTags };
                              updateDocMutation.mutate({ id: selectedDocument.id, updates: { metadata: newMetadata }, silent: true });
                            }}
                            data-testid={`button-remove-inline-tag-${i}`}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No tags</span>
                  )}
                </div>
                {isEditing && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      placeholder="Add tag..."
                      className="h-7 text-xs w-32"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const input = e.currentTarget;
                          const tagName = input.value.trim();
                          if (!tagName) return;
                          const newTags = [...docTags, { name: tagName, color: selectedTagColor }];
                          const newMetadata = { ...(selectedDocument.metadata as any || {}), tags: newTags };
                          updateDocMutation.mutate({ id: selectedDocument.id, updates: { metadata: newMetadata }, silent: true });
                          input.value = "";
                        }
                      }}
                      data-testid="input-inline-add-tag"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1 px-2" data-testid="button-inline-tag-color">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selectedTagColor }} />
                          <Palette className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="end">
                        <div className="grid grid-cols-4 gap-1.5">
                          {TAG_COLORS.map((color) => (
                            <button
                              key={color.value}
                              className={cn(
                                "h-6 w-6 rounded-full transition-all ring-offset-background",
                                selectedTagColor === color.value ? "ring-2 ring-ring ring-offset-1" : "hover:scale-110"
                              )}
                              style={{ backgroundColor: color.value }}
                              onClick={() => setSelectedTagColor(color.value)}
                              title={color.name}
                              data-testid={`inline-tag-color-${color.name.toLowerCase()}`}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative flex flex-1 min-h-0 min-w-0 w-full overflow-hidden">
          <TabsContent
            value="content"
            className="mt-0 absolute inset-0 flex flex-col overflow-hidden data-[state=inactive]:hidden w-full min-w-0"
          >
            <div className="flex flex-1 min-h-0 gap-3 px-4 sm:px-6 lg:px-8 py-2">
              <div className="flex flex-1 min-h-0 flex-col min-w-0">
                <DocumentPageSectionNavTop content={editContent || selectedDocument.content || ""} />
                <DocumentScrollRegion
                  scrollTestId="document-header-scroll"
                  variant="chrome"
                  edge="top"
                  expanded={isEditing}
                  title="Page header"
                  description={
                    resolvedPageLayout?.headerInherited && resolvedPageLayout.headerSourceFolderName
                      ? `Inherited from folder â€œ${resolvedPageLayout.headerSourceFolderName}â€`
                      : "Repeats on every page when exported to PDF or Word"
                  }
                >
                  <DocumentHeaderFooterEditor
                    kind="header"
                    content={editHeaderContent}
                    onChange={setEditHeaderContent}
                    editable={isEditing}
                    showLabel={false}
                  />
                </DocumentScrollRegion>
                <DocumentScrollRegion scrollTestId="document-word-scroll" variant="main" className="min-h-[12rem]">
                  <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>}>
                    <TipTapEditor
                      content={editContent || selectedDocument.content || ""}
                      onChange={setEditContent}
                      onExport={handleExport}
                      editable={isEditing}
                      toolbarPlacement="pinned"
                      placeholder="Start writing your document..."
                      users={mentionUsers}
                      documentId={selectedDocument?.id}
                      documentTitle={selectedDocument.title}
                      onAnchorComment={(commentId, selectedText) => {
                        setPendingAnchoredComment({ id: commentId, text: selectedText });
                        setActiveTab("comments");
                      }}
                    />
                  </Suspense>
                </DocumentScrollRegion>
                <DocumentScrollRegion
                  scrollTestId="document-footer-scroll"
                  variant="chrome"
                  edge="bottom"
                  expanded={isEditing}
                  title="Page footer"
                  description={
                    resolvedPageLayout?.footerInherited && resolvedPageLayout.footerSourceFolderName
                      ? `Inherited from folder â€œ${resolvedPageLayout.footerSourceFolderName}â€`
                      : "Repeats on every page when exported to PDF or Word"
                  }
                >
                  <DocumentHeaderFooterEditor
                    kind="footer"
                    content={editFooterContent}
                    onChange={setEditFooterContent}
                    editable={isEditing}
                    showLabel={false}
                  />
                </DocumentScrollRegion>
              </div>
              <DocumentPageSectionAside content={editContent || selectedDocument.content || ""} />
            </div>
          </TabsContent>

          <TabsContent
            value="properties"
            className="mt-0 absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden w-full min-w-0"
          >
            <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8">
              <DocumentPageLayoutPanel
                headerContent={editHeaderContent}
                footerContent={editFooterContent}
                onHeaderChange={setEditHeaderContent}
                onFooterChange={setEditFooterContent}
                editable={isEditing}
                onStartEdit={openPageLayoutEditor}
                onBackToDocument={() => setActiveTab("content")}
                headerInherited={resolvedPageLayout?.headerInherited}
                footerInherited={resolvedPageLayout?.footerInherited}
                headerSourceFolderName={resolvedPageLayout?.headerSourceFolderName}
                footerSourceFolderName={resolvedPageLayout?.footerSourceFolderName}
                onUseFolderDefaults={handleUseFolderPageLayoutDefaults}
              />

              <div className="border-t pt-6 w-full">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3 w-full">
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Status</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity select-none focus:outline-none", statusColors[selectedDocument.status] || statusColors.draft)}
                          data-testid="text-doc-status"
                        >
                          {statusLabel}
                          <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {STATUS_OPTIONS.map((opt) => (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={() => updateDocMutation.mutate({ id: selectedDocument.id, updates: { status: opt.value as any } })}
                            className="flex items-center justify-between gap-3"
                            data-testid={`doc-status-option-details-${opt.value}`}
                          >
                            <span>{opt.label}</span>
                            {selectedDocument.status === opt.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Created By</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="text-[10px]">{((selectedDocument as any).ownerName || "U").charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate" data-testid="text-doc-owner">{(selectedDocument as any).ownerName || "Unknown"}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Created</span>
                    <span className="text-sm" data-testid="text-doc-created">
                      {selectedDocument.createdAt ? new Date(selectedDocument.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Last Modified</span>
                    <span className="text-sm" data-testid="text-doc-modified">
                      {selectedDocument.updatedAt ? new Date(selectedDocument.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Version</span>
                    <span className="text-sm" data-testid="text-doc-version">v{selectedDocument.currentVersion}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Location</span>
                    <div className="flex items-center gap-1.5 text-sm min-w-0">
                      <Folder className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                      <span className="truncate" data-testid="text-doc-folder">{folderName}</span>
                    </div>
                  </div>
                  {selectedDocument.viewCount !== undefined && selectedDocument.viewCount !== null && (
                    <div className="flex items-start gap-3">
                      <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Views</span>
                      <span className="text-sm" data-testid="text-doc-views">{selectedDocument.viewCount}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Word count</span>
                    <span className="text-sm" data-testid="text-doc-wordcount">{wordCount.toLocaleString()} words</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Reading time</span>
                    <span className="text-sm" data-testid="text-doc-readtime">~{readingMinutes} min read</span>
                  </div>
                  {templateSource && (
                    <div className="flex items-start gap-3">
                      <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">Template</span>
                      <span className="text-sm text-primary" data-testid="text-doc-template">{templateSource.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {docTags.length > 0 && (
                <div className="border-t pt-4 w-full">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {docTags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                        style={{ borderColor: tag.color, color: tag.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedDocument.description && (
                <div className="border-t pt-4 w-full">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-doc-description">{selectedDocument.description}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="comments"
            className="mt-0 absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden w-full min-w-0"
          >
            <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                {commentsLoading ? (
                  <TabLoadingState label="Loading comments..." />
                ) : (
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No comments yet</p>
                  ) : (
                    comments.map((comment) => {
                      const rawPosition = (comment as any).position;
                      const anchor = rawPosition
                        ? (typeof rawPosition === "string"
                          ? JSON.parse(rawPosition) as { anchoredText?: string }
                          : rawPosition as { anchoredText?: string })
                        : null;
                      return (
                        <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {comment.author?.firstName?.[0]}{comment.author?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm">
                                {comment.author?.firstName} {comment.author?.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt!).toLocaleString()}
                              </span>
                            </div>
                            {anchor?.anchoredText && (
                              <blockquote className="border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 pl-2 py-0.5 text-xs text-muted-foreground italic mb-1.5 rounded-sm truncate">
                                "{anchor.anchoredText}"
                              </blockquote>
                            )}
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div className="pt-3 border-t space-y-2">
                    {pendingAnchoredComment && (
                      <div className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-2 py-1.5 flex items-start gap-2">
                        <span className="text-amber-600 shrink-0 font-medium">Anchored to:</span>
                        <span className="italic text-muted-foreground truncate">"{pendingAnchoredComment.text}"</span>
                        <button
                          onClick={() => setPendingAnchoredComment(null)}
                          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const input = form.elements.namedItem("comment") as HTMLInputElement;
                        if (input.value.trim()) {
                          const position = pendingAnchoredComment
                            ? { commentId: pendingAnchoredComment.id, anchoredText: pendingAnchoredComment.text }
                            : undefined;
                          addCommentMutation.mutate({
                            documentId: selectedDocument.id,
                            content: input.value,
                            ...(position ? { position } : {}),
                          });
                          input.value = "";
                          setPendingAnchoredComment(null);
                        }
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        name="comment"
                        placeholder={pendingAnchoredComment ? "Comment on selected textâ€¦" : "Add a comment..."}
                        className="flex-1"
                        data-testid="input-add-comment"
                      />
                      <Button type="submit" size="sm" disabled={addCommentMutation.isPending} data-testid="button-add-comment">
                        {addCommentMutation.isPending ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Adding...</>
                        ) : "Comment"}
                      </Button>
                    </form>
                  </div>
                </div>
                )}
            </div>
          </TabsContent>

          <TabsContent
            value="versions"
            className="mt-0 absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden w-full min-w-0"
          >
            <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                {versionsLoading ? (
                  <TabLoadingState label="Loading version history..." />
                ) : (
                <div className="space-y-2">
                  {versions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No version history</p>
                  ) : (
                    versions.map((version) => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium shrink-0">
                            v{version.version}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{version.changeDescription || "Content updated"}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(version.createdAt!).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {version.version !== (selectedDocument as { version?: number }).version && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            disabled={restoreVersionMutation.isPending}
                            onClick={() => restoreVersionMutation.mutate(version.id)}
                            data-testid={`button-restore-version-${version.id}`}
                          >
                            {restoreVersionMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Restore
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                )}
            </div>
          </TabsContent>

          <TabsContent
            value="members"
            className="mt-0 absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden w-full min-w-0"
          >
            <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <DocumentAccessSection
                  documentId={selectedDocument.id}
                  ownerId={selectedDocument.ownerId}
                  orgUsers={settingsUsers.map((u: { id: string; email?: string; firstName?: string; lastName?: string }) => ({
                    id: String(u.id),
                    email: u.email,
                    firstName: u.firstName,
                    lastName: u.lastName,
                  }))}
                />
            </div>
          </TabsContent>

          <TabsContent
            value="signoff"
            className="mt-0 absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden w-full min-w-0"
          >
            <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                {signoffLoading ? (
                  <TabLoadingState label="Loading sign-off requests..." />
                ) : docSignoffRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <FileSignature className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-sm mb-1">No sign-off requests</h3>
                    <p className="text-xs text-muted-foreground mb-5 max-w-xs">
                      This document has not been submitted for sign-off. Start a request to collect approvals from your designated signers.
                    </p>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        const params = new URLSearchParams({ compose: "1", jigantoDocId: String(selectedDocument.id), jigantoDocTitle: selectedDocument.title });
                        setLocation(`/modules/e-sign?${params.toString()}`);
                      }}
                      data-testid="button-start-signoff-empty"
                    >
                      <FileSignature className="h-4 w-4" />
                      Start Sign-off Request
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {docSignoffRequests.map((req: any) => {
                      const reqStatusCfg: Record<string, { label: string; cls: string }> = {
                        draft:             { label: "Draft",              cls: "bg-muted text-muted-foreground border-border" },
                        pending:           { label: "Awaiting Signature", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
                        partially_signed:  { label: "Partially Signed",   cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" },
                        completed:         { label: "Completed",          cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" },
                        declined:          { label: "Declined",           cls: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
                        expired:           { label: "Expired",            cls: "bg-muted text-muted-foreground border-border" },
                        voided:            { label: "Voided",             cls: "bg-muted text-muted-foreground/70 border-border line-through" },
                        cancelled:         { label: "Cancelled",          cls: "bg-muted text-muted-foreground border-border" },
                      };
                      const signerStatusCfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
                        pending:  { label: "Pending",  cls: "bg-muted text-muted-foreground border-border",                                          icon: <Clock className="h-3 w-3" /> },
                        viewed:   { label: "Viewed",   cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",          icon: <Eye className="h-3 w-3" /> },
                        signed:   { label: "Signed",   cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300",     icon: <Check className="h-3 w-3" /> },
                        declined: { label: "Declined", cls: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400",               icon: <XCircle className="h-3 w-3" /> },
                      };
                      const rc = reqStatusCfg[req.status] || reqStatusCfg.draft;
                      const canRemind = req.status === "pending" || req.status === "partially_signed";
                      return (
                        <div key={req.id} className="border border-border rounded-xl overflow-hidden" data-testid={`signoff-request-${req.id}`}>
                          {/* Request header */}
                          <div className="flex items-start justify-between gap-3 px-4 py-3 bg-muted/40 border-b border-border">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <FileSignature className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{req.title}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                  <span className="text-xs text-muted-foreground">
                                    Created {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  {req.sentAt && (
                                    <>
                                      <span className="text-muted-foreground/40 text-xs">Ã‚Â·</span>
                                      <span className="text-xs text-muted-foreground">
                                        Sent {new Date(req.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                      </span>
                                    </>
                                  )}
                                  {req.deadline && (
                                    <>
                                      <span className="text-muted-foreground/40 text-xs">Ã‚Â·</span>
                                      <span className="text-xs text-muted-foreground">
                                        Due {new Date(req.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold shrink-0 mt-0.5", rc.cls)}>
                              {rc.label}
                            </span>
                          </div>

                          {/* Signer rows */}
                          {req.signers && req.signers.length > 0 ? (
                            <div className="divide-y divide-border">
                              {[...req.signers]
                                .sort((a: any, b: any) => a.signerOrder - b.signerOrder)
                                .map((signer: any) => {
                                  const ss = signerStatusCfg[signer.status] || signerStatusCfg.pending;
                                  const ts = signer.signedAt || signer.declinedAt || signer.viewedAt;
                                  return (
                                    <div key={signer.id} className="flex items-center gap-3 px-4 py-3" data-testid={`signoff-signer-${signer.id}`}>
                                      <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarFallback className="text-xs">{signer.name.charAt(0).toUpperCase()}</AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-tight truncate">{signer.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{signer.email}</p>
                                        {signer.declineReason && (
                                          <p className="text-xs text-destructive mt-0.5 italic">"{signer.declineReason}"</p>
                                        )}
                                        {ts && (
                                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                                            {signer.signedAt ? "Signed" : signer.declinedAt ? "Declined" : "Viewed"}{" "}
                                            {new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold", ss.cls)}>
                                          {ss.icon}{ss.label}
                                        </span>
                                        {canRemind && (signer.status === "pending" || signer.status === "viewed") && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 gap-1 px-2 text-xs"
                                            onClick={() => signoffRemindMutation.mutate(req.id)}
                                            disabled={signoffRemindMutation.isPending}
                                            data-testid={`button-remind-${signer.id}`}
                                          >
                                            <Bell className="h-3 w-3" />
                                            Remind
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <div className="px-4 py-3 text-xs text-muted-foreground italic">No signers assigned</div>
                          )}

                          {/* Request footer */}
                          <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {req.createdByName ? `Requested by ${req.createdByName}` : ""}
                            </span>
                            {req.status === "completed" && req.completedAt && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                Completed {new Date(req.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        const params = new URLSearchParams({ compose: "1", jigantoDocId: String(selectedDocument.id), jigantoDocTitle: selectedDocument.title });
                        setLocation(`/modules/e-sign?${params.toString()}`);
                      }}
                      data-testid="button-new-signoff-request"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New sign-off request
                    </Button>
                  </div>
                )}
            </div>
          </TabsContent>
          </div>
        </Tabs>
      </div>
    );
  };

  const [filePreviewData, setFilePreviewData] = useState<any>(null);
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  useEffect(() => {
    if (!selectedFile) { setFilePreviewData(null); return; }
    const isNativePreview = selectedFile.mimeType.startsWith("image/") || selectedFile.mimeType === "application/pdf";
    if (isNativePreview) { setFilePreviewData(null); return; }
    setFilePreviewLoading(true);
    setActiveSheetIndex(0);
    fetchWithAuth(`/api/document-files/${selectedFile.id}/preview`)
      .then(r => r.json())
      .then(data => setFilePreviewData(data))
      .catch(() => setFilePreviewData({ type: "unsupported" }))
      .finally(() => setFilePreviewLoading(false));
  }, [selectedFile?.id]);

  const renderFilePreview = () => {
    if (!selectedFile) return null;
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b px-3 sm:px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-card sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 sm:w-auto sm:px-3"
              onClick={() => setSelectedFile(null)}
              data-testid="button-back-from-file"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Back</span>
            </Button>
            <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              {getFileIcon(selectedFile.mimeType)}
              <span className="font-medium truncate">{selectedFile.originalName}</span>
              <Badge variant="secondary" className="text-xs shrink-0">{formatFileSize(selectedFile.size)}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(`/api/document-files/${selectedFile.id}/download`, '_blank')}
              data-testid="button-download-preview-file"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => deleteFileMutation.mutate(selectedFile.id)}
              data-testid="button-delete-preview-file"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3 sm:p-6 bg-muted/30">
          {selectedFile.mimeType.startsWith("image/") ? (
            <div className="flex items-center justify-center h-full">
              <img
                src={`/api/document-files/${selectedFile.id}/download?inline=true`}
                alt={selectedFile.originalName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                data-testid="file-preview-image"
              />
            </div>
          ) : selectedFile.mimeType === "application/pdf" ? (
            <PdfCanvasViewer fileId={selectedFile.id} />

          ) : filePreviewLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-muted-foreground">Loading preview...</div>
            </div>
          ) : filePreviewData?.type === "html" ? (
            filePreviewData.content && filePreviewData.content.trim().length > 0 ? (
              <div className="max-w-4xl mx-auto bg-background rounded-lg border shadow-sm p-8" data-testid="file-preview-docx">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: filePreviewData.content }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4" data-testid="file-preview-docx-empty">
                <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">{selectedFile.originalName}</h3>
                <p className="text-sm text-muted-foreground">This document appears to be empty or contains formatting only.</p>
                <Button variant="outline" onClick={() => window.open(`/api/document-files/${selectedFile.id}/download`, '_blank')} data-testid="button-download-empty-docx">
                  <Download className="h-4 w-4 mr-1.5" /> Download to view in Word
                </Button>
              </div>
            )
          ) : filePreviewData?.type === "spreadsheet" ? (
            <div className="w-full" data-testid="file-preview-xlsx">
              {filePreviewData.sheets.length > 1 && (
                <div className="flex items-center gap-1 mb-3 flex-wrap">
                  {filePreviewData.sheets.map((sheet: any, i: number) => (
                    <Button
                      key={i}
                      variant={activeSheetIndex === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveSheetIndex(i)}
                      data-testid={`sheet-tab-${i}`}
                    >
                      {sheet.name}
                    </Button>
                  ))}
                </div>
              )}
              <div className="bg-background rounded-lg border shadow-sm overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {(filePreviewData.sheets[activeSheetIndex]?.data || []).map((row: any[], ri: number) => (
                      <tr key={ri} className={ri === 0 ? "bg-muted/70 font-medium" : "border-t border-border"}>
                        {row.map((cell: any, ci: number) => (
                          <td key={ci} className="px-3 py-1.5 border-r border-border whitespace-nowrap">
                            {cell != null ? String(cell) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : filePreviewData?.type === "presentation" ? (
            <div className="max-w-4xl mx-auto space-y-4" data-testid="file-preview-pptx">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">{filePreviewData.totalSlides} slide{filePreviewData.totalSlides !== 1 ? "s" : ""}</Badge>
              </div>
              {(filePreviewData.slides || []).map((slide: any, i: number) => (
                <Card key={i} className="overflow-hidden" data-testid={`slide-card-${i}`}>
                  <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">Slide {slide.index}</Badge>
                    <span className="font-medium text-sm truncate">{slide.title}</span>
                  </div>
                  <CardContent className="p-4">
                    <pre className="text-sm whitespace-pre-wrap break-words leading-relaxed font-sans">{slide.content}</pre>
                  </CardContent>
                </Card>
              ))}
              {filePreviewData.totalSlides === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No text content found in this presentation.</p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => window.open(`/api/document-files/${selectedFile.id}/download`, '_blank')}
                    data-testid="button-download-empty-pptx"
                  >
                    <Download className="h-4 w-4 mr-1.5" /> Download to view
                  </Button>
                </div>
              )}
            </div>
          ) : filePreviewData?.type === "text" ? (
            <div className="max-w-4xl mx-auto bg-background rounded-lg border shadow-sm overflow-auto" data-testid="file-preview-text">
              <pre className="p-6 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">{filePreviewData.content}</pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                  {getFileIcon(selectedFile.mimeType)}
                </div>
                <h3 className="font-semibold text-lg mb-1">{selectedFile.originalName}</h3>
                <p className="text-sm text-muted-foreground mb-4">{formatFileSize(selectedFile.size)}</p>
                <Button onClick={() => window.open(`/api/document-files/${selectedFile.id}/download`, '_blank')} data-testid="button-download-non-preview">
                  <Download className="h-4 w-4 mr-1.5" /> Download File
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const TAG_COLORS = [
    { name: "Blue", value: "#3B82F6" },
    { name: "Green", value: "#22C55E" },
    { name: "Red", value: "#EF4444" },
    { name: "Orange", value: "#F59E0B" },
    { name: "Purple", value: "#7C3AED" },
    { name: "Pink", value: "#EC4899" },
    { name: "Teal", value: "#14B8A6" },
    { name: "Indigo", value: "#6366F1" },
  ];


  const renderWelcomeState = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-1" data-testid="text-welcome-title">Document Management</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Click a document to preview it, or double-click to start editing right away.
        </p>
      </div>
    </div>
  );

  if (foldersLoading && docsLoading) {
    return <ModulePageLoadingShell label="Loading documents..." testId="documents-page" />;
  }

  const inDocumentFocus = isDocumentFullScreen && !!selectedDocument;

  return (
    <>
    <ModuleShell
      className={modulePageShellClass}
      testId="documents-page"
      showSidebar={!inDocumentFocus}
      fullBleed={inDocumentFocus}
      mainClassName={cn(
        modulePageMainClass,
        inDocumentFocus && "fixed inset-0 z-50 bg-background",
      )}
    >
        {!inDocumentFocus && (
        <>
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner moduleKey="documents" features={["Rich text editing", "Version control", "Folder hierarchy", "Access control"]} />
        </div>
        <header className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={FileText}
            title="Documents"
            subtitle="Create, organize and collaborate on documents"
            searchPlaceholder="Search documents..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchTestId="input-search-documents"
            titleTestId="documents-title"
            actions={
              <>
                {!isFolderPanelOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFolderPanelOpen(true)}
                    data-testid="button-open-folder-panel-header"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                )}
              </>
            }
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-6 pb-3 gap-2">
            <nav className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground flex-wrap min-w-0">
              {getBreadcrumbs().map((crumb, idx) => (
                <span key={crumb.id ?? "root"} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight className="h-3 w-3" />}
                  <button
                    onClick={() => { setSelectedFolderId(crumb.id); setSelectedDocument(null); }}
                    className={`hover:text-foreground transition-colors ${
                      (crumb.id === selectedFolderId) || (crumb.id === null && selectedFolderId === null)
                        ? "text-foreground font-medium"
                        : ""
                    }`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 sm:hidden" data-testid="button-mobile-more-actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setNewFolderParentId(selectedFolderId); setIsNewFolderOpen(true); }} data-testid="button-new-folder-mobile">
                    <FolderPlus className="h-4 w-4 mr-2" /> New Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsTemplateManagerOpen(true)}>
                    <BookCopy className="h-4 w-4 mr-2" /> Templates
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => docxInputRef.current?.click()} disabled={isImporting}>
                    <FileUp className="h-4 w-4 mr-2" /> {isImporting ? "Converting..." : "Import Word"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 hidden sm:inline-flex"
                onClick={() => {
                  setNewFolderParentId(selectedFolderId);
                  setIsNewFolderOpen(true);
                }}
                data-testid="button-new-folder"
              >
                    <FolderPlus className="h-4 w-4" /> Folder
                  </Button>

              <FormDialogShell
                open={isNewFolderOpen}
                onOpenChange={setIsNewFolderOpen}
                title="Create New Folder"
                subtitle={
                  newFolderParentId === null
                        ? "This folder will be created at the root level." 
                    : `This folder will be created inside "${folders.find(f => f.id === newFolderParentId)?.name || "selected folder"}".`
                }
                saveLabel={createFolderMutation.isPending ? "Creating..." : "Create Folder"}
                saveTestId="button-create-folder"
                onCancel={() => setIsNewFolderOpen(false)}
                onSubmit={() => createFolderMutation.mutate({ name: newFolderName, parentId: newFolderParentId === "root" ? null : newFolderParentId as number | null, color: newFolderColor })}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
                saving={createFolderMutation.isPending}
              >
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <FieldLabel>Folder Name</FieldLabel>
                      <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Enter folder name"
                        data-testid="input-folder-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Folder Color</FieldLabel>
                      <div className="flex items-center gap-2 flex-wrap" data-testid="folder-color-picker">
                        {FOLDER_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewFolderColor(color)}
                            className="h-7 w-7 rounded-md border-2 transition-all hover:scale-110 focus:outline-none"
                            style={{
                              backgroundColor: color,
                              borderColor: newFolderColor === color ? "#1e3a5f" : "transparent",
                              boxShadow: newFolderColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
                            }}
                            title={color}
                            data-testid={`folder-color-${color}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Location</FieldLabel>
                      <Select 
                        value={newFolderParentId === null ? "root" : String(newFolderParentId)} 
                        onValueChange={(v) => setNewFolderParentId(v === "root" ? null : Number(v))}
                      >
                        <SelectTrigger data-testid="select-folder-location">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="root">Root (top level)</SelectItem>
                          {folders.map(f => (
                            <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              </FormDialogShell>

                    <Button 
                size="sm"
                className="gap-1.5"
                data-testid="button-new-document"
                onClick={() => {
                  setNewDocFolderId(newDocDefaultFolderId);
                  setIsNewDocOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Page</span>
                    </Button>

              <FormDialogShell
                open={isNewDocOpen}
                onOpenChange={(open) => {
                setIsNewDocOpen(open);
                if (open) setNewDocFolderId(newDocDefaultFolderId);
                if (!open) setSelectedTemplateId(null);
                }}
                title="Create New Document"
                subtitle="Start blank or choose a template"
                saveLabel="Create"
                saveTestId="button-create-document"
                size="xl"
                onCancel={() => setIsNewDocOpen(false)}
                onSubmit={() => {
                  if (!ALLOW_UNCATEGORISED_DOCS && newDocFolderId == null) {
                    toast({ title: "Folder required", description: "Please choose a folder for this document.", variant: "destructive" });
                    return;
                  }
                  const templateContent = selectedTemplateId
                    ? templates.find(t => t.id === selectedTemplateId)?.content || ""
                    : "";
                  createDocMutation.mutate({
                    title: newDocTitle || "Untitled",
                    type: newDocType,
                    folderId: newDocFolderId,
                    content: templateContent,
                  });
                  setSelectedTemplateId(null);
                }}
                disabled={createDocMutation.isPending || (!ALLOW_UNCATEGORISED_DOCS && newDocFolderId == null)}
              >
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <FieldLabel>Document Title</FieldLabel>
                        <Input
                          value={newDocTitle}
                          onChange={(e) => setNewDocTitle(e.target.value)}
                          placeholder="Untitled"
                          data-testid="input-document-title"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Type</FieldLabel>
                        <Select value={newDocType} onValueChange={setNewDocType}>
                          <SelectTrigger data-testid="select-document-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="document">Document</SelectItem>
                            <SelectItem value="wiki">Wiki Page</SelectItem>
                            <SelectItem value="sop">SOP</SelectItem>
                            <SelectItem value="policy">Policy</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="template">Template</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {templates.length > 0 && (
                      <div className="space-y-2">
                        <FieldLabel>
                          <BookCopy className="h-4 w-4" />
                          Start from Template (optional)
                        </FieldLabel>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-1">
                          <button
                            className={cn(
                              "flex flex-col items-center gap-1 p-3 rounded-md border text-sm cursor-pointer transition-colors",
                              !selectedTemplateId ? "border-primary bg-primary/5" : "border-border"
                            )}
                            onClick={() => setSelectedTemplateId(null)}
                            data-testid="template-blank"
                          >
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <span className="font-medium">Blank Document</span>
                          </button>
                          {templates.map((t) => (
                            <button
                              key={t.id}
                              className={cn(
                                "flex flex-col items-center gap-1 p-3 rounded-md border text-sm cursor-pointer transition-colors text-left",
                                selectedTemplateId === t.id ? "border-primary bg-primary/5" : "border-border"
                              )}
                              onClick={() => setSelectedTemplateId(t.id)}
                              data-testid={`template-option-${t.id}`}
                            >
                              <FileText className="h-8 w-8 text-primary/60" />
                              <span className="font-medium text-center truncate w-full">{t.name}</span>
                              {t.scope !== "global" && (
                                <Badge variant="outline" className="text-[10px]">
                                  {t.department || t.scope}
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <FieldLabel>Save location</FieldLabel>
                      {selectedFolderId != null && (
                        <p className="text-xs text-muted-foreground">
                          Creating in folder: {folders.find(f => f.id === selectedFolderId)?.name}
                        </p>
                      )}
                      <Select
                        value={folderSelectValue(newDocFolderId)}
                        onValueChange={(val) => setNewDocFolderId(parseFolderSelectValue(val))}
                      >
                        <SelectTrigger data-testid="select-new-doc-folder">
                          <SelectValue placeholder="Choose save location" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {renderFolderSelectItems("new-doc-folder")}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              </FormDialogShell>

              <Button 
                size="sm" 
                variant="outline" 
                className="gap-1.5 hidden sm:inline-flex" 
                onClick={() => setIsTemplateManagerOpen(true)}
                data-testid="button-manage-templates"
              >
                <BookCopy className="h-4 w-4" /> Templates
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 hidden sm:inline-flex"
                onClick={() => docxInputRef.current?.click()}
                disabled={isImporting}
                data-testid="button-import-word"
              >
                <FileUp className="h-4 w-4" /> {isImporting ? "Converting..." : "Import Word"}
              </Button>
              <input
                ref={docxInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDocxUpload(file);
                }}
                data-testid="input-import-docx"
              />
            </div>
          </div>
        </header>
        </>
        )}

        <div className="flex flex-1 min-h-0 min-w-0 w-full overflow-hidden">
          {inDocumentFocus ? (
            renderDocumentView()
          ) : (
          <>
          {!isMobile && !isFolderPanelOpen && (
            <div className="w-10 shrink-0 border-r bg-muted/30 flex flex-col items-center pt-2 gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Show Explorer"
                onClick={() => setIsFolderPanelOpen(true)}
                data-testid="button-open-explorer-strip"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>
          )}

          {isMobile ? (
            <>
              <Sheet open={isFolderPanelOpen} onOpenChange={setIsFolderPanelOpen}>
                <SheetContent side="left" className="w-[min(100vw,20rem)] p-0 flex flex-col [&>button]:hidden">
                  {renderExplorerPanel()}
                </SheetContent>
              </Sheet>
              <div className="flex-1 min-h-0 min-w-0">
                {selectedFile ? renderFilePreview() : selectedDocument ? renderDocumentView() : renderWelcomeState()}
              </div>
            </>
          ) : (
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              {isFolderPanelOpen && (
                <>
                  <ResizablePanel id="explorer-panel" order={1} defaultSize={22} minSize={15} maxSize={35} className="bg-muted/30">
                    {renderExplorerPanel()}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              )}

              <ResizablePanel id="content-panel" order={2} defaultSize={78} className="min-w-0">
                {selectedFile ? renderFilePreview() : selectedDocument ? renderDocumentView() : renderWelcomeState()}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
          </>
          )}
        </div>
    </ModuleShell>

      <FormDialogShell
        open={!!renamingFolder}
        onOpenChange={(open) => { if (!open) setRenamingFolder(null); else if (renamingFolder) setRenamingFolderColor(renamingFolder.color || "#f97316"); }}
        title="Edit Folder"
        subtitle="Update the name and color of this folder."
        saveLabel="Save"
        saveTestId="button-confirm-rename-folder"
        onCancel={() => setRenamingFolder(null)}
        onSubmit={() => renamingFolder && renameFolderMutation.mutate({ id: renamingFolder.id, name: renameValue, color: renamingFolderColor })}
        disabled={!renameValue.trim() || renameFolderMutation.isPending}
      >
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <FieldLabel>Folder Name</FieldLabel>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Folder name"
                data-testid="input-rename-folder"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Folder Color</FieldLabel>
              <div className="flex items-center gap-2 flex-wrap" data-testid="folder-color-picker-edit">
                {FOLDER_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setRenamingFolderColor(color)}
                    className="h-7 w-7 rounded-md border-2 transition-all hover:scale-110 focus:outline-none"
                    style={{
                      backgroundColor: color,
                      borderColor: renamingFolderColor === color ? "#1e3a5f" : "transparent",
                      boxShadow: renamingFolderColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
                    }}
                    title={color}
                    data-testid={`folder-edit-color-${color}`}
                  />
                ))}
              </div>
            </div>
            {renamingFolder && (
              <div className="pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const folder = renamingFolder;
                    setRenamingFolder(null);
                    openFolderPageLayout(folder);
                  }}
                  data-testid="button-edit-folder-page-layout"
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  Page layout defaults
                </Button>
              </div>
            )}
          </div>
      </FormDialogShell>

      <FolderPageLayoutDialog
        folder={folderPageLayoutFolder}
        open={!!folderPageLayoutFolder}
        onOpenChange={(open) => { if (!open) setFolderPageLayoutFolder(null); }}
        headerContent={folderLayoutHeader}
        footerContent={folderLayoutFooter}
        onHeaderChange={setFolderLayoutHeader}
        onFooterChange={setFolderLayoutFooter}
        onSave={() => {
          if (!folderPageLayoutFolder) return;
          saveFolderPageLayoutMutation.mutate({
            id: folderPageLayoutFolder.id,
            defaultHeaderHtml: folderLayoutHeader.trim() || null,
            defaultFooterHtml: folderLayoutFooter.trim() || null,
          });
        }}
        saving={saveFolderPageLayoutMutation.isPending}
      />

      <FormDialogShell
        open={docxExportDialogOpen}
        onOpenChange={setDocxExportDialogOpen}
        title="Export as Word (.docx)"
        subtitle="Choose the body text size for the exported document."
        saveLabel="Export"
        saveTestId="button-confirm-docx-export"
        onCancel={() => setDocxExportDialogOpen(false)}
        onSubmit={() => {
          setDocxExportDialogOpen(false);
          runDocxExport(Number(docxFontSizePt) || 11);
        }}
      >
        <div className="py-4 space-y-2">
          <FieldLabel>Font size</FieldLabel>
          <Select value={docxFontSizePt} onValueChange={setDocxFontSizePt}>
            <SelectTrigger data-testid="select-docx-font-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["9", "10", "11", "12", "14", "16"].map((size) => (
                <SelectItem key={size} value={size}>{size} pt{size === "11" ? " (default)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Headings scale proportionally. Header/footer text stays smaller regardless of this setting.</p>
        </div>
      </FormDialogShell>

      <FormDialogShell
        open={!!renamingDocument}
        onOpenChange={(open) => !open && setRenamingDocument(null)}
        title="Rename Document"
        subtitle="Enter a new name for this document."
        saveLabel="Rename"
        saveTestId="button-confirm-rename-document"
        onCancel={() => setRenamingDocument(null)}
        onSubmit={() => renamingDocument && updateDocMutation.mutate({ id: renamingDocument.id, updates: { title: renameValue } })}
        disabled={!renameValue.trim()}
      >
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Document name"
              data-testid="input-rename-document"
            />
          </div>
      </FormDialogShell>

      <FormDialogShell
        open={isSaveAsOpen}
        onOpenChange={setIsSaveAsOpen}
        title="Save As New Document"
        subtitle="Create a copy of this document with a new name and choose a destination folder."
        saveLabel="Save As"
        saveTestId="button-confirm-save-as"
        onCancel={() => setIsSaveAsOpen(false)}
        onSubmit={() => {
                if (!selectedDocument || !saveAsTitle.trim()) return;
                if (!ALLOW_UNCATEGORISED_DOCS && saveAsFolderId == null) {
                  toast({ title: "Folder required", description: "Please choose a folder for the copy.", variant: "destructive" });
                  return;
                }
                const targetFolderName = saveAsFolderId
                  ? folders.find(f => f.id === saveAsFolderId)?.name || "selected folder"
                  : "Uncategorised";
                createDocMutation.mutate({
                  title: saveAsTitle.trim(),
                  type: selectedDocument.type || "document",
                  folderId: saveAsFolderId,
                  content: editContent || selectedDocument.content || "",
                  openAfterCreate: false,
                });
                setIsSaveAsOpen(false);
                toast({ title: "Copy saved", description: `"${saveAsTitle.trim()}" saved to ${targetFolderName}` });
              }}
              disabled={!saveAsTitle.trim() || (!ALLOW_UNCATEGORISED_DOCS && saveAsFolderId == null) || createDocMutation.isPending}
        saving={createDocMutation.isPending}
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Document Title</Label>
              <Input
                value={saveAsTitle}
                onChange={(e) => setSaveAsTitle(e.target.value)}
                placeholder="Enter new title"
                data-testid="input-save-as-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Save location</Label>
              <Select
                value={folderSelectValue(saveAsFolderId)}
                onValueChange={(val) => setSaveAsFolderId(parseFolderSelectValue(val))}
              >
                <SelectTrigger data-testid="select-save-as-folder">
                  <SelectValue placeholder="Choose save location" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {renderFolderSelectItems("save-as-folder")}
                </SelectContent>
              </Select>
            </div>
          </div>
      </FormDialogShell>

      <FormDialogShell
        open={isMoveToFolderOpen}
        onOpenChange={setIsMoveToFolderOpen}
        title="Move Document"
        subtitle={`Move "${selectedDocument?.title}" to a different location`}
        saveLabel={updateDocMutation.isPending ? "Moving..." : "Move"}
        saveTestId="button-confirm-move"
        onCancel={() => setIsMoveToFolderOpen(false)}
        onSubmit={() => {
                if (selectedDocument) {
                  updateDocMutation.mutate({
                    id: selectedDocument.id,
                    updates: { folderId: moveToFolderId },
                  });
                  setIsMoveToFolderOpen(false);
                }
              }}
              disabled={(!ALLOW_UNCATEGORISED_DOCS && moveToFolderId == null) || updateDocMutation.isPending}
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <FieldLabel>Destination</FieldLabel>
              <Select
                value={folderSelectValue(moveToFolderId)}
                onValueChange={(val) => setMoveToFolderId(parseFolderSelectValue(val))}
              >
                <SelectTrigger data-testid="select-move-to-folder">
                  <SelectValue placeholder="Choose location" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {renderFolderSelectItems("move-to-folder")}
                </SelectContent>
              </Select>
            </div>
          </div>
      </FormDialogShell>

      <FormDialogViewShell
        open={isSaveLocationOpen}
        onOpenChange={setIsSaveLocationOpen}
        onClose={() => setIsSaveLocationOpen(false)}
        title="Where would you like to save?"
        subtitle={`Choose a folder for "${selectedDocument?.title}", or leave it uncategorised.`}
        footer={(
          <div className="flex-col sm:flex-row gap-2 flex sm:justify-end">
            <Button variant="outline" onClick={() => setIsSaveLocationOpen(false)}>Cancel</Button>
            {ALLOW_UNCATEGORISED_DOCS && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (!selectedDocument) return;
                  const metadata = buildDocumentMetadataWithHeaderFooter(
                    (selectedDocument.metadata as Record<string, unknown>) || {},
                  );
                  updateDocMutation.mutate({
                    id: selectedDocument.id,
                    updates: {
                      content: editContentRef.current,
                      metadata: metadata as Document["metadata"],
                    },
                    silent: true,
                  });
                  setIsSaveLocationOpen(false);
                  toast({ title: "Saved", description: "Document saved as uncategorised." });
                }}
                disabled={updateDocMutation.isPending}
                data-testid="button-save-uncategorised"
              >
                Leave uncategorised
              </Button>
            )}
            <Button
              onClick={() => {
                if (!selectedDocument) return;
                if (!ALLOW_UNCATEGORISED_DOCS && saveLocationFolderId == null) {
                  toast({ title: "Folder required", description: "Please choose a folder.", variant: "destructive" });
                  return;
                }
                const metadata = buildDocumentMetadataWithHeaderFooter(
                  (selectedDocument.metadata as Record<string, unknown>) || {},
                );
                const updates: Partial<Document> = {
                  content: editContentRef.current,
                  metadata: metadata as Document["metadata"],
                };
                if (saveLocationTitle.trim()) {
                  updates.title = saveLocationTitle.trim();
                }
                if (saveLocationFolderId != null) {
                  updates.folderId = saveLocationFolderId;
                }
                updateDocMutation.mutate({
                  id: selectedDocument.id,
                  updates,
                  silent: true,
                });
                setIsSaveLocationOpen(false);
                const folderName = saveLocationFolderId
                  ? folders.find(f => f.id === saveLocationFolderId)?.name
                  : null;
                toast({
                  title: "Document saved",
                  description: folderName ? `Saved to ${folderName}` : "Saved as uncategorised.",
                });
              }}
              disabled={(!ALLOW_UNCATEGORISED_DOCS && saveLocationFolderId == null) || updateDocMutation.isPending}
              data-testid="button-confirm-save-to-folder"
            >
              {updateDocMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document title</Label>
              <Input
                value={saveLocationTitle}
                onChange={(e) => setSaveLocationTitle(e.target.value)}
                placeholder="Document title"
                data-testid="input-save-document-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Save location</Label>
              <Select
                value={folderSelectValue(saveLocationFolderId)}
                onValueChange={(val) => setSaveLocationFolderId(parseFolderSelectValue(val))}
              >
                <SelectTrigger data-testid="select-save-to-folder">
                  <SelectValue placeholder="Choose save location" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {renderFolderSelectItems("save-to-folder")}
                </SelectContent>
              </Select>
            </div>
          </div>
      </FormDialogViewShell>

      <FormDialogShell
        open={isMoveFolderOpen}
        onOpenChange={setIsMoveFolderOpen}
        title="Move Folder"
        subtitle={`Move "${movingFolder?.name}" to a different location`}
        saveLabel={moveFolderMutation.isPending ? "Moving..." : "Move"}
        saveTestId="button-confirm-move-folder"
        onCancel={() => setIsMoveFolderOpen(false)}
        onSubmit={() => {
          if (movingFolder) {
            moveFolderMutation.mutate({ id: movingFolder.id, parentId: moveFolderTargetId });
            setIsMoveFolderOpen(false);
            setMovingFolder(null);
          }
        }}
        disabled={moveFolderMutation.isPending}
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <FieldLabel>Destination</FieldLabel>
              <Select
                value={moveFolderTargetId === null ? "__root__" : String(moveFolderTargetId)}
                onValueChange={(val) => setMoveFolderTargetId(val === "__root__" ? null : Number(val))}
              >
                <SelectTrigger data-testid="select-move-folder-target">
                  <SelectValue placeholder="Choose destination" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__root__" data-testid="move-folder-root">
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      Root (Top Level)
                    </span>
                  </SelectItem>
                  {(() => {
                    const flatFolders: { id: number; name: string; depth: number }[] = [];
                    const flatten = (items: FolderTreeItem[], depth: number) => {
                      for (const item of items) {
                        if (movingFolder && (item.id === movingFolder.id || isDescendantOf(item.id, movingFolder.id))) continue;
                        flatFolders.push({ id: item.id, name: item.name, depth });
                        if (item.children && item.children.length > 0) flatten(item.children, depth + 1);
                      }
                    };
                    flatten(folderTree, 0);
                    return flatFolders.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)} data-testid={`move-folder-target-${f.id}`}>
                        <span className="flex items-center gap-1.5" style={{ paddingLeft: `${f.depth * 16}px` }}>
                          <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {f.name}
                        </span>
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
      </FormDialogShell>

      <FormDialogViewShell
        open={isImportOpen}
        onOpenChange={(open) => {
          setIsImportOpen(open);
          if (!open) resetImportDialog();
        }}
        onClose={() => {
          setIsImportOpen(false);
          resetImportDialog();
        }}
        title="Import Word Document"
        subtitle="Review the title and choose a destination folder. Word import supports headings, lists, tables, images, and header/footer text; complex styles and some embedded objects may not convert fully."
        size="md"
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!importTitle.trim() || !importContent) return;
                if (!ALLOW_UNCATEGORISED_DOCS && importFolderId == null) {
                  toast({ title: "Folder required", description: "Please choose a folder for the imported document.", variant: "destructive" });
                  return;
                }
                setIsImporting(true);
                try {
                  const replaceTarget = importConflictAction === "replace" ? importNameConflict : null;
                  let targetDocId: number;
                  let importedTitle = importTitle.trim();
                  let didReplace = false;

                  if (replaceTarget) {
                    targetDocId = replaceTarget.id;
                    importedTitle = replaceTarget.title;
                    didReplace = true;
                  } else {
                    if (findDocumentByTitleInFolder(allDocuments, importedTitle, importFolderId)) {
                      importedTitle = suggestUniqueDocumentTitle(importedTitle, importFolderId, allDocuments);
                    }
                  const createRes = await apiRequest("POST", "/api/documents", {
                      title: importedTitle,
                    type: "document",
                    folderId: importFolderId,
                    content: "",
                    status: "draft",
                  });
                  const newDoc = await createRes.json();
                    targetDocId = newDoc.id;
                  }

                  let contentRes: Response | null = null;
                  for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                      const contentBlob = new Blob([importContent], { type: "text/html" });
                      const formData = new FormData();
                      formData.append("content", contentBlob, "content.html");
                      contentRes = await fetchWithAuth(`/api/documents/${targetDocId}/content`, {
                        method: "POST",
                        body: formData,
                      });
                      if (contentRes.ok) break;
                    } catch {
                      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                    }
                  }
                  if (!contentRes || !contentRes.ok) throw new Error("Failed to save content");

                  const savedDoc = await contentRes.json();
                  let fullDoc = savedDoc;
                  if (importHeaderContent.trim() || importFooterContent.trim()) {
                    const metaRes = await apiRequest("PUT", `/api/documents/${targetDocId}`, {
                      metadata: {
                        ...(savedDoc.metadata || {}),
                        headerHtml: importHeaderContent.trim() || null,
                        footerHtml: importFooterContent.trim() || null,
                      },
                    });
                    fullDoc = await metaRes.json();
                  }
                  queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedFolderId] });
                  queryClient.invalidateQueries({ queryKey: ["/api/documents/all"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/documents/recent"] });
                  if (importFolderId !== null && importFolderId !== selectedFolderId) {
                    queryClient.invalidateQueries({ queryKey: ["/api/documents", importFolderId] });
                  }
                  lastAutoSavedContent.current = importContent;
                  setSelectedDocument(fullDoc);
                  setIsEditing(true);
                  setIsPreviewMode(false);
                  setEditContent(importContent);
                  const headerFromDoc = (fullDoc.metadata as Record<string, unknown> | undefined)?.headerHtml as string || importHeaderContent;
                  const footerFromDoc = (fullDoc.metadata as Record<string, unknown> | undefined)?.footerHtml as string || importFooterContent;
                  setEditHeaderContentState(headerFromDoc);
                  setEditFooterContentState(footerFromDoc);
                  editHeaderContentRef.current = headerFromDoc;
                  editFooterContentRef.current = footerFromDoc;
                  setActiveTab("content");
                  setSelectedFile(null);
                  toast({
                    title: didReplace ? "Document replaced" : "Document imported successfully",
                    description: didReplace
                      ? `"${importedTitle}" was updated with the imported content.`
                      : `"${importedTitle}" was added to your library.`,
                  });
                  setIsImportOpen(false);
                  resetImportDialog();
                } catch (err: any) {
                  toast({ title: "Import failed", description: err.message || "Failed to save document", variant: "destructive" });
                } finally {
                  setIsImporting(false);
                }
              }}
              disabled={!importTitle.trim() || !importContent || (!ALLOW_UNCATEGORISED_DOCS && importFolderId == null) || isImporting}
              data-testid="button-confirm-import"
              variant={importConflictAction === "replace" && importNameConflict ? "destructive" : "default"}
            >
              {isImporting
                ? (importConflictAction === "replace" && importNameConflict ? "Replacing..." : "Importing...")
                : (importConflictAction === "replace" && importNameConflict ? "Replace" : "Import")}
            </Button>
          </div>
        )}
      >
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Before you import</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Supported: headings, paragraphs, lists, basic tables, hyperlinks, header/footer text, most inline images</li>
              <li>May simplify: multi-column layouts, text boxes, TOC fields, custom Word styles</li>
              <li>Not imported: page-number fields, macros, EMF/WMF images</li>
              <li>Maximum file size: 25 MB</li>
            </ul>
          </div>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Document Title</Label>
              <Input
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                placeholder="Enter document title"
                disabled={importConflictAction === "replace" && !!importNameConflict}
                data-testid="input-import-title"
              />
              {importTitleDuplicate && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This title is already used in the selected folder. A numbered copy name will be used on import.
                </p>
              )}
            </div>
            {importNameConflict && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm space-y-3">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">Name already exists</p>
                    <p className="text-amber-800 dark:text-amber-200 text-xs mt-1">
                      A document named <span className="font-medium">&quot;{importNameConflict.title}&quot;</span> already exists in this folder.
                    </p>
                  </div>
                </div>
                <RadioGroup
                  value={importConflictAction}
                  onValueChange={(value) => handleImportConflictActionChange(value as DocumentImportConflictAction)}
                  className="space-y-2"
                  data-testid="import-name-conflict-options"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="keep_both" id="import-keep-both" className="mt-0.5" />
                    <Label htmlFor="import-keep-both" className="font-normal leading-snug cursor-pointer">
                      Import as a new copy
                      <span className="block text-xs text-muted-foreground">
                        Keeps the existing document and saves this file under a new name.
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="replace" id="import-replace" className="mt-0.5" />
                    <Label htmlFor="import-replace" className="font-normal leading-snug cursor-pointer">
                      Replace existing document
                      <span className="block text-xs text-muted-foreground">
                        Overwrites the content of &quot;{importNameConflict.title}&quot;. Previous content is kept in version history.
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            {(importHeaderContent || importFooterContent) && (
              <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3 text-xs space-y-1">
                <p className="font-medium text-green-800 dark:text-green-200">Header &amp; footer detected</p>
                {importHeaderContent && <p className="text-green-700 dark:text-green-300">Header text will be preserved.</p>}
                {importFooterContent && <p className="text-green-700 dark:text-green-300">Footer text will be preserved.</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label>Save location</Label>
              <Select
                value={folderSelectValue(importFolderId)}
                onValueChange={(val) => handleImportFolderChange(parseFolderSelectValue(val))}
              >
                <SelectTrigger data-testid="select-import-folder">
                  <SelectValue placeholder="Choose save location" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {renderFolderSelectItems("import-folder")}
                </SelectContent>
              </Select>
            </div>
            {importWarnings.length > 0 && (
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Conversion Notes</p>
                <ul className="list-disc pl-4 text-yellow-700 dark:text-yellow-300 space-y-0.5">
                  {importWarnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {importWarnings.length > 5 && (
                    <li>...and {importWarnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
      </FormDialogViewShell>

      <FormDialogViewShell
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        title={`Share "${shareDialogName}"`}
        subtitle="Share this item with others via link or email."
        size="md"
      >
          <div className="space-y-4 py-2">
            {/* Internal link */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Internal link (requires login)</p>
              <div className="flex items-center gap-2">
                <Input value={shareDialogUrl} readOnly className="flex-1 text-xs" data-testid="input-share-url" />
                <Button variant="outline" size="icon" onClick={copyShareLink} data-testid="button-copy-share-link">
                  {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Public link Ã¢â‚¬â€ only for documents */}
            {shareDialogDocId !== null && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    Public link (no login required)
                    {shareTokenLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  </p>
                  {publicToken ? (
                    <button onClick={revokePublicLink} className="text-[11px] text-destructive hover:underline" disabled={publicLinkLoading}>Revoke</button>
                  ) : null}
                </div>
                {publicToken ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${window.location.origin}/public/documents/${publicToken}`}
                      readOnly
                      className="flex-1 text-xs"
                      data-testid="input-public-url"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/public/documents/${publicToken}`);
                        toast({ title: "Public link copied" });
                      }}
                      data-testid="button-copy-public-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={generatePublicLink}
                    disabled={publicLinkLoading}
                    data-testid="button-generate-public-link"
                  >
                    <Globe className="h-4 w-4" />
                    {publicLinkLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                    ) : "Generate public link"}
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t pt-4">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={shareViaEmail} data-testid="button-share-email">
                <Mail className="h-4 w-4" />
                Share via Email
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => { window.open(shareDialogUrl, "_blank"); setShareDialogOpen(false); }}
                data-testid="button-open-in-new-tab"
              >
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          </div>
      </FormDialogViewShell>

      <FormDialogViewShell
        open={isTemplateManagerOpen}
        onOpenChange={setIsTemplateManagerOpen}
        onClose={() => setIsTemplateManagerOpen(false)}
        title="Template Manager"
        subtitle="Create, manage, and organize document templates by scope and department."
        size="xl"
      >
          <Tabs defaultValue="browse" className="mt-2">
            <TabsList>
              <TabsTrigger value="browse" data-testid="tab-browse-templates">Browse</TabsTrigger>
              <TabsTrigger value="create" data-testid="tab-create-template">Create New</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-4">
              {templatesLoading ? (
                <TabLoadingState label="Loading templates..." />
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookCopy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No templates yet</p>
                  <p className="text-sm mt-1">Create your first template to get started.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-4">
                    {templates.map((t) => (
                      <div 
                        key={t.id} 
                        className="flex items-center justify-between p-3 rounded-md border"
                        data-testid={`template-item-${t.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-primary/60 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{t.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px]">
                                {t.scope === "global" && <Globe className="h-3 w-3 mr-1" />}
                                {t.scope === "department" && <Building2 className="h-3 w-3 mr-1" />}
                                {t.scope === "module" && <Layers className="h-3 w-3 mr-1" />}
                                {t.scope}
                              </Badge>
                              {t.department && (
                                <Badge variant="secondary" className="text-[10px]">{t.department}</Badge>
                              )}
                              {t.category && (
                                <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                              )}
                            </div>
                            {t.description && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{t.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteTemplateMutation.mutate(t.id)}
                          data-testid={`button-delete-template-${t.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="create" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g. Project Charter"
                      data-testid="input-template-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <Select value={newTemplateScope} onValueChange={setNewTemplateScope}>
                      <SelectTrigger data-testid="select-template-scope">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="module">Module</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newTemplateDesc}
                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                    placeholder="Brief description of this template"
                    data-testid="input-template-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department (optional)</Label>
                    <Select value={newTemplateDepartment} onValueChange={setNewTemplateDepartment}>
                      <SelectTrigger data-testid="select-template-department">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Projects">Projects</SelectItem>
                        <SelectItem value="Testing">Testing</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Legal">Legal</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category (optional)</Label>
                    <Input
                      value={newTemplateCategory}
                      onChange={(e) => setNewTemplateCategory(e.target.value)}
                      placeholder="e.g. Charter, SOP, Policy"
                      data-testid="input-template-category"
                    />
                  </div>
                </div>
                {selectedDocument && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">
                      Content will be copied from: <span className="font-medium text-foreground">{selectedDocument.title}</span>
                    </p>
                  </div>
                )}
                <Button
                  className="w-full"
                  disabled={!newTemplateName.trim() || createTemplateMutation.isPending}
                  onClick={() => {
                    createTemplateMutation.mutate({
                      name: newTemplateName.trim(),
                      description: newTemplateDesc || null,
                      scope: newTemplateScope,
                      department: newTemplateDepartment === "all" ? null : newTemplateDepartment || null,
                      category: newTemplateCategory || null,
                      content: selectedDocument?.content || "<p></p>",
                      type: "document",
                    });
                  }}
                  data-testid="button-save-template"
                >
                  {createTemplateMutation.isPending ? "Saving..." : "Save Template"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
      </FormDialogViewShell>
    </>
  );
}

