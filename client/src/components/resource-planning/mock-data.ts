export type AvatarColor = "brand" | "teal" | "green" | "amber" | "violet" | "red";

export type DsCell = "surplus" | "shortage" | "watch" | "ok";

export const PERSONAS = [
  { id: "res-mgr", label: "Resource Mgr" },
  { id: "exec", label: "Exec" },
  { id: "sales", label: "Sales" },
  { id: "hr", label: "HR" },
] as const;

export const EXEC_KPIS = [
  { label: "Total Capacity", value: "147", sub: "resources available", accent: "#4338CA" },
  { label: "Billable Utilisation", value: "74%", sub: "↓ 3% vs last month · Target: 82%", accent: "#D97706", valueColor: "#D97706" },
  { label: "Forecast Revenue", value: "£4.2M", sub: "↑ 8% vs Q2 forecast", accent: "#059669", valueColor: "#059669" },
  { label: "On the Bench", value: "21", sub: "↑ 4 vs last month · 14%", accent: "#DC2626", valueColor: "#DC2626" },
  { label: "Open Skills Gaps", value: "7", sub: "3 critical · 4 emerging", accent: "#DC2626", valueColor: "#DC2626" },
];

export const AT_RISK_RESOURCES = [
  { initials: "SC", color: "brand" as AvatarColor, name: "Sarah Chen", role: "Sr Developer", rolloff: "12 Jun", status: "No booking", statusVariant: "destructive" as const },
  { initials: "JO", color: "teal" as AvatarColor, name: "James Okafor", role: "SAP Consultant", rolloff: "18 Jun", status: "1 prospect", statusVariant: "warning" as const },
  { initials: "PM", color: "green" as AvatarColor, name: "Priya Mehta", role: "Business Analyst", rolloff: "22 Jun", status: "1 prospect", statusVariant: "warning" as const },
  { initials: "RB", color: "violet" as AvatarColor, name: "Robert Burns", role: "Test Manager", rolloff: "30 Jun", status: "Booked", statusVariant: "success" as const },
];

export const PIPELINE_DEMAND = [
  { role: "SAP Consultants", count: 17, pct: 85, color: "bg-red-500" },
  { role: "Project Managers", count: 12, pct: 60, color: "bg-amber-500" },
  { role: "Business Analysts", count: 14, pct: 70, color: "bg-indigo-600" },
  { role: "Test Managers", count: 8, pct: 40, color: "bg-teal-500" },
  { role: "Developers", count: 11, pct: 55, color: "bg-violet-500" },
  { role: "Architects", count: 6, pct: 30, color: "bg-emerald-500" },
];

export const SKILLS_GAPS = [
  { skill: "SAP S/4HANA", demand: 15, supply: 11, gap: -4, severity: "critical" as const, action: "Recruit 4 by Jan 2027" },
  { skill: "SAP BTP / Cloud", demand: 8, supply: 5, gap: -3, severity: "critical" as const, action: "Upskill or recruit by Q4" },
  { skill: "AI / ML Consulting", demand: 6, supply: 4, gap: -2, severity: "watch" as const, action: "Monitor — fast-growing demand" },
];

export const DSM_MONTHS = ["Jun '26", "Jul '26", "Aug '26", "Sep '26", "Oct '26", "Nov '26", "Dec '26", "Jan '27", "Feb '27", "Mar '27"];

