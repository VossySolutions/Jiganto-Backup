import { fetchWithAuth } from "@/lib/queryClient";

export async function bpmFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
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

export async function bpmFetchFormData<T>(url: string, body: FormData): Promise<T> {
  const res = await fetchWithAuth(url, { method: "POST", body, credentials: "include" });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const parsed = await res.json();
      message = parsed.message ?? message;
    } catch { /* ignore */ }
    throw new Error(`${res.status}: ${message}`);
  }
  return res.json() as Promise<T>;
}
