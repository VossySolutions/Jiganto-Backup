import { useState, type Dispatch, type SetStateAction } from "react";
import { AGILE_PALETTE as C, priorityBg, priorityColor, statusBg, statusColor } from "./palette";
import type { Defect, Story, Workstream } from "./types";
import { AgileAvatar, AgileBadge, AgileBtn, AgileModal, AgileSelect, ConfirmDelete, FormField, inputStyle } from "./ui-primitives";

export function DefectsView({ defects, stories, setDefects, ws, onAddDefect, onUpdateDefect, onDeleteDefect }: {
  defects: Defect[]; stories: Story[];
  setDefects: Dispatch<SetStateAction<Defect[]>>; ws: Workstream;
  onAddDefect?: (data: any) => void; onUpdateDefect?: (id: string, data: any) => void | Promise<void>;
  onDeleteDefect?: (id: string) => void | Promise<void>;
}) {
  const [sevFilter, setSevFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editDefect, setEditDefect] = useState<Defect | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = defects.filter(d =>
    (sevFilter === "All" || d.severity === sevFilter) &&
    (statusFilter === "All" || d.status === statusFilter),
  );

  const sevColor = (s: string) => ({ Critical: C.red, Major: C.amber, Minor: C.blue, Trivial: C.grey400 } as Record<string, string>)[s] || C.grey400;
  const sevBg = (s: string) => ({ Critical: C.redLight, Major: C.amberLight, Minor: C.blueLight, Trivial: C.grey100 } as Record<string, string>)[s] || C.grey100;
  const envColor = (e: string) => ({ Dev: C.blue, SIT: C.purple, UAT: C.amber, Prod: C.red } as Record<string, string>)[e] || C.grey500;

  function handleAdd(data: any) {
    if (onAddDefect) {
      onAddDefect(data);
      setShowAdd(false);
    } else {
      const id = `DEF-${String(defects.length + 1).padStart(3, "0")}`;
      setDefects(p => [...p, { id, wsId: ws.id, storyId: data.storyId, title: data.title, severity: data.severity, priority: data.priority, status: "New", assignee: data.assignee || null, creator: "Current User", createdAt: new Date().toISOString().slice(0, 10), environment: data.environment, sprint: null }]);
      setShowAdd(false);
    }
  }

  function handleDelete(id: string) {
    if (onDeleteDefect) onDeleteDefect(id);
    else setDefects(p => p.filter(d => d.id !== id));
    setDeleteId(null);
  }

  function handleSaveDefect(data: any) {
    if (editDefect) {
      if (onUpdateDefect) {
        onUpdateDefect(editDefect.id, {
          title: data.title,
          storyId: data.storyId ? Number(data.storyId) : null,
          severity: data.severity,
          priority: data.priority,
          environment: data.environment,
          assignee: data.assignee || null,
          status: data.status || editDefect.status,
        });
      } else {
        setDefects(p => p.map(d => (d.id === editDefect.id ? { ...d, ...data } : d)));
      }
      setEditDefect(null);
    } else {
      handleAdd(data);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: C.grey800 }}>Defects</span>
        <AgileBadge label={`${filtered.length}`} color={C.redLight} textColor={C.red} />
        <div style={{ flex: 1 }} />
        <AgileSelect value={sevFilter} onChange={setSevFilter} options={[{ value: "All", label: "All Severities" }, { value: "Critical", label: "Critical" }, { value: "Major", label: "Major" }, { value: "Minor", label: "Minor" }]} small testId="filter-defect-severity" />
        <AgileSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "All", label: "All Statuses" }, { value: "New", label: "New" }, { value: "In Progress", label: "In Progress" }, { value: "Fixed", label: "Fixed" }, { value: "Verified", label: "Verified" }]} small testId="filter-defect-status" />
        <AgileBtn label="+ Raise Defect" variant="primary" onClick={() => setShowAdd(true)} testId="button-add-defect" />
      </div>

      <div className="agile-stat-grid" style={{ marginBottom: 16 }}>
        {([["Total", defects.length, C.grey700, C.grey100], ["Critical", defects.filter(d => d.severity === "Critical").length, C.red, C.redLight], ["Major", defects.filter(d => d.severity === "Major").length, C.amber, C.amberLight], ["Open", defects.filter(d => !["Fixed", "Verified", "Closed"].includes(d.status)).length, C.blue, C.blueLight]] as [string, number, string, string][]).map(([l, v, c, bg]) => (
          <div key={l} style={{ background: bg, borderRadius: 8, padding: "12px 0", textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 22, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: C.grey500 }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="agile-h-scroll">
        <div className="agile-defect-table" style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 90px 80px 110px 60px 50px 70px", padding: "8px 14px", background: C.grey50, borderBottom: `1px solid ${C.grey200}`, fontSize: 10, fontWeight: 700, color: C.grey500, gap: 10 }}>
            <span>Defect</span><span>Story</span><span>Severity</span><span>Priority</span><span>Status</span><span>Env</span><span>Owner</span><span>Actions</span>
          </div>
          {filtered.map((d, i) => (
            <div key={d.id} data-testid={`defect-row-${d.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 100px 90px 80px 110px 60px 50px 70px", padding: "10px 14px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.grey100}` : "none", alignItems: "center", gap: 10 }}
              onMouseEnter={e => (e.currentTarget.style.background = C.grey50)}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <div>
                <div style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>{d.id}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.grey800 }}>{d.title}</div>
              </div>
              <span style={{ fontSize: 11, color: C.grey500 }}>{d.storyId || "—"}</span>
              <AgileBadge label={d.severity} color={sevBg(d.severity)} textColor={sevColor(d.severity)} small dot />
              <AgileBadge label={d.priority} color={priorityBg(d.priority)} textColor={priorityColor(d.priority)} small />
              <AgileBadge label={d.status} color={statusBg(d.status)} textColor={statusColor(d.status)} dot small />
              <span style={{ fontSize: 11, fontWeight: 700, color: envColor(d.environment) }}>{d.environment}</span>
              <AgileAvatar name={d.assignee} size={22} />
              <div style={{ display: "flex", gap: 3 }}>
                <AgileBtn label="✎" variant="ghost" small onClick={() => setEditDefect(d)} testId={`button-edit-${d.id}`} />
                <AgileBtn label="✕" danger small onClick={() => setDeleteId(d.id)} testId={`button-delete-${d.id}`} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.grey300, fontSize: 13 }}>No defects found</div>}
        </div>
      </div>

      {(showAdd || editDefect) && (
        <AgileModal title={editDefect ? "Edit Defect" : "Raise Defect"} onClose={() => { setShowAdd(false); setEditDefect(null); }}>
          <DefectForm stories={stories} initial={editDefect || undefined} onSave={handleSaveDefect} onCancel={() => { setShowAdd(false); setEditDefect(null); }} />
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={defects.find(d => d.id === deleteId)?.id || ""} onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}

export function DefectForm({ stories, initial, onSave, onCancel }: { stories: Story[]; initial?: Defect; onSave: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    storyId: initial?.storyId || "",
    severity: initial?.severity || "Major",
    priority: initial?.priority || "High",
    environment: initial?.environment || "Dev",
    assignee: initial?.assignee || "",
    status: initial?.status || "New",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div>
      <FormField label="Defect Title" required><input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="Briefly describe the defect" data-testid="input-defect-title" /></FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FormField label="Linked Story">
          <select style={inputStyle} value={form.storyId} onChange={e => set("storyId", e.target.value)}>
            <option value="">{"—"} None {"—"}</option>
            {stories.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
          </select>
        </FormField>
        <FormField label="Environment">
          <select style={inputStyle} value={form.environment} onChange={e => set("environment", e.target.value)}>
            {["Dev", "SIT", "UAT", "Prod"].map(e => <option key={e}>{e}</option>)}
          </select>
        </FormField>
        <FormField label="Severity">
          <select style={inputStyle} value={form.severity} onChange={e => set("severity", e.target.value)}>
            {["Critical", "Major", "Minor", "Trivial"].map(s => <option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select style={inputStyle} value={form.priority} onChange={e => set("priority", e.target.value)}>
            {["Critical", "High", "Medium", "Low"].map(p => <option key={p}>{p}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Assignee"><input style={inputStyle} value={form.assignee} onChange={e => set("assignee", e.target.value)} placeholder="Name" /></FormField>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-defect" /><AgileBtn label="Raise Defect" variant="primary" onClick={() => form.title && onSave(form)} testId="button-save-defect" />
      </div>
    </div>
  );
}
