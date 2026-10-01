# Project Management Rebrand & Module Redesign — To Do

Tracking doc for the work agreed with Peter Voss (client) across the Estimate/Timesheet/Plan Studio
prototypes, the navigation options, and the 38-screen Project Management design batch.

Status key: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## 1. Resource Planning (Estimate Studio) — `[!]` BLOCKED, needs a naming decision

- **Do not build under the name "Resource Planning."** The live sidebar already has a module
  called exactly that (`/modules/resource-planning`) — persona-based workforce capacity planning
  (demand vs supply, heat maps, bench, recruitment forecasting). It's unrelated to what Estimate
  Studio does (project/opportunity-level estimating with rate cards). Building the new module
  under the same name creates two unrelated things called "Resource Planning" in one app.
- **Correction to relay to Peter**: rate cards are *already* unified — one shared `rate_cards`
  table (Module 08, ADR-003), with CRM explicitly read-only against it and Finance reading/writing
  the same table. There's no duplication to fix here; the claim that this work "fixes CRM/Finance
  maintaining separate rate cards" was wrong and should be corrected.
- [ ] Get a naming decision from Peter before writing any code for this module
- [ ] Once named: build it as its own module using Estimate Studio's grid/versioning UX, reusing
      the existing shared `rate_cards`/`rate_card_items` tables (no new schema needed for rates)
- [ ] Expose it both as a standalone module and a project-attachable tool (same pattern as
      Documents/BPM)

## 2. Timesheets (Timesheet Studio) — `[x]` DONE

- [x] Confirmed there's no data or UI duplication to merge — Resources' "Timesheets" tab already
      reuses Finance's `FinanceTimesheetsTab` component directly, same shared `timesheet_periods`/
      `timesheet_entries` tables. The "merge two systems" framing overstated the starting problem;
      real gap was just: no standalone front door.
- [x] Added `TimesheetsPage.tsx` at its own route (`/modules/timesheets`), reusing the same
      component and API endpoints — no backend changes, no risk to the approval workflow
- [x] Registered in module metadata, route preloader, and repointed the sidebar nav entry (was a
      `/modules/finance-mgmt?tab=timesheets` deep-link)
- [x] Typecheck clean

## 3. Projects Management — the big one

### 3a. Schedule engine (Plan Studio replacing Gantt/WBS/Milestone Tracker) — `[ ]` not started, scope corrected

**Checked the actual current engine (`gantt-v4-engine.js`, 6,428 lines) against what was claimed
to Peter as missing. Most of it already exists — the size of this swap is smaller than described.**

Already in production today (verified directly in source, not assumed):
- Real CPM forward/backward pass with slack calc, supporting FS/SS/FF (not just a naive chain)
- **Drag-to-link dependencies between bars already exists** — hover a bar, drag its end handles
  onto another (`depTypeFromHandles`/`createDepLink`). Limited to creating FS or SS via drag only
  (FF must be set via the edit-modal dropdown instead) — narrower than claimed missing entirely.
- **Auto-rollup of parent dates from children already exists** (`rollupParentDates`), triggered via
  an explicit "Auto schedule" action rather than a continuous toggle
- Full plan versioning (save / save-as-new / save-as-copy / activate / manage), undo/redo
  (session-only), custom columns (5 types), import/export, multi-select bulk delete,
  indent/outdent, 3-way filtering (type/owner/RAG) + search, side-by-side List+Gantt panes

