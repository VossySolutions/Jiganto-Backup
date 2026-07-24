# Tables inventory — Monday board parity

**Full Implement** = mount [`MondayBoardShell`](../client/src/components/board/MondayBoardShell.tsx) (Main Table / Add view tabs, Person, view switcher, rule Filter/Sort, Group by, Pin, Columns, Views, More, `MondayTable` inline edit). Only columns and entity actions differ.

The Columns menu is identical on every board because the shell supplies it: Add column
(choose type), Manage custom fields, and an Edit … labels entry per status/select column.
Custom columns are defined in `crm_custom_fields` under the board's `entityType` and their
cells live in `board_field_values` (`/api/board-field-values`), so a board needs no schema
change of its own. Boards that already render their own `custom_*` columns pass
`ownsCustomColumns`.

**PARTIAL** = table chrome only where noted; keep specialized primary UX.

## Full Implement

- Customer Management / Customers table - Full Implement (`MondayBoardShell`)
- Business / Strategy table - Full Implement
- Business / Goals table - Full Implement
- Business / Objectives table - Full Implement
- Business / Initiatives table - Full Implement
- Business / OKRs table - Full Implement
- Business / KPIs table - Full Implement
- Business / Governance table - Full Implement
- Clients table - Full Implement
- CRM / Leads table - Full Implement (reference / gold standard on same shell)
- CRM / Opportunities table - Full Implement
- CRM / Customers (Accounts) table - Full Implement
- CRM / Contacts table - Full Implement
- CRM / Contracts table - Full Implement
- Finance / Budgets table - Full Implement
- Finance / Expenses table - Full Implement
- Finance / Invoices table - Full Implement
- Resources / People table - Full Implement
- Resources / Pipeline table - Full Implement
- Portfolio / Programmes table - Full Implement
- Projects / Projects list table - Full Implement
- Projects / RAIDD log table - Full Implement
- Projects / Deliverables table - Full Implement
- Service Desk / Tickets table - Full Implement
- Help Desk / Tickets table - Full Implement
- e-Sign / Requests table - Full Implement
- Test / Cases table - Full Implement
- Test / Defect triage table - Full Implement
- BPM / Diagrams table - Full Implement
- BPM / Library (frameworks) table - Full Implement
- BPM / BPML entries table - Full Implement

## PARTIAL

- Finance / Rate cards table — only table format will be implemented; keep nested rate-item editor as-is (no Board/Gantt/Calendar/etc.)
- Timesheets / Periods table — only table format for the periods list; weekly timesheet entry grid stays unchanged
- Resources / Rate cards table — only table format will be implemented; keep nested rate-item editor as-is
- Projects / Milestones table — only table format as an alternate view; Gantt/timeline stays primary
- Tasks table — only polish/align table format with Leads chrome; keep existing multi-view system (don’t replace Board/Calendar/Gantt)
- Surveys / Survey list table — only table format for the survey catalog list; builder/results UX stays as-is
- Workspaces / Database table views — only align table chrome/CSS where useful; keep existing workspace board/saved-views system
- Test / Scenarios table — only table format for the scenario list; keep master–detail / form panel
- Test / Cycles table — only optional compact table format for the cycle list; keep metrics/action cards
- Test / Traceability (RTM) table — only table format for requirement rows; keep link/coverage detail UX (no full Leads views)
- Templates / Templates list table — only optional table format as alternate; thumbnail card catalog stays primary
