# Client Feedback — Module Feature Assessment

**Source:** Peter Voss → Hiroshi (prospect customer feedback, post-demo)  
**Date assessed:** 25 June 2026  
**Purpose:** Map each client requirement to Jiganto modules and state what exists today vs. what still needs building.

---

## Executive summary

The prospect’s message aligns with **five priority areas** (Resources, Resource Demand, CRM Pipeline, Portfolio Reviews, Project Management). A second note frames this as an **80–90% fit** if resource management, recruitment gaps, project tracking, and reporting are addressed — with documentation, timesheets, and billing as lower priority.

| Module area | Overall fit | Headline |
|-------------|-------------|----------|
| **Resources** | **~75%** | Strong allocation, skills, and bench tooling — split across Resource Management and Resource Planning |
| **Resource demand** | **~65%** | Skills gaps and recruitment forecast exist; full recruitment workflow and project-linked gap reports are thinner |
| **CRM** | **~70%** | Forecasting, closing dates, and opportunity resource plans are strong; LOB reporting and bi-weekly meeting packs are gaps |
| **Projects & portfolio** | **~70%** | Gantt and agile are mature; portfolio-manager rollups and level-one plan view are the main gaps |

**Combined estimate vs. client “80–90%” claim:** **~72–78%** today, rising toward **85%+** with targeted gaps closed (see [Recommended priorities](#recommended-priorities)).

---

## Client message — requirements extracted

### Image 1 — Peter’s five priorities

1. **Resource Management** — See allocation; report who is on the bench or has spare capacity in the future.
2. **Resource Demand Management** — Forecast staffing from pipeline; manage/report skills; recruitment requests for gaps; report roles/skills to recruit and for which projects.
3. **CRM Pipeline Management** — Support bi-weekly sales/BD meetings; reports by salesperson and LOB (product line/division); generic and LOB-tailored pipeline review reports.
4. **Project and Portfolio Reviews** — Weekly portfolio manager status report with top risks, issues, and key milestones.
5. **Project Management** — Gantt for traditional projects; backlog/sprint boards for digital; level-one plan of all projects/programs grouped by portfolio manager with phases and L1 milestones.

### Image 2 — Pain points and 80–90% fit

**Highest priority**

- Resources: skills inventory, current work, gaps, bench availability
- Recruitment for vacancies
- Project/program tracking and reporting

**CRM**

- Forecast by salesperson or sales team
- Which opportunities close and when
- Resources needed per opportunity

**Projects**

- Status by PM or portfolio manager
- Top risks/issues per project or portfolio
- Outstanding resource needs per project/portfolio
- Level-one plan with phases and milestones

**Lower priority (not assessed in depth here):** documentation management, timesheets, billing.

---

## 1. Resource Management

**Jiganto modules:** Resource Management (`/modules/resource-mgmt`), Resource Planning (`/modules/resource-planning`), CRM Capacity Board

### Client questions → feature mapping

| Client need | Status | What exists | Gaps |
|-------------|--------|-------------|------|
| What resources and skills do we have? | **EXISTS** | Skills matrix, skill categories, skill search, skills inventory (Resource Planning) | Admin in Resource Mgmt; analytics mainly in Resource Planning — two entry points |
| What are resources working on? | **EXISTS** | Allocations tab (timeline), Capacity Board (project + CRM opportunity bookings), pipeline view | Basic timeline does not include CRM bookings; Capacity Board lacks project/opportunity filter |
| Where are resource gaps? | **PARTIAL** | Skills gap analysis (by job title), demand vs supply matrix, dashboard skills heatmap, recruitment recommendations | Gap logic is title-based, not full proficiency; not always linked to a specific project in Resource Mgmt UI |
| Who is on the bench / spare capacity? | **PARTIAL** | “On the Bench” KPI, bench filter on People, bench/burnout in Reports, full **Bench Management** tab in Resource Planning | No dedicated spare-capacity **report/export** in Resource Mgmt; bench UX is stronger in Resource Planning |
| Future availability | **PARTIAL** | 8-week capacity vs demand, 90-day forecast, heat map, scheduler, “rolling off in 30 days” | No single “who is free from date X” org-wide report; `availableFrom` API not exposed in skills search UI |

### Key locations

| Area | Path |
|------|------|
| Resource Management page | `client/src/pages/ResourceManagementPage.tsx` |
| Dashboard (bench KPI, capacity chart) | `client/src/components/resources/ResourcesDashboardTab.tsx` |
| Allocations & Capacity Board | `client/src/components/resources/ResourcesAllocationsTab.tsx`, `client/src/components/crm/CapacityBoard.tsx` |
| Skills matrix | `client/src/components/resources/SkillsMatrixTab.tsx` |
| Bench management (planning) | `client/src/components/resource-planning/tab-views.tsx` (`BenchManagementTab`) |
| APIs | `server/resources/`, `server/resource-planning/` |

---

## 2. Resource Demand Management

**Jiganto modules:** Resource Planning, CRM Resource Plan, Resource Management pipeline/skills

### Client requirements → feature mapping

| Client need | Status | What exists | Gaps |
|-------------|--------|-------------|------|
| Manage and report on available skills | **EXISTS** | Skills inventory, demand vs supply matrix, CSV/PDF export, top demanded skills | Split across modules; practice filter partly hardcoded |
| Recruitment request for skill gaps | **PARTIAL** | `recruitment_recommendations` table, auto-generated cards, “Initiate recruitment” status, HR CSV/PDF export | Not a full requisition workflow (approvals, hiring stages, ATS); cannot raise request directly from Resource Mgmt gap dialog |
| Report: roles/skills to recruit and for which projects | **PARTIAL** | Recruitment Forecast tab (role, grade, headcount, dates, cost, status) | Lives in Resource Planning, not Resource Mgmt Reports; project linkage on cards is limited |
| Forecast staffing from sales pipeline | **EXISTS** | CRM opportunity resource plans → capacity board → Resource Planning CRM pipeline sync | Opportunity-level; not always visible as “demand” in one consolidated project list |

### Key locations

| Area | Path |
|------|------|
| Demand vs supply | `client/src/components/resource-planning/tab-views.tsx` (`DemandSupplyTab`) |
| Recruitment forecast | `client/src/components/resource-planning/tab-views.tsx` (`RecruitmentForecastTab`) |
| CRM pre-sale staffing | `client/src/components/crm/CrmResourcePlanTab.tsx` |
| Models | `shared/models/resource-planning.ts` |
| Service | `server/resource-planning/service.ts` |

---

## 3. CRM Pipeline Management

**Jiganto module:** CRM (`/modules/crm`)

### Client requirements → feature mapping

| Client need | Status | What exists | Gaps |
|-------------|--------|-------------|------|
| Bi-weekly sales / BD meeting support | **MISSING** | Forecasting tab, opportunity notes, dashboard KPIs usable manually | No meeting cadence, agenda template, or “BD meeting pack” |
| Reports by salesperson | **PARTIAL** | Owner on leads/opps; group-by owner; owner filter on pipeline, forecast matrix, leads; closed-won leaderboard | No combined leads+opps salesperson report; opportunities list lacks owner filter; leaderboard is won deals only |
| Reports by LOB (product line / division) | **MISSING** | Proxies: multiple pipelines, account industry, segment, opportunity type, custom fields | No native LOB field or LOB report templates |
| Generic pipeline review reports | **EXISTS** | Sales Forecast Dashboard, Time Period Forecast Matrix, pipeline kanban, dashboard stage breakdown, CSV export | — |
| LOB-tailored pipeline reports | **MISSING** | Pipeline filter in forecast matrix | No saved per-LOB report packs |
| Forecast by salesperson | **PARTIAL** | Forecast matrix owner filter + group by owner; per-user forecast records (`crmForecasts`) | — |
| Forecast by sales team | **MISSING** | — | No team entity or team rollup in forecast UI |
| Which opportunities close and when | **EXISTS** | `expectedCloseDate` on opportunities; closing-this-month filter; forecast matrix heatmap by period; “Closing This Quarter” KPI; resource plan timeline | No single cross-pipeline closing Gantt |
| Resources needed per opportunity | **EXISTS** | Resource Plan tab, create plan from opportunity form, integrated capacity board, finance budget export | Lightweight `crm_resource_requirements` (skills/hours) is schema-only — no UI |

### Key locations

| Area | Path |
|------|------|
| CRM shell | `client/src/pages/CRMPage.tsx` |
| Forecasting | `client/src/components/crm/SalesForecastDashboard.tsx`, `ForecastMatrix.tsx` |
| Resource plan on opportunities | `client/src/components/crm/CrmResourcePlanTab.tsx`, `OpportunityFormDialog.tsx` |
| Pipeline / leads / opps | `CrmPipelineTab.tsx`, `CrmLeadsTab.tsx`, `CrmOpportunitiesTab.tsx` |
| APIs | `server/routes.ts` (CRM section) |

### Recent UI work (forecasting)

Forecast matrix now includes: KPI cards, heatmap legend, account color bar + industry, colored probability and stage badges, opportunity notes modal, and tab switching without full-page reload.

---

## 4. Project and Portfolio Reviews

**Jiganto modules:** Portfolio Management (`/modules/portfolio`), Projects (`/modules/projects`)

### Client requirements → feature mapping

| Client need | Status | What exists | Gaps |
|-------------|--------|-------------|------|
| Weekly portfolio manager status report | **PARTIAL** | 360° Project Report (top 5 risks/issues + milestones); scheduled email reports; weekly health snapshots | No **portfolio-manager rollup** across all owned programmes; `portfolio_summary` is RAG table without top-5 RAID narrative |
| Top 5 risks and issues | **PARTIAL** | Per-project in 360° report; consolidated RAID table at portfolio level | Portfolio level is full RAID list, not “top 5” aggregate |
| Key milestones in weekly showcase | **PARTIAL** | Milestones in 360° report; portfolio milestone register | Not bundled into one weekly PM-facing pack |
| Status by Project Manager | **PARTIAL** | Portfolio summary PM column; custom report builder filter/group by PM; basic PM status tool (free text) | No dedicated “reports by PM” browse/generate UI |
| Status by Portfolio Manager | **PARTIAL** | `pmPortfolios.ownerId` in schema | No status views filtered by portfolio owner |

### Key locations

| Area | Path |
|------|------|
| Portfolio reports | `client/src/components/portfolio/PortfolioReportsTab.tsx` |
| 360° report view | `client/src/components/portfolio/Portfolio360ReportView.tsx` |
| Health matrix | `client/src/components/portfolio/PortfolioHealthMatrixTab.tsx` |
| PM status tool | `client/src/components/projects/PmSecondaryTools.tsx` |
| Backend | `server/portfolio/service.ts`, `server/portfolio/jobs.ts` |

---

## 5. Project Management

**Jiganto module:** Projects (`/modules/projects`)

### Client requirements → feature mapping

| Client need | Status | What exists | Gaps |
|-------------|--------|-------------|------|
| Gantt charts (traditional) | **EXISTS** | Full Gantt: phases, workstreams, tasks, milestones, dependencies, WBS, RAG | — |
| Backlog and sprint boards (digital/agile) | **EXISTS** | Backlog, sprint board, epics, stories, sprints, defects, burndown | — |
| Agile status reports | **PARTIAL** | Agile dashboard, sprint management | Not called out as printable “status report” for showcases |
| Level-one plan — all projects/programs by portfolio manager | **MISSING** | Per-project L1 phases in 360° report; portfolio roadmap; milestone register | No consolidated view grouped by **portfolio manager** with phases + L1 milestones |
| Phases and level-one milestones on plan | **PARTIAL** | Phase model + Gantt; L1 plan section in 360° (phases per project) | Not cross-portfolio |

### Key locations

| Area | Path |
|------|------|
| Projects hub | `client/src/pages/ProjectsManagementPage.tsx` |
| Gantt | `client/src/components/projects/ReactGanttChart.tsx`, `GanttView.tsx` |
| Agile | `client/src/components/projects/AgileBoard.tsx`, `agile-board/` |
| Portfolio roadmap | `client/src/components/portfolio/PortfolioRoadmapTab.tsx` |

---

## 6. Cross-cutting: outstanding resource needs (Projects)

| Client need | Status | What exists | Gaps |
|-------------|--------|-------------|------|
| Outstanding resource requirements per project/portfolio | **PARTIAL** | Project resource tracker (allocations); portfolio utilisation; health matrix Resources RAG; org-level recruitment forecast | No explicit “open roles / unfilled needs” per project or portfolio in PM/Portfolio UI |

---

## Summary matrix

| # | Requirement (client wording) | Module | Status |
|---|------------------------------|--------|--------|
| 1 | Bench / spare capacity report | Resources | **PARTIAL** |
| 2 | Allocation visibility | Resources | **EXISTS** |
| 3 | Future availability | Resources | **PARTIAL** |
| 4 | Skills inventory & reporting | Resource demand | **EXISTS** |
| 5 | Recruitment workflow for gaps | Resource demand | **PARTIAL** |
| 6 | Roles/skills recruitment report | Resource demand | **PARTIAL** |
| 7 | Bi-weekly sales/BD meetings | CRM | **MISSING** |
| 8 | Reports by salesperson | CRM | **PARTIAL** |
| 9 | Reports by LOB | CRM | **MISSING** |
| 10 | Generic pipeline review | CRM | **EXISTS** |
| 11 | LOB-tailored pipeline reports | CRM | **MISSING** |
| 12 | Forecast by salesperson | CRM | **PARTIAL** |
| 13 | Forecast by sales team | CRM | **MISSING** |
| 14 | Closing timeline | CRM | **EXISTS** |
| 15 | Pre-sale resource planning | CRM | **EXISTS** |
| 16 | Weekly PM status (top 5 RAID + milestones) | Portfolio | **PARTIAL** |
| 17 | Status by PM / portfolio manager | Portfolio | **PARTIAL** |
| 18 | Gantt | Projects | **EXISTS** |
| 19 | Backlog & sprint boards | Projects | **EXISTS** |
| 20 | Level-one plan by portfolio manager | Projects | **MISSING** |
| 21 | Top risks/issues (project/portfolio) | Projects/Portfolio | **PARTIAL** |
| 22 | Outstanding resource needs (project/portfolio) | Projects | **PARTIAL** |

**Counts:** EXISTS **7** · PARTIAL **13** · MISSING **4**

---

## Recommended priorities

To move from **~72–78%** toward the client’s **80–90%** target with focused delivery:

### P0 — Highest client pain (resources + reporting)

1. **Unified bench & spare capacity report** — Single exportable view in Resource Management (reuse Resource Planning bench logic).
2. **Recruitment gap → request workflow** — Connect skills gap analysis to recruitment recommendations with project/opportunity linkage.
3. **Portfolio manager weekly pack** — One report: owned programmes, top 5 risks/issues, key milestones (extend scheduled `360_report` / `portfolio_summary`).

### P1 — CRM meeting cadence

4. **Salesperson pipeline report** — Combined leads + open opportunities by owner, printable/CSV.
5. **LOB field + report templates** — Custom field or first-class LOB on opportunity; saved pipeline views per division.
6. **Bi-weekly BD meeting view** — Curated Forecasting + notes + action items (lightweight workflow, not full BPM).

### P2 — Portfolio / PM visibility

7. **Level-one plan by portfolio manager** — Cross-project phases and L1 milestones grouped by `pmPortfolios.ownerId`.
8. **Outstanding resource needs on project/portfolio** — Open roles from resource plans + allocations vs. demand.
9. **Sales team forecast rollup** — Team entity or manager hierarchy on `crmForecasts`.

### P3 — Polish (lower client priority)

- Documentation, timesheets, billing enhancements (client marked as lower priority).

---

## Suggested client-facing response (draft)

> Thank you for the detailed feedback following the demo. We’ve mapped your requirements across Resource Management, Resource Demand, CRM, Projects, and Portfolio modules.
>
> **Strong fit today:** resource allocation and capacity views, skills inventory, sales forecasting and closing timeline, pre-sale resource planning on opportunities, full Gantt delivery, and agile backlog/sprint boards.
>
> **In progress / partial:** bench and spare-capacity reporting (spread across two modules), recruitment forecasting (needs a fuller request workflow), salesperson pipeline reports, and portfolio weekly status packs.
>
> **Planned gaps to close for 80–90% fit:** LOB-based pipeline reports, bi-weekly BD meeting pack, portfolio-manager level-one plan, and explicit project/portfolio resource gap tracking.
>
> We recommend a short follow-up session focused on Resource Management and CRM Forecasting, where most of your meeting cadence and bench visibility needs concentrate.

---

## Document history

| Date | Author | Notes |
|------|--------|-------|
| 2026-06-25 | Engineering assessment | Initial mapping from Peter Voss client messages + codebase audit |
