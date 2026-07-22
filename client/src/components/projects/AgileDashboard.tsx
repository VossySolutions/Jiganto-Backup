import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PmDashboardSkeleton, PmErrorState } from "@/components/projects/PmLoadingShell";
import { ProjectPollsCard } from "@/components/surveys/ProjectPollsCard";
import "./agile-responsive.css";

const C = {
  navy: "#1B3A6B", blue: "#2563EB", blueMid: "#3B82F6", blueLight: "#DBEAFE",
  teal: "#0EA5E9", tealLight: "#E0F2FE", purple: "#7C3AED", purpleLight: "#EDE9FE",
  green: "#16A34A", greenLight: "#DCFCE7", amber: "#D97706", amberLight: "#FEF3C7",
  red: "#DC2626", redLight: "#FEE2E2",
  grey50: "#F8FAFC", grey100: "#F1F5F9", grey200: "#E2E8F0", grey300: "#CBD5E1",
  grey400: "#94A3B8", grey500: "#64748B", grey600: "#475569", grey700: "#334155",
  grey800: "#1E293B", white: "#FFFFFF",
};

interface Workstream { id: string; name: string; color: string; sprintName: string; sprintProgress: number; velocity: number; storyPoints: { done: number; total: number }; defects: { open: number; closed: number }; epics: number; stories: number; team: number; health: string; velocityChart?: VelocityPoint[]; burndownChart?: BurndownPoint[]; epicItems?: typeof EPIC_PROGRESS; }
interface KPIData { label: string; value: string | number; change: string; trend: string; color: string; icon: string; }
interface VelocityPoint { sprint: string; planned: number; delivered: number; }
interface BurndownPoint { day: string; ideal: number; actual: number | null; }

const WORKSTREAMS: Workstream[] = [
  { id:"ws-ai", name:"AI CUI Engine", color:C.blue, sprintName:"Sprint 3", sprintProgress:53, velocity:30, storyPoints:{done:18,total:34}, defects:{open:2,closed:5}, epics:3, stories:12, team:5, health:"amber" },
  { id:"ws-o2c", name:"Order to Cash", color:C.teal, sprintName:"Sprint 2", sprintProgress:38, velocity:24, storyPoints:{done:10,total:26}, defects:{open:1,closed:3}, epics:2, stories:10, team:4, health:"green" },
  { id:"ws-p2p", name:"Purchase to Pay", color:C.purple, sprintName:"Sprint 1", sprintProgress:12, velocity:0, storyPoints:{done:2,total:18}, defects:{open:0,closed:0}, epics:1, stories:7, team:3, health:"green" },
  { id:"ws-r2r", name:"Record to Report", color:C.amber, sprintName:"Sprint 1", sprintProgress:65, velocity:28, storyPoints:{done:20,total:30}, defects:{open:3,closed:8}, epics:2, stories:9, team:4, health:"red" },
  { id:"ws-h2r", name:"Hire to Retire", color:C.green, sprintName:"Sprint 2", sprintProgress:80, velocity:32, storyPoints:{done:24,total:30}, defects:{open:0,closed:2}, epics:2, stories:8, team:3, health:"green" },
];

const KPIS: KPIData[] = [
  { label:"Total Story Points", value:"138", change:"+12 this sprint", trend:"up", color:C.blue, icon:"" },
  { label:"Velocity (avg)", value:"28.5", change:"+2.3 vs last", trend:"up", color:C.teal, icon:"" },
  { label:"Open Defects", value:"6", change:"-3 vs last sprint", trend:"down", color:C.red, icon:"" },
  { label:"Sprint Completion", value:"52%", change:"On track", trend:"neutral", color:C.green, icon:"" },
  { label:"Team Members", value:"19", change:"Across 5 streams", trend:"neutral", color:C.purple, icon:"" },
  { label:"Active Epics", value:"10", change:"3 at risk", trend:"neutral", color:C.amber, icon:"" },
];

const VELOCITY_DATA: VelocityPoint[] = [
  { sprint:"S1", planned:28, delivered:28 }, { sprint:"S2", planned:32, delivered:30 },
  { sprint:"S3", planned:34, delivered:18 }, { sprint:"S4", planned:30, delivered:0 },
];

