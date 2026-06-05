import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const C = {
  navy: "#1B3A6B", blue: "#2563EB", blueMid: "#3B82F6", blueLight: "#DBEAFE",
  teal: "#0EA5E9", tealLight: "#E0F2FE", purple: "#7C3AED", purpleLight: "#EDE9FE",
  green: "#16A34A", greenLight: "#DCFCE7", amber: "#D97706", amberLight: "#FEF3C7",
  red: "#DC2626", redLight: "#FEE2E2",
  grey50: "#F8FAFC", grey100: "#F1F5F9", grey200: "#E2E8F0", grey300: "#CBD5E1",
  grey400: "#94A3B8", grey500: "#64748B", grey600: "#475569", grey700: "#334155",
  grey800: "#1E293B", white: "#FFFFFF",
};

interface Workstream { id: string; name: string; color: string; }
interface Epic { id: string; wsId: string; title: string; initiative: string; status: string; tshirt: string; priority: string; progress: number; owner: string; creator: string; createdAt: string; color: string; stories: number; storiesDone: number; tags: string[]; description: string; }
interface Story { id: string; epicId: string; wsId: string; title: string; status: string; points: number | null; tshirt: string; priority: string; assignee: string | null; creator: string; createdAt: string; sprint: string | null; tags: string[]; tasks: number; tasksDone: number; ac: string[]; }
interface Defect { id: string; storyId: string; wsId: string; title: string; severity: string; priority: string; status: string; assignee: string | null; creator: string; createdAt: string; environment: string; sprint: string | null; }
interface Sprint { id: string; wsId: string; name: string; status: string; start: string; end: string; points: number; done: number; goal?: string; }
interface BurndownPoint { day: string; ideal: number; actual: number | null; }
interface BurnUpPoint { week: string; completed: number; total: number; }

const WORKSTREAMS: Workstream[] = [
  { id: "ws-ai", name: "AI CUI Engine", color: C.blue },
  { id: "ws-o2c", name: "Order to Cash", color: C.teal },
  { id: "ws-p2p", name: "Purchase to Pay", color: C.purple },
  { id: "ws-r2r", name: "Record to Report", color: C.amber },
  { id: "ws-h2r", name: "Hire to Retire", color: C.green },
];

const EPICS_INIT: Epic[] = [
  { id:"EP-001", wsId:"ws-ai", title:"AI CUI Core Engine", initiative:"AI Platform v2", status:"Active", tshirt:"XL", priority:"Critical", progress:45, owner:"Sarah K.", creator:"Peter V.", createdAt:"2026-01-10", color:C.blue, stories:12, storiesDone:5, tags:["backend","AI"], description:"Build the core conversational UI engine powering all AI interactions." },
  { id:"EP-002", wsId:"ws-ai", title:"User Auth & SSO", initiative:"Security Foundation", status:"Active", tshirt:"L", priority:"High", progress:72, owner:"Mark T.", creator:"Peter V.", createdAt:"2026-01-12", color:C.teal, stories:8, storiesDone:6, tags:["security","auth"], description:"Enterprise SSO, MFA, and session management." },
  { id:"EP-003", wsId:"ws-ai", title:"Real-Time Collaboration", initiative:"AI Platform v2", status:"Planning", tshirt:"XL", priority:"High", progress:10, owner:"Priya M.", creator:"Sarah K.", createdAt:"2026-01-15", color:C.purple, stories:15, storiesDone:2, tags:["realtime","collab"], description:"WebSocket-powered live collaboration across all boards." },
  { id:"EP-004", wsId:"ws-o2c", title:"Sales Order Management", initiative:"ERP Phase 1", status:"Active", tshirt:"L", priority:"Critical", progress:38, owner:"James L.", creator:"Peter V.", createdAt:"2026-01-18", color:C.amber, stories:10, storiesDone:4, tags:["SAP","O2C"], description:"End-to-end sales order processing in SAP." },
  { id:"EP-005", wsId:"ws-p2p", title:"Purchase Requisition Flow", initiative:"ERP Phase 1", status:"Planning", tshirt:"M", priority:"High", progress:5, owner:"Dev A.", creator:"James L.", createdAt:"2026-01-20", color:C.green, stories:7, storiesDone:0, tags:["SAP","P2P"], description:"PR to PO automation and approval workflows." },
];

const STORIES_INIT: Story[] = [
  { id:"US-001", epicId:"EP-001", wsId:"ws-ai", title:"As a user, I want to type natural language queries so that I can interact with AI without learning commands", status:"Done", points:5, tshirt:"M", priority:"Critical", assignee:"Sarah K.", creator:"Sarah K.", createdAt:"2026-01-12", sprint:"Sprint 3", tags:["AI","UX"], tasks:3, tasksDone:3, ac:["Input accepts free text","Response within 2s","Error handling shown"] },
  { id:"US-002", epicId:"EP-001", wsId:"ws-ai", title:"As a developer, I want streaming responses so that users see output progressively", status:"In Progress", points:8, tshirt:"L", priority:"Critical", assignee:"Dev A.", creator:"Sarah K.", createdAt:"2026-01-14", sprint:"Sprint 3", tags:["AI","stream"], tasks:4, tasksDone:2, ac:["Tokens stream as generated","Stop button available","Graceful timeout"] },
  { id:"US-003", epicId:"EP-001", wsId:"ws-ai", title:"As a user, I want conversation history so that I can revisit past AI sessions", status:"To Do", points:5, tshirt:"M", priority:"High", assignee:"Dev B.", creator:"Sarah K.", createdAt:"2026-01-16", sprint:"Sprint 4", tags:["AI","history"], tasks:3, tasksDone:0, ac:["Last 50 sessions stored","Search by keyword","Delete session"] },
  { id:"US-004", epicId:"EP-002", wsId:"ws-ai", title:"As an admin, I want SSO integration so that users sign in with corporate credentials", status:"Done", points:13, tshirt:"L", priority:"Critical", assignee:"Mark T.", creator:"Mark T.", createdAt:"2026-01-13", sprint:"Sprint 2", tags:["security","SSO"], tasks:5, tasksDone:5, ac:["SAML 2.0 support","OIDC support","Fallback local auth"] },
  { id:"US-005", epicId:"EP-002", wsId:"ws-ai", title:"As a user, I want MFA so that my account is protected", status:"Done", points:5, tshirt:"S", priority:"High", assignee:"Mark T.", creator:"Mark T.", createdAt:"2026-01-14", sprint:"Sprint 2", tags:["security","MFA"], tasks:3, tasksDone:3, ac:["TOTP support","SMS fallback","Recovery codes"] },
  { id:"US-006", epicId:"EP-003", wsId:"ws-ai", title:"As a team member, I want to see live cursors so that I know who is editing", status:"In Progress", points:8, tshirt:"M", priority:"High", assignee:"Priya M.", creator:"Priya M.", createdAt:"2026-01-18", sprint:"Sprint 3", tags:["realtime"], tasks:4, tasksDone:1, ac:["Cursor shows username","Updates <100ms","Fades when idle"] },
  { id:"US-007", epicId:"EP-001", wsId:"ws-ai", title:"As a user, I want context-aware suggestions so that the AI anticipates my needs", status:"Backlog", points:13, tshirt:"XL", priority:"Medium", assignee:null, creator:"Peter V.", createdAt:"2026-01-20", sprint:null, tags:["AI"], tasks:0, tasksDone:0, ac:[] },
  { id:"US-008", epicId:"EP-004", wsId:"ws-o2c", title:"As a sales rep, I want to create sales orders in SAP so that customer orders are processed automatically", status:"To Do", points:8, tshirt:"L", priority:"Critical", assignee:"James L.", creator:"James L.", createdAt:"2026-01-22", sprint:"Sprint 3", tags:["SAP","O2C"], tasks:3, tasksDone:0, ac:["Order created in SAP","Stock checked","Confirmation email sent"] },
];

const DEFECTS_INIT: Defect[] = [
  { id:"DEF-001", storyId:"US-001", wsId:"ws-ai", title:"AI response cuts off at 500 chars in Firefox", severity:"Major", priority:"High", status:"In Progress", assignee:"Dev A.", creator:"QA Team", createdAt:"2026-02-05", environment:"SIT", sprint:"Sprint 3" },
  { id:"DEF-002", storyId:"US-004", wsId:"ws-ai", title:"SSO redirect loop on SAML timeout", severity:"Critical", priority:"Critical", status:"Fixed", assignee:"Mark T.", creator:"QA Team", createdAt:"2026-02-06", environment:"UAT", sprint:"Sprint 3" },
  { id:"DEF-003", storyId:"US-006", wsId:"ws-ai", title:"Cursor ghost remains after user disconnects", severity:"Minor", priority:"Low", status:"New", assignee:null, creator:"Priya M.", createdAt:"2026-02-10", environment:"Dev", sprint:null },
];

const SPRINTS_INIT: Sprint[] = [
  { id:"SP-001", wsId:"ws-ai", name:"Sprint 1", status:"Closed", start:"06 Jan 2026", end:"19 Jan 2026", points:28, done:28, goal:"Core engine scaffolding" },
  { id:"SP-002", wsId:"ws-ai", name:"Sprint 2", status:"Closed", start:"20 Jan 2026", end:"02 Feb 2026", points:32, done:30, goal:"Auth & SSO integration" },
  { id:"SP-003", wsId:"ws-ai", name:"Sprint 3", status:"Active", start:"03 Feb 2026", end:"16 Feb 2026", points:34, done:18, goal:"Streaming + collaboration MVP" },
  { id:"SP-004", wsId:"ws-ai", name:"Sprint 4", status:"Planned", start:"17 Feb 2026", end:"02 Mar 2026", points:21, done:0, goal:"Context suggestions & history" },
];

const BURNDOWN_DATA: BurndownPoint[] = [
  { day:"Day 1", ideal:34, actual:34 }, { day:"Day 2", ideal:31.4, actual:32 },
  { day:"Day 3", ideal:28.8, actual:30 }, { day:"Day 4", ideal:26.1, actual:29 },
  { day:"Day 5", ideal:23.5, actual:26 }, { day:"Day 6", ideal:20.9, actual:24 },
  { day:"Day 7", ideal:18.3, actual:22 }, { day:"Day 8", ideal:15.6, actual:18 },
  { day:"Day 9", ideal:13.0, actual:16 }, { day:"Day 10", ideal:10.4, actual:null },
  { day:"Day 11", ideal:7.8, actual:null }, { day:"Day 12", ideal:5.2, actual:null },
  { day:"Day 13", ideal:2.6, actual:null }, { day:"Day 14", ideal:0, actual:null },
];

const BURNUP_DATA: Record<string, BurnUpPoint[]> = {
  "EP-001": [
    { week:"W1", completed:0, total:12 }, { week:"W2", completed:1, total:12 },
    { week:"W3", completed:2, total:12 }, { week:"W4", completed:3, total:12 },
    { week:"W5", completed:5, total:12 }, { week:"W6", completed:5, total:12 },
  ],
  "EP-002": [
    { week:"W1", completed:0, total:8 }, { week:"W2", completed:2, total:8 },
    { week:"W3", completed:4, total:8 }, { week:"W4", completed:6, total:8 },
    { week:"W5", completed:6, total:8 }, { week:"W6", completed:6, total:8 },
  ],
  "EP-003": [
    { week:"W1", completed:0, total:15 }, { week:"W2", completed:0, total:15 },
    { week:"W3", completed:1, total:15 }, { week:"W4", completed:2, total:15 },
    { week:"W5", completed:2, total:15 }, { week:"W6", completed:2, total:15 },
  ],
};

const BOARD_COLUMNS = ["To Do","In Progress","Review","Testing","Done"];

const AVATAR_COLORS = [C.blue, C.purple, C.teal, C.green, C.amber, C.red, "#0D9488"];
const avatarBg = (n: string | null) => n ? AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length] : C.grey400;
const getInitials = (n: string | null) => n ? n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?";

function AgileAvatar({ name, size=24 }: { name: string | null; size?: number }) {
  return (
    <div title={name||"Unassigned"} style={{ width:size, height:size, borderRadius:"50%", background:avatarBg(name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.38, fontWeight:700, color:C.white, border:`1.5px solid ${C.white}`, flexShrink:0 }}>
      {getInitials(name)}
    </div>
  );
}

function AgileBadge({ label, color=C.grey200, textColor=C.grey700, dot, small }: { label: string; color?: string; textColor?: string; dot?: boolean; small?: boolean }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding: small?"1px 6px":"2px 8px", borderRadius:20, background:color, color:textColor, fontSize:small?10:11, fontWeight:600, whiteSpace:"nowrap" }}>
      {dot && <span style={{ width:5, height:5, borderRadius:"50%", background:textColor, flexShrink:0 }}/>}
      {label}
    </span>
  );
}