export const DSM_ROWS = [
  { skill: "SAP S/4HANA", sub: "Finance & Logistics", supply: 11, cells: ["+2", "-1", "-3", "-4", "-5", "-4", "-3", "-2", "-1", "0"] as const, cellTypes: ["surplus", "shortage", "shortage", "shortage", "shortage", "shortage", "shortage", "shortage", "watch", "ok"] as DsCell[] },
  { skill: "SAP BTP / Cloud", sub: "Platform & Integration", supply: 5, cells: ["0", "-1", "-2", "-3", "-3", "-2", "-1", "0", "0", "+1"] as const, cellTypes: ["ok", "shortage", "shortage", "shortage", "shortage", "shortage", "watch", "ok", "ok", "surplus"] as DsCell[] },
  { skill: "Project Management", sub: "Senior PM / Programme", supply: 14, cells: ["+4", "+3", "+2", "-1", "-2", "-3", "-1", "+1", "+2", "+3"] as const, cellTypes: ["surplus", "surplus", "surplus", "watch", "shortage", "shortage", "watch", "surplus", "surplus", "surplus"] as DsCell[] },
  { skill: "Business Analysis", sub: "BA / Process Analyst", supply: 18, cells: ["+5", "+4", "+2", "+1", "-1", "-1", "0", "+2", "+3", "+4"] as const, cellTypes: ["surplus", "surplus", "surplus", "surplus", "watch", "watch", "ok", "surplus", "surplus", "surplus"] as DsCell[] },
  { skill: "Test Management", sub: "QA / Test Lead", supply: 9, cells: ["+2", "+1", "0", "-1", "-1", "-2", "-1", "0", "+1", "+2"] as const, cellTypes: ["surplus", "surplus", "ok", "watch", "watch", "shortage", "watch", "ok", "surplus", "surplus"] as DsCell[] },
  { skill: "Software Development", sub: "Full Stack / React / Node", supply: 22, cells: ["+6", "+5", "+4", "+3", "+2", "+1", "0", "-1", "-2", "-1"] as const, cellTypes: ["surplus", "surplus", "surplus", "surplus", "surplus", "surplus", "ok", "watch", "shortage", "watch"] as DsCell[] },
  { skill: "AI / ML Consulting", sub: "Emerging — fast growing", supply: 4, cells: ["0", "-1", "-1", "-2", "-2", "-3", "-3", "-4", "-4", "-5"] as const, cellTypes: ["ok", "shortage", "shortage", "shortage", "shortage", "shortage", "shortage", "shortage", "shortage", "shortage"] as DsCell[], supplyColor: "text-amber-600" },
];

export const HEATMAP_RESOURCES = [
  { initials: "SC", color: "brand" as AvatarColor, name: "Sarah Chen", role: "Sr Dev", weeks: ["100", "100", "—", "—", "—", "—", "—", "—", "80", "80", "80", "80", "80", "—", "—", "—"] as const, weekTypes: ["red", "red", "green", "green", "green", "green", "green", "green", "blue", "blue", "blue", "blue", "blue", "green", "green", "green"] as const },
  { initials: "JO", color: "teal" as AvatarColor, name: "James Okafor", role: "SAP Cons", weeks: ["100", "100", "100", "60", "60", "60", "100", "100", "100", "100", "100", "100", "100", "100", "60", "60"] as const, weekTypes: ["red", "red", "red", "amber", "amber", "amber", "red", "red", "red", "red", "red", "red", "red", "red", "amber", "amber"] as const },
  { initials: "PM", color: "green" as AvatarColor, name: "Priya Mehta", role: "BA", weeks: ["100", "100", "—", "—", "—", "—", "—", "50", "50", "50", "100", "100", "100", "100", "100", "80"] as const, weekTypes: ["red", "red", "green", "green", "green", "green", "green", "amber", "amber", "amber", "red", "red", "red", "red", "red", "amber"] as const },
  { initials: "RB", color: "violet" as AvatarColor, name: "Robert Burns", role: "Test Mgr", weeks: ["80", "80", "80", "80", "100", "100", "100", "100", "—", "—", "—", "—", "80", "80", "—", "—"] as const, weekTypes: ["amber", "amber", "amber", "amber", "red", "red", "red", "red", "green", "green", "green", "green", "blue", "blue", "green", "green"] as const },
  { initials: "MK", color: "amber" as AvatarColor, name: "Maria Koch", role: "SAP Cons", weeks: ["Leave", "Leave", "100", "100", "100", "100", "100", "100", "100", "100", "100", "60", "—", "—", "—", "—"] as const, weekTypes: ["grey", "grey", "red", "red", "red", "red", "red", "red", "red", "red", "red", "amber", "green", "green", "green", "green"] as const },
  { initials: "DL", color: "red" as AvatarColor, name: "David Lee", role: "Architect", weeks: ["50", "50", "50", "50", "—", "—", "—", "—", "100", "100", "100", "100", "100", "100", "100", "100"] as const, weekTypes: ["amber", "amber", "amber", "amber", "green", "green", "green", "green", "red", "red", "red", "red", "red", "red", "red", "red"] as const },
];