const BURNDOWN_DATA: BurndownPoint[] = [
  { day:"D1", ideal:34, actual:34 }, { day:"D2", ideal:31, actual:32 }, { day:"D3", ideal:29, actual:30 },
  { day:"D4", ideal:26, actual:29 }, { day:"D5", ideal:24, actual:26 }, { day:"D6", ideal:21, actual:24 },
  { day:"D7", ideal:18, actual:22 }, { day:"D8", ideal:16, actual:18 }, { day:"D9", ideal:13, actual:16 },
  { day:"D10", ideal:10, actual:null }, { day:"D11", ideal:8, actual:null },
  { day:"D12", ideal:5, actual:null }, { day:"D13", ideal:3, actual:null }, { day:"D14", ideal:0, actual:null },
];

const EPIC_PROGRESS = [
  { id:"EP-001", title:"AI CUI Core Engine", ws:"AI CUI Engine", color:C.blue, progress:45, stories:12, done:5, status:"Active" },
  { id:"EP-002", title:"User Auth & SSO", ws:"AI CUI Engine", color:C.teal, progress:72, stories:8, done:6, status:"Active" },
  { id:"EP-003", title:"Real-Time Collaboration", ws:"AI CUI Engine", color:C.purple, progress:10, stories:15, done:2, status:"Planning" },
  { id:"EP-004", title:"Sales Order Management", ws:"Order to Cash", color:C.amber, progress:38, stories:10, done:4, status:"Active" },
  { id:"EP-005", title:"Purchase Requisition Flow", ws:"Purchase to Pay", color:C.green, progress:5, stories:7, done:0, status:"Planning" },
];

const RECENT_ACTIVITY = [
  { time:"10 min ago", user:"Sarah K.", action:"Moved US-002 to In Progress", ws:"AI CUI Engine", color:C.blue },
  { time:"25 min ago", user:"Mark T.", action:"Closed DEF-002 (SSO redirect loop)", ws:"AI CUI Engine", color:C.blue },
  { time:"1 hr ago", user:"Priya M.", action:"Added 3 stories to Sprint 3", ws:"AI CUI Engine", color:C.blue },
  { time:"2 hrs ago", user:"James L.", action:"Created EP-006 (Invoice Processing)", ws:"Order to Cash", color:C.teal },
  { time:"3 hrs ago", user:"Dev A.", action:"Raised DEF-003 (Cursor ghost)", ws:"AI CUI Engine", color:C.blue },
  { time:"Yesterday", user:"System", action:"Sprint 2 closed \u2014 93.8% completion", ws:"AI CUI Engine", color:C.blue },
];

const RISKS = [
  { id:"R1", title:"Sprint 3 behind ideal burndown", severity:"Medium", ws:"AI CUI Engine", color:C.amber },
  { id:"R2", title:"R2R has 3 open critical defects", severity:"High", ws:"Record to Report", color:C.red },
  { id:"R3", title:"P2P velocity not yet established", severity:"Low", ws:"Purchase to Pay", color:C.blue },
];

const healthColor = (h: string) => ({ green:C.green, amber:C.amber, red:C.red } as Record<string,string>)[h] || C.grey400;
const healthBg = (h: string) => ({ green:C.greenLight, amber:C.amberLight, red:C.redLight } as Record<string,string>)[h] || C.grey100;
const healthLabel = (h: string) => ({ green:"On Track", amber:"At Risk", red:"Off Track" } as Record<string,string>)[h] || "Unknown";

function DashProgressBar({ pct, color=C.blue, height=6 }: { pct: number; color?: string; height?: number }) {
  return (
    <div style={{ height, borderRadius:height, background:C.grey200, overflow:"hidden", flex:1 }}>
      <div style={{ height:"100%", width:`${Math.min(100,pct||0)}%`, background:pct>=100?C.green:color, borderRadius:height, transition:"width 0.5s" }}/>
    </div>
  );
}

function DashBadge({ label, bg, color, dot }: { label: string; bg: string; color: string; dot?: boolean }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:20, background:bg, color, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
      {dot && <span style={{ width:5, height:5, borderRadius:"50%", background:color }}/>}
      {label}
    </span>
  );
}

