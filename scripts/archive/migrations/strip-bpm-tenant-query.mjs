import fs from "node:fs";
import path from "node:path";

const roots = [
  "client/src/pages/BPMPage.tsx",
  "client/src/components/bpm/OrgChartView.tsx",
  "client/src/components/bpm/BpmCanvasEditor.tsx",
  "client/src/components/bpm/BpmTemplatePipeline.tsx",
  "client/src/components/bpm/BpmlView.tsx",
  "client/src/components/bpm/PortalSettingsDialog.tsx",
  "client/src/components/projects/PmSecondaryTools.tsx",
];

function stripTenantFromUrls(text) {
  return text
    .replace(/\?tenantId=\$\{tenantId\}/g, "")
    .replace(/\?tenantId=1&/g, "?")
    .replace(/&tenantId=\$\{tenantId\}/g, "")
    .replace(/&tenantId=1/g, "")
    .replace(/\?tenantId=1/g, "")
    .replace(/\{ tenantId: 1 \}/g, '"/api/frameworks"')
    .replace(/,\s*tenantId:\s*1,?\n/g, "\n")
    .replace(/tenantId=\{1\}/g, "")
    .replace(/tenantId=\{1\}/g, "")
    .replace(/const tenantId = 1;\n\n/g, "")
    .replace(/const tenantId = 1;\n/g, "");
}

for (const rel of roots) {
  const file = path.join(process.cwd(), rel);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  let after = stripTenantFromUrls(before);
  // Fix portal settings query keys
  after = after.replace(
    /`\/api\/bpm\/portal-settings\$\{selectedLibrary \? `&libraryId=\$\{selectedLibrary\}` : ""\}`/g,
    "`/api/bpm/portal-settings${selectedLibrary ? `?libraryId=${selectedLibrary}` : \"\"}`",
  );
  after = after.replace(
    /PortalSettingsDialog tenantId=\{1\} libraryId/g,
    "PortalSettingsDialog libraryId",
  );
  after = after.replace(
    /export function PortalSettingsDialog\(\{ tenantId, libraryId \}/,
    "export function PortalSettingsDialog({ libraryId }",
  );
  after = after.replace(
    /type Props = \{\n  tenantId: number;\n  libraryId: number \| null;\n\};/,
    "type Props = {\n  libraryId: number | null;\n};",
  );
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log("patched", rel);
  }
}
