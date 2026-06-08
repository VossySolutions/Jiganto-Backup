# Business Management — Page Guide

Business Management is Jiganto’s strategy-to-governance workspace — plan strategy pillars, cascade goals and objectives, track initiatives, OKRs, KPIs, governance items, reviews, and linked documents.

**Route:** `/modules/business-mgmt`

**Access:** Any user with the Business Management module enabled for their organisation.

---

## Before any strategy data exists

When your workspace has no strategy items yet, open **Dashboard** to see empty metric cards and prompts. You can:

- Go to **Manage** → **Strategy** → **Add Strategy** to create your first item manually
- Use **Strategy Map** → **Export** → **Download Template**, fill in the Excel sheets, then **Import** to load a full hierarchy in one go
- Use any **Manage** tab → **Export** → **Download Template** to import a single layer (Goals, KPIs, etc.)
- Open **Strategy Map** after data exists to see the full seven-layer cascade

---

## Page layout

The Business Management page has three main areas:

| Area | Location | Purpose |
|------|----------|---------|
| **Welcome banner** | Top | Module tips (strategy mapping, governance, RAG rollup, AI insights) |
| **Header** | Below banner | Title and global search field |
| **Tab bar** | Below header | Switch between Dashboard, Strategy Map, Manage layers, Reviews, Documents, AI Insights |
| **Main content** | Centre (scrollable) | Active tab content |

**Header actions** (top right, next to **Business Management** title):

| Button | Action |
|--------|--------|
| **Search…** | Filter content in the current view (where supported) |

---

## Tab bar (main navigation)

Click a tab to switch views. On mobile, tabs scroll horizontally; icon-only labels appear on small screens.

| Tab | How to open | What it shows |
|-----|-------------|---------------|
| **Dashboard** | Click **Dashboard** | Summary metrics, goal progress, initiatives, risks |
| **Strategy Map** | Click **Strategy Map** | Visual seven-layer cascade (Strategy → Governance) |
| **Manage** | Click **Manage** dropdown | Sub-menu: Strategy, Goals, Objectives, Initiatives, OKRs, KPIs, Governance |
| **Reviews** | Click **Reviews** | Check-ins feed, overdue items, anomaly flags |
| **Documents** | Click **Documents** | Initiative documents + strategy external links |
| **AI Insights** | Click **AI Insights** (right end) | Opens AI strategy advisor side panel |

**Manage sub-menu items** (click **Manage** → pick one):

- **Strategy** — strategic pillars, vision, SWOT, etc.
- **Goals** — goals linked to strategy items
- **Objectives** — objectives linked to goals
- **Initiatives** — execution work linked to goals/objectives
- **OKRs** — objectives & key results
- **KPIs** — performance indicators
- **Governance** — board decisions, policies, audits, risks

---

## 1. Dashboard

**How to open:** Click **Dashboard** in the tab bar.

**What you see:**

- Four metric cards: **Strategy Items**, **Goals**, **Initiatives**, **Open Risks**
- **Goal Progress** — top goals with progress bars and status badges
- **Active Initiatives** — recent initiatives with priority and status
- **Risk Register** — open risks with likelihood/impact

**What you can do:**

- Scan RAG and progress at a glance
- Click through to **Manage** tabs to edit underlying records (no inline edit on Dashboard)

---

## 2. Strategy Map

**How to open:** Click **Strategy Map** in the tab bar.

**What it is:** A consolidated view of your strategy hierarchy across seven layers:

**Strategy → Goals → Objectives → Initiatives → OKRs → KPIs → Governance**

### Stats strip (top)

Seven clickable stat cards — one per layer. Click a card to filter/highlight that layer. Counts update when you focus on a single strategy.

### Toolbar

| Control | Action |
|---------|--------|
| **Search across all layers…** | Filter rows by title across every layer |
| **All / On Track / At Risk / Behind** pills | Filter by RAG status |
| **Department** dropdown | Filter by department |
| **Owner** dropdown | Filter by owner |
| **Group by** (Table view only) | Group rows by RAG, Department, or Owner |
| **Show Ref IDs** toggle (Table view) | Show/hide reference codes (e.g. `S-001`, `G-003`) |
| **View mode** dropdown | Switch layout (see below) |
| **Import** | Upload Excel/CSV and persist all layers to the database |
| **Export** → **Download Template** | Get the 8-sheet blank import template (Instructions + 7 data sheets) |
| **Export** → **Export Current Data** | Download all layers as Excel (re-importable format) |

### View modes

| Mode | Best for |
|------|----------|
| **Table** | Spreadsheet-style rows across all seven columns |
| **Cascade** | Indented tree showing parent–child relationships |
| **Strategy Foci** | Pick one strategy; expand/collapse sub-layers |
| **Flow** | Strategy list on left; sub-layers as columns on right |

