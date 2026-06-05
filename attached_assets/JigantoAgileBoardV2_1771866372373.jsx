import { useState, useRef, useEffect } from "react";

// ─── Colour tokens ─────────────────────────────────────────────────────────
const C = {
  navy: "#1B3A6B", blue: "#2563EB", blueMid: "#3B82F6", blueLight: "#DBEAFE",
  teal: "#0EA5E9", tealLight: "#E0F2FE", purple: "#7C3AED", purpleLight: "#EDE9FE",
  green: "#16A34A", greenLight: "#DCFCE7", amber: "#D97706", amberLight: "#FEF3C7",
  red: "#DC2626", redLight: "#FEE2E2",
  grey50: "#F8FAFC", grey100: "#F1F5F9", grey200: "#E2E8F0", grey300: "#CBD5E1",
  grey400: "#94A3B8", grey500: "#64748B", grey600: "#475569", grey700: "#334155",
  grey800: "#1E293B", white: "#FFFFFF",
};

// ─── Mock data ──────────────────────────────────────────────────────────────
const WORKSTREAMS = [
  { id: "ws-ai",  name: "AI CUI Engine",    color: C.blue   },
  { id: "ws-o2c", name: "Order to Cash",    color: C.teal   },
  { id: "ws-p2p", name: "Purchase to Pay",  color: C.purple },
  { id: "ws-r2r", name: "Record to Report", color: C.amber  },
  { id: "ws-h2r", name: "Hire to Retire",   color: C.green  },
];

const EPICS_INIT = [
  { id:"EP-001", wsId:"ws-ai",  title:"AI CUI Core Engine",         initiative:"AI Platform v2",      status:"Active",   tshirt:"XL", priority:"Critical", progress:45, owner:"Sarah K.", color:C.blue,   stories:12, storiesDone:5,  tags:["backend","AI"],     description:"Build the core conversational UI engine powering all AI interactions." },
  { id:"EP-002", wsId:"ws-ai",  title:"User Auth & SSO",            initiative:"Security Foundation", status:"Active",   tshirt:"L",  priority:"High",     progress:72, owner:"Mark T.",  color:C.teal,   stories:8,  storiesDone:6,  tags:["security","auth"],  description:"Enterprise SSO, MFA, and session management." },
  { id:"EP-003", wsId:"ws-ai",  title:"Real-Time Collaboration",    initiative:"AI Platform v2",      status:"Planning", tshirt:"XL", priority:"High",     progress:10, owner:"Priya M.", color:C.purple, stories:15, storiesDone:2,  tags:["realtime","collab"], description:"WebSocket-powered live collaboration across all boards." },
  { id:"EP-004", wsId:"ws-o2c", title:"Sales Order Management",     initiative:"ERP Phase 1",         status:"Active",   tshirt:"L",  priority:"Critical", progress:38, owner:"James L.", color:C.amber,  stories:10, storiesDone:4,  tags:["SAP","O2C"],        description:"End-to-end sales order processing in SAP." },
  { id:"EP-005", wsId:"ws-p2p", title:"Purchase Requisition Flow",  initiative:"ERP Phase 1",         status:"Planning", tshirt:"M",  priority:"High",     progress:5,  owner:"Dev A.",   color:C.green,  stories:7,  storiesDone:0,  tags:["SAP","P2P"],        description:"PR to PO automation and approval workflows." },
];

const STORIES_INIT = [
  { id:"US-001", epicId:"EP-001", wsId:"ws-ai",  title:"As a user, I want to type natural language queries so that I can interact with AI without learning commands", status:"Done",        points:5,  tshirt:"M",  priority:"Critical", assignee:"Sarah K.", sprint:"Sprint 3", tags:["AI","UX"],       tasks:3, tasksDone:3, ac:["Input accepts free text","Response within 2s","Error handling shown"] },
  { id:"US-002", epicId:"EP-001", wsId:"ws-ai",  title:"As a developer, I want streaming responses so that users see output progressively",                          status:"In Progress", points:8,  tshirt:"L",  priority:"Critical", assignee:"Dev A.",   sprint:"Sprint 3", tags:["AI","stream"],   tasks:4, tasksDone:2, ac:["Tokens stream as generated","Stop button available","Graceful timeout"] },
  { id:"US-003", epicId:"EP-001", wsId:"ws-ai",  title:"As a user, I want conversation history so that I can revisit past AI sessions",                             status:"To Do",       points:5,  tshirt:"M",  priority:"High",     assignee:"Dev B.",   sprint:"Sprint 4", tags:["AI","history"],  tasks:3, tasksDone:0, ac:["Last 50 sessions stored","Search by keyword","Delete session"] },
  { id:"US-004", epicId:"EP-002", wsId:"ws-ai",  title:"As an admin, I want SSO integration so that users sign in with corporate credentials",                      status:"Done",        points:13, tshirt:"L",  priority:"Critical", assignee:"Mark T.",  sprint:"Sprint 2", tags:["security","SSO"], tasks:5, tasksDone:5, ac:["SAML 2.0 support","OIDC support","Fallback local auth"] },
  { id:"US-005", epicId:"EP-002", wsId:"ws-ai",  title:"As a user, I want MFA so that my account is protected",                                                     status:"Done",        points:5,  tshirt:"S",  priority:"High",     assignee:"Mark T.",  sprint:"Sprint 2", tags:["security","MFA"], tasks:3, tasksDone:3, ac:["TOTP support","SMS fallback","Recovery codes"] },
  { id:"US-006", epicId:"EP-003", wsId:"ws-ai",  title:"As a team member, I want to see live cursors so that I know who is editing",                                status:"In Progress", points:8,  tshirt:"M",  priority:"High",     assignee:"Priya M.", sprint:"Sprint 3", tags:["realtime"],      tasks:4, tasksDone:1, ac:["Cursor shows username","Updates <100ms","Fades when idle"] },
  { id:"US-007", epicId:"EP-001", wsId:"ws-ai",  title:"As a user, I want context-aware suggestions so that the AI anticipates my needs",                           status:"Backlog",     points:13, tshirt:"XL", priority:"Medium",   assignee:null,       sprint:null,       tags:["AI"],            tasks:0, tasksDone:0, ac:[] },
  { id:"US-008", epicId:"EP-004", wsId:"ws-o2c", title:"As a sales rep, I want to create sales orders in SAP so that customer orders are processed automatically",   status:"To Do",       points:8,  tshirt:"L",  priority:"Critical", assignee:"James L.", sprint:"Sprint 3", tags:["SAP","O2C"],     tasks:3, tasksDone:0, ac:["Order created in SAP","Stock checked","Confirmation email sent"] },
];

const DEFECTS_INIT = [
  { id:"DEF-001", storyId:"US-001", wsId:"ws-ai",  title:"AI response cuts off at 500 chars in Firefox", severity:"Major",    priority:"High",     status:"In Progress", assignee:"Dev A.",   environment:"SIT", sprint:"Sprint 3" },
  { id:"DEF-002", storyId:"US-004", wsId:"ws-ai",  title:"SSO redirect loop on SAML timeout",            severity:"Critical", priority:"Critical", status:"Fixed",       assignee:"Mark T.",  environment:"UAT", sprint:"Sprint 3" },
  { id:"DEF-003", storyId:"US-006", wsId:"ws-ai",  title:"Cursor ghost remains after user disconnects",  severity:"Minor",    priority:"Low",      status:"New",         assignee:null,       environment:"Dev", sprint:null },
];

const SPRINTS_INIT = [
  { id:"SP-001", wsId:"ws-ai", name:"Sprint 1", status:"Closed",  start:"06 Jan 2026", end:"19 Jan 2026", points:28, done:28 },
  { id:"SP-002", wsId:"ws-ai", name:"Sprint 2", status:"Closed",  start:"20 Jan 2026", end:"02 Feb 2026", points:32, done:30 },
  { id:"SP-003", wsId:"ws-ai", name:"Sprint 3", status:"Active",  start:"03 Feb 2026", end:"16 Feb 2026", points:34, done:18 },
  { id:"SP-004", wsId:"ws-ai", name:"Sprint 4", status:"Planned", start:"17 Feb 2026", end:"02 Mar 2026", points:21, done:0  },
];

// Simulated daily burndown data for active sprint (Sprint 3 = 14 days, 34 pts)
const BURNDOWN_DATA = [
  { day:"Day 1",  ideal:34,   actual:34  },
  { day:"Day 2",  ideal:31.4, actual:32  },
  { day:"Day 3",  ideal:28.8, actual:30  },
  { day:"Day 4",  ideal:26.1, actual:29  },
  { day:"Day 5",  ideal:23.5, actual:26  },
  { day:"Day 6",  ideal:20.9, actual:24  },
  { day:"Day 7",  ideal:18.3, actual:22  },
  { day:"Day 8",  ideal:15.6, actual:18  },
  { day:"Day 9",  ideal:13.0, actual:16  },
  { day:"Day 10", ideal:10.4, actual:null },
  { day:"Day 11", ideal:7.8,  actual:null },
  { day:"Day 12", ideal:5.2,  actual:null },
  { day:"Day 13", ideal:2.6,  actual:null },
  { day:"Day 14", ideal:0,    actual:null },
];

