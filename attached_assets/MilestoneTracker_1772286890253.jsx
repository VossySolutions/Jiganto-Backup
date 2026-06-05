import { useState, useMemo, useRef, useCallback, useEffect } from "react";

// ─── Font injection ────────────────────────────────────────────────────────────
const injectFonts = () => {
  if (document.getElementById("jiganto-fonts")) return;
  const link = document.createElement("link");
  link.id = "jiganto-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Serif+Display&display=swap";
  document.head.appendChild(link);
};

// ─── Types & Constants ────────────────────────────────────────────────────────
const RAG_CONFIG = {
  Green: { bg: "#dcfce7", fg: "#15803d", dot: "#22c55e", label: "On Track" },
  Amber: { bg: "#fef3c7", fg: "#92400e", dot: "#f59e0b", label: "At Risk" },
  Red: { bg: "#fee2e2", fg: "#991b1b", dot: "#ef4444", label: "Delayed" },
  Blue: { bg: "#dbeafe", fg: "#1d4ed8", dot: "#3b82f6", label: "Delivered" },
};
const RAG_ORDER = ["Green", "Amber", "Red", "Blue"];

const ROLES = ["Viewer", "Contributor", "Project Manager", "Admin"];

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const TODAY = new Date();
const d = (offset) => {
  const dt = new Date(TODAY);
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split("T")[0];
};

const MOCK_MILESTONES = [
  // Project Alpha – SAP Finance
  { id: "m01", projectId: "p1", projectName: "SAP Finance", phase: "Initiation", workstream: "Governance", milestoneTitle: "Project Charter Signed", targetDate: d(-90), ragStatus: "Blue", commentary: "Charter approved and signed by all stakeholders.", createdAt: d(-120), updatedAt: d(-91) },
  { id: "m02", projectId: "p1", projectName: "SAP Finance", phase: "Planning", workstream: "Governance", milestoneTitle: "Business Case Approved", targetDate: d(-75), ragStatus: "Blue", commentary: "Full business case approved by Steering Committee.", createdAt: d(-100), updatedAt: d(-74) },
  { id: "m03", projectId: "p1", projectName: "SAP Finance", phase: "Planning", workstream: "Finance", milestoneTitle: "Budget Formally Allocated", targetDate: d(-60), ragStatus: "Blue", commentary: "Capex/Opex split approved by CFO.", createdAt: d(-90), updatedAt: d(-59) },
  { id: "m04", projectId: "p1", projectName: "SAP Finance", phase: "Blueprint", workstream: "Technical", milestoneTitle: "Architecture Design Complete", targetDate: d(-30), ragStatus: "Blue", commentary: "HLD reviewed by Architecture Board and approved.", createdAt: d(-60), updatedAt: d(-28) },
  { id: "m05", projectId: "p1", projectName: "SAP Finance", phase: "Blueprint", workstream: "Data", milestoneTitle: "Data Migration Strategy Signed Off", targetDate: d(-14), ragStatus: "Amber", commentary: "Strategy approved but dry run 1 had 5.7% failure rate. Remediation in progress.", createdAt: d(-45), updatedAt: d(-3) },
  { id: "m06", projectId: "p1", projectName: "SAP Finance", phase: "Build", workstream: "Technical", milestoneTitle: "Core Finance Module Build Complete", targetDate: d(7), ragStatus: "Amber", commentary: "Finance GL and AP 90% complete. AR module behind by ~4 days.", createdAt: d(-30), updatedAt: d(-1) },
  { id: "m07", projectId: "p1", projectName: "SAP Finance", phase: "Build", workstream: "Data", milestoneTitle: "Data Migration Dry Run 2", targetDate: d(14), ragStatus: "Red", commentary: "Dry run 2 blocked by SAP Basis transport issue. ETA fix: 3 days. Risk to SIT start.", createdAt: d(-20), updatedAt: d(0) },
  { id: "m08", projectId: "p1", projectName: "SAP Finance", phase: "Testing", workstream: "Technical", milestoneTitle: "SIT Passed", targetDate: d(35), ragStatus: "Amber", commentary: "SIT start delayed to 29 Aug due to build slip. SIT window compressed.", createdAt: d(-15), updatedAt: d(-1) },
  { id: "m09", projectId: "p1", projectName: "SAP Finance", phase: "Testing", workstream: "Finance", milestoneTitle: "UAT Formally Signed Off", targetDate: d(55), ragStatus: "Green", commentary: "UAT planned for 12 Sep. Business readiness confirmed.", createdAt: d(-10), updatedAt: d(-1) },
  { id: "m10", projectId: "p1", projectName: "SAP Finance", phase: "Go-Live", workstream: "Governance", milestoneTitle: "SteerCo Go/No-Go Decision", targetDate: d(70), ragStatus: "Green", commentary: "Scheduled for SteerCo 28 Sep. Pre-read pack due 25 Sep.", createdAt: d(-5), updatedAt: d(-1) },
  { id: "m11", projectId: "p1", projectName: "SAP Finance", phase: "Go-Live", workstream: "Technical", milestoneTitle: "Production Go Live", targetDate: d(85), ragStatus: "Green", commentary: "Target go-live 1 Oct. Contingency window available.", createdAt: d(-3), updatedAt: d(-1) },

  // Project Beta – CRM Transformation
  { id: "m12", projectId: "p2", projectName: "CRM Transformation", phase: "Initiation", workstream: "Governance", milestoneTitle: "Sponsor Assigned", targetDate: d(-110), ragStatus: "Blue", commentary: "", createdAt: d(-130), updatedAt: d(-109) },
  { id: "m13", projectId: "p2", projectName: "CRM Transformation", phase: "Planning", workstream: "Technical", milestoneTitle: "CRM Platform Selected", targetDate: d(-80), ragStatus: "Blue", commentary: "Salesforce selected after RFP evaluation.", createdAt: d(-110), updatedAt: d(-78) },
  { id: "m14", projectId: "p2", projectName: "CRM Transformation", phase: "Build", workstream: "Technical", milestoneTitle: "Salesforce Org Configured", targetDate: d(-20), ragStatus: "Red", commentary: "Configuration 70% complete. Integration with legacy ERP hitting timeout issues.", createdAt: d(-50), updatedAt: d(-2) },
  { id: "m15", projectId: "p2", projectName: "CRM Transformation", phase: "Build", workstream: "Data", milestoneTitle: "Customer Data Cleansed", targetDate: d(-10), ragStatus: "Red", commentary: "8,400 duplicate records found. Deduplication underway. Blocking migration.", createdAt: d(-40), updatedAt: d(-1) },
  { id: "m16", projectId: "p2", projectName: "CRM Transformation", phase: "Training", workstream: "Finance", milestoneTitle: "Sales Team Training Complete", targetDate: d(25), ragStatus: "Amber", commentary: "120 of 200 sales reps trained. Remaining sessions scheduled.", createdAt: d(-20), updatedAt: d(-1) },
  { id: "m17", projectId: "p2", projectName: "CRM Transformation", phase: "Go-Live", workstream: "Technical", milestoneTitle: "CRM Go Live", targetDate: d(60), ragStatus: "Red", commentary: "Go-live at risk due to integration issues and data quality. Contingency date: +14 days.", createdAt: d(-10), updatedAt: d(0) },

  // Project Gamma – Cloud Infrastructure
  { id: "m18", projectId: "p3", projectName: "Cloud Infrastructure", phase: "Planning", workstream: "Technical", milestoneTitle: "Cloud Architecture Approved", targetDate: d(-50), ragStatus: "Blue", commentary: "AWS eu-west-1 architecture approved.", createdAt: d(-80), updatedAt: d(-48) },
  { id: "m19", projectId: "p3", projectName: "Cloud Infrastructure", phase: "Build", workstream: "Technical", milestoneTitle: "Prod Environment Provisioned", targetDate: d(-15), ragStatus: "Blue", commentary: "All EC2, RDS, S3, CloudFront deployed via Terraform.", createdAt: d(-40), updatedAt: d(-14) },
  { id: "m20", projectId: "p3", projectName: "Cloud Infrastructure", phase: "Testing", workstream: "Technical", milestoneTitle: "Security Penetration Test Complete", targetDate: d(10), ragStatus: "Amber", commentary: "2 medium findings to remediate. No critical/high. Remediation due 18 Mar.", createdAt: d(-20), updatedAt: d(-1) },
  { id: "m21", projectId: "p3", projectName: "Cloud Infrastructure", phase: "Testing", workstream: "Governance", milestoneTitle: "DR / Failover Test Signed Off", targetDate: d(20), ragStatus: "Red", commentary: "DR test not yet scheduled. 3 weeks outstanding. Blocker for go-live.", createdAt: d(-15), updatedAt: d(0) },
  { id: "m22", projectId: "p3", projectName: "Cloud Infrastructure", phase: "Go-Live", workstream: "Technical", milestoneTitle: "Hypercare Plan Live", targetDate: d(45), ragStatus: "Green", commentary: "Hypercare model agreed. Vendor support committed for 10 business days.", createdAt: d(-5), updatedAt: d(-1) },

  // Project Delta – HR System Upgrade
  { id: "m23", projectId: "p4", projectName: "HR System Upgrade", phase: "Initiation", workstream: "Governance", milestoneTitle: "Project Kickoff", targetDate: d(-40), ragStatus: "Blue", commentary: "", createdAt: d(-60), updatedAt: d(-39) },
  { id: "m24", projectId: "p4", projectName: "HR System Upgrade", phase: "Blueprint", workstream: "Finance", milestoneTitle: "Requirements Signed Off", targetDate: d(-10), ragStatus: "Green", commentary: "BRD approved by HR Director and PMO.", createdAt: d(-30), updatedAt: d(-9) },
  { id: "m25", projectId: "p4", projectName: "HR System Upgrade", phase: "Build", workstream: "Technical", milestoneTitle: "Payroll Integration Built", targetDate: d(30), ragStatus: "Green", commentary: "Development on track. Code review in progress.", createdAt: d(-10), updatedAt: d(-1) },
  { id: "m26", projectId: "p4", projectName: "HR System Upgrade", phase: "Testing", workstream: "Finance", milestoneTitle: "Parallel Payroll Run Complete", targetDate: d(65), ragStatus: "Green", commentary: "Parallel run planned for October payroll cycle.", createdAt: d(-5), updatedAt: d(-1) },
  { id: "m27", projectId: "p4", projectName: "HR System Upgrade", phase: "Go-Live", workstream: "Technical", milestoneTitle: "HR System Go Live", targetDate: d(95), ragStatus: "Green", commentary: "Target November go-live aligned with new payroll year.", createdAt: d(-3), updatedAt: d(-1) },
];

