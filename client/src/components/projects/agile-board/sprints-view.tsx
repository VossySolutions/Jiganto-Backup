import { useState, type Dispatch, type SetStateAction } from "react";
import { useAgilePalette, statusBg, statusColor } from "./palette";
import type { BurndownPoint, Sprint, Story, Workstream } from "./types";
import { AgileBadge, AgileBtn, AgileModal, AgileProgressBar, BurndownChart, ConfirmDelete, FormField, inputStyle } from "./ui-primitives";

export function SprintsView({ sprints, stories, setSprints, ws, onAddSprint, burndownData, onActivateSprint, onDeleteSprint }: {
  sprints: Sprint[]; stories: Story[];
  setSprints: Dispatch<SetStateAction<Sprint[]>>; ws: Workstream;
  onAddSprint?: (data: any) => void; burndownData?: BurndownPoint[];
  onActivateSprint?: (id: string, allIds: string[]) => void | Promise<void>;
  onDeleteSprint?: (id: string) => void | Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleAdd(data: any) {
  const C = useAgilePalette();
    if (onAddSprint) {
      onAddSprint(data);
      setShowAdd(false);
    } else {
      const id = `SP-${String(sprints.length + 1).padStart(3, "0")}`;
      setSprints(p => [...p, { id, wsId: ws.id, name: data.name, status: "Planned", start: data.start, end: data.end, points: Number(data.points) || 0, done: 0, goal: data.goal }]);
      setShowAdd(false);
    }
  }

  function handleActivate(id: string) {
    if (onActivateSprint) {
      onActivateSprint(id, sprints.map(s => s.id));
    } else {
      setSprints(p => p.map(s => ({ ...s, status: s.id === id ? "Active" : (s.status === "Active" ? "Planned" : s.status) })));
    }
  }

  function handleDelete(id: string) {
    if (onDeleteSprint) onDeleteSprint(id);
    else setSprints(p => p.filter(s => s.id !== id));
    setDeleteId(null);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: C.grey800 }}>Sprint Management</span>
        <AgileBadge label={`${sprints.length}`} color={C.blueLight} textColor={C.blue} />
        <div style={{ flex: 1 }} />
        <AgileBtn label="+ New Sprint" variant="primary" onClick={() => setShowAdd(true)} testId="button-add-sprint" />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {sprints.map(sp => {
          const spStories = stories.filter(s => s.sprint === sp.name);
          const pct = sp.points ? (sp.done / sp.points) * 100 : 0;
          return (
            <div key={sp.id} data-testid={`sprint-card-${sp.id}`} style={{ flex: "1 1 220px", background: C.white, border: `1.5px solid ${statusColor(sp.status, C)}33`, borderTop: `4px solid ${statusColor(sp.status, C)}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.grey800 }}>{sp.name}</span>
                <AgileBadge label={sp.status} color={statusBg(sp.status, C)} textColor={statusColor(sp.status, C)} dot small />
              </div>
              {sp.goal && <div style={{ fontSize: 12, color: C.grey500, marginBottom: 8, fontStyle: "italic" }}>{sp.goal}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.grey400 }}>Dates</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.grey700 }}>{sp.start} - {sp.end}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.grey400 }}>Points</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: statusColor(sp.status, C) }}>{sp.done}/{sp.points}</div>
                </div>
              </div>
              <AgileProgressBar pct={pct} color={statusColor(sp.status, C)} height={6} />
              <div style={{ fontSize: 10, color: C.grey400, marginTop: 6 }}>{spStories.length} stories assigned</div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {sp.status !== "Active" && sp.status !== "Closed" && (
                  <AgileBtn label="Activate" variant="primary" small onClick={() => handleActivate(sp.id)} testId={`button-activate-${sp.id}`} />
                )}
                {sp.status !== "Closed" && (
                  <AgileBtn label="Delete" danger small onClick={() => setDeleteId(sp.id)} testId={`button-delete-sprint-${sp.id}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {burndownData && burndownData.length > 1 && (
        <BurndownChart data={burndownData} title={`${sprints.find(s => s.status === "Active")?.name || "Sprint"} — Burndown Chart`} width={600} height={220} />
      )}

      {showAdd && (
        <AgileModal title="New Sprint" onClose={() => setShowAdd(false)}>
          <SprintForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={sprints.find(s => s.id === deleteId)?.name || ""} onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}

export function SprintForm({ onSave, onCancel }: { onSave: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", start: "", end: "", points: "", goal: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div>
      <FormField label="Sprint Name" required><input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Sprint 5" data-testid="input-sprint-name" /></FormField>
      <FormField label="Sprint Goal"><input style={inputStyle} value={form.goal} onChange={e => set("goal", e.target.value)} placeholder="What will this sprint deliver?" /></FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <FormField label="Start Date"><input style={inputStyle} value={form.start} onChange={e => set("start", e.target.value)} placeholder="e.g. 17 Feb 2026" /></FormField>
        <FormField label="End Date"><input style={inputStyle} value={form.end} onChange={e => set("end", e.target.value)} placeholder="e.g. 02 Mar 2026" /></FormField>
        <FormField label="Capacity (Points)"><input style={inputStyle} type="number" value={form.points} onChange={e => set("points", e.target.value)} placeholder="e.g. 30" /></FormField>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-sprint" /><AgileBtn label="Create Sprint" variant="primary" onClick={() => form.name && onSave(form)} testId="button-save-sprint" />
      </div>
    </div>
  );
}
