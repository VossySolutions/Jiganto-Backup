import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmTestSuite } from "@shared/schema";
import { Plus, FolderOpen, Folder, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { useTmProject } from "@/contexts/TmProjectContext";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

interface SuiteFormData {
  name: string;
  description: string;
  parentId: number | null;
}

function SuiteRow({
  suite,
  suites,
  depth,
  onEdit,
  onDelete,
}: {
  suite: TmTestSuite;
  suites: TmTestSuite[];
  depth: number;
  onEdit: (s: TmTestSuite) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = suites.filter(s => s.parentId === suite.id);

  return (
    <>
      <div
        className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 group rounded-lg"
        style={{ paddingLeft: `${16 + depth * 20}px` }}
        data-testid={`suite-row-${suite.id}`}
      >
        <button
          className="text-muted-foreground"
          onClick={() => setExpanded(e => !e)}
          data-testid={`suite-expand-${suite.id}`}
        >
          {children.length > 0 ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : <span className="w-3.5 inline-block" />}
        </button>
        {children.length > 0 && expanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500/70 flex-shrink-0" />
        )}
        <span className="text-sm flex-1">{suite.name}</span>
        {suite.description && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px] hidden sm:block">{suite.description}</span>
        )}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40" onClick={() => onEdit(suite)} data-testid={`suite-edit-${suite.id}`}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => onDelete(suite.id)} data-testid={`suite-delete-${suite.id}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {expanded && children.map(child => (
        <SuiteRow key={child.id} suite={child} suites={suites} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

export function TestSuitesScreen() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TmTestSuite | null>(null);
  const [form, setForm] = useState<SuiteFormData>({ name: "", description: "", parentId: null });

  const { activeProjectId } = useTmProject();
  const {
    data: suites = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTmFetch<TmTestSuite[]>(["/api/tm/suites"], "/api/tm/suites");

  const createMutation = useMutation({
    mutationFn: (data: SuiteFormData) => apiRequest("POST", "/api/tm/suites", { ...data, projectId: activeProjectId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tm/suites"] }); setDialogOpen(false); toast({ title: "Suite created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SuiteFormData> }) => apiRequest("PATCH", `/api/tm/suites/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tm/suites"] }); setDialogOpen(false); toast({ title: "Suite updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tm/suites/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tm/suites"] }); toast({ title: "Suite deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", parentId: null });
    setDialogOpen(true);
  }

  function openEdit(suite: TmTestSuite) {
    setEditing(suite);
    setForm({ name: suite.name, description: suite.description ?? "", parentId: suite.parentId ?? null });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const rootSuites = suites.filter(s => !s.parentId);

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading test suites..."
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Test Suites</h2>
            <p className="text-sm text-muted-foreground">Organise your test cases into folders and suites</p>
          </div>
          <Button onClick={openCreate} data-testid="button-create-suite">
            <Plus className="h-4 w-4 mr-2" /> New Suite
          </Button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {suites.length === 0 ? (
            <div className="p-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No suites yet. Create your first test suite to organise your cases.</p>
            </div>
          ) : (
            <div className="py-2">
              {rootSuites.map(s => (
                <SuiteRow
                  key={s.id}
                  suite={s}
                  suites={suites}
                  depth={0}
                  onEdit={openEdit}
                  onDelete={id => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>

        <FormDialogShell
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={editing ? "Edit Suite" : "New Test Suite"}
          saveLabel={editing ? "Save Changes" : "Create Suite"}
          onCancel={() => setDialogOpen(false)}
          onSubmit={handleSubmit}
          saving={createMutation.isPending || updateMutation.isPending}
          disabled={!form.name.trim()}
          saveTestId="button-submit-suite"
        >
          <FormSection title="Suite details">
            <div className="space-y-1.5 mb-3.5">
              <FieldLabel required>Name</FieldLabel>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Functional Testing"
                data-testid="input-suite-name"
              />
            </div>
            <div className="space-y-1.5 mb-3.5">
              <FieldLabel>Description</FieldLabel>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={3}
                data-testid="input-suite-description"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Parent Suite (optional)</FieldLabel>
              <select
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.parentId ?? ""}
                onChange={e => setForm(f => ({ ...f, parentId: e.target.value ? Number(e.target.value) : null }))}
                data-testid="select-suite-parent"
              >
                <option value="">— No parent (root level) —</option>
                {suites.filter(s => s.id !== editing?.id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </FormSection>
        </FormDialogShell>
      </div>
    </TmScreenShell>
  );
}
