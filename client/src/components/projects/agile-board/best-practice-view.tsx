import { useState } from "react";
import { AGILE_PALETTE as C } from "./palette";

export function BestPracticeView() {
  const [activeSection, setActiveSection] = useState("overview");
  const sections = [
    { id: "overview", title: "Overview" },
    { id: "epics", title: "Writing Great Epics" },
    { id: "stories", title: "User Story Best Practice" },
    { id: "backlog", title: "Backlog Refinement" },
    { id: "sprint", title: "Sprint Ceremonies" },
    { id: "board", title: "Running the Board" },
    { id: "burndown", title: "Reading Burndown Charts" },
    { id: "defects", title: "Defect Management" },
    { id: "workstream", title: "Multi-Workstream at Scale" },
    { id: "dod", title: "Definition of Done" },
  ];

  const content: Record<string, { title: string; intro: string; blocks: any[] }> = {
    overview: {
      title: "Jiganto Agile Board - How to Get the Best Out of It",
      intro: "Jiganto's Agile Board is designed to give you full traceability from a strategic objective all the way through to delivered code in production. This guide will help your team adopt it quickly and run high-quality Scrum ceremonies from day one.",
      blocks: [
        { heading: "The Golden Rule", type: "highlight", text: "Every item in the board must link upward to an Epic -> Initiative -> Strategic Objective. If you can't explain why a story exists in terms of business value, it shouldn't be in the backlog." },
        { heading: "The Hierarchy at a Glance", type: "chain", items: ["Strategic Objective / OKR", "Initiative", "Epic", "Feature (optional)", "User Story (PBI)", "Task / Sub-Task", "Defect"] },
        { heading: "T-Shirt Sizing vs Story Points", type: "tip", text: "T-shirt sizes (XS -> XXL) are great for quick relative sizing. Story points give precision for velocity tracking. Use both: T-shirt for epics and features, story points for sprint stories." },
        { heading: "Quick-Start Checklist", type: "checklist", items: ["Set up your Workstreams before creating Epics", "Create at least one Epic per Initiative", "Write all User Stories in the 'As a... I want... So that...' format", "Add Acceptance Criteria before a story enters a sprint", "Run Backlog Refinement mid-sprint", "Assign a Scrum Master to each active Workstream", "Use the Burndown chart daily"] },
      ],
    },
    epics: {
      title: "Writing Great Epics",
      intro: "An Epic is a large, outcomes-focused body of work. It should describe a business capability or customer outcome - not a technical task.",
      blocks: [
        { heading: "The Epic Formula", type: "formula", text: "\"We need to build [capability] so that [business outcome], which we will know is successful when [measurable result].\"" },
        { heading: "Good vs Bad Epics", type: "table", rows: [["Bad Epic", "Good Epic"], ["Implement SAP", "Enable Sales Reps to Create and Track Orders End-to-End"], ["Fix the login", "Deliver Secure, SSO for All Enterprise Users"], ["Build reports", "Give Portfolio Managers Real-Time Initiative Progress Visibility"]] },
      ],
    },
    stories: {
      title: "User Story Best Practice",
      intro: "A User Story is the atomic unit of delivery. It represents one piece of user value that can be built, tested, and demonstrated within a single sprint.",
      blocks: [
        { heading: "The Standard Format", type: "formula", text: "\"As a [specific role], I want [clear goal] so that [tangible benefit].\"" },
        { heading: "INVEST Criteria", type: "table", rows: [["Letter", "Quality", "What it means"], ["I", "Independent", "Can be developed and tested without waiting for another story"], ["N", "Negotiable", "Scope is flexible; acceptance criteria pin down the detail"], ["V", "Valuable", "Delivers something a user or stakeholder can recognise"], ["E", "Estimable", "Small enough that the team can size it"], ["S", "Small", "Fits entirely within one sprint"], ["T", "Testable", "Acceptance criteria are clear and unambiguous"]] },
      ],
    },
    backlog: {
      title: "Backlog Refinement",
      intro: "Refinement is not a one-off activity. Run it mid-sprint, weekly, as an ongoing team habit.",
      blocks: [
        { heading: "When to Refine", type: "tip", text: "Hold a 60-90 minute refinement session mid-sprint. Goal: ensure top 2 sprints' worth of stories are estimated, have AC, and are dependency-checked." },
        { heading: "Refinement Checklist", type: "checklist", items: ["Title in user story format", "Linked to an Epic", "Acceptance Criteria added (minimum 2)", "Dependencies identified", "Estimated (points or T-shirt)", "Small enough for one sprint", "Assignee suggested"] },
      ],
    },
    sprint: {
      title: "Running Effective Sprint Ceremonies",
      intro: "Four ceremonies make Scrum work. Each has a specific purpose.",
      blocks: [
        { heading: "Sprint Planning", type: "table", rows: [["Aspect", "Guidance"], ["Duration", "2 hours per sprint week"], ["Input", "Refined backlog; team capacity; velocity"], ["Output", "Sprint backlog committed; sprint goal set"]] },
        { heading: "Daily Stand-Up (15 mins max)", type: "checklist", items: ["What did I complete yesterday?", "What will I work on today?", "What is blocking me?", "Review the Sprint Board together", "Surface blockers immediately"] },
      ],
    },
    board: {
      title: "Running the Scrum Board Like a Pro",
      intro: "The board is a live radiator of sprint health. It should reflect reality at all times.",
      blocks: [
        { heading: "WIP Limits Matter", type: "highlight", text: "Work-in-Progress limits are not bureaucracy - they are a flow mechanism. Aim for WIP <= team size." },
        { heading: "Column Discipline", type: "table", rows: [["Column", "Entry Criteria", "Exit Criteria"], ["To Do", "Story in sprint", "Dev picks it up"], ["In Progress", "Dev coding", "PR raised"], ["Review", "PR raised", "PR approved"], ["Testing", "In QA", "All AC verified"], ["Done", "All AC met", "Sprint review demonstrated"]] },
      ],
    },
    burndown: {
      title: "Reading Burndown Charts",
      intro: "The burndown chart is one of the most powerful tools in a Scrum Master's kit.",
      blocks: [
        { heading: "Common Patterns", type: "table", rows: [["Pattern", "What it means", "Action"], ["Flat for 3+ days", "Stories blocked", "Investigate blockers"], ["Sharp drop Day 1", "Stories too small", "Re-examine sizing"], ["Actual above ideal", "Over-committed", "Reduce next sprint"], ["Cliff-drop last 2 days", "Hero mode", "Coach incremental completion"]] },
      ],
    },
    defects: {
      title: "Defect Management Best Practice",
      intro: "Defects are first-class backlog items that compete for sprint capacity.",
      blocks: [
        { heading: "The Defect Lifecycle", type: "chain", items: ["New (raised)", "Triaged", "In Progress", "Fixed", "Verified", "Closed"] },
        { heading: "SLA Guidelines", type: "table", rows: [["Severity", "Fix SLA", "Board Action"], ["Critical", "Same sprint, ASAP", "Pull existing story out"], ["Major", "Current sprint", "Add at next stand-up"], ["Minor", "Next sprint", "Prioritise at refinement"], ["Trivial", "Backlog", "Label and park"]] },
      ],
    },
    workstream: {
      title: "Managing Multiple Workstreams at Scale",
      intro: "For large enterprise programmes, Jiganto's workstream model allows parallel delivery without losing visibility.",
      blocks: [
        { heading: "When to Create a Workstream", type: "tip", text: "Create a separate workstream when: the team is distinct, the backlog is distinct, or the delivery cadence differs." },
        { heading: "Stand-Up Structure", type: "table", rows: [["Team Size", "Structure"], ["Up to 8", "Single stand-up, 15 mins"], ["8-20", "Per-workstream + weekly Scrum of Scrums"], ["20+", "Per-workstream + daily Scrum of Scrums"], ["SAP programme", "Per-process-area + integration stand-up"]] },
      ],
    },
    dod: {
      title: "Definition of Done - Your Quality Gate",
      intro: "The Definition of Done (DoD) is a shared agreement on what 'Done' really means.",
      blocks: [
        { heading: "Story DoD", type: "checklist", items: ["All AC checked off", "Unit tests passing", "Code reviewed & merged", "Integration tested", "No open Critical/Major defects", "PO accepted", "Board card moved to Done", "Epic progress updated"] },
        { heading: "Sprint DoD", type: "checklist", items: ["All committed stories Done", "Burndown reaches zero", "Sprint Review completed", "Retrospective held", "Velocity recorded", "Defect count reviewed", "Release notes updated"] },
      ],
    },
  };

  const renderBlock = (block: any, i: number) => {
    switch (block.type) {
      case "highlight":
        return <div key={i} style={{ background: `${C.amber}0D`, border: `1.5px solid ${C.amber}33`, borderLeft: `4px solid ${C.amber}`, borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.grey800, marginBottom: 4 }}>{block.heading}</div>
          <div style={{ fontSize: 12.5, color: C.grey600, lineHeight: 1.6 }}>{block.text}</div>
        </div>;
      case "tip":
        return <div key={i} style={{ background: `${C.blue}0A`, border: `1.5px solid ${C.blue}22`, borderLeft: `4px solid ${C.blue}`, borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.grey800, marginBottom: 4 }}>{block.heading}</div>
          <div style={{ fontSize: 12.5, color: C.grey600, lineHeight: 1.6 }}>{block.text}</div>
        </div>;
      case "formula":
        return <div key={i} style={{ background: C.grey50, border: `1.5px solid ${C.grey200}`, borderRadius: 8, padding: "16px 20px", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.grey800, marginBottom: 8 }}>{block.heading}</div>
          <div style={{ fontSize: 14, color: C.blue, fontWeight: 600, fontStyle: "italic", lineHeight: 1.6 }}>{block.text}</div>
        </div>;
      case "chain":
        return <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.grey800, marginBottom: 8 }}>{block.heading}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {block.items.map((item: string, j: number) => (
              <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ background: C.blueLight, color: C.blue, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{item}</span>
                {j < block.items.length - 1 && <span style={{ color: C.grey300, fontSize: 14 }}>{"->"}</span>}
              </span>
            ))}
          </div>
        </div>;
      case "checklist":
        return <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.grey800, marginBottom: 8 }}>{block.heading}</div>
          {block.items.map((item: string, j: number) => (
            <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <span style={{ color: C.green, fontSize: 14, marginTop: 1 }}>{"✓"}</span>
              <span style={{ fontSize: 12.5, color: C.grey600, lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>;
      case "table":
        return <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.grey800, marginBottom: 8 }}>{block.heading}</div>
          <div style={{ border: `1px solid ${C.grey200}`, borderRadius: 8, overflow: "hidden" }}>
            {block.rows.map((row: string[], ri: number) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: `repeat(${row.length},1fr)`, padding: "7px 12px", background: ri === 0 ? C.grey50 : "", borderBottom: ri < block.rows.length - 1 ? `1px solid ${C.grey100}` : "none", fontSize: ri === 0 ? 10 : 12, fontWeight: ri === 0 ? 700 : 400, color: ri === 0 ? C.grey500 : C.grey700, gap: 8 }}>
                {row.map((cell, ci) => <span key={ci}>{cell}</span>)}
              </div>
            ))}
          </div>
        </div>;
      default: return null;
    }
  };

  const currentContent = content[activeSection] || content.overview;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ width: 240, borderRight: `1px solid ${C.grey200}`, background: C.grey50, padding: "16px 0", overflowY: "auto", flexShrink: 0 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} data-testid={`bp-nav-${s.id}`}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", width: "100%", border: "none", background: activeSection === s.id ? C.white : "transparent", borderRight: activeSection === s.id ? `3px solid ${C.blue}` : "3px solid transparent", cursor: "pointer", fontSize: 13, color: activeSection === s.id ? C.blue : C.grey600, fontWeight: activeSection === s.id ? 700 : 500, transition: "all 0.15s", textAlign: "left" }}>
            {s.title}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.grey800, marginBottom: 8 }}>{currentContent.title}</h2>
        <p style={{ fontSize: 13, color: C.grey500, lineHeight: 1.7, marginBottom: 20 }}>{currentContent.intro}</p>
        {currentContent.blocks.map((block, i) => renderBlock(block, i))}
      </div>
    </div>
  );
}
