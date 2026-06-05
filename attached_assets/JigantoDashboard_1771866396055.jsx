import { useState, useEffect, useRef } from "react";

// ─── Colour tokens (matching Jiganto design system) ─────────────────────────
const C = {
  navy: "#1B3A6B", navyLight: "#243F7A",
  blue: "#2563EB", blueMid: "#3B82F6", blueLight: "#DBEAFE", blueFaint: "#EFF6FF",
  teal: "#0EA5E9", tealLight: "#E0F2FE",
  purple: "#7C3AED", purpleLight: "#EDE9FE",
  green: "#16A34A", greenLight: "#DCFCE7",
  amber: "#D97706", amberLight: "#FEF3C7",
  red: "#DC2626", redLight: "#FEE2E2",
  orange: "#EA580C", orangeLight: "#FFEDD5",
  grey50: "#F8FAFC", grey100: "#F1F5F9", grey200: "#E2E8F0",
  grey300: "#CBD5E1", grey400: "#94A3B8", grey500: "#64748B",
  grey600: "#475569", grey700: "#334155", grey800: "#1E293B",
  white: "#FFFFFF",
};

// ─── Workstreams ─────────────────────────────────────────────────────────────
const WORKSTREAMS = [
  { id: "all",    name: "All Workstreams", color: C.navy   },
  { id: "ws-ai",  name: "AI CUI Engine",   color: C.blue   },
  { id: "ws-o2c", name: "Order to Cash",   color: C.teal   },
  { id: "ws-p2p", name: "Purchase to Pay", color: C.purple },
  { id: "ws-r2r", name: "Record to Report",color: C.amber  },
  { id: "ws-h2r", name: "Hire to Retire",  color: C.green  },
];

