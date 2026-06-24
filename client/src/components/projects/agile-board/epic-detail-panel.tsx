import { AGILE_PALETTE as C, priorityBg, priorityColor, statusBg, statusColor, tshirtBg, tshirtColor } from "./palette";
import type { Epic, Story } from "./types";
import { AgileBadge, AgileBtn, AgileProgressBar } from "./ui-primitives";

export function EpicDetailPanel({ epic, stories, onClose, onEdit }: { epic: Epic; stories: Story[]; onClose: () => void; onEdit: () => void }) {
  const epicStories = stories.filter(s => s.epicId === epic.id);
  const done = epicStories.filter(s => s.status === "Done").length;
  const inProgress = epicStories.filter(s => s.status === "In Progress").length;
  const totalPts = epicStories.reduce((s, st) => s + (st.points || 0), 0);
  const donePts = epicStories.filter(s => s.status === "Done").reduce((s, st) => s + (st.points || 0), 0);

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, background: C.white, borderLeft: `1px solid ${C.grey200}`, boxShadow: "-4px 0 20px rgba(0,0,0,0.08)", zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden" }} data-testid="epic-detail-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderBottom: `1px solid ${C.grey100}`, flexShrink: 0 }}>
        <div style={{ width: 4, height: 24, borderRadius: 2, background: epic.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: C.grey400, fontWeight: 600 }}>{epic.id}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.grey800, flex: 1 }}>{epic.title}</span>
        <AgileBtn label="Edit" variant="ghost" small onClick={onEdit} testId="button-edit-epic-panel" />
        <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: C.grey400, padding: 4 }} data-testid="button-close-epic-panel">{"✕"}</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          <AgileBadge label={epic.status} color={statusBg(epic.status)} textColor={statusColor(epic.status)} dot />
          <AgileBadge label={epic.priority} color={priorityBg(epic.priority)} textColor={priorityColor(epic.priority)} />
          <span style={{ background: tshirtBg(epic.tshirt), color: tshirtColor(epic.tshirt), borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{epic.tshirt}</span>
        </div>

        <div style={{ fontSize: 13, color: C.grey600, lineHeight: 1.6, marginBottom: 20 }}>{epic.description}</div>

        <div style={{ background: C.grey50, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.grey400, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Details</div>
          {([
            ["Initiative", epic.initiative],
            ["Owner", epic.owner],
            ["Creator", epic.creator],
            ["Created", epic.createdAt],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: C.grey400, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 12, color: C.grey700, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.grey400, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Progress</div>
          <AgileProgressBar pct={epic.progress} color={epic.color} height={8} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.grey400, marginTop: 6 }}>
            <span>{epic.progress}% complete</span>
            <span>{done}/{epicStories.length} stories done</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {([
            ["Total Points", String(totalPts), C.blue],
            ["Done Points", String(donePts), C.green],
            ["In Progress", String(inProgress), C.amber],
          ] as [string, string, string][]).map(([l, v, c]) => (
            <div key={l} style={{ background: C.grey50, borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: C.grey400, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {epic.tags.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.grey400, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Tags</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {epic.tags.map(t => <AgileBadge key={t} label={t} color={C.grey100} textColor={C.grey600} />)}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.grey400, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Stories ({epicStories.length})</div>
          {epicStories.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.grey100}`, marginBottom: 6, background: C.white }}>
              <AgileBadge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small />
              <span style={{ fontSize: 11, color: C.grey400, fontWeight: 600, flexShrink: 0 }}>{s.id}</span>
              <span style={{ fontSize: 12, color: C.grey700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
              {s.points && <span style={{ fontSize: 10, fontWeight: 700, color: C.blue, background: C.blueLight, borderRadius: 4, padding: "1px 5px" }}>{s.points}</span>}
            </div>
          ))}
          {epicStories.length === 0 && <div style={{ fontSize: 12, color: C.grey400, fontStyle: "italic" }}>No stories linked to this epic yet.</div>}
        </div>
      </div>
    </div>
  );
}
