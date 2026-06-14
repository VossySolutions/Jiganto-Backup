import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { canRpRead, useRpPersona, withRpPersona } from "./persona-context";
import type {
  RpAiInsights, RpAiResponse, RpAutoMatchResponse, RpBench, RpDashboard, RpDemandSupply,
  RpHeatMap, RpPipeline, RpRecruitment, RpScheduler, RpScenarios, RpSkillsInventory,
} from "./types";

const RP_STALE_MS = 30_000;

function rpUrl(path: string, persona: ReturnType<typeof useRpPersona>) {
  return withRpPersona(path, persona);
}

function invalidateRp(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").includes("/api/resource-planning") });
}

export function useRpDashboard(opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "dashboard");
  return useQuery<RpDashboard>({
    queryKey: [rpUrl("/api/resource-planning/dashboard", persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpDemandSupply(includePipeline: boolean, practice = "all", opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "demand-supply");
  const params = new URLSearchParams({ includePipeline: String(includePipeline), practice });
  return useQuery<RpDemandSupply>({
    queryKey: [rpUrl(`/api/resource-planning/demand-supply?${params}`, persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpHeatMap(weeks = 16, granularity: "week" | "month" | "quarter" = "week", opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "heatmap");
  return useQuery<RpHeatMap>({
    queryKey: [rpUrl(`/api/resource-planning/heatmap?weeks=${weeks}&granularity=${granularity}`, persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpScheduler(weeks = 16, opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "scheduler");
  return useQuery<RpScheduler>({
    queryKey: [rpUrl(`/api/resource-planning/scheduler?weeks=${weeks}`, persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpSkillsInventory(searchTerm = "", opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "skills");
  const q = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : "";
  return useQuery<RpSkillsInventory>({
    queryKey: [rpUrl(`/api/resource-planning/skills-inventory${q}`, persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpPipeline(scenario: "expected" | "best" | "worst" = "expected", opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "pipeline");
  return useQuery<RpPipeline>({
    queryKey: [rpUrl(`/api/resource-planning/pipeline?scenario=${scenario}`, persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpRecruitment(opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "recruitment");
  return useQuery<RpRecruitment>({
    queryKey: [rpUrl("/api/resource-planning/recruitment", persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpBench(opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "bench");
  return useQuery<RpBench>({
    queryKey: [rpUrl("/api/resource-planning/bench", persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpScenarios(opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "scenarios");
  return useQuery<RpScenarios>({
    queryKey: [rpUrl("/api/resource-planning/scenarios", persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpAiInsights(opts?: { enabled?: boolean }) {
  const persona = useRpPersona();
  const allowed = canRpRead(persona, "ai");
  return useQuery<RpAiInsights>({
    queryKey: [rpUrl(`/api/resource-planning/ai/insights?persona=${persona}`, persona)],
    staleTime: RP_STALE_MS,
    enabled: opts?.enabled !== false && allowed,
  });
}

export function useRpCreateBooking() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("POST", rpUrl("/api/resource-planning/bookings", persona), body);
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpUpdateBooking() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Record<string, unknown>) => {
      const res = await apiRequest("PUT", rpUrl(`/api/resource-planning/bookings/${id}`, persona), body);
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpMoveBooking() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resourceId, startWeek }: { id: number; resourceId: number; startWeek: number }) => {
      const res = await apiRequest("POST", rpUrl(`/api/resource-planning/bookings/${id}/move`, persona), { resourceId, startWeek });
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpExtendBooking() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, endWeek }: { id: number; endWeek: number }) => {
      const res = await apiRequest("POST", rpUrl(`/api/resource-planning/bookings/${id}/extend`, persona), { endWeek });
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpDeleteBooking() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", rpUrl(`/api/resource-planning/bookings/${id}`, persona));
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpPromoteBooking() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", rpUrl(`/api/resource-planning/bookings/${id}/promote`, persona));
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpPromoteOpportunity() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", rpUrl(`/api/resource-planning/pipeline/${id}/promote`, persona));
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpAutoMatch() {
  const persona = useRpPersona();
  return useMutation<RpAutoMatchResponse, Error, { roleName: string; startDate: string; endDate: string }>({
    mutationFn: async (body) => {
      const res = await apiRequest("POST", rpUrl("/api/resource-planning/auto-match", persona), body);
      return res.json();
    },
  });
}

export function useRpRecruitmentAction() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("POST", rpUrl(`/api/resource-planning/recruitment/${id}/status`, persona), { status });
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpAiQuery() {
  const persona = useRpPersona();
  return useMutation<RpAiResponse, Error, string>({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", rpUrl("/api/resource-planning/ai/query", persona), { query });
      return res.json();
    },
  });
}

export function useRpCreateScenario() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; scenarioType?: string }) => {
      const res = await apiRequest("POST", rpUrl("/api/resource-planning/scenarios", persona), body);
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpBenchAssign() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; projectName: string; role?: string; opportunityId?: number }) => {
      const res = await apiRequest("POST", rpUrl(`/api/resource-planning/bench/${id}/assign`, persona), body);
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}

export function useRpPipelineSync() {
  const persona = useRpPersona();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", rpUrl("/api/resource-planning/pipeline/sync", persona));
      return res.json();
    },
    onSuccess: () => invalidateRp(qc),
  });
}