// ─── Rich mock data per workstream ───────────────────────────────────────────
const DATA = {
  "ws-ai": {
    health: "At Risk",
    healthReason: "Sprint 3 tracking 12% behind ideal burndown. 2 critical defects unresolved.",
    sprints: [
      { id:"SP-001", name:"Sprint 1", status:"Closed",  points:28, done:28, stories:8,  storiesDone:8,  start:"06 Jan", end:"19 Jan", goal:"Core engine scaffolding" },
      { id:"SP-002", name:"Sprint 2", status:"Closed",  points:32, done:30, stories:9,  storiesDone:8,  start:"20 Jan", end:"02 Feb", goal:"Auth & SSO integration" },
      { id:"SP-003", name:"Sprint 3", status:"Active",  points:34, done:18, stories:10, storiesDone:5,  start:"03 Feb", end:"16 Feb", goal:"Streaming + collaboration MVP" },
      { id:"SP-004", name:"Sprint 4", status:"Planned", points:21, done:0,  stories:6,  storiesDone:0,  start:"17 Feb", end:"02 Mar", goal:"Context suggestions & history" },
    ],
    epics: [
      { id:"EP-001", title:"AI CUI Core Engine",      initiative:"AI Platform v2",      owner:"Sarah K.", tshirt:"XL", stories:12, done:5,  ptsTotal:55, ptsDone:24, progress:45, color:C.blue   },
      { id:"EP-002", title:"User Auth & SSO",         initiative:"AI Platform v2",      owner:"Mark T.",  tshirt:"L",  stories:8,  done:6,  ptsTotal:34, ptsDone:26, progress:72, color:C.teal   },
      { id:"EP-003", title:"Real-Time Collaboration", initiative:"AI Platform v2",      owner:"Priya M.", tshirt:"XL", stories:15, done:2,  ptsTotal:68, ptsDone:10, progress:10, color:C.purple },
    ],
    statusDist: { Backlog:3, "To Do":2, "In Progress":2, "Review":1, Testing:1, Done:8 },
    defects: { critical:2, major:3, minor:4, total:9, openPct:67 },
    burndown: [
      {day:"D1",ideal:34,actual:34},{day:"D2",ideal:31.4,actual:32},{day:"D3",ideal:28.8,actual:30},
      {day:"D4",ideal:26.1,actual:29},{day:"D5",ideal:23.5,actual:26},{day:"D6",ideal:20.9,actual:24},
      {day:"D7",ideal:18.3,actual:22},{day:"D8",ideal:15.6,actual:18},{day:"D9",ideal:13,actual:16},
      {day:"D10",ideal:10.4,actual:null},{day:"D11",ideal:7.8,actual:null},{day:"D12",ideal:5.2,actual:null},
      {day:"D13",ideal:2.6,actual:null},{day:"D14",ideal:0,actual:null},
    ],
    velocity: [28, 30, 18],
    capacityUsed: 82,
    teamSize: 6,
    avgVelocity: 25,
  },
  "ws-o2c": {
    health: "On Track",
    healthReason: "Sprint 2 progressing well. All critical stories in testing or done.",
    sprints: [
      { id:"SP-O1", name:"Sprint 1", status:"Closed",  points:22, done:22, stories:6,  storiesDone:6,  start:"06 Jan", end:"19 Jan", goal:"Sales order data model" },
      { id:"SP-O2", name:"Sprint 2", status:"Active",  points:26, done:20, stories:7,  storiesDone:5,  start:"20 Jan", end:"02 Feb", goal:"Order creation & validation" },
      { id:"SP-O3", name:"Sprint 3", status:"Planned", points:24, done:0,  stories:7,  storiesDone:0,  start:"03 Feb", end:"16 Feb", goal:"Delivery scheduling & alerts" },
    ],
    epics: [
      { id:"EP-O1", title:"Sales Order Management",   initiative:"ERP Phase 1", owner:"James L.", tshirt:"L",  stories:10, done:4,  ptsTotal:44, ptsDone:18, progress:38, color:C.teal  },
      { id:"EP-O2", title:"Credit & Billing",         initiative:"ERP Phase 1", owner:"Anna R.",  tshirt:"M",  stories:6,  done:1,  ptsTotal:26, ptsDone:5,  progress:18, color:C.amber },
      { id:"EP-O3", title:"Order Fulfilment Tracking",initiative:"ERP Phase 1", owner:"James L.", tshirt:"M",  stories:5,  done:0,  ptsTotal:20, ptsDone:0,  progress:5,  color:C.navy  },
    ],
    statusDist: { Backlog:5, "To Do":1, "In Progress":2, "Review":1, Testing:2, Done:5 },
    defects: { critical:0, major:1, minor:2, total:3, openPct:33 },
    burndown: [
      {day:"D1",ideal:26,actual:26},{day:"D2",ideal:24.1,actual:25},{day:"D3",ideal:22.1,actual:23},
      {day:"D4",ideal:20.1,actual:21},{day:"D5",ideal:18.1,actual:19},{day:"D6",ideal:16.1,actual:17},
      {day:"D7",ideal:14.1,actual:15},{day:"D8",ideal:12.1,actual:11},{day:"D9",ideal:10.1,actual:9},
      {day:"D10",ideal:8.1,actual:null},{day:"D11",ideal:6.1,actual:null},{day:"D12",ideal:4.1,actual:null},
      {day:"D13",ideal:2.1,actual:null},{day:"D14",ideal:0,actual:null},
    ],
    velocity: [22, 20],
    capacityUsed: 77,
    teamSize: 5,
    avgVelocity: 21,
  },
  "ws-p2p": {
    health: "Behind",
    healthReason: "Sprint 1 started late. Scope re-baseline required. 3 stories without estimates.",
    sprints: [
      { id:"SP-P1", name:"Sprint 1", status:"Active",  points:18, done:6,  stories:5,  storiesDone:2,  start:"03 Feb", end:"16 Feb", goal:"PR workflow & approval chain" },
      { id:"SP-P2", name:"Sprint 2", status:"Planned", points:20, done:0,  stories:6,  storiesDone:0,  start:"17 Feb", end:"02 Mar", goal:"PO creation & vendor matching" },
    ],
    epics: [
      { id:"EP-P1", title:"Purchase Requisition Flow", initiative:"ERP Phase 1", owner:"Dev A.", tshirt:"M",  stories:7, done:0, ptsTotal:28, ptsDone:0, progress:5,  color:C.purple },
      { id:"EP-P2", title:"Vendor Management",         initiative:"ERP Phase 1", owner:"Dev B.", tshirt:"L",  stories:9, done:0, ptsTotal:36, ptsDone:0, progress:0,  color:C.orange },
    ],
    statusDist: { Backlog:7, "To Do":2, "In Progress":1, "Review":0, Testing:0, Done:1 },
    defects: { critical:1, major:2, minor:1, total:4, openPct:100 },
    burndown: [
      {day:"D1",ideal:18,actual:18},{day:"D2",ideal:16.7,actual:18},{day:"D3",ideal:15.4,actual:17},
      {day:"D4",ideal:14.1,actual:16},{day:"D5",ideal:12.8,actual:16},{day:"D6",ideal:11.5,actual:15},
      {day:"D7",ideal:10.2,actual:14},{day:"D8",ideal:8.9,actual:null},{day:"D9",ideal:7.6,actual:null},
      {day:"D10",ideal:6.3,actual:null},{day:"D11",ideal:5,actual:null},{day:"D12",ideal:3.7,actual:null},
      {day:"D13",ideal:2.4,actual:null},{day:"D14",ideal:0,actual:null},
    ],
    velocity: [6],
    capacityUsed: 55,
    teamSize: 4,
    avgVelocity: 16,
  },
  "ws-r2r": {
    health: "On Track",
    healthReason: "Sprint 1 completed above velocity. Team ahead of plan.",
    sprints: [
      { id:"SP-R1", name:"Sprint 1", status:"Closed",  points:20, done:22, stories:6,  storiesDone:6,  start:"06 Jan", end:"19 Jan", goal:"GL chart of accounts setup" },
      { id:"SP-R2", name:"Sprint 2", status:"Active",  points:24, done:19, stories:7,  storiesDone:5,  start:"20 Jan", end:"02 Feb", goal:"Period-end close automation" },
      { id:"SP-R3", name:"Sprint 3", status:"Planned", points:22, done:0,  stories:6,  storiesDone:0,  start:"03 Feb", end:"16 Feb", goal:"Reporting & consolidation" },
    ],
    epics: [
      { id:"EP-R1", title:"General Ledger Automation",  initiative:"ERP Phase 2", owner:"Nina C.", tshirt:"L",  stories:8,  done:5, ptsTotal:38, ptsDone:24, progress:60, color:C.amber  },
      { id:"EP-R2", title:"Financial Reporting Suite",  initiative:"ERP Phase 2", owner:"Tom H.",  tshirt:"XL", stories:12, done:2, ptsTotal:52, ptsDone:10, progress:22, color:C.orange },
    ],
    statusDist: { Backlog:2, "To Do":1, "In Progress":2, "Review":2, Testing:1, Done:7 },
    defects: { critical:0, major:0, minor:3, total:3, openPct:33 },
    burndown: [
      {day:"D1",ideal:24,actual:24},{day:"D2",ideal:22.2,actual:22},{day:"D3",ideal:20.4,actual:20},
      {day:"D4",ideal:18.6,actual:18},{day:"D5",ideal:16.8,actual:17},{day:"D6",ideal:15,actual:15},
      {day:"D7",ideal:13.2,actual:13},{day:"D8",ideal:11.4,actual:10},{day:"D9",ideal:9.6,actual:8},
      {day:"D10",ideal:7.8,actual:null},{day:"D11",ideal:6,actual:null},{day:"D12",ideal:4.2,actual:null},
      {day:"D13",ideal:2.4,actual:null},{day:"D14",ideal:0,actual:null},
    ],
    velocity: [22, 19],
    capacityUsed: 90,
    teamSize: 5,
    avgVelocity: 22,
  },
  "ws-h2r": {
    health: "On Track",
    healthReason: "Sprint 1 just started. Scope defined and team capacity allocated.",
    sprints: [
      { id:"SP-H1", name:"Sprint 1", status:"Active",  points:16, done:8,  stories:5,  storiesDone:2,  start:"03 Feb", end:"16 Feb", goal:"Employee master data model" },
      { id:"SP-H2", name:"Sprint 2", status:"Planned", points:18, done:0,  stories:5,  storiesDone:0,  start:"17 Feb", end:"02 Mar", goal:"Onboarding workflow" },
    ],
    epics: [
      { id:"EP-H1", title:"Employee Data Management",  initiative:"HR Transformation", owner:"Lea S.", tshirt:"M",  stories:6, done:1, ptsTotal:24, ptsDone:5,  progress:20, color:C.green  },
      { id:"EP-H2", title:"Payroll Integration",       initiative:"HR Transformation", owner:"Dev C.", tshirt:"L",  stories:8, done:0, ptsTotal:34, ptsDone:0,  progress:0,  color:C.blueMid },
    ],
    statusDist: { Backlog:5, "To Do":2, "In Progress":2, "Review":0, Testing:0, Done:2 },
    defects: { critical:0, major:1, minor:0, total:1, openPct:100 },
    burndown: [
      {day:"D1",ideal:16,actual:16},{day:"D2",ideal:14.9,actual:15},{day:"D3",ideal:13.7,actual:14},
      {day:"D4",ideal:12.6,actual:13},{day:"D5",ideal:11.4,actual:12},{day:"D6",ideal:10.3,actual:11},
      {day:"D7",ideal:9.1,actual:10},{day:"D8",ideal:8,actual:null},{day:"D9",ideal:6.9,actual:null},
      {day:"D10",ideal:5.7,actual:null},{day:"D11",ideal:4.6,actual:null},{day:"D12",ideal:3.4,actual:null},
      {day:"D13",ideal:2.3,actual:null},{day:"D14",ideal:0,actual:null},
    ],
    velocity: [8],
    capacityUsed: 68,
    teamSize: 4,
    avgVelocity: 17,
  },
};