export const SCHEDULER_ROWS = [
  { initials: "SC", color: "brand" as AvatarColor, name: "Sarah Chen", role: "Sr Developer · London", bars: [{ span: 2, label: "TechNova (100%)", color: "bg-indigo-600" }, { span: 2, type: "avail" as const }, { span: 4, type: "avail" as const }, { span: 4, label: "HSBC (soft 80%)", color: "bg-blue-700", soft: true }, { span: 2, label: "HSBC (soft)", color: "bg-blue-700", soft: true }, { span: 2, type: "avail" as const }] },
  { initials: "JO", color: "teal" as AvatarColor, name: "James Okafor", role: "SAP Consultant · Manchester", bars: [{ span: 3, label: "Barclays ERP (100%)", color: "bg-teal-600" }, { span: 2, label: "Barclays (60%)", color: "bg-teal-600/80" }, { span: 2, label: "RetailCo (100%)", color: "bg-teal-600" }, { span: 4, label: "RetailCo (100%)", color: "bg-teal-600" }, { span: 4, label: "RetailCo (100%)", color: "bg-teal-600" }] },
  { initials: "PM", color: "green" as AvatarColor, name: "Priya Mehta", role: "Business Analyst · London", bars: [{ span: 2, label: "NHS Trust (100%)", color: "bg-violet-600" }, { span: 4, type: "avail" as const }, { span: 2, label: "NHS (50%)", color: "bg-violet-600/80" }, { span: 4, label: "Digital Transformation (100%)", color: "bg-violet-600" }, { span: 4, label: "Digital Transform (100%)", color: "bg-violet-600" }] },
  { initials: "RB", color: "violet" as AvatarColor, name: "Robert Burns", role: "Test Manager · Edinburgh", bars: [{ span: 4, label: "CloudNova QA (80%)", color: "bg-amber-600" }, { span: 4, label: "CloudNova QA (100%)", color: "bg-amber-600" }, { span: 4, type: "avail" as const }, { span: 2, label: "HSBC (soft)", color: "bg-blue-700", soft: true }, { span: 2, type: "avail" as const }] },
  { initials: "MK", color: "amber" as AvatarColor, name: "Maria Koch", role: "SAP Consultant · Frankfurt", bars: [{ span: 2, type: "leave" as const }, { span: 6, label: "SAP S/4HANA — Apex (100%)", color: "bg-emerald-600" }, { span: 4, label: "Apex (100%)", color: "bg-emerald-600" }, { span: 4, type: "avail" as const }] },
  { initials: "DL", color: "red" as AvatarColor, name: "David Lee", role: "Solutions Architect · London", bars: [{ span: 4, label: "Multi-project (50%)", color: "bg-red-600/70" }, { span: 4, type: "avail" as const }, { span: 8, label: "HSBC Architecture (100%)", color: "bg-red-600" }] },
];

export const SKILLS_DISTRIBUTION = [
  { practice: "SAP Practice", count: 38, pct: 26, color: "bg-indigo-600" },
  { practice: "Software Development", count: 34, pct: 23, color: "bg-teal-500" },
  { practice: "Project & Programme Mgmt", count: 28, pct: 19, color: "bg-violet-500" },
  { practice: "Business Analysis", count: 22, pct: 15, color: "bg-emerald-500" },
  { practice: "Testing & QA", count: 16, pct: 11, color: "bg-amber-500" },
  { practice: "AI & Emerging Tech", count: 9, pct: 6, color: "bg-red-500" },
];