// Simulated weekly epic burn-up data
const BURNUP_DATA = {
  "EP-001": [
    { week:"W1", completed:0,  total:12 }, { week:"W2", completed:1, total:12 },
    { week:"W3", completed:2,  total:12 }, { week:"W4", completed:3, total:12 },
    { week:"W5", completed:5,  total:12 }, { week:"W6", completed:5, total:12 },
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

// ─── Tiny helpers ───────────────────────────────────────────────────────────
const AVATAR_COLORS = [C.blue, C.purple, C.teal, C.green, C.amber, C.red, "#0D9488"];
const avatarBg = n => n ? AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length] : C.grey400;
const initials = n => n ? n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?";

function Avatar({ name, size=24 }) {
  return (
    <div title={name||"Unassigned"} style={{ width:size, height:size, borderRadius:"50%", background:avatarBg(name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.38, fontWeight:700, color:C.white, border:`1.5px solid ${C.white}`, flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}
function Badge({ label, color=C.grey200, textColor=C.grey700, dot, small }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding: small?"1px 6px":"2px 8px", borderRadius:20, background:color, color:textColor, fontSize:small?10:11, fontWeight:600, whiteSpace:"nowrap" }}>
      {dot && <span style={{ width:5, height:5, borderRadius:"50%", background:textColor, flexShrink:0 }}/>}
      {label}
    </span>
  );
}
function ProgressBar({ pct, color=C.blue, height=6 }) {
  return (
    <div style={{ height, borderRadius:height, background:C.grey200, overflow:"hidden", flex:1 }}>
      <div style={{ height:"100%", width:`${Math.min(100,pct||0)}%`, background:pct>=100?C.green:color, borderRadius:height, transition:"width 0.5s ease" }}/>
    </div>
  );
}
const priorityColor = p => ({ Critical:C.red, High:C.amber, Medium:C.blue, Low:C.grey400 }[p]||C.grey400);
const priorityBg    = p => ({ Critical:C.redLight, High:C.amberLight, Medium:C.blueLight, Low:C.grey100 }[p]||C.grey100);
const statusColor   = s => ({ Done:C.green, "In Progress":C.blue, "To Do":C.grey500, Backlog:C.grey400, Review:C.purple, Testing:C.teal, Active:C.green, Planning:C.amber, Closed:C.grey500, Planned:C.teal, Fixed:C.teal, New:C.amber, Triaged:C.blue, Verified:C.green }[s]||C.grey400);
const statusBg      = s => ({ Done:C.greenLight, "In Progress":C.blueLight, "To Do":C.grey100, Backlog:C.grey100, Review:C.purpleLight, Testing:C.tealLight, Active:C.greenLight, Planning:C.amberLight, Closed:C.grey100, Planned:C.tealLight, Fixed:C.tealLight, New:C.amberLight, Triaged:C.blueLight, Verified:C.greenLight }[s]||C.grey100);
const tshirtBg    = t => ({ XS:"#F0FDF4", S:"#DCFCE7", M:"#DBEAFE", L:"#FEF3C7", XL:"#FEE2E2", XXL:"#FCE7F3" }[t]||C.grey100);
const tshirtColor = t => ({ XS:C.green, S:C.green, M:C.blue, L:C.amber, XL:C.red, XXL:"#9D174D" }[t]||C.grey700);

// ─── Btn ────────────────────────────────────────────────────────────────────
function Btn({ label, icon, onClick, variant="secondary", small, danger }) {
  const base = { display:"flex", alignItems:"center", gap:5, padding: small?"4px 11px":"6px 14px", borderRadius:6, cursor:"pointer", fontSize:small?11:12, fontWeight:600, border:"none", transition:"all 0.15s", whiteSpace:"nowrap" };
  const styles = {
    primary: { ...base, background:C.blue, color:C.white },
    secondary: { ...base, background:C.white, color:C.grey700, border:`1px solid ${C.grey200}` },
    danger: { ...base, background:C.redLight, color:C.red, border:`1px solid ${C.red}44` },
    ghost: { ...base, background:"transparent", color:C.grey500, border:`1px solid transparent` },
  };
  return <button style={styles[danger?"danger":variant]} onClick={onClick}>{icon && <span>{icon}</span>}{label}</button>;
}

// ─── Select dropdown ────────────────────────────────────────────────────────
function Select({ value, onChange, options, small }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{ padding: small?"3px 8px":"5px 10px", borderRadius:6, border:`1px solid ${C.grey200}`, background:C.white, fontSize:small?11:12, color:C.grey700, cursor:"pointer", fontFamily:"inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Modal shell ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.45)" }} onClick={onClose}>
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

function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.grey500, textTransform:"uppercase", letterSpacing:0.5, marginBottom:5 }}>{label}{required&&<span style={{color:C.red}}> *</span>}</label>
      {children}
    </div>
  );
}
const inputStyle = { width:"100%", padding:"7px 10px", borderRadius:6, border:`1px solid ${C.grey200}`, fontSize:13, color:C.grey800, fontFamily:"inherit", boxSizing:"border-box" };
const textareaStyle = { ...inputStyle, resize:"vertical", minHeight:80 };