// Aggregate "All Workstreams" data
const ALL_DATA = (() => {
  const wsList = Object.entries(DATA).filter(([k]) => k !== "all");
  const allEpics = wsList.flatMap(([wsId, d]) => d.epics.map(e => ({ ...e, wsId })));
  const allSprints = wsList.flatMap(([wsId, d]) => d.sprints.map(s => ({ ...s, wsId, wsName: WORKSTREAMS.find(w => w.id === wsId)?.name })));
  const totalStories = wsList.reduce((a, [, d]) => a + d.statusDist.Backlog + d.statusDist["To Do"] + d.statusDist["In Progress"] + d.statusDist["Review"] + d.statusDist.Testing + d.statusDist.Done, 0);
  const totalDefects = wsList.reduce((a, [, d]) => a + d.defects.total, 0);
  const critDefects  = wsList.reduce((a, [, d]) => a + d.defects.critical, 0);
  const statusTotals = { Backlog:0, "To Do":0, "In Progress":0, Review:0, Testing:0, Done:0 };
  wsList.forEach(([, d]) => Object.entries(d.statusDist).forEach(([k, v]) => { if (statusTotals[k] !== undefined) statusTotals[k] += v; }));
  return { allEpics, allSprints, statusDist: statusTotals, totalStories, totalDefects, critDefects };
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────
const healthCfg = {
  "On Track": { color: C.green,  bg: C.greenLight,  icon: "●", label: "On Track" },
  "At Risk":  { color: C.amber,  bg: C.amberLight,  icon: "▲", label: "At Risk"  },
  "Behind":   { color: C.red,    bg: C.redLight,    icon: "■", label: "Behind"   },
};

const avatarBg = n => [C.blue,C.purple,C.teal,C.green,C.amber,C.red,"#0D9488"][n?n.charCodeAt(0)%7:0];
const initials = n => n ? n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?";

function Avatar({ name, size=24 }) {
  return (
    <div title={name} style={{ width:size, height:size, borderRadius:"50%", background:avatarBg(name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.36, fontWeight:700, color:C.white, flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}

function ProgressBar({ pct, color=C.blue, height=6, animate=true }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(Math.min(100, pct||0)), 80); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ height, borderRadius:height, background:C.grey200, overflow:"hidden", flex:1, minWidth:40 }}>
      <div style={{ height:"100%", width:`${animate?width:Math.min(100,pct||0)}%`, background: pct>=100?C.green:color, borderRadius:height, transition: animate?"width 0.7s cubic-bezier(0.4,0,0.2,1)":"none" }}/>
    </div>
  );
}

function Pill({ label, color=C.grey200, textColor=C.grey700, dot, size="sm" }) {
  const p = size==="xs" ? "1px 6px" : "2px 9px";
  const fs = size==="xs" ? 10 : 11;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:p, borderRadius:20, background:color, color:textColor, fontSize:fs, fontWeight:600, whiteSpace:"nowrap", lineHeight:1.4 }}>
      {dot && <span style={{ width:5, height:5, borderRadius:"50%", background:textColor, flexShrink:0 }}/>}
      {label}
    </span>
  );
}

const tshirtBg = t => ({ XS:"#F0FDF4",S:"#DCFCE7",M:"#DBEAFE",L:"#FEF3C7",XL:"#FEE2E2",XXL:"#FCE7F3" }[t]||C.grey100);
const tshirtFg = t => ({ XS:C.green,S:C.green,M:C.blue,L:C.amber,XL:C.red,XXL:"#9D174D" }[t]||C.grey700);

// ─── Mini burndown SVG ────────────────────────────────────────────────────────
function MiniBurndown({ data, color=C.blue, width=220, height=90 }) {
  if (!data) return null;
  const pad = { t:10, r:10, b:22, l:28 };
  const W = width-pad.l-pad.r, H = height-pad.t-pad.b;
  const maxY = Math.max(...data.map(d=>d.ideal));
  const xs = data.map((_,i)=>pad.l+(i/(data.length-1))*W);
  const y  = v => pad.t+H-(v/maxY)*H;
  const idealPath = data.map((d,i)=>`${i===0?"M":"L"}${xs[i].toFixed(1)},${y(d.ideal).toFixed(1)}`).join(" ");
  const actualPts = data.filter(d=>d.actual!==null);
  const lastIdx   = data.reduce((a,d,i)=>d.actual!==null?i:a,-1);
  const actualPath = actualPts.map((d,i)=>{const xi=data.indexOf(d);return `${i===0?"M":"L"}${xs[xi].toFixed(1)},${y(d.actual).toFixed(1)}`;}).join(" ");

  return (
    <svg width={width} height={height} style={{ display:"block" }}>
      {[0,0.5,1].map(t=>{
        const yv=pad.t+H*t;
        return <line key={t} x1={pad.l} y1={yv} x2={pad.l+W} y2={yv} stroke={C.grey200} strokeWidth={1}/>;
      })}
      {data.filter((_,i)=>i%4===0||i===data.length-1).map((d,i,arr)=>{
        const idx=data.indexOf(d);
        return <text key={d.day} x={xs[idx]} y={height-6} textAnchor="middle" fontSize={8} fill={C.grey400}>{d.day}</text>;
      })}
      {[0,maxY/2,maxY].map((v,i)=><text key={i} x={pad.l-4} y={y(v)+3} textAnchor="end" fontSize={7.5} fill={C.grey400}>{Math.round(v)}</text>)}
      <path d={idealPath} fill="none" stroke={C.grey300} strokeWidth={1.5} strokeDasharray="4 2"/>
      {lastIdx>=0&&<line x1={xs[lastIdx]} y1={pad.t} x2={xs[lastIdx]} y2={pad.t+H} stroke={C.amber} strokeWidth={1.2} strokeDasharray="3 2"/>}
      {actualPts.length>0&&<path d={actualPath+` L${xs[lastIdx].toFixed(1)},${(pad.t+H).toFixed(1)} L${xs[0].toFixed(1)},${(pad.t+H).toFixed(1)} Z`} fill={`${color}18`} stroke="none"/>}
      {actualPts.length>0&&<path d={actualPath} fill="none" stroke={color} strokeWidth={2}/>}
      {actualPts.map((d,i)=>{const xi=data.indexOf(d);return <circle key={i} cx={xs[xi]} cy={y(d.actual)} r={2.5} fill={C.white} stroke={color} strokeWidth={1.5}/>;} )}
    </svg>
  );
}

