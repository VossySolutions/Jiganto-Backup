/**
 * Shared auth helper for smoke tests.
 * Supports: SMOKE_BEARER_TOKEN, Supabase password grant, dev session cookie.
 */
import "dotenv/config";

export function cookieHeaderFromResponse(res) {
  const parts = [];
  if (typeof res.headers.getSetCookie === "function") {
    for (const c of res.headers.getSetCookie()) {
      const pair = c.split(";")[0]?.trim();
      if (pair) parts.push(pair);
    }
  } else {
    const raw = res.headers.get("set-cookie");
    if (raw) {
      for (const c of raw.split(/,(?=\s*[^;]+=)/)) {
        const pair = c.split(";")[0]?.trim();
        if (pair) parts.push(pair);
      }
    }
  }
  return parts.join("; ");
}

function normalizeSupabaseUrl(url) {
  if (!url) return null;
  return url.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

export async function obtainSupabaseBearer() {
  const direct = process.env.SMOKE_BEARER_TOKEN?.trim();
  if (direct) return direct;

  const email = process.env.SMOKE_SUPABASE_EMAIL?.trim();
  const password = process.env.SMOKE_SUPABASE_PASSWORD?.trim();
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const anon = process.env.SUPABASE_ANON_KEY?.trim();
  if (!email || !password || !url || !anon) return "";

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return data.access_token ?? "";
  } catch {
    return "";
  }
}

export async function obtainDevSessionCookie(base, loginPreset = "si_super_admin") {
  const loginUrl = `${base}/api/login?preset=${encodeURIComponent(loginPreset)}`;
  try {
    const res = await fetch(loginUrl, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const cookie = cookieHeaderFromResponse(res);
    if (cookie && (res.status === 302 || res.status === 200)) return { cookie, via: "preset" };
    if (res.status === 403) {
      const res2 = await fetch(`${base}/api/login`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      const cookie2 = cookieHeaderFromResponse(res2);
      if (cookie2 && (res2.status === 302 || res2.status === 200)) return { cookie: cookie2, via: "default" };
      return { cookie: "", via: "none" };
    }
    const res2 = await fetch(`${base}/api/login`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const cookie2 = cookieHeaderFromResponse(res2);
    if (cookie2 && (res2.status === 302 || res2.status === 200)) return { cookie: cookie2, via: "default" };
    return { cookie: "", via: "none" };
  } catch {
    return { cookie: "", via: "none" };
  }
}

/** @returns {{ bearer: string, cookie: string, mode: string, via: string }} */
export async function obtainSmokeAuth(base) {
  const bearerDirect = process.env.SMOKE_BEARER_TOKEN?.trim();
  if (bearerDirect) {
    return { bearer: bearerDirect, cookie: "", mode: "bearer", via: "SMOKE_BEARER_TOKEN" };
  }

  let authMode = "dev-session";
  try {
    const cfgRes = await fetch(`${base}/api/auth/config`, { signal: AbortSignal.timeout(10000) });
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      authMode = cfg.mode ?? authMode;
    }
  } catch { /* */ }

  if (authMode === "supabase") {
    const bearer = await obtainSupabaseBearer();
    if (bearer) {
      return { bearer, cookie: "", mode: "supabase", via: "supabase-password" };
    }
  }

  const preset = process.env.SMOKE_LOGIN_PRESET ?? "si_super_admin";
  const { cookie, via } = await obtainDevSessionCookie(base, preset);
  return { bearer: "", cookie, mode: authMode, via: cookie ? via : "none" };
}

export async function smokeCall(base, method, path, { bearer, cookie, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (cookie) headers.Cookie = cookie;
  const init = { method, headers };
  if (body !== undefined && body !== null) init.body = JSON.stringify(body);
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 400) };
}
