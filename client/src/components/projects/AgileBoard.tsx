import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePmAgileMutations } from "@/hooks/use-pm-agile-mutations";
import {
  PmLoadingOverlay,
  PmAgileSkeleton,
  PmErrorState
} from "@/components/projects/PmLoadingShell";
import "./agile-responsive.css";
import {
  dbWorkstreamToLocal, dbEpicToLocal, dbStoryToLocal, dbSprintToLocal, dbDefectToLocal,
  buildSprintMap, computeBurndown, isNumericId,
} from "@/lib/pm-agile-mappers";
import {
  AGILE_PALETTE as C,
  AgileBtn,
  AgileModal,
  FormField,
  inputStyle,
  BoardView,
  BacklogView,
  EpicsView,
  EpicForm,
  StoriesView,
  SprintsView,
  DefectsView,
  RoadmapView,
  BestPracticeView,
  EpicDetailPanel,
  StoryDetailPanel,
} from "./agile-board";
import type { Workstream, Epic, Story, Defect, Sprint } from "./agile-board";

const TABS = [
  { id:"board", label:"Sprint Board" },
  { id:"backlog", label:"Backlog" },
  { id:"epics", label:"Epics" },
  { id:"stories", label:"Stories" },
  { id:"sprints", label:"Sprints" },
  { id:"defects", label:"Defects" },
  { id:"roadmap", label:"Roadmap" },
  { id:"bestpractice", label:"Best Practice" },
];

interface AgileBoardProps {
  initialTab?: string;
  view?: "board" | "backlog" | "epics" | "stories" | "sprints" | "defects" | "roadmap" | "bestpractice";
  boardMode?: "sprint" | "scrum" | "kanban";
  projectId?: number;
}

