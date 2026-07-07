Hi, thanks for sharing your requirements after the demo. We reviewed each point against Jiganto as it works today.

1. Resources

- Which resources and skills does the Company or Project have?

Yes, with some split across modules. Resource Management has a skills matrix with proficiency levels, skill categories when managing skills, and multi-criteria skills search. Resource Planning has a skills inventory with distribution, top demanded skills, and a resource skills matrix. Per project, the project resource tracker in the Projects module shows who is allocated to that project. Company-wide people and skills sit mainly under Resource Management, deeper skills reporting under Resource Planning.

- What are these resources currently working on?

Yes. The allocations timeline in Resource Management shows who is booked on which project over the next 12 weeks. The capacity board shows project allocations and CRM opportunity bookings together, with confirmed and tentative utilisation. The Pipeline tab under Resource Management is separate, it shows upcoming CRM pipeline demand and resource-days needed, not current assignments.

- Where are the RESOURCE gaps and therefore what skills need to be recruited or which resources can be re-allocated from other projects?

Partially. Resource Management has skills gap analysis linked to a CRM resource plan, matching mainly by job title today, not full skill proficiency requirements. Resource Planning has a demand vs supply matrix with pipeline toggle, cell drill-down, and CSV or PDF export. Recruitment forecast in Resource Planning shows role, grade, headcount, dates, cost, and status, with HR CSV or PDF export. Bench management in Resource Planning matches bench people to pipeline demand and supports assign. There is no full end-to-end recruitment requisition workflow from gap to hire, and raising a recruitment request directly from a specific project gap in Resource Management is limited.

- Which resources are on the Bench, and therefore available to be booked onto a project?

Partially. Resource Management dashboard has an On the Bench KPI for zero allocation in the current week, a bench status filter on the people list, and bench or burnout lists in Reports for utilisation under 75%. Resource Planning has a dedicated bench tab with days on bench, cost, pipeline match, and assign actions. Bench logic is not fully unified, the dashboard KPI and people bench filter use slightly different rules, and there is no single spare-capacity export in Resource Management today. Most bench actions sit in Resource Planning.

2. CRM

- Sales forecast report by Sales person or Sales team?

Partially for salesperson, no for sales team. CRM Forecasting has a time period forecast matrix where you can filter by owner, group by owner, and export CSV. Opportunities and leads can be grouped by owner separately. Per-user forecast records exist in the API and can be created from the forecasting screen, but there is no list or edit UI for those records and no rollup view. There is no sales team entity or team-level forecast report. There is also no single combined report of leads plus open opportunities by salesperson.

- Which opportunities are going to close and when?

Yes. Each opportunity has an expected close date. You can see it on the opportunities list, pipeline kanban, forecast matrix cells and sublines, Closing This Quarter on the forecasting dashboard, and the resource plan timeline. Opportunities can be filtered to closing this month on the Opportunities tab. There is no single cross-pipeline closing calendar for all deals in one view.

- Which resources are needed for each opportunity?

Yes. CRM has a Resource Plan tab where you build phases, roles, rates, timeline, and scenarios before a deal is won. You can create a plan from the opportunity form. Plans appear on the capacity board and feed Resource Planning pipeline sync. You can also create a finance project budget from a resource plan when the opportunity is linked to a project.

3. Projects

- The ability to look at status reports per Project Manager or Portfolio manager?

Partially for Project Manager, not for Portfolio manager. Portfolio Reports has a summary table with a PM column for all projects. Custom reports can filter or group projects by PM name. Each project has a basic PM status tool for free-text title and summary. There is no dedicated screen to browse or generate status reports filtered by PM in one click, and no status reporting filtered by portfolio manager owner, even though portfolio owner exists in the data model.

- What are the top risks and issues per project or portfolio?

Per project, yes. The 360 project report shows top 5 risks and top 5 issues, and each project has full RAID logs. At portfolio level, consolidated RAID lists open items across projects and the health matrix includes a risk RAG per project. There is no portfolio-level top 5 risks and issues summary in one weekly showcase report.

- What are the outstanding resources required per project or portfolio?

Partially. The project resource tracker shows who is already assigned to a project. The portfolio dashboard shows resource utilisation and overload. The health matrix flags projects with no team members. Organisation-level recruitment and demand gaps live in Resource Planning. There is no explicit open roles or unfilled needs view per project or portfolio in the Projects or Portfolio UI today.

- Ability to look at level one project plan per project or portfolio showing phases and milestones?

Per project, yes with nuance. Gantt supports phases, tasks, milestones, dependencies, and WBS. The 360 project report has a Level 1 Plan section with phases only, and a separate Milestones section. The portfolio milestone register lists milestones across projects. There is no single level-one plan across all projects and programmes grouped by portfolio manager with phases and L1 milestones together.