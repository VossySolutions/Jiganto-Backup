import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import { LayoutTemplate } from "lucide-react";

export function SaveAsPlatformTemplateDialog({
  open,
  onOpenChange,
  endpoint,
  defaultName,
  defaultDescription,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  endpoint: string;
  defaultName: string;
  defaultDescription?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription ?? "");

  const saveMut = useMutation({
    mutationFn: () => apiRequest("POST", endpoint, { name, description }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/templates") });
      toast({ title: "Saved as template ✓", description: "Available in the Templates module" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Failed to save template", description: e.message, variant: "destructive" }),
  });

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Save as template"
      subtitle="Registers this item in the platform Templates library"
      saveLabel="Save to Templates library"
      onCancel={() => onOpenChange(false)}
      onSubmit={() => saveMut.mutate()}
      saving={saveMut.isPending}
      disabled={!name.trim()}
      size="sm"
      testId="save-platform-template-dialog"
    >
      <FormSection icon={<LayoutTemplate className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Template details">
        <div className="space-y-1.5 mb-3.5">
          <FieldLabel required>Template name</FieldLabel>
          <Input value={name} onChange={e => setName(e.target.value)} data-testid="platform-template-name" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Description</FieldLabel>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What does this template include?" />
        </div>
      </FormSection>
    </FormDialogShell>
  );
}

export function SaveAsPlatformTemplateMenuItem({
  endpoint,
  defaultName,
  defaultDescription,
  label = "Save as Template",
}: {
  endpoint: string;
  defaultName: string;
  defaultDescription?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
        onClick={() => setOpen(true)}
        data-testid="menu-save-as-platform-template"
      >
        <LayoutTemplate className="h-4 w-4 mr-2" />
        {label}
      </button>
      <SaveAsPlatformTemplateDialog
        open={open}
        onOpenChange={setOpen}
        endpoint={endpoint}
        defaultName={defaultName}
        defaultDescription={defaultDescription}
      />
    </>
  );
}
