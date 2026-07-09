import { useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { AGILE_PALETTE as C, priorityBg, priorityColor, statusBg, statusColor, tshirtBg, tshirtColor } from "./palette";
import type { Epic, Sprint, Story, Workstream } from "./types";
import { AddStoryForm } from "./story-form";
import { AgileAvatar, AgileBadge, AgileBtn, AgileModal, AgileProgressBar, AgileSelect, ConfirmDelete } from "./ui-primitives";

export function BacklogView({ stories, epics, onSelectStory, setStories, activeSprint, ws, onAddStory, onDeleteStory, onAssignToSprint }: {
  stories: Story[]; epics: Epic[]; onSelectStory: (s: Story) => void; sprints: Sprint[];
  setStories: React.Dispatch<React.SetStateAction<Story[]>>; activeSprint: Sprint | undefined; ws: Workstream;
  onAddStory?: (data: any) => void; onDeleteStory?: (id: string) => void | Promise<void>;
  onAssignToSprint?: (storyId: string, sprint: Sprint | null) => void | Promise<void>;
}) {
  const [epicFilter, setEpicFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("Backlog");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = stories.filter(s =>
    (epicFilter === "All" || s.epicId === epicFilter) &&
    (statusFilter === "All" || s.status === statusFilter || (!s.sprint && statusFilter === "Backlog"))
  );
  const backlogItems = filtered.filter(s => !s.sprint || s.status === "Backlog");
  const sprintItems = stories.filter(s => s.sprint === activeSprint?.name);

  function handleBacklogDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.source.droppableId !== "backlog-list" || result.destination.droppableId !== "sprint-drop") return;
    if (!activeSprint) return;

    const storyId = result.draggableId.replace(/^backlog-/, "");
    setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, sprint: activeSprint.name, status: "To Do" } : s));
    if (onAssignToSprint) onAssignToSprint(storyId, activeSprint);
  }
  function handleAddStory(data: any) {
    if (onAddStory) {
      onAddStory(data);
      setShowAdd(false);
    } else {
      const id = `US-${String(stories.length + 1).padStart(3, "0")}`;
      setStories(p => [...p, { id, wsId: ws.id, epicId: data.epicId, title: data.title, status: "Backlog", points: data.points ? Number(data.points) : null, tshirt: data.tshirt, priority: data.priority, assignee: data.assignee || null, creator: "Current User", createdAt: new Date().toISOString().slice(0, 10), sprint: null, tags: [], tasks: 0, tasksDone: 0, ac: [] }]);
      setShowAdd(false);
    }
  }
  function handleDelete(id: string) {
    if (onDeleteStory) onDeleteStory(id);
    else setStories(p => p.filter(s => s.id !== id));
    setDeleteId(null);
  }

  return (
    <DragDropContext onDragEnd={handleBacklogDragEnd}>
      <div className="agile-backlog-layout">
        <div className="agile-backlog-main">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.grey800 }}>Product Backlog</span>
            <AgileBadge label={`${backlogItems.length}`} color={C.blueLight} textColor={C.blue} />
            <div style={{ flex: 1 }} />
            <AgileSelect value={epicFilter} onChange={setEpicFilter} options={[{ value: "All", label: "All Epics" }, ...epics.map(e => ({ value: e.id, label: e.title.slice(0, 22) }))]} small testId="filter-backlog-epic" />
            <AgileSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "All", label: "All Statuses" }, { value: "Backlog", label: "Backlog" }, { value: "To Do", label: "To Do" }, { value: "In Progress", label: "In Progress" }]} small testId="filter-backlog-status" />
            <AgileBtn label="+ Add Story" variant="primary" onClick={() => setShowAdd(true)} testId="button-add-story" />
          </div>
          <Droppable droppableId="backlog-list">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {backlogItems.map((s, i) => {
                  const epic = epics.find(e => e.id === s.epicId);
                  return (
                    <Draggable key={s.id} draggableId={`backlog-${s.id}`} index={i}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          data-testid={`backlog-item-${s.id}`}
                          style={{
                            ...dragProvided.draggableProps.style,
                            background: C.white,
                            border: `1px solid ${dragSnapshot.isDragging ? C.blue : C.grey200}`,
                            borderLeft: `3px solid ${epic?.color || C.grey300}`,
                            borderRadius: 8,
                            padding: "9px 14px",
                            cursor: "grab",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            transition: "box-shadow 0.12s, border-color 0.12s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)")}
                          onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                        >
                          <span style={{ fontSize: 12, color: C.grey300, fontWeight: 600, minWidth: 22 }}>{i + 1}</span>
                          <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onSelectStory(s)}>
                            <div style={{ fontSize: 10, color: C.grey400 }}>{s.id} {"·"} {epic?.title}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.grey800, lineHeight: 1.3 }}>{s.title.length > 85 ? s.title.slice(0, 85) + "…" : s.title}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                            <AgileBadge label={s.priority} color={priorityBg(s.priority)} textColor={priorityColor(s.priority)} small />
                            <span style={{ background: tshirtBg(s.tshirt), color: tshirtColor(s.tshirt), borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{s.tshirt}</span>
                            {s.points && <span style={{ background: C.grey100, color: C.grey600, borderRadius: 4, padding: "1px 6px", fontSize: 10 }}>{s.points}pt</span>}
                            <AgileAvatar name={s.assignee} size={22} />
                            <AgileBtn label="✎" variant="ghost" small onClick={() => onSelectStory(s)} testId={`button-edit-${s.id}`} />
                            <AgileBtn label="✕" danger small onClick={() => setDeleteId(s.id)} testId={`button-delete-${s.id}`} />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
                {backlogItems.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.grey300, fontSize: 13 }}>No backlog items match filters</div>}
              </div>
            )}
          </Droppable>
        </div>

        <div className="agile-backlog-sidebar">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.grey800 }}>{activeSprint?.name || "No Active Sprint"}</span>
            {activeSprint && <AgileBadge label="Active" color={C.greenLight} textColor={C.green} dot small />}
          </div>
          <Droppable droppableId="sprint-drop">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{ minHeight: 180, background: snapshot.isDraggingOver ? "#EFF6FF" : C.grey50, border: `2px dashed ${snapshot.isDraggingOver ? C.blue : C.grey300}`, borderRadius: 10, padding: 12, transition: "all 0.15s", marginBottom: 12 }}
              >
                <div style={{ textAlign: "center", fontSize: 11, color: snapshot.isDraggingOver ? C.blue : C.grey300, fontWeight: 600, marginBottom: 10 }}>{snapshot.isDraggingOver ? "Drop to add →" : "⬅ Drag stories here"}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {sprintItems.map(s => (
                    <div key={s.id} style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: C.grey700 }}>{s.title.slice(0, 55)}{s.title.length > 55 ? "…" : ""}</div>
                      <div style={{ display: "flex", gap: 5, marginTop: 4, alignItems: "center" }}>
                        <AgileBadge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small />
                        {s.points && <span style={{ fontSize: 9, color: C.grey400 }}>{s.points}pt</span>}
                        <AgileAvatar name={s.assignee} size={16} />
                      </div>
                    </div>
                  ))}
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          <div style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.grey700, marginBottom: 10 }}>Sprint Capacity</div>
            {([["Story Points", sprintItems.reduce((a, s) => a + (s.points || 0), 0), activeSprint?.points || 34],
              ["Stories", sprintItems.length, 10]] as [string, number, number][]).map(([label, val, cap]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.grey500, marginBottom: 3 }}>
                  <span>{label}</span><span style={{ fontWeight: 700 }}>{val} / {cap}</span>
                </div>
                <AgileProgressBar pct={(val / cap) * 100} color={val > cap ? C.red : C.teal} height={6} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAdd && (
        <AgileModal title="Add User Story" onClose={() => setShowAdd(false)}>
          <AddStoryForm epics={epics} onSave={handleAddStory} onCancel={() => setShowAdd(false)} />
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={stories.find(s => s.id === deleteId)?.id || ""} onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />}
    </DragDropContext>
  );
}
