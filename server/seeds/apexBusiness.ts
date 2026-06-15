import { db } from "../db";
import {
  strategyItems, departments, goals, objectives, initiatives,
  okrs, kpis, keyResults, risks, businessTasks, processes, tools,
  meetings, documentLinks,
} from "@shared/models/business";
import { eq } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function rag(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.includes("on track")) return "green";
  if (s.includes("behind"))   return "red";
  if (s.includes("at risk"))  return "amber";
  return "green";
}

function goalStatus(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.includes("on track")) return "on_track";
  if (s.includes("behind"))   return "behind";
  if (s.includes("at risk"))  return "at_risk";
  return "on_track";
}

function pct(raw: string): number {
  return parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
}

function numericOrNull(raw: string): string | null {
  const stripped = raw.replace(/[^0-9.]/g, "");
  return stripped.length > 0 ? stripped : null;
}

// ── Apex Solutions Group — Business Seed ─────────────────────────────────────

export async function seedApexBusinessData(tenantId: number) {

  // ── 1. Departments ─────────────────────────────────────────────────────────
  const deptNames = [
    "Sales & Marketing", "Professional Services", "Technology",
    "People & Culture", "Executive", "Operations", "Finance", "Delivery",
  ];
  const deptMap: Record<string, number> = {};
  for (const name of deptNames) {
    const [d] = await db.insert(departments).values({ tenantId, name }).returning({ id: departments.id });
    deptMap[name] = d.id;
  }
  const dept = (name: string) => deptMap[name] ?? null;

  // ── 2. Strategy Items ──────────────────────────────────────────────────────
  const strategyData = [
    { key: "S1", name: "Market Leadership & Revenue Growth",
      desc: "Become the #1 mid-market ERP implementation partner in the UK & Ireland, growing revenue from £8M to £25M by 2027.",
      owner: "Sarah Blackwell", deptName: "Sales & Marketing", rag: "amber", prog: 55, date: "Dec 2027" },
    { key: "S2", name: "Delivery Excellence & Client Satisfaction",
      desc: "Achieve industry-leading project delivery quality with >95% on-time/on-budget rate and NPS >70 across all implementations.",
      owner: "Ayesha Nawaz", deptName: "Professional Services", rag: "green", prog: 68, date: "Dec 2026" },
    { key: "S3", name: "Technology Practice & AI Enablement",
      desc: "Build a cutting-edge technology practice leveraging AI, automation and cloud to differentiate our ERP offerings.",
      owner: "Ravi Patel", deptName: "Technology", rag: "amber", prog: 42, date: "Jun 2027" },
    { key: "S4", name: "People, Talent & Capacity Building",
      desc: "Attract, develop and retain top ERP consulting talent to scale headcount from 45 to 120 certified consultants by 2027.",
      owner: "Laura Simmons", deptName: "People & Culture", rag: "green", prog: 58, date: "Dec 2027" },
    { key: "S5", name: "Partner Ecosystem & Alliance Strategy",
      desc: "Achieve Gold/Platinum partner status with SAP, Oracle and Microsoft and build a profitable reseller revenue stream.",
      owner: "James Harrington", deptName: "Executive", rag: "amber", prog: 38, date: "Dec 2026" },
    { key: "S6", name: "Operational Efficiency & Scalability",
      desc: "Build scalable operations, repeatable delivery frameworks and financial controls to support 3x revenue growth profitably.",
      owner: "Claire Donovan", deptName: "Operations", rag: "green", prog: 72, date: "Jun 2026" },
  ];

  const stratMap: Record<string, number> = {};
  for (const s of strategyData) {
    const [row] = await db.insert(strategyItems).values({
      tenantId,
      templateType: "strategy",
      title: s.name,
      description: s.desc,
      ownerName: s.owner,
      departmentId: dept(s.deptName),
      ragStatus: s.rag,
      progress: s.prog,
      status: "in_progress",
      trend: "stable",
      targetDate: s.date,
      reviewCadence: "quarterly",
    }).returning({ id: strategyItems.id });
    stratMap[s.key] = row.id;
  }

  // ── 3. Goals ───────────────────────────────────────────────────────────────
  const goalsRaw = [
    ["G01","S1","Win 12 new ERP implementation contracts per year","Daniel Webb","Sales & Marketing"," At Risk","40%","Dec 2025"],
    ["G02","S1","Expand into 3 new industry verticals (Manufacturing, Healthcare, Public Sector)","Sarah Blackwell","Sales & Marketing"," At Risk","25%","Jun 2026"],
    ["G03","S1","Build a £5M managed services recurring revenue stream","Ayesha Nawaz","Professional Services"," Behind","15%","Dec 2026"],
    ["G04","S1","Establish a pre-sales & solution architecture capability","Sarah Blackwell","Sales & Marketing"," On Track","60%","Jun 2025"],
    ["G05","S1","Achieve £25M annual revenue by 2027","Michael Torres","Finance"," At Risk","35%","Dec 2027"],
    ["G06","S2","Deliver 100% of projects on-time and within budget","Ayesha Nawaz","Professional Services"," On Track","72%","Dec 2025"],
    ["G07","S2","Achieve NPS score of 70+ across all client accounts","Nina Okafor","Delivery"," On Track","65%","Dec 2025"],
    ["G08","S2","Build standardised delivery playbooks for SAP, Oracle & D365","Ayesha Nawaz","Professional Services"," On Track","80%","Dec 2025"],
    ["G09","S2","Launch a client success & account management function","Nina Okafor","Delivery"," At Risk","45%","Dec 2025"],
    ["G10","S3","Launch an AI & Automation advisory service line","Ravi Patel","Technology"," At Risk","30%","Dec 2025"],
    ["G11","S3","Build a cloud migration & integration practice","Priya Mehta","Technology"," At Risk","38%","Dec 2025"],
    ["G12","S3","Develop proprietary accelerators and IP assets","Ravi Patel","Technology"," Behind","20%","Dec 2025"],
    ["G13","S3","Achieve 5 new technology certifications across the practice","Priya Mehta","Technology"," On Track","55%","Dec 2025"],
    ["G14","S4","Recruit 25 certified ERP consultants in FY2025","Laura Simmons","People & Culture"," On Track","60%","Dec 2025"],
    ["G15","S4","Launch a graduate & apprenticeship programme","Laura Simmons","People & Culture"," At Risk","35%","Sep 2025"],
    ["G16","S4","Achieve 90%+ employee engagement score","Laura Simmons","People & Culture"," On Track","75%","Dec 2025"],
    ["G17","S4","Build a structured learning & certification pathway","Nina Okafor","Delivery"," On Track","68%","Dec 2025"],
    ["G18","S5","Achieve SAP Gold Partner status","James Harrington","Executive"," At Risk","45%","Dec 2025"],
    ["G19","S5","Achieve Oracle Cloud Partner (Expertise level)","Ravi Patel","Technology"," At Risk","40%","Dec 2025"],
    ["G20","S5","Achieve Microsoft Solutions Partner (6 designations)","Priya Mehta","Technology"," At Risk","35%","Dec 2025"],
    ["G21","S5","Generate £2M software reseller margin annually","Michael Torres","Finance"," Behind","18%","Dec 2026"],
    ["G22","S6","Implement a PSA (Professional Services Automation) platform","Claire Donovan","Operations"," On Track","85%","Jun 2025"],
    ["G23","S6","Achieve ISO 27001 and Cyber Essentials Plus certification","Claire Donovan","Operations"," On Track","78%","Sep 2025"],
    ["G24","S6","Build a financial reporting and project P&L framework","Michael Torres","Finance"," On Track","80%","Mar 2025"],
    ["G25","S6","Reduce non-billable overhead to <15% of total capacity","Claire Donovan","Operations"," At Risk","50%","Dec 2025"],
    ["G26","S6","Launch a quality assurance & delivery review process","Ayesha Nawaz","Professional Services"," On Track","70%","Jun 2025"],
  ];

  const goalMap: Record<string, number> = {};
  for (const [key, stratKey, title, owner, deptName, rawRag, rawProg, date] of goalsRaw) {
    const [row] = await db.insert(goals).values({
      tenantId,
      strategyItemId: stratMap[stratKey],
      title,
      ownerName: owner,
      departmentId: dept(deptName),
      ragStatus: rag(rawRag),
      status: goalStatus(rawRag),
      progress: pct(rawProg),
      trend: "stable",
      targetDate: date,
      reviewCadence: "quarterly",
    }).returning({ id: goals.id });
    goalMap[key] = row.id;
  }

  // ── 4. Objectives ──────────────────────────────────────────────────────────
  const objectivesRaw = [
    ["O01","G01","Build a target account list of 100 qualified ERP prospects","Daniel Webb","Sales & Marketing"," At Risk","45%","Mar 2025"],
    ["O02","G01","Establish a structured sales process with CRM-tracked pipeline","Sarah Blackwell","Sales & Marketing"," At Risk","50%","Jun 2025"],
    ["O03","G01","Hire 3 additional business development managers","Sarah Blackwell","Sales & Marketing"," Behind","20%","Jun 2025"],
    ["O04","G02","Complete manufacturing sector GTM analysis and proposition","Tom Griffiths","Sales & Marketing"," At Risk","30%","Jun 2025"],
    ["O05","G02","Win first lighthouse client in Healthcare sector","Daniel Webb","Sales & Marketing"," Behind","10%","Dec 2025"],
    ["O06","G02","Develop Public Sector procurement & framework strategy","Sarah Blackwell","Sales & Marketing"," At Risk","25%","Sep 2025"],
    ["O07","G03","Define managed services offering and pricing tiers","Ayesha Nawaz","Professional Services"," Behind","15%","Jun 2025"],
    ["O08","G03","Sign first 3 managed services contracts","Daniel Webb","Sales & Marketing"," Behind","5%","Dec 2025"],
    ["O09","G04","Hire 2 senior pre-sales solution architects","Sarah Blackwell","Sales & Marketing"," On Track","70%","Mar 2025"],
    ["O10","G04","Build a demo environment and standard RFP response library","Priya Mehta","Technology"," On Track","65%","Jun 2025"],
    ["O11","G06","Implement a project health dashboard for all active engagements","Claire Donovan","Operations"," On Track","80%","Mar 2025"],
    ["O12","G06","Deploy risk & issue escalation framework on all projects","Ayesha Nawaz","Professional Services"," On Track","85%","Feb 2025"],
    ["O13","G06","Conduct monthly project steering reviews with all clients","Nina Okafor","Delivery"," On Track","75%","Dec 2025"],
    ["O14","G07","Roll out post-go-live CSAT surveys to all clients","Nina Okafor","Delivery"," On Track","70%","Mar 2025"],
    ["O15","G07","Introduce NPS measurement at project milestones","Ayesha Nawaz","Professional Services"," At Risk","55%","Jun 2025"],
    ["O16","G08","Complete SAP S/4HANA implementation playbook v1.0","Ayesha Nawaz","Professional Services"," On Track","90%","Mar 2025"],
    ["O17","G08","Complete Oracle Fusion implementation playbook v1.0","Nina Okafor","Delivery"," On Track","80%","Apr 2025"],
    ["O18","G08","Complete Microsoft D365 F&O playbook v1.0","Nina Okafor","Delivery"," On Track","75%","May 2025"],
    ["O19","G09","Define client success roles, KPIs and engagement model","Ayesha Nawaz","Professional Services"," At Risk","40%","Jun 2025"],
    ["O20","G09","Assign dedicated account managers to top 10 clients","Nina Okafor","Delivery"," At Risk","50%","Jun 2025"],
    ["O21","G10","Launch AI readiness assessment service for ERP clients","Ravi Patel","Technology"," At Risk","35%","Jun 2025"],
    ["O22","G10","Develop 3 AI-powered ERP accelerators (AP automation, forecasting, HR bot)","Priya Mehta","Technology"," Behind","20%","Dec 2025"],
    ["O23","G10","Achieve 5 AI/ML certifications across technology team","Priya Mehta","Technology"," At Risk","40%","Sep 2025"],
    ["O24","G11","Build Azure integration competency (Logic Apps, API Management)","Priya Mehta","Technology"," At Risk","45%","Jun 2025"],
    ["O25","G11","Complete first cloud ERP migration project","Ravi Patel","Technology"," At Risk","30%","Sep 2025"],
    ["O26","G12","Develop rapid deployment template for SAP Business One","Priya Mehta","Technology"," Behind","15%","Dec 2025"],
    ["O27","G12","Create pre-built data migration toolkit for legacy ERPs","Priya Mehta","Technology"," Behind","10%","Dec 2025"],
    ["O28","G14","Establish a talent acquisition process and employer brand","Laura Simmons","People & Culture"," On Track","65%","Mar 2025"],
    ["O29","G14","Engage 3 specialist ERP recruitment agencies","Laura Simmons","People & Culture"," On Track","80%","Feb 2025"],
    ["O30","G14","Onboard 15 SAP-certified consultants by Jun 2025","Laura Simmons","People & Culture"," On Track","60%","Jun 2025"],
    ["O31","G15","Partner with 2 universities for ERP graduate pipeline","Laura Simmons","People & Culture"," At Risk","30%","Sep 2025"],
    ["O32","G15","Launch first cohort of 6 ERP apprentices","Laura Simmons","People & Culture"," At Risk","25%","Sep 2025"],
    ["O33","G17","Map SAP, Oracle and D365 certification pathways by role","Nina Okafor","Delivery"," On Track","75%","Mar 2025"],
    ["O34","G17","Fund 100% of consultant certification costs","Michael Torres","Finance"," On Track","70%","Dec 2025"],
    ["O35","G18","Complete SAP Partner Business Plan submission","James Harrington","Executive"," At Risk","50%","Mar 2025"],
    ["O36","G18","Achieve required SAP certified consultant headcount (12)","Laura Simmons","People & Culture"," At Risk","42%","Dec 2025"],
    ["O37","G19","Pass Oracle Cloud expertise validation assessments","Priya Mehta","Technology"," At Risk","35%","Jun 2025"],
    ["O38","G19","Submit Oracle partner tier upgrade application","James Harrington","Executive"," At Risk","30%","Sep 2025"],
    ["O39","G20","Complete 6 Microsoft solution area designations","Priya Mehta","Technology"," At Risk","40%","Dec 2025"],
    ["O40","G20","Pass Microsoft partner competency audits","James Harrington","Executive"," At Risk","35%","Dec 2025"],
    ["O41","G22","Select and implement PSA platform (Rocketlane / Certinia)","Claire Donovan","Operations"," On Track","90%","Mar 2025"],
    ["O42","G22","Migrate all active projects to PSA resource scheduling","Claire Donovan","Operations"," On Track","75%","Jun 2025"],
    ["O43","G23","Complete ISO 27001 gap assessment and remediation","Claire Donovan","Operations"," On Track","80%","Jun 2025"],
    ["O44","G23","Achieve Cyber Essentials Plus certification","Claire Donovan","Operations"," On Track","85%","Mar 2025"],
    ["O45","G24","Implement project-level P&L reporting in Finance","Michael Torres","Finance"," On Track","82%","Mar 2025"],
    ["O46","G24","Build monthly management accounts pack with utilisation metrics","Callum Reid","Finance"," On Track","78%","Feb 2025"],
  ];

  const objMap: Record<string, number> = {};
  const goalFirstObjMap: Record<string, number> = {};
  for (const [key, goalKey, title, owner, deptName, rawRag, rawProg, date] of objectivesRaw) {
    const [row] = await db.insert(objectives).values({
      tenantId,
      goalId: goalMap[goalKey],
      title,
      ownerName: owner,
      departmentId: dept(deptName),
      ragStatus: rag(rawRag),
      status: goalStatus(rawRag),
      progress: pct(rawProg),
      trend: "stable",
      targetDate: date,
    }).returning({ id: objectives.id });
    objMap[key] = row.id;
    if (!goalFirstObjMap[goalKey]) goalFirstObjMap[goalKey] = row.id;
  }

  // ── 5. Initiatives ─────────────────────────────────────────────────────────
  const initiativesRaw = [
    ["I01","O01","G01","Sales Pipeline Acceleration Programme","Daniel Webb","Sales & Marketing"," At Risk","42%","Jun 2025"],
    ["I02","O02","G01","CRM Implementation & Sales Process Redesign (Jiganto CRM)","Sarah Blackwell","Sales & Marketing"," At Risk","55%","Apr 2025"],
    ["I03","O03","G01","BDM Recruitment Campaign — 3 hires Q1/Q2 2025","Laura Simmons","People & Culture"," Behind","20%","Jun 2025"],
    ["I04","O04","G02","Manufacturing ERP Market Entry Programme","Tom Griffiths","Sales & Marketing"," At Risk","28%","Sep 2025"],
    ["I05","O05","G02","Healthcare Sector Lighthouse Campaign","Daniel Webb","Sales & Marketing"," Behind","10%","Dec 2025"],
    ["I06","O07","G03","Managed Services Product Design & Packaging","Ayesha Nawaz","Professional Services"," Behind","12%","Jun 2025"],
    ["I07","O09","G04","Pre-Sales Architecture Team Build-Out","Sarah Blackwell","Sales & Marketing"," On Track","70%","Mar 2025"],
    ["I08","O10","G04","Demo Lab & Proposal Automation Platform","Priya Mehta","Technology"," On Track","60%","Jun 2025"],
    ["I09","O11","G06","Jiganto Project Health Dashboard Rollout","Claire Donovan","Operations"," On Track","85%","Mar 2025"],
    ["I10","O12","G06","Risk & Issue Framework Implementation","Ayesha Nawaz","Professional Services"," On Track","88%","Feb 2025"],
    ["I11","O14","G07","Client CSAT & NPS Programme","Nina Okafor","Delivery"," On Track","70%","Mar 2025"],
    ["I12","O16","G08","SAP S/4HANA Delivery Playbook Project","Ayesha Nawaz","Professional Services"," On Track","92%","Mar 2025"],
    ["I13","O17","G08","Oracle Fusion Delivery Playbook Project","Nina Okafor","Delivery"," On Track","80%","Apr 2025"],
    ["I14","O18","G08","Microsoft D365 Delivery Playbook Project","Nina Okafor","Delivery"," On Track","75%","May 2025"],
    ["I15","O19","G09","Client Success Function Launch","Ayesha Nawaz","Professional Services"," At Risk","38%","Sep 2025"],
    ["I16","O21","G10","AI Readiness Assessment Product Launch","Ravi Patel","Technology"," At Risk","32%","Jun 2025"],
    ["I17","O22","G10","ERP AI Accelerator Development Programme","Priya Mehta","Technology"," Behind","18%","Dec 2025"],
    ["I18","O24","G11","Azure Integration Competency Build","Priya Mehta","Technology"," At Risk","42%","Jun 2025"],
    ["I19","O26","G12","SAP Business One Rapid Deploy Template","Priya Mehta","Technology"," Behind","12%","Dec 2025"],
    ["I20","O28","G14","Employer Branding & Talent Attraction Campaign","Laura Simmons","People & Culture"," On Track","62%","Mar 2025"],
    ["I21","O29","G14","Recruitment Agency Partnership Programme","Laura Simmons","People & Culture"," On Track","82%","Feb 2025"],
    ["I22","O30","G14","SAP Consultant Hiring Sprint — 15 roles","Laura Simmons","People & Culture"," On Track","58%","Jun 2025"],
    ["I23","O31","G15","University Partnership Programme","Laura Simmons","People & Culture"," At Risk","28%","Sep 2025"],
    ["I24","O33","G17","Consultant Certification Pathway Programme","Nina Okafor","Delivery"," On Track","72%","Mar 2025"],
    ["I25","O35","G18","SAP Gold Partner Qualification Initiative","James Harrington","Executive"," At Risk","48%","Mar 2025"],
    ["I26","O37","G19","Oracle Cloud Partner Tier Upgrade Programme","Priya Mehta","Technology"," At Risk","32%","Jun 2025"],
    ["I27","O39","G20","Microsoft Designations Completion Sprint","Priya Mehta","Technology"," At Risk","38%","Dec 2025"],
    ["I28","O41","G22","PSA Platform Implementation (Jiganto Projects)","Claire Donovan","Operations"," On Track","90%","Mar 2025"],
    ["I29","O43","G23","ISO 27001 Certification Programme","Claire Donovan","Operations"," On Track","80%","Jun 2025"],
    ["I30","O45","G24","Finance & Project P&L Reporting Rollout","Michael Torres","Finance"," On Track","82%","Mar 2025"],
  ];

  const iniMap: Record<string, number> = {};
  for (const [key, objKey, goalKey, title, owner, deptName, rawRag, rawProg, date] of initiativesRaw) {
    const [row] = await db.insert(initiatives).values({
      tenantId,
      objectiveId: objMap[objKey],
      goalId: goalMap[goalKey],
      title,
      ownerName: owner,
      departmentId: dept(deptName),
      ragStatus: rag(rawRag),
      status: goalStatus(rawRag),
      progress: pct(rawProg),
      trend: "stable",
      priority: "medium",
      targetDate: date,
    }).returning({ id: initiatives.id });
    iniMap[key] = row.id;
  }

  // ── 6. OKRs ───────────────────────────────────────────────────────────────
  const okrsRaw = [
    ["K01","S1","G01","Win 12+ qualified ERP contracts in FY2025","Objective: Build the most productive ERP sales engine in UK mid-market","Signed contracts = 12","DIR-SALES","Sales & Marketing"," At Risk","33%","Dec 2025"],
    ["K02","S1","G02","Generate £15M qualified pipeline from 3 new verticals","Objective: Diversify revenue base beyond existing sectors","Qualified pipeline created per vertical","CMO","Sales & Marketing"," Behind","15%","Dec 2025"],
    ["K03","S1","G05","Grow ARR from £8M to £14M by Dec 2025","Objective: Achieve market-leading revenue trajectory","Annual Recurring Revenue (ARR)","CFO","Finance"," At Risk","45%","Dec 2025"],
    ["K04","S2","G06","100% of projects delivered on-time & on-budget","Objective: Become the most reliable ERP delivery partner in UK","Project on-time delivery rate","CPO","Professional Services"," On Track","72%","Dec 2025"],
    ["K05","S2","G07","Achieve average NPS of 72 across all client accounts","Objective: Create raving-fan clients who refer and renew","Net Promoter Score (NPS)","DIR-DEL","Delivery"," On Track","65%","Dec 2025"],
    ["K06","S2","G08","All 3 ERP playbooks complete and in active use","Objective: Standardise delivery to reduce risk and cost","Playbooks published and consultant-rated","CPO","Professional Services"," On Track","82%","Jun 2025"],
    ["K07","S3","G10","Launch AI practice with first 3 paying clients","Objective: Lead the ERP market in AI-augmented implementation","Paying AI advisory clients","CTO","Technology"," At Risk","20%","Dec 2025"],
    ["K08","S3","G11","Complete 2 cloud ERP migration projects","Objective: Build cloud migration credentials and case studies","Cloud migration projects completed","DIR-TECH","Technology"," At Risk","25%","Dec 2025"],
    ["K09","S3","G12","Ship 5 proprietary ERP accelerator tools","Objective: Build IP assets that reduce project timelines by 20%","Accelerator tools in production use","DIR-TECH","Technology"," Behind","10%","Dec 2025"],
    ["K10","S4","G14","Hire 25 certified consultants; attrition <10%","Objective: Build the deepest ERP talent pool in UK mid-market","Certified consultant headcount & attrition rate","CHRO","People & Culture"," On Track","60%","Dec 2025"],
    ["K11","S4","G16","Employee engagement score ≥ 90%","Objective: Be a top-quartile employer in the tech sector","Annual engagement survey score","CHRO","People & Culture"," On Track","75%","Dec 2025"],
    ["K12","S4","G17","95% of consultants have active certification in progress","Objective: Make Apex the best place to grow an ERP career","Consultants with active cert path","DIR-DEL","Delivery"," On Track","68%","Dec 2025"],
    ["K13","S5","G18","Achieve SAP Gold Partner by Q4 2025","Objective: Maximise software margin and co-sell with SAP","SAP partner tier achieved","CEO","Executive"," At Risk","45%","Dec 2025"],
    ["K14","S5","G21","Generate £2M software reseller margin","Objective: Build high-margin recurring revenue from software","Annual software reseller margin","CFO","Finance"," Behind","18%","Dec 2026"],
    ["K15","S5","G20","All 6 Microsoft designations achieved","Objective: Unlock full Microsoft co-sell and incentives programme","Microsoft solution area designations","DIR-TECH","Technology"," At Risk","38%","Dec 2025"],
    ["K16","S6","G22","PSA platform live; utilisation tracked weekly","Objective: Run a data-driven, efficiently scaled delivery operation","PSA platform adoption rate","COO","Operations"," On Track","88%","Jun 2025"],
    ["K17","S6","G23","ISO 27001 and Cyber Essentials Plus achieved","Objective: Be a trusted, secure partner for enterprise clients","Certifications achieved","COO","Operations"," On Track","78%","Sep 2025"],
    ["K18","S6","G25","Non-billable overhead reduced to <15%","Objective: Maximise revenue-generating capacity of every consultant","Non-billable overhead as % of capacity","COO","Operations"," At Risk","52%","Dec 2025"],
  ];

  const okrMap: Record<string, number> = {};
  for (const [key, , goalKey, title, description, , , deptName, rawRag, rawProg, date] of okrsRaw) {
    const [row] = await db.insert(okrs).values({
      tenantId,
      objectiveId: goalFirstObjMap[goalKey] ?? null,
      title,
      description,
      departmentId: dept(deptName),
      ragStatus: rag(rawRag),
      status: goalStatus(rawRag),
      progress: pct(rawProg),
      trend: "stable",
      targetDate: date,
    }).returning({ id: okrs.id });
    okrMap[key] = row.id;
  }

  // ── 7. KPIs ────────────────────────────────────────────────────────────────
  const kpisRaw = [
    ["P01","S1","G01","Win Rate (%)","% of qualified opportunities won","Sales & Marketing","35%","45%"," At Risk","Monthly"],
    ["P02","S1","G01","Qualified Pipeline Value (£)","Total value of CRM-tracked qualified pipeline","Sales & Marketing","£4.2M","£8M"," At Risk","Monthly"],
    ["P03","S1","G05","Annual Revenue (£)","Total recognised revenue per annum","Finance","£8.1M","£14M"," At Risk","Monthly"],
    ["P04","S1","G03","Managed Services ARR (£)","Recurring revenue from managed ERP contracts","Professional Services","£0.4M","£2M"," Behind","Monthly"],
    ["P05","S1","G02","New Logos Won","Net new client organisations signed in year","Sales & Marketing","3","12"," Behind","Monthly"],
    ["P06","S2","G06","On-Time Delivery Rate (%)","% of milestones/projects delivered on schedule","Professional Services","88%","100%"," At Risk","Monthly"],
    ["P07","S2","G06","On-Budget Delivery Rate (%)","% of projects closed within approved budget","Professional Services","91%","100%"," On Track","Monthly"],
    ["P08","S2","G07","Net Promoter Score (NPS)","Client NPS measured post go-live","Delivery","58","72+"," At Risk","Quarterly"],
    ["P09","S2","G07","Client CSAT Score","Average post-project satisfaction rating (1–5)","Delivery","4.2","4.7+"," On Track","Per project"],
    ["P10","S2","G09","Client Renewal Rate (%)","% of clients renewing or expanding in year 2+","Professional Services","72%","90%"," At Risk","Annually"],
    ["P11","S3","G10","AI Advisory Revenue (£)","Revenue from AI practice services","Technology","£0","£500K"," Behind","Monthly"],
    ["P12","S3","G13","Total Certifications Held","Number of active technology certifications across team","Technology","42","80"," At Risk","Quarterly"],
    ["P13","S3","G12","Accelerator Tools in Production","Number of proprietary tools actively used on projects","Technology","1","5"," Behind","Quarterly"],
    ["P14","S3","G11","Cloud Projects Delivered","ERP cloud migration/implementation projects completed","Technology","0","2"," At Risk","Quarterly"],
    ["P15","S4","G14","Total Certified Consultants","Headcount of ERP-certified billable consultants","People & Culture","45","70"," On Track","Monthly"],
    ["P16","S4","G16","Employee Engagement Score (%)","Annual engagement survey result","People & Culture","82%","90%+"," On Track","Annually"],
    ["P17","S4","G14","Voluntary Attrition Rate (%)","% of consultants leaving voluntarily per annum","People & Culture","14%","<10%"," At Risk","Monthly"],
    ["P18","S4","G17","Consultants with Active Cert (%)","% with a live certification in progress","Delivery","68%","95%"," At Risk","Quarterly"],
    ["P19","S5","G18","SAP Partner Tier","Current SAP partner status","Executive","Silver","Gold"," At Risk","Quarterly"],
    ["P20","S5","G21","Software Margin Revenue (£)","Annual software reseller margin earned","Finance","£320K","£2M"," Behind","Monthly"],
    ["P21","S5","G20","Microsoft Designations","Number of MS solution area designations held","Technology","2","6"," At Risk","Quarterly"],
    ["P22","S6","G22","Consultant Utilisation Rate (%)","Billable hours as % of available capacity","Operations","74%","82%"," At Risk","Weekly"],
    ["P23","S6","G25","Non-Billable Overhead (%)","Non-revenue time as % of total capacity","Operations","22%","<15%"," At Risk","Monthly"],
    ["P24","S6","G24","Gross Margin (%)","Revenue minus direct delivery costs","Finance","31%","42%"," At Risk","Monthly"],
    ["P25","S6","G23","ISO 27001 Status","Certification status","Operations","In progress","Certified"," On Track","Milestone"],
    ["P26","S6","G24","Revenue per Consultant (£)","Annual revenue / total consultant headcount","Finance","£178K","£210K"," At Risk","Monthly"],
  ];

  for (const [, , goalKey, name, desc, deptName, currentValue, targetValue, rawRag] of kpisRaw) {
    await db.insert(kpis).values({
      tenantId,
      goalId: goalMap[goalKey] ?? null,
      name,
      description: `${desc} | Current: ${currentValue} | Target: ${targetValue}`,
      departmentId: dept(deptName),
      ragStatus: rag(rawRag),
      status: goalStatus(rawRag),
      currentValue: numericOrNull(currentValue) as any,
      targetValue: numericOrNull(targetValue) as any,
      progress: pct(rawRag.includes("On Track") ? "100" : rawRag.includes("Behind") ? "15" : "50"),
      trend: "stable",
    });
  }

  return {
    message: "Apex Solutions Group data loaded successfully",
    counts: {
      departments: deptNames.length,
      strategies: strategyData.length,
      goals: goalsRaw.length,
      objectives: objectivesRaw.length,
      initiatives: initiativesRaw.length,
      okrs: okrsRaw.length,
      kpis: kpisRaw.length,
    },
  };
}

export async function clearApexBusinessData(tenantId: number) {
  await db.delete(businessTasks).where(eq(businessTasks.tenantId, tenantId));
  await db.delete(meetings).where(eq(meetings.tenantId, tenantId));
  await db.delete(kpis).where(eq(kpis.tenantId, tenantId));
  await db.delete(okrs).where(eq(okrs.tenantId, tenantId));
  await db.delete(keyResults).where(eq(keyResults.tenantId, tenantId));
  await db.delete(initiatives).where(eq(initiatives.tenantId, tenantId));
  await db.delete(objectives).where(eq(objectives.tenantId, tenantId));
  await db.delete(goals).where(eq(goals.tenantId, tenantId));
  await db.delete(risks).where(eq(risks.tenantId, tenantId));
  await db.delete(strategyItems).where(eq(strategyItems.tenantId, tenantId));
  await db.delete(documentLinks).where(eq(documentLinks.tenantId, tenantId));
  await db.delete(tools).where(eq(tools.tenantId, tenantId));
  await db.delete(processes).where(eq(processes.tenantId, tenantId));
  await db.delete(departments).where(eq(departments.tenantId, tenantId));
  return { message: "Apex Solutions Group data cleared successfully" };
}