export default function AgileBoard({ initialTab = "board", view, boardMode = "sprint", projectId }: AgileBoardProps) {
  const isDbMode = !!projectId;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeWs, setActiveWs] = useState("");
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [wsAdmin, setWsAdmin] = useState<{ mode: "create" | "rename" | "delete"; ws?: Workstream; name: string } | null>(null);
  const seedAttempted = useRef(false);

  const mutations = usePmAgileMutations(projectId, activeWs);

  const { data: wsData, isLoading: wsLoading, isError: wsError, refetch: refetchWs } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "agile/workstreams"],
    enabled: isDbMode,
  });
  const { data: epicsData, isLoading: epicsLoading, isFetching: epicsFetching } = useQuery<any[]>({
    queryKey: ["/api/pm/agile/workstreams", activeWs, "epics"],
    enabled: isDbMode && /^\d+$/.test(activeWs),
  });
  const { data: storiesData, isLoading: storiesLoading, isFetching: storiesFetching } = useQuery<any[]>({
    queryKey: ["/api/pm/agile/workstreams", activeWs, "stories"],
    enabled: isDbMode && /^\d+$/.test(activeWs),
  });
  const { data: sprintsData, isLoading: sprintsLoading, isFetching: sprintsFetching } = useQuery<any[]>({
    queryKey: ["/api/pm/agile/workstreams", activeWs, "sprints"],
    enabled: isDbMode && /^\d+$/.test(activeWs),
  });
  const { data: defectsData, isLoading: defectsLoading, isFetching: defectsFetching } = useQuery<any[]>({
    queryKey: ["/api/pm/agile/workstreams", activeWs, "defects"],
    enabled: isDbMode && /^\d+$/.test(activeWs),
  });

  const wsDetailLoading = isDbMode && /^\d+$/.test(activeWs) && (epicsLoading || storiesLoading || sprintsLoading || defectsLoading);
  const wsDetailFetching = isDbMode && /^\d+$/.test(activeWs) && !wsDetailLoading && (epicsFetching || storiesFetching || sprintsFetching || defectsFetching);

  useEffect(() => {
    if (wsData) {
      const mapped = wsData.map((w) => dbWorkstreamToLocal(w));
      setWorkstreams(mapped);
      if (mapped.length > 0) {
        setActiveWs((prev) => (prev === "" || !mapped.find((m) => m.id === prev)) ? mapped[0].id : prev);
      }
    }
  }, [wsData]);

  useEffect(() => {
    if (sprintsData && activeWs) {
      const currentWs = workstreams.find((w) => w.id === activeWs) || { id: activeWs, name: "", color: C.blue };
      setSprints((prev) => [...prev.filter((s) => s.wsId !== activeWs), ...sprintsData.map((s) => dbSprintToLocal(s, currentWs) as Sprint)]);
    }
  }, [sprintsData, activeWs, workstreams]);

  useEffect(() => {
    if (storiesData && activeWs) {
      const currentWs = workstreams.find((w) => w.id === activeWs) || { id: activeWs, name: "", color: C.blue };
      const wsSprints = sprints.filter((s) => s.wsId === activeWs);
      const sprintMap = buildSprintMap(wsSprints);
      setStories((prev) => [...prev.filter((s) => s.wsId !== activeWs), ...storiesData.map((s) => dbStoryToLocal(s, currentWs, sprintMap) as Story)]);
    }
  }, [storiesData, activeWs, workstreams, sprints]);

  useEffect(() => {
    if (epicsData && activeWs) {
      const currentWs = workstreams.find((w) => w.id === activeWs) || { id: activeWs, name: "", color: C.blue };
      const wsStories = stories.filter((s) => s.wsId === activeWs);
      setEpics((prev) => [...prev.filter((e) => e.wsId !== activeWs), ...epicsData.map((e) => dbEpicToLocal(e, currentWs, wsStories as Parameters<typeof dbEpicToLocal>[2]) as Epic)]);
    }
  }, [epicsData, activeWs, workstreams, stories]);

  useEffect(() => {
    if (defectsData && activeWs) {
      const currentWs = workstreams.find((w) => w.id === activeWs) || { id: activeWs, name: "", color: C.blue };
      setDefects((prev) => [...prev.filter((d) => d.wsId !== activeWs), ...defectsData.map((d) => dbDefectToLocal(d, currentWs) as Defect)]);
    }
  }, [defectsData, activeWs, workstreams]);

  const createStoryMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/pm/agile/workstreams/${activeWs}/stories`, payload),
    onSuccess: () => mutations.invalidateWs(),
  });
  const createEpicMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/pm/agile/workstreams/${activeWs}/epics`, payload),
    onSuccess: () => mutations.invalidateWs(),
  });
  const createSprintMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/pm/agile/workstreams/${activeWs}/sprints`, payload),
    onSuccess: () => mutations.invalidateWs(),
  });
  const createDefectMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/pm/agile/workstreams/${activeWs}/defects`, payload),
    onSuccess: () => mutations.invalidateWs(),
  });
  const createWorkstreamMutation = useMutation({
    mutationFn: (name: string) => apiRequest('POST', `/api/pm/projects/${projectId}/agile/workstreams`, { name, color: C.blue, sortOrder: workstreams.length }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/pm/projects', projectId, 'agile/workstreams'] }),
  });
  const updateWorkstreamMutation = useMutation({
    mutationFn: ({ id, name, color }: { id: string; name?: string; color?: string }) =>
      apiRequest('PUT', `/api/pm/agile/workstreams/${id}`, { ...(name ? { name } : {}), ...(color ? { color } : {}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/pm/projects', projectId, 'agile/workstreams'] }),
  });
  const deleteWorkstreamMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/pm/agile/workstreams/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/pm/projects', projectId, 'agile/workstreams'] }),
  });

  const handleEpicEditSave = (data: any) => {
    if (!editingEpic) return;
    mutations.updateEpic(editingEpic.id, {
      title: data.title, initiative: data.initiative, description: data.description,
      status: data.status?.toLowerCase(), priority: data.priority?.toLowerCase(),
      tshirt: data.tshirt, owner: data.owner,
      startDate: data.startDate || null, endDate: data.endDate || null,
    });
    setEditingEpic(null);
    setSelectedEpic(null);
  };

  useEffect(() => {
    if (!isDbMode || !projectId || seedAttempted.current) return;
    if (wsData && wsData.length === 0 && !createWorkstreamMutation.isPending) {
      seedAttempted.current = true;
      createWorkstreamMutation.mutate("Default Workstream");
    }
  }, [isDbMode, projectId, wsData, createWorkstreamMutation.isPending]);

  const currentWsObj = workstreams.find(w => w.id === activeWs) || workstreams[0] || { id: activeWs, name: "", color: C.blue };

  const handleAddStory = isDbMode ? (data: any) => {
    createStoryMutation.mutate({ projectId, title: data.title, epicId: data.epicId ? Number(data.epicId) : null, points: data.points ? Number(data.points) : null, tshirt: data.tshirt || "M", priority: data.priority || "Medium", assignee: data.assignee || null, status: "Backlog", creator: "Current User", tags: [], acceptanceCriteria: data.ac ? data.ac.split("\n").map((l: string) => l.trim()).filter(Boolean) : [] });
  } : undefined;
  const handleAddEpic = isDbMode ? (data: any) => {
    createEpicMutation.mutate({ projectId, title: data.title, initiative: data.initiative || "", status: (data.status || "planning").toLowerCase(), priority: (data.priority || "Medium").toLowerCase(), tshirt: data.tshirt || "M", owner: data.owner || "", color: currentWsObj?.color || C.blue, description: data.description || "", tags: [], startDate: data.startDate || null, endDate: data.endDate || null });
  } : undefined;
  const handleAddSprint = isDbMode ? (data: any) => {
    createSprintMutation.mutate({ projectId, name: data.name, goal: data.goal || "", status: "Planned", startDate: data.start || null, endDate: data.end || null, totalPoints: Number(data.points) || 0, donePoints: 0 });
  } : undefined;
  const handleAddDefect = isDbMode ? (data: any) => {
    createDefectMutation.mutate({ projectId, title: data.title, storyId: data.storyId ? Number(data.storyId) : null, severity: data.severity || "Minor", priority: data.priority || "Medium", status: "New", assignee: data.assignee || null, reporter: "Current User", environment: data.environment || "Dev" });
  } : undefined;

  const displayWorkstreams = workstreams;
  const ws = currentWsObj;
  const wsEpics = epics.filter(e=>e.wsId===activeWs);
  const wsStories = stories.filter(s=>s.wsId===activeWs);
  const wsSprints = sprints.filter(s=>s.wsId===activeWs);
  const activeSprint = wsSprints.find(s=>s.status==="Active") || wsSprints.find(s=>s.status==="Planned");
  const sprintStories = wsStories.filter(s=>s.sprint===activeSprint?.name);
  const liveBurndown = computeBurndown(activeSprint, wsStories as Parameters<typeof computeBurndown>[1]);

  async function handleStoryStatusChange(storyId: string, status: string) {
    setStories((prev) => prev.map((story) => story.id === storyId ? { ...story, status } : story));
    if (isDbMode && isNumericId(storyId)) {
      await mutations.updateStory(storyId, { status });
    }
  }

  const handleCompleteSprint = async () => {
    if (!activeSprint) return;
    const donePts = sprintStories.filter(s => s.status === "Done").reduce((a, s) => a + (s.points || 0), 0);
    if (isDbMode && isNumericId(activeSprint.id)) {
      await mutations.completeSprint(activeSprint.id, donePts);
    } else {
      setSprints(prev => prev.map(s => s.id === activeSprint.id ? { ...s, status: "Closed", done: donePts } : s));
    }
  };

  const currentView = view || activeTab;

  const renderView = () => {
    switch (currentView) {
      case "board": return <BoardView stories={wsStories} epics={wsEpics} activeSprint={activeSprint} onSelectStory={setSelectedStory} burndownData={liveBurndown} onCompleteSprint={handleCompleteSprint} boardMode={boardMode} onStoryStatusChange={handleStoryStatusChange}/>;
      case "backlog": return <BacklogView stories={wsStories} epics={wsEpics} onSelectStory={setSelectedStory} sprints={wsSprints} setStories={setStories} activeSprint={activeSprint} ws={ws} onAddStory={handleAddStory} onDeleteStory={(id) => mutations.deleteStory(id)} onAssignToSprint={(id, sp) => mutations.assignStoryToSprint(id, sp)}/>;
      case "epics": return <EpicsView epics={wsEpics} stories={wsStories} onSelect={setSelectedEpic as any} setEpics={setEpics} ws={ws} onAddEpic={handleAddEpic} onUpdateEpic={(id, d) => mutations.updateEpic(id, d)} onDeleteEpic={(id) => mutations.deleteEpic(id)}/>;
      case "stories": return <StoriesView stories={wsStories} epics={wsEpics} onSelect={setSelectedStory} setStories={setStories} ws={ws} onAddStory={handleAddStory} onDeleteStory={(id) => mutations.deleteStory(id)}/>;
      case "sprints": return <SprintsView sprints={wsSprints} stories={wsStories} setSprints={setSprints} ws={ws} onAddSprint={handleAddSprint} burndownData={liveBurndown} onActivateSprint={(id, all) => mutations.activateSprint(id, all)} onDeleteSprint={(id) => mutations.deleteSprint(id)}/>;
      case "defects": return <DefectsView defects={defects.filter(d=>d.wsId===activeWs)} stories={wsStories} setDefects={setDefects} ws={ws} onAddDefect={handleAddDefect} onUpdateDefect={(id, d) => mutations.updateDefect(id, d)} onDeleteDefect={(id) => mutations.deleteDefect(id)}/>;
      case "roadmap": return <RoadmapView epics={wsEpics} sprints={wsSprints}/>;
      case "bestpractice": return <BestPracticeView/>;
      default: return null;
    }
  };

  const WorkstreamTabs = () => (
    <div style={{ background:C.navy, display:"flex", alignItems:"center", gap:2, padding:"0 12px", height:40, flexShrink:0, overflowX:"auto" }}>
      {displayWorkstreams.map(w=>(
        <div key={w.id} style={{ display:"flex", alignItems:"center", marginTop:4 }}>
          <button onClick={()=>setActiveWs(w.id)}
            style={{ padding:"6px 14px", borderRadius:"6px 6px 0 0", border:"none", cursor:"pointer", fontSize:12, fontWeight:activeWs===w.id?700:500, background:activeWs===w.id?C.white:"transparent", color:activeWs===w.id?w.color:"#CBD5E1", transition:"all 0.15s", whiteSpace:"nowrap" }}
            data-testid={`ws-tab-${w.id}`}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:w.color, display:"inline-block", marginRight:6 }}/>
            {w.name}
          </button>
          {isDbMode && isNumericId(w.id) && activeWs===w.id && (
            <button onClick={()=>setWsAdmin({ mode:"rename", ws:w, name:w.name })}
              style={{ padding:"2px 6px", marginLeft:2, border:"none", background:"transparent", color:"#CBD5E1", cursor:"pointer", fontSize:10 }}
              title="Manage workstream">⚙</button>
          )}
        </div>
      ))}
      {isDbMode && (
        <button onClick={()=>setWsAdmin({ mode:"create", name:"" })}
          disabled={createWorkstreamMutation.isPending}
          style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #CBD5E1", cursor:"pointer", fontSize:11, color:"#CBD5E1", background:"transparent", marginLeft:4, marginTop:4, opacity:createWorkstreamMutation.isPending?0.6:1 }}
          data-testid="button-add-workstream">+ WS</button>
      )}
    </div>
  );

  const handleWsAdminSave = () => {
    if (!wsAdmin) return;
    const trimmed = wsAdmin.name.trim();
    if (wsAdmin.mode === "create" && trimmed) {
      createWorkstreamMutation.mutate(trimmed);
    } else if (wsAdmin.mode === "rename" && wsAdmin.ws && trimmed) {
      updateWorkstreamMutation.mutate({ id: wsAdmin.ws.id, name: trimmed });
    } else if (wsAdmin.mode === "delete" && wsAdmin.ws) {
      deleteWorkstreamMutation.mutate(wsAdmin.ws.id);
    }
    setWsAdmin(null);
  };

  const WsAdminModal = wsAdmin ? (
    <AgileModal title={wsAdmin.mode === "create" ? "New Workstream" : wsAdmin.mode === "rename" ? "Rename Workstream" : "Delete Workstream"} onClose={()=>setWsAdmin(null)}>
      {wsAdmin.mode === "delete" ? (
        <div>
          <p style={{ fontSize:13, color:C.grey600, marginBottom:16 }}>Delete workstream &quot;{wsAdmin.ws?.name}&quot;? This cannot be undone.</p>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <AgileBtn label="Cancel" onClick={()=>setWsAdmin(null)}/>
            <AgileBtn label="Delete" variant="primary" danger onClick={handleWsAdminSave} testId="button-confirm-delete-ws"/>
          </div>
        </div>
      ) : (
        <div>
          <FormField label="Workstream Name" required>
            <input style={inputStyle} value={wsAdmin.name} onChange={e=>setWsAdmin({...wsAdmin, name:e.target.value})} placeholder="e.g. Platform Team" data-testid="input-workstream-name"/>
          </FormField>
          <div style={{ display:"flex", gap:8, justifyContent:"space-between", marginTop:12 }}>
            {wsAdmin.mode === "rename" && wsAdmin.ws && displayWorkstreams.length > 1 && (
              <AgileBtn label="Delete…" danger onClick={()=>setWsAdmin({ mode:"delete", ws:wsAdmin.ws, name:wsAdmin.ws!.name })}/>
            )}
            <div style={{ flex:1 }}/>
            <AgileBtn label="Cancel" onClick={()=>setWsAdmin(null)}/>
            <AgileBtn label="Save" variant="primary" onClick={handleWsAdminSave} testId="button-save-workstream"/>
          </div>
        </div>
      )}
    </AgileModal>
  ) : null;

  const renderAgileContent = () => {
    if (isDbMode && wsError) {
      return <PmErrorState message="Failed to load agile workstreams." onRetry={() => refetchWs()} />;
    }
    if (isDbMode && (wsLoading || (createWorkstreamMutation.isPending && displayWorkstreams.length === 0))) {
      return <PmAgileSkeleton />;
    }
    if (isDbMode && displayWorkstreams.length === 0) {
      return (
        <div style={{ padding:48, textAlign:"center", color:C.grey400 }}>
          <div style={{ fontSize:15, fontWeight:600, color:C.grey600, marginBottom:8 }}>Setting up agile workspace…</div>
          <div style={{ fontSize:13 }}>Creating a default workstream for this project.</div>
        </div>
      );
    }
    return (
      <div className="agile-content" style={{ position:"relative", minHeight:200 }}>
        {wsDetailFetching && <PmLoadingOverlay label="Refreshing workstream data…" />}
        {renderView()}
      </div>
    );
  };

  if (view) {
    return (
      <div className="agile-root" style={{ display:"flex", flexDirection:"column", height:"100%", background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden" }} data-testid={`agile-${view}`}>
        <WorkstreamTabs />
        <div style={{ flex:1, overflowY:"auto" }}>
          {renderAgileContent()}
        </div>
        {selectedStory && <StoryDetailPanel story={selectedStory} epics={wsEpics} sprints={wsSprints} onClose={()=>setSelectedStory(null)} onUpdate={isDbMode ? (id, data) => mutations.updateStory(id, data) : undefined}/>}
        {selectedEpic && <EpicDetailPanel epic={selectedEpic} stories={wsStories} onClose={()=>setSelectedEpic(null)} onEdit={()=>{ setEditingEpic(selectedEpic); setSelectedEpic(null); }}/>}
        {editingEpic && (
          <AgileModal title="Edit Epic" onClose={()=>setEditingEpic(null)}>
            <EpicForm initial={editingEpic} onSave={handleEpicEditSave} onCancel={()=>setEditingEpic(null)}/>
          </AgileModal>
        )}
        {WsAdminModal}
      </div>
    );
  }

  return (
    <div className="agile-root" style={{ display:"flex", flexDirection:"column", height:"100%", background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden" }} data-testid="agile-board">
      <WorkstreamTabs />

      <div style={{ display:"flex", alignItems:"center", gap:4, padding:"0 14px", height:38, borderBottom:`1px solid ${C.grey200}`, background:C.white, overflowX:"auto", flexShrink:0 }}>
        {TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{ padding:"6px 12px", border:"none", cursor:"pointer", fontSize:12, fontWeight:activeTab===tab.id?700:500, color:activeTab===tab.id?C.blue:C.grey500, background:"transparent", borderBottom:activeTab===tab.id?`2px solid ${C.blue}`:"2px solid transparent", transition:"all 0.15s", whiteSpace:"nowrap" }}
            data-testid={`agile-tab-${tab.id}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto" }}>
        {renderAgileContent()}
      </div>

      {selectedStory && <StoryDetailPanel story={selectedStory} epics={wsEpics} sprints={wsSprints} onClose={()=>setSelectedStory(null)} onUpdate={isDbMode ? (id, data) => mutations.updateStory(id, data) : undefined}/>}
      {selectedEpic && <EpicDetailPanel epic={selectedEpic} stories={wsStories} onClose={()=>setSelectedEpic(null)} onEdit={()=>{ setEditingEpic(selectedEpic); setSelectedEpic(null); }}/>}
      {editingEpic && (
        <AgileModal title="Edit Epic" onClose={()=>setEditingEpic(null)}>
          <EpicForm initial={editingEpic} onSave={handleEpicEditSave} onCancel={()=>setEditingEpic(null)}/>
        </AgileModal>
      )}
      {WsAdminModal}
    </div>
  );
}
