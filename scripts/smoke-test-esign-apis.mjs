/**
 * Smoke test eSign / signoff module APIs.
 *
 * Usage:
 *   npm run smoke:esign  (dev server must be running)
 *   SMOKE_BEARER_TOKEN=<jwt> npm run smoke:esign
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
    if (cookie && (res.status === 302 || res.status === 200)) return cookie;
    const res2 = await fetch(`${BASE}/api/login`, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    const cookie2 = cookieHeaderFromResponse(res2);
    if (cookie2 && (res2.status === 302 || res2.status === 200)) return cookie2;
    return "";
  } catch {
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
  return { status: res.status, json, text: text.slice(0, 400) };
}

const failures = [];
let requestId = null;
let signerToken = null;
let duplicateId = null;

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
  console.log(`\neSign API smoke test @ ${BASE}\n`);

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
    console.error("  • Try: SMOKE_LOGIN_PRESET=si_super_admin npm run smoke:esign");
    console.error("  • Or set SMOKE_BEARER_TOKEN for Supabase auth\n");
    process.exit(1);
  }

  const qs = `tenantId=${TENANT}`;

  // ── Read endpoints ──
  expectOk("GET /api/signoff", await call("GET", `/api/signoff?${qs}`, { cookie }));
  expectOk("GET /api/signoff/templates", await call("GET", `/api/signoff/templates?${qs}`, { cookie }));
  expectOk("GET /api/signoff/jiganto-docs", await call("GET", `/api/signoff/jiganto-docs?${qs}`, { cookie }));
  expectOk("GET /api/signoff/projects", await call("GET", `/api/signoff/projects?${qs}`, { cookie }));
  expectOk("GET /api/signoff/users", await call("GET", `/api/signoff/users?${qs}`, { cookie }));
  expectOk("GET /api/signoff/my-pending", await call("GET", `/api/signoff/my-pending?${qs}`, { cookie }));

  expectOk("GET /api/esign/qtsp-status", await call("GET", `/api/esign/qtsp-status?${qs}`, { cookie }));

  const tplList = await call("GET", `/api/signoff/templates?${qs}`, { cookie });
  const templateId = tplList.json?.[0]?.id;

  // ── Create draft (inline doc + sequential signers) ──
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);
  const create = await call("POST", `/api/signoff?${qs}`, {
    cookie,
    body: {
      title: "Smoke Test eSign Document",
      description: "Automated smoke test",
      sourceType: "inline_doc",
      contentHtml: "<h1>Smoke Test</h1><p>Please sign this test document.</p>",
      message: "Smoke test signing request",
      signingOrder: "sequential",
      deadline: deadline.toISOString().slice(0, 10),
      allowDecline: true,
      sendCopyOnCompletion: false,
      requireAcknowledgement: false,
      signers: [
        { name: "Smoke Signer One", email: "smoke-signer-1@test.local", signerOrder: 1, roleTitle: "Approver" },
        { name: "Smoke Signer Two", email: "smoke-signer-2@test.local", signerOrder: 2, roleTitle: "Witness" },
      ],
    },
  });
  if (expectOk("POST /api/signoff", create)) {
    requestId = create.json?.id;
  }

  if (requestId) {
    expectOk("GET /api/signoff/:id", await call("GET", `/api/signoff/${requestId}?${qs}`, { cookie }));
    expectOk("GET /api/signoff/:id/file", await call("GET", `/api/signoff/${requestId}/file?${qs}`, { cookie }));

    expectOk("PATCH /api/signoff/:id", await call("PATCH", `/api/signoff/${requestId}?${qs}`, {
      cookie,
      body: { message: "Updated smoke test message" },
    }));

    expectOk("PUT /api/signoff/:id/fields", await call("PUT", `/api/signoff/${requestId}/fields?${qs}`, {
      cookie,
      body: {
        fields: [{
          signerEmail: "smoke-signer-1@test.local",
          fieldType: "signature",
          pageNumber: 1,
          xPercent: 10,
          yPercent: 80,
          widthPercent: 25,
          heightPercent: 8,
        }],
      },
    }));
    expectOk("GET /api/signoff/:id/fields", await call("GET", `/api/signoff/${requestId}/fields?${qs}`, { cookie }));

    const fieldsRes = await call("GET", `/api/signoff/${requestId}/fields?${qs}`, { cookie });
    const fieldId = fieldsRes.json?.[0]?.id;

    // Send — only first signer gets token in sequential mode
    const sent = await call("POST", `/api/signoff/${requestId}/send?${qs}`, { cookie, body: {} });
    if (expectOk("POST /api/signoff/:id/send", sent)) {
      const firstSigner = sent.json?.signers?.find(s => s.signerOrder === 1) ?? sent.json?.signers?.[0];
      signerToken = firstSigner?.token;
    }

    expectOk("POST /api/signoff/:id/signers (in-flight)", await call("POST", `/api/signoff/${requestId}/signers?${qs}`, {
      cookie,
      body: { name: "Late Signer", email: "late-signer@test.local", roleTitle: "Observer" },
    }));

    if (signerToken) {
      expectOk("GET /api/signoff/sign/:token", await call("GET", `/api/signoff/sign/${signerToken}`, {}));
      expectOk("POST /api/signoff/sign/:token/view", await call("POST", `/api/signoff/sign/${signerToken}/view`, {}));
      expectOk("POST /api/signoff/sign/:token/sign", await call("POST", `/api/signoff/sign/${signerToken}/sign`, {
        body: {
          signatureName: "Smoke Signer One",
          signatureMethod: "type",
          signatureData: JSON.stringify({ type: "typed", name: "Smoke Signer One" }),
          fieldValues: fieldId ? { [fieldId]: "Smoke Signer One" } : {},
        },
      }));
    }

    const afterSign = await call("GET", `/api/signoff/${requestId}?${qs}`, { cookie });
    if (afterSign.json?.status === "partially_signed" || afterSign.json?.status === "pending") {
      console.log(`  OK   status after first sign → ${afterSign.json?.status}`);
    } else {
      console.log(`  WARN status after first sign → ${afterSign.json?.status} (expected partially_signed or pending)`);
    }

    const secondSigner = afterSign.json?.signers?.find(s => s.signerOrder === 2);
    if (secondSigner?.token) {
      expectOk("POST /api/signoff/sign/:token/sign (signer 2)", await call("POST", `/api/signoff/sign/${secondSigner.token}/sign`, {
        body: {
          signatureName: "Smoke Signer Two",
          signatureMethod: "type",
          signatureData: JSON.stringify({ type: "typed", name: "Smoke Signer Two" }),
        },
      }));
      const completed = await call("GET", `/api/signoff/${requestId}?${qs}`, { cookie });
      if (completed.json?.status === "completed") {
        console.log("  OK   sequential completion → completed");
      }
    }

    expectOk("POST /api/signoff/:id/remind", await call("POST", `/api/signoff/${requestId}/remind?${qs}`, { cookie, body: {} }));

    const dup = await call("POST", `/api/signoff/${requestId}/duplicate?${qs}`, { cookie, body: {} });
    if (expectOk("POST /api/signoff/:id/duplicate", dup)) {
      duplicateId = dup.json?.id;
    }

    expectOk("POST /api/signoff/:id/save-template", await call("POST", `/api/signoff/${requestId}/save-template?${qs}`, { cookie, body: {} }));

    expectOk("GET /api/signoff/:id/audit-pdf", await call("GET", `/api/signoff/${requestId}/audit-pdf?${qs}`, { cookie }), [200, 404]);

    // Void the original in-flight request (cleanup)
    expectOk("POST /api/signoff/:id/void", await call("POST", `/api/signoff/${requestId}/void?${qs}`, {
      cookie,
      body: { reason: "Smoke test cleanup" },
    }), [200]);
  }

  // Create from template if available
  if (templateId) {
    const fromTpl = await call("POST", `/api/signoff?${qs}`, {
      cookie,
      body: {
        title: "From Template Smoke",
        sourceType: "template",
        templateId,
        contentHtml: tplList.json[0].contentHtml,
        deadline: deadline.toISOString().slice(0, 10),
        signers: [{ name: "Template Signer", email: "template-signer@test.local" }],
      },
    });
    if (expectOk("POST /api/signoff (from template)", fromTpl)) {
      await call("DELETE", `/api/signoff/${fromTpl.json.id}?${qs}`, { cookie });
    }
  }

  // Cleanup duplicate draft
  if (duplicateId) {
    await call("DELETE", `/api/signoff/${duplicateId}?${qs}`, { cookie });
    console.log(`  OK   DELETE duplicate draft → cleaned up`);
  }

  // Filter / search query params
  expectOk("GET /api/signoff?status=awaiting", await call("GET", `/api/signoff?${qs}&status=awaiting`, { cookie }));
  expectOk("GET /api/signoff?status=voided", await call("GET", `/api/signoff?${qs}&status=voided`, { cookie }));
  expectOk("GET /api/signoff?search=Smoke", await call("GET", `/api/signoff?${qs}&search=Smoke`, { cookie }));

  // Decline flow (parallel, separate request)
  const declineCreate = await call("POST", `/api/signoff?${qs}`, {
    cookie,
    body: {
      title: "Smoke Decline Test",
      sourceType: "inline_doc",
      contentHtml: "<p>Decline me</p>",
      signingOrder: "parallel",
      deadline: deadline.toISOString().slice(0, 10),
      signers: [{ name: "Decline Tester", email: "decline-tester@test.local", signerOrder: 1 }],
    },
  });
  if (expectOk("POST /api/signoff (decline test)", declineCreate)) {
    const declineId = declineCreate.json?.id;
    const declineSent = await call("POST", `/api/signoff/${declineId}/send?${qs}`, { cookie, body: {} });
    const declineToken = declineSent.json?.signers?.[0]?.token;
    if (declineToken) {
      expectOk("POST /api/signoff/sign/:token/decline", await call("POST", `/api/signoff/sign/${declineToken}/decline`, {
        body: { reason: "Smoke test decline" },
      }));
    }
    await call("DELETE", `/api/signoff/${declineId}?${qs}`, { cookie });
  }

  // OTP flow (separate request)
  const otpCreate = await call("POST", `/api/signoff?${qs}`, {
    cookie,
    body: {
      title: "Smoke OTP Test",
      sourceType: "inline_doc",
      contentHtml: "<p>OTP test</p>",
      signingOrder: "parallel",
      deadline: deadline.toISOString().slice(0, 10),
      requireOtpVerification: true,
      signers: [{ name: "OTP Tester", email: "otp-tester@test.local", signerOrder: 1 }],
    },
  });
  if (expectOk("POST /api/signoff (otp test)", otpCreate)) {
    const otpId = otpCreate.json?.id;
    const otpSent = await call("POST", `/api/signoff/${otpId}/send?${qs}`, { cookie, body: {} });
    const otpToken = otpSent.json?.signers?.[0]?.token;
    if (otpToken) {
      expectOk("POST /api/signoff/sign/:token/otp/send", await call("POST", `/api/signoff/sign/${otpToken}/otp/send`, {}));
    }
    await call("DELETE", `/api/signoff/${otpId}?${qs}`, { cookie });
  }

  // Complete parallel request → signed PDF
  const completeCreate = await call("POST", `/api/signoff?${qs}`, {
    cookie,
    body: {
      title: "Smoke Complete Test",
      sourceType: "inline_doc",
      contentHtml: "<p>Complete me</p>",
      signingOrder: "parallel",
      deadline: deadline.toISOString().slice(0, 10),
      signers: [{ name: "Complete Tester", email: "complete-tester@test.local", signerOrder: 1 }],
    },
  });
  if (expectOk("POST /api/signoff (complete test)", completeCreate)) {
    const completeId = completeCreate.json?.id;
    const completeSent = await call("POST", `/api/signoff/${completeId}/send?${qs}`, { cookie, body: {} });
    const completeToken = completeSent.json?.signers?.[0]?.token;
    if (completeToken) {
      expectOk("POST /api/signoff/sign/:token/sign (complete)", await call("POST", `/api/signoff/sign/${completeToken}/sign`, {
        body: {
          signatureName: "Complete Tester",
          signatureMethod: "type",
          signatureData: JSON.stringify({ type: "typed", name: "Complete Tester" }),
        },
      }));
      expectOk("GET /api/signoff/:id/signed-pdf", await call("GET", `/api/signoff/${completeId}/signed-pdf?${qs}`, { cookie }), [200, 404]);
    }
    await call("DELETE", `/api/signoff/${completeId}?${qs}`, { cookie });
  }

  const myPending = await call("GET", `/api/signoff/my-pending?${qs}`, { cookie });
  if (expectOk("GET /api/signoff/my-pending (shape)", myPending)) {
    if (Array.isArray(myPending.json) && myPending.json.length > 0) {
      const first = myPending.json[0];
      if (first.mySignerToken) {
        console.log("  OK   my-pending includes mySignerToken");
      } else {
        console.log("  WARN my-pending missing mySignerToken on first item");
      }
    }
  }

  console.log("");
  if (failures.length) {
    console.error(`FAILED: ${failures.length} check(s)\n`);
    for (const f of failures) console.error(`  • ${f.label}: ${f.status} — ${f.detail}`);
    process.exit(1);
  }
  console.log("All eSign smoke checks passed.\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