function AgileProgressBar({ pct, color=C.blue, height=6 }: { pct: number; color?: string; height?: number }) {
  return (
    <div style={{ height, borderRadius:height, background:C.grey200, overflow:"hidden", flex:1 }}>
      <div style={{ height:"100%", width:`${Math.min(100,pct||0)}%`, background:pct>=100?C.green:color, borderRadius:height, transition:"width 0.5s ease" }}/>
    </div>
  );
}

const priorityColor = (p: string) => ({ Critical:C.red, High:C.amber, Medium:C.blue, Low:C.grey400 } as Record<string,string>)[p]||C.grey400;
const priorityBg = (p: string) => ({ Critical:C.redLight, High:C.amberLight, Medium:C.blueLight, Low:C.grey100 } as Record<string,string>)[p]||C.grey100;
const statusColor = (s: string) => ({ Done:C.green, "In Progress":C.blue, "To Do":C.grey500, Backlog:C.grey400, Review:C.purple, Testing:C.teal, Active:C.green, Planning:C.amber, Closed:C.grey500, Planned:C.teal, Fixed:C.teal, New:C.amber, Triaged:C.blue, Verified:C.green } as Record<string,string>)[s]||C.grey400;
const statusBg = (s: string) => ({ Done:C.greenLight, "In Progress":C.blueLight, "To Do":C.grey100, Backlog:C.grey100, Review:C.purpleLight, Testing:C.tealLight, Active:C.greenLight, Planning:C.amberLight, Closed:C.grey100, Planned:C.tealLight, Fixed:C.tealLight, New:C.amberLight, Triaged:C.blueLight, Verified:C.greenLight } as Record<string,string>)[s]||C.grey100;
const tshirtBg = (t: string) => ({ XS:"#F0FDF4", S:"#DCFCE7", M:"#DBEAFE", L:"#FEF3C7", XL:"#FEE2E2", XXL:"#FCE7F3" } as Record<string,string>)[t]||C.grey100;
const tshirtColor = (t: string) => ({ XS:C.green, S:C.green, M:C.blue, L:C.amber, XL:C.red, XXL:"#9D174D" } as Record<string,string>)[t]||C.grey700;

function AgileBtn({ label, icon, onClick, variant="secondary", small, danger, testId }: { label: string; icon?: string; onClick?: () => void; variant?: string; small?: boolean; danger?: boolean; testId?: string }) {
  const base: React.CSSProperties = { display:"flex", alignItems:"center", gap:5, padding: small?"4px 11px":"6px 14px", borderRadius:6, cursor:"pointer", fontSize:small?11:12, fontWeight:600, border:"none", transition:"all 0.15s", whiteSpace:"nowrap" };
  const styles: Record<string, React.CSSProperties> = {
    primary: { ...base, background:C.blue, color:C.white },
    secondary: { ...base, background:C.white, color:C.grey700, border:`1px solid ${C.grey200}` },
    danger: { ...base, background:C.redLight, color:C.red, border:`1px solid ${C.red}44` },
    ghost: { ...base, background:"transparent", color:C.grey500, border:`1px solid transparent` },
  };
  return <button style={styles[danger?"danger":variant]} onClick={onClick} data-testid={testId}>{icon && <span>{icon}</span>}{label}</button>;
}