**In Table view:**

- Click any cell to open the **Entity detail panel** for that item
- Click a group header row to collapse/expand grouped sections

**In Cascade / Focus / Flow views:**

- Click a **strategy card** → sets strategy focus and shows linked children
- Click **View full cascade** on a strategy card → switches to Strategy Foci view
- Click **Clear filter** banner → remove strategy focus

### Import & export (Strategy Map)

**How to open:** Click **Import** or **Export** in the Strategy Map toolbar.

#### Download Template

1. Click **Export** → **Download Template**
2. An Excel file (`Jiganto_Strategy_Template.xlsx`) downloads with eight sheets:
   - **Instructions** — column rules and valid values (not imported)
   - **Strategies**, **Goals**, **Objectives**, **Initiatives**, **OKRs**, **KPIs**, **Governance**

**Template rules:**

| Rule | Detail |
|------|--------|
| One row = one item | First row on each data sheet is the header row |
| **Code** column | Your own codes for cross-sheet linking (e.g. `S01`, `G01`) |
| Parent linking | Child sheets reference parent **Code** (e.g. Goals use **Strategy Code** = `S01`) |
| **RAG Status** | `On Track`, `At Risk`, or `Behind` |
| **Progress %** | Integer 0–100 |
| **Dates** | `YYYY-MM-DD` (e.g. `2026-12-31`) |
| **Priority** (Initiatives) | `low`, `medium`, `high`, `critical` |

#### Import

1. Fill in the template (or use **Export Current Data** output as a starting point)
2. Click **Import** → upload `.xlsx`, `.xls`, or `.csv`
3. All data sheets are parsed; the **Instructions** sheet is skipped
4. Rows are saved via `POST /api/business/bulk-import` in dependency order (Strategies first, then Goals, etc.)
5. Parent links resolve from **Code** values in the same file and from existing workspace ref codes

**Imported fields include:** title, description, owner name, RAG, progress, dates, priority (initiatives), KPI values, governance type, and parent relationships.

#### Export Current Data

1. Click **Export** → **Export Current Data**
2. Downloads a dated `.xlsx` with seven data sheets matching the import template
3. Use for backup, editing offline, or round-trip re-import

---

## 3. Manage layers (Strategy, Goals, Objectives, …)

**How to open:** Click **Manage** in the tab bar → choose a layer (e.g. **Goals**).

Each manage tab shares the same toolbar pattern.

### Toolbar (every manage tab)

| Button / control | Action |
|------------------|--------|
| **Search…** | Filter rows in the current table |
| **Status / RAG / Type** filters | Dropdown filters (vary by layer) |
| **Group by** | Group table by RAG, Status, Department, Owner, or Parent |
| **Table / Card** toggle | Switch list layout |
| **Import** | Upload Excel/CSV for this layer and save to the database |
| **Export** → **Download Template** | Single-sheet template for this layer only |
| **Export** → **Export Current Data** | Download filtered rows for this layer (re-importable) |
| **Add …** (e.g. **Add Strategy**) | Open create dialog for this layer |

### Table row actions

Hover a row to see action buttons on the right:

| Button | Action |
|--------|--------|
| Speech bubble | Open **Check-in** side sheet for this item |
| Pencil (**Edit**) | Open edit dialog — change title, status, RAG, progress, dates, owner, etc. |

**Tip:** Reference IDs (e.g. `S-001`, `INI-003`) appear in the **Ref** column and use the workspace sequencer.

### Add Strategy (example)

**How to open:** **Manage** → **Strategy** → **Add Strategy**

**Steps:**

1. Choose **Type** (Strategy, Vision, Target Market, SWOT, etc.)
2. Enter **Title**
3. Optionally enter **Description** — or click **AI Suggest** to auto-generate from the title
4. Click **Create**

Same pattern for **Add Goal**, **Add Initiative**, etc. on their respective tabs.

### Import & export (per manage tab)

Each manage layer has its own **Import** button and **Export** dropdown. Templates use the same column layout as the matching sheet in the full Strategy Map template.

| Manage tab | Template sheet | Parent code column |
|------------|----------------|-------------------|
| **Strategy** | Strategies | — |
| **Goals** | Goals | Strategy Code |
| **Objectives** | Objectives | Goal Code |
| **Initiatives** | Initiatives | Objective Code |
| **OKRs** | OKRs | Objective Code |
| **KPIs** | KPIs | Goal Code |
| **Governance** | Governance | Strategy Code |

**Import (single layer):**

