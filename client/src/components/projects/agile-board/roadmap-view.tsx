import { computeRoadmapTimeline } from "@/lib/pm-agile-mappers";
import { AGILE_PALETTE as C, statusBg, statusColor } from "./palette";
import type { Epic, Sprint } from "./types";
import { AgileBadge, AgileProgressBar } from "./ui-primitives";

export function RoadmapView({ epics, sprints }: { epics: Epic[]; sprints: Sprint[] }) {
  const { months, epicBars } = computeRoadmapTimeline(epics);
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: C.grey800, marginBottom: 16 }}>Epic Roadmap</div>
      <div style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: `190px repeat(${months.length},1fr)`, borderBottom: `1px solid ${C.grey200}` }}>
          <div style={{ padding: "8px 14px", background: C.grey50, fontSize: 10, fontWeight: 700, color: C.grey500 }}>EPIC</div>
          {months.map(m => <div key={m.label} style={{ padding: "8px 4px", background: C.grey50, fontSize: 10, fontWeight: 600, color: C.grey500, textAlign: "center", borderLeft: `1px solid ${C.grey200}` }}>{m.label}</div>)}
        </div>
        {epics.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.grey400, fontSize: 13 }}>No epics yet. Create epics with start/end dates to populate the roadmap.</div>
        ) : epics.map(epic => {
          const tl = epicBars[epic.id] || { start: 0, width: Math.min(2, months.length) };
          return (
            <div key={epic.id} style={{ display: "grid", gridTemplateColumns: `190px repeat(${months.length},1fr)`, borderBottom: `1px solid ${C.grey100}` }}>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: epic.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: C.grey400 }}>{epic.id}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.grey800 }}>{epic.title.slice(0, 20)}{epic.title.length > 20 ? "..." : ""}</div>
                </div>
              </div>
              {months.map((_, mi) => {
                const inRange = mi >= tl.start && mi < tl.start + tl.width;
                const isStart = mi === tl.start;
                const isEnd = mi === tl.start + tl.width - 1;
                return (
                  <div key={mi} style={{ borderLeft: `1px solid ${C.grey100}`, padding: "6px 2px", display: "flex", alignItems: "center" }}>
                    {inRange && <div style={{ width: "100%", height: 26, background: epic.color, opacity: 0.85, borderRadius: `${isStart ? "6px" : "0"} ${isEnd ? "6px" : "0"} ${isEnd ? "6px" : "0"} ${isStart ? "6px" : "0"}`, display: "flex", alignItems: "center" }}>
                      {isStart && <span style={{ fontSize: 9, color: C.white, fontWeight: 700, paddingLeft: 6 }}>{epic.tshirt}</span>}
                    </div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: C.grey800, marginBottom: 12 }}>Sprint Calendar</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {sprints.map(sp => (
          <div key={sp.id} style={{ flex: "1 1 160px", background: C.white, border: `1.5px solid ${statusColor(sp.status)}33`, borderTop: `4px solid ${statusColor(sp.status)}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.grey800 }}>{sp.name}</div>
            <AgileBadge label={sp.status} color={statusBg(sp.status)} textColor={statusColor(sp.status)} dot small />
            <div style={{ fontSize: 11, color: C.grey400, margin: "6px 0" }}>{sp.start}<br />{sp.end}</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: statusColor(sp.status) }}>{sp.done}/{sp.points}</div>
            <div style={{ fontSize: 10, color: C.grey400, marginBottom: 6 }}>pts done</div>
            <AgileProgressBar pct={sp.points ? (sp.done / sp.points) * 100 : 0} color={statusColor(sp.status)} height={5} />
          </div>
        ))}
      </div>
    </div>
  );
}
