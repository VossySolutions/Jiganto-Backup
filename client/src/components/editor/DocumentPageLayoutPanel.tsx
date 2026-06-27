import { ArrowLeft, LayoutTemplate, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentHeaderFooterEditor } from "@/components/DocumentHeaderFooterEditor";
import { Badge } from "@/components/ui/badge";

/** Properties-tab editor for per-document page header & footer (Confluence-style chrome). */
export function DocumentPageLayoutPanel({
  headerContent,
  footerContent,
  onHeaderChange,
  onFooterChange,
  editable,
  onStartEdit,
  onBackToDocument,
  headerInherited,
  footerInherited,
  headerSourceFolderName,
  footerSourceFolderName,
  onUseFolderDefaults,
}: {
  headerContent: string;
  footerContent: string;
  onHeaderChange: (html: string) => void;
  onFooterChange: (html: string) => void;
  editable: boolean;
  onStartEdit?: () => void;
  onBackToDocument?: () => void;
  headerInherited?: boolean;
  footerInherited?: boolean;
  headerSourceFolderName?: string;
  footerSourceFolderName?: string;
  onUseFolderDefaults?: () => void;
}) {
  const showInherited = headerInherited || footerInherited;

  return (
    <div className="space-y-5 w-full" data-testid="document-page-layout-panel">
      {onBackToDocument && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={onBackToDocument}
          data-testid="button-back-to-document-content"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to document
        </Button>
      )}
      <div className="rounded-lg border border-border/60 bg-muted/15 p-4 w-full min-w-0">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <LayoutTemplate className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Page header &amp; footer</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Shown at the top and bottom of this document when viewing and exporting — like Confluence page chrome, scoped to this document.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This is separate from <strong className="font-medium text-foreground">On this page</strong> headings inside the document body.
            </p>
            {showInherited && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {headerInherited && headerSourceFolderName && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    Header from “{headerSourceFolderName}”
                  </Badge>
                )}
                {footerInherited && footerSourceFolderName && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    Footer from “{footerSourceFolderName}”
                  </Badge>
                )}
                {onUseFolderDefaults && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={onUseFolderDefaults}
                    data-testid="button-use-folder-page-layout"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to folder default
                  </Button>
                )}
              </div>
            )}
            {!editable && onStartEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-8"
                onClick={onStartEdit}
                data-testid="button-start-edit-page-layout"
              >
                Edit document to change
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 w-full min-w-0">
        <DocumentHeaderFooterEditor
          kind="header"
          variant="panel"
          content={headerContent}
          onChange={onHeaderChange}
          editable={editable}
        />
        <DocumentHeaderFooterEditor
          kind="footer"
          variant="panel"
          content={footerContent}
          onChange={onFooterChange}
          editable={editable}
        />
      </div>
    </div>
  );
}
