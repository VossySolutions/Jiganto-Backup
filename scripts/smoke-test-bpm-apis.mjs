/**
 * Smoke test BPM module APIs.
 * Usage: npm run smoke:bpm  (dev server must be running)
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";
const LOGIN_PRESET = process.env.SMOKE_LOGIN_PRESET ?? "si_super_admin";
const TENANT = 1;

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
  try {
    const res = await fetch(`${BASE}/api/login?preset=${encodeURIComponent(LOGIN_PRESET)}`, { redirect: "manual" });
    const cookie = cookieHeaderFromResponse(res);
    if (cookie) return cookie;
    const res2 = await fetch(`${BASE}/api/login`, { redirect: "manual" });
    return cookieHeaderFromResponse(res2);
  } catch {
    return "";
  }
}

async function call(method, path, { cookie, body } = {}) {
  const url = `${BASE}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 200) };
}

const failures = [];

function expectOk(label, result, allowed = [200, 201]) {
  if (!allowed.includes(result.status)) {
    failures.push({ label, status: result.status, detail: result.text });
    console.log(`  FAIL ${label} → ${result.status} ${result.text}`);
    return false;
  }
  console.log(`  OK   ${label} → ${result.status}`);
  return true;
}

async function main() {
  console.log(`\nBPM API smoke test @ ${BASE}\n`);
  const cookie = await obtainAuthCookie();
  if (!cookie) {
    console.warn("Warning: no auth cookie — expect 401 on protected routes\n");
  }

  const qs = `tenantId=${TENANT}`;

  const endpoints = [
    ["GET", `/api/bpm/diagrams?${qs}`],
    ["GET", `/api/bpm/libraries?${qs}`],
    ["GET", `/api/bpm/templates?${qs}`],
    ["GET", `/api/bpml/templates?${qs}`],
    ["GET", `/api/bpml/entries?${qs}&templateId=0`],
    ["GET", `/api/bpm/portal-settings?${qs}`],
    ["GET", `/api/bpm/template-submissions?${qs}`],
    ["GET", `/api/portal/menu-nodes?${qs}`],
    ["GET", `/api/portal/assignments?${qs}`],
    ["GET", `/api/process-resources?${qs}`],
    ["GET", `/api/org-charts?${qs}`],
    ["GET", `/api/org-chart-templates?${qs}`],
    ["GET", `/api/frameworks?${qs}`],
  ];

  for (const [method, path] of endpoints) {
    const result = await call(method, path, { cookie });
    const allowed = path.includes("/api/bpml/entries?") ? [200, 400] : [200, 201];
    expectOk(`${method} ${path}`, result, allowed);
  }

  const libs = await call("GET", `/api/bpm/libraries?${qs}`, { cookie });
  if (libs.status === 200 && Array.isArray(libs.json) && libs.json[0]?.id) {
    const libId = libs.json[0].id;
    await call("GET", `/api/bpm/portal-settings?${qs}&libraryId=${libId}`, { cookie }).then(r =>
      expectOk(`GET portal-settings (library ${libId})`, r),
    );
  }

  const diagrams = await call("GET", `/api/bpm/diagrams?${qs}`, { cookie });
  if (diagrams.status === 200 && Array.isArray(diagrams.json) && diagrams.json[0]?.id) {
    const dId = diagrams.json[0].id;
    for (const sub of [
      `/api/bpm/diagrams/${dId}/step-links`,
      `/api/bpm/diagrams/${dId}/test-coverage`,
      `/api/bpm/diagrams/${dId}/process-report`,
    ]) {
      const r = await call("GET", sub, { cookie });
      expectOk(`GET ${sub}`, r);
    }
  }

  const bpml = await call("GET", `/api/bpml/templates?${qs}`, { cookie });
  if (bpml.status === 200 && Array.isArray(bpml.json) && bpml.json[0]?.id) {
    const tId = bpml.json[0].id;
    const r = await call("GET", `/api/bpml/entries?${qs}&templateId=${tId}`, { cookie });
    expectOk(`GET bpml entries (template ${tId})`, r);
    if (r.status === 200 && Array.isArray(r.json) && r.json[0]?.id) {
      const eId = r.json[0].id;
      const h = await call("GET", `/api/bpml/entries/${eId}/history`, { cookie });
      expectOk(`GET bpml entry history (${eId})`, h);
    }
  }

  console.log("");
  if (failures.length) {
    console.error(`FAILED: ${failures.length} endpoint(s)`);
    process.exit(1);
  }
  console.log("All BPM smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
