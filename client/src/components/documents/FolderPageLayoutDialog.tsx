import { LayoutTemplate } from "lucide-react";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { DocumentHeaderFooterEditor } from "@/components/DocumentHeaderFooterEditor";
import type { DocumentFolder } from "@shared/schema";
import { parseFolderPageLayoutDefaults } from "@shared/document-page-layout";

export function FolderPageLayoutDialog({
  folder,
  open,
  onOpenChange,
  headerContent,
  footerContent,
  onHeaderChange,
  onFooterChange,
  onSave,
  saving,
}: {
  folder: DocumentFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headerContent: string;
  footerContent: string;
  onHeaderChange: (html: string) => void;
  onFooterChange: (html: string) => void;
  onSave: () => void;
  saving?: boolean;
}) {
  if (!folder) return null;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Folder page layout"
      subtitle={`Default header & footer for new pages in “${folder.name}”. Child folders can override. Existing pages keep their own layout unless reset.`}
      saveLabel={saving ? "Saving..." : "Save defaults"}
      saveTestId="button-save-folder-page-layout"
      size="lg"
      onCancel={() => onOpenChange(false)}
      onSubmit={onSave}
      saving={saving}
    >
      <div className="py-4 space-y-5">
        <div className="rounded-lg border border-border/60 bg-muted/15 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <LayoutTemplate className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Like Confluence space defaults — applied to <strong className="font-medium text-foreground">new documents</strong> in this folder.
                Documents without their own header/footer inherit these when opened.
              </p>
            </div>
          </div>
        </div>
        <DocumentHeaderFooterEditor
          kind="header"
          variant="panel"
          content={headerContent}
          onChange={onHeaderChange}
          editable
        />
        <DocumentHeaderFooterEditor
          kind="footer"
          variant="panel"
          content={footerContent}
          onChange={onFooterChange}
          editable
        />
      </div>
    </FormDialogShell>
  );
}

export function readFolderPageLayoutFromFolder(folder: DocumentFolder | null | undefined) {
  const defaults = parseFolderPageLayoutDefaults(folder?.metadata);
  return {
    header: (defaults.defaultHeaderHtml || "").trim(),
    footer: (defaults.defaultFooterHtml || "").trim(),
  };
}
