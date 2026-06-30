import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { fetchProjectPolls } from "@/lib/survey-api";
import { useSurveyColors, pollLink, fmtDate } from "@/lib/survey-constants";
import type { ModulePoll } from "@shared/models/surveys";

export function ProjectPollsCard({ projectId }: { projectId: number }) {
  const C = useSurveyColors();
  const { data: polls = [], isLoading } = useQuery<ModulePoll[]>({
    queryKey: ["/api/surveys/polls", "project", projectId],
    queryFn: () => fetchProjectPolls(projectId),
    enabled: !!projectId,
  });

  const active = polls.filter(p => p.status === "active").slice(0, 3);
  if (isLoading || active.length === 0) return null;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px", marginTop: 14 }} data-testid="project-polls-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.ink2 }}>📊 Active Polls</div>
        <Link href="/modules/surveys" style={{ fontSize: 12, color: C.teal, fontWeight: 600, textDecoration: "none" }}>View all →</Link>
      </div>
      {active.map(p => (
        <div key={p.id} style={{ padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.question}</div>
          <div style={{ fontSize: 11, color: C.ink4 }}>
            {p.status} · {fmtDate(p.createdAt?.toString())}
            {p.token && (
              <> · <a href={pollLink(p.token)} target="_blank" rel="noreferrer" style={{ color: C.teal }}>Open poll</a></>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
