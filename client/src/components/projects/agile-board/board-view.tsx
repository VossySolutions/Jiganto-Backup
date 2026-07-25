import { useState } from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { AppKanbanBoard, type KanbanColumnDef } from "@/components/kanban";
import { AGILE_BOARD_COLUMNS, useAgilePalette, priorityBg, priorityColor, statusColor, tshirtBg, tshirtColor } from "./palette";
import type { BurndownPoint, Epic, Sprint, Story } from "./types";
import { AgileAvatar, AgileBadge, AgileBtn, AgileProgressBar, AgileSelect, BurndownChart } from "./ui-primitives";

export function BoardView({ stories, epics, activeSprint, onSelectStory, burndownData, onCompleteSprint, boardMode = "sprint", onStoryStatusChange }: {
  stories: Story[]; epics: Epic[];
  activeSprint: Sprint | undefined; onSelectStory: (s: Story) => void;
  burndownData?: BurndownPoint[]; onCompleteSprint?: () => void;
  boardMode?: "sprint" | "scrum" | "kanban";
  onStoryStatusChange: (storyId: string, status: string) => void | Promise<void>;
}) {
  const C = useAgilePalette();
  const isKanban = boardMode === "kanban";
  const boardTitle = isKanban ? "Kanban Board" : boardMode === "scrum" ? "Scrum Board" : (activeSprint?.name || "Sprint Board");
  const [showChart, setShowChart] = useState(true);
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const sprintStories = stories.filter((s) => s.sprint === activeSprint?.name);
  const committed = activeSprint?.points || 0;
  const completed = activeSprint?.done || 0;
  const remaining = committed - completed;
  const pctDone = committed > 0 ? Math.round((completed / committed) * 100) : 0;

  const assignees = Array.from(new Set(sprintStories.filter(s => s.assignee).map(s => s.assignee!)));

  const filtered = stories.filter(s => {
    if (assigneeFilter !== "All" && s.assignee !== assigneeFilter) return false;
    if (priorityFilter !== "All" && s.priority !== priorityFilter) return false;
    return true;
  });
  const boardStories = filtered.filter((s) =>
    isKanban ? s.status !== "Backlog" : s.sprint === activeSprint?.name,
  );
  const boardColumns: KanbanColumnDef[] = AGILE_BOARD_COLUMNS.map((col) => {
    const count = boardStories.filter((story) => story.status === col).length;
    return {
      id: col,
      title: col,
      header: (
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.grey200}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.grey50, borderRadius: "10px 10px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(col, C) }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.grey700 }}>{col}</span>
          </div>
          <span style={{ background: C.grey200, borderRadius: 10, padding: "0 6px", fontSize: 10, fontWeight: 700, color: C.grey500 }}>{count}</span>
        </div>
      ),
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }} data-testid={isKanban ? "kanban-board-view" : "sprint-board-view"}>
      {!isKanban && (
        <div style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, margin: "12px 16px 0", padding: "12px 18px", flexShrink: 0 }} className="agile-sprint-info-bar" data-testid="sprint-info-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.grey800 }}>{boardTitle}</span>
                {activeSprint?.status === "Active" && <AgileBadge label="Active" color={C.greenLight} textColor={C.green} dot small />}
              </div>
              {activeSprint && (
                <span style={{ fontSize: 11, color: C.grey400 }}>{activeSprint.start} → {activeSprint.end}</span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginLeft: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: C.grey800 }}>{committed} pts</span>
              <span style={{ fontSize: 10, color: C.grey400, textTransform: "uppercase" }}>Committed</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: C.blue }}>{completed} pts</span>
              <span style={{ fontSize: 10, color: C.grey400, textTransform: "uppercase" }}>Completed</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: C.amber }}>{remaining} pts</span>
              <span style={{ fontSize: 10, color: C.grey400, textTransform: "uppercase" }}>Remaining</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 4 }}>
              <span style={{ fontSize: 11, color: C.grey500, whiteSpace: "nowrap" }}>Sprint {pctDone}% done</span>
              <div style={{ width: 80, height: 8, borderRadius: 4, background: C.grey200, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pctDone}%`, background: C.blue, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <AgileSelect value={assigneeFilter} onChange={setAssigneeFilter} options={[{ value: "All", label: "All Assignees" }, ...assignees.map(a => ({ value: a, label: a }))]} small testId="filter-board-assignee" />
            <AgileSelect value={priorityFilter} onChange={setPriorityFilter} options={[{ value: "All", label: "All Priorities" }, { value: "Critical", label: "Critical" }, { value: "High", label: "High" }, { value: "Medium", label: "Medium" }, { value: "Low", label: "Low" }]} small testId="filter-board-priority" />
            <AgileBtn label={showChart ? "Hide Chart" : "Show Chart"} onClick={() => setShowChart(!showChart)} testId="button-toggle-chart" />
            {activeSprint?.status === "Active" && <AgileBtn label="Complete Sprint" variant="primary" onClick={onCompleteSprint} testId="button-complete-sprint" />}
          </div>
        </div>
      )}

      {isKanban && (
        <div style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, margin: "12px 16px 0", padding: "10px 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.grey800 }}>Kanban Board</span>
            <span style={{ fontSize: 12, color: C.grey500 }}>Continuous flow — all active stories</span>
            <div style={{ flex: 1 }} />
            <AgileSelect value={assigneeFilter} onChange={setAssigneeFilter} options={[{ value: "All", label: "All Assignees" }, ...assignees.map(a => ({ value: a, label: a }))]} small testId="filter-board-assignee" />
            <AgileSelect value={priorityFilter} onChange={setPriorityFilter} options={[{ value: "All", label: "All Priorities" }, { value: "Critical", label: "Critical" }, { value: "High", label: "High" }, { value: "Medium", label: "Medium" }, { value: "Low", label: "Low" }]} small testId="filter-board-priority" />
          </div>
        </div>
      )}

      {!isKanban && showChart && burndownData && burndownData.length > 1 && (
        <div style={{ margin: "12px 16px 0" }}>
          <BurndownChart data={burndownData} title={`Sprint Burndown — ${activeSprint?.name || "Sprint"}`} height={220} sprint={activeSprint} />
        </div>
      )}

      <div style={{ padding: "12px 16px", flex: 1, overflowY: "auto" }}>
        <AppKanbanBoard
          columns={boardColumns}
          items={boardStories}
          getItemId={(s) => s.id}
          getColumnId={(s) => s.status}
          setColumnIdOnItem={(s, col) => ({ ...s, status: col })}
          onMove={(move) => onStoryStatusChange(move.itemId, move.toColumnId)}
          idPrefix="story-"
          testIdPrefix="agile-board"
          className="agile-kanban-scroll"
          columnWidthClass="w-full min-w-[200px] md:w-[280px]"
          columnBodyClass="max-h-[min(70vh,560px)] min-h-[240px] overflow-y-auto bg-white dark:bg-card border border-t-0 rounded-b-xl p-2"
          renderCard={(story, { dragHandleProps, isDragging, isSaving }) => (
            <BoardCard
              story={story}
              epics={epics}
              onClick={() => onSelectStory(story)}
              dragHandleProps={dragHandleProps}
              isDragging={isDragging}
              isSaving={isSaving}
            />
          )}
        />
      </div>
    </div>
  );
}

function BoardCard({
  story,
  epics,
  onClick,
  dragHandleProps,
  isDragging,
  isSaving,
}: {
  story: Story;
  epics: Epic[];
  onClick: () => void;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  isDragging: boolean;
  isSaving: boolean;
}) {
  const C = useAgilePalette();
  const epic = epics.find(e => e.id === story.epicId);
  return (
    <div onClick={onClick} data-testid={`board-card-${story.id}`}
      style={{
        background: C.white,
        border: `1.5px solid ${isDragging ? C.blue : C.grey200}`,
        borderLeft: `3.5px solid ${epic?.color || C.grey300}`,
        borderRadius: 8,
        padding: "9px 11px",
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s, opacity 0.15s",
        opacity: isSaving && !isDragging ? 0.75 : 1,
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
        <div style={{ fontSize: 10, color: C.grey400 }}>{story.id}</div>
        <button
          type="button"
          {...(dragHandleProps ?? {})}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Drag story ${story.id}`}
          style={{ border: "none", background: "transparent", color: C.grey400, cursor: "grab", padding: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }}
        >
          <GripVertical size={14} />
        </button>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.grey800, lineHeight: 1.4, marginBottom: 7 }}>{story.title.length > 75 ? story.title.slice(0, 75) + "…" : story.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <AgileBadge label={story.priority} color={priorityBg(story.priority, C)} textColor={priorityColor(story.priority, C)} small />
        <span style={{ background: tshirtBg(story.tshirt, C), color: tshirtColor(story.tshirt, C), borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 700 }}>{story.tshirt}</span>
        {story.points && <span style={{ background: C.grey100, color: C.grey600, borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 700 }}>{story.points}pt</span>}
        <div style={{ flex: 1 }} />
        <AgileAvatar name={story.assignee} size={20} />
      </div>
      {story.tasks > 0 && (
        <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, color: C.grey400 }}>{story.tasksDone}/{story.tasks} tasks</span>
          <AgileProgressBar pct={(story.tasksDone / story.tasks) * 100} color={epic?.color || C.blue} height={3} />
        </div>
      )}
    </div>
  );
}
