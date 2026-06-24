import { useState } from "react";
import type { Epic } from "./types";
import { AgileBtn, FormField, inputStyle } from "./ui-primitives";

export function AddStoryForm({ epics, onSave, onCancel, initial = {} }: { epics: Epic[]; onSave: (d: any) => void; onCancel: () => void; initial?: any }) {
  const [form, setForm] = useState({ title: "", epicId: epics[0]?.id || "", priority: "Medium", tshirt: "M", points: "", assignee: "", ...initial });
  const set = (k: string, v: string) => setForm((p: Record<string, string>) => ({ ...p, [k]: v }));
  return (
    <div>
      <FormField label="Story Title" required><input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="As a [role], I want [goal] so that [benefit]" data-testid="input-story-title" /></FormField>
      <FormField label="Epic" required>
        <select style={inputStyle} value={form.epicId} onChange={e => set("epicId", e.target.value)}>
          {epics.map(e => <option key={e.id} value={e.id}>{e.id} {"–"} {e.title}</option>)}
        </select>
      </FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <FormField label="Priority">
          <select style={inputStyle} value={form.priority} onChange={e => set("priority", e.target.value)}>
            {["Critical", "High", "Medium", "Low"].map(p => <option key={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="T-Shirt Size">
          <select style={inputStyle} value={form.tshirt} onChange={e => set("tshirt", e.target.value)}>
            {["XS", "S", "M", "L", "XL", "XXL"].map(t => <option key={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Story Points">
          <input style={inputStyle} type="number" min={1} value={form.points} onChange={e => set("points", e.target.value)} placeholder="e.g. 5" />
        </FormField>
      </div>
      <FormField label="Assignee"><input style={inputStyle} value={form.assignee} onChange={e => set("assignee", e.target.value)} placeholder="Name" /></FormField>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-story" />
        <AgileBtn label="Save Story" variant="primary" onClick={() => form.title && form.epicId && onSave(form)} testId="button-save-story" />
      </div>
    </div>
  );
}
