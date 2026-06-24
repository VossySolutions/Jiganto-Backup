import { useState, type Dispatch, type SetStateAction } from "react";
import { computeBurnUp } from "@/lib/pm-agile-mappers";
import { AGILE_PALETTE as C, priorityBg, priorityColor, statusBg, statusColor, tshirtBg, tshirtColor } from "./palette";
import type { Epic, Story, Workstream } from "./types";
import { AgileAvatar, AgileBadge, AgileBtn, AgileModal, AgileProgressBar, AgileSelect, BurnUpChart, ConfirmDelete, FormField, inputStyle, textareaStyle } from "./ui-primitives";

export function EpicsView({ epics, stories, onSelect, setEpics, ws, onAddEpic, onUpdateEpic, onDeleteEpic }: {
  epics: Epic[]; stories: Story[]; onSelect: (e: Epic) => void;
  setEpics: Dispatch<SetStateAction<Epic[]>>; ws: Workstream;
  onAddEpic?: (data: any) => void; onUpdateEpic?: (id: string, data: any) => void | Promise<void>;
  onDeleteEpic?: (id: string) => void | Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editEpic, setEditEpic] = useState<Epic | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = epics.filter(e =>
    (statusFilter === "All" || e.status === statusFilter) &&
    (search === "" || e.title.toLowerCase().includes(search.toLowerCase())),
  );

  function handleSave(data: any) {
    if (editEpic) {
      if (onUpdateEpic) {
        onUpdateEpic(editEpic.id, {
          title: data.title,
          initiative: data.initiative,
          description: data.description,
          status: data.status?.toLowerCase(),
          priority: data.priority?.toLowerCase(),
          tshirt: data.tshirt,
          owner: data.owner,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
        });
      } else {
        setEpics(p => p.map(e => (e.id === editEpic.id ? { ...e, ...data } : e)));
      }
    } else if (onAddEpic) {
      onAddEpic(data);
    } else {
      const id = `EP-${String(epics.length + 1).padStart(3, "0")}`;
      setEpics(p => [...p, {
        id,
        wsId: ws.id,
        color: ws.color,
        stories: 0,
        storiesDone: 0,
        progress: 0,
        tags: [],
        description: data.description || "",
        creator: data.creator || "Current User",
        createdAt: new Date().toISOString().slice(0, 10),
        ...data,
      }]);
    }
    setShowAdd(false);
    setEditEpic(null);
  }

  function handleDelete(id: string) {
    if (onDeleteEpic) onDeleteEpic(id);
    else setEpics(p => p.filter(e => e.id !== id));
    setDeleteId(null);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: C.grey800 }}>Epics</span>
        <AgileBadge label={`${filtered.length}`} color={C.blueLight} textColor={C.blue} />
        <div style={{ flex: 1 }} />
        <input style={{ ...inputStyle, width: 200, padding: "5px 10px" }} placeholder="Search epics..." data-testid="input-search-epics" value={search} onChange={e => setSearch(e.target.value)} />
        <AgileSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "All", label: "All Statuses" }, { value: "Active", label: "Active" }, { value: "Planning", label: "Planning" }, { value: "Done", label: "Done" }]} small testId="filter-epic-status" />
        <AgileBtn label="+ New Epic" variant="primary" onClick={() => setShowAdd(true)} testId="button-add-epic" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 16 }}>
        {filtered.map(epic => {
          const epicStories = stories.filter(s => s.epicId === epic.id);
          const done = epicStories.filter(s => s.status === "Done").length;
          const buData = computeBurnUp(stories as Parameters<typeof computeBurnUp>[0], epic.id);
          const progressPct = epicStories.length ? Math.round((done / epicStories.length) * 100) : epic.progress;
          return (
            <div key={epic.id} data-testid={`epic-card-${epic.id}`} style={{ background: C.white, border: `1.5px solid ${C.grey200}`, borderTop: `4px solid ${epic.color}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onSelect(epic)}>
                    <div style={{ fontSize: 11, color: C.grey400 }}>{epic.id} {"·"} {epic.initiative}</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.grey800 }}>{epic.title}</div>
                  </div>
                  <AgileBadge label={epic.status} color={statusBg(epic.status)} textColor={statusColor(epic.status)} dot small />
                  <div style={{ display: "flex", gap: 4 }}>
                    <AgileBtn label="✎" variant="ghost" small onClick={() => setEditEpic(epic)} testId={`button-edit-${epic.id}`} />
                    <AgileBtn label="✕" danger small onClick={() => setDeleteId(epic.id)} testId={`button-delete-${epic.id}`} />
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: C.grey500, marginBottom: 10, lineHeight: 1.5 }}>{epic.description}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <AgileBadge label={epic.priority} color={priorityBg(epic.priority)} textColor={priorityColor(epic.priority)} small />
                  <span style={{ background: tshirtBg(epic.tshirt), color: tshirtColor(epic.tshirt), borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{epic.tshirt}</span>
                  {epic.tags.map(t => <AgileBadge key={t} label={t} color={C.grey100} textColor={C.grey600} small />)}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.grey400, marginBottom: 3 }}>
                    <span>Progress</span><span>{done}/{epicStories.length} stories {"·"} {progressPct}%</span>
                  </div>
                  <AgileProgressBar pct={progressPct} color={epic.color} height={6} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <AgileAvatar name={epic.owner} size={22} />
                  <span style={{ fontSize: 11, color: C.grey500 }}>{epic.owner}</span>
                </div>
              </div>
              {buData && (
                <div style={{ borderTop: `1px solid ${C.grey100}`, padding: "10px 12px", background: C.grey50 }}>
                  <BurnUpChart data={buData} title="Burn-up (Stories Completed vs Scope)" color={epic.color} width={330} height={150} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(showAdd || editEpic) && (
        <AgileModal title={editEpic ? "Edit Epic" : "New Epic"} onClose={() => { setShowAdd(false); setEditEpic(null); }}>
          <EpicForm initial={editEpic || {}} onSave={handleSave} onCancel={() => { setShowAdd(false); setEditEpic(null); }} />
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={epics.find(e => e.id === deleteId)?.title || ""} onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}

export function EpicForm({ initial = {}, onSave, onCancel }: { initial?: any; onSave: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: "", initiative: "", owner: "", status: "Planning", tshirt: "L", priority: "High", description: "", startDate: "", endDate: "", ...initial });
  const set = (k: string, v: string) => setForm((p: Record<string, string>) => ({ ...p, [k]: v }));
  return (
    <div>
      <FormField label="Epic Title" required><input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Customer Order Management" data-testid="input-epic-title" /></FormField>
      <FormField label="Initiative"><input style={inputStyle} value={form.initiative} onChange={e => set("initiative", e.target.value)} placeholder="e.g. ERP Phase 1" /></FormField>
      <FormField label="Description"><textarea style={textareaStyle as any} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe what this epic delivers..." /></FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FormField label="Start Date"><input style={inputStyle} type="date" value={form.startDate || ""} onChange={e => set("startDate", e.target.value)} /></FormField>
        <FormField label="End Date"><input style={inputStyle} type="date" value={form.endDate || ""} onChange={e => set("endDate", e.target.value)} /></FormField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
        <FormField label="Status"><select style={inputStyle} value={form.status} onChange={e => set("status", e.target.value)}>{["Planning", "Active", "Done", "Cancelled"].map(s => <option key={s}>{s}</option>)}</select></FormField>
        <FormField label="T-Shirt"><select style={inputStyle} value={form.tshirt} onChange={e => set("tshirt", e.target.value)}>{["XS", "S", "M", "L", "XL", "XXL"].map(t => <option key={t}>{t}</option>)}</select></FormField>
        <FormField label="Priority"><select style={inputStyle} value={form.priority} onChange={e => set("priority", e.target.value)}>{["Critical", "High", "Medium", "Low"].map(p => <option key={p}>{p}</option>)}</select></FormField>
        <FormField label="Owner"><input style={inputStyle} value={form.owner} onChange={e => set("owner", e.target.value)} placeholder="Name" /></FormField>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-epic" /><AgileBtn label="Save Epic" variant="primary" onClick={() => form.title && onSave(form)} testId="button-save-epic" />
      </div>
    </div>
  );
}