1. Click **Export** → **Download Template** (or use the link inside the Import dialog)
2. Fill in rows — keep the header row; each data row needs at least a **Title** (or **Name** for KPIs)
3. Click **Import** and select your file
4. If the workbook has multiple sheets, only the sheet matching this tab is imported (e.g. **Goals** on the Goals tab)
5. Single-sheet CSV/Excel files are tagged with the current layer automatically

**Export current data:**

1. Apply any filters/search you want (export uses the **filtered** list)
2. Click **Export** → **Export Current Data**
3. Parent codes in the export use workspace reference sequences (e.g. `S01`, `G02`) for re-import linking

**Tip:** For a full hierarchy with parent links, use the Strategy Map multi-sheet template and **Import** from Strategy Map. Use per-tab import when adding or updating one layer at a time.

### Check-in (from manage table)

**How to open:** Click the **speech bubble** icon on any row.

**Steps:**

1. Optionally set **RAG** and **Progress %** (updates the item if changed)
2. Type your check-in note
3. Click **Save Check-in**
4. Past check-ins appear in the sheet below

---

## 4. Entity detail panel

**How to open:** Click any item in **Strategy Map** (table cell or card), or edit flow from manage views.

**What it is:** A right-side sheet with full detail for one strategy-layer item.

### Panel header

- Reference code (e.g. `G-002`)
- RAG badge
- Title and entity type

### Tabs inside the panel

| Tab | What you can do |
|-----|-----------------|
| **Details** | Edit title, description, status, RAG, owner; see parent item and created date |
| **Progress** | Set progress %, trend; for KPI/OKR also target and current values |
| **Activity** | Log a new check-in (note + RAG + progress); read past check-ins |
| **Docs** | Add external URL links; view uploaded initiative files (initiatives only) |
| **Hierarchy** | See parent item and current item in the strategy chain |

### Footer buttons

| Button | Action |
|--------|--------|
| Trash | Delete this item |
| **Cancel** | Close without saving |
| **Save** | Save changes from Details / Progress tabs |

---

## 5. Reviews & Check-ins

**How to open:** Click **Reviews** in the tab bar.

**What you see:**

- Three stat cards: **Total check-ins**, **Overdue reviews**, **Unique items reviewed this week**
- **Anomalies Detected** — auto-flagged overdue initiatives, at-risk goals, consecutive red check-ins
- **Needs Attention** — items overdue for scheduled review
- Entity-type filter pills (All, Strategy, Goal, Objective, …)
- Chronological feed of all check-in notes with RAG chips and progress-at-check-in bars

**What you can do:**

- Filter the feed by entity type using the pills
- Click **Load more** at the bottom to paginate older notes
- Use manage-tab check-in buttons to add new notes (see §3)

---

## 6. Documents

**How to open:** Click **Documents** in the tab bar.

Two sections — switch with the tabs below the title:

### Initiative Documents

**What it is:** Documents from the Document Management module that are linked to initiatives.

| Control | Action |
|---------|--------|
| **Search documents…** | Filter by title, initiative, or notes |
| **All Types** | Filter by link type (SOW, MSA, Deliverable, etc.) |
| **All Initiatives** | Filter by initiative name |
| **Sort** | Sort by title, type, initiative, or date |
| **Table / Grouped** | Flat table or grouped by initiative |

**Row click:** Opens the document in Document Management (`/modules/documents?doc=…`).

### Strategy Links

**What it is:** External URLs, file paths, or Jiganto links attached to any strategy layer item.

| Control | Action |
|---------|--------|
| **Search links…** | Filter by title or URL |
| **All Layers** | Filter by layer type (Strategy, Goal, …) |
| **All Sources** | Filter: External URL, Uploaded File, Jiganto Link |
| **Add Link** | Open dialog to attach a new link |

**Add Link steps:**

1. Click **Add Link**
2. Choose **Source Type** (External URL / Uploaded File / Jiganto Link)
3. Choose **Layer Type** and enter **Item ID** (the database id of the parent item)
4. Enter **URL / Path** and optional **Title** and **Description**
5. Click **Add Link**

**Tip:** You can also add links from the **Docs** tab inside the Entity detail panel (no item ID needed — it uses the open item).

---

## 7. AI Insights

**How to open:** Click **AI Insights** (violet button, right end of tab bar).

**What it is:** A side panel that analyses your whole strategy portfolio.

**Steps:**

1. Click **Generate Insights**
2. Wait for analysis (uses AI when `OPENAI_API_KEY` is configured; otherwise rule-based insights)
3. Read insight cards: anomalies, risks, recommendations, positive signals
4. Click **Refresh** to re-run

**Also available:** **AI Suggest** when adding a Strategy item (Manage → Strategy → Add Strategy → **AI Suggest** next to Description).

---

## 8. Data source & API

All Business Management data is stored in PostgreSQL and loaded through `/api/business/*` endpoints. There is no demo-data button in the UI.

