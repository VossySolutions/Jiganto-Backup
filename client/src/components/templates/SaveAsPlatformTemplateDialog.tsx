import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { LayoutTemplate, Loader2 } from "lucide-react";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="save-platform-template-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" /> Save as Template
          </DialogTitle>
          <DialogDescription>Registers this item in the platform Templates library.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="platform-template-name" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={!name.trim() || saveMut.isPending}
            onClick={() => saveMut.mutate()}
            data-testid="confirm-save-platform-template"
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save to Templates library"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