function AgileSelect({ value, onChange, options, small, testId }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; small?: boolean; testId?: string }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} data-testid={testId}
      style={{ padding: small?"3px 8px":"5px 10px", borderRadius:6, border:`1px solid ${C.grey200}`, background:C.white, fontSize:small?11:12, color:C.grey700, cursor:"pointer", fontFamily:"inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function AgileModal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.45)" }} onClick={onClose} data-testid={`modal-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div style={{ background:C.white, borderRadius:12, padding:24, width:wide?680:480, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>{title}</span>
          <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", fontSize:22, color:C.grey400, lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.grey500, textTransform:"uppercase", letterSpacing:0.5, marginBottom:5 }}>{label}{required&&<span style={{color:C.red}}> *</span>}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width:"100%", padding:"7px 10px", borderRadius:6, border:`1px solid ${C.grey200}`, fontSize:13, color:C.grey800, fontFamily:"inherit", boxSizing:"border-box" };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize:"vertical", minHeight:80 };

function ConfirmDelete({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AgileModal title="Confirm Delete" onClose={onCancel}>
      <p style={{ color:C.grey600, marginBottom:20 }}>Are you sure you want to delete <strong>{label}</strong>? This action cannot be undone.</p>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-delete"/>
        <AgileBtn label="Delete" danger onClick={onConfirm} testId="button-confirm-delete"/>
      </div>
    </AgileModal>
  );
}

function BurndownChart({ data, title, width: fixedWidth, height=200, sprint }: { data: BurndownPoint[]; title: string; width?: number; height?: number; sprint?: Sprint }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = fixedWidth || 800;
  const pad = { top:16, right:20, bottom:32, left:36 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d => Math.max(d.ideal, d.actual||0)));
  const xs = data.map((_,i) => pad.left + (i/(data.length-1))*W);
  const y = (v: number) => pad.top + H - (v/maxY)*H;
  const idealPath = data.map((d,i)=>`${i===0?"M":"L"}${xs[i]},${y(d.ideal)}`).join(" ");
  const actualPts = data.filter(d=>d.actual!==null);
  const actualPath = actualPts.map((d,i)=>{
    const xi = data.indexOf(d);
    return `${i===0?"M":"L"}${xs[xi]},${y(d.actual!)}`;
  }).join(" ");
  const lastActualIdx = data.reduce((a,d,i)=>d.actual!==null?i:a,-1);

  const committed = sprint?.points || 34;
  const completedPts = sprint?.done || 18;
  const remainingPts = committed - completedPts;
  const trend = remainingPts > (committed * 0.5) ? "Behind" : remainingPts > (committed * 0.2) ? "On Track" : "Ahead";
  const trendColor = trend === "Behind" ? C.red : trend === "Ahead" ? C.green : C.amber;

  return (
    <div ref={containerRef} style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:"12px 16px" }} data-testid="burndown-chart">
      <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:8 }}>{title}</div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet" style={{ display:"block", overflow:"visible" }}>
        {[0,0.25,0.5,0.75,1].map(t=>{
          const yv = pad.top + H*t;
          const val = Math.round(maxY*(1-t));
          return (
            <g key={t}>
              <line x1={pad.left} y1={yv} x2={pad.left+W} y2={yv} stroke={C.grey100} strokeWidth={1}/>
              <text x={pad.left-6} y={yv+4} textAnchor="end" fontSize={9} fill={C.grey400}>{val}</text>
            </g>
          );
        })}
        {data.filter((_,i)=>i%2===0).map((d,_i)=>{
          const idx = data.indexOf(d);
          return <text key={d.day} x={xs[idx]} y={pad.top+H+18} textAnchor="middle" fontSize={9} fill={C.grey400}>{d.day}</text>;
        })}
        {lastActualIdx>=0 && (
          <line x1={xs[lastActualIdx]} y1={pad.top} x2={xs[lastActualIdx]} y2={pad.top+H} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3"/>
        )}
        <path d={idealPath} fill="none" stroke={C.grey300} strokeWidth={2} strokeDasharray="6 3"/>
        {actualPts.length>0 && (
          <path d={actualPath + ` L${xs[lastActualIdx]},${pad.top+H} L${xs[0]},${pad.top+H} Z`} fill={`${C.blue}18`} stroke="none"/>
        )}
        {actualPts.length>0 && <path d={actualPath} fill="none" stroke={C.blue} strokeWidth={2.5}/>}
        {actualPts.map((d,i)=>{
          const xi = data.indexOf(d);
          return <circle key={i} cx={xs[xi]} cy={y(d.actual!)} r={3.5} fill={C.white} stroke={C.blue} strokeWidth={2}/>;
        })}
        <g transform={`translate(${pad.left+W-160},${pad.top})`}>
          <line x1={0} y1={8} x2={16} y2={8} stroke={C.grey300} strokeWidth={2} strokeDasharray="6 3"/>
          <text x={20} y={12} fontSize={9} fill={C.grey500}>Ideal</text>
          <line x1={60} y1={8} x2={76} y2={8} stroke={C.blue} strokeWidth={2.5}/>
          <text x={80} y={12} fontSize={9} fill={C.grey500}>Actual</text>
          <line x1={120} y1={0} x2={120} y2={16} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3"/>
          <text x={124} y={12} fontSize={9} fill={C.grey500}>Today</text>
        </g>
      </svg>
      <div style={{ display:"flex", gap:16, marginTop:8 }}>
        {([["Committed",`${committed} pts`,C.grey700],["Completed",`${completedPts} pts`,C.blue],["Remaining",`${remainingPts} pts`,C.amber],["Trend",trend,trendColor]] as [string,string,string][]).map(([l,v,col])=>(
          <div key={l} style={{ textAlign:"center" }}>
            <div style={{ fontWeight:700, fontSize:13, color:col }}>{v}</div>
            <div style={{ fontSize:10, color:C.grey400 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BurnUpChart({ data, title, color=C.blue, width=320, height=180 }: { data: BurnUpPoint[]; title: string; color?: string; width?: number; height?: number }) {
  if (!data || data.length===0) return null;
  const pad = { top:14, right:16, bottom:28, left:32 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d=>d.total));
  const xs = data.map((_,i) => pad.left + (i/(data.length-1))*W);
  const y = (v: number) => pad.top + H - (v/maxY)*H;
  const scopePath = data.map((d,i)=>`${i===0?"M":"L"}${xs[i]},${y(d.total)}`).join(" ");
  const donePath = data.map((d,i)=>`${i===0?"M":"L"}${xs[i]},${y(d.completed)}`).join(" ");

  return (
    <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:"10px 12px" }}>
      <div style={{ fontWeight:700, fontSize:12, color:C.grey700, marginBottom:6 }}>{title}</div>
      <svg width={width} height={height} style={{ display:"block", overflow:"visible" }}>
        {[0,0.5,1].map(t=>{
          const yv = pad.top+H*t;
          return (
            <g key={t}>
              <line x1={pad.left} y1={yv} x2={pad.left+W} y2={yv} stroke={C.grey100} strokeWidth={1}/>
              <text x={pad.left-5} y={yv+4} textAnchor="end" fontSize={8} fill={C.grey400}>{Math.round(maxY*(1-t))}</text>
            </g>
          );
        })}
        {data.map((d,i)=><text key={d.week} x={xs[i]} y={pad.top+H+16} textAnchor="middle" fontSize={8} fill={C.grey400}>{d.week}</text>)}
        <path d={scopePath} fill="none" stroke={C.grey300} strokeWidth={1.5} strokeDasharray="5 3"/>
        <path d={donePath+` L${xs[xs.length-1]},${pad.top+H} L${xs[0]},${pad.top+H} Z`} fill={`${color}20`} stroke="none"/>
        <path d={donePath} fill="none" stroke={color} strokeWidth={2}/>
        {data.map((d,i)=><circle key={i} cx={xs[i]} cy={y(d.completed)} r={3} fill={C.white} stroke={color} strokeWidth={1.5}/>)}
        <g transform={`translate(${pad.left+W-90},${pad.top})`}>
          <line x1={0} y1={7} x2={12} y2={7} stroke={C.grey300} strokeWidth={1.5} strokeDasharray="4 2"/>
          <text x={15} y={10} fontSize={8} fill={C.grey500}>Scope</text>
          <line x1={50} y1={7} x2={62} y2={7} stroke={color} strokeWidth={2}/>
          <text x={65} y={10} fontSize={8} fill={C.grey500}>Done</text>
        </g>
      </svg>
    </div>
  );
}

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

function BoardView({ stories, epics, onDrop, dragItem, setDragItem, dragOver, setDragOver, activeSprint, onSelectStory, allSprintStories }: {
  stories: Story[]; epics: Epic[]; onDrop: (e: React.DragEvent, col: string) => void; dragItem: string | null;
  setDragItem: (id: string | null) => void; dragOver: string | null; setDragOver: (col: string | null) => void;
  activeSprint: Sprint | undefined; onSelectStory: (s: Story) => void; allSprintStories?: Story[];
}) {
  const [showChart, setShowChart] = useState(true);
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const sprintStories = allSprintStories || stories;
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

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }} data-testid="sprint-board-view">
      <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, margin:"12px 16px 0", padding:"12px 18px", flexShrink:0 }} data-testid="sprint-info-bar">
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:2, marginRight:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>{activeSprint?.name || "Sprint Board"}</span>
              {activeSprint?.status === "Active" && <AgileBadge label="Active" color={C.greenLight} textColor={C.green} dot small />}
            </div>
            {activeSprint && (
              <span style={{ fontSize:11, color:C.grey400 }}>{activeSprint.start} → {activeSprint.end}</span>
            )}
          </div>

          <div style={{ display:"flex", alignItems:"baseline", gap:6, marginLeft:8 }}>
            <span style={{ fontWeight:700, fontSize:18, color:C.grey800 }}>{committed} pts</span>
            <span style={{ fontSize:10, color:C.grey400, textTransform:"uppercase" }}>Committed</span>
          </div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontWeight:700, fontSize:18, color:C.blue }}>{completed} pts</span>
            <span style={{ fontSize:10, color:C.grey400, textTransform:"uppercase" }}>Completed</span>
          </div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontWeight:700, fontSize:18, color:C.amber }}>{remaining} pts</span>
            <span style={{ fontSize:10, color:C.grey400, textTransform:"uppercase" }}>Remaining</span>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:4 }}>
            <span style={{ fontSize:11, color:C.grey500, whiteSpace:"nowrap" }}>Sprint {pctDone}% done</span>
            <div style={{ width:80, height:8, borderRadius:4, background:C.grey200, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pctDone}%`, background:C.blue, borderRadius:4, transition:"width 0.5s" }}/>
            </div>
          </div>

          <div style={{ flex:1 }}/>

          <AgileSelect value={assigneeFilter} onChange={setAssigneeFilter} options={[{value:"All",label:"All Assignees"},...assignees.map(a=>({value:a,label:a}))]} small testId="filter-board-assignee"/>
          <AgileSelect value={priorityFilter} onChange={setPriorityFilter} options={[{value:"All",label:"All Priorities"},{value:"Critical",label:"Critical"},{value:"High",label:"High"},{value:"Medium",label:"Medium"},{value:"Low",label:"Low"}]} small testId="filter-board-priority"/>
          <AgileBtn label={showChart ? "Hide Chart" : "Show Chart"} onClick={() => setShowChart(!showChart)} testId="button-toggle-chart"/>
          {activeSprint?.status === "Active" && <AgileBtn label="Complete Sprint" variant="primary" testId="button-complete-sprint"/>}
        </div>
      </div>

      {showChart && (
        <div style={{ margin:"12px 16px 0" }}>
          <BurndownChart data={BURNDOWN_DATA} title={`Sprint Burndown — ${activeSprint?.name || "Sprint"}`} height={220} sprint={activeSprint}/>
        </div>
      )}

      <div style={{ padding:"12px 16px", flex:1, overflowY:"auto" }}>
        <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:10 }}>
          {BOARD_COLUMNS.map(col => {
            const cols = filtered.filter(s => s.status === col && s.sprint === activeSprint?.name);
            return (
              <div key={col}
                onDragOver={e => { e.preventDefault(); setDragOver(col); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onDrop(e, col)}
                data-testid={`board-column-${col.toLowerCase().replace(/\s+/g, '-')}`}
                style={{ flex:"1 1 0", minWidth:200, background: dragOver===col ? "#EFF6FF" : C.grey50, border:`1.5px solid ${dragOver===col ? C.blue : C.grey200}`, borderRadius:10, display:"flex", flexDirection:"column", transition:"all 0.15s" }}
              >
                <div style={{ padding:"10px 12px", borderBottom:`1px solid ${C.grey200}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:statusColor(col) }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:C.grey700 }}>{col}</span>
                  </div>
                  <span style={{ background:C.grey200, borderRadius:10, padding:"0 6px", fontSize:10, fontWeight:700, color:C.grey500 }}>{cols.length}</span>
                </div>
                <div style={{ padding:8, display:"flex", flexDirection:"column", gap:7, flex:1 }}>
                  {cols.map(s => <BoardCard key={s.id} story={s} epics={epics} onDragStart={id=>setDragItem(id)} onClick={()=>onSelectStory(s)} />)}
                  {cols.length===0 && <div style={{ textAlign:"center", color:C.grey300, fontSize:11, marginTop:24 }}>Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BoardCard({ story, epics, onDragStart, onClick }: { story: Story; epics: Epic[]; onDragStart: (id: string) => void; onClick: () => void }) {
  const epic = epics.find(e=>e.id===story.epicId);
  return (
    <div draggable onDragStart={()=>onDragStart(story.id)} onClick={onClick} data-testid={`board-card-${story.id}`}
      style={{ background:C.white, border:`1.5px solid ${C.grey200}`, borderLeft:`3.5px solid ${epic?.color||C.grey300}`, borderRadius:8, padding:"9px 11px", cursor:"grab", transition:"box-shadow 0.15s" }}
      onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.10)")}
      onMouseLeave={e=>(e.currentTarget.style.boxShadow="none")}>
      <div style={{ fontSize:10, color:C.grey400, marginBottom:3 }}>{story.id}</div>
      <div style={{ fontSize:12.5, fontWeight:600, color:C.grey800, lineHeight:1.4, marginBottom:7 }}>{story.title.length>75?story.title.slice(0,75)+"…":story.title}</div>
      <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
        <AgileBadge label={story.priority} color={priorityBg(story.priority)} textColor={priorityColor(story.priority)} small/>
        <span style={{ background:tshirtBg(story.tshirt), color:tshirtColor(story.tshirt), borderRadius:3, padding:"1px 5px", fontSize:9, fontWeight:700 }}>{story.tshirt}</span>
        {story.points && <span style={{ background:C.grey100, color:C.grey600, borderRadius:3, padding:"1px 5px", fontSize:9, fontWeight:700 }}>{story.points}pt</span>}
        <div style={{ flex:1 }}/>
        <AgileAvatar name={story.assignee} size={20}/>
      </div>
      {story.tasks>0 && (
        <div style={{ marginTop:7, display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:9, color:C.grey400 }}>{story.tasksDone}/{story.tasks} tasks</span>
          <AgileProgressBar pct={(story.tasksDone/story.tasks)*100} color={epic?.color||C.blue} height={3}/>
        </div>
      )}
    </div>
  );
}

function BacklogView({ stories, epics, onSelectStory, sprints, setStories, activeSprint, ws, onAddStory }: {
  stories: Story[]; epics: Epic[]; onSelectStory: (s: Story) => void; sprints: Sprint[];
  setStories: React.Dispatch<React.SetStateAction<Story[]>>; activeSprint: Sprint | undefined; ws: Workstream;
  onAddStory?: (data: any) => void;
}) {
  const [dragId, setDragId] = useState<string|null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [epicFilter, setEpicFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("Backlog");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string|null>(null);

  const filtered = stories.filter(s=>
    (epicFilter==="All"||s.epicId===epicFilter) &&
    (statusFilter==="All"||s.status===statusFilter||(!s.sprint&&statusFilter==="Backlog"))
  );
  const backlogItems = filtered.filter(s=>!s.sprint||s.status==="Backlog");
  const sprintItems = stories.filter(s=>s.sprint===activeSprint?.name);

  function handleDropSprint(e: React.DragEvent) {
    e.preventDefault();
    if (!dragId) return;
    setStories(p=>p.map(s=>s.id===dragId?{...s,sprint:activeSprint?.name||null,status:"To Do"}:s));
    setDragId(null); setDropActive(false);
  }
  function handleAddStory(data: any) {
    if (onAddStory) {
      onAddStory(data);
      setShowAdd(false);
    } else {
      const id = `US-${String(stories.length+1).padStart(3,"0")}`;
      setStories(p=>[...p, { id, wsId:ws.id, epicId:data.epicId, title:data.title, status:"Backlog", points:data.points?Number(data.points):null, tshirt:data.tshirt, priority:data.priority, assignee:data.assignee||null, creator:"Current User", createdAt:new Date().toISOString().slice(0,10), sprint:null, tags:[], tasks:0, tasksDone:0, ac:[] }]);
      setShowAdd(false);
    }
  }
  function handleDelete(id: string) {
    setStories(p=>p.filter(s=>s.id!==id));
    setDeleteId(null);
  }

  return (
    <div style={{ padding:20, display:"flex", gap:16 }}>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          <span style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>Product Backlog</span>
          <AgileBadge label={`${backlogItems.length}`} color={C.blueLight} textColor={C.blue}/>
          <div style={{ flex:1 }}/>
          <AgileSelect value={epicFilter} onChange={setEpicFilter} options={[{value:"All",label:"All Epics"},...epics.map(e=>({value:e.id,label:e.title.slice(0,22)}))]} small testId="filter-backlog-epic"/>
          <AgileSelect value={statusFilter} onChange={setStatusFilter} options={[{value:"All",label:"All Statuses"},{value:"Backlog",label:"Backlog"},{value:"To Do",label:"To Do"},{value:"In Progress",label:"In Progress"}]} small testId="filter-backlog-status"/>
          <AgileBtn label="+ Add Story" variant="primary" onClick={()=>setShowAdd(true)} testId="button-add-story"/>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {backlogItems.map((s,i)=>{
            const epic = epics.find(e=>e.id===s.epicId);
            return (
              <div key={s.id} draggable onDragStart={()=>setDragId(s.id)} data-testid={`backlog-item-${s.id}`}
                style={{ background:C.white, border:`1px solid ${C.grey200}`, borderLeft:`3px solid ${epic?.color||C.grey300}`, borderRadius:8, padding:"9px 14px", cursor:"grab", display:"flex", alignItems:"center", gap:10, transition:"box-shadow 0.12s" }}
                onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.07)")}
                onMouseLeave={e=>(e.currentTarget.style.boxShadow="none")}>
                <span style={{ fontSize:12, color:C.grey300, fontWeight:600, minWidth:22 }}>{i+1}</span>
                <div style={{ flex:1, cursor:"pointer" }} onClick={()=>onSelectStory(s)}>
                  <div style={{ fontSize:10, color:C.grey400 }}>{s.id} {"·"} {epic?.title}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.grey800, lineHeight:1.3 }}>{s.title.length>85?s.title.slice(0,85)+"…":s.title}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                  <AgileBadge label={s.priority} color={priorityBg(s.priority)} textColor={priorityColor(s.priority)} small/>
                  <span style={{ background:tshirtBg(s.tshirt), color:tshirtColor(s.tshirt), borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{s.tshirt}</span>
                  {s.points && <span style={{ background:C.grey100, color:C.grey600, borderRadius:4, padding:"1px 6px", fontSize:10 }}>{s.points}pt</span>}
                  <AgileAvatar name={s.assignee} size={22}/>
                  <AgileBtn label="✎" variant="ghost" small onClick={()=>onSelectStory(s)} testId={`button-edit-${s.id}`}/>
                  <AgileBtn label="✕" danger small onClick={()=>setDeleteId(s.id)} testId={`button-delete-${s.id}`}/>
                </div>
              </div>
            );
          })}
          {backlogItems.length===0 && <div style={{ textAlign:"center", padding:40, color:C.grey300, fontSize:13 }}>No backlog items match filters</div>}
        </div>
      </div>

      <div style={{ width:300, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <span style={{ fontWeight:700, fontSize:14, color:C.grey800 }}>{activeSprint?.name||"No Active Sprint"}</span>
          {activeSprint && <AgileBadge label="Active" color={C.greenLight} textColor={C.green} dot small/>}
        </div>
        <div onDragOver={e=>{e.preventDefault();setDropActive(true);}} onDrop={handleDropSprint} onDragLeave={()=>setDropActive(false)}
          style={{ minHeight:180, background:dropActive?"#EFF6FF":C.grey50, border:`2px dashed ${dropActive?C.blue:C.grey300}`, borderRadius:10, padding:12, transition:"all 0.15s", marginBottom:12 }}>
          <div style={{ textAlign:"center", fontSize:11, color:dropActive?C.blue:C.grey300, fontWeight:600, marginBottom:10 }}>{dropActive?"Drop to add →":"⬅ Drag stories here"}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {sprintItems.map(s=>(
              <div key={s.id} style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:6, padding:"6px 10px", fontSize:11 }}>
                <div style={{ fontWeight:600, color:C.grey700 }}>{s.title.slice(0,55)}{s.title.length>55?"…":""}</div>
                <div style={{ display:"flex", gap:5, marginTop:4, alignItems:"center" }}>
                  <AgileBadge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small/>
                  {s.points && <span style={{ fontSize:9, color:C.grey400 }}>{s.points}pt</span>}
                  <AgileAvatar name={s.assignee} size={16}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:14 }}>
          <div style={{ fontWeight:700, fontSize:12, color:C.grey700, marginBottom:10 }}>Sprint Capacity</div>
          {([["Story Points", sprintItems.reduce((a,s)=>a+(s.points||0),0), activeSprint?.points||34],
            ["Stories", sprintItems.length, 10]] as [string,number,number][]).map(([label,val,cap])=>(
            <div key={label} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.grey500, marginBottom:3 }}>
                <span>{label}</span><span style={{ fontWeight:700 }}>{val} / {cap}</span>
              </div>
              <AgileProgressBar pct={(val/cap)*100} color={val>cap?C.red:C.teal} height={6}/>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <AgileModal title="Add User Story" onClose={()=>setShowAdd(false)}>
          <AddStoryForm epics={epics} onSave={handleAddStory} onCancel={()=>setShowAdd(false)}/>
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={stories.find(s=>s.id===deleteId)?.id||""} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

function AddStoryForm({ epics, onSave, onCancel, initial={} }: { epics: Epic[]; onSave: (d: any) => void; onCancel: () => void; initial?: any }) {
  const [form, setForm] = useState({ title:"", epicId:epics[0]?.id||"", priority:"Medium", tshirt:"M", points:"", assignee:"", ...initial });
  const set = (k: string, v: string) => setForm((p: Record<string, string>)=>({...p,[k]:v}));
  return (
    <div>
      <FormField label="Story Title" required><input style={inputStyle} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="As a [role], I want [goal] so that [benefit]" data-testid="input-story-title"/></FormField>
      <FormField label="Epic" required>
        <select style={inputStyle} value={form.epicId} onChange={e=>set("epicId",e.target.value)}>
          {epics.map(e=><option key={e.id} value={e.id}>{e.id} {"–"} {e.title}</option>)}
        </select>
      </FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        <FormField label="Priority">
          <select style={inputStyle} value={form.priority} onChange={e=>set("priority",e.target.value)}>
            {["Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="T-Shirt Size">
          <select style={inputStyle} value={form.tshirt} onChange={e=>set("tshirt",e.target.value)}>
            {["XS","S","M","L","XL","XXL"].map(t=><option key={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Story Points">
          <input style={inputStyle} type="number" min={1} value={form.points} onChange={e=>set("points",e.target.value)} placeholder="e.g. 5"/>
        </FormField>
      </div>
      <FormField label="Assignee"><input style={inputStyle} value={form.assignee} onChange={e=>set("assignee",e.target.value)} placeholder="Name"/></FormField>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-story"/>
        <AgileBtn label="Save Story" variant="primary" onClick={()=>form.title&&form.epicId&&onSave(form)} testId="button-save-story"/>
      </div>
    </div>
  );
}

function EpicsView({ epics, stories, onSelect, setEpics, ws, onAddEpic }: {
  epics: Epic[]; stories: Story[]; onSelect: (e: Epic) => void;
  setEpics: React.Dispatch<React.SetStateAction<Epic[]>>; ws: Workstream;
  onAddEpic?: (data: any) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editEpic, setEditEpic] = useState<Epic|null>(null);
  const [deleteId, setDeleteId] = useState<string|null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = epics.filter(e=>
    (statusFilter==="All"||e.status===statusFilter) &&
    (search===""||e.title.toLowerCase().includes(search.toLowerCase()))
  );

  function handleSave(data: any) {
    if (editEpic) {
      setEpics(p=>p.map(e=>e.id===editEpic.id?{...e,...data}:e));
    } else if (onAddEpic) {
      onAddEpic(data);
    } else {
      const id=`EP-${String(epics.length+1).padStart(3,"0")}`;
      setEpics(p=>[...p,{id,wsId:ws.id,color:ws.color,stories:0,storiesDone:0,progress:0,tags:[],description:data.description||"",creator:data.creator||"Current User",createdAt:new Date().toISOString().slice(0,10),...data}]);
    }
    setShowAdd(false); setEditEpic(null);
  }
  function handleDelete(id: string) { setEpics(p=>p.filter(e=>e.id!==id)); setDeleteId(null); }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>Epics</span>
        <AgileBadge label={`${filtered.length}`} color={C.blueLight} textColor={C.blue}/>
        <div style={{ flex:1 }}/>
        <input style={{ ...inputStyle, width:200, padding:"5px 10px" }} placeholder="Search epics…" data-testid="input-search-epics" value={search} onChange={e=>setSearch(e.target.value)}/>
        <AgileSelect value={statusFilter} onChange={setStatusFilter} options={[{value:"All",label:"All Statuses"},{value:"Active",label:"Active"},{value:"Planning",label:"Planning"},{value:"Done",label:"Done"}]} small testId="filter-epic-status"/>
        <AgileBtn label="+ New Epic" variant="primary" onClick={()=>setShowAdd(true)} testId="button-add-epic"/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))", gap:16 }}>
        {filtered.map(epic=>{
          const epicStories = stories.filter(s=>s.epicId===epic.id);
          const done = epicStories.filter(s=>s.status==="Done").length;
          const buData = BURNUP_DATA[epic.id];
          return (
            <div key={epic.id} data-testid={`epic-card-${epic.id}`} style={{ background:C.white, border:`1.5px solid ${C.grey200}`, borderTop:`4px solid ${epic.color}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:8 }}>
                  <div style={{ flex:1, cursor:"pointer" }} onClick={()=>onSelect(epic)}>
                    <div style={{ fontSize:11, color:C.grey400 }}>{epic.id} {"·"} {epic.initiative}</div>
                    <div style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>{epic.title}</div>
                  </div>
                  <AgileBadge label={epic.status} color={statusBg(epic.status)} textColor={statusColor(epic.status)} dot small/>
                  <div style={{ display:"flex", gap:4 }}>
                    <AgileBtn label="✎" variant="ghost" small onClick={()=>setEditEpic(epic)} testId={`button-edit-${epic.id}`}/>
                    <AgileBtn label="✕" danger small onClick={()=>setDeleteId(epic.id)} testId={`button-delete-${epic.id}`}/>
                  </div>
                </div>
                <div style={{ fontSize:12.5, color:C.grey500, marginBottom:10, lineHeight:1.5 }}>{epic.description}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                  <AgileBadge label={epic.priority} color={priorityBg(epic.priority)} textColor={priorityColor(epic.priority)} small/>
                  <span style={{ background:tshirtBg(epic.tshirt), color:tshirtColor(epic.tshirt), borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{epic.tshirt}</span>
                  {epic.tags.map(t=><AgileBadge key={t} label={t} color={C.grey100} textColor={C.grey600} small/>)}
                </div>
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.grey400, marginBottom:3 }}>
                    <span>Progress</span><span>{done}/{epicStories.length} stories {"·"} {epic.progress}%</span>
                  </div>
                  <AgileProgressBar pct={epic.progress} color={epic.color} height={6}/>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <AgileAvatar name={epic.owner} size={22}/>
                  <span style={{ fontSize:11, color:C.grey500 }}>{epic.owner}</span>
                </div>
              </div>
              {buData && (
                <div style={{ borderTop:`1px solid ${C.grey100}`, padding:"10px 12px", background:C.grey50 }}>
                  <BurnUpChart data={buData} title="Burn-up (Stories Completed vs Scope)" color={epic.color} width={330} height={150}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(showAdd||editEpic) && (
        <AgileModal title={editEpic?"Edit Epic":"New Epic"} onClose={()=>{setShowAdd(false);setEditEpic(null);}}>
          <EpicForm initial={editEpic||{}} onSave={handleSave} onCancel={()=>{setShowAdd(false);setEditEpic(null);}}/>
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={epics.find(e=>e.id===deleteId)?.title||""} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

function EpicForm({ initial={}, onSave, onCancel }: { initial?: any; onSave: (d: any) => void; onCancel: () => void }) {
  const [form,setForm] = useState({ title:"", initiative:"", owner:"", status:"Planning", tshirt:"L", priority:"High", description:"", ...initial });
  const set=(k: string,v: string)=>setForm((p: Record<string, string>)=>({...p,[k]:v}));
  return (
    <div>
      <FormField label="Epic Title" required><input style={inputStyle} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Customer Order Management" data-testid="input-epic-title"/></FormField>
      <FormField label="Initiative"><input style={inputStyle} value={form.initiative} onChange={e=>set("initiative",e.target.value)} placeholder="e.g. ERP Phase 1"/></FormField>
      <FormField label="Description"><textarea style={textareaStyle as any} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe what this epic delivers…"/></FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
        <FormField label="Status"><select style={inputStyle} value={form.status} onChange={e=>set("status",e.target.value)}>{["Planning","Active","Done","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></FormField>
        <FormField label="T-Shirt"><select style={inputStyle} value={form.tshirt} onChange={e=>set("tshirt",e.target.value)}>{["XS","S","M","L","XL","XXL"].map(t=><option key={t}>{t}</option>)}</select></FormField>
        <FormField label="Priority"><select style={inputStyle} value={form.priority} onChange={e=>set("priority",e.target.value)}>{["Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}</select></FormField>
        <FormField label="Owner"><input style={inputStyle} value={form.owner} onChange={e=>set("owner",e.target.value)} placeholder="Name"/></FormField>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-epic"/><AgileBtn label="Save Epic" variant="primary" onClick={()=>form.title&&onSave(form)} testId="button-save-epic"/>
      </div>
    </div>
  );
}

function StoriesView({ stories, epics, onSelect, setStories, ws, onAddStory }: {
  stories: Story[]; epics: Epic[]; onSelect: (s: Story) => void;
  setStories: React.Dispatch<React.SetStateAction<Story[]>>; ws: Workstream;
  onAddStory?: (data: any) => void;
}) {
  const [epicFilter, setEpicFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string|null>(null);

  const filtered = stories.filter(s=>
    (epicFilter==="All"||s.epicId===epicFilter) &&
    (statusFilter==="All"||s.status===statusFilter) &&
    (search===""||s.title.toLowerCase().includes(search.toLowerCase())||s.id.toLowerCase().includes(search.toLowerCase()))
  );

  function handleAdd(data: any) {
    if (onAddStory) {
      onAddStory(data);
      setShowAdd(false);
    } else {
      const id=`US-${String(stories.length+1).padStart(3,"0")}`;
      setStories(p=>[...p,{id,wsId:ws.id,epicId:data.epicId,title:data.title,status:"Backlog",points:data.points?Number(data.points):null,tshirt:data.tshirt,priority:data.priority,assignee:data.assignee||null,creator:"Current User",createdAt:new Date().toISOString().slice(0,10),sprint:null,tags:[],tasks:0,tasksDone:0,ac:[]}]);
      setShowAdd(false);
    }
  }
  function handleDelete(id: string) { setStories(p=>p.filter(s=>s.id!==id)); setDeleteId(null); }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>User Stories</span>
        <AgileBadge label={`${filtered.length}`} color={C.blueLight} textColor={C.blue}/>
        <div style={{ flex:1 }}/>
        <input style={{ ...inputStyle, width:180, padding:"5px 10px" }} placeholder="Search…" data-testid="input-search-stories" value={search} onChange={e=>setSearch(e.target.value)}/>
        <AgileSelect value={epicFilter} onChange={setEpicFilter} options={[{value:"All",label:"All Epics"},...epics.map(e=>({value:e.id,label:`${e.id} ${e.title.slice(0,18)}`}))]} small testId="filter-story-epic"/>
        <AgileSelect value={statusFilter} onChange={setStatusFilter} options={[{value:"All",label:"All Statuses"},{value:"Backlog",label:"Backlog"},{value:"To Do",label:"To Do"},{value:"In Progress",label:"In Progress"},{value:"Done",label:"Done"}]} small testId="filter-story-status"/>
        <AgileBtn label="+ New Story" variant="primary" onClick={()=>setShowAdd(true)} testId="button-add-story-list"/>
      </div>

      <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 90px 60px 90px 90px 44px 60px", padding:"8px 14px", background:C.grey50, borderBottom:`1px solid ${C.grey200}`, fontSize:10, fontWeight:700, color:C.grey500, gap:10 }}>
          <span>Story</span><span>Epic</span><span>Status</span><span>Pts</span><span>Priority</span><span>Sprint</span><span>Owner</span><span>Actions</span>
        </div>
        {filtered.map((s,i)=>{
          const epic=epics.find(e=>e.id===s.epicId);
          return (
            <div key={s.id} data-testid={`story-row-${s.id}`} style={{ display:"grid", gridTemplateColumns:"1fr 110px 90px 60px 90px 90px 44px 60px", padding:"9px 14px", borderBottom:i<filtered.length-1?`1px solid ${C.grey100}`:"none", alignItems:"center", gap:10, transition:"background 0.1s" }}
              onMouseEnter={e=>(e.currentTarget.style.background=C.grey50)}
              onMouseLeave={e=>(e.currentTarget.style.background="")}>
              <div style={{ cursor:"pointer" }} onClick={()=>onSelect(s)}>
                <div style={{ fontSize:10, color:C.grey400 }}>{s.id}</div>
                <div style={{ fontSize:13, fontWeight:500, color:C.grey800 }}>{s.title.length>65?s.title.slice(0,65)+"…":s.title}</div>
              </div>
              <div style={{ fontSize:11, color:epic?.color||C.grey500, fontWeight:600 }}>{epic?.title?.split(" ").slice(0,2).join(" ")}</div>
              <AgileBadge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small/>
              <span style={{ fontWeight:700, fontSize:12, color:C.grey700 }}>{s.points||<span style={{color:C.grey300}}>{"—"}</span>}</span>
              <AgileBadge label={s.priority} color={priorityBg(s.priority)} textColor={priorityColor(s.priority)} small/>
              <span style={{ fontSize:11, color:C.grey500 }}>{s.sprint||<span style={{color:C.grey300}}>{"—"}</span>}</span>
              <AgileAvatar name={s.assignee} size={22}/>
              <div style={{ display:"flex", gap:3 }}>
                <AgileBtn label="✎" variant="ghost" small onClick={()=>onSelect(s)} testId={`button-edit-${s.id}`}/>
                <AgileBtn label="✕" danger small onClick={()=>setDeleteId(s.id)} testId={`button-delete-${s.id}`}/>
              </div>
            </div>
          );
        })}
        {filtered.length===0 && <div style={{ padding:40, textAlign:"center", color:C.grey300, fontSize:13 }}>No stories found</div>}
      </div>

      {showAdd && (
        <AgileModal title="Add User Story" onClose={()=>setShowAdd(false)}>
          <AddStoryForm epics={epics} onSave={handleAdd} onCancel={()=>setShowAdd(false)}/>
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={stories.find(s=>s.id===deleteId)?.id||""} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

function SprintsView({ sprints, stories, setSprints, ws, onAddSprint }: {
  sprints: Sprint[]; stories: Story[];
  setSprints: React.Dispatch<React.SetStateAction<Sprint[]>>; ws: Workstream;
  onAddSprint?: (data: any) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  function handleAdd(data: any) {
    if (onAddSprint) {
      onAddSprint(data);
      setShowAdd(false);
    } else {
      const id = `SP-${String(sprints.length+1).padStart(3,"0")}`;
      setSprints(p=>[...p, { id, wsId:ws.id, name:data.name, status:"Planned", start:data.start, end:data.end, points:Number(data.points)||0, done:0, goal:data.goal }]);
      setShowAdd(false);
    }
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>Sprint Management</span>
        <AgileBadge label={`${sprints.length}`} color={C.blueLight} textColor={C.blue}/>
        <div style={{ flex:1 }}/>
        <AgileBtn label="+ New Sprint" variant="primary" onClick={()=>setShowAdd(true)} testId="button-add-sprint"/>
      </div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        {sprints.map(sp=>{
          const spStories = stories.filter(s=>s.sprint===sp.name);
          const pct = sp.points ? (sp.done/sp.points)*100 : 0;
          return (
            <div key={sp.id} data-testid={`sprint-card-${sp.id}`} style={{ flex:"1 1 220px", background:C.white, border:`1.5px solid ${statusColor(sp.status)}33`, borderTop:`4px solid ${statusColor(sp.status)}`, borderRadius:10, padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>{sp.name}</span>
                <AgileBadge label={sp.status} color={statusBg(sp.status)} textColor={statusColor(sp.status)} dot small/>
              </div>
              {sp.goal && <div style={{ fontSize:12, color:C.grey500, marginBottom:8, fontStyle:"italic" }}>{sp.goal}</div>}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:10, color:C.grey400 }}>Dates</div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.grey700 }}>{sp.start} - {sp.end}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:C.grey400 }}>Points</div>
                  <div style={{ fontSize:18, fontWeight:800, color:statusColor(sp.status) }}>{sp.done}/{sp.points}</div>
                </div>
              </div>
              <AgileProgressBar pct={pct} color={statusColor(sp.status)} height={6}/>
              <div style={{ fontSize:10, color:C.grey400, marginTop:6 }}>{spStories.length} stories assigned</div>
            </div>
          );
        })}
      </div>

      <BurndownChart data={BURNDOWN_DATA} title="Sprint 3 — Burndown Chart" width={600} height={220}/>

      {showAdd && (
        <AgileModal title="New Sprint" onClose={()=>setShowAdd(false)}>
          <SprintForm onSave={handleAdd} onCancel={()=>setShowAdd(false)}/>
        </AgileModal>
      )}
    </div>
  );
}

function SprintForm({ onSave, onCancel }: { onSave: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name:"", start:"", end:"", points:"", goal:"" });
  const set = (k: string, v: string) => setForm(p=>({...p,[k]:v}));
  return (
    <div>
      <FormField label="Sprint Name" required><input style={inputStyle} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Sprint 5" data-testid="input-sprint-name"/></FormField>
      <FormField label="Sprint Goal"><input style={inputStyle} value={form.goal} onChange={e=>set("goal",e.target.value)} placeholder="What will this sprint deliver?"/></FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        <FormField label="Start Date"><input style={inputStyle} value={form.start} onChange={e=>set("start",e.target.value)} placeholder="e.g. 17 Feb 2026"/></FormField>
        <FormField label="End Date"><input style={inputStyle} value={form.end} onChange={e=>set("end",e.target.value)} placeholder="e.g. 02 Mar 2026"/></FormField>
        <FormField label="Capacity (Points)"><input style={inputStyle} type="number" value={form.points} onChange={e=>set("points",e.target.value)} placeholder="e.g. 30"/></FormField>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-sprint"/><AgileBtn label="Create Sprint" variant="primary" onClick={()=>form.name&&onSave(form)} testId="button-save-sprint"/>
      </div>
    </div>
  );
}

function DefectsView({ defects, stories, setDefects, ws, onAddDefect }: {
  defects: Defect[]; stories: Story[];
  setDefects: React.Dispatch<React.SetStateAction<Defect[]>>; ws: Workstream;
  onAddDefect?: (data: any) => void;
}) {
  const [sevFilter, setSevFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string|null>(null);

  const filtered = defects.filter(d=>
    (sevFilter==="All"||d.severity===sevFilter) &&
    (statusFilter==="All"||d.status===statusFilter)
  );

  const sevColor = (s: string) => ({ Critical:C.red, Major:C.amber, Minor:C.blue, Trivial:C.grey400 } as Record<string,string>)[s]||C.grey400;
  const sevBg = (s: string) => ({ Critical:C.redLight, Major:C.amberLight, Minor:C.blueLight, Trivial:C.grey100 } as Record<string,string>)[s]||C.grey100;
  const envColor = (e: string) => ({ Dev:C.blue, SIT:C.purple, UAT:C.amber, Prod:C.red } as Record<string,string>)[e]||C.grey500;

  function handleAdd(data: any) {
    if (onAddDefect) {
      onAddDefect(data);
      setShowAdd(false);
    } else {
      const id = `DEF-${String(defects.length+1).padStart(3,"0")}`;
      setDefects(p=>[...p, { id, wsId:ws.id, storyId:data.storyId, title:data.title, severity:data.severity, priority:data.priority, status:"New", assignee:data.assignee||null, creator:"Current User", createdAt:new Date().toISOString().slice(0,10), environment:data.environment, sprint:null }]);
      setShowAdd(false);
    }
  }
  function handleDelete(id: string) { setDefects(p=>p.filter(d=>d.id!==id)); setDeleteId(null); }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>Defects</span>
        <AgileBadge label={`${filtered.length}`} color={C.redLight} textColor={C.red}/>
        <div style={{ flex:1 }}/>
        <AgileSelect value={sevFilter} onChange={setSevFilter} options={[{value:"All",label:"All Severities"},{value:"Critical",label:"Critical"},{value:"Major",label:"Major"},{value:"Minor",label:"Minor"}]} small testId="filter-defect-severity"/>
        <AgileSelect value={statusFilter} onChange={setStatusFilter} options={[{value:"All",label:"All Statuses"},{value:"New",label:"New"},{value:"In Progress",label:"In Progress"},{value:"Fixed",label:"Fixed"},{value:"Verified",label:"Verified"}]} small testId="filter-defect-status"/>
        <AgileBtn label="+ Raise Defect" variant="primary" onClick={()=>setShowAdd(true)} testId="button-add-defect"/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
        {([["Total",defects.length,C.grey700,C.grey100],["Critical",defects.filter(d=>d.severity==="Critical").length,C.red,C.redLight],["Major",defects.filter(d=>d.severity==="Major").length,C.amber,C.amberLight],["Open",defects.filter(d=>!["Fixed","Verified","Closed"].includes(d.status)).length,C.blue,C.blueLight]] as [string,number,string,string][]).map(([l,v,c,bg])=>(
          <div key={l} style={{ background:bg, borderRadius:8, padding:"12px 0", textAlign:"center" }}>
            <div style={{ fontWeight:800, fontSize:22, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:C.grey500 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 90px 80px 110px 60px 50px 70px", padding:"8px 14px", background:C.grey50, borderBottom:`1px solid ${C.grey200}`, fontSize:10, fontWeight:700, color:C.grey500, gap:10 }}>
          <span>Defect</span><span>Story</span><span>Severity</span><span>Priority</span><span>Status</span><span>Env</span><span>Owner</span><span>Actions</span>
        </div>
        {filtered.map((d,i)=>(
          <div key={d.id} data-testid={`defect-row-${d.id}`} style={{ display:"grid", gridTemplateColumns:"1fr 100px 90px 80px 110px 60px 50px 70px", padding:"10px 14px", borderBottom:i<filtered.length-1?`1px solid ${C.grey100}`:"none", alignItems:"center", gap:10 }}
            onMouseEnter={e=>(e.currentTarget.style.background=C.grey50)}
            onMouseLeave={e=>(e.currentTarget.style.background="")}>
            <div>
              <div style={{ fontSize:10, color:C.red, fontWeight:600 }}>{d.id}</div>
              <div style={{ fontSize:13, fontWeight:500, color:C.grey800 }}>{d.title}</div>
            </div>
            <span style={{ fontSize:11, color:C.grey500 }}>{d.storyId||"—"}</span>
            <AgileBadge label={d.severity} color={sevBg(d.severity)} textColor={sevColor(d.severity)} small dot/>
            <AgileBadge label={d.priority} color={priorityBg(d.priority)} textColor={priorityColor(d.priority)} small/>
            <AgileBadge label={d.status} color={statusBg(d.status)} textColor={statusColor(d.status)} dot small/>
            <span style={{ fontSize:11, fontWeight:700, color:envColor(d.environment) }}>{d.environment}</span>
            <AgileAvatar name={d.assignee} size={22}/>
            <div style={{ display:"flex", gap:3 }}>
              <AgileBtn label="✎" variant="ghost" small testId={`button-edit-${d.id}`}/>
              <AgileBtn label="✕" danger small onClick={()=>setDeleteId(d.id)} testId={`button-delete-${d.id}`}/>
            </div>
          </div>
        ))}
        {filtered.length===0 && <div style={{ padding:40, textAlign:"center", color:C.grey300, fontSize:13 }}>No defects found</div>}
      </div>

      {showAdd && (
        <AgileModal title="Raise Defect" onClose={()=>setShowAdd(false)}>
          <DefectForm stories={stories} onSave={handleAdd} onCancel={()=>setShowAdd(false)}/>
        </AgileModal>
      )}
      {deleteId && <ConfirmDelete label={defects.find(d=>d.id===deleteId)?.id||""} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

function DefectForm({ stories, onSave, onCancel }: { stories: Story[]; onSave: (d: any) => void; onCancel: () => void }) {
  const [form,setForm]=useState({ title:"", storyId:"", severity:"Major", priority:"High", environment:"Dev", assignee:"" });
  const set=(k: string,v: string)=>setForm(p=>({...p,[k]:v}));
  return (
    <div>
      <FormField label="Defect Title" required><input style={inputStyle} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Briefly describe the defect" data-testid="input-defect-title"/></FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <FormField label="Linked Story">
          <select style={inputStyle} value={form.storyId} onChange={e=>set("storyId",e.target.value)}>
            <option value="">{"—"} None {"—"}</option>
            {stories.map(s=><option key={s.id} value={s.id}>{s.id}</option>)}
          </select>
        </FormField>
        <FormField label="Environment">
          <select style={inputStyle} value={form.environment} onChange={e=>set("environment",e.target.value)}>
            {["Dev","SIT","UAT","Prod"].map(e=><option key={e}>{e}</option>)}
          </select>
        </FormField>
        <FormField label="Severity">
          <select style={inputStyle} value={form.severity} onChange={e=>set("severity",e.target.value)}>
            {["Critical","Major","Minor","Trivial"].map(s=><option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select style={inputStyle} value={form.priority} onChange={e=>set("priority",e.target.value)}>
            {["Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Assignee"><input style={inputStyle} value={form.assignee} onChange={e=>set("assignee",e.target.value)} placeholder="Name"/></FormField>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-defect"/><AgileBtn label="Raise Defect" variant="primary" onClick={()=>form.title&&onSave(form)} testId="button-save-defect"/>
      </div>
    </div>
  );
}

function RoadmapView({ epics, sprints }: { epics: Epic[]; sprints: Sprint[] }) {
  const months=["Jan 26","Feb 26","Mar 26","Apr 26","May 26","Jun 26","Jul 26","Aug 26","Sep 26","Oct 26"];
  const epicTimelines: Record<string, {start:number;width:number}> = { "EP-001":{start:0,width:4}, "EP-002":{start:0,width:2}, "EP-003":{start:2,width:5}, "EP-004":{start:1,width:4}, "EP-005":{start:3,width:4} };
  return (
    <div style={{ padding:20 }}>
      <div style={{ fontWeight:700, fontSize:16, color:C.grey800, marginBottom:16 }}>Epic Roadmap</div>
      <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, overflow:"hidden", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:`190px repeat(${months.length},1fr)`, borderBottom:`1px solid ${C.grey200}` }}>
          <div style={{ padding:"8px 14px", background:C.grey50, fontSize:10, fontWeight:700, color:C.grey500 }}>EPIC</div>
          {months.map(m=><div key={m} style={{ padding:"8px 4px", background:C.grey50, fontSize:10, fontWeight:600, color:C.grey500, textAlign:"center", borderLeft:`1px solid ${C.grey200}` }}>{m}</div>)}
        </div>
        {epics.map(epic=>{
          const tl=epicTimelines[epic.id]||{start:0,width:2};
          return (
            <div key={epic.id} style={{ display:"grid", gridTemplateColumns:`190px repeat(${months.length},1fr)`, borderBottom:`1px solid ${C.grey100}` }}>
              <div style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:epic.color, flexShrink:0 }}/>
                <div>
                  <div style={{ fontSize:10, color:C.grey400 }}>{epic.id}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.grey800 }}>{epic.title.slice(0,20)}{epic.title.length>20?"…":""}</div>
                </div>
              </div>
              {months.map((_,mi)=>{
                const inRange=mi>=tl.start&&mi<tl.start+tl.width;
                const isStart=mi===tl.start, isEnd=mi===tl.start+tl.width-1;
                return (
                  <div key={mi} style={{ borderLeft:`1px solid ${C.grey100}`, padding:"6px 2px", display:"flex", alignItems:"center" }}>
                    {inRange && <div style={{ width:"100%", height:26, background:epic.color, opacity:0.85, borderRadius:`${isStart?"6px":"0"} ${isEnd?"6px":"0"} ${isEnd?"6px":"0"} ${isStart?"6px":"0"}`, display:"flex", alignItems:"center" }}>
                      {isStart && <span style={{ fontSize:9, color:C.white, fontWeight:700, paddingLeft:6 }}>{epic.tshirt}</span>}
                    </div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ fontWeight:700, fontSize:15, color:C.grey800, marginBottom:12 }}>Sprint Calendar</div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {sprints.map(sp=>(
          <div key={sp.id} style={{ flex:"1 1 160px", background:C.white, border:`1.5px solid ${statusColor(sp.status)}33`, borderTop:`4px solid ${statusColor(sp.status)}`, borderRadius:10, padding:14, textAlign:"center" }}>
            <div style={{ fontWeight:700, fontSize:14, color:C.grey800 }}>{sp.name}</div>
            <AgileBadge label={sp.status} color={statusBg(sp.status)} textColor={statusColor(sp.status)} dot small/>
            <div style={{ fontSize:11, color:C.grey400, margin:"6px 0" }}>{sp.start}<br/>{sp.end}</div>
            <div style={{ fontWeight:700, fontSize:20, color:statusColor(sp.status) }}>{sp.done}/{sp.points}</div>
            <div style={{ fontSize:10, color:C.grey400, marginBottom:6 }}>pts done</div>
            <AgileProgressBar pct={sp.points?(sp.done/sp.points)*100:0} color={statusColor(sp.status)} height={5}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function BestPracticeView() {
  const [activeSection, setActiveSection] = useState("overview");
  const sections = [
    { id:"overview", title:"Overview" },
    { id:"epics", title:"Writing Great Epics" },
    { id:"stories", title:"User Story Best Practice" },
    { id:"backlog", title:"Backlog Refinement" },
    { id:"sprint", title:"Sprint Ceremonies" },
    { id:"board", title:"Running the Board" },
    { id:"burndown", title:"Reading Burndown Charts" },
    { id:"defects", title:"Defect Management" },
    { id:"workstream", title:"Multi-Workstream at Scale" },
    { id:"dod", title:"Definition of Done" },
  ];

  const content: Record<string, { title: string; intro: string; blocks: any[] }> = {
    overview: {
      title:"Jiganto Agile Board — How to Get the Best Out of It",
      intro:"Jiganto's Agile Board is designed to give you full traceability from a strategic objective all the way through to delivered code in production. This guide will help your team adopt it quickly and run high-quality Scrum ceremonies from day one.",
      blocks:[
        { heading:"The Golden Rule", type:"highlight", text:"Every item in the board must link upward to an Epic → Initiative → Strategic Objective. If you can't explain why a story exists in terms of business value, it shouldn't be in the backlog." },
        { heading:"The Hierarchy at a Glance", type:"chain", items:["Strategic Objective / OKR","Initiative","Epic","Feature (optional)","User Story (PBI)","Task / Sub-Task","Defect"] },
        { heading:"T-Shirt Sizing vs Story Points", type:"tip", text:"T-shirt sizes (XS → XXL) are great for quick relative sizing. Story points give precision for velocity tracking. Use both: T-shirt for epics and features, story points for sprint stories." },
        { heading:"Quick-Start Checklist", type:"checklist", items:["Set up your Workstreams before creating Epics","Create at least one Epic per Initiative","Write all User Stories in the 'As a… I want… So that…' format","Add Acceptance Criteria before a story enters a sprint","Run Backlog Refinement mid-sprint","Assign a Scrum Master to each active Workstream","Use the Burndown chart daily"] },
      ]
    },
    epics: {
      title:"Writing Great Epics",
      intro:"An Epic is a large, outcomes-focused body of work. It should describe a business capability or customer outcome — not a technical task.",
      blocks:[
        { heading:"The Epic Formula", type:"formula", text:'"We need to build [capability] so that [business outcome], which we will know is successful when [measurable result]."' },
        { heading:"Good vs Bad Epics", type:"table", rows:[["Bad Epic","Good Epic"],["Implement SAP","Enable Sales Reps to Create and Track Orders End-to-End"],["Fix the login","Deliver Secure, SSO for All Enterprise Users"],["Build reports","Give Portfolio Managers Real-Time Initiative Progress Visibility"]] },
      ]
    },
    stories: {
      title:"User Story Best Practice",
      intro:"A User Story is the atomic unit of delivery. It represents one piece of user value that can be built, tested, and demonstrated within a single sprint.",
      blocks:[
        { heading:"The Standard Format", type:"formula", text:'"As a [specific role], I want [clear goal] so that [tangible benefit]."' },
        { heading:"INVEST Criteria", type:"table", rows:[["Letter","Quality","What it means"],["I","Independent","Can be developed and tested without waiting for another story"],["N","Negotiable","Scope is flexible; acceptance criteria pin down the detail"],["V","Valuable","Delivers something a user or stakeholder can recognise"],["E","Estimable","Small enough that the team can size it"],["S","Small","Fits entirely within one sprint"],["T","Testable","Acceptance criteria are clear and unambiguous"]] },
      ]
    },
    backlog: {
      title:"Backlog Refinement",
      intro:"Refinement is not a one-off activity. Run it mid-sprint, weekly, as an ongoing team habit.",
      blocks:[
        { heading:"When to Refine", type:"tip", text:"Hold a 60–90 minute refinement session mid-sprint. Goal: ensure top 2 sprints’ worth of stories are estimated, have AC, and are dependency-checked." },
        { heading:"Refinement Checklist", type:"checklist", items:["Title in user story format","Linked to an Epic","Acceptance Criteria added (minimum 2)","Dependencies identified","Estimated (points or T-shirt)","Small enough for one sprint","Assignee suggested"] },
      ]
    },
    sprint: {
      title:"Running Effective Sprint Ceremonies",
      intro:"Four ceremonies make Scrum work. Each has a specific purpose.",
      blocks:[
        { heading:"Sprint Planning", type:"table", rows:[["Aspect","Guidance"],["Duration","2 hours per sprint week"],["Input","Refined backlog; team capacity; velocity"],["Output","Sprint backlog committed; sprint goal set"]] },
        { heading:"Daily Stand-Up (15 mins max)", type:"checklist", items:["What did I complete yesterday?","What will I work on today?","What is blocking me?","Review the Sprint Board together","Surface blockers immediately"] },
      ]
    },
    board: {
      title:"Running the Scrum Board Like a Pro",
      intro:"The board is a live radiator of sprint health. It should reflect reality at all times.",
      blocks:[
        { heading:"WIP Limits Matter", type:"highlight", text:"Work-in-Progress limits are not bureaucracy — they are a flow mechanism. Aim for WIP ≤ team size." },
        { heading:"Column Discipline", type:"table", rows:[["Column","Entry Criteria","Exit Criteria"],["To Do","Story in sprint","Dev picks it up"],["In Progress","Dev coding","PR raised"],["Review","PR raised","PR approved"],["Testing","In QA","All AC verified"],["Done","All AC met","Sprint review demonstrated"]] },
      ]
    },
    burndown: {
      title:"Reading Burndown Charts",
      intro:"The burndown chart is one of the most powerful tools in a Scrum Master’s kit.",
      blocks:[
        { heading:"Common Patterns", type:"table", rows:[["Pattern","What it means","Action"],["Flat for 3+ days","Stories blocked","Investigate blockers"],["Sharp drop Day 1","Stories too small","Re-examine sizing"],["Actual above ideal","Over-committed","Reduce next sprint"],["Cliff-drop last 2 days","Hero mode","Coach incremental completion"]] },
      ]
    },
    defects: {
      title:"Defect Management Best Practice",
      intro:"Defects are first-class backlog items that compete for sprint capacity.",
      blocks:[
        { heading:"The Defect Lifecycle", type:"chain", items:["New (raised)","Triaged","In Progress","Fixed","Verified","Closed"] },
        { heading:"SLA Guidelines", type:"table", rows:[["Severity","Fix SLA","Board Action"],["Critical","Same sprint, ASAP","Pull existing story out"],["Major","Current sprint","Add at next stand-up"],["Minor","Next sprint","Prioritise at refinement"],["Trivial","Backlog","Label and park"]] },
      ]
    },
    workstream: {
      title:"Managing Multiple Workstreams at Scale",
      intro:"For large enterprise programmes, Jiganto’s workstream model allows parallel delivery without losing visibility.",
      blocks:[
        { heading:"When to Create a Workstream", type:"tip", text:"Create a separate workstream when: the team is distinct, the backlog is distinct, or the delivery cadence differs." },
        { heading:"Stand-Up Structure", type:"table", rows:[["Team Size","Structure"],["Up to 8","Single stand-up, 15 mins"],["8–20","Per-workstream + weekly Scrum of Scrums"],["20+","Per-workstream + daily Scrum of Scrums"],["SAP programme","Per-process-area + integration stand-up"]] },
      ]
    },
    dod: {
      title:"Definition of Done — Your Quality Gate",
      intro:"The Definition of Done (DoD) is a shared agreement on what ‘Done’ really means.",
      blocks:[
        { heading:"Story DoD", type:"checklist", items:["All AC checked off","Unit tests passing","Code reviewed & merged","Integration tested","No open Critical/Major defects","PO accepted","Board card moved to Done","Epic progress updated"] },
        { heading:"Sprint DoD", type:"checklist", items:["All committed stories Done","Burndown reaches zero","Sprint Review completed","Retrospective held","Velocity recorded","Defect count reviewed","Release notes updated"] },
      ]
    },
  };

  const renderBlock = (block: any, i: number) => {
    switch (block.type) {
      case "highlight":
        return <div key={i} style={{ background:`${C.amber}0D`, border:`1.5px solid ${C.amber}33`, borderLeft:`4px solid ${C.amber}`, borderRadius:8, padding:"12px 16px", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.grey800, marginBottom:4 }}>{block.heading}</div>
          <div style={{ fontSize:12.5, color:C.grey600, lineHeight:1.6 }}>{block.text}</div>
        </div>;
      case "tip":
        return <div key={i} style={{ background:`${C.blue}0A`, border:`1.5px solid ${C.blue}22`, borderLeft:`4px solid ${C.blue}`, borderRadius:8, padding:"12px 16px", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.grey800, marginBottom:4 }}>{block.heading}</div>
          <div style={{ fontSize:12.5, color:C.grey600, lineHeight:1.6 }}>{block.text}</div>
        </div>;
      case "formula":
        return <div key={i} style={{ background:C.grey50, border:`1.5px solid ${C.grey200}`, borderRadius:8, padding:"16px 20px", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.grey800, marginBottom:8 }}>{block.heading}</div>
          <div style={{ fontSize:14, color:C.blue, fontWeight:600, fontStyle:"italic", lineHeight:1.6 }}>{block.text}</div>
        </div>;
      case "chain":
        return <div key={i} style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.grey800, marginBottom:8 }}>{block.heading}</div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
            {block.items.map((item: string, j: number)=>(
              <span key={j} style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                <span style={{ background:C.blueLight, color:C.blue, padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:600 }}>{item}</span>
                {j<block.items.length-1 && <span style={{ color:C.grey300, fontSize:14 }}>{"→"}</span>}
              </span>
            ))}
          </div>
        </div>;
      case "checklist":
        return <div key={i} style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.grey800, marginBottom:8 }}>{block.heading}</div>
          {block.items.map((item: string, j: number)=>(
            <div key={j} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:6 }}>
              <span style={{ color:C.green, fontSize:14, marginTop:1 }}>{"✓"}</span>
              <span style={{ fontSize:12.5, color:C.grey600, lineHeight:1.5 }}>{item}</span>
            </div>
          ))}
        </div>;
      case "table":
        return <div key={i} style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.grey800, marginBottom:8 }}>{block.heading}</div>
          <div style={{ border:`1px solid ${C.grey200}`, borderRadius:8, overflow:"hidden" }}>
            {block.rows.map((row: string[], ri: number)=>(
              <div key={ri} style={{ display:"grid", gridTemplateColumns:`repeat(${row.length},1fr)`, padding:"7px 12px", background:ri===0?C.grey50:"", borderBottom:ri<block.rows.length-1?`1px solid ${C.grey100}`:"none", fontSize:ri===0?10:12, fontWeight:ri===0?700:400, color:ri===0?C.grey500:C.grey700, gap:8 }}>
                {row.map((cell,ci)=><span key={ci}>{cell}</span>)}
              </div>
            ))}
          </div>
        </div>;
      default: return null;
    }
  };

  const currentContent = content[activeSection] || content.overview;

  return (
    <div style={{ display:"flex", height:"100%" }}>
      <div style={{ width:240, borderRight:`1px solid ${C.grey200}`, background:C.grey50, padding:"16px 0", overflowY:"auto", flexShrink:0 }}>
        {sections.map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)} data-testid={`bp-nav-${s.id}`}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", width:"100%", border:"none", background:activeSection===s.id?C.white:"transparent", borderRight:activeSection===s.id?`3px solid ${C.blue}`:"3px solid transparent", cursor:"pointer", fontSize:13, color:activeSection===s.id?C.blue:C.grey600, fontWeight:activeSection===s.id?700:500, transition:"all 0.15s", textAlign:"left" }}>
            {s.title}
          </button>
        ))}
      </div>
      <div style={{ flex:1, padding:24, overflowY:"auto" }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.grey800, marginBottom:8 }}>{currentContent.title}</h2>
        <p style={{ fontSize:13, color:C.grey500, lineHeight:1.7, marginBottom:20 }}>{currentContent.intro}</p>
        {currentContent.blocks.map((block, i) => renderBlock(block, i))}
      </div>
    </div>
  );
}

function EpicDetailPanel({ epic, stories, onClose, onEdit }: { epic: Epic; stories: Story[]; onClose: () => void; onEdit: () => void }) {
  const epicStories = stories.filter(s=>s.epicId===epic.id);
  const done = epicStories.filter(s=>s.status==="Done").length;
  const inProgress = epicStories.filter(s=>s.status==="In Progress").length;
  const totalPts = epicStories.reduce((s,st)=>s+(st.points||0),0);
  const donePts = epicStories.filter(s=>s.status==="Done").reduce((s,st)=>s+(st.points||0),0);

  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, width:420, background:C.white, borderLeft:`1px solid ${C.grey200}`, boxShadow:"-4px 0 20px rgba(0,0,0,0.08)", zIndex:100, display:"flex", flexDirection:"column", overflow:"hidden" }} data-testid="epic-detail-panel">
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 20px", borderBottom:`1px solid ${C.grey100}`, flexShrink:0 }}>
        <div style={{ width:4, height:24, borderRadius:2, background:epic.color, flexShrink:0 }}/>
        <span style={{ fontSize:11, color:C.grey400, fontWeight:600 }}>{epic.id}</span>
        <span style={{ fontSize:14, fontWeight:700, color:C.grey800, flex:1 }}>{epic.title}</span>
        <AgileBtn label="Edit" variant="ghost" small onClick={onEdit} testId="button-edit-epic-panel"/>
        <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:18, color:C.grey400, padding:4 }} data-testid="button-close-epic-panel">{"✕"}</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
          <AgileBadge label={epic.status} color={statusBg(epic.status)} textColor={statusColor(epic.status)} dot/>
          <AgileBadge label={epic.priority} color={priorityBg(epic.priority)} textColor={priorityColor(epic.priority)}/>
          <span style={{ background:tshirtBg(epic.tshirt), color:tshirtColor(epic.tshirt), borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{epic.tshirt}</span>
        </div>

        <div style={{ fontSize:13, color:C.grey600, lineHeight:1.6, marginBottom:20 }}>{epic.description}</div>

        <div style={{ background:C.grey50, borderRadius:8, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.grey400, textTransform:"uppercase", letterSpacing:0.5, marginBottom:12 }}>Details</div>
          {([
            ["Initiative", epic.initiative],
            ["Owner", epic.owner],
            ["Creator", epic.creator],
            ["Created", epic.createdAt],
          ] as [string,string][]).map(([label, value])=>(
            <div key={label} style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontSize:12, color:C.grey400, fontWeight:600 }}>{label}</span>
              <span style={{ fontSize:12, color:C.grey700, fontWeight:600 }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.grey400, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Progress</div>
          <AgileProgressBar pct={epic.progress} color={epic.color} height={8}/>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.grey400, marginTop:6 }}>
            <span>{epic.progress}% complete</span>
            <span>{done}/{epicStories.length} stories done</span>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
          {([
            ["Total Points", String(totalPts), C.blue],
            ["Done Points", String(donePts), C.green],
            ["In Progress", String(inProgress), C.amber],
          ] as [string,string,string][]).map(([l,v,c])=>(
            <div key={l} style={{ background:C.grey50, borderRadius:8, padding:12, textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:10, color:C.grey400, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {epic.tags.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.grey400, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Tags</div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {epic.tags.map(t=><AgileBadge key={t} label={t} color={C.grey100} textColor={C.grey600}/>)}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize:11, fontWeight:700, color:C.grey400, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Stories ({epicStories.length})</div>
          {epicStories.map(s=>(
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:6, border:`1px solid ${C.grey100}`, marginBottom:6, background:C.white }}>
              <AgileBadge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small/>
              <span style={{ fontSize:11, color:C.grey400, fontWeight:600, flexShrink:0 }}>{s.id}</span>
              <span style={{ fontSize:12, color:C.grey700, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.title}</span>
              {s.points && <span style={{ fontSize:10, fontWeight:700, color:C.blue, background:C.blueLight, borderRadius:4, padding:"1px 5px" }}>{s.points}</span>}
            </div>
          ))}
          {epicStories.length===0 && <div style={{ fontSize:12, color:C.grey400, fontStyle:"italic" }}>No stories linked to this epic yet.</div>}
        </div>
      </div>
    </div>
  );
}

function StoryDetailPanel({ story, epics, onClose }: { story: Story; epics: Epic[]; onClose: () => void }) {
  const epic = epics.find(e=>e.id===story.epicId);
  return (
    <AgileModal title={`${story.id} — Story Detail`} onClose={onClose} wide>
      <div style={{ display:"flex", gap:20 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.grey800, marginBottom:12, lineHeight:1.4 }}>{story.title}</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
            <AgileBadge label={story.status} color={statusBg(story.status)} textColor={statusColor(story.status)} dot/>
            <AgileBadge label={story.priority} color={priorityBg(story.priority)} textColor={priorityColor(story.priority)}/>
            <span style={{ background:tshirtBg(story.tshirt), color:tshirtColor(story.tshirt), borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{story.tshirt}</span>
            {story.points && <AgileBadge label={`${story.points} pts`} color={C.blueLight} textColor={C.blue}/>}
          </div>
          {story.ac.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.grey700, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Acceptance Criteria</div>
              {story.ac.map((ac,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6, marginBottom:6 }}>
                  <span style={{ color:C.green, marginTop:2 }}>{"✓"}</span>
                  <span style={{ fontSize:12.5, color:C.grey600, lineHeight:1.5 }}>{ac}</span>
                </div>
              ))}
            </div>
          )}
          {story.tasks > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.grey700, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Tasks</div>
              <AgileProgressBar pct={(story.tasksDone/story.tasks)*100} color={C.blue} height={8}/>
              <div style={{ fontSize:11, color:C.grey400, marginTop:4 }}>{story.tasksDone}/{story.tasks} tasks completed</div>
            </div>
          )}
        </div>
        <div style={{ width:200, flexShrink:0 }}>
          <div style={{ background:C.grey50, borderRadius:8, padding:14 }}>
            {([["Epic", epic?.title||"—", epic?.color],["Sprint", story.sprint||"Unassigned", C.grey500],["Assignee", story.assignee||"Unassigned", C.grey500],["Creator", story.creator, C.grey500],["Created", story.createdAt, C.grey500]] as [string,string,string|undefined][]).map(([l,v,c])=>(
              <div key={l} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.grey400, textTransform:"uppercase", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:12, fontWeight:600, color:c||C.grey700 }}>{v}</div>
              </div>
            ))}
            {story.tags.length > 0 && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:C.grey400, textTransform:"uppercase", marginBottom:3 }}>Tags</div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {story.tags.map(t=><AgileBadge key={t} label={t} color={C.grey100} textColor={C.grey600} small/>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AgileModal>
  );
}

interface AgileBoardProps {
  initialTab?: string;
  view?: "board" | "backlog" | "epics" | "stories" | "sprints" | "defects" | "roadmap" | "bestpractice";
  projectId?: number;
}

function dbStoryToLocal(s: any, ws: { id: string }): Story {
  return { id: String(s.id), epicId: s.epicId ? String(s.epicId) : "", wsId: ws.id, title: s.title, status: s.status || "Backlog", points: s.points ?? null, tshirt: s.tshirt || "M", priority: s.priority || "Medium", assignee: s.assignee || null, creator: s.creator || "", createdAt: s.createdAt ? String(s.createdAt).slice(0, 10) : "", sprint: s.sprintName || null, tags: s.tags || [], tasks: 0, tasksDone: 0, ac: s.acceptanceCriteria || [] };
}
function dbEpicToLocal(e: any, ws: { id: string }): Epic {
  return { id: String(e.id), wsId: ws.id, title: e.title, initiative: e.initiative || "", status: e.status || "planning", tshirt: e.tshirt || "M", priority: e.priority || "Medium", progress: e.progress || 0, owner: e.owner || "", creator: "", createdAt: e.createdAt ? String(e.createdAt).slice(0, 10) : "", color: e.color || C.blue, stories: 0, storiesDone: 0, tags: e.tags || [], description: e.description || "" };
}
function dbSprintToLocal(s: any, ws: { id: string }): Sprint {
  return { id: String(s.id), wsId: ws.id, name: s.name, status: s.status || "Planned", start: s.startDate || "", end: s.endDate || "", points: s.totalPoints || 0, done: s.donePoints || 0, goal: s.goal || "" };
}
function dbDefectToLocal(d: any, ws: { id: string }): Defect {
  return { id: String(d.id), wsId: ws.id, storyId: d.storyId ? String(d.storyId) : "", title: d.title, severity: d.severity || "Minor", priority: d.priority || "Medium", status: d.status || "New", assignee: d.assignee || null, creator: d.reporter || "", createdAt: d.createdAt ? String(d.createdAt).slice(0, 10) : "", environment: d.environment || "Dev", sprint: null };
}

export default function AgileBoard({ initialTab = "board", view, projectId }: AgileBoardProps) {
  const isDbMode = !!projectId;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeWs, setActiveWs] = useState(isDbMode ? "" : "ws-ai");
  const [workstreams, setWorkstreams] = useState<Workstream[]>(isDbMode ? [] : WORKSTREAMS);
  const [epics, setEpics] = useState<Epic[]>(isDbMode ? [] : EPICS_INIT);
  const [stories, setStories] = useState<Story[]>(isDbMode ? [] : STORIES_INIT);
  const [defects, setDefects] = useState<Defect[]>(isDbMode ? [] : DEFECTS_INIT);
  const [sprints, setSprints] = useState<Sprint[]>(isDbMode ? [] : SPRINTS_INIT);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { data: wsData } = useQuery<any[]>({
    queryKey: ['/api/pm/projects', projectId, 'agile/workstreams'],
    queryFn: () => fetch(`/api/pm/projects/${projectId}/agile/workstreams`).then(r => r.json()),
    enabled: isDbMode,
  });
  const { data: epicsData } = useQuery<any[]>({
    queryKey: ['/api/pm/agile/workstreams', activeWs, 'epics'],
    queryFn: () => fetch(`/api/pm/agile/workstreams/${activeWs}/epics`).then(r => r.json()),
    enabled: isDbMode && /^\d+$/.test(activeWs),
  });
  const { data: storiesData } = useQuery<any[]>({
    queryKey: ['/api/pm/agile/workstreams', activeWs, 'stories'],
    queryFn: () => fetch(`/api/pm/agile/workstreams/${activeWs}/stories`).then(r => r.json()),
    enabled: isDbMode && /^\d+$/.test(activeWs),
  });
  const { data: sprintsData } = useQuery<any[]>({
    queryKey: ['/api/pm/agile/workstreams', activeWs, 'sprints'],
    queryFn: () => fetch(`/api/pm/agile/workstreams/${activeWs}/sprints`).then(r => r.json()),
    enabled: isDbMode && /^\d+$/.test(activeWs),
  });
  const { data: defectsData } = useQuery<any[]>({
    queryKey: ['/api/pm/agile/workstreams', activeWs, 'defects'],
    queryFn: () => fetch(`/api/pm/agile/workstreams/${activeWs}/defects`).then(r => r.json()),
    enabled: isDbMode && /^\d+$/.test(activeWs),
  });

  useEffect(() => {
    if (wsData && wsData.length > 0) {
      const mapped = wsData.map(w => ({ id: String(w.id), name: w.name, color: w.color }));
      setWorkstreams(mapped);
      setActiveWs(prev => (prev === "" || !mapped.find(m => m.id === prev)) ? mapped[0].id : prev);
    }
  }, [wsData]);

  useEffect(() => {
    if (epicsData && activeWs) {
      const currentWs = workstreams.find(w => w.id === activeWs) || { id: activeWs };
      setEpics(prev => [...prev.filter(e => e.wsId !== activeWs), ...epicsData.map(e => dbEpicToLocal(e, currentWs))]);
    }
  }, [epicsData, activeWs]);

  useEffect(() => {
    if (storiesData && activeWs) {
      const currentWs = workstreams.find(w => w.id === activeWs) || { id: activeWs };
      setStories(prev => [...prev.filter(s => s.wsId !== activeWs), ...storiesData.map(s => dbStoryToLocal(s, currentWs))]);
    }
  }, [storiesData, activeWs]);

  useEffect(() => {
    if (sprintsData && activeWs) {
      const currentWs = workstreams.find(w => w.id === activeWs) || { id: activeWs };
      setSprints(prev => [...prev.filter(s => s.wsId !== activeWs), ...sprintsData.map(s => dbSprintToLocal(s, currentWs))]);
    }
  }, [sprintsData, activeWs]);

  useEffect(() => {
    if (defectsData && activeWs) {
      const currentWs = workstreams.find(w => w.id === activeWs) || { id: activeWs };
      setDefects(prev => [...prev.filter(d => d.wsId !== activeWs), ...defectsData.map(d => dbDefectToLocal(d, currentWs))]);
    }
  }, [defectsData, activeWs]);

  const createStoryMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/pm/agile/workstreams/${activeWs}/stories`, payload),
    onSuccess: (newStory: any) => {
      const currentWs = workstreams.find(w => w.id === activeWs) || { id: activeWs };
      setStories(prev => [...prev, dbStoryToLocal(newStory, currentWs)]);
    },
  });
  const createEpicMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/pm/agile/workstreams/${activeWs}/epics`, payload),
    onSuccess: (newEpic: any) => {
      const currentWs = workstreams.find(w => w.id === activeWs) || { id: activeWs };
      setEpics(prev => [...prev, dbEpicToLocal(newEpic, currentWs)]);
    },
  });
  const createSprintMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/pm/agile/workstreams/${activeWs}/sprints`, payload),
    onSuccess: (newSprint: any) => {
      const currentWs = workstreams.find(w => w.id === activeWs) || { id: activeWs };
      setSprints(prev => [...prev, dbSprintToLocal(newSprint, currentWs)]);
    },
  });
  const createDefectMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/pm/agile/workstreams/${activeWs}/defects`, payload),
    onSuccess: (newDefect: any) => {
      const currentWs = workstreams.find(w => w.id === activeWs) || { id: activeWs };
      setDefects(prev => [...prev, dbDefectToLocal(newDefect, currentWs)]);
    },
  });
  const createWorkstreamMutation = useMutation({
    mutationFn: (name: string) => apiRequest('POST', `/api/pm/projects/${projectId}/agile/workstreams`, { name, color: C.blue, sortOrder: workstreams.length }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/pm/projects', projectId, 'agile/workstreams'] }),
  });

  const currentWsObj = workstreams.find(w => w.id === activeWs) || workstreams[0] || WORKSTREAMS[0];

  const handleAddStory = isDbMode ? (data: any) => {
    createStoryMutation.mutate({ projectId, title: data.title, epicId: data.epicId ? Number(data.epicId) : null, points: data.points ? Number(data.points) : null, tshirt: data.tshirt || "M", priority: data.priority || "Medium", assignee: data.assignee || null, status: "Backlog", creator: "Current User", tags: [], acceptanceCriteria: [] });
  } : undefined;
  const handleAddEpic = isDbMode ? (data: any) => {
    createEpicMutation.mutate({ projectId, title: data.title, initiative: data.initiative || "", status: data.status || "planning", priority: data.priority || "Medium", tshirt: data.tshirt || "M", owner: data.owner || "", color: currentWsObj?.color || C.blue, description: data.description || "", tags: [] });
  } : undefined;
  const handleAddSprint = isDbMode ? (data: any) => {
    createSprintMutation.mutate({ projectId, name: data.name, goal: data.goal || "", status: "Planned", startDate: data.start || null, endDate: data.end || null, totalPoints: Number(data.points) || 0, donePoints: 0 });
  } : undefined;
  const handleAddDefect = isDbMode ? (data: any) => {
    createDefectMutation.mutate({ projectId, title: data.title, storyId: data.storyId ? Number(data.storyId) : null, severity: data.severity || "Minor", priority: data.priority || "Medium", status: "New", assignee: data.assignee || null, reporter: "Current User", environment: data.environment || "Dev" });
  } : undefined;

  const displayWorkstreams = workstreams.length > 0 ? workstreams : WORKSTREAMS;
  const ws = currentWsObj;
  const wsEpics = epics.filter(e=>e.wsId===activeWs);
  const wsStories = stories.filter(s=>s.wsId===activeWs);
  const wsSprints = sprints.filter(s=>s.wsId===activeWs);
  const activeSprint = wsSprints.find(s=>s.status==="Active");
  const sprintStories = wsStories.filter(s=>s.sprint===activeSprint?.name);

  function handleDrop(e: React.DragEvent, toCol: string) {
    e.preventDefault();
    if (!dragItem) return;
    setStories(prev => prev.map(s => s.id === dragItem ? { ...s, status: toCol } : s));
    if (isDbMode && /^\d+$/.test(dragItem)) {
      apiRequest('PUT', `/api/pm/agile/stories/${dragItem}`, { status: toCol }).catch(() => {});
    }
    setDragItem(null);
    setDragOver(null);
  }

  const currentView = view || activeTab;

  const renderView = () => {
    switch (currentView) {
      case "board": return <BoardView stories={sprintStories} epics={wsEpics} onDrop={handleDrop} dragItem={dragItem} setDragItem={setDragItem} dragOver={dragOver} setDragOver={setDragOver} activeSprint={activeSprint} onSelectStory={setSelectedStory} allSprintStories={sprintStories}/>;
      case "backlog": return <BacklogView stories={wsStories} epics={wsEpics} onSelectStory={setSelectedStory} sprints={wsSprints} setStories={setStories} activeSprint={activeSprint} ws={ws} onAddStory={handleAddStory}/>;
      case "epics": return <EpicsView epics={wsEpics} stories={wsStories} onSelect={setSelectedEpic as any} setEpics={setEpics} ws={ws} onAddEpic={handleAddEpic}/>;
      case "stories": return <StoriesView stories={wsStories} epics={wsEpics} onSelect={setSelectedStory} setStories={setStories} ws={ws} onAddStory={handleAddStory}/>;
      case "sprints": return <SprintsView sprints={wsSprints} stories={wsStories} setSprints={setSprints} ws={ws} onAddSprint={handleAddSprint}/>;
      case "defects": return <DefectsView defects={defects.filter(d=>d.wsId===activeWs)} stories={wsStories} setDefects={setDefects} ws={ws} onAddDefect={handleAddDefect}/>;
      case "roadmap": return <RoadmapView epics={wsEpics} sprints={wsSprints}/>;
      case "bestpractice": return <BestPracticeView/>;
      default: return null;
    }
  };

  const WorkstreamTabs = () => (
    <div style={{ background:C.navy, display:"flex", alignItems:"center", gap:2, padding:"0 12px", height:40, flexShrink:0, overflowX:"auto" }}>
      {displayWorkstreams.map(w=>(
        <button key={w.id} onClick={()=>setActiveWs(w.id)}
          style={{ padding:"6px 14px", borderRadius:"6px 6px 0 0", border:"none", cursor:"pointer", fontSize:12, fontWeight:activeWs===w.id?700:500, background:activeWs===w.id?C.white:"transparent", color:activeWs===w.id?w.color:"#CBD5E1", transition:"all 0.15s", whiteSpace:"nowrap", marginTop:4 }}
          data-testid={`ws-tab-${w.id}`}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:w.color, display:"inline-block", marginRight:6 }}/>
          {w.name}
        </button>
      ))}
      {isDbMode && (
        <button onClick={()=>{ const name=prompt("Workstream name:"); if(name) createWorkstreamMutation.mutate(name); }}
          style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #CBD5E1", cursor:"pointer", fontSize:11, color:"#CBD5E1", background:"transparent", marginLeft:4, marginTop:4 }}
          data-testid="button-add-workstream">+ WS</button>
      )}
    </div>
  );

  if (view) {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden" }} data-testid={`agile-${view}`}>
        <WorkstreamTabs />
        <div style={{ flex:1, overflowY:"auto" }}>
          {renderView()}
        </div>
        {selectedStory && <StoryDetailPanel story={selectedStory} epics={wsEpics} onClose={()=>setSelectedStory(null)}/>}
        {selectedEpic && <EpicDetailPanel epic={selectedEpic} stories={wsStories} onClose={()=>setSelectedEpic(null)} onEdit={()=>{ setSelectedEpic(null); }}/>}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.grey50, borderRadius:10, border:`1px solid ${C.grey200}`, overflow:"hidden" }} data-testid="agile-board">
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
        {renderView()}
      </div>

      {selectedStory && <StoryDetailPanel story={selectedStory} epics={wsEpics} onClose={()=>setSelectedStory(null)}/>}
      {selectedEpic && <EpicDetailPanel epic={selectedEpic} stories={wsStories} onClose={()=>setSelectedEpic(null)} onEdit={()=>{ setSelectedEpic(null); }}/>}
    </div>
  );
}
