import { fetchWithAuth } from "@/lib/queryClient";
import type { SurveyWithDetails, SurveyResponseWithAnswers, SurveyTemplate, ModulePoll } from "@shared/models/surveys";

export async function surveyFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(url, { credentials: "include", ...init });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch { /* non-json */ }
    throw new Error(`${res.status}: ${message}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Ensure list payloads are arrays even on partial failures. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export async function fetchSurveys(): Promise<SurveyWithDetails[]> {
  return asArray(await surveyFetchJson<SurveyWithDetails[]>("/api/surveys"));
}

export async function fetchSurvey(id: number): Promise<SurveyWithDetails> {
  return surveyFetchJson<SurveyWithDetails>(`/api/surveys/${id}`);
}

export async function fetchSurveyResponses(surveyId: number): Promise<SurveyResponseWithAnswers[]> {
  return asArray(await surveyFetchJson<unknown>(`/api/surveys/${surveyId}/responses`));
}

export async function fetchSurveyTemplates(): Promise<SurveyTemplate[]> {
  return asArray(await surveyFetchJson<SurveyTemplate[]>("/api/surveys/templates"));
}

export async function fetchModulePolls(): Promise<ModulePoll[]> {
  return asArray(await surveyFetchJson<ModulePoll[]>("/api/surveys/polls"));
}

export async function fetchModulePoll(id: number) {
  return surveyFetchJson<{
    id: number;
    question: string;
    options: string[];
    voteCounts: number[];
    totalVotes: number;
    anonymous: boolean;
    token?: string;
    status: string;
    votersByOption?: Record<number, { id: string | null; name: string | null }[]>;
    isClosed?: boolean;
  }>(`/api/surveys/polls/${id}`);
}

export async function fetchProjectPolls(projectId: number): Promise<ModulePoll[]> {
  return asArray(await surveyFetchJson<ModulePoll[]>(`/api/surveys/polls?projectId=${projectId}`));
}

export type SurveyResultsSummary = {
  completed: number;
  partial: number;
  notStarted: number;
  invited: number;
  invitees: { userId: string; status: "completed" | "partial" | "not_started" }[];
};

export async function fetchSurveyResultsSummary(surveyId: number): Promise<SurveyResultsSummary> {
  return surveyFetchJson(`/api/surveys/${surveyId}/results-summary`);
}