function VelocityChart({ data, width=460, height=200 }: { data: VelocityPoint[]; width?: number; height?: number }) {
  const pad = { top:16, right:16, bottom:32, left:36 };
  const W = width-pad.left-pad.right;
  const H = height-pad.top-pad.bottom;
  const series = data?.length ? data : [{ sprint: "—", planned: 0, delivered: 0 }];
  const maxY = Math.max(1, ...series.flatMap(d => [d.planned || 0, d.delivered || 0])) + 5;
  const barW = W / (series.length * 3 + 1);
  const gap = barW;

  return (
    <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:"12px 16px" }}>
      <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:8 }}>Velocity Trend</div>
      <div style={{ width:"100%", overflowX:"auto" }}>
      <svg width={width} height={height} style={{ display:"block", minWidth:280 }}>
        {[0,0.25,0.5,0.75,1].map(t=>{
          const yv=pad.top+H*t; const val=Math.round(maxY*(1-t));
          return (
            <g key={t}>
              <line x1={pad.left} y1={yv} x2={pad.left+W} y2={yv} stroke={C.grey100} strokeWidth={1}/>
              <text x={pad.left-6} y={yv+4} textAnchor="end" fontSize={9} fill={C.grey400}>{val}</text>
            </g>
          );
        })}
        {series.map((d,i)=>{
          const x = pad.left + gap + i*(barW*3+gap);
          const ph = (d.planned/maxY)*H;
          const dh = (d.delivered/maxY)*H;
          return (
            <g key={d.sprint}>
              <rect x={x} y={pad.top+H-ph} width={barW} height={Math.max(0, ph)} rx={3} fill={`${C.blue}40`}/>
              <rect x={x+barW+2} y={pad.top+H-dh} width={barW} height={Math.max(0, dh)} rx={3} fill={C.blue}/>
              <text x={x+barW} y={pad.top+H+18} textAnchor="middle" fontSize={10} fill={C.grey500}>{d.sprint}</text>
            </g>
          );
        })}
        <g transform={`translate(${pad.left+W-120},${pad.top})`}>
          <rect x={0} y={2} width={12} height={10} rx={2} fill={`${C.blue}40`}/>
          <text x={16} y={11} fontSize={9} fill={C.grey500}>Planned</text>
          <rect x={60} y={2} width={12} height={10} rx={2} fill={C.blue}/>
          <text x={76} y={11} fontSize={9} fill={C.grey500}>Delivered</text>
        </g>
      </svg>
      </div>
    </div>
  );
}

function DashBurndownChart({ data, width=460, height=200 }: { data: BurndownPoint[]; width?: number; height?: number }) {
  const pad = { top:16, right:16, bottom:32, left:36 };
  const W = width-pad.left-pad.right;
  const H = height-pad.top-pad.bottom;
  const series = data?.length ? data : [{ day: "D1", ideal: 0, actual: 0 }];
  const maxY = Math.max(1, ...series.map(d=>Math.max(d.ideal || 0, d.actual || 0)));
  const denom = Math.max(1, series.length - 1);
  const xs = series.map((_,i)=>pad.left+(i/denom)*W);
  const y = (v: number) => pad.top+H-(Math.max(0, v)/maxY)*H;
  const idealPath = series.map((d,i)=>`${i===0?"M":"L"}${xs[i]},${y(d.ideal)}`).join(" ");
  const actualPts = series.filter(d=>d.actual!==null);
  const actualPath = actualPts.map((d,i)=>{
    const xi = series.indexOf(d);
    return `${i===0?"M":"L"}${xs[xi]},${y(d.actual!)}`;
  }).join(" ");
  const lastIdx = series.reduce((a,d,i)=>d.actual!==null?i:a,-1);

  return (
    <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:"12px 16px" }}>
      <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:8 }}>Sprint Burndown (AI CUI Engine)</div>
      <div style={{ width:"100%", overflowX:"auto" }}>
      <svg width={width} height={height} style={{ display:"block", overflow:"visible", minWidth:280 }}>
        {[0,0.25,0.5,0.75,1].map(t=>{
          const yv=pad.top+H*t;
          return (
            <g key={t}>
              <line x1={pad.left} y1={yv} x2={pad.left+W} y2={yv} stroke={C.grey100} strokeWidth={1}/>
              <text x={pad.left-6} y={yv+4} textAnchor="end" fontSize={9} fill={C.grey400}>{Math.round(maxY*(1-t))}</text>
            </g>
          );
        })}
        {series.filter((_,i)=>i%2===0).map(d=>{
          const idx=series.indexOf(d);
          return <text key={d.day} x={xs[idx]} y={pad.top+H+18} textAnchor="middle" fontSize={9} fill={C.grey400}>{d.day}</text>;
        })}
        {lastIdx>=0 && <line x1={xs[lastIdx]} y1={pad.top} x2={xs[lastIdx]} y2={pad.top+H} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3"/>}
        <path d={idealPath} fill="none" stroke={C.grey300} strokeWidth={2} strokeDasharray="6 3"/>
        {actualPts.length>0 && <path d={actualPath+` L${xs[lastIdx]},${pad.top+H} L${xs[0]},${pad.top+H} Z`} fill={`${C.blue}18`}/>}
        {actualPts.length>0 && <path d={actualPath} fill="none" stroke={C.blue} strokeWidth={2.5}/>}
        {actualPts.map((d,i)=>{
          const xi=series.indexOf(d);
          return <circle key={i} cx={xs[xi]} cy={y(d.actual!)} r={3.5} fill={C.white} stroke={C.blue} strokeWidth={2}/>;
        })}
      </svg>
      </div>
    </div>
  );
}