// ─── Full burndown SVG ────────────────────────────────────────────────────────
function FullBurndown({ data, color=C.blue, width=480, height=200 }) {
  if (!data) return null;
  const pad = { t:16, r:20, b:30, l:36 };
  const W = width-pad.l-pad.r, H = height-pad.t-pad.b;
  const maxY = Math.max(...data.map(d=>d.ideal));
  const xs = data.map((_,i)=>pad.l+(i/(data.length-1))*W);
  const y  = v => pad.t+H-(v/maxY)*H;
  const idealPath = data.map((d,i)=>`${i===0?"M":"L"}${xs[i].toFixed(1)},${y(d.ideal).toFixed(1)}`).join(" ");
  const actualPts = data.filter(d=>d.actual!==null);
  const lastIdx   = data.reduce((a,d,i)=>d.actual!==null?i:a,-1);
  const actualPath = actualPts.map((d,i)=>{const xi=data.indexOf(d);return `${i===0?"M":"L"}${xs[xi].toFixed(1)},${y(d.actual).toFixed(1)}`;}).join(" ");

  return (
    <svg width={width} height={height} style={{ display:"block", overflow:"visible" }}>
      {[0,0.25,0.5,0.75,1].map(t=>{
        const yv=pad.t+H*t; const val=Math.round(maxY*(1-t));
        return (<g key={t}><line x1={pad.l} y1={yv} x2={pad.l+W} y2={yv} stroke={C.grey100} strokeWidth={1}/><text x={pad.l-6} y={yv+3} textAnchor="end" fontSize={9} fill={C.grey400}>{val}</text></g>);
      })}
      {data.map((d,i)=>(
        i%2===0&&<text key={d.day} x={xs[i]} y={pad.t+H+18} textAnchor="middle" fontSize={8.5} fill={C.grey400}>{d.day}</text>
      ))}
      {lastIdx>=0&&<line x1={xs[lastIdx]} y1={pad.t} x2={xs[lastIdx]} y2={pad.t+H} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8}/>}
      <path d={idealPath} fill="none" stroke={C.grey300} strokeWidth={1.8} strokeDasharray="6 3"/>
      {actualPts.length>0&&<path d={actualPath+` L${xs[lastIdx].toFixed(1)},${(pad.t+H).toFixed(1)} L${xs[0].toFixed(1)},${(pad.t+H).toFixed(1)} Z`} fill={`${color}16`} stroke="none"/>}
      {actualPts.length>0&&<path d={actualPath} fill="none" stroke={color} strokeWidth={2.5}/>}
      {actualPts.map((d,i)=>{const xi=data.indexOf(d);return <circle key={i} cx={xs[xi]} cy={y(d.actual)} r={3.5} fill={C.white} stroke={color} strokeWidth={2}/>;} )}
      <g transform={`translate(${pad.l+W-170},${pad.t})`}>
        <line x1={0} y1={8} x2={14} y2={8} stroke={C.grey300} strokeWidth={2} strokeDasharray="5 2"/>
        <text x={18} y={11} fontSize={9} fill={C.grey500}>Ideal</text>
        <line x1={52} y1={8} x2={66} y2={8} stroke={color} strokeWidth={2.5}/>
        <text x={70} y={11} fontSize={9} fill={C.grey500}>Actual</text>
        <line x1={108} y1={2} x2={108} y2={14} stroke={C.amber} strokeWidth={1.5} strokeDasharray="3 2"/>
        <text x={112} y={11} fontSize={9} fill={C.grey500}>Today</text>
      </g>
    </svg>
  );
}

// ─── Velocity bar chart ───────────────────────────────────────────────────────
function VelocityChart({ sprints, avgVelocity, color=C.blue, width=300, height=130 }) {
  const closed = sprints.filter(s=>s.status!=="Planned");
  if (closed.length===0) return <div style={{ color:C.grey300, fontSize:12, padding:"20px 0" }}>No completed sprints yet.</div>;
  const maxPts = Math.max(...closed.map(s=>Math.max(s.points,s.done)), avgVelocity||0, 1);
  const pad = { t:16, r:16, b:30, l:36 };
  const W = width-pad.l-pad.r, H = height-pad.t-pad.b;
  const barW = Math.max(20, W/closed.length*0.5);
  const gap  = W/closed.length;

  return (
    <svg width={width} height={height} style={{ display:"block", overflow:"visible" }}>
      {[0,0.5,1].map(t=>{
        const yv=pad.t+H*t; const val=Math.round(maxPts*(1-t));
        return (<g key={t}><line x1={pad.l} y1={yv} x2={pad.l+W} y2={yv} stroke={C.grey100} strokeWidth={1}/><text x={pad.l-5} y={yv+3} textAnchor="end" fontSize={8} fill={C.grey400}>{val}</text></g>);
      })}
      {avgVelocity&&(
        <line x1={pad.l} y1={pad.t+H-(avgVelocity/maxPts)*H} x2={pad.l+W} y2={pad.t+H-(avgVelocity/maxPts)*H} stroke={C.navy} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6}/>
      )}
      {closed.map((sp,i)=>{
        const cx = pad.l+gap*i+gap/2;
        const committedH = (sp.points/maxPts)*H;
        const doneH      = (sp.done/maxPts)*H;
        const doneColor  = sp.status==="Active" ? color : (sp.done>=sp.points?C.green:C.amber);
        return (
          <g key={sp.id}>
            <rect x={cx-barW/2-1} y={pad.t+H-committedH} width={barW+2} height={committedH} fill={`${color}22`} rx={3}/>
            <rect x={cx-barW/2}   y={pad.t+H-doneH}      width={barW}   height={doneH}      fill={doneColor}   rx={3} opacity={0.85}/>
            <text x={cx} y={pad.t+H+16} textAnchor="middle" fontSize={8.5} fill={C.grey400}>{sp.name.replace("Sprint ","S")}</text>
            <text x={cx} y={pad.t+H-committedH-4} textAnchor="middle" fontSize={8} fill={C.grey500} fontWeight="600">{sp.done}/{sp.points}</text>
          </g>
        );
      })}
      {avgVelocity&&(
        <text x={pad.l+W+4} y={pad.t+H-(avgVelocity/maxPts)*H+3} fontSize={8} fill={C.navy} fontWeight="600">avg</text>
      )}
    </svg>
  );
}

