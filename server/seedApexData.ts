import { db } from "./db";
import {
  strategyItems, goals, objectives, initiatives,
  okrs, kpis, businessTasks, departments, keyResults, meetings, risks,
} from "../shared/models/business";
import { pmProjects } from "../shared/models/projects";
import { eq, isNotNull } from "drizzle-orm";

const TENANT_ID = 1;

function rag(s: string): "green" | "amber" | "red" {
  const v = (s || "").trim().toLowerCase();
  if (v === "on track") return "green";
  if (v === "at risk") return "amber";
  return "red";
}

function st(r: "green" | "amber" | "red"): string {
  return r === "green" ? "on_track" : r === "red" ? "off_track" : "at_risk";
}

export async function seedApexData(): Promise<{ message: string; counts: Record<string, number> }> {
  // Clear existing data — handle FK constraints from other modules first
  // 1. Null out initiative references in meetings and pm_projects (don't delete those records)
  await db.update(meetings).set({ initiativeId: null }).where(isNotNull(meetings.initiativeId));
  await db.update(pmProjects).set({ initiativeId: null }).where(isNotNull(pmProjects.initiativeId));
  // 2. Null out strategy references in risks
  await db.update(risks).set({ strategyItemId: null }).where(isNotNull(risks.strategyItemId));
  // 3. Delete strategy data in correct reverse FK order
  await db.delete(businessTasks).where(eq(businessTasks.tenantId, TENANT_ID));
  await db.delete(keyResults).where(eq(keyResults.tenantId, TENANT_ID));
  await db.delete(kpis).where(eq(kpis.tenantId, TENANT_ID));
  await db.delete(okrs).where(eq(okrs.tenantId, TENANT_ID));
  await db.delete(initiatives).where(eq(initiatives.tenantId, TENANT_ID));
  await db.delete(objectives).where(eq(objectives.tenantId, TENANT_ID));
  await db.delete(goals).where(eq(goals.tenantId, TENANT_ID));
  await db.delete(strategyItems).where(eq(strategyItems.tenantId, TENANT_ID));
  // Note: departments are NOT deleted — we upsert by name to preserve FK refs from other modules

  // --- Departments — upsert by name ---
  const DEPT_NAMES = [
    "Sales & Marketing", "Professional Services", "Technology",
    "People & Culture", "Executive", "Operations", "Finance", "Delivery",
  ];
  // Get existing departments for this tenant
  const existingDepts = await db.select({ id: departments.id, name: departments.name })
    .from(departments).where(eq(departments.tenantId, TENANT_ID));
  const deptMap = new Map<string, number>(existingDepts.map(d => [d.name, d.id]));
  // Create any missing departments
  const missingDeptNames = DEPT_NAMES.filter(n => !deptMap.has(n));
  if (missingDeptNames.length > 0) {
    const newDepts = await db.insert(departments)
      .values(missingDeptNames.map(name => ({ tenantId: TENANT_ID, name })))
      .returning({ id: departments.id, name: departments.name });
    newDepts.forEach(d => deptMap.set(d.name, d.id));
  }
  const dId = (n: string) => deptMap.get(n.trim()) ?? null;

  // --- Strategies (6) ---
  // [code, title, description, ownerName, dept, rag, progress, targetDate]
  const S_DATA: [string, string, string, string, string, string, number, string][] = [
    ["S1","Market Leadership & Revenue Growth","Become the #1 mid-market ERP implementation partner in the UK & Ireland, growing revenue from £8M to £25M by 2027.","Sarah Blackwell","Sales & Marketing","At Risk",55,"Dec 2027"],
    ["S2","Delivery Excellence & Client Satisfaction","Achieve industry-leading project delivery quality with >95% on-time/on-budget rate and NPS >70 across all implementations.","Ayesha Nawaz","Professional Services","On Track",68,"Dec 2026"],
    ["S3","Technology Practice & AI Enablement","Build a cutting-edge technology practice leveraging AI, automation and cloud to differentiate our ERP offerings.","Ravi Patel","Technology","At Risk",42,"Jun 2027"],
    ["S4","People, Talent & Capacity Building","Attract, develop and retain top ERP consulting talent to scale headcount from 45 to 120 certified consultants by 2027.","Laura Simmons","People & Culture","On Track",58,"Dec 2027"],
    ["S5","Partner Ecosystem & Alliance Strategy","Achieve Gold/Platinum partner status with SAP, Oracle and Microsoft and build a profitable reseller revenue stream.","James Harrington","Executive","At Risk",38,"Dec 2026"],
    ["S6","Operational Efficiency & Scalability","Build scalable operations, repeatable delivery frameworks and financial controls to support 3x revenue growth profitably.","Claire Donovan","Operations","On Track",72,"Jun 2026"],
  ];
  const sRows = await db.insert(strategyItems).values(
    S_DATA.map(([,title,description,ownerName,dept,ragStr,progress,targetDate]) => {
      const r = rag(ragStr); return {
        tenantId: TENANT_ID, templateType: "strategy", title, description,
        ownerName, departmentId: dId(dept), ragStatus: r, status: st(r), progress, targetDate,
      };
    })
  ).returning({ id: strategyItems.id });
  const sMap = new Map(S_DATA.map(([code], i) => [code, sRows[i].id]));
  const sId = (c: string) => sMap.get(c) ?? null;

  // --- Goals (26) ---
  // [code, stratCode, title, ownerName, dept, rag, progress, targetDate]
  const G_DATA: [string, string, string, string, string, string, number, string][] = [
    ["G01","S1","Win 12 new ERP implementation contracts per year","Daniel Webb","Sales & Marketing","At Risk",40,"Dec 2025"],
    ["G02","S1","Expand into 3 new industry verticals (Manufacturing, Healthcare, Public Sector)","Sarah Blackwell","Sales & Marketing","At Risk",25,"Jun 2026"],
    ["G03","S1","Build a £5M managed services recurring revenue stream","Ayesha Nawaz","Professional Services","Behind",15,"Dec 2026"],
    ["G04","S1","Establish a pre-sales & solution architecture capability","Sarah Blackwell","Sales & Marketing","On Track",60,"Jun 2025"],
    ["G05","S1","Achieve £25M annual revenue by 2027","Michael Torres","Finance","At Risk",35,"Dec 2027"],
    ["G06","S2","Deliver 100% of projects on-time and within budget","Ayesha Nawaz","Professional Services","On Track",72,"Dec 2025"],
    ["G07","S2","Achieve NPS score of 70+ across all client accounts","Nina Okafor","Delivery","On Track",65,"Dec 2025"],
    ["G08","S2","Build standardised delivery playbooks for SAP, Oracle & D365","Ayesha Nawaz","Professional Services","On Track",80,"Jun 2025"],
    ["G09","S2","Launch a client success & account management function","Nina Okafor","Delivery","At Risk",45,"Sep 2025"],
    ["G10","S3","Launch an AI & Automation advisory service line","Ravi Patel","Technology","At Risk",30,"Dec 2025"],
    ["G11","S3","Build a cloud migration & integration practice","Priya Mehta","Technology","At Risk",38,"Jun 2026"],
    ["G12","S3","Develop proprietary accelerators and IP assets","Ravi Patel","Technology","Behind",20,"Dec 2026"],
    ["G13","S3","Achieve 5 new technology certifications across the practice","Priya Mehta","Technology","On Track",55,"Dec 2025"],
    ["G14","S4","Recruit 25 certified ERP consultants in FY2025","Laura Simmons","People & Culture","On Track",60,"Dec 2025"],
    ["G15","S4","Launch a graduate & apprenticeship programme","Laura Simmons","People & Culture","At Risk",35,"Sep 2025"],
    ["G16","S4","Achieve 90%+ employee engagement score","Laura Simmons","People & Culture","On Track",75,"Dec 2025"],
    ["G17","S4","Build a structured learning & certification pathway","Nina Okafor","Delivery","On Track",68,"Jun 2025"],
    ["G18","S5","Achieve SAP Gold Partner status","James Harrington","Executive","At Risk",45,"Dec 2025"],
    ["G19","S5","Achieve Oracle Cloud Partner (Expertise level)","Ravi Patel","Technology","At Risk",40,"Jun 2026"],
    ["G20","S5","Achieve Microsoft Solutions Partner (6 designations)","Priya Mehta","Technology","At Risk",35,"Dec 2025"],
    ["G21","S5","Generate £2M software reseller margin annually","Michael Torres","Finance","Behind",18,"Dec 2026"],
    ["G22","S6","Implement a PSA (Professional Services Automation) platform","Claire Donovan","Operations","On Track",85,"Jun 2025"],
    ["G23","S6","Achieve ISO 27001 and Cyber Essentials Plus certification","Claire Donovan","Operations","On Track",78,"Sep 2025"],
    ["G24","S6","Build a financial reporting and project P&L framework","Michael Torres","Finance","On Track",80,"Jun 2025"],
    ["G25","S6","Reduce non-billable overhead to <15% of total capacity","Claire Donovan","Operations","At Risk",50,"Dec 2025"],
    ["G26","S6","Launch a quality assurance & delivery review process","Ayesha Nawaz","Professional Services","On Track",70,"Mar 2025"],
  ];
  const gRows = await db.insert(goals).values(
    G_DATA.map(([,stratCode,title,ownerName,dept,ragStr,progress,targetDate]) => {
      const r = rag(ragStr); return {
        tenantId: TENANT_ID, strategyItemId: sId(stratCode), title,
        ownerName, departmentId: dId(dept), ragStatus: r, status: st(r), progress, targetDate,
      };
    })
  ).returning({ id: goals.id });
  const gMap = new Map(G_DATA.map(([code], i) => [code, gRows[i].id]));
  const gId = (c: string) => gMap.get(c) ?? null;

  // --- Objectives (46) ---
  // [code, goalCode, _stratCode, title, ownerName, dept, rag, progress, targetDate]
  const O_DATA: [string, string, string, string, string, string, string, number, string][] = [
    ["O01","G01","S1","Build a target account list of 100 qualified ERP prospects","Daniel Webb","Sales & Marketing","At Risk",45,"Mar 2025"],
    ["O02","G01","S1","Establish a structured sales process with CRM-tracked pipeline","Sarah Blackwell","Sales & Marketing","At Risk",50,"Jun 2025"],
    ["O03","G01","S1","Hire 3 additional business development managers","Sarah Blackwell","Sales & Marketing","Behind",20,"Jun 2025"],
    ["O04","G02","S1","Complete manufacturing sector GTM analysis and proposition","Tom Griffiths","Sales & Marketing","At Risk",30,"Jun 2025"],
    ["O05","G02","S1","Win first lighthouse client in Healthcare sector","Daniel Webb","Sales & Marketing","Behind",10,"Dec 2025"],
    ["O06","G02","S1","Develop Public Sector procurement & framework strategy","Sarah Blackwell","Sales & Marketing","At Risk",25,"Sep 2025"],
    ["O07","G03","S1","Define managed services offering and pricing tiers","Ayesha Nawaz","Professional Services","Behind",15,"Jun 2025"],
    ["O08","G03","S1","Sign first 3 managed services contracts","Daniel Webb","Sales & Marketing","Behind",5,"Dec 2025"],
    ["O09","G04","S1","Hire 2 senior pre-sales solution architects","Sarah Blackwell","Sales & Marketing","On Track",70,"Mar 2025"],
    ["O10","G04","S1","Build a demo environment and standard RFP response library","Priya Mehta","Technology","On Track",65,"Jun 2025"],
    ["O11","G06","S2","Implement a project health dashboard for all active engagements","Claire Donovan","Operations","On Track",80,"Mar 2025"],
    ["O12","G06","S2","Deploy risk & issue escalation framework on all projects","Ayesha Nawaz","Professional Services","On Track",85,"Feb 2025"],
    ["O13","G06","S2","Conduct monthly project steering reviews with all clients","Nina Okafor","Delivery","On Track",75,"Ongoing"],
    ["O14","G07","S2","Roll out post-go-live CSAT surveys to all clients","Nina Okafor","Delivery","On Track",70,"Mar 2025"],
    ["O15","G07","S2","Introduce NPS measurement at project milestones","Ayesha Nawaz","Professional Services","At Risk",55,"Jun 2025"],
    ["O16","G08","S2","Complete SAP S/4HANA implementation playbook v1.0","Ayesha Nawaz","Professional Services","On Track",90,"Mar 2025"],
    ["O17","G08","S2","Complete Oracle Fusion implementation playbook v1.0","Nina Okafor","Delivery","On Track",80,"Apr 2025"],
    ["O18","G08","S2","Complete Microsoft D365 F&O playbook v1.0","Nina Okafor","Delivery","On Track",75,"May 2025"],
    ["O19","G09","S2","Define client success roles, KPIs and engagement model","Ayesha Nawaz","Professional Services","At Risk",40,"Jun 2025"],
    ["O20","G09","S2","Assign dedicated account managers to top 10 clients","Nina Okafor","Delivery","At Risk",50,"Jun 2025"],
    ["O21","G10","S3","Launch AI readiness assessment service for ERP clients","Ravi Patel","Technology","At Risk",35,"Jun 2025"],
    ["O22","G10","S3","Develop 3 AI-powered ERP accelerators (AP automation, forecasting, HR bot)","Priya Mehta","Technology","Behind",20,"Dec 2025"],
    ["O23","G10","S3","Achieve 5 AI/ML certifications across technology team","Priya Mehta","Technology","At Risk",40,"Sep 2025"],
    ["O24","G11","S3","Build Azure integration competency (Logic Apps, API Management)","Priya Mehta","Technology","At Risk",45,"Jun 2025"],
    ["O25","G11","S3","Complete first cloud ERP migration project","Ravi Patel","Technology","At Risk",30,"Sep 2025"],
    ["O26","G12","S3","Develop rapid deployment template for SAP Business One","Priya Mehta","Technology","Behind",15,"Dec 2025"],
    ["O27","G12","S3","Create pre-built data migration toolkit for legacy ERPs","Priya Mehta","Technology","Behind",10,"Dec 2025"],
    ["O28","G14","S4","Establish a talent acquisition process and employer brand","Laura Simmons","People & Culture","On Track",65,"Mar 2025"],
    ["O29","G14","S4","Engage 3 specialist ERP recruitment agencies","Laura Simmons","People & Culture","On Track",80,"Feb 2025"],
    ["O30","G14","S4","Onboard 15 SAP-certified consultants by Jun 2025","Laura Simmons","People & Culture","On Track",60,"Jun 2025"],
    ["O31","G15","S4","Partner with 2 universities for ERP graduate pipeline","Laura Simmons","People & Culture","At Risk",30,"Sep 2025"],
    ["O32","G15","S4","Launch first cohort of 6 ERP apprentices","Laura Simmons","People & Culture","At Risk",25,"Sep 2025"],
    ["O33","G17","S4","Map SAP, Oracle and D365 certification pathways by role","Nina Okafor","Delivery","On Track",75,"Mar 2025"],
    ["O34","G17","S4","Fund 100% of consultant certification costs","Michael Torres","Finance","On Track",70,"Ongoing"],
    ["O35","G18","S5","Complete SAP Partner Business Plan submission","James Harrington","Executive","At Risk",50,"Mar 2025"],
    ["O36","G18","S5","Achieve required SAP certified consultant headcount (12)","Laura Simmons","People & Culture","At Risk",42,"Dec 2025"],
    ["O37","G19","S5","Pass Oracle Cloud expertise validation assessments","Priya Mehta","Technology","At Risk",35,"Jun 2025"],
    ["O38","G19","S5","Submit Oracle partner tier upgrade application","James Harrington","Executive","At Risk",30,"Sep 2025"],
    ["O39","G20","S5","Complete 6 Microsoft solution area designations","Priya Mehta","Technology","At Risk",40,"Dec 2025"],
    ["O40","G20","S5","Pass Microsoft partner competency audits","James Harrington","Executive","At Risk",35,"Dec 2025"],
    ["O41","G22","S6","Select and implement PSA platform (Rocketlane / Certinia)","Claire Donovan","Operations","On Track",90,"Mar 2025"],
    ["O42","G22","S6","Migrate all active projects to PSA resource scheduling","Claire Donovan","Operations","On Track",75,"Jun 2025"],
    ["O43","G23","S6","Complete ISO 27001 gap assessment and remediation","Claire Donovan","Operations","On Track",80,"Jun 2025"],
    ["O44","G23","S6","Achieve Cyber Essentials Plus certification","Claire Donovan","Operations","On Track",85,"Mar 2025"],
    ["O45","G24","S6","Implement project-level P&L reporting in Finance","Michael Torres","Finance","On Track",82,"Mar 2025"],
    ["O46","G24","S6","Build monthly management accounts pack with utilisation metrics","Callum Reid","Finance","On Track",78,"Feb 2025"],
  ];
  const oRows = await db.insert(objectives).values(
    O_DATA.map(([,goalCode,,title,ownerName,dept,ragStr,progress,targetDate]) => {
      const r = rag(ragStr); return {
        tenantId: TENANT_ID, goalId: gId(goalCode), title,
        ownerName, departmentId: dId(dept), ragStatus: r, status: st(r), progress, targetDate,
      };
    })
  ).returning({ id: objectives.id });
  const oMap = new Map(O_DATA.map(([code], i) => [code, oRows[i].id]));
  const oId = (c: string) => oMap.get(c) ?? null;

  // --- Initiatives (30) ---
  // [code, objCode, goalCode, _stratCode, title, ownerName, dept, rag, progress, targetDate]
  const I_DATA: [string, string, string, string, string, string, string, string, number, string][] = [
    ["I01","O01","G01","S1","Sales Pipeline Development Programme","Daniel Webb","Sales & Marketing","At Risk",40,"Jun 2025"],
    ["I02","O02","G01","S1","CRM Implementation & Sales Process Redesign (Jiganto CRM)","Sarah Blackwell","Sales & Marketing","At Risk",55,"Apr 2025"],
    ["I03","O03","G01","S1","BDM Recruitment Campaign — 3 hires Q1/Q2 2025","Laura Simmons","People & Culture","Behind",20,"Jun 2025"],
    ["I04","O04","G02","S1","Manufacturing ERP Market Entry Programme","Tom Griffiths","Sales & Marketing","At Risk",28,"Sep 2025"],
    ["I05","O05","G02","S1","Healthcare Sector Lighthouse Campaign","Daniel Webb","Sales & Marketing","Behind",10,"Dec 2025"],
    ["I06","O07","G03","S1","Managed Services Product Design & Packaging","Ayesha Nawaz","Professional Services","Behind",12,"Jun 2025"],
    ["I07","O09","G04","S1","Pre-Sales Architecture Team Build-Out","Sarah Blackwell","Sales & Marketing","On Track",70,"Mar 2025"],
    ["I08","O10","G04","S1","Demo Lab & Proposal Automation Platform","Priya Mehta","Technology","On Track",60,"Jun 2025"],
    ["I09","O11","G06","S2","Jiganto Project Health Dashboard Rollout","Claire Donovan","Operations","On Track",85,"Mar 2025"],
    ["I10","O12","G06","S2","Risk & Issue Framework Implementation","Ayesha Nawaz","Professional Services","On Track",88,"Feb 2025"],
    ["I11","O14","G07","S2","Client CSAT & NPS Programme","Nina Okafor","Delivery","On Track",70,"Mar 2025"],
    ["I12","O16","G08","S2","SAP S/4HANA Delivery Playbook Project","Ayesha Nawaz","Professional Services","On Track",92,"Mar 2025"],
    ["I13","O17","G08","S2","Oracle Fusion Delivery Playbook Project","Nina Okafor","Delivery","On Track",80,"Apr 2025"],
    ["I14","O18","G08","S2","Microsoft D365 Delivery Playbook Project","Nina Okafor","Delivery","On Track",75,"May 2025"],
    ["I15","O19","G09","S2","Client Success Function Launch","Ayesha Nawaz","Professional Services","At Risk",38,"Sep 2025"],
    ["I16","O21","G10","S3","AI Readiness Assessment Product Launch","Ravi Patel","Technology","At Risk",32,"Jun 2025"],
    ["I17","O22","G10","S3","ERP AI Accelerator Development Programme","Priya Mehta","Technology","Behind",18,"Dec 2025"],
    ["I18","O24","G11","S3","Azure Integration Competency Build","Priya Mehta","Technology","At Risk",42,"Jun 2025"],
    ["I19","O26","G12","S3","SAP Business One Rapid Deploy Template","Priya Mehta","Technology","Behind",12,"Dec 2025"],
    ["I20","O28","G14","S4","Employer Branding & Talent Attraction Campaign","Laura Simmons","People & Culture","On Track",62,"Mar 2025"],
    ["I21","O29","G14","S4","Recruitment Agency Partnership Programme","Laura Simmons","People & Culture","On Track",82,"Feb 2025"],
    ["I22","O30","G14","S4","SAP Consultant Hiring Sprint — 15 roles","Laura Simmons","People & Culture","On Track",58,"Jun 2025"],
    ["I23","O31","G15","S4","University Partnership Programme","Laura Simmons","People & Culture","At Risk",28,"Sep 2025"],
    ["I24","O33","G17","S4","Consultant Certification Pathway Programme","Nina Okafor","Delivery","On Track",72,"Mar 2025"],
    ["I25","O35","G18","S5","SAP Gold Partner Qualification Initiative","James Harrington","Executive","At Risk",48,"Mar 2025"],
    ["I26","O37","G19","S5","Oracle Cloud Partner Tier Upgrade Programme","Priya Mehta","Technology","At Risk",32,"Jun 2025"],
    ["I27","O39","G20","S5","Microsoft Designations Completion Sprint","Priya Mehta","Technology","At Risk",38,"Dec 2025"],
    ["I28","O41","G22","S6","PSA Platform Implementation (Jiganto Projects)","Claire Donovan","Operations","On Track",90,"Mar 2025"],
    ["I29","O43","G23","S6","ISO 27001 Certification Programme","Claire Donovan","Operations","On Track",80,"Jun 2025"],
    ["I30","O45","G24","S6","Finance & Project P&L Reporting Rollout","Michael Torres","Finance","On Track",82,"Mar 2025"],
  ];
  const iRows = await db.insert(initiatives).values(
    I_DATA.map(([,objCode,goalCode,,title,ownerName,dept,ragStr,progress,targetDate]) => {
      const r = rag(ragStr); return {
        tenantId: TENANT_ID, objectiveId: oId(objCode), goalId: gId(goalCode), title,
        ownerName, departmentId: dId(dept), ragStatus: r, status: st(r), progress, targetDate,
      };
    })
  ).returning({ id: initiatives.id });
  const iMap = new Map(I_DATA.map(([code], i) => [code, iRows[i].id]));

  // --- OKRs (18) — linked via objectiveId to first objective of their goal ---
  // [code, _stratCode, _goalCode, objCode|null, title, description, ownerName, dept, rag, progress, targetDate]
  const K_DATA: [string, string, string, string|null, string, string, string, string, string, number, string][] = [
    ["K01","S1","G01","O01","Win 12+ qualified ERP contracts in FY2025","Build the most productive ERP sales engine in UK mid-market","Daniel Webb","Sales & Marketing","At Risk",33,"Dec 2025"],
    ["K02","S1","G02","O04","Generate £15M qualified pipeline from 3 new verticals","Diversify revenue base beyond existing sectors","Tom Griffiths","Sales & Marketing","Behind",15,"Dec 2025"],
    ["K03","S1","G05",null,"Grow ARR from £8M to £14M by Dec 2025","Achieve market-leading revenue trajectory","Michael Torres","Finance","At Risk",45,"Dec 2025"],
    ["K04","S2","G06","O11","100% of projects delivered on-time & on-budget","Become the most reliable ERP delivery partner in UK","Ayesha Nawaz","Professional Services","On Track",72,"Dec 2025"],
    ["K05","S2","G07","O14","Achieve average NPS of 72 across all client accounts","Create raving-fan clients who refer and renew","Nina Okafor","Delivery","On Track",65,"Dec 2025"],
    ["K06","S2","G08","O16","All 3 ERP playbooks complete and in active use","Standardise delivery to reduce risk and cost","Ayesha Nawaz","Professional Services","On Track",82,"Jun 2025"],
    ["K07","S3","G10","O21","Launch AI practice with first 3 paying clients","Lead the ERP market in AI-augmented implementation","Ravi Patel","Technology","At Risk",20,"Dec 2025"],
    ["K08","S3","G11","O24","Complete 2 cloud ERP migration projects","Build cloud migration credentials and case studies","Priya Mehta","Technology","At Risk",25,"Dec 2025"],
    ["K09","S3","G12","O26","Ship 5 proprietary ERP accelerator tools","Build IP assets that reduce project timelines by 20%","Priya Mehta","Technology","Behind",10,"Dec 2025"],
    ["K10","S4","G14","O28","Hire 25 certified consultants; attrition <10%","Build the deepest ERP talent pool in UK mid-market","Laura Simmons","People & Culture","On Track",60,"Dec 2025"],
    ["K11","S4","G16",null,"Employee engagement score ≥ 90%","Be a top-quartile employer in the tech sector","Laura Simmons","People & Culture","On Track",75,"Dec 2025"],
    ["K12","S4","G17","O33","95% of consultants have active certification in progress","Make Apex the best place to grow an ERP career","Nina Okafor","Delivery","On Track",68,"Dec 2025"],
    ["K13","S5","G18","O35","Achieve SAP Gold Partner by Q4 2025","Maximise software margin and co-sell with SAP","James Harrington","Executive","At Risk",45,"Dec 2025"],
    ["K14","S5","G21",null,"Generate £2M software reseller margin","Build high-margin recurring revenue from software","Michael Torres","Finance","Behind",18,"Dec 2026"],
    ["K15","S5","G20","O39","All 6 Microsoft designations achieved","Unlock full Microsoft co-sell and incentives programme","Priya Mehta","Technology","At Risk",38,"Dec 2025"],
    ["K16","S6","G22","O41","PSA platform live; utilisation tracked weekly","Run a data-driven, efficiently scaled delivery operation","Claire Donovan","Operations","On Track",88,"Jun 2025"],
    ["K17","S6","G23","O43","ISO 27001 and Cyber Essentials Plus achieved","Be a trusted, secure partner for enterprise clients","Claire Donovan","Operations","On Track",78,"Sep 2025"],
    ["K18","S6","G25",null,"Non-billable overhead reduced to <15%","Maximise revenue-generating capacity of every consultant","Claire Donovan","Operations","At Risk",52,"Dec 2025"],
  ];
  await db.insert(okrs).values(
    K_DATA.map(([,,,objCode,title,description,ownerName,dept,ragStr,progress,targetDate]) => {
      const r = rag(ragStr); return {
        tenantId: TENANT_ID, objectiveId: objCode ? oId(objCode) : null,
        title, description, ownerName, departmentId: dId(dept),
        ragStatus: r, status: st(r), progress, targetDate,
      };
    })
  );

  // --- KPIs (26) — linked via goalId ---
  // [code, _stratCode, goalCode, name, description, ownerName, dept, currentVal, targetVal, rag]
  const P_DATA: [string, string, string, string, string, string, string, string, string, string][] = [
    ["P01","S1","G01","Win Rate (%)","% of qualified opportunities won","Daniel Webb","Sales & Marketing","35%","45%","At Risk"],
    ["P02","S1","G01","Qualified Pipeline Value (£)","Total value of CRM-tracked qualified pipeline","Sarah Blackwell","Sales & Marketing","£4.2M","£8M","At Risk"],
    ["P03","S1","G05","Annual Revenue (£)","Total recognised revenue per annum","Michael Torres","Finance","£8.1M","£14M","At Risk"],
    ["P04","S1","G03","Managed Services ARR (£)","Recurring revenue from managed ERP contracts","Ayesha Nawaz","Professional Services","£0.4M","£2M","Behind"],
    ["P05","S1","G02","New Logos Won","Net new client organisations signed in year","Daniel Webb","Sales & Marketing","3","12","Behind"],
    ["P06","S2","G06","On-Time Delivery Rate (%)","% of milestones/projects delivered on schedule","Ayesha Nawaz","Professional Services","88%","100%","At Risk"],
    ["P07","S2","G06","On-Budget Delivery Rate (%)","% of projects closed within approved budget","Ayesha Nawaz","Professional Services","91%","100%","On Track"],
    ["P08","S2","G07","Net Promoter Score (NPS)","Client NPS measured post go-live","Nina Okafor","Delivery","58","72+","At Risk"],
    ["P09","S2","G07","Client CSAT Score","Average post-project satisfaction rating (1-5)","Nina Okafor","Delivery","4.2","4.7+","On Track"],
    ["P10","S2","G09","Client Renewal Rate (%)","% of clients renewing or expanding in year 2+","Ayesha Nawaz","Professional Services","72%","90%","At Risk"],
    ["P11","S3","G10","AI Advisory Revenue (£)","Revenue from AI practice services","Ravi Patel","Technology","£0","£500K","Behind"],
    ["P12","S3","G13","Total Certifications Held","Number of active technology certifications across team","Priya Mehta","Technology","42","80","At Risk"],
    ["P13","S3","G12","Accelerator Tools in Production","Number of proprietary tools actively used on projects","Priya Mehta","Technology","1","5","Behind"],
    ["P14","S3","G11","Cloud Projects Delivered","ERP cloud migration/implementation projects completed","Priya Mehta","Technology","0","2","At Risk"],
    ["P15","S4","G14","Total Certified Consultants","Headcount of ERP-certified billable consultants","Laura Simmons","People & Culture","45","70","On Track"],
    ["P16","S4","G16","Employee Engagement Score (%)","Annual engagement survey result","Laura Simmons","People & Culture","82%","90%+","On Track"],
    ["P17","S4","G14","Voluntary Attrition Rate (%)","% of consultants leaving voluntarily per annum","Laura Simmons","People & Culture","14%","<10%","At Risk"],
    ["P18","S4","G17","Consultants with Active Cert (%)","% with a live certification in progress","Nina Okafor","Delivery","68%","95%","At Risk"],
    ["P19","S5","G18","SAP Partner Tier","Current SAP partner status","James Harrington","Executive","Silver","Gold","At Risk"],
    ["P20","S5","G21","Software Margin Revenue (£)","Annual software reseller margin earned","Michael Torres","Finance","£320K","£2M","Behind"],
    ["P21","S5","G20","Microsoft Designations","Number of MS solution area designations held","Priya Mehta","Technology","2","6","At Risk"],
    ["P22","S6","G22","Consultant Utilisation Rate (%)","Billable hours as % of available capacity","Claire Donovan","Operations","74%","82%","At Risk"],
    ["P23","S6","G25","Non-Billable Overhead (%)","Non-revenue time as % of total capacity","Claire Donovan","Operations","22%","<15%","At Risk"],
    ["P24","S6","G24","Gross Margin (%)","Revenue minus direct delivery costs","Michael Torres","Finance","31%","42%","At Risk"],
    ["P25","S6","G23","ISO 27001 Status","Certification status","Claire Donovan","Operations","In progress","Certified","On Track"],
    ["P26","S6","G24","Revenue per Consultant (£)","Annual revenue / total consultant headcount","Michael Torres","Finance","£178K","£210K","At Risk"],
  ];
  await db.insert(kpis).values(
    P_DATA.map(([,,goalCode,name,description,ownerName,dept,,,ragStr]) => {
      const r = rag(ragStr); return {
        tenantId: TENANT_ID, goalId: gId(goalCode), name, description,
        ownerName, departmentId: dId(dept),
        ragStatus: r, status: st(r),
      };
    })
  );

  // --- Execution / Business Tasks (40) ---
  // [code, iniCode, _stratCode, title, ownerName, dept, rag, progress, targetDate, itemType]
  const E_DATA: [string, string, string, string, string, string, string, number, string, string][] = [
    ["E01","I02","S1","Configure Jiganto CRM for opportunity tracking","Claire Donovan","Operations","On Track",90,"Mar 2025","Task"],
    ["E02","I01","S1","Build ICP target account list (100 accounts)","Daniel Webb","Sales & Marketing","At Risk",45,"Mar 2025","Task"],
    ["E03","I07","S1","Draft pre-sales solution architect JDs and shortlist","Laura Simmons","People & Culture","On Track",75,"Feb 2025","Task"],
    ["E04","I08","S1","Set up SAP, Oracle and D365 demo environments","Priya Mehta","Technology","On Track",65,"Apr 2025","Task"],
    ["E05","I05","S1","Develop Healthcare sector value proposition deck","Tom Griffiths","Sales & Marketing","Behind",10,"Jun 2025","Task"],
    ["E06","I06","S1","Define managed services SLA tiers and pricing model","Ayesha Nawaz","Professional Services","Behind",8,"Jun 2025","Task"],
    ["E07","I09","S2","Deploy project dashboard in Jiganto (all active projects)","Claire Donovan","Operations","On Track",90,"Mar 2025","Project"],
    ["E08","I10","S2","Write risk & issue log templates and train PMs","Ayesha Nawaz","Professional Services","On Track",88,"Feb 2025","Task"],
    ["E09","I11","S2","Create CSAT survey and automated send process","Nina Okafor","Delivery","On Track",72,"Mar 2025","Task"],
    ["E10","I12","S2","Complete SAP S/4HANA playbook — Prepare & Explore phases","Ayesha Nawaz","Professional Services","On Track",95,"Feb 2025","Task"],
    ["E11","I12","S2","Complete SAP S/4HANA playbook — Realise & Deploy phases","Ayesha Nawaz","Professional Services","On Track",85,"Mar 2025","Task"],
    ["E12","I13","S2","Complete Oracle Fusion Finance playbook","Nina Okafor","Delivery","On Track",80,"Apr 2025","Task"],
    ["E13","I14","S2","Complete D365 F&O playbook — Finance module","Nina Okafor","Delivery","On Track",75,"Apr 2025","Task"],
    ["E14","I15","S2","Define client success manager role and hire","Ayesha Nawaz","Professional Services","At Risk",35,"Sep 2025","Task"],
    ["E15","I16","S3","Create AI readiness assessment questionnaire and scoring model","Ravi Patel","Technology","At Risk",40,"Apr 2025","Task"],
    ["E16","I17","S3","Build AP automation accelerator prototype (SAP)","Priya Mehta","Technology","Behind",15,"Sep 2025","Task"],
    ["E17","I17","S3","Build financial forecasting AI add-on (Oracle)","Priya Mehta","Technology","Behind",10,"Dec 2025","Task"],
    ["E18","I18","S3","Complete Azure Integration Services training (team of 6)","Priya Mehta","Technology","At Risk",48,"Jun 2025","Task"],
    ["E19","I19","S3","Design SAP Business One rapid-deploy template framework","Priya Mehta","Technology","Behind",12,"Sep 2025","Task"],
    ["E20","I20","S4","Launch LinkedIn employer brand campaign","Laura Simmons","People & Culture","On Track",65,"Mar 2025","Campaign"],
    ["E21","I21","S4","Contract 3 specialist ERP agencies (SAP, Oracle, MS)","Laura Simmons","People & Culture","On Track",85,"Feb 2025","Task"],
    ["E22","I22","S4","Post and interview for 15 SAP consultant roles","Laura Simmons","People & Culture","On Track",58,"Jun 2025","Task"],
    ["E23","I23","S4","Negotiate partnership MOU with 2 universities","Laura Simmons","People & Culture","At Risk",28,"Sep 2025","Task"],
    ["E24","I24","S4","Publish SAP certification pathway guide for all levels","Nina Okafor","Delivery","On Track",80,"Mar 2025","Task"],
    ["E25","I24","S4","Publish Oracle certification pathway guide","Nina Okafor","Delivery","On Track",72,"Mar 2025","Task"],
    ["E26","I24","S4","Publish Microsoft D365 certification pathway guide","Nina Okafor","Delivery","On Track",68,"Apr 2025","Task"],
    ["E27","I25","S5","Submit SAP partner business plan (updated)","James Harrington","Executive","At Risk",55,"Mar 2025","Task"],
    ["E28","I25","S5","Hit SAP certified consultant headcount KPI (12)","Laura Simmons","People & Culture","At Risk",42,"Dec 2025","Milestone"],
    ["E29","I26","S5","Pass Oracle Cloud Infrastructure assessment","Priya Mehta","Technology","At Risk",30,"Jun 2025","Task"],
    ["E30","I27","S5","Complete Business Applications designation (MS)","Priya Mehta","Technology","At Risk",40,"Jun 2025","Task"],
    ["E31","I27","S5","Complete Data & AI designation (MS)","Priya Mehta","Technology","At Risk",35,"Sep 2025","Task"],
    ["E32","I28","S6","Configure Jiganto PSA — resource booking module","Claire Donovan","Operations","On Track",92,"Feb 2025","Task"],
    ["E33","I28","S6","Configure Jiganto PSA — timesheets & utilisation","Claire Donovan","Operations","On Track",88,"Mar 2025","Task"],
    ["E34","I28","S6","Migrate all 12 active projects to PSA","Claire Donovan","Operations","On Track",78,"Mar 2025","Task"],
    ["E35","I29","S6","Complete ISO 27001 gap analysis and remediation plan","Claire Donovan","Operations","On Track",82,"Mar 2025","Task"],
    ["E36","I29","S6","Achieve Cyber Essentials Plus — external assessment","Claire Donovan","Operations","On Track",90,"Mar 2025","Milestone"],
    ["E37","I30","S6","Build project P&L template in Finance system","Michael Torres","Finance","On Track",85,"Mar 2025","Task"],
    ["E38","I30","S6","Produce first monthly management accounts with project P&L","Callum Reid","Finance","On Track",80,"Mar 2025","Task"],
    ["E39","I30","S6","Train all PMs on P&L reporting process","Michael Torres","Finance","On Track",70,"Apr 2025","Task"],
    ["E40","I09","S6","Build utilisation heatmap report in Jiganto","Claire Donovan","Operations","On Track",75,"Mar 2025","Task"],
  ];
  await db.insert(businessTasks).values(
    E_DATA.map(([,iniCode,,title,ownerName,dept,ragStr,progress,targetDate,itemType]) => {
      const r = rag(ragStr); return {
        tenantId: TENANT_ID, initiativeId: iMap.get(iniCode) ?? null, title,
        ownerName, departmentId: dId(dept),
        ragStatus: r, status: st(r), progress, targetDate, itemType,
      };
    })
  );

  return {
    message: "Apex Solutions Group strategy map loaded — 192 items across 8 departments.",
    counts: { strategies: 6, goals: 26, objectives: 46, initiatives: 30, okrs: 18, kpis: 26, execution: 40, departments: 8 },
  };
}