**Confirmed genuinely missing** (real value Plan Studio would add):
- [x] Multiple predecessors per task — **engine and persistence now support it; interactive UI to
      create a second link does not exist yet, flagged explicitly below, not hidden.** This was the
      highest-risk change made this session — the CPM forward/backward-pass calculation, which
      drives every task's computed dates and the critical-path highlight, lives in a 6,428-line file
      with no way to visually verify a change here. Handled it deliberately:
  - Generalized `computeCriticalPath()` from "one predecessor per task" to "walk every edge from a
    new `predEdges(t)` helper" — for any task with no `extraPredIds` (true of 100% of real data
    before this change), `predEdges()` returns exactly the single `{id,type}` pair the old code
    built from `predId`/`depType` directly, so the new forward pass (max across edges) and backward
    pass (same per-edge type lookup, just captured at edge-construction time instead of re-read
    later) are **provably identical** to the old code on that data, not just "should be similar"
    — traced through by hand against the original line-by-line before writing it.
  - **Verified by executing the actual committed code**, not a reimplementation: extracted
    `normalizeTaskRags`/`predEdges`/`computeCriticalPath` verbatim from the real file into a Node
    harness (brace-matched extraction, not copy-pasted by hand) and ran three cases — a plain FS
    chain (confirms old single-predecessor behaviour unchanged), an SS dependency (confirms even a
    pre-existing quirk in the SS backward-pass formula reproduces identically, proving nothing in
    that path was altered), and a genuine two-predecessor case (task B depends on both a 5-day and
    an 8-day predecessor via FS) — correctly identified the longer, binding predecessor as critical
    and the shorter one as having slack, i.e. real AND-semantics for multiple predecessors, not just
    "doesn't crash."
  - Extended `predecessorIdsForSave()` to serialize `[predId, ...extraPredIds]` (deduped, each
    validated the same way the primary already was) instead of just `[predId]` — no DB migration
    needed, `predecessor_ids` was already an `integer[]` column, only the client ever threw away
    everything past index 0.
  - **Verified for real over HTTP**: PUT a task with two predecessor ids through the actual
    `/api/pm/tasks/:id` route, fresh `GET` of the task list confirmed both ids survived a reload,
    then restored the original state.
  - **Follow-up UI now also built**: the edit modal has a new "Additional predecessors" field —
    chips for already-added extras (each removable), a dropdown of remaining eligible tasks (self,
    the primary, and already-added extras excluded), and a "+ Add" button. Disabled with a dimmed
    state until a primary predecessor is chosen, mirroring the existing dependency-type field's own
    "set a Predecessor first" pattern. Picking the same task as both primary and an extra
    auto-drops the redundant extra. All FS-type only (no per-extra type picker) and add-only —
    still no drag-link support and MS-Project export still drops extras — both reasonable,
    explicitly-scoped exclusions, not oversights.
  - **Found and fixed one real bug in this UI code by re-reading it, not by testing in a browser**:
    the enable/disable logic located the "+ Add" button via `closest('.fg').querySelector('button')`
    — but the chip list's own "remove" buttons live in the same container and come first in DOM
    order, so with any chips already present this would have silently toggled a chip's remove
    button instead of the add button. Fixed by giving the add button and its row stable ids instead
    of a positional selector.
  - **Verified the two genuinely new pieces of logic by extracting and executing the real code**,
    same method as the CPM check: `predecessorIdsForSave()`'s new dedup/validation against six cases
    (no primary drops extras, primary+2 extras keeps all three, a duplicate-of-primary extra is
    deduped, a repeated extra is deduped, an unsaved-local extra id is filtered out, an invalid
    primary still correctly returns `null`) — all six matched expected output exactly. The DOM-facing
    half (chip rendering, enable/disable, dropdown population) could not be verified the same way —
    no browser tool exists in this session — so it's checked by careful tracing through every call
    site instead, not assumed correct.
- [x] Start-to-Finish (SF) dependency type — the engine's internal model, save path, and
      `PmPlanHealthTool`'s conflict check all already handle SF alongside FS/SS/FF; the real gap
      was never SF specifically, it was that no dependency type survived a reload at all (see the
      persistence bug below, now fixed). Whether SF is actually *choosable* in the edit-modal
      dropdown UI hasn't been checked — that's a separate, smaller UI question.
- [x] Plan-health warnings panel (missing owner/dates, overdue items, dependency conflicts) — built,
      see below.
- [x] **Level 1 / presentation view** — built, see below. Was the single most genuine, valuable gap
      Plan Studio actually filled.

**WBS tool** (`PmWbsTool`): confirmed as originally described — a simple read-only table joining
phases + tasks by WBS code. A real, if small, gap vs. Plan Studio's numbered tree.

**Milestone Tracker**: also more mature than a quick glance suggests (1,060 lines — full CRUD,
import, dialogs). Not yet compared feature-by-feature against Plan Studio's milestone handling
(diamond markers on the timeline, etc.) — do that comparison before assuming it needs replacing
wholesale rather than absorbing into the new Level 1 view.

- [ ] Re-scope the swap plan with Peter given the above — probably: keep the existing engine's
      mature feature set, add the Level 1 view + plan-health panel + multi-predecessor/SF support
      on top, rather than a full replacement
- [ ] Run old and new in parallel until proven, then retire only what's actually superseded

