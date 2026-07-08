import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, Download, Library, CornerDownRight, FolderPlus } from "lucide-react";
import type { Skill, SkillCategory } from "@shared/models/resources";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: SkillCategory[];
  skills: Skill[];
};

const CATEGORY_COLORS = ["#4338CA", "#7C3AED", "#0D9488", "#DC2626", "#D97706", "#059669", "#DB2777", "#475569"];

export function SkillsLibraryDialog({ open, onOpenChange, categories, skills }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Category form state
  const [catForm, setCatForm] = useState<{ id?: number; name: string; color: string } | null>(null);
  // Skill form state
  const [skillForm, setSkillForm] = useState<{ id?: number; name: string; categoryId: string; parentSkillId: string; isCertification: boolean } | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/resources/skills"] });
    queryClient.invalidateQueries({ queryKey: ["/api/resources/skill-categories"] });
  };

  const saveCategory = useMutation({
    mutationFn: (data: { id?: number; name: string; color: string; order: number }) =>
      data.id
        ? apiRequest("PUT", `/api/resources/skill-categories/${data.id}`, { name: data.name, color: data.color })
        : apiRequest("POST", "/api/resources/skill-categories", { name: data.name, color: data.color, order: data.order }),
    onSuccess: () => { invalidate(); setCatForm(null); toast({ title: "Category saved" }); },
    onError: () => toast({ title: "Failed to save category", variant: "destructive" }),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/skill-categories/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Category deleted" }); },
  });

  const saveSkill = useMutation({
    mutationFn: (data: { id?: number; name: string; categoryId: number | null; parentSkillId: number | null; isCertification: boolean }) =>
      data.id
        ? apiRequest("PUT", `/api/resources/skills/${data.id}`, { name: data.name, categoryId: data.categoryId, parentSkillId: data.parentSkillId, isCertification: data.isCertification })
        : apiRequest("POST", "/api/resources/skills", { name: data.name, categoryId: data.categoryId, parentSkillId: data.parentSkillId, isCertification: data.isCertification }),
    onSuccess: () => { invalidate(); setSkillForm(null); toast({ title: "Skill saved" }); },
    onError: () => toast({ title: "Failed to save skill", variant: "destructive" }),
  });

  const deleteSkill = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/skills/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Skill removed" }); },
  });

  const skillsByCategory = useMemo(() => {
    const map = new Map<number | "none", Skill[]>();
    for (const s of skills) {
      const key = s.categoryId ?? "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [skills]);

  const childrenByParent = useMemo(() => {
    const map = new Map<number, Skill[]>();
    for (const s of skills) {
      if (s.parentSkillId != null) {
        if (!map.has(s.parentSkillId)) map.set(s.parentSkillId, []);
        map.get(s.parentSkillId)!.push(s);
      }
    }
    return map;
  }, [skills]);

  const exportCsv = () => {
    const catById = new Map(categories.map((c) => [c.id, c.name]));
    const skillById = new Map(skills.map((s) => [s.id, s.name]));
    const lines = ["Category,Skill,Parent Skill,Certification"];
    for (const s of skills) {
      const cat = s.categoryId != null ? catById.get(s.categoryId) ?? "" : "";
      const parent = s.parentSkillId != null ? skillById.get(s.parentSkillId) ?? "" : "";
      lines.push([cat, s.name, parent, s.isCertification ? "yes" : ""].map(csvCell).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "skills-library.csv";
    a.click();
  };

  const importCsv = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { toast({ title: "Empty or invalid CSV", variant: "destructive" }); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const ci = header.indexOf("category");
      const si = header.indexOf("skill");
      const pi = header.indexOf("parent skill");
      const certi = header.indexOf("certification");
      if (si === -1) { toast({ title: "CSV needs a 'Skill' column", variant: "destructive" }); return; }

      const catIdByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
      const skillIdByName = new Map(skills.map((s) => [s.name.toLowerCase(), s.id]));
      let created = 0;

      // First pass: categories + parent-less skills. Second pass: child skills.
      const pending: Array<{ name: string; categoryId: number | null; parent: string | null; isCert: boolean }> = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const skillName = (row[si] ?? "").trim();
        if (!skillName) continue;
        const catName = ci >= 0 ? (row[ci] ?? "").trim() : "";
        let categoryId: number | null = null;
        if (catName) {
          const key = catName.toLowerCase();
          if (!catIdByName.has(key)) {
            const res = await apiRequest("POST", "/api/resources/skill-categories", { name: catName, color: CATEGORY_COLORS[catIdByName.size % CATEGORY_COLORS.length], order: catIdByName.size });
            const cat = await res.json();
            catIdByName.set(key, cat.id);
          }
          categoryId = catIdByName.get(key)!;
        }
        const parent = pi >= 0 ? (row[pi] ?? "").trim() : "";
        const isCert = certi >= 0 ? /^(yes|true|1|y)$/i.test((row[certi] ?? "").trim()) : false;
        pending.push({ name: skillName, categoryId, parent: parent || null, isCert });
      }
      // Create parents first
      for (const p of pending.filter((x) => !x.parent)) {
        if (skillIdByName.has(p.name.toLowerCase())) continue;
        const res = await apiRequest("POST", "/api/resources/skills", { name: p.name, categoryId: p.categoryId, isCertification: p.isCert });
        const sk = await res.json();
        skillIdByName.set(p.name.toLowerCase(), sk.id);
        created++;
      }
      // Then children
      for (const p of pending.filter((x) => x.parent)) {
        if (skillIdByName.has(p.name.toLowerCase())) continue;
        const parentId = skillIdByName.get((p.parent ?? "").toLowerCase()) ?? null;
        const res = await apiRequest("POST", "/api/resources/skills", { name: p.name, categoryId: p.categoryId, parentSkillId: parentId, isCertification: p.isCert });
        const sk = await res.json();
        skillIdByName.set(p.name.toLowerCase(), sk.id);
        created++;
      }
      invalidate();
      toast({ title: `Imported ${created} skill${created === 1 ? "" : "s"}` });
    } catch {
      toast({ title: "Failed to import CSV", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [categories],
  );

  const parentOptions = (categoryId: string, excludeId?: number) =>
    skills.filter((s) => s.parentSkillId == null && String(s.categoryId ?? "") === categoryId && s.id !== excludeId);

  const renderSkillChip = (s: Skill, color: string, nested = false) => (
    <div key={s.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ background: nested ? "transparent" : `${color}14`, color, borderColor: `${color}55` }}>
      {nested && <CornerDownRight className="h-3 w-3 opacity-60" />}
      <span>{s.name}</span>
      {s.isCertification && <span title="Certification" className="opacity-70">🎓</span>}
      <button type="button" className="opacity-60 hover:opacity-100" title="Add module under this skill"
        onClick={() => setSkillForm({ name: "", categoryId: String(s.categoryId ?? ""), parentSkillId: String(s.id), isCertification: false })}>
        <Plus className="h-3 w-3" />
      </button>
      <button type="button" className="opacity-60 hover:opacity-100" title="Edit"
        onClick={() => setSkillForm({ id: s.id, name: s.name, categoryId: String(s.categoryId ?? ""), parentSkillId: String(s.parentSkillId ?? ""), isCertification: !!s.isCertification })}>
        <Pencil className="h-3 w-3" />
      </button>
      <button type="button" className="opacity-60 hover:opacity-100 hover:text-red-600" title="Delete"
        onClick={() => { if (confirm(`Delete skill "${s.name}"? This removes it from the matrix.`)) deleteSkill.mutate(s.id); }}>
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b">
            <DialogTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-primary" /> Skills Library</DialogTitle>
            <DialogDescription>
              {skills.length} skills across {categories.length} categories. Define your own categories, skills and nested modules (e.g. SAP → FICO, MM/SD).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {orderedCategories.length === 0 && (
              <p className="text-sm text-muted-foreground">No categories yet. Create your first category to start building the library.</p>
            )}
            {orderedCategories.map((cat) => {
              const color = cat.color || "#4338CA";
              const catSkills = (skillsByCategory.get(cat.id) ?? []).filter((s) => s.parentSkillId == null)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
              return (
                <div key={cat.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                      <span className="text-sm font-bold" style={{ color }}>{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" style={{ color }}
                        onClick={() => setSkillForm({ name: "", categoryId: String(cat.id), parentSkillId: "", isCertification: false })}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add skill
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit category"
                        onClick={() => setCatForm({ id: cat.id, name: cat.name, color })}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" title="Delete category"
                        onClick={() => { if (confirm(`Delete category "${cat.name}"? Its skills become uncategorised.`)) deleteCategory.mutate(cat.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catSkills.length === 0 && <span className="text-xs text-muted-foreground">No skills yet.</span>}
                    {catSkills.map((s) => {
                      const kids = childrenByParent.get(s.id) ?? [];
                      return (
                        <div key={s.id} className="flex flex-col gap-1">
                          {renderSkillChip(s, color)}
                          {kids.length > 0 && (
                            <div className="ml-4 flex flex-wrap gap-1.5">
                              {kids.sort((a, b) => a.name.localeCompare(b.name)).map((k) => renderSkillChip(k, color, true))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {(skillsByCategory.get("none")?.length ?? 0) > 0 && (
              <div>
                <div className="mb-2 text-sm font-bold text-muted-foreground">Uncategorised</div>
                <div className="flex flex-wrap gap-1.5">
                  {(skillsByCategory.get("none") ?? []).map((s) => renderSkillChip(s, "#64748B"))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
            <Button variant="outline" size="sm" onClick={() => setCatForm({ name: "", color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length] })}>
              <FolderPlus className="h-4 w-4 mr-1" /> Add category
            </Button>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
              <Button variant="outline" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> {importing ? "Importing…" : "Import CSV"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category add / edit */}
      <FormDialogShell
        open={!!catForm}
        onOpenChange={(v) => { if (!v) setCatForm(null); }}
        title={catForm?.id ? "Edit category" : "New category"}
        saveLabel={catForm?.id ? "Save" : "Create"}
        onCancel={() => setCatForm(null)}
        onSubmit={() => catForm && saveCategory.mutate({ id: catForm.id, name: catForm.name.trim(), color: catForm.color, order: categories.length })}
        saving={saveCategory.isPending}
        disabled={!catForm?.name.trim()}
      >
        <FormSection title="Category">
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Name</FieldLabel>
            <Input value={catForm?.name ?? ""} onChange={(e) => setCatForm((f) => f && { ...f, name: e.target.value })} placeholder="e.g. Languages, ERP Systems" autoFocus />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Colour</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setCatForm((f) => f && { ...f, color: c })}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: catForm?.color === c ? "#0F172A" : "transparent" }} />
              ))}
            </div>
          </div>
        </FormSection>
      </FormDialogShell>

      {/* Skill add / edit */}
      <FormDialogShell
        open={!!skillForm}
        onOpenChange={(v) => { if (!v) setSkillForm(null); }}
        title={skillForm?.id ? "Edit skill" : skillForm?.parentSkillId ? "Add module" : "New skill"}
        saveLabel={skillForm?.id ? "Save" : "Create"}
        onCancel={() => setSkillForm(null)}
        onSubmit={() => skillForm && saveSkill.mutate({
          id: skillForm.id,
          name: skillForm.name.trim(),
          categoryId: skillForm.categoryId ? Number(skillForm.categoryId) : null,
          parentSkillId: skillForm.parentSkillId ? Number(skillForm.parentSkillId) : null,
          isCertification: skillForm.isCertification,
        })}
        saving={saveSkill.isPending}
        disabled={!skillForm?.name.trim()}
      >
        <FormSection title="Skill details">
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Name</FieldLabel>
            <Input value={skillForm?.name ?? ""} onChange={(e) => setSkillForm((f) => f && { ...f, name: e.target.value })} placeholder="e.g. Japanese, SAP FICO" autoFocus />
          </div>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Category</FieldLabel>
            <Select value={skillForm?.categoryId || "none"} onValueChange={(v) => setSkillForm((f) => f && { ...f, categoryId: v === "none" ? "" : v, parentSkillId: "" })}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorised</SelectItem>
                {orderedCategories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Parent skill (for modules)</FieldLabel>
            <Select value={skillForm?.parentSkillId || "none"} onValueChange={(v) => setSkillForm((f) => f && { ...f, parentSkillId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="None — top-level skill" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — top-level skill</SelectItem>
                {parentOptions(skillForm?.categoryId ?? "", skillForm?.id).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={skillForm?.isCertification ?? false} onCheckedChange={(v) => setSkillForm((f) => f && { ...f, isCertification: !!v })} /> Certification skill
          </label>
        </FormSection>
      </FormDialogShell>
    </>
  );
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Minimal CSV parser supporting quoted fields and commas/newlines within quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}