export const TOP_DEMANDED_SKILLS = [
  { skill: "SAP S/4HANA", supply: 11, demand: 15, gap: -4, status: "Critical", variant: "destructive" as const },
  { skill: "SAP BTP", supply: 5, demand: 8, gap: -3, status: "Critical", variant: "destructive" as const },
  { skill: "AI/ML Consulting", supply: 4, demand: 6, gap: -2, status: "Watch", variant: "warning" as const },
  { skill: "React / Node.js", supply: 18, demand: 16, gap: 2, status: "Healthy", variant: "success" as const },
  { skill: "Agile Delivery", supply: 24, demand: 20, gap: 4, status: "Surplus", variant: "success" as const },
];

export const SKILLS_MATRIX = [
  { initials: "SC", color: "brand" as AvatarColor, name: "Sarah Chen", id: "R-001", role: "Senior Developer", grade: "Grade 4", location: "London", languages: "English, Mandarin", skills: [{ name: "React / Node.js", level: 100 }, { name: "AWS Cloud", level: 75 }, { name: "SAP BTP", level: 50 }], certs: "AWS Solutions Architect\nAzure Developer", util: 87, utilColor: "text-emerald-600" },
  { initials: "JO", color: "teal" as AvatarColor, name: "James Okafor", id: "R-002", role: "SAP Consultant", grade: "Grade 5", location: "Manchester", languages: "English, French", skills: [{ name: "SAP S/4HANA", level: 100 }, { name: "SAP Finance", level: 100 }, { name: "Agile / PRINCE2", level: 75 }], certs: "SAP FICO Certified\nPRINCE2 Practitioner", util: 100, utilColor: "text-red-600", utilNote: "Fully booked" },
  { initials: "PM", color: "green" as AvatarColor, name: "Priya Mehta", id: "R-003", role: "Business Analyst", grade: "Grade 3", location: "London", languages: "English, Hindi", skills: [{ name: "Business Analysis", level: 75 }, { name: "Process Mapping", level: 75 }, { name: "Banking Domain", level: 50 }], certs: "BCS BA Practitioner\nAgile BA", util: 65, utilColor: "text-amber-600" },
  { initials: "MK", color: "amber" as AvatarColor, name: "Maria Koch", id: "R-004", role: "SAP Consultant", grade: "Grade 5", location: "Frankfurt", languages: "German, English", skills: [{ name: "SAP S/4HANA", level: 100 }, { name: "SAP BTP", level: 100 }, { name: "Banking Industry", level: 75 }], certs: "SAP S/4HANA Expert\nSAP BTP Associate", util: 100, utilColor: "text-red-600", utilNote: "Fully booked" },
];

export const PIPELINE_OPPORTUNITIES = [
  {
    client: "HSBC — Digital Transformation",
    project: "SAP S/4HANA Finance Implementation · Jan–Jun 2027",
    value: "£2.4M",
    tags: [{ label: "70% probability", variant: "success" as const }, { label: "⚠ Resource risk", variant: "warning" as const }, { label: "Soft demand active", variant: "info" as const }, { label: "Start: Jan 2027", variant: "muted" as const }],
    roles: [
      { count: 2, role: "Senior Project Managers", avail: "2 available", availVariant: "success" as const },
      { count: 3, role: "SAP S/4HANA Consultants", avail: "0 available ⚠", availVariant: "destructive" as const },
      { count: 4, role: "Business Analysts", avail: "2 available", availVariant: "warning" as const },
      { count: 1, role: "Test Manager", avail: "1 available", availVariant: "success" as const },
    ],
  },
  {
    client: "Barclays — Core Banking Platform",
    project: "SAP BTP Cloud Integration · Mar–Dec 2027",
    value: "£1.8M",
    tags: [{ label: "55% probability", variant: "warning" as const }, { label: "⚡ Critical risk", variant: "destructive" as const }, { label: "Start: Mar 2027", variant: "muted" as const }],
    roles: [
      { count: 1, role: "Programme Manager", avail: "1 available", availVariant: "success" as const },
      { count: 4, role: "SAP BTP Consultants", avail: "1 available ⚠", availVariant: "destructive" as const },
      { count: 2, role: "Integration Architects", avail: "1 available", availVariant: "warning" as const },
    ],
  },
  {
    client: "NHS Trust — Digital Health",
    project: "Digital Transformation Programme · Jun 2026–Mar 2027",
    value: "£1.2M",
    tags: [{ label: "80% probability", variant: "success" as const }, { label: "Resourcing confirmed", variant: "success" as const }, { label: "Start: Jun 2026", variant: "muted" as const }],
    roles: [
      { count: 1, role: "Programme Manager", avail: "Confirmed", availVariant: "success" as const },
      { count: 3, role: "Business Analysts", avail: "Confirmed", availVariant: "success" as const },
      { count: 2, role: "Developers", avail: "Confirmed", availVariant: "success" as const },
    ],
  },
];