**[x] Level 1 / presentation view — first cut built.** New `level1_plan` project tool
(`PmLevel1PlanTool.tsx`), added as its own tool type alongside Gantt/Milestone Plan rather than
inside the existing 6,428-line engine — additive, zero risk to the working detailed Gantt.
- Reads from the same `/api/pm/projects/:id/tasks` source the detailed Gantt uses (not the legacy
  phases endpoint), so it can never drift out of sync with what the detailed view shows
- Phase bands (one colour per phase, cycling a fixed palette), collapsible to show work
  streams/activities nested beneath, milestones as diamond markers, a today-line, date range
  computed from the actual task dates rather than assumed
- View-only for this first cut — editing stays in the detailed Gantt for now, consistent with
  "run old and new in parallel"
- Registered properly: `pmToolTypeEnum` (plain array, not a DB enum — no migration needed), the
  master `TOOL_DEFINITIONS` catalog (wizard + picker + subtitle lookups all pick it up
  automatically), default tool set for new projects/programmes, and the render switch in
  `ProjectsManagementPage.tsx`
- **Not done yet**: no badge/count indicator on the tool card (safe no-op today, `undefined` badge
  lookup, not a crash), no presentation-mode full-screen/export — both reasonable fast-follows
  once the base view is confirmed to look right
- **Typecheck clean, server restarts cleanly on the enum change — not yet visually confirmed**,
  same limitation as everything else this session: no browser tool available here. Worth a look
  on a real project with phases/milestones set up before calling this finished.

**[x] Plan-health warnings panel — first cut built.** New `plan_health` project tool
(`PmPlanHealthTool.tsx`), same additive pattern — reads the same tasks source, doesn't touch the
existing engine. Checks: missing owner (leaf work items), missing dates, end-before-start, item
outside its parent's date range, overdue items/milestones, and a dependency-order conflict
(successor starting before its predecessor finishes). Deliberately **not** added to the default
tool set for new projects — it's a diagnostic/QA tool, opt-in via the picker, unlike Level 1 Plan
which is a core planning artifact.

