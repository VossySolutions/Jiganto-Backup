/**
 * Smoke test Whiteboard module APIs.
 * Usage: npm run smoke:whiteboard  (dev server must be running)
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";
const LOGIN_PRESET = process.env.SMOKE_LOGIN_PRESET ?? "si_super_admin";
const BEARER = process.env.SMOKE_BEARER_TOKEN ?? "";

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
    const res = await fetch(loginUrl, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    const cookie = cookieHeaderFromResponse(res);
    if (cookie && (res.status === 302 || res.status === 200)) return cookie;
    const res2 = await fetch(`${BASE}/api/login`, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    return cookieHeaderFromResponse(res2);
  } catch {
    return "";
  }
}

async function call(method, path, { cookie, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (BEARER) headers.Authorization = `Bearer ${BEARER}`;
  if (cookie) headers.Cookie = cookie;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 300) };
}

const failures = [];
let boardId = null;
let noteId = null;
let shareToken = null;

function assert(label, cond, detail = "") {
  if (!cond) failures.push({ label, detail });
  const icon = cond ? "✓" : "✗";
  console.log(`  ${icon} ${label}${detail && !cond ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`\nWhiteboard API smoke test → ${BASE}\n`);

  try {
    await fetch(`${BASE}/api/login`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  } catch (e) {
    console.error("Dev server not reachable. Start with: npm run dev");
    process.exit(1);
  }

  const cookie = await obtainAuthCookie();
  if (!cookie && !BEARER) {
    console.error("Could not obtain auth session. Set SMOKE_BEARER_TOKEN or ensure dev login works.");
    process.exit(1);
  }

  console.log("List & create");
  let r = await call("GET", "/api/whiteboard", { cookie });
  assert("GET /api/whiteboard → 200", r.status === 200, `got ${r.status}: ${r.text}`);
  assert("GET /api/whiteboard returns array", Array.isArray(r.json), typeof r.json);

  r = await call("POST", "/api/whiteboard", {
    cookie,
    body: { name: `Smoke WB ${Date.now()}`, description: "API smoke test" },
  });
  assert("POST /api/whiteboard → 201", r.status === 201, `got ${r.status}: ${r.text}`);
  boardId = r.json?.id;
  assert("Board has id", !!boardId);

  if (!boardId) {
    console.error("\nAborting — could not create board");
    process.exit(1);
  }

  console.log("\nDetail & notes");
  r = await call("GET", `/api/whiteboard/${boardId}`, { cookie });
  assert("GET /api/whiteboard/:id → 200", r.status === 200, `got ${r.status}: ${r.text}`);
  assert("Detail has notes array", Array.isArray(r.json?.notes));

  r = await call("POST", `/api/whiteboard/${boardId}/notes`, {
    cookie,
    body: { text: "Smoke note", noteType: "idea", xPosition: 100, yPosition: 100 },
  });
  assert("POST notes → 201", r.status === 201, `got ${r.status}: ${r.text}`);
  noteId = r.json?.id;

  if (noteId) {
    r = await call("PATCH", `/api/whiteboard/notes/${noteId}`, {
      cookie,
      body: { text: "Updated smoke note", xPosition: 120 },
    });
    assert("PATCH note → 200", r.status === 200, `got ${r.status}: ${r.text}`);

    r = await call("POST", `/api/whiteboard/notes/${noteId}/duplicate`, { cookie });
    assert("POST duplicate → 201", r.status === 201, `got ${r.status}: ${r.text}`);
  }

  console.log("\nActivity & members & share");
  r = await call("GET", `/api/whiteboard/${boardId}/activity`, { cookie });
  assert("GET activity → 200", r.status === 200, `got ${r.status}`);

  r = await call("GET", `/api/whiteboard/users/search?q=admin`, { cookie });
  assert("GET users/search → 200", r.status === 200, `got ${r.status}: ${r.text}`);
  assert("users/search returns array", Array.isArray(r.json));

  r = await call("POST", `/api/whiteboard/${boardId}/share-token`, {
    cookie,
    body: { permission: "view" },
  });
  assert("POST share-token → 201", r.status === 201, `got ${r.status}: ${r.text}`);
  shareToken = r.json?.token;

  if (shareToken) {
    r = await call("GET", `/api/whiteboard/share/${shareToken}`);
    assert("GET share/:token → 200 (public)", r.status === 200, `got ${r.status}: ${r.text}`);
  }

  console.log("\nUpdate & cleanup");
  r = await call("PATCH", `/api/whiteboard/${boardId}`, {
    cookie,
    body: { description: "Updated via smoke test" },
  });
  assert("PATCH board → 200", r.status === 200, `got ${r.status}: ${r.text}`);

  if (noteId) {
    r = await call("DELETE", `/api/whiteboard/notes/${noteId}`, { cookie });
    assert("DELETE note → 200", r.status === 200, `got ${r.status}: ${r.text}`);
  }

  r = await call("DELETE", `/api/whiteboard/${boardId}`, { cookie });
  assert("DELETE board → 200", r.status === 200, `got ${r.status}: ${r.text}`);

  r = await call("GET", `/api/whiteboard/${boardId}`, { cookie });
  assert("GET deleted board → 404", r.status === 404, `got ${r.status}`);

  console.log("\nAuth guard");
  r = await call("GET", "/api/whiteboard");
  assert("GET without auth → 401", r.status === 401, `got ${r.status}`);

  console.log(`\n${failures.length === 0 ? "All checks passed ✓" : `${failures.length} failure(s):`}`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  - ${f.label}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
