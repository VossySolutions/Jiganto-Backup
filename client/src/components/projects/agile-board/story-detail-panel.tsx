import { useState } from "react";
import { AGILE_PALETTE as C, priorityBg, priorityColor, statusBg, statusColor, tshirtBg, tshirtColor } from "./palette";
import type { Epic, Sprint, Story } from "./types";
import { AgileBadge, AgileBtn, AgileModal, AgileProgressBar, FormField, inputStyle } from "./ui-primitives";

export function StoryDetailPanel({ story, epics, sprints, onClose, onUpdate }: {
  story: Story; epics: Epic[]; sprints?: Sprint[];
  onClose: () => void;
  onUpdate?: (id: string, data: Record<string, unknown>) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const epic = epics.find(e => e.id === story.epicId);

  if (editing && onUpdate) {
    return (
      <AgileModal title={`Edit ${story.id}`} onClose={() => setEditing(false)} wide>
        <StoryEditForm
          story={story}
          epics={epics}
          sprints={sprints || []}
          onSave={async (data) => { await onUpdate(story.id, data); setEditing(false); onClose(); }}
          onCancel={() => setEditing(false)}
        />
      </AgileModal>
    );
  }

  return (
    <AgileModal title={`${story.id} - Story Detail`} onClose={onClose} wide>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        {onUpdate && <AgileBtn label="Edit" variant="primary" small onClick={() => setEditing(true)} testId="button-edit-story-detail" />}
      </div>
      <div className="agile-modal-body">
        <div className="agile-modal-main">
          <div style={{ fontSize: 16, fontWeight: 700, color: C.grey800, marginBottom: 12, lineHeight: 1.4 }}>{story.title}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            <AgileBadge label={story.status} color={statusBg(story.status)} textColor={statusColor(story.status)} dot />
            <AgileBadge label={story.priority} color={priorityBg(story.priority)} textColor={priorityColor(story.priority)} />
            <span style={{ background: tshirtBg(story.tshirt), color: tshirtColor(story.tshirt), borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{story.tshirt}</span>
            {story.points && <AgileBadge label={`${story.points} pts`} color={C.blueLight} textColor={C.blue} />}
          </div>
          {story.ac.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.grey700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Acceptance Criteria</div>
              {story.ac.map((ac, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                  <span style={{ color: C.green, marginTop: 2 }}>{"✓"}</span>
                  <span style={{ fontSize: 12.5, color: C.grey600, lineHeight: 1.5 }}>{ac}</span>
                </div>
              ))}
            </div>
          )}
          {story.tasks > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.grey700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Tasks</div>
              <AgileProgressBar pct={(story.tasksDone / story.tasks) * 100} color={C.blue} height={8} />
              <div style={{ fontSize: 11, color: C.grey400, marginTop: 4 }}>{story.tasksDone}/{story.tasks} tasks completed</div>
            </div>
          )}
        </div>
        <div className="agile-modal-side">
          <div style={{ background: C.grey50, borderRadius: 8, padding: 14 }}>
            {([["Epic", epic?.title || "—", epic?.color], ["Sprint", story.sprint || "Unassigned", C.grey500], ["Assignee", story.assignee || "Unassigned", C.grey500], ["Creator", story.creator, C.grey500], ["Created", story.createdAt, C.grey500]] as [string, string, string | undefined][]).map(([l, v, c]) => (
              <div key={l} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.grey400, textTransform: "uppercase", marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: c || C.grey700 }}>{v}</div>
              </div>
            ))}
            {story.tags.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.grey400, textTransform: "uppercase", marginBottom: 3 }}>Tags</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {story.tags.map(t => <AgileBadge key={t} label={t} color={C.grey100} textColor={C.grey600} small />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AgileModal>
  );
}

export function StoryEditForm({ story, epics, sprints, onSave, onCancel }: {
  story: Story; epics: Epic[]; sprints: Sprint[];
  onSave: (data: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: story.title,
    epicId: story.epicId,
    priority: story.priority,
    tshirt: story.tshirt,
    points: story.points != null ? String(story.points) : "",
    assignee: story.assignee || "",
    status: story.status,
    sprintId: sprints.find(s => s.name === story.sprint)?.id || "",
    ac: story.ac.join("\n"),
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <FormField label="Story Title" required>
        <input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} />
      </FormField>
      <FormField label="Epic">
        <select style={inputStyle} value={form.epicId} onChange={e => set("epicId", e.target.value)}>
          {epics.map(e => <option key={e.id} value={e.id}>{e.id} — {e.title}</option>)}
        </select>
      </FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <FormField label="Status">
          <select style={inputStyle} value={form.status} onChange={e => set("status", e.target.value)}>
            {["Backlog", "To Do", "In Progress", "In Review", "Done"].map(s => <option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select style={inputStyle} value={form.priority} onChange={e => set("priority", e.target.value)}>
            {["Critical", "High", "Medium", "Low"].map(p => <option key={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="T-Shirt">
          <select style={inputStyle} value={form.tshirt} onChange={e => set("tshirt", e.target.value)}>
            {["XS", "S", "M", "L", "XL", "XXL"].map(t => <option key={t}>{t}</option>)}
          </select>
        </FormField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FormField label="Story Points">
          <input style={inputStyle} type="number" value={form.points} onChange={e => set("points", e.target.value)} />
        </FormField>
        <FormField label="Sprint">
          <select style={inputStyle} value={form.sprintId} onChange={e => set("sprintId", e.target.value)}>
            <option value="">Unassigned</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Assignee">
        <input style={inputStyle} value={form.assignee} onChange={e => set("assignee", e.target.value)} />
      </FormField>
      <FormField label="Acceptance Criteria (one per line)">
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.ac} onChange={e => set("ac", e.target.value)} />
      </FormField>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} />
        <AgileBtn label="Save Changes" variant="primary" onClick={() => {
          const sprint = sprints.find(s => s.id === form.sprintId);
          onSave({
            title: form.title,
            epicId: form.epicId ? Number(form.epicId) : null,
            priority: form.priority,
            tshirt: form.tshirt,
            points: form.points ? Number(form.points) : null,
            assignee: form.assignee || null,
            status: form.status,
            sprintId: sprint && /^\d+$/.test(sprint.id) ? Number(sprint.id) : null,
            sprintName: sprint?.name ?? null,
            acceptanceCriteria: form.ac.split("\n").map(l => l.trim()).filter(Boolean),
          });
        }} />
      </div>
    </div>
  );
}