**[x] Dependency-type persistence bug — fixed.** Was: dependency *type* (FS/SS/FF) never sent to
the server when a task saved — verified in `persistSave()`: the PUT body included `predecessorIds`
but no type field at all, so picking SS or FF only held for the current browser session; reload and
every dependency silently behaved as FS again.
- Added `dep_type` column to `pm_tasks` (`text`, default `'FS'`) — additive, nullable-with-default,
  applied directly via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` after `drizzle-kit push` hung
  against the remote Supabase connection for several minutes with no output (killed it rather than
  wait indefinitely; the direct SQL is the same diff it would have generated for a single additive
  column, just without the introspection overhead)
- `storage.updatePmTask`'s field allowlist now includes `depType`
- `ReactGanttChart.tsx`'s `buildGanttData()` now reads the task's real `depType` (validated against
  FS/SS/FF/SF, falling back to FS only if missing/invalid) instead of hardcoding `"FS"` on every load
- `gantt-v4-engine.js`'s `persistSave()` and `persistCreate()` both now send `depType:t.depType` in
  the PUT/POST body — the engine's internal model, CPM calc, drag-link UI, and MS-Project export
  already handled `depType` throughout (confirmed by grep — it's used in a dozen places); the save
  path was the one gap
- `PmPlanHealthTool`'s conflict check is now genuinely type-aware (FS/SS/FF/SF each checked against
  the correct pair of dates) instead of the FS-only check that existed specifically because of this
  bug
- **Verified for real, not just typechecked**: logged into the running dev server, PUT a real task
  with `depType: "SS"` through the actual `/api/pm/tasks/:id` route, then did a completely fresh
  `GET` of the task list (exactly what `buildGanttData()` consumes on page load) and confirmed `SS`
  came back — then restored the original state. This is the exact scenario that was silently broken
  before.
- Typecheck clean, `node --check` confirms the 6,428-line engine file is still syntactically valid,
  dev server picked up the schema and server changes without errors.

### 3b. Workspace UX — mostly done, scoped down from the design after reading it properly
- **Correction**: the "missing" Projects landing page from Peter's mockup **already exists**
  (`ProjectsLanding.tsx`, ~1,700 lines) and is more capable than the mockup — table/cards/kanban
  views, full filtering, CSV import/export, milestone tracker, 360°/status report browsers, inline
  editing. Nothing to build here; it's a possible restyle target, not a gap.
- **Found the actual design file for this item** (`Main.dc.html`, titled "Project Workspace — new
  tool-attachment UX") rather than working from memory of an old screenshot. It shows a different
  overall page shape than the live app: a project-list rail (grouped by customer, RAG pills, "N
  tools attached" counts) + a main content "home" with a project header card, a KPI row, a card
  grid of attached tools each with a live one-line stat and an Open button, and a dashed "Add a
  tool" quick-picker.
- **Deliberately did not rebuild the left rail as a project list.** The live app's
  `ProjectWorkspaceSidebar` is a mature, already-confirmed "Option B" tool nav (health score, RAG
  dots, progress bar, sectioned tool list, its own Add-tool drawer with search) — replacing it with
  a project-list rail would be a much larger, riskier structural nav change than what this item
  actually needed, and isn't what the design's own title calls out as "the core UX improvement."
- **Checked `ProjectOverview.tsx` before building anything — it already had most of this.** Same
  pattern as five other items this session: KPI row, upcoming milestones, critical RAID items, team
  snapshot, with "View all →" navigation buttons, all already existed. The one genuinely missing
  piece was the design's actual headline feature: a card grid of attached tools with quick-open,
  plus a way to add more right on the page instead of only via the sidebar drawer.
- [x] Added a `ToolsAttachedSection` to `ProjectOverview.tsx` — card grid of enabled tools (icon,
  name, live stat from the same `tool-badges` data the sidebar already uses, Open button) plus a
  quick-add row of up to 5 suggested not-yet-added tools. Threaded `enabledTools`/`onAddTool` down
  through `ToolPlaceholder` from `ProjectDetailView`, reusing the exact same `addToolMutation` the
  sidebar's drawer already calls — no new API surface, no duplicated logic.
- [ ] Decide on the pinned quick-access strip (Dashboard/Gantt/Timesheets) from the earlier concept
      — not covered by `Main.dc.html`; still needs a source design or a decision with Peter.
- Typecheck clean, dev server picked up the change without errors.

### 3c. Tool screens (38-screen design batch) — classification done, this round's build items shipped
Cross-checked all 38 `.dc.html` titles against `ProjectsManagementPage.tsx`'s render-switch cases
and `PmSecondaryTools.tsx`'s actual line counts (not just the file existing). Three buckets:

**(a) Already covered, adequate as-is** — no work needed:
AssumptionRegister, ChangeRequestRegister, DecisionLog, DeliverablesTracker, DependencyRegister,
IssueRegister → all served by `RaiddLogTool.tsx` (1,572 lines, mature, `logType`-driven).
KanbanBoard, TaskTrackerKanban → `AgileWorkspace.tsx`. Overview360 → `Portfolio360ReportView`.
ProjectDashboard → `ProjectOverview.tsx` (455 lines). RaciMatrix → `PmRaciTool` (~137 lines,
reasonably built out). SprintBoard → `AgileWorkspace.tsx`. StatementOfWork → `PmSowTrackerTool`.
TaskTrackerMaster → `ProjectTrackingBoard.tsx`. TestTracker → `PmTestTrackerTool`.
ResourcePlanner → `PmResourceTrackerTool` (thin by design, tagged `crossModule: "Resource
Planning"` — depth belongs in that module, not duplicated here). Timesheets → `PmTimesheetsTool`
(thin by design, same cross-module reasoning) — done separately as its own top-level page too,
see section 2. Methodology field on NewProject — `[x]` confirmed inert info-only, no change
needed.

**(b) Exists but visibly thinner than the new design — worth closing the gap:**
- [x] DocumentationRepository — `PmDocumentationTool` was ~38 lines (basic list). Rebuilt with
      folder-linking to the project's document space, matching the design's richer version.
