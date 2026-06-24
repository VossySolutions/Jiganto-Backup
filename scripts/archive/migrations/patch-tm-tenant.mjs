import fs from "node:fs";

const path = "server/routes.ts";
let s = fs.readFileSync(path, "utf8");
const start = s.indexOf("  // === TEST MANAGEMENT ROUTES ===");
const end = s.indexOf("  // Seed Data\n  seedDatabase()");
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}
let block = s.slice(start, end);

block = block.replace(/storage\.(getTm\w+)\(1/g, "storage.$1(tenantId");
block = block.replace(/tenantId: 1/g, "tenantId");
block = block.replace(
  /\{ \.\.\.req\.body, tenantId: getApiTenantIdWithFallback\(req\) \}/g,
  "{ ...req.body, tenantId }",
);

const handlers = [
  'app.get("/api/tm/projects"',
  'app.post("/api/tm/projects"',
  'app.get("/api/tm/suites"',
  'app.post("/api/tm/suites"',
  'app.get("/api/tm/cases"',
  'app.post("/api/tm/cases"',
  'app.get("/api/tm/runs"',
  'app.post("/api/tm/runs"',
  'app.post("/api/tm/seed-demo"',
  'app.get("/api/tm/results/all"',
  'app.post("/api/tm/migrate-project"',
  'app.get("/api/tm/audit"',
  'app.get("/api/tm/requirements"',
  'app.post("/api/tm/requirements"',
  'app.post("/api/tm/seed-scenarios"',
  'app.get("/api/tm/scenarios"',
  'app.post("/api/tm/scenarios"',
  'app.get("/api/tm/defects"',
  'app.post("/api/tm/defects"',
];

for (const needle of handlers) {
  let searchFrom = 0;
  while (true) {
    const idx = block.indexOf(needle, searchFrom);
    if (idx < 0) break;
    searchFrom = idx + needle.length;
    const tryIdx = block.indexOf("try {", idx);
    if (tryIdx < 0 || tryIdx > idx + 200) continue;
    const afterTry = tryIdx + "try {".length;
    const snippet = block.slice(afterTry, afterTry + 100);
    if (snippet.includes("const tenantId = getApiTenantIdWithFallback")) continue;
    block =
      block.slice(0, afterTry) +
      "\n      const tenantId = getApiTenantIdWithFallback(req);" +
      block.slice(afterTry);
    searchFrom = afterTry + 50;
  }
}

fs.writeFileSync(path, s.slice(0, start) + block + s.slice(end));
console.log("TM block patched");