// ─── Status distribution horizontal bars ────────────────────────────────────
function StatusDistChart({ dist, total }) {
  const cols = [
    { key:"Backlog",      color:C.grey500  },
    { key:"To Do",        color:C.grey400  },
    { key:"In Progress",  color:C.amber    },
    { key:"Review",       color:C.purple   },
    { key:"Testing",      color:C.teal     },
    { key:"Done",         color:C.green    },
  ];
  const maxVal = Math.max(...cols.map(c=>dist[c.key]||0), 1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {cols.map(({ key, color }) => {
        const val = dist[key]||0;
        return (
          <div key={key} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, width:90, flexShrink:0 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }}/>
              <span style={{ fontSize:12, color:C.grey600, fontWeight:500 }}>{key}</span>
            </div>
            <div style={{ flex:1, height:8, background:C.grey100, borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(val/maxVal)*100}%`, background:color, borderRadius:4, transition:"width 0.6s ease" }}/>
            </div>
            <span style={{ fontSize:12, fontWeight:700, color:C.grey600, width:20, textAlign:"right" }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function Card({ children, style={} }) {
  return (
    <div style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:12, padding:"18px 20px", ...style }}>
      {children}
    </div>
  );
}
function CardTitle({ children, action }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
      <span style={{ fontWeight:700, fontSize:14, color:C.grey800 }}>{children}</span>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function JigantoDashboard() {
  const [activeWs, setActiveWs]     = useState("all");
  const [expandedWs, setExpandedWs] = useState(null); // for drill-down panel
  const [lastUpdated] = useState("Today 09:14");

  const wsObj = WORKSTREAMS.find(w=>w.id===activeWs);

  // For "All" view we show a cross-workstream summary
  const isAll = activeWs==="all";
  const wsData = isAll ? null : DATA[activeWs];

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", background:C.grey50, minHeight:"100vh", display:"flex", flexDirection:"column" }}>

      {/* ── TOP NAV ── */}
      <div style={{ background:C.white, borderBottom:`1px solid ${C.grey200}`, padding:"0 24px", display:"flex", alignItems:"center", gap:12, height:52, flexShrink:0 }}>
        <button style={{ display:"flex", alignItems:"center", gap:5, color:C.grey500, background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:500 }}>‹ Back</button>
        <Pill label="Project" color={C.blueLight} textColor={C.blue}/>
        <Pill label="● At Risk" color={C.amberLight} textColor={C.amber}/>
        <Pill label="● Active" color={C.greenLight} textColor={C.green}/>
        <span style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>AI CUI Engine Build</span>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color:C.grey400 }}>Last updated: {lastUpdated}</span>
        <button style={{ padding:"5px 14px", borderRadius:6, border:`1px solid ${C.grey200}`, background:C.white, fontSize:12, color:C.grey600, cursor:"pointer", fontWeight:500 }}>🖨 Print View</button>
        <button style={{ padding:"5px 14px", borderRadius:6, background:C.blue, color:C.white, border:"none", cursor:"pointer", fontSize:12, fontWeight:600 }}>↗ Share</button>
      </div>

      {/* ── WORKSTREAM SWITCHER ── */}
      <div style={{ background:C.navy, padding:"0 24px", display:"flex", alignItems:"center", gap:6, height:40, flexShrink:0, overflowX:"auto" }}>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontWeight:700, marginRight:4, whiteSpace:"nowrap", letterSpacing:0.5 }}>VIEW:</span>
        {WORKSTREAMS.map(ws=>(
          <button key={ws.id} onClick={()=>{ setActiveWs(ws.id); setExpandedWs(null); }}
            style={{ padding:"4px 14px", borderRadius:20, border:`1.5px solid ${activeWs===ws.id?ws.color:"rgba(255,255,255,0.15)"}`, background:activeWs===ws.id?ws.color+"44":"transparent", color:activeWs===ws.id?C.white:"rgba(255,255,255,0.6)", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s" }}>
            {ws.name}
          </button>
        ))}
      </div>

      {/* ── PAGE HEADER ── */}
      <div style={{ padding:"20px 24px 0", display:"flex", alignItems:"center", gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:C.grey800 }}>
            {isAll ? "Programme Health Dashboard" : `${wsObj?.name} — Health Dashboard`}
          </h1>
          <div style={{ fontSize:12, color:C.grey400, marginTop:2 }}>
            {isAll ? "Cross-workstream summary · All active workstreams" : `Workstream detail · ${wsData?.sprints.filter(s=>s.status!=="Planned").length} sprints tracked`}
          </div>
        </div>
        <div style={{ flex:1 }}/>
        {!isAll && wsData && (
          <div style={{ display:"flex", alignItems:"center", gap:8, background:healthCfg[wsData.health].bg, border:`1px solid ${healthCfg[wsData.health].color}44`, borderRadius:10, padding:"8px 16px" }}>
            <span style={{ fontSize:20, color:healthCfg[wsData.health].color }}>{healthCfg[wsData.health].icon}</span>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:healthCfg[wsData.health].color }}>{wsData.health}</div>
              <div style={{ fontSize:11, color:C.grey500, maxWidth:280 }}>{wsData.healthReason}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex:1, padding:"16px 24px 28px", overflow:"auto" }}>
        {isAll ? <AllWorkstreamsView onDrillDown={setExpandedWs} expandedWs={expandedWs}/> : <SingleWorkstreamView wsId={activeWs} data={wsData} wsColor={wsObj?.color}/>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALL WORKSTREAMS VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function AllWorkstreamsView({ onDrillDown, expandedWs }) {
  // KPI totals
  const allWs = Object.entries(DATA);
  const totalEpics   = allWs.reduce((a,[,d])=>a+d.epics.length,0);
  const totalStories = allWs.reduce((a,[,d])=>a+Object.values(d.statusDist).reduce((x,y)=>x+y,0),0);
  const totalDone    = allWs.reduce((a,[,d])=>a+d.statusDist.Done,0);
  const totalDefects = allWs.reduce((a,[,d])=>a+d.defects.total,0);
  const critDefects  = allWs.reduce((a,[,d])=>a+d.defects.critical,0);
  const activeSprints= allWs.filter(([,d])=>d.sprints.some(s=>s.status==="Active")).length;

  const kpis = [
    { label:"Workstreams Active", value:activeSprints, icon:"🔀", color:C.navy,   bg:`${C.navy}11`   },
    { label:"Total Epics",        value:totalEpics,    icon:"⚡", color:C.blue,   bg:C.blueLight     },
    { label:"Total Stories",      value:totalStories,  icon:"📖", color:C.purple, bg:C.purpleLight   },
    { label:"Stories Done",       value:totalDone,     icon:"✅", color:C.green,  bg:C.greenLight    },
    { label:"Open Defects",       value:totalDefects,  icon:"🐛", color:C.amber,  bg:C.amberLight    },
    { label:"Critical Defects",   value:critDefects,   icon:"🚨", color:C.red,    bg:C.redLight      },
  ];

  const globalStatusDist = ALL_DATA.statusDist;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12 }}>
        {kpis.map(k=>(
          <div key={k.label} style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:"14px 16px", borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{k.icon}</div>
            <div style={{ fontWeight:800, fontSize:26, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:11, color:C.grey400, marginTop:4, fontWeight:500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Workstream health grid */}
      <div>
        <div style={{ fontWeight:700, fontSize:14, color:C.grey700, marginBottom:10 }}>Workstream Health Overview</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))", gap:12 }}>
          {Object.entries(DATA).map(([wsId, d])=>{
            const ws   = WORKSTREAMS.find(w=>w.id===wsId);
            const hcfg = healthCfg[d.health];
            const activeSprint = d.sprints.find(s=>s.status==="Active");
            const sprintPct    = activeSprint ? Math.round((activeSprint.done/activeSprint.points)*100) : null;
            const isExpanded   = expandedWs===wsId;
            return (
              <div key={wsId} style={{ background:C.white, border:`1.5px solid ${isExpanded?ws.color:C.grey200}`, borderRadius:12, overflow:"hidden", transition:"border-color 0.2s, box-shadow 0.2s", boxShadow:isExpanded?`0 4px 20px ${ws.color}33`:"none" }}>
                {/* Card header */}
                <div style={{ padding:"14px 16px", borderBottom:`1px solid ${C.grey100}`, display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:ws.color, flexShrink:0 }}/>
                  <span style={{ fontWeight:700, fontSize:14, color:C.grey800, flex:1 }}>{ws.name}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:5, background:hcfg.bg, borderRadius:6, padding:"3px 10px" }}>
                    <span style={{ fontSize:9, color:hcfg.color }}>{hcfg.icon}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:hcfg.color }}>{d.health}</span>
                  </div>
                </div>
                {/* Metrics strip */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", padding:"10px 14px", gap:4 }}>
                  {[["Epics",d.epics.length,ws.color],["Stories",Object.values(d.statusDist).reduce((a,b)=>a+b,0),C.grey600],["✓ Done",d.statusDist.Done,C.green],["🐛 Defects",d.defects.total,d.defects.critical>0?C.red:C.grey400]].map(([l,v,c])=>(
                    <div key={l} style={{ textAlign:"center" }}>
                      <div style={{ fontWeight:700, fontSize:16, color:c }}>{v}</div>
                      <div style={{ fontSize:10, color:C.grey400 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {/* Active sprint bar */}
                {activeSprint&&(
                  <div style={{ padding:"0 14px 10px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.grey500, marginBottom:4 }}>
                      <span style={{ fontWeight:600 }}>{activeSprint.name}</span>
                      <span>{activeSprint.done}/{activeSprint.points} pts · {sprintPct}%</span>
                    </div>
                    <ProgressBar pct={sprintPct} color={ws.color} height={7}/>
                  </div>
                )}
                {/* Mini burndown */}
                <div style={{ padding:"6px 14px 10px", borderTop:`1px solid ${C.grey50}` }}>
                  <div style={{ fontSize:10, color:C.grey400, marginBottom:4, fontWeight:600 }}>SPRINT BURNDOWN</div>
                  <MiniBurndown data={d.burndown.filter(x=>d.sprints.find(s=>s.status==="Active"))} color={ws.color} width={280} height={80}/>
                </div>
                {/* Health reason */}
                <div style={{ padding:"0 14px 10px", fontSize:11, color:C.grey500, lineHeight:1.5, fontStyle:"italic" }}>
                  {d.healthReason}
                </div>
                {/* Expand/collapse */}
                <button onClick={()=>onDrillDown(isExpanded?null:wsId)}
                  style={{ width:"100%", padding:"8px 0", border:"none", borderTop:`1px solid ${C.grey100}`, background:isExpanded?`${ws.color}0A`:C.grey50, color:isExpanded?ws.color:C.grey500, fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:0.3 }}>
                  {isExpanded?"▲ Collapse Detail":"▼ Expand Detail"}
                </button>
                {/* Drill-down */}
                {isExpanded&&<WorkstreamDrillDown wsId={wsId} data={d} color={ws.color}/>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Global status distribution + Epic roll-up */}
      <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:16 }}>
        <Card>
          <CardTitle>Status Distribution — All Workstreams</CardTitle>
          <StatusDistChart dist={globalStatusDist} total={totalStories}/>
        </Card>
        <Card>
          <CardTitle>Epic Roll-up Summary — All Workstreams</CardTitle>
          <EpicRollupTable epics={ALL_DATA.allEpics} showWs/>
        </Card>
      </div>

    </div>
  );
}

// ─── Drill-down panel (inside workstream card) ────────────────────────────────
function WorkstreamDrillDown({ wsId, data, color }) {
  return (
    <div style={{ padding:"14px 16px", borderTop:`1px solid ${C.grey100}`, background:`${color}05` }}>
      {/* Sprint velocity */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.grey500, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Sprint Velocity</div>
        <VelocityChart sprints={data.sprints} avgVelocity={data.avgVelocity} color={color} width={280} height={110}/>
        <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:C.grey500 }}><div style={{ width:10, height:10, background:`${color}22`, border:`1px solid ${color}44`, borderRadius:2 }}/> Committed</div>
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:C.grey500 }}><div style={{ width:10, height:6, background:color, borderRadius:2 }}/> Done</div>
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:C.grey500 }}><div style={{ width:12, height:2, background:C.navy, opacity:0.5, borderTop:`1px dashed ${C.navy}` }}/> Avg velocity ({data.avgVelocity} pts)</div>
        </div>
      </div>
      {/* Epics mini table */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:C.grey500, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Epics</div>
        {data.epics.map(e=>(
          <div key={e.id} style={{ marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
              <span style={{ fontWeight:600, fontSize:12, color:color, flex:1 }}>{e.title}</span>
              <span style={{ background:tshirtBg(e.tshirt), color:tshirtFg(e.tshirt), borderRadius:3, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{e.tshirt}</span>
              <span style={{ fontSize:11, fontWeight:700, color:e.progress>=100?C.green:color }}>{e.progress}%</span>
            </div>
            <ProgressBar pct={e.progress} color={e.color} height={5}/>
            <div style={{ fontSize:10, color:C.grey400, marginTop:2 }}>{e.done}/{e.stories} stories · {e.ptsDone}/{e.ptsTotal} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE WORKSTREAM VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function SingleWorkstreamView({ wsId, data, wsColor }) {
  const activeSprint = data.sprints.find(s=>s.status==="Active");
  const closedSprints= data.sprints.filter(s=>s.status==="Closed");
  const totalStories = Object.values(data.statusDist).reduce((a,b)=>a+b,0);
  const doneStories  = data.statusDist.Done;
  const totalEpicPts = data.epics.reduce((a,e)=>a+e.ptsTotal,0);
  const doneEpicPts  = data.epics.reduce((a,e)=>a+e.ptsDone,0);

  const kpis = [
    { label:"Sprints Run",    value:data.sprints.filter(s=>s.status!=="Planned").length, icon:"🏃", color:wsColor      },
    { label:"Avg Velocity",   value:`${data.avgVelocity} pts`, icon:"⚡", color:C.blue    },
    { label:"Total Stories",  value:totalStories, icon:"📖", color:C.purple                 },
    { label:"Stories Done",   value:doneStories,  icon:"✅", color:C.green                  },
    { label:"Pts Delivered",  value:`${doneEpicPts}/${totalEpicPts}`, icon:"📊", color:C.navy },
    { label:"Open Defects",   value:data.defects.total, icon:"🐛", color:data.defects.critical>0?C.red:C.amber },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* KPI strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12 }}>
        {kpis.map(k=>(
          <div key={k.label} style={{ background:C.white, border:`1px solid ${C.grey200}`, borderRadius:10, padding:"14px 16px", borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{k.icon}</div>
            <div style={{ fontWeight:800, fontSize:22, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:11, color:C.grey400, marginTop:4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Row 2: Burndown + Velocity */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* Burndown */}
        <Card>
          <CardTitle>{activeSprint?.name||"Sprint"} — Burndown Chart</CardTitle>
          {activeSprint ? (
            <>
              <FullBurndown data={data.burndown} color={wsColor} width={460} height={200}/>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:12 }}>
                {[["Committed",`${activeSprint.points} pts`,C.grey700],["Done",`${activeSprint.done} pts`,wsColor],["Remaining",`${activeSprint.points-activeSprint.done} pts`,C.amber],["Trend",data.health==="On Track"?"✓ On Track":"⚠ Behind",data.health==="On Track"?C.green:C.red]].map(([l,v,c])=>(
                  <div key={l} style={{ textAlign:"center", background:C.grey50, borderRadius:8, padding:"8px 4px" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:c }}>{v}</div>
                    <div style={{ fontSize:10, color:C.grey400 }}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ color:C.grey300, fontSize:13, padding:"40px 0", textAlign:"center" }}>No active sprint</div>}
        </Card>

        {/* Velocity */}
        <Card>
          <CardTitle>Sprint Velocity</CardTitle>
          <VelocityChart sprints={data.sprints} avgVelocity={data.avgVelocity} color={wsColor} width={340} height={140}/>
          {/* Sprint table */}
          <div style={{ marginTop:14, borderTop:`1px solid ${C.grey100}`, paddingTop:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 70px 70px 50px", gap:8, fontSize:10, fontWeight:700, color:C.grey400, textTransform:"uppercase", letterSpacing:0.4, marginBottom:8, padding:"0 2px" }}>
              <span>Sprint</span><span>Goal</span><span>Points</span><span>Dates</span><span>Status</span>
            </div>
            {data.sprints.map(sp=>(
              <div key={sp.id} style={{ display:"grid", gridTemplateColumns:"90px 1fr 70px 70px 50px", gap:8, padding:"6px 2px", borderBottom:`1px solid ${C.grey50}`, alignItems:"center" }}>
                <span style={{ fontWeight:700, fontSize:12, color:C.grey800 }}>{sp.name}</span>
                <span style={{ fontSize:11, color:C.grey500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sp.goal}</span>
                <span style={{ fontSize:12, fontWeight:600, color:sp.done>=sp.points?C.green:C.grey600 }}>{sp.done}/{sp.points}</span>
                <span style={{ fontSize:10, color:C.grey400 }}>{sp.start}</span>
                <Pill label={sp.status} color={sp.status==="Active"?C.greenLight:sp.status==="Closed"?C.grey100:C.tealLight} textColor={sp.status==="Active"?C.green:sp.status==="Closed"?C.grey500:C.teal} size="xs" dot/>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3: Status dist + Defects */}
      <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:16 }}>
        <Card>
          <CardTitle>Story Status Distribution</CardTitle>
          <StatusDistChart dist={data.statusDist} total={totalStories}/>
          <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${C.grey100}`, display:"flex", gap:16 }}>
            {[["Total",totalStories,C.grey700],["Completed",doneStories,C.green],["In Flight",data.statusDist["In Progress"]+(data.statusDist["Review"]||0)+data.statusDist.Testing,wsColor]].map(([l,v,c])=>(
              <div key={l} style={{ textAlign:"center", flex:1 }}>
                <div style={{ fontWeight:700, fontSize:18, color:c }}>{v}</div>
                <div style={{ fontSize:10, color:C.grey400 }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Defect health */}
        <Card>
          <CardTitle>Defect Health</CardTitle>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
            {[["Total",data.defects.total,C.grey700,C.grey100],["Critical",data.defects.critical,C.red,C.redLight],["Major",data.defects.major,C.amber,C.amberLight],["Minor",data.defects.minor,C.blue,C.blueLight]].map(([l,v,c,bg])=>(
              <div key={l} style={{ background:bg, borderRadius:8, padding:"12px 0", textAlign:"center" }}>
                <div style={{ fontWeight:800, fontSize:24, color:c }}>{v}</div>
                <div style={{ fontSize:11, color:C.grey500, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.grey500, marginBottom:4 }}>
              <span>Defect resolution rate</span>
              <span style={{ fontWeight:700 }}>{100-data.defects.openPct}% resolved</span>
            </div>
            <ProgressBar pct={100-data.defects.openPct} color={data.defects.openPct>50?C.amber:C.green} height={8}/>
          </div>
          <div style={{ fontSize:12, color:C.grey400, lineHeight:1.6 }}>
            {data.defects.critical>0
              ? <span style={{ color:C.red, fontWeight:600 }}>⚠ {data.defects.critical} critical defect{data.defects.critical>1?"s":""} require immediate attention.</span>
              : <span style={{ color:C.green, fontWeight:600 }}>✓ No critical defects open.</span>
            }
          </div>
        </Card>
      </div>

      {/* Row 4: Epic Roll-up */}
      <Card>
        <CardTitle>Epic Roll-up Summary</CardTitle>
        <EpicRollupTable epics={data.epics}/>
      </Card>

      {/* Row 5: Team capacity */}
      <Card>
        <CardTitle>Team Capacity</CardTitle>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          <div>
            <div style={{ fontSize:11, color:C.grey400, marginBottom:6 }}>Capacity used this sprint</div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <ProgressBar pct={data.capacityUsed} color={data.capacityUsed>90?C.red:data.capacityUsed>75?C.amber:C.green} height={12}/>
              <span style={{ fontWeight:700, fontSize:16, color:C.grey800, minWidth:40 }}>{data.capacityUsed}%</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:20 }}>
            {[["Team size",`${data.teamSize} members`],["Avg velocity",`${data.avgVelocity} pts/sprint`],["Sprints to done",data.epics.reduce((a,e)=>a+(e.ptsTotal-e.ptsDone),0)>0?Math.ceil(data.epics.reduce((a,e)=>a+(e.ptsTotal-e.ptsDone),0)/Math.max(data.avgVelocity,1))+"sprints":"Complete"]].map(([l,v])=>(
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontWeight:700, fontSize:15, color:C.grey800 }}>{v}</div>
                <div style={{ fontSize:11, color:C.grey400 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

    </div>
  );
}

// ─── Epic roll-up table ───────────────────────────────────────────────────────
function EpicRollupTable({ epics, showWs=false }) {
  const headers = ["Epic", ...(showWs?["Workstream"]:[]), "Initiative", "Owner", "Size", "Stories", "Done", "Pts Total", "Pts Done", "Progress"];
  const cols = showWs
    ? "1fr 90px 140px 100px 48px 60px 50px 72px 72px 140px"
    : "1fr 140px 100px 48px 60px 50px 72px 72px 140px";

  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ minWidth:700 }}>
        <div style={{ display:"grid", gridTemplateColumns:cols, gap:8, padding:"7px 12px", background:C.grey50, borderRadius:"8px 8px 0 0", border:`1px solid ${C.grey200}`, borderBottom:"none", fontSize:10, fontWeight:700, color:C.grey400, textTransform:"uppercase", letterSpacing:0.4 }}>
          {headers.map(h=><span key={h}>{h}</span>)}
        </div>
        {epics.map((e,i)=>{
          const ws = showWs ? WORKSTREAMS.find(w=>w.id===e.wsId) : null;
          return (
            <div key={e.id} style={{ display:"grid", gridTemplateColumns:cols, gap:8, padding:"10px 12px", background:i%2===0?C.white:C.grey50, border:`1px solid ${C.grey200}`, borderTop:"none", borderBottom:i===epics.length-1?`1px solid ${C.grey200}`:"none", borderRadius:i===epics.length-1?"0 0 8px 8px":"none", alignItems:"center" }}
              onMouseEnter={e2=>e2.currentTarget.style.background=C.blueFaint}
              onMouseLeave={e2=>e2.currentTarget.style.background=i%2===0?C.white:C.grey50}>
              <div>
                <div style={{ fontSize:10, color:C.grey400 }}>{e.id}</div>
                <div style={{ fontWeight:600, fontSize:13, color:e.color, cursor:"pointer" }}>{e.title}</div>
              </div>
              {showWs&&<div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:6, height:6, borderRadius:"50%", background:ws?.color, flexShrink:0 }}/><span style={{ fontSize:11, color:C.grey600 }}>{ws?.name}</span></div>}
              <span style={{ fontSize:11, color:C.grey500 }}>{e.initiative}</span>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}><Avatar name={e.owner} size={22}/></div>
              <span style={{ background:tshirtBg(e.tshirt), color:tshirtFg(e.tshirt), borderRadius:4, padding:"2px 6px", fontSize:10, fontWeight:700, textAlign:"center" }}>{e.tshirt}</span>
              <span style={{ fontWeight:600, fontSize:13, color:C.grey700, textAlign:"center" }}>{e.stories}</span>
              <span style={{ fontWeight:600, fontSize:13, color:C.grey700, textAlign:"center" }}>{e.done}</span>
              <span style={{ fontWeight:600, fontSize:13, color:C.grey700, textAlign:"center" }}>{e.ptsTotal}</span>
              <span style={{ fontWeight:700, fontSize:13, color:e.ptsDone>0?C.blue:C.grey300, textAlign:"center" }}>{e.ptsDone}</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <ProgressBar pct={e.progress} color={e.color} height={6}/>
                <span style={{ fontWeight:700, fontSize:12, color:e.progress>=100?C.green:e.color, minWidth:36, textAlign:"right" }}>{e.progress}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