function WorkstreamCard({ ws, onClick }: { ws: Workstream; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ background:C.white, border:`1.5px solid ${C.grey200}`, borderTop:`4px solid ${ws.color}`, borderRadius:10, padding:16, cursor:"pointer", transition:"box-shadow 0.15s" }}
      onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={e=>(e.currentTarget.style.boxShadow="none")}
      data-testid={`ws-card-${ws.id}`}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:ws.color }}/>
          <span style={{ fontWeight:700, fontSize:14, color:C.grey800 }}>{ws.name}</span>
        </div>
        <DashBadge label={healthLabel(ws.health)} bg={healthBg(ws.health)} color={healthColor(ws.health)} dot/>
      </div>
      <div style={{ fontSize:11, color:C.grey400, marginBottom:6 }}>{ws.sprintName}</div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
        <DashProgressBar pct={ws.sprintProgress} color={ws.color} height={6}/>
        <span style={{ fontSize:12, fontWeight:700, color:ws.color }}>{ws.sprintProgress}%</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {([["Velocity", ws.velocity, C.blue],["Points",`${ws.storyPoints.done}/${ws.storyPoints.total}`,C.teal],["Defects",ws.defects.open,ws.defects.open>2?C.red:C.green]] as [string, string|number, string][]).map(([l,v,c])=>(
          <div key={l} style={{ textAlign:"center" }}>
            <div style={{ fontWeight:800, fontSize:16, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:C.grey400 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontSize:10, color:C.grey400 }}>
        <span>{ws.epics} epics \u00B7 {ws.stories} stories</span>
        <span>{ws.team} members</span>
      </div>
    </div>
  );
}

function WorkstreamDetail({ ws, onBack, velocityData, burndownData, epicProgress }: {
  ws: Workstream;
  onBack: () => void;
  velocityData: VelocityPoint[];
  burndownData: BurndownPoint[];
  epicProgress: typeof EPIC_PROGRESS;
}) {
  return (
    <div style={{ padding:20 }}>
      <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.blue, fontWeight:600, marginBottom:16 }} data-testid="button-back-dashboard">
        \u2190 Back to Dashboard
      </button>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <span style={{ width:12, height:12, borderRadius:"50%", background:ws.color }}/>
        <span style={{ fontWeight:800, fontSize:20, color:C.grey800 }}>{ws.name}</span>
        <DashBadge label={healthLabel(ws.health)} bg={healthBg(ws.health)} color={healthColor(ws.health)} dot/>
        <DashBadge label={ws.sprintName} bg={C.blueLight} color={C.blue}/>
      </div>
      <div className="agile-detail-stats" style={{ marginBottom:20 }}>
        {([
          ["Story Points",`${ws.storyPoints.done}/${ws.storyPoints.total}`,C.blue,C.blueLight],
          ["Velocity",ws.velocity,C.teal,C.tealLight],
          ["Open Defects",ws.defects.open,ws.defects.open>2?C.red:C.green,ws.defects.open>2?C.redLight:C.greenLight],
          ["Team Size",ws.team,C.purple,C.purpleLight],
        ] as [string, string|number, string, string][]).map(([l,v,c,bg])=>(
          <div key={l} style={{ background:bg, borderRadius:10, padding:16, textAlign:"center" }}>
            <div style={{ fontWeight:800, fontSize:24, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:C.grey500, marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:20 }}>
        <span style={{ fontWeight:700, fontSize:14, color:C.grey700 }}>Sprint Progress</span>
        <DashProgressBar pct={ws.sprintProgress} color={ws.color} height={10}/>
        <span style={{ fontWeight:800, fontSize:16, color:ws.color }}>{ws.sprintProgress}%</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <VelocityChart data={velocityData} width={420} height={200}/>
        <DashBurndownChart data={burndownData} width={420} height={200}/>
      </div>
      <div style={{ marginTop:20 }}>
        <div style={{ fontWeight:700, fontSize:14, color:C.grey700, marginBottom:10 }}>Epic Progress</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {epicProgress.map(ep=>(
            <div key={ep.id} style={{ background:C.white, border:`1px solid ${C.grey200}`, borderLeft:`4px solid ${ep.color}`, borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:C.grey400 }}>{ep.id}</div>
                <div style={{ fontSize:13, fontWeight:600, color:C.grey800 }}>{ep.title}</div>
              </div>
              <DashBadge label={ep.status} bg={ep.status==="Active"?C.greenLight:C.amberLight} color={ep.status==="Active"?C.green:C.amber} dot/>
              <div style={{ width:120 }}>
                <DashProgressBar pct={ep.progress} color={ep.color} height={6}/>
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:ep.color, minWidth:36 }}>{ep.progress}%</span>
              <span style={{ fontSize:11, color:C.grey400 }}>{ep.done}/{ep.stories}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AgileDashboard({ projectId }: { projectId?: number }) {
  const [selectedWs, setSelectedWs] = useState<string|null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{
    kpis: KPIData[];
    workstreams: Workstream[];
    velocityData: VelocityPoint[];
    burndownData: BurndownPoint[];
    epicProgress: typeof EPIC_PROGRESS;
    recentActivity: typeof RECENT_ACTIVITY;
    risks: typeof RISKS;
  }>({
    queryKey: ["/api/pm/projects", projectId, "agile/dashboard"],
    enabled: !!projectId,
  });

  const kpis = projectId ? (data?.kpis ?? []) : (data?.kpis ?? KPIS);
  const workstreamList: Workstream[] = projectId
    ? (data?.workstreams?.map((w) => ({
        id: String(w.id),
        name: w.name,
        color: w.color,
        sprintName: w.sprintName,
        sprintProgress: w.sprintProgress,
        velocity: w.velocity,
        storyPoints: w.storyPoints,
        defects: w.defects,
        epics: w.epics,
        stories: w.stories,
        team: w.team,
        health: w.health,
        velocityChart: (w as any).velocityChart,
        burndownChart: (w as any).burndownChart,
        epicItems: (w as any).epicItems,
      })) ?? [])
    : (data?.workstreams?.map((w) => ({
        id: String(w.id),
        name: w.name,
        color: w.color,
        sprintName: w.sprintName,
        sprintProgress: w.sprintProgress,
        velocity: w.velocity,
        storyPoints: w.storyPoints,
        defects: w.defects,
        epics: w.epics,
        stories: w.stories,
        team: w.team,
        health: w.health,
        velocityChart: (w as any).velocityChart,
        burndownChart: (w as any).burndownChart,
        epicItems: (w as any).epicItems,
      })) ?? WORKSTREAMS);
  const velocityData = projectId ? (data?.velocityData ?? []) : (data?.velocityData ?? VELOCITY_DATA);
  const burndownData = projectId ? (data?.burndownData ?? []) : (data?.burndownData ?? BURNDOWN_DATA);
  const epicProgress = projectId ? (data?.epicProgress ?? []) : (data?.epicProgress ?? EPIC_PROGRESS);
  const recentActivity = projectId ? (data?.recentActivity ?? []) : (data?.recentActivity ?? RECENT_ACTIVITY);
  const risks = projectId ? (data?.risks ?? []) : (data?.risks ?? RISKS);

  const ws = selectedWs ? workstreamList.find(w=>w.id===selectedWs) : null;

  if (projectId && isLoading) {
    return (
      <div style={{ background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden" }} data-testid="agile-dashboard-loading">
        <PmDashboardSkeleton />
      </div>
    );
  }

  if (projectId && isError) {
    return (
      <div style={{ background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden" }}>
        <PmErrorState message="Failed to load agile dashboard." onRetry={() => refetch()} />
      </div>
    );
  }

  if (projectId && !isLoading && workstreamList.length === 0) {
    return (
      <div style={{ background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden", padding:48, textAlign:"center" }}>
        <div style={{ fontWeight:700, fontSize:16, color:C.grey700, marginBottom:8 }}>No agile data yet</div>
        <div style={{ fontSize:13, color:C.grey500 }}>Add workstreams and stories in the Sprint Board to populate this dashboard.</div>
      </div>
    );
  }

  if (ws) {
    const wsVelocity = ws.velocityChart ?? velocityData.filter(() => true).slice(0, 4);
    const wsBurndown = ws.burndownChart ?? burndownData;
    const wsEpics = ws.epicItems ?? epicProgress.filter(e => e.ws === ws.name);
    return (
      <div style={{ background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden" }} data-testid="agile-dashboard">
        <WorkstreamDetail ws={ws} onBack={()=>setSelectedWs(null)} velocityData={wsVelocity} burndownData={wsBurndown} epicProgress={wsEpics}/>
      </div>
    );
  }

  return (
    <div style={{ background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden" }} data-testid="agile-dashboard">
      <div style={{ padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:13, color:C.grey500 }}>Multi-workstream overview \u2022 Sprint health \u2022 Delivery metrics</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12, marginBottom:24 }} data-testid="section-kpis">
          {kpis.map((kpi, index)=>(
            <div key={kpi.label} style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:"14px 16px", borderLeft:`4px solid ${kpi.color}` }} data-testid={`kpi-card-${index}`}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", marginBottom:6 }}>
                <span style={{ fontSize:10, color: kpi.trend==="up"?C.green:kpi.trend==="down"?C.red:C.grey400, fontWeight:600 }}>
                  {kpi.trend==="up"?"\u2191":kpi.trend==="down"?"\u2193":"\u2022"} {kpi.change}
                </span>
              </div>
              <div style={{ fontWeight:800, fontSize:24, color:kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize:11, color:C.grey500 }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontWeight:700, fontSize:16, color:C.grey800, marginBottom:12 }}>Workstreams</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14, marginBottom:24 }} data-testid="section-workstreams">
          {workstreamList.map(w=>(
            <WorkstreamCard key={w.id} ws={w} onClick={()=>setSelectedWs(w.id)}/>
          ))}
        </div>

        <div className="agile-dashboard-charts" style={{ marginBottom:24 }} data-testid="section-charts">
          <div data-testid="chart-velocity"><VelocityChart data={velocityData}/></div>
          <div data-testid="chart-burndown"><DashBurndownChart data={burndownData}/></div>
        </div>

        <div className="agile-dashboard-panels" style={{ marginBottom:24 }}>
          <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:16 }}>
            <div style={{ fontWeight:700, fontSize:14, color:C.grey700, marginBottom:12 }}>Epic Progress</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {epicProgress.map(ep=>(
                <div key={ep.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:`1px solid ${C.grey100}` }} data-testid={`epic-progress-${ep.id}`}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:ep.color, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:C.grey800, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ep.title}</div>
                    <div style={{ fontSize:10, color:C.grey400 }}>{ep.ws} \u00B7 {ep.done}/{ep.stories} stories</div>
                  </div>
                  <div style={{ width:100 }}><DashProgressBar pct={ep.progress} color={ep.color} height={5}/></div>
                  <span style={{ fontSize:11, fontWeight:700, color:ep.color, minWidth:32 }}>{ep.progress}%</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:16 }}>
            <div style={{ fontWeight:700, fontSize:14, color:C.grey700, marginBottom:12 }}>Risks & Blockers</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {risks.map(r=>(
                <div key={r.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"8px 12px", background:r.severity==="High"?C.redLight:r.severity==="Medium"?C.amberLight:C.blueLight, borderRadius:8, border:`1px solid ${r.color}22` }} data-testid={`risk-item-${r.id}`}>
                  <span style={{ width:10, height:10, borderRadius:"50%", background:r.severity==="High"?C.red:r.severity==="Medium"?C.amber:C.blue, flexShrink:0, marginTop:3 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:C.grey800 }}>{r.title}</div>
                    <div style={{ fontSize:10, color:C.grey500 }}>{r.ws} \u00B7 {r.severity}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:16 }}>
          <div style={{ fontWeight:700, fontSize:14, color:C.grey700, marginBottom:12 }}>Recent Activity</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {recentActivity.map((a,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:i<recentActivity.length-1?`1px solid ${C.grey100}`:"none" }} data-testid={`activity-item-${i}`}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:a.color, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:C.grey800 }}>{a.user}</span>
                  <span style={{ fontSize:12, color:C.grey500 }}> {a.action}</span>
                </div>
                <span style={{ fontSize:10, color:C.grey400, whiteSpace:"nowrap" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {projectId ? <ProjectPollsCard projectId={projectId} /> : null}
      </div>
    </div>
  );
}