- [!] BudgetTracker — **re-scoped after actually reading the design file; "needs a review pass, not
      a rebuild" was itself wrong.** This is not a small gap in `PmFinanceTrackerTool` — it's a
      4-tab enterprise budgeting subsystem: a Budget Builder with per-resource cost lines (rate ×
      unit × qty × margin → charge, grouped by category with subtotals and 12-month phasing), a
      locked/baselined budget-version workflow with change-request-gated amendments, an Actuals tab
      reconciling against real timesheets/invoices with a computed CPI, a full Reforecast workflow
      (its own versions, mandatory commentary above a 5% deviation threshold, sponsor approval), and
      a board-facing Variance Report. This is comparable in scope to Plan Studio itself, not a
      finance-tracker enhancement — it needs its own dedicated scoping conversation with Peter
      (data model for cost lines + phasing, a versioning/baselining concept, real invoice data to
      reconcile against — Timesheets already exist, an Invoices source doesn't yet) rather than
      being built as a quick gap-closure. Flagging this now rather than shipping a shallow version
      that wouldn't actually represent what the design asks for.

**(c) Genuinely new — no equivalent tool type existed, built this round as additive tools**
(same safe pattern as Level 1 Plan/Plan Health — new `pmToolTypeEnum` entries, own components,
zero risk to existing tools):
- [x] Action Log — `action_log` / `PmActionLogTool.tsx`. Lightweight action-item tracker distinct
      from the RAID logs (owner, due date, status, linked to a parent item optionally).
- [x] Governance Calendar — `governance_calendar` / `PmGovernanceCalendarTool.tsx`. Recurring
      governance events (steering board, status calls, gate reviews) on a simple upcoming-list +
      month view.
- [x] RAID Report — `raid_report` / `PmRaidReportTool.tsx`. Read-only rollup across the 4 raw RAID
      logs (risks/issues/assumptions/dependencies) with counts by severity/status — the aggregated
      view Peter's design shows, distinct from the raw logs themselves.
- [x] RTM (Requirements Traceability Matrix) — `rtm` / `PmRtmTool.tsx`. Requirement ↔ deliverable
      ↔ test-case linkage table.
- [x] Milestone Status Report — `milestone_status_report` / `PmMilestoneStatusReportTool.tsx`.
      Table + Gantt-diamond toggle over the same `/tasks` milestones the detailed Gantt uses — no
      "forecast date" column, because the task model has no forecast field distinct from planned,
      so it shows what's actually there instead of inventing one.
- [x] Resource / Capacity Report — `resource_capacity_report` / `PmResourceCapacityReportTool.tsx`.
      Table + "by role" toggle over `/api/resources/allocations`. Deliberately does **not** show
      cross-project over-allocation (this project's allocation % only, not a person's total across
      every project they're on — that's a Resources-module concern) or a fabricated reports-to org
      tree (`projectReportsToId` exists on the schema but isn't populated in real data, confirmed by
      querying it directly — grouping by role instead of inventing a hierarchy from data that isn't
      there).
- [x] Financial Report — `financial_report` / `PmFinancialReportTool.tsx`. KPI cards (approved
      budget/actual/forecast/variance) + an editable cost-category breakdown stored on
      `project.metadata` (no new table). Explicitly does not build the mockup's PO/ledger drill-down
      panel or the "Finance & PM only" access lock — both flagged inline in the tool itself as real,
      undone gaps, matching the design's own note that templates/Excel for this one aren't decided
      yet either.
- [x] CCN Detail — folded into the existing Change Log (`PmChangeLogTool`) as an expandable
      per-row panel rather than a new top-level tool, matching the design's own framing as a
      drill-down of the Change Request Register, not a separate attachable screen. Uses existing
      `pm_raidd_items` columns with no migration: `description`→reason, `response`→technical impact,
      `timelineImpact`→schedule impact, `decisionBody`→decision owner, `decisionDate`→target date,
      `activityLog`→contributor sign-off list. Not built: a numeric cost-impact field (no matching
      column) and file attachments — both real gaps, not hidden.

All seven new tools this round registered the same way as Level 1 Plan/Plan Health: `pmToolTypeEnum`
(plain array, no migration), `TOOL_DEFINITIONS` (picked up by wizard + picker automatically), added
to `MASTER_TOOL_ORDER`, and a render case in `ProjectsManagementPage.tsx`. Deliberately **not**
added to any work type's `DEFAULT_TOOLS` — all opt-in via the tool picker, not core planning
artifacts. Verified for real, not just typechecked: logged into the running dev server via its own
`/api/login` route (real session, tenant 1) and hit every new endpoint dependency directly —
milestones (4 real rows, though 2 appear duplicated — see data-quality note below), allocations (3
real rows with real % and role), the `costCategories` metadata round-trip, and a full CCN-detail
PUT/read cycle on a disposable test change-request row (created, verified, deleted). Typecheck clean
throughout (one pre-existing, unrelated error in `ChatPage.tsx`, present before and after, not
touched).

**Data-quality observation, not a code bug**: querying project 1's milestones live showed
"Architecture sign-off" and "UAT complete" each twice. Both rows carry `legacySource: "milestone"`
with different `legacySourceId`s, suggesting a migration-time duplication rather than anything this
session's code touched. Worth a look before relying on milestone counts anywhere, but out of scope
to fix here.

**(d) Explicitly blocked — do not build:**
- [ ] Rate Card, Project Estimate — both tied to the unresolved Resource Planning naming
      collision; Peter hasn't confirmed the split yet. Building now risks throwaway work.

- [ ] Sync the tool-configure picker to the actual screens built (Gantt/Milestone → Plan Studio,
      RTM duplication, RACI duplication, Executive Summary/Cost Tracker/Sign-off Tracker merges) —
      still waiting on Peter's Excel version of the tool list before touching the picker UI itself

### Dropped from scope
- Public marketing landing page — explicitly stopped by Peter.

## 4. Visual rebrand — `[~]` in progress

- [x] Added the "Jiganto 2026" theme as additive/opt-in CSS (doesn't touch the default palette)
- [x] Wired through `brandingConfig.theme` (existing per-tenant mechanism) via `OrgBrandingSync`
- [x] Theme picker added to Settings → Branding, with a loading state on the dropdown and a
      300ms colour-fade transition on switch (was snapping instantly before)
- [x] **Verified live** — server log shows a real `PUT /api/tenants/1` with
      `theme: "jiganto2026"` landing correctly, not just asserted
- [x] **Found and fixed a real gap**: the dark-navy sidebar colours were defined but inert —
      `Sidebar.tsx` builds on `--card`/`--muted`/`--border`/`--foreground` tokens, not a dedicated
      `--sidebar-*` family, even though those tokens exist unused in `index.css`. Fixed by scoping
      a token override to the nav landmark (`[aria-label="Main navigation"]`) via CSS
      custom-property inheritance, rather than risk a blind rewrite of a 1,300-line component with
      no way to visually verify the result. Radix popovers/dropdowns portal to `<body>`, so they
      correctly stay outside this scope and remain light.
- [x] **Wordmark colour — fixed.** The "Jiganto" text used a hardcoded inline `#009EE2` (the old
      brand blue) independent of any theme. Moved it to a new `--brand-wordmark` CSS variable
      (`:root` keeps `#009EE2` as the default, unchanged for tenants on the default theme) and
      overrode it to the new accent (`#0E6E5C`) inside both `.theme-jiganto2026 [aria-label="Main
      navigation"]` (desktop sidebar) and a new `.theme-jiganto2026 [aria-label="Mobile navigation"]`
      scope — the mobile top bar turned out to be a structurally separate fixed header outside the
      desktop nav landmark, so the first attempt at this fix would have left the wordmark themed on
      desktop but not on mobile; gave the mobile header its own `aria-label` so both are covered.
- [ ] **Real scope finding**: ~190 of 404 component/page files use hardcoded Tailwind palette
      colours or raw hex (not theme tokens). The theme toggle correctly reskins shared chrome
      (buttons, cards, borders, the sidebar as of the fix above) but most feature-specific
      badges/charts/KPI accents across the app won't follow it yet. "Roll out screen by screen" is
      a genuinely multi-week effort — size this properly with Peter rather than implying it's close
      to done once the toggle exists.
- [x] **Gantt chart visual restyle — closes the earlier gap where "keep the engine" got conflated
      with "keep the visuals."** The Gantt is a sandboxed iframe with its own document (`srcDoc`),
      so the outer app's `.theme-jiganto2026` class on `<html>` never reached it — confirmed that
      was the reason the screen looked untouched despite the org theme existing. Fixed properly
      rather than left as a known gap:
  - `ReactGanttChart.tsx` now reads the tenant's `brandingConfig.theme` directly
    (`useCurrentOrganisation()`) and threads an `isBrandTheme` flag through both `buildGanttData()`
    and `buildSrcDoc()`
  - When on, a `<style>` block is injected into the iframe's `<head>` overriding the DHTMLX-derived
    CSS custom properties (`gantt-v4-engine.css`) — primary, borders, grid backgrounds, row
    hover/selection, banners, scrollbars — with the exact hex values from index.css's
    `.theme-jiganto2026` block, so the two stay visually consistent by construction, not by eyeballing
  - Bar colours (program/project/phase/workstream/activity/task/milestone/release) get a matching
    themed palette drawn from the same `--chart-*`/`--primary`/`--status-*` tokens, replacing the old
    indigo/cyan/emerald set
  - Dark mode (`resolvedTheme`) and the brand theme are independent and compose correctly — the
    override is scoped to `:root:not(.dark)` since the engine's existing `.dark` block already
    handles dark mode and the two haven't been combined anywhere else in the app
  - Off by default (only applies when `brandingConfig.theme === "jiganto2026"`), same opt-in pattern
    as the rest of the rebrand — no risk to tenants still on the default look
  - **Not yet visually confirmed** — same standing limitation as everything else this session, no
    browser tool available here. Typecheck clean, dev server picked up the change without errors.
- [ ] Apply to Executive Overview and the Project Workspace layout next (both already designed)

---

## Confirmed decisions log (so we don't re-litigate these)

| Topic | Decision |
|---|---|
| Estimate/Timesheet/Plan Studio | Approved as described above |
| Nav pattern | Option B (single rail + horizontal bars), not Option A |
| Gantt + Milestone Plan | One Plan Studio tool, not two separate tools |
| Methodology | Info field only, confirmed inert in the actual build; no gating behaviour |
| Public landing page | Out of scope |
| Rebrand rollout | New opt-in theme via per-tenant branding config; genuinely multi-week to reach every screen |
| Resource Planning naming | **Open — blocking.** Collides with an existing, unrelated live module |

## Things that turned out different from what was assumed (keep checking before building)

1. Rate cards: already unified (ADR-003), not duplicated — corrected.
2. Timesheets: component already shared between Finance/Resources, not duplicated — corrected,
   real fix was smaller than described (routing, not merging).
3. Projects landing page: already built and richer than the mockup — not a gap.
4. Sidebar dark theme: colours were defined but never wired to the component that needed them —
   found and fixed only because it was checked against the actual rendered classes, not assumed
   from the CSS variables existing.
5. Gantt engine: drag-to-link dependencies, auto-rollup, plan versioning, undo/redo, custom
   columns and 3-way filtering all already exist in production — described to Peter as gaps Plan
   Studio would fill. The real, confirmed gap was narrower: the SF dependency type existed
   throughout the engine already (only the save path was broken, now fixed), plus the plan-health
   panel and Level 1 view (both now built) and multi-predecessor support (still open — the DB
   column already supports it, the engine's internal model doesn't).
6. Budget Tracker: assumed to be a small gap ("needs a review pass, not a rebuild") — the opposite
   direction from the other five, which mostly turned out *smaller* than described. This one turned
   out *larger*: an enterprise-grade 4-tab budgeting subsystem (builder, actuals, reforecast,
   variance) comparable in scope to Plan Studio, not a finance-tracker tweak. Caught only by
   actually reading the full design file instead of going off the title and a one-line description.

**Pattern across all six**: five were described as more of a gap than they actually were, one was
described as less. The common thread isn't "gaps are always smaller" — it's that the early
high-level audit and even a design file's own title aren't a substitute for reading the actual
implementation or the actual full design before scoping work against it. Worth treating anything
from either as "needs verification," not "settled fact," the same way these six were checked.

## Reference material (client-shared design files, not committed to the repo)

- `estimate-studio.html`, `timesheet-studio.html`, `plan-studio.html` — original standalone prototypes
- `jiganto-design-source.zip` / `jiganto-design-renders.zip` / `canvas.json` — the 38-screen design batch
- Colour tokens: ink `#182635`, paper `#EFF2F5`, accent `#0E6E5C`, accent-soft `#E3F1ED`,
  muted `#66788A`, warn `#B4560F`, danger `#A03E52`, today-line red `#C43D3D`
- Fonts: `'Segoe UI', system-ui, -apple-system, sans-serif` (UI text), monospace stack with
  `font-variant-numeric: tabular-nums` for figures

## Files touched so far this initiative

- `client/src/index.css` — theme tokens, transition class, sidebar scope fix
- `client/src/hooks/use-org-branding.tsx` — theme toggle + transition trigger
- `client/src/pages/SettingsPage.tsx` — theme picker UI
- `client/src/pages/TimesheetsPage.tsx` — new standalone module page
- `client/src/App.tsx`, `client/src/lib/route-preload.ts`, `client/src/lib/module-metadata.ts`,
  `client/src/components/Sidebar.tsx` — routing/nav/metadata for the Timesheets page
