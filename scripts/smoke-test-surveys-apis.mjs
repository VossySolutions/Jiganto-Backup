/**
 * Smoke test Surveys module APIs.
 *
 * Usage:
 *   npm run smoke:surveys  (dev server must be running)
 *   SMOKE_BEARER_TOKEN=<jwt> npm run smoke:surveys   # Supabase / production
 *
 * Without SMOKE_BEARER_TOKEN the script signs in via dev session cookie
 * (GET /api/login?preset=si_super_admin). Start the dev server first.
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";
const LOGIN_PRESET = process.env.SMOKE_LOGIN_PRESET ?? "si_super_admin";
const BEARER = process.env.SMOKE_BEARER_TOKEN ?? "";
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

async function checkServerReachable() {
  try {
    const res = await fetch(`${BASE}/api/login`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function obtainAuthCookie() {
  if (BEARER) return "";

  const loginUrl = `${BASE}/api/login?preset=${encodeURIComponent(LOGIN_PRESET)}`;
  try {
    const res = await fetch(loginUrl, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    const cookie = cookieHeaderFromResponse(res);
    if (cookie && (res.status === 302 || res.status === 200)) {
      return cookie;
    }
    if (res.status === 403) {
      console.warn(`Dev login preset returned 403 (dev login disabled?). Trying default /api/login…`);
    }
    const res2 = await fetch(`${BASE}/api/login`, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    const cookie2 = cookieHeaderFromResponse(res2);
    if (cookie2 && (res2.status === 302 || res2.status === 200)) {
      return cookie2;
    }
    console.warn(`Login responses: preset=${res.status}, default=${res2.status} (no Set-Cookie)`);
    return "";
  } catch (err) {
    console.warn(`Dev login failed: ${err instanceof Error ? err.message : err}`);
    return "";
  }
}

async function call(method, path, { cookie, body } = {}) {
  const url = `${BASE}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (BEARER) headers.Authorization = `Bearer ${BEARER}`;
  if (cookie) headers.Cookie = cookie;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 300) };
}

const failures = [];
let createdSurveyId = null;
let createdQuestionId = null;
let createdPollId = null;
let templateId = null;
let surveyToken = null;

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
  console.log(`\nSurveys API smoke test @ ${BASE}\n`);

  const reachable = await checkServerReachable();
  if (!reachable.ok) {
    console.error(`FATAL: cannot reach ${BASE} — ${reachable.error}`);
    console.error("\nStart the dev server first:  npm run dev\n");
    process.exit(1);
  }

  const cookie = await obtainAuthCookie();
  if (BEARER) {
    console.log("Using SMOKE_BEARER_TOKEN for auth.\n");
  } else if (cookie) {
    console.log(`Signed in via dev session (preset: ${LOGIN_PRESET}).\n`);
  } else {
    console.error("FATAL: no auth cookie — cannot test protected routes");
    console.error("\nTips:");
    console.error("  • Ensure dev login is enabled (NODE_ENV=development)");
    console.error("  • Try: SMOKE_LOGIN_PRESET=si_super_admin npm run smoke:surveys");
    console.error("  • Or set SMOKE_BEARER_TOKEN for Supabase auth\n");
    process.exit(1);
  }

  const qs = `tenantId=${TENANT}`;

  // ── Read endpoints (must not 401/404 incorrectly) ──
  expectOk("GET /api/surveys", await call("GET", `/api/surveys?${qs}`, { cookie }));
  expectOk("GET /api/surveys/templates", await call("GET", `/api/surveys/templates?${qs}`, { cookie }));
  expectOk("GET /api/surveys/polls", await call("GET", `/api/surveys/polls?${qs}`, { cookie }));
  expectOk("GET /api/surveys/ai-status", await call("GET", `/api/surveys/ai-status?${qs}`, { cookie }));

  const tplList = await call("GET", `/api/surveys/templates?${qs}`, { cookie });
  if (tplList.json?.length) templateId = tplList.json[0].id;

  // ── Create survey ──
  const create = await call("POST", `/api/surveys?${qs}`, {
    cookie,
    body: { title: "Smoke Test Survey", status: "draft", category: "general" },
  });
  if (expectOk("POST /api/surveys", create)) {
    createdSurveyId = create.json?.id;
    surveyToken = create.json?.token;
  }

  if (createdSurveyId) {
    expectOk("GET /api/surveys/:id", await call("GET", `/api/surveys/${createdSurveyId}?${qs}`, { cookie }));

    const addQ = await call("POST", `/api/surveys/${createdSurveyId}/questions?${qs}`, {
      cookie,
      body: { type: "mc", text: "Smoke question?", options: ["Yes", "No"] },
    });
    if (expectOk("POST /api/surveys/:id/questions", addQ)) {
      createdQuestionId = addQ.json?.id;
    }

    expectOk("POST /api/surveys/:id/activate", await call("POST", `/api/surveys/${createdSurveyId}/activate?${qs}`, { cookie }));
    expectOk("GET /api/surveys/:id/responses", await call("GET", `/api/surveys/${createdSurveyId}/responses?${qs}`, { cookie }));
    expectOk("GET /api/surveys/:id/results-summary", await call("GET", `/api/surveys/${createdSurveyId}/results-summary?${qs}`, { cookie }));
    expectOk("POST /api/surveys/:id/distribute", await call("POST", `/api/surveys/${createdSurveyId}/distribute?${qs}`, {
      cookie,
      body: { type: "link" },
    }));

    if (createdQuestionId) {
      expectOk("POST duplicate question", await call("POST", `/api/surveys/questions/${createdQuestionId}/duplicate?${qs}`, { cookie }));
    }

    expectOk("POST duplicate survey", await call("POST", `/api/surveys/${createdSurveyId}/duplicate?${qs}`, { cookie }));
    expectOk("POST save-template", await call("POST", `/api/surveys/${createdSurveyId}/save-template?${qs}`, { cookie, body: {} }));
  }

  if (templateId) {
    const fromTpl = await call("POST", `/api/surveys/from-template/${templateId}?${qs}`, { cookie, body: {} });
    expectOk("POST /api/surveys/from-template/:id", fromTpl);
    if (fromTpl.json?.id) {
      await call("DELETE", `/api/surveys/${fromTpl.json.id}?${qs}`, { cookie });
    }
  }

  // ── Polls ──
  const createPoll = await call("POST", `/api/surveys/polls?${qs}`, {
    cookie,
    body: {
      question: "Smoke poll?",
      options: ["A", "B"],
      durationMinutes: 60,
      pollType: "single",
    },
  });
  if (expectOk("POST /api/surveys/polls", createPoll)) {
    createdPollId = createPoll.json?.id;
    expectOk("GET /api/surveys/polls/:id", await call("GET", `/api/surveys/polls/${createdPollId}?${qs}`, { cookie }));
    expectOk("POST /api/surveys/polls/:id/close", await call("POST", `/api/surveys/polls/${createdPollId}/close?${qs}`, { cookie }));
  }

  // ── Public routes (no auth) ──
  if (surveyToken) {
    expectOk("GET public survey by token", await call("GET", `/api/surveys/by-token/${surveyToken}`));
    const respond = await call("POST", `/api/surveys/by-token/${surveyToken}/respond`, {
      body: {
        answers: createdQuestionId ? [{ questionId: createdQuestionId, value: "Yes" }] : [],
        timeSeconds: 12,
      },
    });
    expectOk("POST public respond", respond);
  }

  // ── Cleanup ──
  if (createdSurveyId) {
    await call("POST", `/api/surveys/${createdSurveyId}/close?${qs}`, { cookie });
    expectOk("DELETE /api/surveys/:id", await call("DELETE", `/api/surveys/${createdSurveyId}?${qs}`, { cookie }));
  }

  // ── Expected 401 without auth ──
  const unauth = await call("GET", `/api/surveys?${qs}`);
  if (unauth.status === 401) {
    console.log("  OK   GET /api/surveys (no auth) → 401");
  } else {
    failures.push({ label: "GET /api/surveys unauth", status: unauth.status, detail: "expected 401" });
    console.log(`  FAIL GET /api/surveys (no auth) → ${unauth.status} (expected 401)`);
  }

  console.log(`\n${failures.length === 0 ? "✓ All surveys smoke tests passed" : `✗ ${failures.length} failure(s)`}\n`);
  if (failures.length) {
    console.table(failures);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