// ─── Styles (injected) ────────────────────────────────────────────────────────
const STYLES = `
  .jmt * { box-sizing: border-box; margin: 0; padding: 0; }
  .jmt {
    font-family: 'DM Sans', sans-serif;
    background: #f4f3f0;
    color: #1a1917;
    min-height: 100vh;
    padding: 28px 24px 80px;
    font-size: 14px;
  }

  /* Header */
  .jmt-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  .jmt-header-left h1 { font-family: 'DM Serif Display', serif; font-size: 28px; letter-spacing: -.3px; }
  .jmt-header-left p { color: #7a7570; font-size: 13px; margin-top: 3px; }
  .jmt-header-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

  /* View toggle */
  .jmt-view-toggle { display: flex; background: #fff; border: 1.5px solid #e8e5e0; border-radius: 10px; overflow: hidden; }
  .jmt-vt-btn { padding: 8px 16px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; border: none; background: transparent; cursor: pointer; color: #7a7570; transition: all .15s; white-space: nowrap; }
  .jmt-vt-btn.active { background: #1a1917; color: #fff; }

  /* Buttons */
  .jmt-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; white-space: nowrap; border: 1.5px solid #e8e5e0; background: #fff; color: #7a7570; }
  .jmt-btn:hover { border-color: #aaa; color: #1a1917; }
  .jmt-btn-primary { background: #3b6cf4; color: #fff; border-color: #3b6cf4; }
  .jmt-btn-primary:hover { filter: brightness(1.08); border-color: #3b6cf4; color: #fff; }

  /* Role selector */
  .jmt-role-sel { padding: 7px 26px 7px 10px; border: 1.5px solid #e8e5e0; border-radius: 8px; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23b0aa9f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 8px center; font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 600; color: #1a1917; outline: none; appearance: none; cursor: pointer; }

  /* KPI bar */
  .jmt-kpi-bar { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; margin-bottom: 18px; }
  .jmt-kpi { background: #fff; border: 2px solid #e8e5e0; border-radius: 14px; padding: 13px 15px; cursor: pointer; transition: all .18s; position: relative; overflow: hidden; user-select: none; }
  .jmt-kpi::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--kc); }
  .jmt-kpi:hover { border-color: var(--kc); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,.08); }
  .jmt-kpi.active { border-color: var(--kc); background: color-mix(in srgb, var(--kc) 7%, #fff); }
  .jmt-kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #7a7570; margin-bottom: 6px; }
  .jmt-kpi-val { font-family: 'DM Serif Display', serif; font-size: 26px; line-height: 1; color: var(--kc); }

  /* Filters */
  .jmt-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
  .jmt-fsel { padding: 7px 26px 7px 10px; border: 1.5px solid #e8e5e0; border-radius: 8px; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23b0aa9f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 8px center; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1a1917; outline: none; appearance: none; cursor: pointer; }
  .jmt-fsel:focus { border-color: #3b6cf4; }
  .jmt-finput { padding: 7px 10px; border: 1.5px solid #e8e5e0; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1a1917; outline: none; background: #fff; }
  .jmt-finput:focus { border-color: #3b6cf4; }
  .jmt-fsep { width: 1px; height: 22px; background: #e8e5e0; flex-shrink: 0; }
  .jmt-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; background: #3b6cf4; color: #fff; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; }
  .jmt-pill span { opacity: .7; }

  /* ── TABLE VIEW ── */
  .jmt-table-wrap { background: #fff; border: 1.5px solid #e8e5e0; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04); }
  .jmt-table-scroll { overflow-x: auto; max-height: 600px; overflow-y: auto; }
  .jmt-table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 900px; }
  .jmt-table colgroup col.c-project  { width: 14%; }
  .jmt-table colgroup col.c-phase    { width: 11%; }
  .jmt-table colgroup col.c-ws       { width: 11%; }
  .jmt-table colgroup col.c-ms       { width: 20%; }
  .jmt-table colgroup col.c-date     { width: 110px; }
  .jmt-table colgroup col.c-rag      { width: 120px; }
  .jmt-table colgroup col.c-comment  { width: auto; }
  .jmt-table colgroup col.c-act      { width: 44px; }
  .jmt-table thead { position: sticky; top: 0; z-index: 10; }
  .jmt-table thead th { background: #faf9f7; border-bottom: 1.5px solid #e8e5e0; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #7a7570; text-align: left; white-space: nowrap; cursor: pointer; user-select: none; }
  .jmt-table thead th:hover { color: #1a1917; }
  .jmt-table thead th .sort-icon { opacity: .4; margin-left: 4px; }
  .jmt-table thead th.sort-active { color: #3b6cf4; }
  .jmt-table thead th.sort-active .sort-icon { opacity: 1; }
  .jmt-table tbody tr { border-bottom: 1px solid #e8e5e0; transition: background .1s; }
  .jmt-table tbody tr:last-child { border-bottom: none; }
  .jmt-table tbody tr:hover { background: #faf9f7; }
  .jmt-table tbody tr.overdue { background: #fff8f5; }
  .jmt-table tbody tr.overdue:hover { background: #fef2ee; }
  .jmt-table tbody td { padding: 10px 12px; vertical-align: middle; font-size: 13px; }
  .jmt-project-link { font-weight: 600; color: #3b6cf4; cursor: pointer; text-decoration: none; }
  .jmt-project-link:hover { text-decoration: underline; }
  .jmt-rag-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer; transition: transform .12s; white-space: nowrap; user-select: none; }
  .jmt-rag-pill:hover { transform: scale(1.04); filter: brightness(.96); }
  .jmt-rag-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .jmt-overdue-icon { margin-left: 6px; font-size: 13px; }
  .jmt-comment-cell { display: flex; align-items: center; gap: 6px; }
  .jmt-comment-text { flex: 1; font-size: 12.5px; color: #7a7570; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .jmt-comment-edit { width: 100%; border: 1.5px solid #3b6cf4; border-radius: 6px; padding: 5px 8px; font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: #1a1917; outline: none; background: #f0f5ff; resize: none; }
  .jmt-date-edit { border: 1.5px solid #3b6cf4; border-radius: 6px; padding: 4px 7px; font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: #1a1917; outline: none; background: #f0f5ff; width: 100%; }
  .jmt-icon-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: 1.5px solid #e8e5e0; background: #fff; cursor: pointer; font-size: 12px; color: #7a7570; transition: all .12s; flex-shrink: 0; }
  .jmt-icon-btn:hover { border-color: #dc2626; color: #dc2626; }
  .jmt-ms-title { font-weight: 500; }
  .jmt-ms-overdue { color: #dc2626 !important; }
  .jmt-empty { padding: 48px 20px; text-align: center; color: #b0aa9f; }
  .jmt-empty-icon { font-size: 32px; margin-bottom: 10px; }

  /* RAG dropdown */
  .jmt-rag-wrap { position: relative; display: inline-block; }
  .jmt-rag-menu { position: absolute; top: calc(100% + 4px); left: 0; background: #fff; border: 1.5px solid #e8e5e0; border-radius: 10px; padding: 5px; box-shadow: 0 8px 24px rgba(0,0,0,.12); z-index: 100; display: none; min-width: 140px; animation: jmtFadeUp .15s ease; }
  .jmt-rag-menu.open { display: block; }
  @keyframes jmtFadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  .jmt-rag-opt { display: flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 600; transition: background .1s; }
  .jmt-rag-opt:hover { background: #faf9f7; }

  /* ── TIMELINE VIEW ── */
  .jmt-timeline-container { background: #fff; border: 1.5px solid #e8e5e0; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04); }
  .jmt-tl-controls { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1.5px solid #e8e5e0; flex-wrap: wrap; background: #faf9f7; }
  .jmt-tl-ctrl-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #7a7570; }
  .jmt-tl-toggle { display: flex; background: #fff; border: 1.5px solid #e8e5e0; border-radius: 8px; overflow: hidden; }
  .jmt-tl-btn { padding: 6px 13px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; border: none; background: transparent; cursor: pointer; color: #7a7570; transition: all .15s; white-space: nowrap; }
  .jmt-tl-btn.active { background: #1a1917; color: #fff; }
  .jmt-tl-sep { width: 1px; height: 22px; background: #e8e5e0; }
  .jmt-tl-scroll { overflow-x: auto; overflow-y: auto; max-height: 520px; }
  .jmt-tl-inner { position: relative; padding-bottom: 16px; }
  .jmt-tl-header-row { display: flex; position: sticky; top: 0; z-index: 20; background: #faf9f7; border-bottom: 1.5px solid #e8e5e0; }
  .jmt-tl-label-col { width: 200px; min-width: 200px; flex-shrink: 0; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #7a7570; border-right: 1.5px solid #e8e5e0; background: #faf9f7; }
  .jmt-tl-cells { display: flex; flex: 1; }
  .jmt-tl-cell-head { text-align: center; font-size: 11px; font-weight: 700; color: #7a7570; padding: 10px 0; border-right: 1px solid #e8e5e0; white-space: nowrap; flex-shrink: 0; overflow: hidden; }
  .jmt-tl-cell-head.today-col { background: color-mix(in srgb, #3b6cf4 8%, #faf9f7); color: #3b6cf4; }
  .jmt-tl-swimlane { display: flex; border-bottom: 1px solid #e8e5e0; min-height: 52px; position: relative; }
  .jmt-tl-swimlane:last-child { border-bottom: none; }
  .jmt-tl-lane-label { width: 200px; min-width: 200px; flex-shrink: 0; padding: 10px 14px; display: flex; align-items: center; gap: 8px; border-right: 1.5px solid #e8e5e0; background: #faf9f7; position: sticky; left: 0; z-index: 5; }
  .jmt-tl-lane-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .jmt-tl-lane-name { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .jmt-tl-lane-count { font-size: 11px; color: #b0aa9f; background: #e8e5e0; padding: 1px 7px; border-radius: 20px; flex-shrink: 0; }
  .jmt-tl-lane-track { flex: 1; display: flex; position: relative; align-items: center; }
  .jmt-tl-col { flex-shrink: 0; border-right: 1px solid #f0efe8; height: 100%; position: relative; }
  .jmt-tl-col.today-col { background: color-mix(in srgb, #3b6cf4 5%, transparent); }
  .jmt-tl-today-line { position: absolute; top: 0; bottom: 0; width: 2px; background: #3b6cf4; z-index: 10; pointer-events: none; }
  .jmt-tl-today-flag { position: absolute; top: 0; background: #3b6cf4; color: #fff; font-size: 9.5px; font-weight: 700; padding: 2px 5px; border-radius: 0 0 4px 4px; white-space: nowrap; transform: translateX(-50%); }
  .jmt-tl-marker { position: absolute; transform: translateX(-50%); cursor: pointer; z-index: 8; display: flex; flex-direction: column; align-items: center; }
  .jmt-tl-marker-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.18); transition: transform .12s; flex-shrink: 0; }
  .jmt-tl-marker:hover .jmt-tl-marker-dot { transform: scale(1.4); }
  .jmt-tl-marker-label { font-size: 10.5px; font-weight: 600; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; margin-top: 3px; color: #1a1917; text-align: center; }
  .jmt-tl-overdue-icon { font-size: 9px; margin-left: 2px; }

  /* Tooltip */
  .jmt-tooltip { position: fixed; background: #1a1917; color: #fff; border-radius: 10px; padding: 11px 14px; font-size: 12px; line-height: 1.55; z-index: 9999; pointer-events: none; box-shadow: 0 8px 24px rgba(0,0,0,.22); max-width: 260px; }
  .jmt-tooltip-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
  .jmt-tooltip-row { display: flex; gap: 8px; align-items: flex-start; }
  .jmt-tooltip-key { color: #9ca3af; font-size: 11px; width: 70px; flex-shrink: 0; }
  .jmt-tooltip-val { color: #fff; flex: 1; }

  /* Modal */
  .jmt-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.38); backdrop-filter: blur(3px); z-index: 500; align-items: center; justify-content: center; padding: 16px; }
  .jmt-overlay.open { display: flex; }
  .jmt-modal { background: #fff; border-radius: 14px; width: 100%; max-width: 540px; box-shadow: 0 24px 64px rgba(0,0,0,.18); animation: jmtModalIn .2s ease; overflow: hidden; max-height: 90vh; display: flex; flex-direction: column; }
  @keyframes jmtModalIn { from { opacity: 0; transform: scale(.95) translateY(10px); } to { opacity: 1; transform: none; } }
  .jmt-modal-head { padding: 20px 24px 16px; border-bottom: 1.5px solid #e8e5e0; display: flex; align-items: center; justify-content: space-between; }
  .jmt-modal-head h2 { font-family: 'DM Serif Display', serif; font-size: 20px; }
  .jmt-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
  .jmt-modal-foot { padding: 14px 24px; border-top: 1.5px solid #e8e5e0; display: flex; justify-content: flex-end; gap: 8px; }
  .jmt-mclose { width: 28px; height: 28px; border-radius: 7px; border: 1.5px solid #e8e5e0; background: transparent; cursor: pointer; font-size: 15px; color: #7a7570; display: flex; align-items: center; justify-content: center; }
  .jmt-mclose:hover { background: #faf9f7; }
  .jmt-mgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .jmt-mgrid .full { grid-column: 1/-1; }
  .jmt-mfield { display: flex; flex-direction: column; gap: 5px; }
  .jmt-mlabel { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #7a7570; }
  .jmt-minput, .jmt-msel, .jmt-mtextarea { padding: 9px 12px; border: 1.5px solid #e8e5e0; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13.5px; color: #1a1917; background: #faf9f7; outline: none; transition: border-color .15s; width: 100%; }
  .jmt-minput:focus, .jmt-msel:focus, .jmt-mtextarea:focus { border-color: #3b6cf4; }
  .jmt-msel { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23b0aa9f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px; }
  .jmt-mtextarea { resize: vertical; min-height: 80px; }

  /* Toast */
  @keyframes jmtToast { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  .jmt-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1a1917; color: #fff; padding: 11px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; z-index: 9999; box-shadow: 0 8px 24px rgba(0,0,0,.2); animation: jmtToast .2s ease; white-space: nowrap; }

  /* Scrollbar */
  .jmt-tl-scroll::-webkit-scrollbar, .jmt-table-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
  .jmt-tl-scroll::-webkit-scrollbar-track, .jmt-table-scroll::-webkit-scrollbar-track { background: #f4f3f0; }
  .jmt-tl-scroll::-webkit-scrollbar-thumb, .jmt-table-scroll::-webkit-scrollbar-thumb { background: #d0cdc8; border-radius: 3px; }

  /* Import modal */
  .jmt-imp-tabs { display: flex; gap: 0; border-bottom: 1.5px solid #e8e5e0; margin-bottom: 20px; }
  .jmt-imp-tab { padding: 9px 20px; font-size: 13px; font-weight: 600; color: #7a7570; cursor: pointer; border-bottom: 2.5px solid transparent; margin-bottom: -1.5px; transition: all .15s; }
  .jmt-imp-tab.active { color: #3b6cf4; border-bottom-color: #3b6cf4; }
  .jmt-imp-tab:hover:not(.active) { color: #1a1917; }
  .jmt-drop-zone { border: 2px dashed #e8e5e0; border-radius: 14px; padding: 30px 20px; text-align: center; cursor: pointer; transition: all .2s; background: #faf9f7; }
  .jmt-drop-zone:hover, .jmt-drop-zone.drag-over { border-color: #3b6cf4; background: #eef3ff; }
  .jmt-imp-status { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; margin-top: 12px; font-size: 13px; }
  .jmt-imp-status.ok  { background: #f0fdf4; color: #15803d; border: 1px solid #86efac; }
  .jmt-imp-status.err { background: #fff5f5; color: #991b1b; border: 1px solid #fca5a5; }
  .jmt-imp-preview { margin-top: 14px; border: 1.5px solid #e8e5e0; border-radius: 8px; overflow: hidden; max-height: 220px; overflow-y: auto; }
  .jmt-imp-preview table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: auto; }
  .jmt-imp-preview thead th { padding: 7px 10px; background: #faf9f7; border-bottom: 1px solid #e8e5e0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #7a7570; white-space: nowrap; }
  .jmt-imp-preview tbody td { padding: 6px 10px; border-bottom: 1px solid #e8e5e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
  .jmt-imp-preview tbody tr:last-child td { border-bottom: none; }

  /* Print */
  @media print { .jmt-header-right, .jmt-filters button, .jmt-icon-btn { display: none !important; } }
`;

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const isOverdue = (iso, rag) =>
  rag !== "Blue" && new Date(iso + "T00:00:00") < new Date(new Date().toISOString().split("T")[0] + "T00:00:00");