| Operation | API | Used by |
|-----------|-----|---------|
| Multi-layer import | `POST /api/business/bulk-import` | Strategy Map Import, Manage tab Import |
| Strategy-only bulk import | `POST /api/business/strategy/bulk-import` | Legacy CSV path (append/replace modes) |
| Ref code backfill | `POST /api/business/entity-refs/backfill` | Automatic on first authenticated page load |
| Strategy map view | `GET /api/business/strategy-map` | Strategy Map tab |

After any import, the UI refreshes strategy map data, all manage-layer lists, and entity reference codes.

---

## Strategy layers & reference IDs

Each item gets a sequential reference code per workspace (assigned on create; existing items backfilled on first visit):

| Layer | Prefix | Example |
|-------|--------|---------|
| Strategy | `S-` | `S-001` |
| Goal | `G-` | `G-001` |
| Objective | `OBJ-` | `OBJ-001` |
| Initiative | `INI-` | `INI-001` |
| OKR | `OKR-` | `OKR-001` |
| KPI | `KPI-` | `KPI-001` |
| Governance | `GOV-` | `GOV-001` |

Reference codes appear in manage tables, Strategy Map (when **Show Ref IDs** is on), Reviews feed, and the detail panel header.

---

## RAG status

Used across strategy layers:

| Label | Meaning |
|-------|---------|
| **Green / On Track** | Progressing as planned |
| **Amber / At Risk** | Needs attention |
| **Red / Behind** | Off track or blocked |

Set RAG in the edit dialog, detail panel, or check-in forms. Strategy Map and Dashboard roll up worst RAG per row.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Strategy pillar** | Top-level strategic direction (Strategy tab / Strategy Map column 1) |
| **Goal** | Outcome linked to a strategy item |
| **Objective** | Measurable outcome linked to a goal |
| **Initiative** | Execution work package; can link to goals/objectives |
| **OKR** | Objective and key results — linked to objectives or initiatives |
| **KPI** | Key performance indicator — often linked to goals |
| **Governance** | Board decisions, policies, audits, meetings, risks at strategy level |
| **Check-in** | Progress note with optional RAG snapshot and progress % |
| **Strategy Map** | Visual/table cascade across all seven layers |
| **Strategy focus** | Filter map to one strategy and its descendants |
| **Anomaly** | Auto-detected risk (overdue, low progress, red streak) on Reviews tab |
| **Import template** | Excel sheet layout for bulk create/update via Import |
| **Import code** | Short code in the **Code** column (e.g. `S01`) used to link parent rows across sheets |

---

## Quick reference

| Where | Button / action | Result |
|-------|-----------------|--------|
| Tab bar | **Dashboard** | Metrics & progress overview |
| Tab bar | **Strategy Map** | Seven-layer cascade view |
| Tab bar | **Manage** → layer | CRUD table for that layer |
| Tab bar | **Reviews** | Check-ins, overdue, anomalies |
| Tab bar | **Documents** | Initiative docs & strategy links |
| Tab bar | **AI Insights** | AI strategy advisor panel |
| Strategy Map | Stat card | Filter/highlight layer |
| Strategy Map | **Import** | Upload Excel → save all layers |
| Strategy Map | **Export** → **Download Template** | 8-sheet blank template |
| Strategy Map | **Export** → **Export Current Data** | Full hierarchy Excel export |
| Manage tab | **Import** | Upload sheet → save this layer |
| Manage tab | **Export** → **Download Template** | Single-layer blank template |
| Manage tab | **Export** → **Export Current Data** | Filtered layer export |
| Strategy Map | View mode dropdown | Table / Cascade / Foci / Flow |
| Strategy Map | Table cell click | Open detail panel |
| Manage tab | **Add …** | Create new item |
| Manage tab | Speech bubble | Check-in sheet |
| Manage tab | Pencil | Edit dialog |
| Manage tab | **AI Suggest** (Strategy) | AI-generated description |
| Detail panel | **Save** | Persist edits |
| Detail panel | **Activity** tab | Log/view check-ins |
| Detail panel | **Docs** tab | Add external links |
| Documents | **Add Link** | Attach URL to layer item |
| AI Insights | **Generate Insights** | Run portfolio analysis |

---

## Admin / configuration (optional)

| Feature | Requires |
|---------|----------|
| Basic strategy CRUD, map, reviews | Nothing extra |
| AI Insights & AI Suggest | `OPENAI_API_KEY` in server `.env` |
| Initiative document links | Documents module + links created in Document Management |
| Per-workspace ref codes | Automatic (DB sequencer; backfill on page load) |
| Bulk import | Excel template + **Import** (Strategy Map or Manage tabs) |

See `.env.example` for OpenAI and database variables.
