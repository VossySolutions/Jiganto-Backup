import { db } from "../db";
import {
  pmProjects,
  pmProjectPhases,
  pmWorkstreams,
  pmMilestones,
} from "@shared/models/projects";

export async function seedErpPortfolio(tenantId: number): Promise<{ projects: number; phases: number; milestones: number }> {

  const PROJECTS: {
    name: string; code: string; description: string; customer: string;
    startDate: string; endDate: string; progress: number; ragStatus: string;
    phases: {
      name: string; num: number; start: string; end: string; status: string; progress: number;
      workstreams: { name: string; start: string; end: string }[];
      milestones: {
        name: string; workstream: string; dueDate: string; targetDate: string;
        status: string; ragStatus: string; isCritical: boolean; commentary: string; description: string;
        completedDate?: string;
      }[];
    }[];
  }[] = [
    // ── PROJECT 1 ─────────────────────────────────────────────────
    {
      name: "SAP S/4HANA — Global Finance & Supply Chain",
      code: "SAP-2025",
      description: "Full SAP S/4HANA transformation covering Finance, Controlling, Procurement and Supply Chain across 8 entities in 4 countries.",
      customer: "Global Industries plc",
      startDate: "2025-01-06",
      endDate: "2026-06-30",
      progress: 72,
      ragStatus: "amber",
      phases: [
        {
          name: "Discovery & Prepare", num: 1, start: "2025-01-06", end: "2025-03-28", status: "completed", progress: 100,
          workstreams: [
            { name: "Business Requirements", start: "2025-01-06", end: "2025-02-28" },
            { name: "Technical Landscape", start: "2025-01-20", end: "2025-03-14" },
            { name: "Project Governance", start: "2025-01-06", end: "2025-03-28" },
          ],
          milestones: [
            { name: "Kick-Off & Charter Signed", workstream: "Project Governance", dueDate: "2025-01-17", targetDate: "2025-01-17", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Project charter signed by all steering committee members.", description: "Formal project kick-off with executive sign-off on charter and governance structure.", completedDate: "2025-01-17" },
            { name: "As-Is Process Documentation Complete", workstream: "Business Requirements", dueDate: "2025-02-28", targetDate: "2025-02-28", status: "completed", ragStatus: "Green", isCritical: false, commentary: "All 14 process areas documented and validated with business owners.", description: "Current-state process maps across Finance, Procurement and Supply Chain signed off.", completedDate: "2025-03-04" },
            { name: "Technical Landscape Assessment Approved", workstream: "Technical Landscape", dueDate: "2025-03-14", targetDate: "2025-03-14", status: "completed", ragStatus: "Green", isCritical: true, commentary: "System landscape approved. 23 legacy interfaces identified.", description: "Full technical assessment including infrastructure sizing, interface inventory and data volume analysis.", completedDate: "2025-03-14" },
          ],
        },
        {
          name: "Solution Design", num: 2, start: "2025-04-01", end: "2025-07-31", status: "completed", progress: 100,
          workstreams: [
            { name: "Finance & Controlling", start: "2025-04-01", end: "2025-07-18" },
            { name: "Procurement & Supply Chain", start: "2025-04-07", end: "2025-07-25" },
            { name: "Integrations Architecture", start: "2025-04-14", end: "2025-07-31" },
          ],
          milestones: [
            { name: "Finance Blueprint Sign-Off", workstream: "Finance & Controlling", dueDate: "2025-06-13", targetDate: "2025-06-13", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Blueprint approved by CFO and Finance Director across all entities.", description: "End-to-end Finance & Controlling blueprint covering GL, AP, AR, Cost Centres and Profit Centres.", completedDate: "2025-06-20" },
            { name: "Integration Architecture Approved", workstream: "Integrations Architecture", dueDate: "2025-07-25", targetDate: "2025-07-25", status: "completed", ragStatus: "Green", isCritical: true, commentary: "All 23 interfaces documented with agreed middleware approach.", description: "Integration design for MES, WMS, CRM and payroll interfaces reviewed by enterprise architecture board.", completedDate: "2025-07-25" },
          ],
        },
        {
          name: "Build & Configure", num: 3, start: "2025-08-01", end: "2025-12-19", status: "completed", progress: 100,
          workstreams: [
            { name: "Finance & Controlling", start: "2025-08-01", end: "2025-12-05" },
            { name: "Procurement & Supply Chain", start: "2025-08-01", end: "2025-12-12" },
            { name: "Data Migration", start: "2025-08-18", end: "2025-12-19" },
            { name: "Integrations & Development", start: "2025-09-01", end: "2025-12-19" },
          ],
          milestones: [
            { name: "Unit Test Cycle 1 Complete", workstream: "Finance & Controlling", dueDate: "2025-10-17", targetDate: "2025-10-17", status: "completed", ragStatus: "Green", isCritical: false, commentary: "99% pass rate across Finance module. 3 minor defects logged.", description: "First unit test cycle covering core Finance configuration.", completedDate: "2025-10-17" },
            { name: "Mock Data Migration Run 1", workstream: "Data Migration", dueDate: "2025-11-07", targetDate: "2025-11-07", status: "completed", ragStatus: "Amber", isCritical: true, commentary: "83% data quality pass rate. Legacy data cleanse workstream initiated.", description: "First full mock data migration covering master data and open items.", completedDate: "2025-11-14" },
            { name: "All Custom Developments Delivered", workstream: "Integrations & Development", dueDate: "2025-12-05", targetDate: "2025-12-05", status: "completed", ragStatus: "Green", isCritical: true, commentary: "17 of 17 WRICEF objects delivered and unit tested.", description: "All bespoke developments including forms, reports, interfaces and workflow enhancements.", completedDate: "2025-12-05" },
          ],
        },
        {
          name: "System Integration Testing", num: 4, start: "2026-01-05", end: "2026-03-13", status: "completed", progress: 100,
          workstreams: [
            { name: "SIT Execution", start: "2026-01-05", end: "2026-02-27" },
            { name: "Defect Resolution", start: "2026-01-19", end: "2026-03-07" },
            { name: "Data Migration Rehearsal", start: "2026-02-02", end: "2026-03-13" },
          ],
          milestones: [
            { name: "SIT Cycle 1 Sign-Off", workstream: "SIT Execution", dueDate: "2026-01-30", targetDate: "2026-01-30", status: "completed", ragStatus: "Green", isCritical: true, commentary: "First SIT cycle passed. 12 medium defects resolved.", description: "End-to-end system integration testing across Finance and Supply Chain scenarios.", completedDate: "2026-02-06" },
            { name: "Mock Migration Run 3 — 98% Quality Gate", workstream: "Data Migration Rehearsal", dueDate: "2026-03-06", targetDate: "2026-03-06", status: "completed", ragStatus: "Green", isCritical: true, commentary: "98.4% quality pass rate achieved. Cutover plan confirmed.", description: "Third and final mock migration achieving the required 98% quality threshold to proceed to UAT.", completedDate: "2026-03-06" },
          ],
        },
        {
          name: "User Acceptance Testing", num: 5, start: "2026-03-16", end: "2026-05-15", status: "in_progress", progress: 65,
          workstreams: [
            { name: "UAT Execution", start: "2026-03-16", end: "2026-04-25" },
            { name: "User Training", start: "2026-04-01", end: "2026-05-09" },
            { name: "Cutover Preparation", start: "2026-04-14", end: "2026-05-15" },
          ],
          milestones: [
            { name: "UAT Cycle 1 Sign-Off", workstream: "UAT Execution", dueDate: "2026-04-11", targetDate: "2026-04-11", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Finance and Procurement UAT streams passed with 94% first-pass rate.", description: "User acceptance testing cycle 1 covering Finance and Procurement business processes.", completedDate: "2026-04-11" },
            { name: "End-User Training Wave 1 Complete", workstream: "User Training", dueDate: "2026-04-30", targetDate: "2026-04-30", status: "completed", ragStatus: "Green", isCritical: false, commentary: "428 users trained across Finance and Procurement. Average assessment score 87%.", description: "Training delivery for power users and end users across Finance and Procurement modules.", completedDate: "2026-05-02" },
            { name: "UAT Final Sign-Off", workstream: "UAT Execution", dueDate: "2026-05-15", targetDate: "2026-05-15", status: "pending", ragStatus: "Amber", isCritical: true, commentary: "4 high-priority defects outstanding. Risk being tracked by steering committee.", description: "Final UAT sign-off gate confirming system is ready for production cutover." },
          ],
        },
        {
          name: "Go-Live & Hypercare", num: 6, start: "2026-05-25", end: "2026-06-30", status: "not_started", progress: 0,
          workstreams: [
            { name: "Cutover Execution", start: "2026-05-25", end: "2026-06-01" },
            { name: "Hypercare Support", start: "2026-06-01", end: "2026-06-30" },
          ],
          milestones: [
            { name: "Production Cutover Complete", workstream: "Cutover Execution", dueDate: "2026-06-01", targetDate: "2026-06-01", status: "pending", ragStatus: "Green", isCritical: true, commentary: "Cutover plan finalised. Weekend cutover window confirmed.", description: "Data migration to production, system validation and go-live confirmation." },
            { name: "SAP S/4HANA Go-Live", workstream: "Cutover Execution", dueDate: "2026-06-01", targetDate: "2026-06-01", status: "pending", ragStatus: "Green", isCritical: true, commentary: "Target go-live confirmed with business. Contingency date 15 Jun.", description: "Full go-live across all 8 entities and 4 countries simultaneously." },
            { name: "Hypercare Sign-Off & Project Close", workstream: "Hypercare Support", dueDate: "2026-06-30", targetDate: "2026-06-30", status: "pending", ragStatus: "Green", isCritical: false, commentary: "", description: "Formal project closure following 4-week hypercare period." },
          ],
        },
      ],
    },

    // ── PROJECT 2 ─────────────────────────────────────────────────
    {
      name: "Oracle Fusion Cloud — Finance & HCM",
      code: "ORC-2025",
      description: "Cloud-first Oracle Fusion implementation for Finance, Procurement and Human Capital Management replacing legacy on-premise EBS system.",
      customer: "Meridian Group",
      startDate: "2025-03-03",
      endDate: "2026-05-29",
      progress: 88,
      ragStatus: "green",
      phases: [
        {
          name: "Assess & Plan", num: 1, start: "2025-03-03", end: "2025-04-25", status: "completed", progress: 100,
          workstreams: [
            { name: "Current State Assessment", start: "2025-03-03", end: "2025-04-04" },
            { name: "Project Mobilisation", start: "2025-03-10", end: "2025-04-25" },
          ],
          milestones: [
            { name: "Project Kick-Off", workstream: "Project Mobilisation", dueDate: "2025-03-10", targetDate: "2025-03-10", status: "completed", ragStatus: "Green", isCritical: true, commentary: "All workstream leads confirmed. RACI matrix signed.", description: "Project kick-off with steering committee, workstream leads and Oracle partner team.", completedDate: "2025-03-10" },
            { name: "Current State Assessment Sign-Off", workstream: "Current State Assessment", dueDate: "2025-04-04", targetDate: "2025-04-04", status: "completed", ragStatus: "Green", isCritical: false, commentary: "Legacy EBS gaps documented. Fit-gap analysis 87% standard.", description: "Oracle EBS current-state documentation and gap analysis versus Fusion Cloud standard processes.", completedDate: "2025-04-04" },
          ],
        },
        {
          name: "Design & Prototype", num: 2, start: "2025-04-28", end: "2025-07-25", status: "completed", progress: 100,
          workstreams: [
            { name: "Financials", start: "2025-04-28", end: "2025-07-11" },
            { name: "Human Capital Management", start: "2025-04-28", end: "2025-07-18" },
            { name: "Integrations Design", start: "2025-05-12", end: "2025-07-25" },
          ],
          milestones: [
            { name: "Financials Design Sign-Off", workstream: "Financials", dueDate: "2025-06-27", targetDate: "2025-06-27", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Ledger design, chart of accounts and consolidation structure approved.", description: "Oracle Fusion Financials design covering GL, AP, AR, Fixed Assets and Cash Management.", completedDate: "2025-06-27" },
            { name: "HCM Blueprint Approved", workstream: "Human Capital Management", dueDate: "2025-07-11", targetDate: "2025-07-11", status: "completed", ragStatus: "Green", isCritical: true, commentary: "HR, Payroll and Absence blueprints approved by CHRO.", description: "Workforce structures, payroll configuration and absence management design approved.", completedDate: "2025-07-11" },
          ],
        },
        {
          name: "Configure & Build", num: 3, start: "2025-07-28", end: "2025-11-28", status: "completed", progress: 100,
          workstreams: [
            { name: "Financials", start: "2025-07-28", end: "2025-11-07" },
            { name: "Human Capital Management", start: "2025-07-28", end: "2025-11-14" },
            { name: "Data Migration", start: "2025-08-11", end: "2025-11-28" },
            { name: "Integrations", start: "2025-08-25", end: "2025-11-28" },
          ],
          milestones: [
            { name: "Conference Room Pilot (CRP1) Complete", workstream: "Financials", dueDate: "2025-09-26", targetDate: "2025-09-26", status: "completed", ragStatus: "Green", isCritical: true, commentary: "CRP1 completed successfully across Finance workstream. 6 config changes noted.", description: "First conference room pilot validating core Finance processes with key business users.", completedDate: "2025-09-26" },
            { name: "Data Migration Mock 1 Complete", workstream: "Data Migration", dueDate: "2025-10-10", targetDate: "2025-10-10", status: "completed", ragStatus: "Amber", isCritical: false, commentary: "Employee data 91% quality. Benefits and absence history require remediation.", description: "First mock migration of HR master data, employee records and historical transactions.", completedDate: "2025-10-17" },
            { name: "CRP2 Sign-Off — All Workstreams", workstream: "Financials", dueDate: "2025-11-14", targetDate: "2025-11-14", status: "completed", ragStatus: "Green", isCritical: true, commentary: "All workstreams passed CRP2. Proceed to UAT approved by steering committee.", description: "Second conference room pilot across Finance, HCM and Procurement with end-to-end scenario testing.", completedDate: "2025-11-14" },
          ],
        },
        {
          name: "User Acceptance Testing", num: 4, start: "2025-12-01", end: "2026-02-27", status: "completed", progress: 100,
          workstreams: [
            { name: "UAT — Financials", start: "2025-12-01", end: "2026-01-30" },
            { name: "UAT — HCM", start: "2025-12-08", end: "2026-02-06" },
            { name: "User Training", start: "2026-01-05", end: "2026-02-27" },
          ],
          milestones: [
            { name: "Finance UAT Sign-Off", workstream: "UAT — Financials", dueDate: "2026-01-30", targetDate: "2026-01-30", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Finance UAT passed. 97% test script pass rate. All P1/P2 defects resolved.", description: "UAT sign-off for all Oracle Fusion Financials modules.", completedDate: "2026-01-30" },
            { name: "HCM & Payroll UAT Sign-Off", workstream: "UAT — HCM", dueDate: "2026-02-06", targetDate: "2026-02-06", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Payroll parallel run results within 0.2% variance. HCM UAT approved.", description: "HCM and Payroll UAT including parallel payroll run validation.", completedDate: "2026-02-13" },
            { name: "Training Programme Complete", workstream: "User Training", dueDate: "2026-02-27", targetDate: "2026-02-27", status: "completed", ragStatus: "Green", isCritical: false, commentary: "612 users trained. 94% satisfaction rating from post-training survey.", description: "Oracle Fusion end-user training across Finance, Procurement and HCM teams.", completedDate: "2026-02-27" },
          ],
        },
        {
          name: "Go-Live & Stabilise", num: 5, start: "2026-03-02", end: "2026-05-29", status: "in_progress", progress: 80,
          workstreams: [
            { name: "Production Cutover", start: "2026-03-02", end: "2026-03-09" },
            { name: "Hypercare", start: "2026-03-09", end: "2026-04-30" },
            { name: "Project Closure", start: "2026-05-01", end: "2026-05-29" },
          ],
          milestones: [
            { name: "Oracle Fusion Go-Live", workstream: "Production Cutover", dueDate: "2026-03-09", targetDate: "2026-03-09", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Successful go-live across Finance and HCM. All critical processes operational.", description: "Production go-live of Oracle Fusion Finance and HCM replacing legacy EBS.", completedDate: "2026-03-09" },
            { name: "Hypercare Period Complete", workstream: "Hypercare", dueDate: "2026-04-30", targetDate: "2026-04-30", status: "completed", ragStatus: "Green", isCritical: false, commentary: "System stable. Ticket volume reduced to BAU levels by week 3.", description: "8-week hypercare period with dedicated support team on-site.", completedDate: "2026-04-30" },
            { name: "Project Closure & Benefits Realisation", workstream: "Project Closure", dueDate: "2026-05-29", targetDate: "2026-05-29", status: "pending", ragStatus: "Green", isCritical: false, commentary: "Benefits realisation report in draft. On track for sign-off.", description: "Formal project closure including lessons learned, benefits realisation baseline and handover to BAU." },
          ],
        },
      ],
    },

    // ── PROJECT 3 ─────────────────────────────────────────────────
    {
      name: "Microsoft Dynamics 365 — Finance & Operations",
      code: "D365-2025",
      description: "Microsoft Dynamics 365 F&O implementation for a retail and distribution business, replacing legacy Sage system with full cloud ERP.",
      customer: "Velocity Retail Group",
      startDate: "2025-06-02",
      endDate: "2026-05-29",
      progress: 60,
      ragStatus: "amber",
      phases: [
        {
          name: "Discovery", num: 1, start: "2025-06-02", end: "2025-07-25", status: "completed", progress: 100,
          workstreams: [
            { name: "Business Analysis", start: "2025-06-02", end: "2025-07-11" },
            { name: "Technical Architecture", start: "2025-06-16", end: "2025-07-25" },
          ],
          milestones: [
            { name: "Discovery Sign-Off", workstream: "Business Analysis", dueDate: "2025-07-11", targetDate: "2025-07-11", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Business requirements baseline approved. 142 user stories captured.", description: "Discovery phase completion with confirmed business requirements and agreed solution scope.", completedDate: "2025-07-11" },
            { name: "Solution Architecture Approved", workstream: "Technical Architecture", dueDate: "2025-07-25", targetDate: "2025-07-25", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Azure cloud architecture approved. D365 + Power Platform strategy confirmed.", description: "Technical architecture including D365 F&O, Power Platform, Azure integration and security model.", completedDate: "2025-07-25" },
          ],
        },
        {
          name: "Solution Design", num: 2, start: "2025-07-28", end: "2025-10-17", status: "completed", progress: 100,
          workstreams: [
            { name: "Finance & Accounting", start: "2025-07-28", end: "2025-10-03" },
            { name: "Supply Chain & Inventory", start: "2025-07-28", end: "2025-10-10" },
            { name: "Power Platform & Reporting", start: "2025-08-11", end: "2025-10-17" },
          ],
          milestones: [
            { name: "Finance Design Approved", workstream: "Finance & Accounting", dueDate: "2025-09-19", targetDate: "2025-09-19", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Chart of accounts, dimensions and financial reporting structure approved.", description: "D365 Finance design covering ledger structure, budgeting, AP, AR and bank reconciliation.", completedDate: "2025-09-19" },
            { name: "Supply Chain Design Approved", workstream: "Supply Chain & Inventory", dueDate: "2025-10-10", targetDate: "2025-10-10", status: "completed", ragStatus: "Green", isCritical: false, commentary: "Warehouse management and inventory valuation design signed off.", description: "Supply chain and inventory management design including warehouse operations and demand planning.", completedDate: "2025-10-10" },
          ],
        },
        {
          name: "Development & Configuration", num: 3, start: "2025-10-20", end: "2026-01-30", status: "completed", progress: 100,
          workstreams: [
            { name: "Finance & Accounting", start: "2025-10-20", end: "2026-01-09" },
            { name: "Supply Chain & Inventory", start: "2025-10-20", end: "2026-01-16" },
            { name: "Data Migration", start: "2025-11-03", end: "2026-01-30" },
            { name: "Power Platform & Reporting", start: "2025-11-10", end: "2026-01-30" },
          ],
          milestones: [
            { name: "Core Configuration Complete (FIT-GAP Resolved)", workstream: "Finance & Accounting", dueDate: "2025-12-05", targetDate: "2025-12-05", status: "completed", ragStatus: "Green", isCritical: true, commentary: "All FIT-GAP items resolved. 4 extensions built using Power Platform.", description: "D365 F&O core configuration complete across Finance and Supply Chain modules.", completedDate: "2025-12-05" },
            { name: "Power BI Reporting Suite Delivered", workstream: "Power Platform & Reporting", dueDate: "2026-01-16", targetDate: "2026-01-16", status: "completed", ragStatus: "Amber", isCritical: false, commentary: "18 of 22 reports delivered. 4 reports delayed to Testing phase due to data model changes.", description: "Power BI embedded reporting suite covering management accounts, inventory and sales dashboards.", completedDate: "2026-01-23" },
          ],
        },
        {
          name: "Testing", num: 4, start: "2026-02-02", end: "2026-04-10", status: "in_progress", progress: 55,
          workstreams: [
            { name: "System Integration Testing", start: "2026-02-02", end: "2026-03-06" },
            { name: "User Acceptance Testing", start: "2026-03-09", end: "2026-04-10" },
            { name: "Performance Testing", start: "2026-02-16", end: "2026-03-13" },
          ],
          milestones: [
            { name: "SIT Complete & Defects Resolved", workstream: "System Integration Testing", dueDate: "2026-03-06", targetDate: "2026-03-06", status: "completed", ragStatus: "Green", isCritical: true, commentary: "SIT passed. All P1 defects resolved. 3 P2 defects deferred to next sprint.", description: "Integration testing covering Dynamics 365, Power Platform, third-party integrations and custom extensions.", completedDate: "2026-03-06" },
            { name: "UAT Sign-Off", workstream: "User Acceptance Testing", dueDate: "2026-04-10", targetDate: "2026-04-10", status: "pending", ragStatus: "Amber", isCritical: true, commentary: "UAT in progress. Finance stream passed. Supply Chain UAT 3 days behind schedule due to resourcing.", description: "End-user acceptance testing across Finance, Supply Chain and reporting workstreams." },
          ],
        },
        {
          name: "Go-Live & Support", num: 5, start: "2026-04-20", end: "2026-05-29", status: "not_started", progress: 0,
          workstreams: [
            { name: "Cutover & Go-Live", start: "2026-04-20", end: "2026-04-27" },
            { name: "Hypercare & Stabilisation", start: "2026-04-27", end: "2026-05-29" },
          ],
          milestones: [
            { name: "D365 Go-Live", workstream: "Cutover & Go-Live", dueDate: "2026-04-27", targetDate: "2026-04-27", status: "pending", ragStatus: "Amber", isCritical: true, commentary: "Go-live date at risk due to UAT delays. Contingency date 11 May under review.", description: "Production go-live of Microsoft Dynamics 365 F&O replacing Sage across all UK entities." },
            { name: "Project Handover to BAU", workstream: "Hypercare & Stabilisation", dueDate: "2026-05-29", targetDate: "2026-05-29", status: "pending", ragStatus: "Green", isCritical: false, commentary: "", description: "Formal handover of D365 system to the internal IT and finance operations team." },
          ],
        },
      ],
    },

    // ── PROJECT 4 ─────────────────────────────────────────────────
    {
      name: "Workday HCM & Financial Management",
      code: "WDY-2025",
      description: "Workday cloud implementation covering full Human Capital Management, Payroll, Absence and Financial Management for a professional services firm.",
      customer: "Nexus Advisory Partners",
      startDate: "2025-09-01",
      endDate: "2026-10-30",
      progress: 42,
      ragStatus: "green",
      phases: [
        {
          name: "Plan & Architect", num: 1, start: "2025-09-01", end: "2025-10-31", status: "completed", progress: 100,
          workstreams: [
            { name: "Project Setup & Governance", start: "2025-09-01", end: "2025-09-26" },
            { name: "Tenant Configuration", start: "2025-09-15", end: "2025-10-31" },
          ],
          milestones: [
            { name: "Workday Tenant Provisioned", workstream: "Tenant Configuration", dueDate: "2025-09-19", targetDate: "2025-09-19", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Production and non-production tenants provisioned and accessible.", description: "Workday production and sandbox tenant provisioning and initial security configuration.", completedDate: "2025-09-19" },
            { name: "Project Architecture Approved", workstream: "Project Setup & Governance", dueDate: "2025-10-17", targetDate: "2025-10-17", status: "completed", ragStatus: "Green", isCritical: false, commentary: "Integration architecture and deployment plan approved by CIO.", description: "End-to-end deployment architecture covering Workday, payroll integrations and reporting.", completedDate: "2025-10-17" },
          ],
        },
        {
          name: "Configure Phase 1 — HCM Core", num: 2, start: "2025-11-03", end: "2026-01-30", status: "completed", progress: 100,
          workstreams: [
            { name: "Core HCM", start: "2025-11-03", end: "2026-01-16" },
            { name: "Absence & Time Tracking", start: "2025-11-17", end: "2026-01-30" },
            { name: "Compensation", start: "2025-12-01", end: "2026-01-30" },
          ],
          milestones: [
            { name: "Org Structures & Job Catalogue Loaded", workstream: "Core HCM", dueDate: "2025-12-12", targetDate: "2025-12-12", status: "completed", ragStatus: "Green", isCritical: true, commentary: "1,847 positions loaded. Org hierarchy validated by HR leadership.", description: "Workday organisation hierarchy, supervisory structures, job profiles and positions configured.", completedDate: "2025-12-12" },
            { name: "Prototype 1 Accepted — Core HCM", workstream: "Core HCM", dueDate: "2026-01-16", targetDate: "2026-01-16", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Prototype 1 accepted by HR Director. 8 configuration changes requested.", description: "First Workday prototype demonstration to business stakeholders covering Core HCM and Absence.", completedDate: "2026-01-16" },
          ],
        },
        {
          name: "Configure Phase 2 — Payroll & Financials", num: 3, start: "2026-02-02", end: "2026-05-15", status: "in_progress", progress: 70,
          workstreams: [
            { name: "Payroll", start: "2026-02-02", end: "2026-05-01" },
            { name: "Financial Management", start: "2026-02-02", end: "2026-05-08" },
            { name: "Integrations", start: "2026-02-16", end: "2026-05-15" },
          ],
          milestones: [
            { name: "Payroll Parallel Run 1 Complete", workstream: "Payroll", dueDate: "2026-03-31", targetDate: "2026-03-31", status: "completed", ragStatus: "Amber", isCritical: true, commentary: "Parallel run variance 1.8%. Pension deduction calculation under investigation.", description: "First payroll parallel run comparing Workday output against legacy payroll system.", completedDate: "2026-04-04" },
            { name: "Financial Management Prototype Accepted", workstream: "Financial Management", dueDate: "2026-04-17", targetDate: "2026-04-17", status: "completed", ragStatus: "Green", isCritical: false, commentary: "FM prototype accepted. Project accounting and billing design approved by CFO.", description: "Workday Financial Management prototype covering ledger, accounts payable, billing and project accounting.", completedDate: "2026-04-17" },
            { name: "Payroll Parallel Run 2 — Under 0.5% Variance", workstream: "Payroll", dueDate: "2026-05-08", targetDate: "2026-05-08", status: "pending", ragStatus: "Amber", isCritical: true, commentary: "Pension fix deployed. Run 2 in progress. Target 0.5% variance to proceed to UAT.", description: "Second payroll parallel run must achieve sub-0.5% variance to proceed to UAT." },
          ],
        },
        {
          name: "Testing & Validation", num: 4, start: "2026-05-18", end: "2026-08-14", status: "not_started", progress: 0,
          workstreams: [
            { name: "End-to-End Testing", start: "2026-05-18", end: "2026-07-10" },
            { name: "User Acceptance Testing", start: "2026-07-13", end: "2026-08-07" },
            { name: "User Training", start: "2026-06-15", end: "2026-08-14" },
          ],
          milestones: [
            { name: "End-to-End Test Sign-Off", workstream: "End-to-End Testing", dueDate: "2026-07-10", targetDate: "2026-07-10", status: "pending", ragStatus: "Green", isCritical: true, commentary: "", description: "Full end-to-end system testing across HCM, Payroll, Absence and Financial Management." },
            { name: "UAT Sign-Off — All Streams", workstream: "User Acceptance Testing", dueDate: "2026-08-07", targetDate: "2026-08-07", status: "pending", ragStatus: "Green", isCritical: true, commentary: "", description: "User acceptance testing sign-off gate across all Workday modules." },
          ],
        },
        {
          name: "Deploy & Optimise", num: 5, start: "2026-08-17", end: "2026-10-30", status: "not_started", progress: 0,
          workstreams: [
            { name: "Cutover & Go-Live", start: "2026-08-17", end: "2026-08-31" },
            { name: "Hypercare", start: "2026-09-01", end: "2026-10-02" },
            { name: "Optimisation", start: "2026-10-05", end: "2026-10-30" },
          ],
          milestones: [
            { name: "Workday Go-Live", workstream: "Cutover & Go-Live", dueDate: "2026-09-01", targetDate: "2026-09-01", status: "pending", ragStatus: "Green", isCritical: true, commentary: "", description: "Workday HCM, Payroll and Financial Management go-live replacing legacy systems." },
            { name: "Post-Go-Live Optimisation Complete", workstream: "Optimisation", dueDate: "2026-10-30", targetDate: "2026-10-30", status: "pending", ragStatus: "Green", isCritical: false, commentary: "", description: "30-day optimisation sprint addressing enhancements identified during hypercare." },
          ],
        },
      ],
    },

    // ── PROJECT 5 ─────────────────────────────────────────────────
    {
      name: "NetSuite Cloud ERP — Finance & Inventory",
      code: "NST-2026",
      description: "NetSuite ERP implementation for a fast-growing e-commerce and distribution business replacing QuickBooks and manual inventory management.",
      customer: "BrightPath Commerce",
      startDate: "2026-01-05",
      endDate: "2026-10-30",
      progress: 28,
      ragStatus: "red",
      phases: [
        {
          name: "Discovery & Scoping", num: 1, start: "2026-01-05", end: "2026-02-13", status: "completed", progress: 100,
          workstreams: [
            { name: "Requirements Gathering", start: "2026-01-05", end: "2026-01-30" },
            { name: "Solution Scoping", start: "2026-01-19", end: "2026-02-13" },
          ],
          milestones: [
            { name: "Scope & SOW Signed", workstream: "Solution Scoping", dueDate: "2026-01-30", targetDate: "2026-01-30", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Statement of Work signed. Fixed-price contract confirmed.", description: "Formal statement of work, project plan and resource schedule signed by both parties.", completedDate: "2026-01-30" },
            { name: "Business Requirements Baselined", workstream: "Requirements Gathering", dueDate: "2026-02-13", targetDate: "2026-02-13", status: "completed", ragStatus: "Green", isCritical: false, commentary: "96 requirements captured across Finance, Inventory, Order Management and Reporting.", description: "Business requirements document finalised and approved by Finance Director and Operations Manager.", completedDate: "2026-02-13" },
          ],
        },
        {
          name: "Configuration", num: 2, start: "2026-02-16", end: "2026-05-15", status: "in_progress", progress: 45,
          workstreams: [
            { name: "Finance", start: "2026-02-16", end: "2026-04-30" },
            { name: "Inventory & Order Management", start: "2026-02-23", end: "2026-05-08" },
            { name: "Integrations & EDI", start: "2026-03-09", end: "2026-05-15" },
          ],
          milestones: [
            { name: "Finance Module Configuration Complete", workstream: "Finance", dueDate: "2026-04-03", targetDate: "2026-04-03", status: "completed", ragStatus: "Green", isCritical: true, commentary: "Chart of accounts, tax codes and bank feeds configured and validated.", description: "NetSuite Finance configuration covering chart of accounts, AP, AR, bank reconciliation and tax.", completedDate: "2026-04-03" },
            { name: "Inventory Configuration & WMS Setup", workstream: "Inventory & Order Management", dueDate: "2026-04-24", targetDate: "2026-04-17", status: "pending", ragStatus: "Red", isCritical: true, commentary: "Inventory configuration 1 week behind. Bin location design required rework after warehouse walkthrough findings.", description: "NetSuite inventory management including bin locations, item master, replenishment rules and order management." },
            { name: "EDI Integration with 3PLs Live in Sandbox", workstream: "Integrations & EDI", dueDate: "2026-05-15", targetDate: "2026-05-15", status: "pending", ragStatus: "Amber", isCritical: false, commentary: "EDI mapping with primary 3PL complete. Secondary 3PL integration 2 weeks behind.", description: "EDI integration with 3PL warehouse partners for inbound shipments, stock movements and dispatch." },
          ],
        },
        {
          name: "Data Migration", num: 3, start: "2026-04-20", end: "2026-06-26", status: "not_started", progress: 0,
          workstreams: [
            { name: "Master Data", start: "2026-04-20", end: "2026-05-29" },
            { name: "Opening Balances & History", start: "2026-05-11", end: "2026-06-26" },
          ],
          milestones: [
            { name: "Customer & Supplier Master Data Loaded", workstream: "Master Data", dueDate: "2026-05-15", targetDate: "2026-05-15", status: "pending", ragStatus: "Amber", isCritical: true, commentary: "Data extract from QuickBooks behind schedule. Migration start at risk.", description: "Customer, supplier and product master data loaded and validated in NetSuite." },
            { name: "Opening Balances Validated", workstream: "Opening Balances & History", dueDate: "2026-06-26", targetDate: "2026-06-26", status: "pending", ragStatus: "Green", isCritical: true, commentary: "", description: "Trial balance, open AR/AP and inventory opening positions reconciled and signed off by Finance Director." },
          ],
        },
        {
          name: "Testing", num: 4, start: "2026-06-15", end: "2026-08-07", status: "not_started", progress: 0,
          workstreams: [
            { name: "System Testing", start: "2026-06-15", end: "2026-07-10" },
            { name: "User Acceptance Testing", start: "2026-07-13", end: "2026-08-07" },
          ],
          milestones: [
            { name: "System Test Sign-Off", workstream: "System Testing", dueDate: "2026-07-10", targetDate: "2026-07-10", status: "pending", ragStatus: "Green", isCritical: true, commentary: "", description: "System testing covering Finance, Inventory, Order Management and all integrations." },
            { name: "UAT Sign-Off", workstream: "User Acceptance Testing", dueDate: "2026-08-07", targetDate: "2026-08-07", status: "pending", ragStatus: "Green", isCritical: true, commentary: "", description: "Business user acceptance testing and final sign-off before go-live." },
          ],
        },
        {
          name: "Go-Live & Hypercare", num: 5, start: "2026-08-17", end: "2026-10-30", status: "not_started", progress: 0,
          workstreams: [
            { name: "Cutover & Go-Live", start: "2026-08-17", end: "2026-08-28" },
            { name: "Hypercare", start: "2026-08-28", end: "2026-10-02" },
            { name: "Project Closure", start: "2026-10-05", end: "2026-10-30" },
          ],
          milestones: [
            { name: "NetSuite Go-Live", workstream: "Cutover & Go-Live", dueDate: "2026-08-28", targetDate: "2026-08-28", status: "pending", ragStatus: "Green", isCritical: true, commentary: "", description: "NetSuite ERP go-live replacing QuickBooks across all Finance and Inventory operations." },
            { name: "Project Complete & BAU Handover", workstream: "Project Closure", dueDate: "2026-10-30", targetDate: "2026-10-30", status: "pending", ragStatus: "Green", isCritical: false, commentary: "", description: "Formal project closure and handover to internal IT team for ongoing NetSuite support." },
          ],
        },
      ],
    },
  ];

  let totalProjects = 0;
  let totalPhases = 0;
  let totalMilestones = 0;

  for (const proj of PROJECTS) {
    // Insert project
    const [insertedProject] = await db.insert(pmProjects).values({
      tenantId,
      name: proj.name,
      code: proj.code,
      description: proj.description,
      customer: proj.customer,
      startDate: proj.startDate,
      endDate: proj.endDate,
      progress: proj.progress,
      ragStatus: proj.ragStatus,
      status: "active",
      projectType: "large_project",
      methodology: "hybrid",
    }).returning();
    totalProjects++;

    const phaseMap: Record<string, number> = {};

    for (const phase of proj.phases) {
      // Insert phase
      const [insertedPhase] = await db.insert(pmProjectPhases).values({
        tenantId,
        projectId: insertedProject.id,
        name: phase.name,
        phaseNumber: phase.num,
        plannedStartDate: phase.start,
        plannedEndDate: phase.end,
        order: phase.num,
        status: phase.status,
        progress: phase.progress,
      }).returning();
      phaseMap[phase.name] = insertedPhase.id;
      totalPhases++;

      // Insert workstreams
      for (let wi = 0; wi < phase.workstreams.length; wi++) {
        const ws = phase.workstreams[wi];
        await db.insert(pmWorkstreams).values({
          tenantId,
          projectId: insertedProject.id,
          phaseId: insertedPhase.id,
          type: "workstream",
          name: ws.name,
          plannedStartDate: ws.start,
          plannedEndDate: ws.end,
          order: wi + 1,
          status: phase.status === "completed" ? "completed" : phase.status === "in_progress" ? "in_progress" : "not_started",
          progress: phase.status === "completed" ? 100 : 0,
        });
      }

      // Insert milestones
      for (let mi = 0; mi < phase.milestones.length; mi++) {
        const ms = phase.milestones[mi];
        await db.insert(pmMilestones).values({
          tenantId,
          projectId: insertedProject.id,
          phaseId: insertedPhase.id,
          name: ms.name,
          description: ms.description,
          dueDate: ms.dueDate,
          completedDate: ms.completedDate ?? null,
          targetDate: ms.targetDate,
          status: ms.status,
          ragStatus: ms.ragStatus,
          isCritical: ms.isCritical,
          commentary: ms.commentary,
          projectName: proj.name,
          phase: phase.name,
          workstream: ms.workstream,
          order: mi + 1,
        });
        totalMilestones++;
      }
    }
  }

  return { projects: totalProjects, phases: totalPhases, milestones: totalMilestones };
}
