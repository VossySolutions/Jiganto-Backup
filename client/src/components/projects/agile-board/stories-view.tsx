import { useState, type Dispatch, type SetStateAction } from "react";
import { AGILE_PALETTE as C, priorityBg, priorityColor, statusBg, statusColor } from "./palette";
import type { Epic, Story, Workstream } from "./types";
import { AddStoryForm } from "./story-form";
import { AgileAvatar, AgileBadge, AgileBtn, AgileModal, AgileSelect, ConfirmDelete, inputStyle } from "./ui-primitives";

export function StoriesView({ stories, epics, onSelect, setStories, ws, onAddStory, onDeleteStory }: {
  stories: Story[]; epics: Epic[]; onSelect: (s: Story) => void;
  setStories: Dispatch<SetStateAction<Story[]>>; ws: Workstream;
  onAddStory?: (data: any) => void; onDeleteStory?: (id: string) => void | Promise<void>;
}) {
  const [epicFilter, setEpicFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = stories.filter(s =>
    (epicFilter === "All" || s.epicId === epicFilter) &&
    (statusFilter === "All" || s.status === statusFilter) &&
    (search === "" || s.title.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase())),
  );

  function handleAdd(data: any) {
    if (onAddStory) {
      onAddStory(data);
      setShowAdd(false);
    } else {
      const id = `US-${String(stories.length + 1).padStart(3, "0")}`;
      setStories(p => [...p, {
        id,
        wsId: ws.id,
        epicId: data.epicId,
        title: data.title,
        status: "Backlog",
        points: data.points ? Number(data.points) : null,
        tshirt: data.tshirt,
        priority: data.priority,
        assignee: data.assignee || null,
        creator: "Current User",
        createdAt: new Date().toISOString().slice(0, 10),
        sprint: null,
        tags: [],
        tasks: 0,
        tasksDone: 0,
        ac: [],
      }]);
      setShowAdd(false);
    }
  }

  function handleDelete(id: string) {
    if (onDeleteStory) onDeleteStory(id);
    else setStories(p => p.filter(s => s.id !== id));
    setDeleteId(null);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: C.grey800 }}>User Stories</span>
        <AgileBadge label={`${filtered.length}`} color={C.blueLight} textColor={C.blue} />
        <div style={{ flex: 1 }} />
        <input style={{ ...inputStyle, width: 180, padding: "5px 10px" }} placeholder="Search..." data-testid="input-search-stories" value={search} onChange={e => setSearch(e.target.value)} />
        <AgileSelect value={epicFilter} onChange={setEpicFilter} options={[{ value: "All", label: "All Epics" }, ...epics.map(e => ({ value: e.id, label: `${e.id} ${e.title.slice(0, 18)}` }))]} small testId="filter-story-epic" />
        <AgileSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "All", label: "All Statuses" }, { value: "Backlog", label: "Backlog" }, { value: "To Do", label: "To Do" }, { value: "In Progress", label: "In Progress" }, { value: "Done", label: "Done" }]} small testId="filter-story-status" />
        <AgileBtn label="+ New Story" variant="primary" onClick={() => setShowAdd(true)} testId="button-add-story-list" />
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 60px 90px 90px 44px 60px", padding: "8px 14px", background: C.grey50, borderBottom: `1px solid ${C.grey200}`, fontSize: 10, fontWeight: 700, color: C.grey500, gap: 10 }}>
          <span>Story</span><span>Epic</span><span>Status</span><span>Pts</span><span>Priority</span><span>Sprint</span><span>Owner</span><span>Actions</span>
        </div>
        {filtered.map((s, i) => {
          const epic = epics.find(e => e.id === s.epicId);
          return (
            <div key={s.id} data-testid={`story-row-${s.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 60px 90px 90px 44px 60px", padding: "9px 14px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.grey100}` : "none", alignItems: "center", gap: 10, transition: "background 0.1s" }}
              onMouseEnter={e => (e.currentTarget.style.background = C.grey50)}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <div style={{ cursor: "pointer" }} onClick={() => onSelect(s)}>
                <div style={{ fontSize: 10, color: C.grey400 }}>{s.id}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.grey800 }}>{s.title.length > 65 ? `${s.title.slice(0, 65)}...` : s.title}</div>
              </div>
              <div style={{ fontSize: 11, color: epic?.color || C.grey500, fontWeight: 600 }}>{epic?.title?.split(" ").slice(0, 2).join(" ")}</div>
              <AgileBadge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small />
              <span style={{ fontWeight: 700, fontSize: 12, color: C.grey700 }}>{s.points || <span style={{ color: C.grey300 }}>{"—"}</span>}</span>
              <AgileBadge label={s.priority} color={priorityBg(s.priority)} textColor={priorityColor(s.priority)} small />
              <span style={{ fontSize: 11, color: C.grey500 }}>{s.sprint || <span style={{ color: C.grey300 }}>{"—"}</span>}</span>
              <AgileAvatar name={s.assignee} size={22} />
              <div style={{ display: "flex", gap: 3 }}>
                <AgileBtn label="✎" variant="ghost" small onClick={() => onSelect(s)} testId={`button-edit-${s.id}`} />
                <AgileBtn label="✕" danger small onClick={() => setDeleteId(s.id)} testId={`button-delete-${s.id}`} />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.grey300, fontSize: 13 }}>No stories found</div>}
      </div>

      {showAdd && (
        <AgileModal title="Add User Story" onClose={() => setShowAdd(false)}>
          <AddStoryForm epics={epics} onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={stories.find(s => s.id === deleteId)?.id || ""} onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