const exportCSV = (rows) => {
  const headers = ["Project", "Phase", "Workstream", "Milestone", "Target Date", "RAG", "Commentary"];
  const lines = rows.map((r) =>
    [r.projectName, r.phase || "", r.workstream || "", r.milestoneTitle, r.targetDate, r.ragStatus, r.commentary].map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "milestones.csv";
  a.click();
  URL.revokeObjectURL(url);
};

// ─── RAG Pill component ───────────────────────────────────────────────────────
const RagPill = ({ value, onChange, canEdit }) => {
  const [open, setOpen] = useState(false);
  const cfg = RAG_CONFIG[value] || RAG_CONFIG.Green;
  const handleClick = (e) => {
    e.stopPropagation();
    if (canEdit) setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="jmt-rag-wrap">
      <div
        className="jmt-rag-pill"
        style={{ background: cfg.bg, color: cfg.fg }}
        onClick={handleClick}
        title={canEdit ? "Click to change RAG" : undefined}
      >
        <div className="jmt-rag-dot" style={{ background: cfg.dot }} />
        {value}
        {canEdit && <span style={{ opacity: 0.5, fontSize: 10, marginLeft: 2 }}>▾</span>}
      </div>
      {canEdit && (
        <div className={`jmt-rag-menu${open ? " open" : ""}`} onClick={(e) => e.stopPropagation()}>
          {RAG_ORDER.map((r) => {
            const c = RAG_CONFIG[r];
            return (
              <div
                key={r}
                className="jmt-rag-opt"
                onClick={() => { onChange(r); setOpen(false); }}
              >
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.dot }} />
                <span style={{ color: c.fg }}>{r}</span>
                <span style={{ color: "#9ca3af", fontSize: 11, marginLeft: "auto" }}>{c.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tooltip = ({ data, pos }) => {
  if (!data) return null;
  const cfg = RAG_CONFIG[data.ragStatus] || RAG_CONFIG.Green;
  const od = isOverdue(data.targetDate, data.ragStatus);
  return (
    <div className="jmt-tooltip" style={{ left: pos.x + 12, top: pos.y - 10 }}>
      <div className="jmt-tooltip-title">{data.milestoneTitle}</div>
      {[
        ["Project", data.projectName],
        ["Phase", data.phase || "—"],
        ["Workstream", data.workstream || "—"],
        ["Date", fmt(data.targetDate) + (od ? " ⚠" : "")],
        ["RAG", data.ragStatus],
        ["Notes", data.commentary || "—"],
      ].map(([k, v]) => (
        <div className="jmt-tooltip-row" key={k}>
          <span className="jmt-tooltip-key">{k}</span>
          <span className="jmt-tooltip-val" style={k === "RAG" ? { color: cfg.dot, fontWeight: 700 } : undefined}>{v}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Timeline generator ───────────────────────────────────────────────────────
const buildTimelinePeriods = (granularity, milestones) => {
  if (!milestones.length) return [];
  const dates = milestones.map((m) => new Date(m.targetDate + "T00:00:00").getTime());
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const allMs = [...dates, todayMs];
  const minMs = Math.min(...allMs);
  const maxMs = Math.max(...allMs);
  const pad = { Daily: 2, Weekly: 7, Monthly: 30, Yearly: 90 };
  const padMs = pad[granularity] * 86400000;
  const startMs = minMs - padMs;
  const endMs = maxMs + padMs;

  const periods = [];
  const cursor = new Date(startMs);
  cursor.setHours(0, 0, 0, 0);

  if (granularity === "Daily") {
    while (cursor.getTime() <= endMs) {
      periods.push({ key: cursor.toISOString().split("T")[0], label: cursor.getDate() === 1 ? cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : String(cursor.getDate()), startMs: cursor.getTime(), endMs: cursor.getTime() + 86400000 - 1, isToday: cursor.toISOString().split("T")[0] === new Date().toISOString().split("T")[0] });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (granularity === "Weekly") {
    const dow = cursor.getDay(); cursor.setDate(cursor.getDate() - dow + (dow === 0 ? -6 : 1));
    while (cursor.getTime() <= endMs) {
      const end = new Date(cursor); end.setDate(end.getDate() + 6);
      const wk = cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      periods.push({ key: cursor.toISOString().split("T")[0], label: wk, startMs: cursor.getTime(), endMs: end.getTime(), isToday: false });
      cursor.setDate(cursor.getDate() + 7);
    }
    const todayPeriod = periods.find((p) => todayMs >= p.startMs && todayMs <= p.endMs);
    if (todayPeriod) todayPeriod.isToday = true;
  } else if (granularity === "Monthly") {
    cursor.setDate(1);
    while (cursor.getTime() <= endMs) {
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const label = cursor.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      periods.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, label, startMs: cursor.getTime(), endMs: end.getTime(), isToday: false });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const todayPeriod = periods.find((p) => todayMs >= p.startMs && todayMs <= p.endMs);
    if (todayPeriod) todayPeriod.isToday = true;
  } else {
    cursor.setMonth(0); cursor.setDate(1);
    while (cursor.getTime() <= endMs) {
      const end = new Date(cursor.getFullYear(), 11, 31);
      periods.push({ key: String(cursor.getFullYear()), label: String(cursor.getFullYear()), startMs: cursor.getTime(), endMs: end.getTime(), isToday: false });
      cursor.setFullYear(cursor.getFullYear() + 1);
    }
    const todayPeriod = periods.find((p) => todayMs >= p.startMs && todayMs <= p.endMs);
    if (todayPeriod) todayPeriod.isToday = true;
  }
  return periods;
};

const COL_WIDTH = { Daily: 28, Weekly: 70, Monthly: 90, Yearly: 140 };
// Height of each stacked marker row within a swimlane
const ROW_H = 44;
const LANE_V_PAD = 8; // top + bottom padding inside each lane

// ─── Assign vertical slot indices to milestones so same-period ones stack ─────
// Returns Map<milestoneId, slotIndex>
const assignSlots = (items, periods) => {
  // bucket milestones by period key
  const buckets = {};
  items.forEach((m) => {
    const ms = new Date(m.targetDate + "T00:00:00").getTime();
    const p = periods.find((p) => ms >= p.startMs && ms <= p.endMs);
    const key = p ? p.key : "__oob__";
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(m.id);
  });
  const slots = {};
  Object.values(buckets).forEach((ids) => {
    ids.forEach((id, i) => { slots[id] = i; });
  });
  return slots;
};

// ─── Timeline View ────────────────────────────────────────────────────────────
const TimelineView = ({ milestones, granularity, setGranularity, groupBy, setGroupBy, role }) => {
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const periods = useMemo(() => buildTimelinePeriods(granularity, milestones), [granularity, milestones]);
  const colW = COL_WIDTH[granularity];
  const totalW = periods.length * colW;

  const todayMs = new Date().setHours(0, 0, 0, 0);

  const getLeftPx = (dateStr) => {
    const ms = new Date(dateStr + "T00:00:00").getTime();
    const periIdx = periods.findIndex((p) => ms >= p.startMs && ms <= p.endMs);
    if (periIdx === -1) return null;
    const p = periods[periIdx];
    const frac = (ms - p.startMs) / (p.endMs - p.startMs + 1);
    return (periIdx + frac) * colW;
  };

  const todayPx = (() => {
    const periIdx = periods.findIndex((p) => todayMs >= p.startMs && todayMs <= p.endMs);
    if (periIdx === -1) return null;
    const p = periods[periIdx];
    const frac = (todayMs - p.startMs) / (p.endMs - p.startMs + 1);
    return (periIdx + frac) * colW;
  })();

  const groups = useMemo(() => {
    if (groupBy === "None") return [{ key: "All Milestones", items: milestones }];
    const map = {};
    milestones.forEach((m) => {
      const k = (groupBy === "Project" ? m.projectName : groupBy === "Phase" ? (m.phase || "No Phase") : (m.workstream || "No Workstream")) || "Other";
      if (!map[k]) map[k] = [];
      map[k].push(m);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => ({ key, items }));
  }, [milestones, groupBy]);

  const groupColor = (groupKey) => {
    const colors = ["#7c3aed", "#3b6cf4", "#db2777", "#d97706", "#dc2626", "#059669", "#4f46e5", "#0891b2"];
    let h = 0;
    for (let i = 0; i < groupKey.length; i++) h = (h * 31 + groupKey.charCodeAt(i)) & 0xfffffff;
    return colors[h % colors.length];
  };

  return (
    <div className="jmt-timeline-container">
      {/* Controls */}
      <div className="jmt-tl-controls">
        <span className="jmt-tl-ctrl-label">Granularity</span>
        <div className="jmt-tl-toggle">
          {["Daily", "Weekly", "Monthly", "Yearly"].map((g) => (
            <button key={g} className={`jmt-tl-btn${granularity === g ? " active" : ""}`} onClick={() => setGranularity(g)}>{g}</button>
          ))}
        </div>
        <div className="jmt-tl-sep" />
        <span className="jmt-tl-ctrl-label">Group By</span>
        <div className="jmt-tl-toggle">
          {["Project", "Phase", "Workstream", "None"].map((g) => (
            <button key={g} className={`jmt-tl-btn${groupBy === g ? " active" : ""}`} onClick={() => setGroupBy(g)}>{g}</button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
          {milestones.length} milestone{milestones.length !== 1 ? "s" : ""} · hover for details
        </span>
      </div>

      {/* Scrollable timeline */}
      <div className="jmt-tl-scroll">
        <div className="jmt-tl-inner" style={{ minWidth: 200 + totalW + 24 }}>
          {/* Header row */}
          <div className="jmt-tl-header-row">
            <div className="jmt-tl-label-col">{groupBy === "None" ? "Timeline" : groupBy}</div>
            <div className="jmt-tl-cells" style={{ width: totalW }}>
              {periods.map((p) => (
                <div key={p.key} className={`jmt-tl-cell-head${p.isToday ? " today-col" : ""}`} style={{ width: colW }}>
                  {p.label}
                </div>
              ))}
            </div>
          </div>

          {/* Swimlanes — height driven by how many stacked rows each needs */}
          {groups.map((group) => {
            // Compute slot assignments for this group's items
            const slots = assignSlots(group.items, periods);
            const maxSlot = group.items.reduce((mx, m) => Math.max(mx, slots[m.id] ?? 0), 0);
            const numRows = maxSlot + 1;
            const laneH = numRows * ROW_H + LANE_V_PAD * 2;

            return (
              <div key={group.key} className="jmt-tl-swimlane" style={{ minHeight: laneH }}>
                {/* Sticky label column */}
                <div className="jmt-tl-lane-label" style={{ minHeight: laneH }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div className="jmt-tl-lane-dot" style={{ background: groupColor(group.key) }} />
                      <span className="jmt-tl-lane-name" title={group.key}>{group.key}</span>
                    </div>
                    <span className="jmt-tl-lane-count" style={{ marginTop: 4, display: "inline-block" }}>{group.items.length}</span>
                  </div>
                </div>

                {/* Track area — explicit height so stripes fill correctly */}
                <div className="jmt-tl-lane-track" style={{ position: "relative", width: totalW, height: laneH }}>
                  {/* Column bg stripes */}
                  {periods.map((p, pi) => (
                    <div
                      key={p.key}
                      className={`jmt-tl-col${p.isToday ? " today-col" : ""}`}
                      style={{ position: "absolute", left: pi * colW, width: colW, top: 0, bottom: 0 }}
                    />
                  ))}

                  {/* Today vertical line scoped to this lane */}
                  {todayPx !== null && (
                    <div style={{
                      position: "absolute", left: todayPx, top: 0, bottom: 0,
                      width: 2, background: "rgba(59,108,244,.25)", zIndex: 4, pointerEvents: "none",
                    }} />
                  )}

                  {/* Stacked milestone markers */}
                  {group.items.map((m) => {
                    const leftPx = getLeftPx(m.targetDate);
                    if (leftPx === null) return null;
                    const slot = slots[m.id] ?? 0;
                    const topPx = LANE_V_PAD + slot * ROW_H + ROW_H / 2;
                    const cfg = RAG_CONFIG[m.ragStatus] || RAG_CONFIG.Green;
                    const od = isOverdue(m.targetDate, m.ragStatus);
                    return (
                      <div
                        key={m.id}
                        className="jmt-tl-marker"
                        style={{ position: "absolute", left: leftPx, top: topPx, transform: "translate(-50%, -50%)" }}
                        onMouseMove={(e) => { setTooltip(m); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <div
                          className="jmt-tl-marker-dot"
                          style={{ background: cfg.dot, boxShadow: `0 0 0 2.5px ${cfg.bg}, 0 2px 6px rgba(0,0,0,.18)` }}
                        />
                        <div className="jmt-tl-marker-label" style={{ color: od ? "#dc2626" : "#1a1917" }}>
                          {m.milestoneTitle.slice(0, 18)}{m.milestoneTitle.length > 18 ? "…" : ""}
                          {od && <span className="jmt-tl-overdue-icon">⚠</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Global today label at top of inner container */}
          {todayPx !== null && (
            <div style={{
              position: "absolute", left: 200 + todayPx, top: 0,
              pointerEvents: "none", zIndex: 6,
            }}>
              <div className="jmt-tl-today-flag">Today</div>
            </div>
          )}

          {groups.length === 0 && (
            <div className="jmt-empty"><div className="jmt-empty-icon">📅</div><p>No milestones match current filters</p></div>
          )}
        </div>
      </div>

      <Tooltip data={tooltip} pos={tooltipPos} />
    </div>
  );
};

// ─── Table View ───────────────────────────────────────────────────────────────
const TableView = ({ milestones, sortKey, setSortKey, sortDir, setSortDir, onUpdateMilestone, onDeleteMilestone, role }) => {
  const [editingComment, setEditingComment] = useState(null);
  const [editingDate, setEditingDate] = useState(null);
  const [commentVal, setCommentVal] = useState("");
  const [dateVal, setDateVal] = useState("");

  const canEditRAG = ["Contributor", "Project Manager", "Admin"].includes(role);
  const canEditComment = ["Contributor", "Project Manager", "Admin"].includes(role);
  const canEditDate = ["Project Manager", "Admin"].includes(role);
  const canDelete = role === "Admin";

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }) => (
    <span className="sort-icon">
      {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const startCommentEdit = (m) => {
    if (!canEditComment) return;
    setEditingComment(m.id);
    setCommentVal(m.commentary);
  };
  const saveComment = (m) => {
    onUpdateMilestone(m.id, { commentary: commentVal });
    setEditingComment(null);
  };
  const startDateEdit = (m) => {
    if (!canEditDate) return;
    setEditingDate(m.id);
    setDateVal(m.targetDate);
  };
  const saveDate = (m) => {
    onUpdateMilestone(m.id, { targetDate: dateVal });
    setEditingDate(null);
  };

  return (
    <div className="jmt-table-wrap">
      <div className="jmt-table-scroll">
        <table className="jmt-table">
          <colgroup>
            <col className="c-project" />
            <col className="c-phase" />
            <col className="c-ws" />
            <col className="c-ms" />
            <col className="c-date" />
            <col className="c-rag" />
            <col className="c-comment" />
            {canDelete && <col className="c-act" />}
          </colgroup>
          <thead>
            <tr>
              <th className={sortKey === "projectName" ? "sort-active" : ""} onClick={() => handleSort("projectName")}>Project<SortIcon k="projectName" /></th>
              <th>Phase</th>
              <th>Workstream</th>
              <th>Milestone</th>
              <th className={sortKey === "targetDate" ? "sort-active" : ""} onClick={() => handleSort("targetDate")}>Date<SortIcon k="targetDate" /></th>
              <th className={sortKey === "ragStatus" ? "sort-active" : ""} onClick={() => handleSort("ragStatus")}>RAG<SortIcon k="ragStatus" /></th>
              <th>Commentary</th>
              {canDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {milestones.length === 0 && (
              <tr><td colSpan={canDelete ? 8 : 7}><div className="jmt-empty"><div className="jmt-empty-icon">🔍</div><p>No milestones match the current filters</p></div></td></tr>
            )}
            {milestones.map((m) => {
              const od = isOverdue(m.targetDate, m.ragStatus);
              return (
                <tr key={m.id} className={od ? "overdue" : ""}>
                  <td><span className="jmt-project-link">{m.projectName}</span></td>
                  <td style={{ color: "#7a7570", fontSize: 12.5 }}>{m.phase || "—"}</td>
                  <td style={{ color: "#7a7570", fontSize: 12.5 }}>{m.workstream || "—"}</td>
                  <td>
                    <span className={`jmt-ms-title${od ? " jmt-ms-overdue" : ""}`}>{m.milestoneTitle}</span>
                    {od && <span className="jmt-overdue-icon" title="Overdue">⚠️</span>}
                  </td>
                  <td>
                    {editingDate === m.id ? (
                      <input
                        type="date"
                        className="jmt-date-edit"
                        value={dateVal}
                        onChange={(e) => setDateVal(e.target.value)}
                        onBlur={() => saveDate(m)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveDate(m); if (e.key === "Escape") setEditingDate(null); }}
                        autoFocus
                      />
                    ) : (
                      <span
                        style={{ fontSize: 12.5, color: od ? "#dc2626" : "#7a7570", cursor: canEditDate ? "pointer" : "default" }}
                        onClick={() => startDateEdit(m)}
                        title={canEditDate ? "Click to edit date" : undefined}
                      >
                        {fmt(m.targetDate)}
                      </span>
                    )}
                  </td>
                  <td>
                    <RagPill
                      value={m.ragStatus}
                      canEdit={canEditRAG}
                      onChange={(v) => onUpdateMilestone(m.id, { ragStatus: v })}
                    />
                  </td>
                  <td>
                    {editingComment === m.id ? (
                      <textarea
                        className="jmt-comment-edit"
                        value={commentVal}
                        maxLength={200}
                        rows={2}
                        onChange={(e) => setCommentVal(e.target.value)}
                        onBlur={() => saveComment(m)}
                        onKeyDown={(e) => { if (e.key === "Escape") setEditingComment(null); }}
                        autoFocus
                      />
                    ) : (
                      <div className="jmt-comment-cell">
                        <span
                          className="jmt-comment-text"
                          title={m.commentary || "Click to add commentary"}
                          onClick={() => startCommentEdit(m)}
                          style={{ cursor: canEditComment ? "text" : "default" }}
                        >
                          {m.commentary || (canEditComment ? <em style={{ opacity: 0.4 }}>Add note…</em> : "—")}
                        </span>
                      </div>
                    )}
                  </td>
                  {canDelete && (
                    <td>
                      <div className="jmt-icon-btn" title="Delete" onClick={() => onDeleteMilestone(m.id)}>🗑</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// ─── CSV / Excel parser helpers ──────────────────────────────────────────────
const parseCSVRow2 = (line) => {
  const result = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur); return result.map(c => c.trim());
};

const HEADER_MAP = {
  "project": "projectName", "project name": "projectName",
  "phase": "phase",
  "workstream": "workstream", "work stream": "workstream",
  "milestone": "milestoneTitle", "milestone title": "milestoneTitle", "name": "milestoneTitle", "title": "milestoneTitle",
  "target date": "targetDate", "date": "targetDate", "due date": "targetDate", "planned date": "targetDate",
  "rag": "ragStatus", "rag status": "ragStatus", "status": "ragStatus",
  "commentary": "commentary", "comment": "commentary", "notes": "commentary",
};
const normaliseHeader = (h) => HEADER_MAP[h.toLowerCase().trim()] || null;
const normaliseRAG = (v) => {
  const m = { "green": "Green", "on track": "Green", "amber": "Amber", "at risk": "Amber",
    "red": "Red", "delayed": "Red", "issue": "Red", "blue": "Blue", "delivered": "Blue", "complete": "Blue" };
  return m[(v || "").toLowerCase().trim()] || "Green";
};
const normaliseDate = (v) => {
  if (!v) return new Date().toISOString().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const dt = new Date(v); return isNaN(dt) ? new Date().toISOString().split("T")[0] : dt.toISOString().split("T")[0];
};
const parseImportCSV = (text) => {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["File appears empty"] };
  const headers = parseCSVRow2(lines[0]).map(normaliseHeader);
  const errors = []; const rows = [];
  lines.slice(1).forEach((line, i) => {
    const cells = parseCSVRow2(line);
    const obj = {};
    headers.forEach((h, hi) => { if (h) obj[h] = cells[hi] || ""; });
    if (!obj.projectName && !obj.milestoneTitle) { errors.push(`Row ${i + 2}: skipped`); return; }
    rows.push({
      id: `imp-${Date.now()}-${i}`,
      projectId: `p-${(obj.projectName || "").replace(/\s+/g, "-").toLowerCase()}`,
      projectName: obj.projectName || "Unknown Project",
      phase: obj.phase || null,
      workstream: obj.workstream || null,
      milestoneTitle: obj.milestoneTitle || "(untitled)",
      targetDate: normaliseDate(obj.targetDate),
      ragStatus: normaliseRAG(obj.ragStatus),
      commentary: (obj.commentary || "").slice(0, 200),
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
    });
  });
  return { rows, errors };
};

// ─── Import Modal ─────────────────────────────────────────────────────────────
const ImportModal = ({ open, onClose, onImport }) => {
  const [tab, setTab] = useState("upload");
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState([]);
  const [status, setStatus] = useState(null);
  const fileRef = useRef();

  useEffect(() => { if (!open) { setParsed([]); setStatus(null); setTab("upload"); } }, [open]);

  const processText = (text) => {
    const { rows, errors } = parseImportCSV(text);
    setParsed(rows);
    if (!rows.length) { setStatus({ type: "err", msg: `No valid rows found. ${errors[0] || ""}` }); return; }
    setStatus({ type: "ok", msg: `✓ ${rows.length} milestone${rows.length > 1 ? "s" : ""} ready${errors.length ? ` (${errors.length} skipped)` : ""}` });
  };

  const handleFile = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      setStatus({ type: "err", msg: "Please upload a .csv, .xls or .xlsx file" }); return;
    }
    if (name.endsWith(".csv")) {
      const reader = new FileReader(); reader.onload = (e) => processText(e.target.result); reader.readAsText(file);
    } else if (window.XLSX) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = window.XLSX.read(e.target.result, { type: "binary" });
        processText(window.XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));
      };
      reader.readAsBinaryString(file);
    } else {
      setStatus({ type: "err", msg: "Excel import: please export as CSV from your tool, then re-upload." });
    }
  };

  const downloadTemplate = () => {
    const h = "Project,Phase,Workstream,Milestone,Target Date,RAG,Commentary";
    const ex = '"SAP Finance","Build","Technical","Core Module Build Complete","2026-04-15","Amber","Finance GL 90% done."';
    const blob = new Blob([h + "\n" + ex], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
    a.download = "milestones-template.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className={`jmt-overlay${open ? " open" : ""}`} onClick={(e) => e.target.classList.contains("jmt-overlay") && onClose()}>
      <div className="jmt-modal" style={{ maxWidth: 640 }}>
        <div className="jmt-modal-head">
          <h2>⬆ Import Milestones</h2>
          <button className="jmt-mclose" onClick={onClose}>✕</button>
        </div>
        <div className="jmt-modal-body">
          <div className="jmt-imp-tabs">
            <div className={`jmt-imp-tab${tab === "upload" ? " active" : ""}`} onClick={() => setTab("upload")}>📂 Upload File</div>
            <div className={`jmt-imp-tab${tab === "template" ? " active" : ""}`} onClick={() => setTab("template")}>📋 Template</div>
          </div>

          {tab === "upload" && (
            <div>
              <div
                className={`jmt-drop-zone${dragOver ? " drag-over" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Drop your file here, or click to browse</div>
                <div style={{ fontSize: 12.5, color: "#7a7570" }}>CSV · XLS · XLSX</div>
                <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>
              {status && <div className={`jmt-imp-status ${status.type}`}>{status.msg}</div>}
              {parsed.length > 0 && (
                <div className="jmt-imp-preview">
                  <table>
                    <thead><tr><th>Project</th><th>Phase</th><th>Milestone</th><th>Date</th><th>RAG</th></tr></thead>
                    <tbody>
                      {parsed.slice(0, 7).map((r) => (
                        <tr key={r.id}>
                          <td title={r.projectName}>{r.projectName.length > 18 ? r.projectName.slice(0,16)+"…" : r.projectName}</td>
                          <td>{r.phase || "—"}</td>
                          <td title={r.milestoneTitle}>{r.milestoneTitle.length > 26 ? r.milestoneTitle.slice(0,24)+"…" : r.milestoneTitle}</td>
                          <td style={{ whiteSpace:"nowrap" }}>{fmt(r.targetDate)}</td>
                          <td>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontWeight:700, fontSize:11, color:RAG_CONFIG[r.ragStatus]?.fg }}>
                              <span style={{ width:7, height:7, borderRadius:"50%", background:RAG_CONFIG[r.ragStatus]?.dot, display:"inline-block" }} />
                              {r.ragStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {parsed.length > 7 && <tr><td colSpan={5} style={{ textAlign:"center", color:"#b0aa9f", padding:"8px", fontStyle:"italic" }}>…and {parsed.length - 7} more</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "template" && (
            <div>
              <div style={{ background:"#faf9f7", border:"1.5px solid #e8e5e0", borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>📋 Import Template</div>
                <p style={{ fontSize:13, color:"#7a7570", lineHeight:1.6, marginBottom:14 }}>
                  Download the template, fill in one milestone per row, and upload. Compatible with CSV exports from MS Project, Smartsheet, Monday.com, Excel or any PM tool.
                </p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
                  {[["Project ✱","req"],["Phase","opt"],["Workstream","opt"],["Milestone ✱","req"],["Target Date ✱","req"],["RAG","opt"],["Commentary","opt"]].map(([f,t])=>(
                    <span key={f} style={{ padding:"3px 10px", background:t==="req"?"#eef3ff":"#fff", border:`1.5px solid ${t==="req"?"#3b6cf4":"#e8e5e0"}`, borderRadius:20, fontSize:12, fontWeight:600, color:t==="req"?"#3b6cf4":"#7a7570" }}>{f}</span>
                  ))}
                </div>
                <button className="jmt-btn jmt-btn-primary" onClick={downloadTemplate}>⬇ Download CSV Template</button>
              </div>
              <div style={{ fontSize:13, color:"#7a7570", lineHeight:1.75 }}>
                <strong style={{ color:"#1a1917" }}>Field guidance:</strong><br />
                • <strong>RAG</strong> — Green / Amber / Red / Blue <em>(or On Track / At Risk / Delayed / Delivered)</em><br />
                • <strong>Target Date</strong> — yyyy-mm-dd, dd/mm/yyyy accepted<br />
                • <strong>Column order doesn't matter</strong> — headers are auto-detected<br />
                • New projects are created automatically on import
              </div>
            </div>
          )}
        </div>
        <div className="jmt-modal-foot">
          <button className="jmt-btn" onClick={onClose}>Cancel</button>
          {parsed.length > 0 && (
            <button className="jmt-btn jmt-btn-primary" onClick={() => { onImport(parsed); onClose(); }}>
              ＋ Add {parsed.length} Milestone{parsed.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Add Milestone Modal ──────────────────────────────────────────────────────
const AddModal = ({ open, onClose, onSave, projects, phases, workstreams }) => {
  const blank = { projectName: projects[0] || "", phase: "", workstream: "", milestoneTitle: "", targetDate: new Date().toISOString().split("T")[0], ragStatus: "Green", commentary: "" };
  const [form, setForm] = useState(blank);
  useEffect(() => { if (open) setForm(blank); }, [open]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () => {
    if (!form.milestoneTitle.trim() || !form.targetDate) return;
    onSave({
      ...form,
      id: `m${Date.now()}`,
      projectId: `p-${form.projectName.replace(/\s+/g, "-").toLowerCase()}`,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
    });
    onClose();
  };

  return (
    <div className={`jmt-overlay${open ? " open" : ""}`} onClick={(e) => e.target.classList.contains("jmt-overlay") && onClose()}>
      <div className="jmt-modal">
        <div className="jmt-modal-head">
          <h2>Add Milestone</h2>
          <button className="jmt-mclose" onClick={onClose}>✕</button>
        </div>
        <div className="jmt-modal-body">
          <div className="jmt-mgrid">
            <div className="jmt-mfield full">
              <span className="jmt-mlabel">Milestone Title ✱</span>
              <input className="jmt-minput" value={form.milestoneTitle} onChange={set("milestoneTitle")} placeholder="e.g. UAT Sign-off" />
            </div>
            <div className="jmt-mfield">
              <span className="jmt-mlabel">Project ✱</span>
              <input className="jmt-minput" list="project-list" value={form.projectName} onChange={set("projectName")} placeholder="Project name" />
              <datalist id="project-list">{projects.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="jmt-mfield">
              <span className="jmt-mlabel">Target Date ✱</span>
              <input type="date" className="jmt-minput" value={form.targetDate} onChange={set("targetDate")} />
            </div>
            <div className="jmt-mfield">
              <span className="jmt-mlabel">Phase</span>
              <input className="jmt-minput" list="phase-list" value={form.phase} onChange={set("phase")} placeholder="e.g. Build" />
              <datalist id="phase-list">{phases.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="jmt-mfield">
              <span className="jmt-mlabel">Workstream</span>
              <input className="jmt-minput" list="ws-list" value={form.workstream} onChange={set("workstream")} placeholder="e.g. Technical" />
              <datalist id="ws-list">{workstreams.map((w) => <option key={w} value={w} />)}</datalist>
            </div>
            <div className="jmt-mfield">
              <span className="jmt-mlabel">RAG Status</span>
              <select className="jmt-msel" value={form.ragStatus} onChange={set("ragStatus")}>
                {RAG_ORDER.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="jmt-mfield full">
              <span className="jmt-mlabel">Commentary</span>
              <textarea className="jmt-mtextarea" value={form.commentary} onChange={set("commentary")} placeholder="Brief status update (max 200 chars)" maxLength={200} />
            </div>
          </div>
        </div>
        <div className="jmt-modal-foot">
          <button className="jmt-btn" onClick={onClose}>Cancel</button>
          <button className="jmt-btn jmt-btn-primary" onClick={save}>Save Milestone</button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MilestoneTracker() {
  useEffect(() => {
    injectFonts();
    const style = document.createElement("style");
    style.id = "jmt-styles";
    if (!document.getElementById("jmt-styles")) document.head.appendChild(style);
    style.textContent = STYLES;
    return () => style.remove();
  }, []);

  const [view, setView] = useState("table");
  const [milestones, setMilestones] = useState(MOCK_MILESTONES);
  const [role, setRole] = useState("Project Manager");
  const [sortKey, setSortKey] = useState("targetDate");
  const [sortDir, setSortDir] = useState("asc");
  const [granularity, setGranularity] = useState("Monthly");
  const [groupBy, setGroupBy] = useState("Project");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters
  const [fProject, setFProject] = useState("");
  const [fPhase, setFPhase] = useState("");
  const [fWS, setFWS] = useState("");
  const [fRAG, setFRAG] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [activeKpi, setActiveKpi] = useState(null);

  const projects = useMemo(() => [...new Set(milestones.map((m) => m.projectName))].sort(), [milestones]);
  const phases = useMemo(() => [...new Set(milestones.map((m) => m.phase).filter(Boolean))].sort(), [milestones]);
  const workstreams = useMemo(() => [...new Set(milestones.map((m) => m.workstream).filter(Boolean))].sort(), [milestones]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const onUpdateMilestone = useCallback((id, patch) => {
    setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString().split("T")[0] } : m)));
    showToast("✓ Milestone updated");
  }, [showToast]);

  const onDeleteMilestone = useCallback((id) => {
    if (!window.confirm("Delete this milestone?")) return;
    setMilestones((ms) => ms.filter((m) => m.id !== id));
    showToast("Milestone deleted");
  }, [showToast]);

  const onAddMilestone = useCallback((m) => {
    setMilestones((ms) => [...ms, m]);
    showToast("✓ Milestone added");
  }, [showToast]);

  const onImportMilestones = useCallback((rows) => {
    setMilestones((ms) => [...ms, ...rows]);
    showToast(`✓ ${rows.length} milestone${rows.length > 1 ? "s" : ""} imported`);
  }, [showToast]);

  // KPI counts
  const kpis = useMemo(() => ({
    total: milestones.length,
    green: milestones.filter((m) => m.ragStatus === "Green").length,
    amber: milestones.filter((m) => m.ragStatus === "Amber").length,
    red: milestones.filter((m) => m.ragStatus === "Red").length,
    blue: milestones.filter((m) => m.ragStatus === "Blue").length,
    overdue: milestones.filter((m) => isOverdue(m.targetDate, m.ragStatus)).length,
  }), [milestones]);

  const kpiDefs = [
    { key: "total", label: "Total", color: "#3b6cf4", filter: null },
    { key: "green", label: "On Track", color: "#22c55e", filter: "Green" },
    { key: "amber", label: "At Risk", color: "#f59e0b", filter: "Amber" },
    { key: "red", label: "Delayed", color: "#ef4444", filter: "Red" },
    { key: "blue", label: "Delivered", color: "#3b82f6", filter: "Blue" },
    { key: "overdue", label: "Overdue", color: "#dc2626", filter: "__overdue__" },
  ];

  // Filtered + sorted milestones
  const filtered = useMemo(() => {
    let ms = milestones;
    if (fProject) ms = ms.filter((m) => m.projectName === fProject);
    if (fPhase) ms = ms.filter((m) => m.phase === fPhase);
    if (fWS) ms = ms.filter((m) => m.workstream === fWS);
    if (fRAG) ms = ms.filter((m) => m.ragStatus === fRAG);
    if (fDateFrom) ms = ms.filter((m) => m.targetDate >= fDateFrom);
    if (fDateTo) ms = ms.filter((m) => m.targetDate <= fDateTo);
    if (activeKpi) {
      const def = kpiDefs.find((k) => k.key === activeKpi);
      if (def?.filter === "__overdue__") ms = ms.filter((m) => isOverdue(m.targetDate, m.ragStatus));
      else if (def?.filter) ms = ms.filter((m) => m.ragStatus === def.filter);
    }
    // Sort
    return [...ms].sort((a, b) => {
      let va = a[sortKey] || "";
      let vb = b[sortKey] || "";
      if (sortKey === "ragStatus") {
        const order = { Red: 0, Amber: 1, Green: 2, Blue: 3 };
        va = order[va] ?? 9;
        vb = order[vb] ?? 9;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [milestones, fProject, fPhase, fWS, fRAG, fDateFrom, fDateTo, activeKpi, sortKey, sortDir]);

  const activeFilters = [
    fProject && { label: `Project: ${fProject}`, clear: () => setFProject("") },
    fPhase && { label: `Phase: ${fPhase}`, clear: () => setFPhase("") },
    fWS && { label: `WS: ${fWS}`, clear: () => setFWS("") },
    fRAG && { label: `RAG: ${fRAG}`, clear: () => setFRAG("") },
    fDateFrom && { label: `From: ${fmt(fDateFrom)}`, clear: () => setFDateFrom("") },
    fDateTo && { label: `To: ${fmt(fDateTo)}`, clear: () => setFDateTo("") },
    activeKpi && { label: `KPI: ${kpiDefs.find((k) => k.key === activeKpi)?.label}`, clear: () => setActiveKpi(null) },
  ].filter(Boolean);

  return (
    <div className="jmt">
      {/* Header */}
      <div className="jmt-header">
        <div className="jmt-header-left">
          <h1>Milestone Tracker</h1>
          <p>Programme-level milestone visibility · {filtered.length} of {milestones.length} milestones</p>
        </div>
        <div className="jmt-header-right">
          <select className="jmt-role-sel" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button className="jmt-btn" onClick={() => setShowImportModal(true)}>⬆ Import</button>
          <button className="jmt-btn" onClick={() => exportCSV(filtered)}>⬇ Export CSV</button>
          {["Project Manager", "Admin"].includes(role) && (
            <button className="jmt-btn jmt-btn-primary" onClick={() => setShowAddModal(true)}>＋ Add Milestone</button>
          )}
          <div className="jmt-view-toggle">
            <button className={`jmt-vt-btn${view === "table" ? " active" : ""}`} onClick={() => setView("table")}>☰ Table</button>
            <button className={`jmt-vt-btn${view === "timeline" ? " active" : ""}`} onClick={() => setView("timeline")}>◈ Timeline</button>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="jmt-kpi-bar">
        {kpiDefs.map((k) => (
          <div
            key={k.key}
            className={`jmt-kpi${activeKpi === k.key ? " active" : ""}`}
            style={{ "--kc": k.color }}
            onClick={() => setActiveKpi(activeKpi === k.key ? null : k.key)}
          >
            <div className="jmt-kpi-label">{k.label}</div>
            <div className="jmt-kpi-val">{kpis[k.key]}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="jmt-filters">
        <select className="jmt-fsel" value={fProject} onChange={(e) => setFProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="jmt-fsel" value={fPhase} onChange={(e) => setFPhase(e.target.value)}>
          <option value="">All Phases</option>
          {phases.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="jmt-fsel" value={fWS} onChange={(e) => setFWS(e.target.value)}>
          <option value="">All Workstreams</option>
          {workstreams.map((w) => <option key={w}>{w}</option>)}
        </select>
        <select className="jmt-fsel" value={fRAG} onChange={(e) => setFRAG(e.target.value)}>
          <option value="">All RAG</option>
          {RAG_ORDER.map((r) => <option key={r}>{r}</option>)}
        </select>
        <div className="jmt-fsep" />
        <input type="date" className="jmt-finput" style={{ fontSize: 12 }} value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} title="From date" />
        <span style={{ fontSize: 12, color: "#b0aa9f" }}>→</span>
        <input type="date" className="jmt-finput" style={{ fontSize: 12 }} value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} title="To date" />
        {activeFilters.length > 0 && (
          <>
            <div className="jmt-fsep" />
            {activeFilters.map((f, i) => (
              <div key={i} className="jmt-pill" onClick={f.clear}>{f.label} <span>✕</span></div>
            ))}
            <button className="jmt-btn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => { setFProject(""); setFPhase(""); setFWS(""); setFRAG(""); setFDateFrom(""); setFDateTo(""); setActiveKpi(null); }}>Clear all</button>
          </>
        )}
      </div>

      {/* Views */}
      {view === "table" ? (
        <TableView
          milestones={filtered}
          sortKey={sortKey} setSortKey={setSortKey}
          sortDir={sortDir} setSortDir={setSortDir}
          onUpdateMilestone={onUpdateMilestone}
          onDeleteMilestone={onDeleteMilestone}
          role={role}
        />
      ) : (
        <TimelineView
          milestones={filtered}
          granularity={granularity} setGranularity={setGranularity}
          groupBy={groupBy} setGroupBy={setGroupBy}
          role={role}
        />
      )}

      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={onImportMilestones}
      />

      {/* Add Modal */}
      <AddModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={onAddMilestone}
        projects={projects}
        phases={phases}
        workstreams={workstreams}
      />

      {/* Toast */}
      {toast && <div className="jmt-toast">{toast}</div>}
    </div>
  );
}
