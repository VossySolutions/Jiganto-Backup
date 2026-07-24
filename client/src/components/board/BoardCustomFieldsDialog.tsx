import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import {
  boardCustomFieldsQueryKey,
  useBoardCustomFields,
} from "@/hooks/use-board-custom-fields";
import { parseFieldOptions } from "@/lib/crm-custom-fields";
import { BoardAddColumnDialog } from "@/components/board/BoardAddColumnDialog";

type BoardCustomFieldsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityLabel?: string;
};

/** Rename / remove the custom columns of a board (max 20 per entity). */
export function BoardCustomFieldsDialog({
  open,
  onOpenChange,
  entityType,
  entityLabel,
}: BoardCustomFieldsDialogProps) {
  const { fields } = useBoardCustomFields(entityType);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setLabels({});
      setAddOpen(false);
      return;
    }
    setLabels((prev) => {
      const next = { ...prev };
      for (const field of fields) {
        if (next[field.id] == null) next[field.id] = field.fieldLabel;
      }
      return next;
    });
  }, [open, fields]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: boardCustomFieldsQueryKey(entityType) });

  const renameMutation = useMutation({
    mutationFn: async (input: { id: number; fieldLabel: string }) =>
      apiRequest("PUT", `/api/crm/custom-fields/${input.id}`, { fieldLabel: input.fieldLabel }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/crm/custom-fields/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Column removed" });
    },
  });

  return (
    <>
      <FormDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="Manage custom fields"
        subtitle={`Custom columns on the ${entityLabel || entityType} table · ${fields.length}/20 used`}
        saveLabel="Save names"
        onCancel={() => onOpenChange(false)}
        onSubmit={async () => {
          const changed = fields.filter(
            (f) => labels[f.id] != null && labels[f.id].trim() && labels[f.id] !== f.fieldLabel,
          );
          try {
            for (const field of changed) {
              await renameMutation.mutateAsync({ id: field.id, fieldLabel: labels[field.id].trim() });
            }
            if (changed.length) toast({ title: "Custom fields updated" });
            onOpenChange(false);
          } catch {
            toast({ title: "Failed to save custom fields", variant: "destructive" });
          }
        }}
        saving={renameMutation.isPending}
        size="sm"
        saveTestId="button-save-custom-fields"
      >
        <div className="space-y-2" data-testid="board-custom-fields-list">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No custom columns yet. Add one to extend this table without a schema change.
            </p>
          )}
          {fields.map((field) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input
                value={labels[field.id] ?? field.fieldLabel}
                onChange={(e) => setLabels((prev) => ({ ...prev, [field.id]: e.target.value }))}
                data-testid={`input-custom-field-${field.fieldName}`}
              />
              <span className="w-28 shrink-0 text-xs text-muted-foreground capitalize">
                {field.fieldType}
                {parseFieldOptions(field.options).length && field.fieldType === "dropdown"
                  ? ` · ${parseFieldOptions(field.options).length}`
                  : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                title="Delete column"
                onClick={() => deleteMutation.mutate(field.id)}
                data-testid={`button-delete-custom-field-${field.fieldName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-primary hover:text-primary"
            onClick={() => setAddOpen(true)}
            data-testid="button-manage-add-custom-field"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add column
          </Button>
        </div>
      </FormDialogShell>

      <BoardAddColumnDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        entityType={entityType}
        entityLabel={entityLabel}
        existingCount={fields.length}
      />
    </>
  );
}