// ─── Confirm delete dialog ──────────────────────────────────────────────────
function ConfirmDelete({ label, onConfirm, onCancel }) {
  return (
    <Modal title="Confirm Delete" onClose={onCancel}>
      <p style={{ color:C.grey600, marginBottom:20 }}>Are you sure you want to delete <strong>{label}</strong>? This action cannot be undone.</p>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn label="Cancel" onClick={onCancel}/>
        <Btn label="Delete" danger onClick={onConfirm}/>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BURNDOWN CHART (SVG — no recharts dependency)
// ═══════════════════════════════════════════════════════════════════════════
function BurndownChart({ data, title, width=520, height=200 }) {
  const pad = { top:16, right:20, bottom:32, left:36 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d => Math.max(d.ideal, d.actual||0)));
  const xs = data.map((_,i) => pad.left + (i/(data.length-1))*W);
  const y  = v => pad.top + H - (v/maxY)*H;

  const idealPath = data.map((d,i)=>`${i===0?"M":"L"}${xs[i]},${y(d.ideal)}`).join(" ");
  const actualPts = data.filter(d=>d.actual!==null);
  const actualPath = actualPts.map((d,i)=>{
    const xi = data.indexOf(d);
    return `${i===0?"M":"L"}${xs[xi]},${y(d.actual)}`;
  }).join(" ");

  // Today marker
  const lastActualIdx = data.reduce((a,d,i)=>d.actual!==null?i:a,-1);

  return (
    <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:"12px 16px" }}>
      <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:8 }}>{title}</div>
      <svg width={width} height={height} style={{ display:"block", overflow:"visible" }}>
        {/* Grid lines */}
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
        {/* X labels */}
        {data.filter((_,i)=>i%2===0).map((d,i)=>{
          const idx = i*2;
          return <text key={d.day} x={xs[idx]} y={pad.top+H+18} textAnchor="middle" fontSize={9} fill={C.grey400}>{d.day}</text>;
        })}
        {/* Today line */}
        {lastActualIdx>=0 && (
          <line x1={xs[lastActualIdx]} y1={pad.top} x2={xs[lastActualIdx]} y2={pad.top+H} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3"/>
        )}
        {/* Ideal line */}
        <path d={idealPath} fill="none" stroke={C.grey300} strokeWidth={2} strokeDasharray="6 3"/>
        {/* Actual area */}
        {actualPts.length>0 && (
          <path d={actualPath + ` L${xs[lastActualIdx]},${pad.top+H} L${xs[0]},${pad.top+H} Z`} fill={`${C.blue}18`} stroke="none"/>
        )}
        {/* Actual line */}
        {actualPts.length>0 && <path d={actualPath} fill="none" stroke={C.blue} strokeWidth={2.5}/>}
        {/* Actual dots */}
        {actualPts.map((d,i)=>{
          const xi = data.indexOf(d);
          return <circle key={i} cx={xs[xi]} cy={y(d.actual)} r={3.5} fill={C.white} stroke={C.blue} strokeWidth={2}/>;
        })}
        {/* Legend */}
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
        {[["Committed","34 pts",C.grey700],["Completed","18 pts",C.blue],["Remaining","16 pts",C.amber],["Trend","⚠ Behind",C.red]].map(([l,v,col])=>(
          <div key={l} style={{ textAlign:"center" }}>
            <div style={{ fontWeight:700, fontSize:13, color:col }}>{v}</div>
            <div style={{ fontSize:10, color:C.grey400 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BURN-UP CHART
// ═══════════════════════════════════════════════════════════════════════════
function BurnUpChart({ data, title, color=C.blue, width=320, height=180 }) {
  if (!data || data.length===0) return null;
  const pad = { top:14, right:16, bottom:28, left:32 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d=>d.total));
  const xs = data.map((_,i) => pad.left + (i/(data.length-1))*W);
  const y  = v => pad.top + H - (v/maxY)*H;

  const scopePath = data.map((d,i)=>`${i===0?"M":"L"}${xs[i]},${y(d.total)}`).join(" ");
  const donePath  = data.map((d,i)=>`${i===0?"M":"L"}${xs[i]},${y(d.completed)}`).join(" ");

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
        {/* Scope (total) */}
        <path d={scopePath} fill="none" stroke={C.grey300} strokeWidth={1.5} strokeDasharray="5 3"/>
        {/* Done area */}
        <path d={donePath+` L${xs[xs.length-1]},${pad.top+H} L${xs[0]},${pad.top+H} Z`} fill={`${color}20`} stroke="none"/>
        <path d={donePath} fill="none" stroke={color} strokeWidth={2}/>
        {data.map((d,i)=><circle key={i} cx={xs[i]} cy={y(d.completed)} r={3} fill={C.white} stroke={color} strokeWidth={1.5}/>)}
        {/* Legend */}
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

// ═══════════════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"board",      label:"🗂 Sprint Board"    },
  { id:"backlog",    label:"📋 Backlog"         },
  { id:"epics",      label:"⚡ Epics"           },
  { id:"stories",    label:"📖 Stories"         },
  { id:"sprints",    label:"🏃 Sprints"         },
  { id:"defects",    label:"🐛 Defects"         },
  { id:"roadmap",    label:"🗺 Roadmap"         },
  { id:"bestpractice",label:"📘 Best Practice"  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════
export default function JigantoAgileBoardV2() {
  const [activeTab, setActiveTab] = useState("board");
  const [activeWs, setActiveWs] = useState("ws-ai");
  const [epics, setEpics] = useState(EPICS_INIT);
  const [stories, setStories] = useState(STORIES_INIT);
  const [defects, setDefects] = useState(DEFECTS_INIT);
  const [sprints, setSprints] = useState(SPRINTS_INIT);
  const [selectedStory, setSelectedStory] = useState(null);
  const [selectedEpic, setSelectedEpic]   = useState(null);
  const [dragItem, setDragItem]   = useState(null);
  const [dragOver, setDragOver]   = useState(null);

  const ws = WORKSTREAMS.find(w=>w.id===activeWs);
  const wsEpics    = epics.filter(e=>e.wsId===activeWs);
  const wsStories  = stories.filter(s=>s.wsId===activeWs);
  const wsSprints  = sprints.filter(s=>s.wsId===activeWs);
  const activeSprint = wsSprints.find(s=>s.status==="Active");
  const sprintStories = wsStories.filter(s=>s.sprint===activeSprint?.name);

  function handleDrop(e, toCol) {
    e.preventDefault();
    if (!dragItem) return;
    setStories(prev=>prev.map(s=>s.id===dragItem?{...s,status:toCol}:s));
    setDragItem(null); setDragOver(null);
  }

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", background:C.grey50, minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      {/* ── TOP NAV ── */}
      <div style={{ background:C.white, borderBottom:`1px solid ${C.grey200}`, padding:"0 20px", display:"flex", alignItems:"center", gap:12, height:52, flexShrink:0 }}>
        <button style={{ display:"flex", alignItems:"center", gap:5, color:C.grey500, background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:500 }}>‹ Back</button>
        <Badge label="Project" color={C.blueLight} textColor={C.blue}/>
        <Badge label="● At Risk" color={C.amberLight} textColor={C.amber}/>
        <Badge label="● Active" color={C.greenLight} textColor={C.green}/>
        <span style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>AI CUI Engine Build</span>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color:C.grey400 }}>📅 15 Jan – 31 Oct 2026</span>
        <span style={{ fontSize:12, color:C.grey600, fontWeight:600 }}>📊 45%</span>
        <Btn label="⚙ Settings" variant="secondary" small/>
        <Btn label="+ Add Tool" variant="secondary" small/>
        <Btn label="↗ Share" variant="primary" small/>
      </div>

      {/* ── WORKSTREAM SWITCHER BAR ── */}
      <div style={{ background:C.navy, padding:"0 20px", display:"flex", alignItems:"center", gap:8, height:38, flexShrink:0, overflowX:"auto" }}>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontWeight:600, marginRight:4, whiteSpace:"nowrap" }}>WORKSTREAM:</span>
        {WORKSTREAMS.map(w=>(
          <button key={w.id} onClick={()=>setActiveWs(w.id)}
            style={{ padding:"4px 14px", borderRadius:20, border:`1.5px solid ${activeWs===w.id?w.color:"rgba(255,255,255,0.15)"}`, background:activeWs===w.id?w.color+"33":"transparent", color:activeWs===w.id?C.white:"rgba(255,255,255,0.55)", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s" }}>
            {w.name}
          </button>
        ))}
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{wsStories.length} stories · {wsEpics.length} epics</span>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ background:C.white, borderBottom:`1px solid ${C.grey200}`, padding:"0 20px", display:"flex", gap:2, overflowX:"auto", flexShrink:0 }}>
        {TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{ padding:"10px 14px", border:"none", background:"none", cursor:"pointer", fontSize:12.5, fontWeight:activeTab===tab.id?700:500, color:activeTab===tab.id?C.blue:C.grey500, borderBottom:`2.5px solid ${activeTab===tab.id?C.blue:"transparent"}`, whiteSpace:"nowrap", transition:"all 0.15s" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex:1, overflow:"auto" }}>
        {activeTab==="board"       && <SprintBoardView stories={sprintStories} sprint={activeSprint} setDragItem={setDragItem} dragOver={dragOver} setDragOver={setDragOver} onDrop={handleDrop} onSelectStory={setSelectedStory} epics={epics} wsColor={ws?.color} />}
        {activeTab==="backlog"     && <BacklogView stories={wsStories} epics={wsEpics} onSelectStory={setSelectedStory} sprints={wsSprints} setStories={setStories} activeSprint={activeSprint} ws={ws}/>}
        {activeTab==="epics"       && <EpicsView epics={wsEpics} stories={wsStories} onSelect={setSelectedEpic} setEpics={setEpics} ws={ws}/>}
        {activeTab==="stories"     && <StoriesView stories={wsStories} epics={wsEpics} onSelect={setSelectedStory} setStories={setStories} ws={ws}/>}
        {activeTab==="sprints"     && <SprintsView sprints={wsSprints} stories={wsStories} setSprints={setSprints} ws={ws}/>}
        {activeTab==="defects"     && <DefectsView defects={defects.filter(d=>d.wsId===activeWs)} stories={wsStories} setDefects={setDefects} ws={ws}/>}
        {activeTab==="roadmap"     && <RoadmapView epics={wsEpics} sprints={wsSprints}/>}
        {activeTab==="bestpractice"&& <BestPracticeView/>}
      </div>

      {selectedStory && <StoryDrawer story={selectedStory} epics={epics} onClose={()=>setSelectedStory(null)} onSave={updated=>{ setStories(p=>p.map(s=>s.id===updated.id?updated:s)); setSelectedStory(null); }} onDelete={id=>{ setStories(p=>p.filter(s=>s.id!==id)); setSelectedStory(null); }}/>}
      {selectedEpic  && <EpicDrawer  epic={selectedEpic}  stories={stories.filter(s=>s.epicId===selectedEpic.id)} onClose={()=>setSelectedEpic(null)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRINT BOARD VIEW  (with burndown)
// ═══════════════════════════════════════════════════════════════════════════
function SprintBoardView({ stories, sprint, setDragItem, dragOver, setDragOver, onDrop, onSelectStory, epics, wsColor }) {
  const [showBurndown, setShowBurndown] = useState(true);
  const [filterAssignee, setFilterAssignee] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const assignees = ["All", ...new Set(stories.map(s=>s.assignee).filter(Boolean))];

  const filtered = stories.filter(s=>
    (filterAssignee==="All"||s.assignee===filterAssignee) &&
    (filterPriority==="All"||s.priority===filterPriority)
  );

  const colStories = col => filtered.filter(s=>{
    if (col==="To Do")      return s.status==="To Do";
    if (col==="In Progress") return s.status==="In Progress";
    if (col==="Review")     return s.status==="Review";
    if (col==="Testing")    return s.status==="Testing";
    if (col==="Done")       return s.status==="Done";
    return false;
  });
  const colCfg = {
    "To Do":       { color:C.grey500,  bg:C.grey100     },
    "In Progress": { color:C.blue,     bg:"#EFF6FF"     },
    "Review":      { color:C.purple,   bg:C.purpleLight },
    "Testing":     { color:C.teal,     bg:C.tealLight   },
    "Done":        { color:C.green,    bg:C.greenLight   },
  };

  return (
    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
      {/* Sprint header card */}
      <div style={{ background:C.white, borderRadius:10, border:`1px solid ${C.grey200}`, padding:"14px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>{sprint?.name||"No Active Sprint"}</span>
              <Badge label="Active" color={C.greenLight} textColor={C.green} dot/>
            </div>
            <div style={{ fontSize:12, color:C.grey400, marginTop:2 }}>{sprint?.start} → {sprint?.end}</div>
          </div>
          <div style={{ flex:1 }}/>
          {/* Sprint stats */}
          {[["Committed",`${sprint?.points||0} pts`,C.grey700],["Completed",`${sprint?.done||0} pts`,C.blue],["Remaining",`${(sprint?.points||0)-(sprint?.done||0)} pts`,C.amber]].map(([l,v,col])=>(
            <div key={l} style={{ textAlign:"center", minWidth:70 }}>
              <div style={{ fontSize:18, fontWeight:700, color:col }}>{v}</div>
              <div style={{ fontSize:10, color:C.grey400 }}>{l}</div>
            </div>
          ))}
          <div style={{ width:180 }}>
            <div style={{ fontSize:11, color:C.grey400, marginBottom:3 }}>Sprint {Math.round(((sprint?.done||0)/(sprint?.points||1))*100)}% done</div>
            <ProgressBar pct={((sprint?.done||0)/(sprint?.points||1))*100} color={wsColor||C.blue} height={8}/>
          </div>
          {/* Controls */}
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <Select value={filterAssignee} onChange={setFilterAssignee} options={assignees.map(a=>({value:a,label:a==="All"?"All Assignees":a}))} small/>
            <Select value={filterPriority} onChange={setFilterPriority} options={["All","Critical","High","Medium","Low"].map(p=>({value:p,label:p==="All"?"All Priorities":p}))} small/>
            <Btn label={showBurndown?"Hide Chart":"📉 Burndown"} onClick={()=>setShowBurndown(p=>!p)} variant="secondary" small/>
            <Btn label="Complete Sprint" variant="primary" small/>
          </div>
        </div>
      </div>

      {/* Burndown chart */}
      {showBurndown && (
        <BurndownChart data={BURNDOWN_DATA} title={`Sprint Burndown — ${sprint?.name}`} width={560} height={210}/>
      )}

      {/* Board columns */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, minHeight:450 }}>
        {BOARD_COLUMNS.map(col=>{
          const cols = colStories(col);
          const cfg  = colCfg[col];
          const over = dragOver===col;
          return (
            <div key={col} onDragOver={e=>{e.preventDefault();setDragOver(col);}} onDrop={e=>onDrop(e,col)} onDragLeave={()=>setDragOver(null)}
              style={{ background:over?cfg.bg:C.white, border:`1.5px solid ${over?cfg.color:C.grey200}`, borderRadius:10, display:"flex", flexDirection:"column", transition:"all 0.15s" }}>
              <div style={{ padding:"10px 12px", borderBottom:`1px solid ${C.grey200}`, display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:cfg.color, flexShrink:0 }}/>
                <span style={{ fontWeight:700, fontSize:12, color:C.grey700, flex:1 }}>{col}</span>
                <span style={{ fontSize:10, color:C.grey400, background:C.grey100, borderRadius:10, padding:"1px 6px", fontWeight:600 }}>{cols.length}</span>
              </div>
              <div style={{ padding:8, display:"flex", flexDirection:"column", gap:7, flex:1 }}>
                {cols.map(s=><BoardCard key={s.id} story={s} epics={epics} onDragStart={id=>setDragItem(id)} onClick={()=>onSelectStory(s)} col={col}/>)}
                {cols.length===0&&<div style={{ textAlign:"center", color:C.grey300, fontSize:11, marginTop:24 }}>Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ story, epics, onDragStart, onClick, col }) {
  const epic = epics.find(e=>e.id===story.epicId);
  return (
    <div draggable onDragStart={()=>onDragStart(story.id)} onClick={onClick}
      style={{ background:C.white, border:`1.5px solid ${C.grey200}`, borderLeft:`3.5px solid ${epic?.color||C.grey300}`, borderRadius:8, padding:"9px 11px", cursor:"grab", transition:"box-shadow 0.15s" }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.10)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
      <div style={{ fontSize:10, color:C.grey400, marginBottom:3 }}>{story.id}</div>
      <div style={{ fontSize:12.5, fontWeight:600, color:C.grey800, lineHeight:1.4, marginBottom:7 }}>{story.title.length>75?story.title.slice(0,75)+"…":story.title}</div>
      <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
        <Badge label={story.priority} color={priorityBg(story.priority)} textColor={priorityColor(story.priority)} small/>
        <span style={{ background:tshirtBg(story.tshirt), color:tshirtColor(story.tshirt), borderRadius:3, padding:"1px 5px", fontSize:9, fontWeight:700 }}>{story.tshirt}</span>
        {story.points&&<span style={{ background:C.grey100, color:C.grey600, borderRadius:3, padding:"1px 5px", fontSize:9, fontWeight:700 }}>{story.points}pt</span>}
        <div style={{ flex:1 }}/>
        <Avatar name={story.assignee} size={20}/>
      </div>
      {story.tasks>0&&(
        <div style={{ marginTop:7, display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:9, color:C.grey400 }}>{story.tasksDone}/{story.tasks} tasks</span>
          <ProgressBar pct={(story.tasksDone/story.tasks)*100} color={epic?.color||C.blue} height={3}/>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKLOG VIEW
// ═══════════════════════════════════════════════════════════════════════════
function BacklogView({ stories, epics, onSelectStory, sprints, setStories, activeSprint, ws }) {
  const [dragId, setDragId]       = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const [epicFilter, setEpicFilter]   = useState("All");
  const [statusFilter, setStatusFilter] = useState("Backlog");
  const [showAdd, setShowAdd]     = useState(false);
  const [deleteId, setDeleteId]   = useState(null);

  const filtered = stories.filter(s=>
    (epicFilter==="All"||s.epicId===epicFilter) &&
    (statusFilter==="All"||s.status===statusFilter||(!s.sprint&&statusFilter==="Backlog"))
  );
  const backlogItems = filtered.filter(s=>!s.sprint||s.status==="Backlog");
  const sprintItems  = stories.filter(s=>s.sprint===activeSprint?.name);

  function handleDropSprint(e) {
    e.preventDefault();
    if (!dragId) return;
    setStories(p=>p.map(s=>s.id===dragId?{...s,sprint:activeSprint?.name,status:"To Do"}:s));
    setDragId(null); setDropActive(false);
  }
  function handleAddStory(data) {
    const id = `US-${String(stories.length+1).padStart(3,"0")}`;
    setStories(p=>[...p, { id, wsId:ws.id, epicId:data.epicId, title:data.title, status:"Backlog", points:data.points?Number(data.points):null, tshirt:data.tshirt, priority:data.priority, assignee:data.assignee||null, sprint:null, tags:[], tasks:0, tasksDone:0, ac:[] }]);
    setShowAdd(false);
  }
  function handleDelete(id) {
    setStories(p=>p.filter(s=>s.id!==id));
    setDeleteId(null);
  }

  return (
    <div style={{ padding:20, display:"flex", gap:16 }}>
      <div style={{ flex:1 }}>
        {/* Toolbar */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          <span style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>Product Backlog</span>
          <Badge label={`${backlogItems.length}`} color={C.blueLight} textColor={C.blue}/>
          <div style={{ flex:1 }}/>
          <Select value={epicFilter} onChange={setEpicFilter} options={[{value:"All",label:"All Epics"},...epics.map(e=>({value:e.id,label:e.title.slice(0,22)}))]} small/>
          <Select value={statusFilter} onChange={setStatusFilter} options={[{value:"All",label:"All Statuses"},{value:"Backlog",label:"Backlog"},{value:"To Do",label:"To Do"},{value:"In Progress",label:"In Progress"}]} small/>
          <Btn label="+ Add Story" variant="primary" onClick={()=>setShowAdd(true)}/>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {backlogItems.map((s,i)=>{
            const epic = epics.find(e=>e.id===s.epicId);
            return (
              <div key={s.id} draggable onDragStart={()=>setDragId(s.id)}
                style={{ background:C.white, border:`1px solid ${C.grey200}`, borderLeft:`3px solid ${epic?.color||C.grey300}`, borderRadius:8, padding:"9px 14px", cursor:"grab", display:"flex", alignItems:"center", gap:10, transition:"box-shadow 0.12s" }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.07)"}
                onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                <span style={{ fontSize:12, color:C.grey300, fontWeight:600, minWidth:22 }}>{i+1}</span>
                <div style={{ flex:1, cursor:"pointer" }} onClick={()=>onSelectStory(s)}>
                  <div style={{ fontSize:10, color:C.grey400 }}>{s.id} · {epic?.title}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.grey800, lineHeight:1.3 }}>{s.title.length>85?s.title.slice(0,85)+"…":s.title}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                  <Badge label={s.priority} color={priorityBg(s.priority)} textColor={priorityColor(s.priority)} small/>
                  <span style={{ background:tshirtBg(s.tshirt), color:tshirtColor(s.tshirt), borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{s.tshirt}</span>
                  {s.points&&<span style={{ background:C.grey100, color:C.grey600, borderRadius:4, padding:"1px 6px", fontSize:10 }}>{s.points}pt</span>}
                  <Avatar name={s.assignee} size={22}/>
                  <Btn label="✎" variant="ghost" small onClick={()=>onSelectStory(s)}/>
                  <Btn label="✕" danger small onClick={()=>setDeleteId(s.id)}/>
                </div>
              </div>
            );
          })}
          {backlogItems.length===0&&<div style={{ textAlign:"center", padding:40, color:C.grey300, fontSize:13 }}>No backlog items match filters</div>}
        </div>
      </div>

      {/* Sprint drop zone */}
      <div style={{ width:300, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <span style={{ fontWeight:700, fontSize:14, color:C.grey800 }}>{activeSprint?.name||"No Active Sprint"}</span>
          {activeSprint&&<Badge label="Active" color={C.greenLight} textColor={C.green} dot small/>}
        </div>
        <div onDragOver={e=>{e.preventDefault();setDropActive(true);}} onDrop={handleDropSprint} onDragLeave={()=>setDropActive(false)}
          style={{ minHeight:180, background:dropActive?"#EFF6FF":C.grey50, border:`2px dashed ${dropActive?C.blue:C.grey300}`, borderRadius:10, padding:12, transition:"all 0.15s", marginBottom:12 }}>
          <div style={{ textAlign:"center", fontSize:11, color:dropActive?C.blue:C.grey300, fontWeight:600, marginBottom:10 }}>{dropActive?"Drop to add →":"⬅ Drag stories here"}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {sprintItems.map(s=>(
              <div key={s.id} style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:6, padding:"6px 10px", fontSize:11 }}>
                <div style={{ fontWeight:600, color:C.grey700 }}>{s.title.slice(0,55)}{s.title.length>55?"…":""}</div>
                <div style={{ display:"flex", gap:5, marginTop:4, alignItems:"center" }}>
                  <Badge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small/>
                  {s.points&&<span style={{ fontSize:9, color:C.grey400 }}>{s.points}pt</span>}
                  <Avatar name={s.assignee} size={16}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Capacity indicator */}
        <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:14 }}>
          <div style={{ fontWeight:700, fontSize:12, color:C.grey700, marginBottom:10 }}>Sprint Capacity</div>
          {[["Story Points", sprintItems.reduce((a,s)=>a+(s.points||0),0), activeSprint?.points||34],
            ["Stories", sprintItems.length, 10]].map(([label,val,cap])=>(
            <div key={label} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.grey500, marginBottom:3 }}>
                <span>{label}</span><span style={{ fontWeight:700 }}>{val} / {cap}</span>
              </div>
              <ProgressBar pct={(val/cap)*100} color={val>cap?C.red:C.teal} height={6}/>
            </div>
          ))}
        </div>
      </div>

      {showAdd&&(
        <Modal title="Add User Story" onClose={()=>setShowAdd(false)}>
          <AddStoryForm epics={epics} onSave={handleAddStory} onCancel={()=>setShowAdd(false)}/>
        </Modal>
      )}
      {deleteId&&<ConfirmDelete label={stories.find(s=>s.id===deleteId)?.id} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

function AddStoryForm({ epics, onSave, onCancel, initial={} }) {
  const [form, setForm] = useState({ title:"", epicId:epics[0]?.id||"", priority:"Medium", tshirt:"M", points:"", assignee:"", ...initial });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div>
      <FormField label="Story Title" required><input style={inputStyle} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="As a [role], I want [goal] so that [benefit]"/></FormField>
      <FormField label="Epic" required>
        <select style={inputStyle} value={form.epicId} onChange={e=>set("epicId",e.target.value)}>
          {epics.map(e=><option key={e.id} value={e.id}>{e.id} – {e.title}</option>)}
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
        <Btn label="Cancel" onClick={onCancel}/>
        <Btn label="Save Story" variant="primary" onClick={()=>form.title&&form.epicId&&onSave(form)}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EPICS VIEW  (with burn-up per epic)
// ═══════════════════════════════════════════════════════════════════════════
function EpicsView({ epics, stories, onSelect, setEpics, ws }) {
  const [showAdd, setShowAdd]     = useState(false);
  const [editEpic, setEditEpic]   = useState(null);
  const [deleteId, setDeleteId]   = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch]       = useState("");

  const filtered = epics.filter(e=>
    (statusFilter==="All"||e.status===statusFilter) &&
    (search===""||e.title.toLowerCase().includes(search.toLowerCase()))
  );

  function handleSave(data) {
    if (editEpic) {
      setEpics(p=>p.map(e=>e.id===editEpic.id?{...e,...data}:e));
    } else {
      const id=`EP-${String(epics.length+1).padStart(3,"0")}`;
      setEpics(p=>[...p,{id,wsId:ws.id,color:ws.color,stories:0,storiesDone:0,progress:0,tags:[],description:data.description||"",...data}]);
    }
    setShowAdd(false); setEditEpic(null);
  }
  function handleDelete(id) { setEpics(p=>p.filter(e=>e.id!==id)); setDeleteId(null); }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>Epics</span>
        <Badge label={`${filtered.length}`} color={C.blueLight} textColor={C.blue}/>
        <div style={{ flex:1 }}/>
        <input style={{ ...inputStyle, width:200, padding:"5px 10px" }} placeholder="🔍 Search epics…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <Select value={statusFilter} onChange={setStatusFilter} options={[{value:"All",label:"All Statuses"},{value:"Active",label:"Active"},{value:"Planning",label:"Planning"},{value:"Done",label:"Done"}]} small/>
        <Btn label="+ New Epic" variant="primary" onClick={()=>setShowAdd(true)}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))", gap:16 }}>
        {filtered.map(epic=>{
          const epicStories = stories.filter(s=>s.epicId===epic.id);
          const done = epicStories.filter(s=>s.status==="Done").length;
          const buData = BURNUP_DATA[epic.id];
          return (
            <div key={epic.id} style={{ background:C.white, border:`1.5px solid ${C.grey200}`, borderTop:`4px solid ${epic.color}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:8 }}>
                  <div style={{ flex:1, cursor:"pointer" }} onClick={()=>onSelect(epic)}>
                    <div style={{ fontSize:11, color:C.grey400 }}>{epic.id} · {epic.initiative}</div>
                    <div style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>{epic.title}</div>
                  </div>
                  <Badge label={epic.status} color={statusBg(epic.status)} textColor={statusColor(epic.status)} dot small/>
                  <div style={{ display:"flex", gap:4 }}>
                    <Btn label="✎" variant="ghost" small onClick={()=>setEditEpic(epic)}/>
                    <Btn label="✕" danger small onClick={()=>setDeleteId(epic.id)}/>
                  </div>
                </div>
                <div style={{ fontSize:12.5, color:C.grey500, marginBottom:10, lineHeight:1.5 }}>{epic.description}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                  <Badge label={epic.priority} color={priorityBg(epic.priority)} textColor={priorityColor(epic.priority)} small/>
                  <span style={{ background:tshirtBg(epic.tshirt), color:tshirtColor(epic.tshirt), borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{epic.tshirt}</span>
                  {epic.tags.map(t=><Badge key={t} label={t} color={C.grey100} textColor={C.grey600} small/>)}
                </div>
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.grey400, marginBottom:3 }}>
                    <span>Progress</span><span>{done}/{epicStories.length} stories · {epic.progress}%</span>
                  </div>
                  <ProgressBar pct={epic.progress} color={epic.color} height={6}/>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <Avatar name={epic.owner} size={22}/>
                  <span style={{ fontSize:11, color:C.grey500 }}>{epic.owner}</span>
                </div>
              </div>
              {/* Burn-up chart embedded */}
              {buData&&(
                <div style={{ borderTop:`1px solid ${C.grey100}`, padding:"10px 12px", background:C.grey50 }}>
                  <BurnUpChart data={buData} title="Burn-up (Stories Completed vs Scope)" color={epic.color} width={330} height={150}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(showAdd||editEpic)&&(
        <Modal title={editEpic?"Edit Epic":"New Epic"} onClose={()=>{setShowAdd(false);setEditEpic(null);}}>
          <EpicForm initial={editEpic||{}} onSave={handleSave} onCancel={()=>{setShowAdd(false);setEditEpic(null);}}/>
        </Modal>
      )}
      {deleteId&&<ConfirmDelete label={epics.find(e=>e.id===deleteId)?.title} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

function EpicForm({ initial={}, onSave, onCancel }) {
  const [form,setForm] = useState({ title:"", initiative:"", owner:"", status:"Planning", tshirt:"L", priority:"High", description:"", ...initial });
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <div>
      <FormField label="Epic Title" required><input style={inputStyle} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Customer Order Management"/></FormField>
      <FormField label="Initiative"><input style={inputStyle} value={form.initiative} onChange={e=>set("initiative",e.target.value)} placeholder="e.g. ERP Phase 1"/></FormField>
      <FormField label="Description"><textarea style={textareaStyle} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe what this epic delivers…"/></FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
        <FormField label="Status"><select style={inputStyle} value={form.status} onChange={e=>set("status",e.target.value)}>{["Planning","Active","Done","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></FormField>
        <FormField label="T-Shirt"><select style={inputStyle} value={form.tshirt} onChange={e=>set("tshirt",e.target.value)}>{["XS","S","M","L","XL","XXL"].map(t=><option key={t}>{t}</option>)}</select></FormField>
        <FormField label="Priority"><select style={inputStyle} value={form.priority} onChange={e=>set("priority",e.target.value)}>{["Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}</select></FormField>
        <FormField label="Owner"><input style={inputStyle} value={form.owner} onChange={e=>set("owner",e.target.value)} placeholder="Name"/></FormField>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn label="Cancel" onClick={onCancel}/><Btn label="Save Epic" variant="primary" onClick={()=>form.title&&onSave(form)}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STORIES VIEW
// ═══════════════════════════════════════════════════════════════════════════
function StoriesView({ stories, epics, onSelect, setStories, ws }) {
  const [epicFilter, setEpicFilter]     = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch]             = useState("");
  const [showAdd, setShowAdd]           = useState(false);
  const [deleteId, setDeleteId]         = useState(null);

  const filtered = stories.filter(s=>
    (epicFilter==="All"||s.epicId===epicFilter) &&
    (statusFilter==="All"||s.status===statusFilter) &&
    (search===""||s.title.toLowerCase().includes(search.toLowerCase())||s.id.toLowerCase().includes(search.toLowerCase()))
  );

  function handleAdd(data) {
    const id=`US-${String(stories.length+1).padStart(3,"0")}`;
    setStories(p=>[...p,{id,wsId:ws.id,epicId:data.epicId,title:data.title,status:"Backlog",points:data.points?Number(data.points):null,tshirt:data.tshirt,priority:data.priority,assignee:data.assignee||null,sprint:null,tags:[],tasks:0,tasksDone:0,ac:[]}]);
    setShowAdd(false);
  }
  function handleDelete(id) { setStories(p=>p.filter(s=>s.id!==id)); setDeleteId(null); }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>User Stories</span>
        <Badge label={`${filtered.length}`} color={C.blueLight} textColor={C.blue}/>
        <div style={{ flex:1 }}/>
        <input style={{ ...inputStyle, width:180, padding:"5px 10px" }} placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <Select value={epicFilter} onChange={setEpicFilter} options={[{value:"All",label:"All Epics"},...epics.map(e=>({value:e.id,label:`${e.id} ${e.title.slice(0,18)}`}))]} small/>
        <Select value={statusFilter} onChange={setStatusFilter} options={[{value:"All",label:"All Statuses"},{value:"Backlog",label:"Backlog"},{value:"To Do",label:"To Do"},{value:"In Progress",label:"In Progress"},{value:"Done",label:"Done"}]} small/>
        <Btn label="+ New Story" variant="primary" onClick={()=>setShowAdd(true)}/>
      </div>

      <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 90px 60px 90px 90px 44px 60px", padding:"8px 14px", background:C.grey50, borderBottom:`1px solid ${C.grey200}`, fontSize:10, fontWeight:700, color:C.grey500, gap:10 }}>
          <span>Story</span><span>Epic</span><span>Status</span><span>Pts</span><span>Priority</span><span>Sprint</span><span>Owner</span><span>Actions</span>
        </div>
        {filtered.map((s,i)=>{
          const epic=epics.find(e=>e.id===s.epicId);
          return (
            <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr 110px 90px 60px 90px 90px 44px 60px", padding:"9px 14px", borderBottom:i<filtered.length-1?`1px solid ${C.grey100}`:"none", alignItems:"center", gap:10, transition:"background 0.1s" }}
              onMouseEnter={e=>e.currentTarget.style.background=C.grey50}
              onMouseLeave={e=>e.currentTarget.style.background=""}>
              <div style={{ cursor:"pointer" }} onClick={()=>onSelect(s)}>
                <div style={{ fontSize:10, color:C.grey400 }}>{s.id}</div>
                <div style={{ fontSize:13, fontWeight:500, color:C.grey800 }}>{s.title.length>65?s.title.slice(0,65)+"…":s.title}</div>
              </div>
              <div style={{ fontSize:11, color:epic?.color||C.grey500, fontWeight:600 }}>{epic?.title?.split(" ").slice(0,2).join(" ")}</div>
              <Badge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small/>
              <span style={{ fontWeight:700, fontSize:12, color:C.grey700 }}>{s.points||<span style={{color:C.grey300}}>—</span>}</span>
              <Badge label={s.priority} color={priorityBg(s.priority)} textColor={priorityColor(s.priority)} small/>
              <span style={{ fontSize:11, color:C.grey500 }}>{s.sprint||<span style={{color:C.grey300}}>—</span>}</span>
              <Avatar name={s.assignee} size={22}/>
              <div style={{ display:"flex", gap:3 }}>
                <Btn label="✎" variant="ghost" small onClick={()=>onSelect(s)}/>
                <Btn label="✕" danger small onClick={()=>setDeleteId(s.id)}/>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{ padding:40, textAlign:"center", color:C.grey300, fontSize:13 }}>No stories found</div>}
      </div>

      {showAdd&&<Modal title="New User Story" onClose={()=>setShowAdd(false)}><AddStoryForm epics={epics} onSave={handleAdd} onCancel={()=>setShowAdd(false)}/></Modal>}
      {deleteId&&<ConfirmDelete label={stories.find(s=>s.id===deleteId)?.id} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRINTS VIEW
// ═══════════════════════════════════════════════════════════════════════════
function SprintsView({ sprints, stories, setSprints, ws }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  function handleAdd(data) {
    const id=`SP-${String(sprints.length+1).padStart(3,"0")}`;
    setSprints(p=>[...p,{id,wsId:ws.id,name:data.name,status:"Planned",start:data.start,end:data.end,points:Number(data.points)||0,done:0}]);
    setShowAdd(false);
  }
  function handleDelete(id) { setSprints(p=>p.filter(s=>s.id!==id)); setDeleteId(null); }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>Sprints</span>
        <Badge label={`${sprints.length}`} color={C.blueLight} textColor={C.blue}/>
        <div style={{ flex:1 }}/>
        <Btn label="+ New Sprint" variant="primary" onClick={()=>setShowAdd(true)}/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {sprints.map(sp=>{
          const spStories=stories.filter(s=>s.sprint===sp.name);
          const done=spStories.filter(s=>s.status==="Done");
          return (
            <div key={sp.id} style={{ background:C.white, border:`1.5px solid ${C.grey200}`, borderLeft:`4px solid ${statusColor(sp.status)}`, borderRadius:10, padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
                <span style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>{sp.name}</span>
                <Badge label={sp.status} color={statusBg(sp.status)} textColor={statusColor(sp.status)} dot/>
                <span style={{ fontSize:12, color:C.grey400 }}>{sp.start} → {sp.end}</span>
                <div style={{ flex:1 }}/>
                <span style={{ fontSize:12, color:C.grey500 }}>{done.length}/{spStories.length} stories · {sp.done}/{sp.points} pts</span>
                <div style={{ display:"flex", gap:6 }}>
                  {sp.status==="Planned"&&<Btn label="Start Sprint" variant="primary" small onClick={()=>setSprints(p=>p.map(s=>s.id===sp.id?{...s,status:"Active"}:s))}/>}
                  {sp.status==="Active"&&<Btn label="Complete Sprint" variant="secondary" small onClick={()=>setSprints(p=>p.map(s=>s.id===sp.id?{...s,status:"Closed"}:s))}/>}
                  <Btn label="✕" danger small onClick={()=>setDeleteId(sp.id)}/>
                </div>
              </div>
              <ProgressBar pct={sp.points?(sp.done/sp.points)*100:0} color={statusColor(sp.status)} height={6}/>
              {spStories.length>0&&(
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
                  {spStories.map(s=><div key={s.id} style={{ padding:"3px 9px", borderRadius:5, border:`1px solid ${C.grey200}`, fontSize:10, color:C.grey600, background:statusBg(s.status), display:"flex", gap:4, alignItems:"center" }}><span style={{width:5,height:5,borderRadius:"50%",background:statusColor(s.status),flexShrink:0}}/>{s.id}</div>)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAdd&&(
        <Modal title="New Sprint" onClose={()=>setShowAdd(false)}>
          <SprintForm onSave={handleAdd} onCancel={()=>setShowAdd(false)}/>
        </Modal>
      )}
      {deleteId&&<ConfirmDelete label={sprints.find(s=>s.id===deleteId)?.name} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

function SprintForm({ onSave, onCancel }) {
  const [form,setForm]=useState({name:"",start:"",end:"",points:""});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <div>
      <FormField label="Sprint Name" required><input style={inputStyle} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Sprint 5 — O2C"/></FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        <FormField label="Start Date"><input style={inputStyle} type="date" value={form.start} onChange={e=>set("start",e.target.value)}/></FormField>
        <FormField label="End Date"><input style={inputStyle} type="date" value={form.end} onChange={e=>set("end",e.target.value)}/></FormField>
        <FormField label="Capacity (pts)"><input style={inputStyle} type="number" value={form.points} onChange={e=>set("points",e.target.value)} placeholder="e.g. 30"/></FormField>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn label="Cancel" onClick={onCancel}/><Btn label="Create Sprint" variant="primary" onClick={()=>form.name&&onSave(form)}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFECTS VIEW
// ═══════════════════════════════════════════════════════════════════════════
function DefectsView({ defects, stories, setDefects, ws }) {
  const [showAdd, setShowAdd]     = useState(false);
  const [deleteId, setDeleteId]   = useState(null);
  const [sevFilter, setSevFilter] = useState("All");
  const [stFilter, setStFilter]   = useState("All");
  const [search, setSearch]       = useState("");

  const filtered = defects.filter(d=>
    (sevFilter==="All"||d.severity===sevFilter)&&
    (stFilter==="All"||d.status===stFilter)&&
    (search===""||d.title.toLowerCase().includes(search.toLowerCase())||d.id.toLowerCase().includes(search.toLowerCase()))
  );

  function handleAdd(data) {
    const id=`DEF-${String(defects.length+1).padStart(3,"0")}`;
    setDefects(p=>[...p,{id,wsId:ws.id,storyId:data.storyId||null,...data,status:"New"}]);
    setShowAdd(false);
  }
  function handleDelete(id) { setDefects(p=>p.filter(d=>d.id!==id)); setDeleteId(null); }

  const sevColor = s=>({ Critical:C.red, Major:C.amber, Minor:C.blue, Trivial:C.grey400 }[s]||C.grey400);
  const sevBg    = s=>({ Critical:C.redLight, Major:C.amberLight, Minor:C.blueLight, Trivial:C.grey100 }[s]||C.grey100);
  const envColor = e=>({ Prod:C.red, UAT:C.amber, SIT:C.blue, Dev:C.grey500 }[e]||C.grey500);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.grey800 }}>🐛 Defects</span>
        <Badge label={`${filtered.length}`} color={C.redLight} textColor={C.red}/>
        <div style={{ flex:1 }}/>
        <input style={{ ...inputStyle, width:180, padding:"5px 10px" }} placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <Select value={sevFilter} onChange={setSevFilter} options={[{value:"All",label:"All Severities"},{value:"Critical",label:"Critical"},{value:"Major",label:"Major"},{value:"Minor",label:"Minor"},{value:"Trivial",label:"Trivial"}]} small/>
        <Select value={stFilter} onChange={setStFilter} options={[{value:"All",label:"All Statuses"},{value:"New",label:"New"},{value:"In Progress",label:"In Progress"},{value:"Fixed",label:"Fixed"},{value:"Closed",label:"Closed"}]} small/>
        <Btn label="+ Raise Defect" variant="primary" onClick={()=>setShowAdd(true)}/>
      </div>

      <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 90px 80px 110px 60px 50px 70px", padding:"8px 14px", background:C.grey50, borderBottom:`1px solid ${C.grey200}`, fontSize:10, fontWeight:700, color:C.grey500, gap:10 }}>
          <span>Defect</span><span>Story</span><span>Severity</span><span>Priority</span><span>Status</span><span>Env</span><span>Owner</span><span>Actions</span>
        </div>
        {filtered.map((d,i)=>{
          const story=stories.find(s=>s.id===d.storyId);
          return (
            <div key={d.id} style={{ display:"grid", gridTemplateColumns:"1fr 100px 90px 80px 110px 60px 50px 70px", padding:"10px 14px", borderBottom:i<filtered.length-1?`1px solid ${C.grey100}`:"none", alignItems:"center", gap:10 }}
              onMouseEnter={e=>e.currentTarget.style.background=C.grey50}
              onMouseLeave={e=>e.currentTarget.style.background=""}>
              <div>
                <div style={{ fontSize:10, color:C.red, fontWeight:600 }}>{d.id}</div>
                <div style={{ fontSize:13, fontWeight:500, color:C.grey800 }}>{d.title}</div>
              </div>
              <span style={{ fontSize:11, color:C.grey500 }}>{d.storyId||"—"}</span>
              <Badge label={d.severity} color={sevBg(d.severity)} textColor={sevColor(d.severity)} small dot/>
              <Badge label={d.priority} color={priorityBg(d.priority)} textColor={priorityColor(d.priority)} small/>
              <Badge label={d.status} color={statusBg(d.status)} textColor={statusColor(d.status)} dot small/>
              <span style={{ fontSize:11, fontWeight:700, color:envColor(d.environment) }}>{d.environment}</span>
              <Avatar name={d.assignee} size={22}/>
              <div style={{ display:"flex", gap:3 }}>
                <Btn label="✎" variant="ghost" small/>
                <Btn label="✕" danger small onClick={()=>setDeleteId(d.id)}/>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{ padding:40, textAlign:"center", color:C.grey300, fontSize:13 }}>No defects found</div>}
      </div>

      {showAdd&&(
        <Modal title="Raise Defect" onClose={()=>setShowAdd(false)}>
          <DefectForm stories={stories} onSave={handleAdd} onCancel={()=>setShowAdd(false)}/>
        </Modal>
      )}
      {deleteId&&<ConfirmDelete label={defects.find(d=>d.id===deleteId)?.id} onConfirm={()=>handleDelete(deleteId)} onCancel={()=>setDeleteId(null)}/>}
    </div>
  );
}

function DefectForm({ stories, onSave, onCancel }) {
  const [form,setForm]=useState({ title:"", storyId:"", severity:"Major", priority:"High", environment:"Dev", assignee:"" });
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <div>
      <FormField label="Defect Title" required><input style={inputStyle} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Briefly describe the defect"/></FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <FormField label="Linked Story">
          <select style={inputStyle} value={form.storyId} onChange={e=>set("storyId",e.target.value)}>
            <option value="">— None —</option>
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
        <Btn label="Cancel" onClick={onCancel}/><Btn label="Raise Defect" variant="primary" onClick={()=>form.title&&onSave(form)}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROADMAP VIEW
// ═══════════════════════════════════════════════════════════════════════════
function RoadmapView({ epics, sprints }) {
  const months=["Jan 26","Feb 26","Mar 26","Apr 26","May 26","Jun 26","Jul 26","Aug 26","Sep 26","Oct 26"];
  const epicTimelines={ "EP-001":{start:0,width:4}, "EP-002":{start:0,width:2}, "EP-003":{start:2,width:5}, "EP-004":{start:1,width:4}, "EP-005":{start:3,width:4} };
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
                    {inRange&&<div style={{ width:"100%", height:26, background:epic.color, opacity:0.85, borderRadius:`${isStart?"6px":"0"} ${isEnd?"6px":"0"} ${isEnd?"6px":"0"} ${isStart?"6px":"0"}`, display:"flex", alignItems:"center" }}>
                      {isStart&&<span style={{ fontSize:9, color:C.white, fontWeight:700, paddingLeft:6 }}>{epic.tshirt}</span>}
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
            <Badge label={sp.status} color={statusBg(sp.status)} textColor={statusColor(sp.status)} dot small/>
            <div style={{ fontSize:11, color:C.grey400, margin:"6px 0" }}>{sp.start}<br/>{sp.end}</div>
            <div style={{ fontWeight:700, fontSize:20, color:statusColor(sp.status) }}>{sp.done}/{sp.points}</div>
            <div style={{ fontSize:10, color:C.grey400, marginBottom:6 }}>pts done</div>
            <ProgressBar pct={sp.points?(sp.done/sp.points)*100:0} color={statusColor(sp.status)} height={5}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BEST PRACTICE PAGE
// ═══════════════════════════════════════════════════════════════════════════
function BestPracticeView() {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id:"overview",   icon:"🏠", title:"Overview" },
    { id:"epics",      icon:"⚡", title:"Writing Great Epics" },
    { id:"stories",    icon:"📖", title:"User Story Best Practice" },
    { id:"backlog",    icon:"📋", title:"Backlog Refinement" },
    { id:"sprint",     icon:"🏃", title:"Sprint Ceremonies" },
    { id:"board",      icon:"🗂", title:"Running the Board" },
    { id:"burndown",   icon:"📉", title:"Reading Burndown Charts" },
    { id:"defects",    icon:"🐛", title:"Defect Management" },
    { id:"workstream", icon:"🔀", title:"Multi-Workstream at Scale" },
    { id:"dod",        icon:"✅", title:"Definition of Done" },
  ];

  const content = {
    overview: {
      title:"Jiganto Agile Board — How to Get the Best Out of It",
      intro:"Jiganto's Agile Board is designed to give you full traceability from a strategic objective all the way through to delivered code in production. This guide will help your team adopt it quickly and run high-quality Scrum ceremonies from day one.",
      blocks:[
        { heading:"The Golden Rule", type:"highlight", text:"Every item in the board must link upward to an Epic → Initiative → Strategic Objective. If you can't explain why a story exists in terms of business value, it shouldn't be in the backlog." },
        { heading:"The Hierarchy at a Glance", type:"chain", items:["Strategic Objective / OKR","Initiative","Epic","Feature (optional)","User Story (PBI)","Task / Sub-Task","Defect"] },
        { heading:"T-Shirt Sizing vs Story Points", type:"tip", text:"T-shirt sizes (XS → XXL) are great for quick relative sizing — especially for stakeholders who are new to estimation. Story points give you the precision needed for velocity tracking and burndown charts. Use both: T-shirt for epics and features, story points for the user stories you're committing to a sprint." },
        { heading:"Quick-Start Checklist", type:"checklist", items:["Set up your Workstreams before creating Epics","Create at least one Epic per Initiative","Write all User Stories in the 'As a… I want… So that…' format","Add Acceptance Criteria before a story enters a sprint","Run Backlog Refinement mid-sprint (not just at Sprint Planning)","Assign a Scrum Master to each active Workstream","Use the Burndown chart daily — not just at Sprint Review"] },
      ]
    },
    epics: {
      title:"Writing Great Epics",
      intro:"An Epic is a large, outcomes-focused body of work. It should describe a business capability or customer outcome — not a technical task.",
      blocks:[
        { heading:"The Epic Formula", type:"formula", text:'"We need to build [capability] so that [business outcome], which we will know is successful when [measurable result]."' },
        { heading:"Good vs Bad Epics", type:"table", rows:[["❌ Bad Epic","✅ Good Epic"],["Implement SAP","Enable Sales Reps to Create and Track Orders End-to-End"],["Fix the login","Deliver Secure, Single Sign-On for All Enterprise Users"],["Build reports","Give Portfolio Managers Real-Time Initiative Progress Visibility"]] },
        { heading:"T-Shirt Sizing for Epics", type:"tip", text:"Use T-shirt sizes to communicate scale to stakeholders without needing precise estimates. Anything XL or XXL should be questioned — can it be broken into two epics? A good sprint team can typically deliver one M–L epic per programme increment (6–8 sprints)." },
        { heading:"Epic Owner Responsibilities", type:"checklist", items:["Define and own the acceptance criteria for the epic","Prioritise stories within the epic against each other","Attend Sprint Review to validate progress","Update epic progress after each sprint","Signal when an epic needs splitting or descoping"] },
      ]
    },
    stories: {
      title:"User Story Best Practice",
      intro:"A User Story is the atomic unit of delivery. It represents one piece of user value that can be built, tested, and demonstrated within a single sprint.",
      blocks:[
        { heading:"The Standard Format", type:"formula", text:'"As a [specific role], I want [clear goal] so that [tangible benefit]."' },
        { heading:"INVEST Criteria", type:"table", rows:[["Letter","Quality","What it means"],["I","Independent","Can be developed and tested without waiting for another story"],["N","Negotiable","Scope is flexible; acceptance criteria pin down the detail"],["V","Valuable","Delivers something a user or stakeholder can recognise"],["E","Estimable","Small enough that the team can size it"],["S","Small","Fits entirely within one sprint"],["T","Testable","Acceptance criteria are clear and unambiguous"]] },
        { heading:"Writing Acceptance Criteria", type:"tip", text:'Use Given-When-Then (BDD) format: "Given [context], When [action], Then [outcome]." Every story needs at least two acceptance criteria before it can be pulled into a sprint. Stories with no AC are not ready.' },
        { heading:"Splitting Stories That Are Too Large", type:"checklist", items:["Split by user role: admin story vs end-user story","Split by workflow step: create order / amend order / cancel order","Split by data type: UK orders first, then international","Split by happy path first, then edge cases and error handling","Never split by technical layer (front-end vs back-end = not a user story split)"] },
      ]
    },
    backlog: {
      title:"Backlog Refinement — The Most Underrated Ceremony",
      intro:"Refinement is not a one-off activity at Sprint Planning. Run it mid-sprint, weekly, as an ongoing team habit. A well-refined backlog makes Sprint Planning fast and confident.",
      blocks:[
        { heading:"When to Refine", type:"tip", text:"Hold a 60–90 minute refinement session in the middle of each sprint (Day 6–8 of a 2-week sprint). The goal: ensure the top 2 sprints' worth of stories are estimated, have AC, and are dependency-checked before you need them." },
        { heading:"The DEEP Backlog", type:"table", rows:[["Quality","Description"],["Detailed Appropriately","Top stories have full AC. Lower-priority stories are just titles."],["Estimated","Top 20 stories are estimated (story points or T-shirt)"],["Emergent","The backlog grows and changes — that's normal and healthy"],["Prioritised","Ordered top-to-bottom by business value"]] },
        { heading:"Refinement Checklist per Story", type:"checklist", items:["Title written in user story format","Linked to an Epic","Acceptance Criteria added (minimum 2)","Dependencies identified and mapped","Estimated (story points or T-shirt)","Small enough to complete in one sprint (if not, split it)","Assignee suggested or left open for team to self-select at planning"] },
        { heading:"Red Flags in Your Backlog", type:"highlight", text:"If more than 20% of your top-10 backlog items have no story points or T-shirt size, your next refinement session is overdue. If any story has been in the backlog for more than 3 sprints without being pulled in, it needs to be re-prioritised or removed." },
      ]
    },
    sprint: {
      title:"Running Effective Sprint Ceremonies",
      intro:"Four ceremonies make Scrum work. Each has a specific purpose — don't let them blur into each other.",
      blocks:[
        { heading:"Sprint Planning", type:"table", rows:[["Aspect","Guidance"],["Duration","2 hours per sprint week (4 hours for a 2-week sprint)"],["Input","Refined, prioritised backlog; team capacity; sprint velocity"],["Output","Sprint backlog committed; sprint goal set"],["Key question","'Can we confidently deliver this sprint goal with our available capacity?'"]] },
        { heading:"Daily Stand-Up (15 mins max)", type:"checklist", items:["What did I complete yesterday?","What will I work on today?","What is blocking me?","Review the Sprint Board together — look at In Progress columns","Highlight any items approaching the Testing column","Surface blockers immediately — do not wait until tomorrow","In multi-workstream programmes: run per-workstream stand-ups, not one mega-stand-up"] },
        { heading:"Sprint Review", type:"tip", text:"This is a demo, not a status report. Show working software. Invite stakeholders and the Product Owner. Walk through each Done story against its acceptance criteria. Update the Epic progress after review." },
        { heading:"Retrospective", type:"checklist", items:["What went well? (celebrate, not just list)","What could be improved?","One specific action to try next sprint (not a wish list)","Check the burndown trend — were we behind from Day 1? (sprint planning issue) or did we drop off mid-sprint? (mid-sprint blocker)","Review defect count — more than 2 critical defects in a sprint signals a quality process issue"] },
      ]
    },
    board: {
      title:"Running the Scrum Board Like a Pro",
      intro:"The board is a live radiator of sprint health. It should reflect reality at all times — not what the team hopes is true.",
      blocks:[
        { heading:"WIP Limits Matter", type:"highlight", text:"Work-in-Progress limits are not bureaucracy — they are a flow mechanism. If your In Progress column always has 8 cards for a team of 4, you have context-switching, not progress. Aim for WIP ≤ team size." },
        { heading:"Column Discipline", type:"table", rows:[["Column","Entry Criteria","Exit Criteria"],["To Do","Story in sprint, not started","Dev picks it up"],["In Progress","Dev actively coding","PR raised or code complete"],["Review","PR raised for peer review","PR approved, no blockers"],["Testing","In QA environment","All AC verified, no open defects"],["Done","All AC met, PO accepts","Sprint review demonstrated"]] },
        { heading:"Board Hygiene Rules", type:"checklist", items:["Move your own cards — don't leave them for the Scrum Master","If a card is stuck in In Progress for 3+ days, raise it in stand-up","Done means Done — not 'mostly done'","Defects found in Testing link back to the parent story","Never move a card backward without a team discussion"] },
        { heading:"Using the Workstream Switcher", type:"tip", text:"In large programmes with multiple workstreams (e.g. O2C, P2P, R2R), use the workstream switcher at the top of the board to focus your stand-up. Never run a combined stand-up for more than 8 people — split by workstream." },
      ]
    },
    burndown: {
      title:"Reading and Acting on Burndown Charts",
      intro:"The burndown chart is one of the most powerful tools in a Scrum Master's kit — but only if you know what patterns to look for.",
      blocks:[
        { heading:"What a Healthy Burndown Looks Like", type:"tip", text:"The actual line should roughly track the ideal line, with natural daily variation. A team that finishes exactly on the ideal line every day is probably gaming the data. Expect the actual line to dip and jump — that's real work." },
        { heading:"Common Patterns & What They Mean", type:"table", rows:[["Pattern","What it means","Action"],["Flat for 3+ days","Stories blocked or team not updating board","Scrum Master: investigate blockers today"],["Sharp drop on Day 1","Stories added to sprint were already done or trivially small","Re-examine story sizing and definition of done"],["Actual line above ideal throughout","Sprint over-committed or team under-capacity","Reduce commitment next sprint; review velocity"],["Actual line below ideal from Day 1","Sprint under-committed","Optionally pull in backlog stories; avoid padding future sprints"],["Cliff-drop on last 2 days","Team holding stories until end ('hero mode')","Coach team to complete incrementally, not in batches"]] },
        { heading:"Burndown vs Burn-Up", type:"tip", text:"Sprint Burndown shows remaining work — it answers 'will we finish?'. Epic Burn-Up shows completed stories vs total scope — it answers 'when will this epic be done?'. Use Burn-Up for epics because scope often changes: a Burn-Up makes new scope visible as a step-up in the total line, which a burndown hides." },
        { heading:"T-Shirt Sizing and Burndown", type:"highlight", text:"T-shirt sizes are qualitative indicators — they don't feed into the burndown chart. If your team uses T-shirt sizing, the burndown is automatically driven by story count instead of points. This still gives you a valid trend line; just interpret it as 'stories remaining' rather than 'points remaining'." },
      ]
    },
    defects: {
      title:"Defect Management Best Practice",
      intro:"Defects are not an afterthought — they are first-class backlog items that compete for sprint capacity. The key is triage speed and transparent tracking.",
      blocks:[
        { heading:"The Defect Lifecycle", type:"chain", items:["New (raised)","Triaged (severity & priority set)","In Progress (fix assigned)","Fixed (code complete)","Verified (QA confirms fix)","Closed"] },
        { heading:"Severity vs Priority", type:"table", rows:[["","Definition","Example"],["Severity","Technical impact of the defect","Critical = data loss; Minor = cosmetic label wrong"],["Priority","Business urgency to fix","A cosmetic defect on the login page before a CEO demo may be High priority despite Minor severity"]] },
        { heading:"SLA Guidelines", type:"table", rows:[["Severity","Fix SLA","Board Action"],["Critical","Same sprint, ASAP","Pull existing story out to make room if needed"],["Major","Within current sprint","Add to sprint backlog at next stand-up"],["Minor","Next sprint","Add to product backlog, prioritise at refinement"],["Trivial","Backlog — fix when convenient","Label and park"]] },
        { heading:"Defect Triage Rule", type:"highlight", text:"Every new defect must be triaged within 24 hours of being raised. Untriaged defects accumulate into a quality debt that is invisible to management. Assign a Defect Owner (usually the Scrum Master or QA Lead) for each workstream." },
      ]
    },
    workstream: {
      title:"Managing Multiple Workstreams at Scale",
      intro:"For large enterprise programmes (SAP implementations, platform rebuilds), Jiganto's workstream model allows parallel delivery without losing visibility or traceability.",
      blocks:[
        { heading:"When to Create a Workstream", type:"tip", text:"Create a separate workstream when: the team is distinct (different people), the backlog is distinct (different epics), or the delivery cadence differs. Don't create workstreams just for different technologies — that's a team structure question, not a delivery structure question." },
        { heading:"Cross-Workstream Dependencies", type:"highlight", text:"This is where most enterprise programmes fail. When US-023 in Order to Cash is blocked by US-041 in Integration, that dependency must be visible on both boards. Use the Dependency Map view and tag inter-workstream blockers at stand-up." },
        { heading:"Stand-Up Structure for Large Teams", type:"table", rows:[["Team Size","Recommended Structure"],["Up to 8 people","Single stand-up per workstream, 15 mins"],["8–20 people","Per-workstream stand-ups + weekly Scrum of Scrums (30 mins)"],["20+ people","Per-workstream stand-ups + daily Scrum of Scrums + weekly PI-level sync"],["SAP programme","Per-process-area stand-ups (O2C, P2P, R2R, H2R) + integration stand-up"]] },
        { heading:"Workstream Switcher — Quick Guide", type:"checklist", items:["Use the dark navy workstream bar at the top of every view","All board tabs (Backlog, Sprint Board, Epics, etc.) filter to the active workstream","Switch workstream before starting a stand-up so the board is correctly focused","Portfolio view (Roadmap tab) shows all workstreams simultaneously","Sprint capacity is tracked per-workstream — don't mix workstream velocities"] },
      ]
    },
    dod: {
      title:"Definition of Done — Your Quality Gate",
      intro:"The Definition of Done (DoD) is a shared agreement on what 'Done' really means. Without it, teams drift into a world of 'mostly done' — which is not done.",
      blocks:[
        { heading:"Recommended DoD for a User Story", type:"checklist", items:["All Acceptance Criteria checked off","Unit tests written and passing","Code reviewed and approved (PR merged)","Integration tested in SIT environment","No open Critical or Major defects linked to this story","Product Owner has accepted the story","Sprint board card moved to Done column","Epic progress % auto-updated"] },
        { heading:"Recommended DoD for a Sprint", type:"checklist", items:["All committed stories are Done (per story DoD above)","Sprint burndown reaches zero (or remaining items moved to backlog with explanation)","Sprint Review completed with stakeholder attendance","Retrospective held and one action item logged","Velocity recorded for this sprint","Defect count reviewed and triaged","Release notes updated if increment is deployable"] },
        { heading:"DoD Evolves Over Time", type:"tip", text:"Review your Definition of Done at the end of every 3 sprints. As your team matures, the bar should get higher — add automated regression testing, performance benchmarks, or accessibility checks when the team is ready. Never lower the DoD." },
        { heading:"Common DoD Anti-Patterns", type:"highlight", text:"'It works on my machine' is not Done. 'We just need to merge it' is not Done. 'QA can test it next sprint' is not Done. A story is Done when a user could use it in production today if you chose to deploy it." },
      ]
    },
  };

  const sec = content[activeSection];

  function renderBlock(block, i) {
    switch(block.type) {
      case "highlight":
        return (
          <div key={i} style={{ background:`${C.navy}0D`, border:`1.5px solid ${C.navy}33`, borderLeft:`4px solid ${C.navy}`, borderRadius:8, padding:"12px 16px", marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.navy, marginBottom:4 }}>{block.heading}</div>
            <div style={{ fontSize:13, color:C.grey700, lineHeight:1.65 }}>{block.text}</div>
          </div>
        );
      case "tip":
        return (
          <div key={i} style={{ background:`${C.teal}10`, border:`1.5px solid ${C.teal}44`, borderLeft:`4px solid ${C.teal}`, borderRadius:8, padding:"12px 16px", marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.teal, marginBottom:4 }}>💡 {block.heading}</div>
            <div style={{ fontSize:13, color:C.grey700, lineHeight:1.65 }}>{block.text}</div>
          </div>
        );
      case "formula":
        return (
          <div key={i} style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:6 }}>{block.heading}</div>
            <div style={{ background:C.grey50, border:`1px solid ${C.grey200}`, borderRadius:8, padding:"12px 18px", fontSize:14, fontStyle:"italic", color:C.navy, fontWeight:600, lineHeight:1.6 }}>{block.text}</div>
          </div>
        );
      case "chain":
        return (
          <div key={i} style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:8 }}>{block.heading}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:0, alignItems:"center" }}>
              {block.items.map((item,j)=>(
                <div key={j} style={{ display:"flex", alignItems:"center", gap:0 }}>
                  <div style={{ background:C.navy, color:C.white, borderRadius:6, padding:"5px 12px", fontSize:12, fontWeight:600, whiteSpace:"nowrap" }}>{item}</div>
                  {j<block.items.length-1&&<span style={{ fontSize:14, color:C.grey400, margin:"0 4px" }}>→</span>}
                </div>
              ))}
            </div>
          </div>
        );
      case "checklist":
        return (
          <div key={i} style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:8 }}>{block.heading}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {block.items.map((item,j)=>(
                <div key={j} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                  <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${C.green}`, background:`${C.green}15`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                    <span style={{ color:C.green, fontSize:10, lineHeight:1 }}>✓</span>
                  </div>
                  <span style={{ fontSize:13, color:C.grey700, lineHeight:1.55 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "table":
        return (
          <div key={i} style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:8 }}>{block.heading}</div>
            <div style={{ border:`1px solid ${C.grey200}`, borderRadius:8, overflow:"hidden" }}>
              {block.rows.map((row,ri)=>(
                <div key={ri} style={{ display:"grid", gridTemplateColumns:`repeat(${row.length},1fr)`, background:ri===0?C.navy:ri%2===0?C.grey50:C.white, borderBottom:ri<block.rows.length-1?`1px solid ${C.grey200}`:"none" }}>
                  {row.map((cell,ci)=>(
                    <div key={ci} style={{ padding:"8px 12px", fontSize:12, color:ri===0?C.white:C.grey700, fontWeight:ri===0||ci===0?700:400, borderLeft:ci>0?`1px solid ${ri===0?C.navy+"66":C.grey200}`:"none" }}>{cell}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      default: return null;
    }
  }

  return (
    <div style={{ display:"flex", minHeight:"100%" }}>
      {/* Sidebar nav */}
      <div style={{ width:230, background:C.white, borderRight:`1px solid ${C.grey200}`, padding:"16px 0", flexShrink:0 }}>
        <div style={{ padding:"0 16px 12px", fontSize:11, fontWeight:700, color:C.grey400, textTransform:"uppercase", letterSpacing:0.8 }}>Guide Sections</div>
        {sections.map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            style={{ width:"100%", textAlign:"left", padding:"8px 16px", border:"none", background:activeSection===s.id?C.blueLight:"transparent", color:activeSection===s.id?C.blue:C.grey600, fontSize:13, fontWeight:activeSection===s.id?700:400, cursor:"pointer", display:"flex", alignItems:"center", gap:8, borderLeft:`3px solid ${activeSection===s.id?C.blue:"transparent"}`, transition:"all 0.1s" }}>
            <span>{s.icon}</span>{s.title}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex:1, padding:32, maxWidth:780, overflowY:"auto" }}>
        {sec&&(
          <>
            <div style={{ marginBottom:24 }}>
              <h1 style={{ fontSize:22, fontWeight:800, color:C.navy, margin:"0 0 8px" }}>{sec.title}</h1>
              <p style={{ fontSize:14, color:C.grey500, lineHeight:1.7, margin:0 }}>{sec.intro}</p>
            </div>
            <div style={{ borderTop:`2px solid ${C.blueLight}`, paddingTop:20 }}>
              {sec.blocks.map((b,i)=>renderBlock(b,i))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STORY DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════
function StoryDrawer({ story, epics, onClose, onSave, onDelete }) {
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({ ...story });
  const [acChecked, setAcChecked] = useState(story.ac?.map(()=>false)||[]);
  const [confirmDel, setConfirmDel] = useState(false);
  const epic = epics.find(e=>e.id===story.epicId);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex" }}>
      <div style={{ flex:1, background:"rgba(0,0,0,0.35)" }} onClick={onClose}/>
      <div style={{ width:520, background:C.white, boxShadow:"-8px 0 32px rgba(0,0,0,0.15)", overflow:"auto", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.grey200}`, display:"flex", alignItems:"flex-start", gap:10, borderLeft:`5px solid ${epic?.color||C.blue}` }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:C.grey400 }}>{story.id} · {epic?.title}</div>
            {editing
              ? <input style={{ ...inputStyle, marginTop:4, fontWeight:700 }} value={form.title} onChange={e=>set("title",e.target.value)}/>
              : <div style={{ fontWeight:700, fontSize:14, color:C.grey800, lineHeight:1.4, marginTop:2 }}>{story.title}</div>
            }
          </div>
          <div style={{ display:"flex", gap:5 }}>
            {editing
              ? <><Btn label="Save" variant="primary" small onClick={()=>onSave(form)}/><Btn label="Cancel" small onClick={()=>setEditing(false)}/></>
              : <><Btn label="✎ Edit" variant="secondary" small onClick={()=>setEditing(true)}/><Btn label="Delete" danger small onClick={()=>setConfirmDel(true)}/></>
            }
            <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", fontSize:20, color:C.grey400 }}>×</button>
          </div>
        </div>

        <div style={{ padding:"14px 18px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, borderBottom:`1px solid ${C.grey200}` }}>
          {[
            ["Status",    <Badge label={story.status}   color={statusBg(story.status)}   textColor={statusColor(story.status)} dot/>],
            ["Priority",  <Badge label={story.priority} color={priorityBg(story.priority)} textColor={priorityColor(story.priority)}/>],
            ["Points",    <span style={{ fontWeight:700, color:C.grey800 }}>{story.points||"—"}</span>],
            ["T-Shirt",   <span style={{ background:tshirtBg(story.tshirt), color:tshirtColor(story.tshirt), borderRadius:4, padding:"2px 8px", fontSize:12, fontWeight:700 }}>{story.tshirt}</span>],
            ["Sprint",    <span style={{ fontSize:12, color:C.grey600 }}>{story.sprint||"— Backlog"}</span>],
            ["Assignee",  <div style={{ display:"flex", alignItems:"center", gap:6 }}><Avatar name={story.assignee} size={20}/><span style={{ fontSize:12, color:C.grey600 }}>{story.assignee||"Unassigned"}</span></div>],
          ].map(([label,val])=>(
            <div key={label}>
              <div style={{ fontSize:10, fontWeight:700, color:C.grey400, textTransform:"uppercase", letterSpacing:0.5, marginBottom:3 }}>{label}</div>
              {val}
            </div>
          ))}
        </div>

        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.grey200}` }}>
          <div style={{ fontWeight:700, fontSize:12, color:C.grey700, marginBottom:8 }}>Acceptance Criteria</div>
          {story.ac?.length>0
            ? story.ac.map((ac,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:7, cursor:"pointer" }} onClick={()=>setAcChecked(p=>{ const n=[...p]; n[i]=!n[i]; return n; })}>
                <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${acChecked[i]?C.green:C.grey300}`, background:acChecked[i]?C.green:C.white, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                  {acChecked[i]&&<span style={{ color:C.white, fontSize:10 }}>✓</span>}
                </div>
                <span style={{ fontSize:12.5, color:acChecked[i]?C.grey400:C.grey700, textDecoration:acChecked[i]?"line-through":"none" }}>{ac}</span>
              </div>
            ))
            : <div style={{ fontSize:12, color:C.grey300, fontStyle:"italic" }}>No acceptance criteria added yet.</div>
          }
        </div>

        <div style={{ padding:"14px 18px" }}>
          <div style={{ fontWeight:700, fontSize:12, color:C.grey700, marginBottom:6 }}>Labels</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {story.tags?.map(t=><Badge key={t} label={t} color={C.blueLight} textColor={C.blue} small/>)}
          </div>
        </div>
      </div>

      {confirmDel&&<ConfirmDelete label={story.id} onConfirm={()=>onDelete(story.id)} onCancel={()=>setConfirmDel(false)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EPIC DRAWER
// ═══════════════════════════════════════════════════════════════════════════
function EpicDrawer({ epic, stories, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex" }}>
      <div style={{ flex:1, background:"rgba(0,0,0,0.35)" }} onClick={onClose}/>
      <div style={{ width:520, background:C.white, boxShadow:"-8px 0 32px rgba(0,0,0,0.15)", overflow:"auto" }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.grey200}`, display:"flex", alignItems:"flex-start", gap:10, borderLeft:`5px solid ${epic.color}` }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:C.grey400 }}>{epic.id} · {epic.initiative}</div>
            <div style={{ fontWeight:700, fontSize:16, color:C.grey800, marginTop:2 }}>{epic.title}</div>
          </div>
          <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", fontSize:20, color:C.grey400 }}>×</button>
        </div>
        <div style={{ padding:18, borderBottom:`1px solid ${C.grey200}` }}>
          <ProgressBar pct={epic.progress} color={epic.color} height={10}/>
          <div style={{ fontSize:11, color:C.grey400, marginTop:4, textAlign:"right" }}>{epic.progress}% · {epic.storiesDone}/{epic.stories} stories done</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
            <Badge label={epic.status} color={statusBg(epic.status)} textColor={statusColor(epic.status)} dot/>
            <Badge label={epic.priority} color={priorityBg(epic.priority)} textColor={priorityColor(epic.priority)}/>
            <span style={{ background:tshirtBg(epic.tshirt), color:tshirtColor(epic.tshirt), borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{epic.tshirt}</span>
          </div>
          {BURNUP_DATA[epic.id]&&<div style={{ marginTop:16 }}><BurnUpChart data={BURNUP_DATA[epic.id]} title="Burn-up" color={epic.color} width={460} height={160}/></div>}
        </div>
        <div style={{ padding:18 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.grey700, marginBottom:10 }}>Stories ({stories.length})</div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {stories.map(s=>(
              <div key={s.id} style={{ background:C.grey50, border:`1px solid ${C.grey200}`, borderRadius:8, padding:"9px 12px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:C.grey400 }}>{s.id}</div>
                  <div style={{ fontSize:12.5, fontWeight:500, color:C.grey800 }}>{s.title.slice(0,60)}{s.title.length>60?"…":""}</div>
                </div>
                <Badge label={s.status} color={statusBg(s.status)} textColor={statusColor(s.status)} dot small/>
                <Avatar name={s.assignee} size={20}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
