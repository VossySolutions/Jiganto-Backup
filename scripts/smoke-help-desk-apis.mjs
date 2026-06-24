/**
 * Smoke test Help Desk module APIs.
 *
 * Usage:
 *   npm run smoke:help-desk
 *   SMOKE_BEARER_TOKEN=<jwt> npm run smoke:help-desk   # Supabase / production
 *
 * Without SMOKE_BEARER_TOKEN the script signs in via dev session cookie
 * (GET /api/login?preset=si_super_admin). Start the dev server first.
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";
const TENANT = process.env.SEED_TENANT_ID ?? "1";
const BEARER = process.env.SMOKE_BEARER_TOKEN ?? "";
const LOGIN_PRESET = process.env.SMOKE_LOGIN_PRESET ?? "si_super_admin";

const GET_ENDPOINTS = [
  "GET /api/help-desk/dashboard",
  "GET /api/help-desk/tickets",
  "GET /api/help-desk/sla-configs",
  "GET /api/help-desk/contracted-hours",
  "GET /api/help-desk/maintenance-windows",
  "GET /api/help-desk/reports",
  "GET /api/help-desk/reports?days=7",
  "GET /api/help-desk/portal/configs",
];

/** Parse Set-Cookie header(s) into a Cookie request header value. */
function cookieHeaderFromResponse(res) {
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

async function obtainAuthCookie() {
  if (BEARER) return "";

  const loginUrl = `${BASE}/api/login?preset=${encodeURIComponent(LOGIN_PRESET)}`;
  try {
    const res = await fetch(loginUrl, { redirect: "manual" });
    const cookie = cookieHeaderFromResponse(res);
    if (cookie && (res.status === 302 || res.status === 200)) {
      return cookie;
    }
    // Fallback: default dev login (no preset)
    const res2 = await fetch(`${BASE}/api/login`, { redirect: "manual" });
    return cookieHeaderFromResponse(res2);
  } catch (err) {
    console.warn(`(Dev login failed: ${err.message} — is the server running on ${BASE}?)\n`);
    return "";
  }
}

async function callEndpoint(spec, { cookie = "", body } = {}) {
  const [method, pathWithQuery] = spec.split(" ");
  const [path, existingQuery] = pathWithQuery.split("?");
  const qs = existingQuery ? `${existingQuery}&tenantId=${TENANT}` : `tenantId=${TENANT}`;
  const url = `${BASE}${path}?${qs}`;
  const headers = { "Content-Type": "application/json" };
  if (BEARER) headers.Authorization = `Bearer ${BEARER}`;
  if (cookie) headers.Cookie = cookie;
  const init = { method, headers };
  if (body && method !== "GET") init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { spec, status: res.status, ok: res.ok, size: text.length, json, text, contentType: res.headers.get("content-type") };
}

async function main() {
  console.log(`Smoke testing Help Desk APIs at ${BASE}...\n`);

  const cookie = await obtainAuthCookie();
  if (BEARER) {
    console.log("Using SMOKE_BEARER_TOKEN for auth.\n");
  } else if (cookie) {
    console.log(`Signed in via dev session (preset: ${LOGIN_PRESET}).\n`);
  } else {
    console.log(
      "No auth available — endpoints will return 401.\n" +
      "  • Start dev server: npm run dev\n" +
      "  • Or set SMOKE_BEARER_TOKEN for Supabase auth\n\n",
    );
  }

  let passed = 0;
  let failed = 0;
  let ticketId = null;
  let portalToken = null;

  for (const ep of GET_ENDPOINTS) {
    try {
      const r = await callEndpoint(ep, { cookie });
      if (r.status === 401) {
        failed++;
        console.log(`✗ ${r.spec} → 401 Unauthorized (auth missing or expired)`);
        continue;
      }
      if (r.status === 500) {
        failed++;
        const hint = r.text.includes("does not exist") ? " (run: npm run db:push)" : "";
        console.log(`✗ ${r.spec} → 500${hint} ${r.text.slice(0, 120)}`);
        continue;
      }
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++; else failed++;
      const preview = Array.isArray(r.json)
        ? `[${r.json.length}]`
        : r.json?.kpis
          ? `{kpis}`
          : r.json?.slaPerformance
            ? `{reports}`
            : "";
      console.log(`${mark} ${r.spec} → ${r.status} (${r.size}b) ${preview}`);
      if (ep === "GET /api/help-desk/tickets" && Array.isArray(r.json) && r.json[0]?.id) {
        ticketId = r.json[0].id;
      }
      if (ep === "GET /api/help-desk/portal/configs" && Array.isArray(r.json) && r.json[0]?.token) {
        portalToken = r.json[0].token;
      }
    } catch (e) {
      failed++;
      console.log(`✗ ${ep} → ERROR: ${e.message}`);
    }
  }

  if (ticketId) {
    const r = await callEndpoint(`GET /api/help-desk/tickets/${ticketId}`, { cookie });
    const mark = r.ok ? "✓" : "✗";
    if (r.ok) passed++; else failed++;
    console.log(`${mark} GET /api/help-desk/tickets/${ticketId} → ${r.status}`);
  }

  // PDF export
  try {
    const url = `${BASE}/api/help-desk/reports/pdf?days=30&tenantId=${TENANT}`;
    const headers = {};
    if (BEARER) headers.Authorization = `Bearer ${BEARER}`;
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(url, { headers });
    const ok = res.ok && (res.headers.get("content-type") ?? "").includes("pdf");
    if (ok) passed++; else failed++;
    console.log(`${ok ? "✓" : "✗"} GET /api/help-desk/reports/pdf → ${res.status} (${res.headers.get("content-type")})`);
  } catch (e) {
    failed++;
    console.log(`✗ GET /api/help-desk/reports/pdf → ERROR: ${e.message}`);
  }

  // Public portal — invalid token must be 404 (not an error)
  try {
    const r = await fetch(`${BASE}/api/portal/invalid-token-test`);
    const ok = r.status === 404;
    if (ok) passed++; else failed++;
    console.log(`${ok ? "✓" : "✗"} GET /api/portal/:token (invalid) → ${r.status} (expected 404)`);
  } catch (e) {
    failed++;
    console.log(`✗ GET /api/portal/:token (invalid) → ERROR: ${e.message}`);
  }

  // Public portal — valid token from seed/configs
  if (portalToken) {
    try {
      const r = await fetch(`${BASE}/api/portal/${portalToken}`);
      const ok = r.status === 200;
      if (ok) passed++; else failed++;
      console.log(`${ok ? "✓" : "✗"} GET /api/portal/:token (valid) → ${r.status}`);
    } catch (e) {
      failed++;
      console.log(`✗ GET /api/portal/:token (valid) → ERROR: ${e.message}`);
    }
  }

  // CSAT state endpoint
  try {
    const r = await fetch(`${BASE}/api/help-desk/csat/invalid-csat-token`);
    const ok = r.status === 410 || r.status === 200;
    if (ok) passed++; else failed++;
    console.log(`${ok ? "✓" : "✗"} GET /api/help-desk/csat/:token (invalid) → ${r.status}`);
  } catch (e) {
    failed++;
    console.log(`✗ GET /api/help-desk/csat/:token → ERROR: ${e.message}`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  if (failed > 0 && !cookie && !BEARER) {
    console.log("\nTip: run `npm run dev` then re-run smoke, or set SMOKE_BEARER_TOKEN.");
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