export const RECRUITMENT_CARDS = [
  { type: "shortage" as const, month: "Action required by Oct 2026", skill: "SAP S/4HANA Consultants", rows: [{ l: "Demand (Jan 2027)", v: "15 FTE" }, { l: "Supply", v: "11 FTE" }, { l: "Gap", v: "–4 FTE", red: true }, { l: "Driving opportunity", v: "HSBC, Barclays" }], action: "Recruit 4 SAP S/4HANA consultants — Grade 4–5 · £75–95K", primary: "Create Requisition", secondary: "Subcontract" },
  { type: "shortage" as const, month: "Action required by Nov 2026", skill: "SAP BTP / Cloud Consultants", rows: [{ l: "Demand (Mar 2027)", v: "8 FTE" }, { l: "Supply", v: "5 FTE" }, { l: "Gap", v: "–3 FTE", red: true }, { l: "Driving opportunity", v: "Barclays" }], action: "Recruit 2 + upskill 1 existing SAP consultant on BTP", primary: "Create Requisition", secondary: "Upskill Plan" },
  { type: "watch" as const, month: "Monitor — Q4 2026", skill: "AI / ML Consultants", rows: [{ l: "Demand (Q1 2027)", v: "6 FTE" }, { l: "Supply", v: "4 FTE" }, { l: "Gap", v: "–2 FTE", amber: true }, { l: "Risk level", v: "Emerging / fast-growing" }], action: "Monitor demand — consider graduate/upskill programme", primary: "Start Upskill Plan", secondary: null },
];

export const RECRUITMENT_TIMELINE = [
  { role: "SAP S/4HANA Consultant", grade: "Grade 4", headcount: 2, tth: "10 weeks", start: "19 Oct 2026", goLive: "Jan 2027", cost: "£160K / yr", status: "Action needed", statusVariant: "destructive" as const },
  { role: "SAP S/4HANA Consultant", grade: "Grade 5", headcount: 2, tth: "12 weeks", start: "12 Oct 2026", goLive: "Jan 2027", cost: "£200K / yr", status: "Action needed", statusVariant: "destructive" as const },
  { role: "SAP BTP Consultant", grade: "Grade 4", headcount: 2, tth: "10 weeks", start: "16 Nov 2026", goLive: "Mar 2027", cost: "£160K / yr", status: "Plan in progress", statusVariant: "warning" as const },
  { role: "AI/ML Consultant", grade: "Grade 3–4", headcount: 2, tth: "12 weeks", start: "Q4 2026", goLive: "Q1 2027", cost: "£150K / yr", status: "Monitoring", statusVariant: "warning" as const },
];

export const BENCH_RESOURCES = [
  { initials: "AK", color: "green" as AvatarColor, name: "Aiko Kimura", role: "SAP Consultant", skills: "SAP S/4HANA · FICO · Banking", since: "01 Jun 2026", days: 5, match: "✓ HSBC match", matchVariant: "success" as const, action: "Assign →", actionVariant: "default" as const },
  { initials: "TP", color: "violet" as AvatarColor, name: "Tom Pearce", role: "Developer", skills: "React · Node.js · AWS", since: "28 May 2026", days: 9, match: "2 partial matches", matchVariant: "warning" as const, action: "View →", actionVariant: "default" as const },
  { initials: "LN", color: "red" as AvatarColor, name: "Laura Novak", role: "Project Manager", skills: "PRINCE2 · Agile · Banking", since: "20 May 2026", days: 17, match: "No match found", matchVariant: "destructive" as const, action: "Redeploy", actionVariant: "warning" as const },
];

