/**
 * Run all module smoke tests sequentially.
 * Usage: npm run smoke:all  (dev server must be running on :5000)
 */
import { spawnSync } from "node:child_process";

const SUITES = [
  "smoke:validate-all",
  "smoke:crm",
  "smoke:finance-http",
  "smoke:finance",
  "smoke:resources",
  "smoke:resource-planning",
  "smoke:portfolio",
  "smoke:projects",
  "smoke:business",
  "smoke:clients",
  "smoke:customer-mgmt",
  "smoke:chat",
  "smoke:tasks",
  "smoke:workspaces",
  "smoke:service-desk",
  "smoke:help-desk",
  "smoke:test-mgmt",
  "smoke:bpm",
  "smoke:surveys",
  "smoke:esign",
  "smoke:templates",
  "smoke:whiteboard",
  "smoke:modules-6-20-gets",
];

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const results = [];

console.log("\n═══════════════════════════════════════");
console.log("  Jiganto full module smoke suite");
console.log("═══════════════════════════════════════\n");

for (const script of SUITES) {
  process.stdout.write(`▶ ${script} … `);
  const r = spawnSync(npmCmd, ["run", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  const ok = r.status === 0;
  results.push({ script, ok, code: r.status ?? 1 });
  console.log(ok ? "PASS" : `FAIL (${r.status})`);
  if (!ok) {
    const err = (r.stderr || r.stdout || "").trim();
    if (err) console.log(err.split("\n").slice(-8).join("\n"));
  }
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);

console.log("\n═══════════════════════════════════════");
console.log(`  ${passed}/${results.length} suites passed`);
if (failed.length) {
  console.log("  Failed:");
  for (const f of failed) console.log(`    - ${f.script}`);
}
console.log("═══════════════════════════════════════\n");

process.exit(failed.length ? 1 : 0);