export const AI_MESSAGES = [
  { role: "ai" as const, text: "Hello! I'm your AI Workforce Planner. I have full visibility of your 147 resources, 5 pipeline opportunities, skills inventory, capacity, and recruitment pipeline.\n\nI can help you find available consultants, identify resource risks, plan recruitment, optimise utilisation, or model staffing scenarios. What would you like to know?" },
  { role: "user" as const, text: "Show me all SAP consultants available in Q3 2026" },
  { role: "ai" as const, text: "I found 3 SAP consultants with meaningful availability in Q3 2026:\n\n1. Aiko Kimura — SAP S/4HANA (Expert), FICO (Expert), Banking industry\n   Available: Fully from 1 Jun · Bill rate: £840/day\n\n2. Maria Koch — SAP S/4HANA (Expert), SAP BTP (Expert)\n   Available: From 15 Sep (currently on Apex project) · £920/day\n\n3. James Okafor — SAP S/4HANA (Expert)\n   Partially available Jul only (60%) · Fully booked Jun, Aug, Sep\n\nWarning: Against your confirmed Q3 SAP demand of 8 FTE, this gives you only 2.6 FTE — a shortage of 5.4 FTE. I recommend immediate recruitment action or contractor engagement." },
  { role: "user" as const, text: "Which pipeline opportunities are at risk due to resource shortages?" },
  { role: "ai" as const, text: "2 opportunities are currently at delivery risk:\n\nHSBC Digital Transformation (£2.4M, 70% prob)\nNeeds: 3 SAP S/4HANA consultants from Jan 2027\nAvailable: 0 confirmed at that date\nRisk: HIGH — recommend recruiting 2 now, consider 1 contractor\n\nBarclays Core Banking (£1.8M, 55% prob)\nNeeds: 4 SAP BTP consultants from Mar 2027\nAvailable: 1 confirmed at that date\nRisk: MEDIUM — current BTP supply insufficient if opportunity wins\n\nThese two opportunities represent £4.2M of pipeline at risk. Would you like me to generate a detailed recruitment plan?" },
];

export const AI_SUGGESTIONS = [
  "What skills should we recruit over the next 6 months?",
  "Optimise utilisation above 80%",
  "Who is on the bench and why?",
  "Model best case scenario for Q4",
];

export const AI_QUICK_QUERIES = [
  "Find SAP consultants for HSBC project",
  "Who rolls off in the next 30 days?",
  "What is our forecast utilisation for Q3?",
  "Generate recruitment recommendations for HR",
  "Which resources can be upskilled on SAP BTP?",
];

export const SCENARIO_COMPARISON = [
  { metric: "Pipeline Revenue", worst: "£3.1M", expected: "£5.4M", best: "£8.4M" },
  { metric: "Resource Demand", worst: "62 FTE", expected: "89 FTE", best: "126 FTE" },
  { metric: "Utilisation", worst: "58%", expected: "74%", best: "86%" },
  { metric: "Bench Size", worst: "34 FTE", expected: "21 FTE", best: "8 FTE" },
  { metric: "SAP Shortage", worst: "0", expected: "–4", best: "–11" },
  { metric: "Recruitment needed", worst: "0", expected: "6 FTE", best: "18 FTE" },
];

export const SCENARIO_ACTIONS = [
  { severity: "critical" as const, title: "Recruit 4 SAP S/4HANA consultants", detail: "By Oct 2026 · Grade 4–5 · Est. £320K/yr · Critical path" },
  { severity: "warning" as const, title: "Upskill 2 consultants on SAP BTP", detail: "By Dec 2026 · Internal programme · Reduces gap from –3 to –1" },
  { severity: "info" as const, title: "Engage 3 SAP contractors (Q3 buffer)", detail: "Contractor network · £600–700/day · Short-term cover while recruiting" },
  { severity: "success" as const, title: "Redeploy 8 bench resources", detail: "3 match NHS pipeline · 5 can move to internal projects · Saves £32K/month" },
];
