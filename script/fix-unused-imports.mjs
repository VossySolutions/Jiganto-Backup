/**
 * Remove unused imports reported by `tsc --noUnusedLocals`.
 * Run: npx tsc --noEmit -p tsconfig.json --noUnusedLocals --noUnusedParameters 2>&1 | Out-File .tsc-unused.txt
 *       node script/fix-unused-imports.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPORT = path.join(ROOT, ".tsc-unused.txt");

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function readReportText() {
  const buf = fs.readFileSync(REPORT);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return stripBom(buf.toString("utf16le"));
  }
  return stripBom(buf.toString("utf8"));
}

function importBlocks(lines) {
  /** @type {{ start: number, end: number, text: string }[]} */
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trimStart().startsWith("import ")) continue;
    const end = findImportEnd(lines, i);
    blocks.push({ start: i, end, text: lines.slice(i, end + 1).join("\n") });
    i = end;
  }
  return blocks;
}

function isImportLine(lines, lineNum) {
  const idx = lineNum - 1;
  return importBlocks(lines).some((b) => idx >= b.start && idx <= b.end);
}

if (!fs.existsSync(REPORT)) {
  console.error("Missing .tsc-unused.txt");
  process.exit(1);
}

/** @type {Map<string, { dropImportLines: Set<number>, symbols: Set<string>, lines?: string[] }>} */
const byFile = new Map();

for (const line of readReportText().split(/\r?\n/)) {
  const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS6133|TS6192): (.+)$/);
  if (!m) continue;
  const [, rel, lineStr, , code, msg] = m;
  const file = stripBom(rel).replace(/\\/g, "/");
  if (!byFile.has(file)) byFile.set(file, { dropImportLines: new Set(), symbols: new Set() });
  const entry = byFile.get(file);
  const lineNum = Number(lineStr);

  if (code === "TS6192") {
    entry.dropImportLines.add(lineNum);
    continue;
  }
  const sym = msg.match(/'([^']+)'/)?.[1];
  if (!sym) continue;
  const abs = path.join(ROOT, file);
  if (!entry.lines && fs.existsSync(abs)) {
    entry.lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  }
  const srcLine = entry.lines?.[lineNum - 1] ?? "";
  if (isImportLine(entry.lines ?? [], lineNum)) {
    entry.symbols.add(sym);
  }
}

function findImportEnd(lines, startIdx) {
  let i = startIdx;
  let depth = 0;
  while (i < lines.length) {
    for (const ch of lines[i]) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    if (lines[i].includes(";") && depth <= 0) return i;
    i++;
  }
  return startIdx;
}

function stripSymbols(block, symbols) {
  const braceStart = block.indexOf("{");
  const braceEnd = block.lastIndexOf("}");
  if (braceStart === -1 || braceEnd === -1) {
    const defaultMatch = block.match(/import\s+(\w+)/);
    const name = defaultMatch?.[1];
    return name && symbols.has(name) ? null : block;
  }

  const prefix = block.slice(0, braceStart + 1);
  const suffix = block.slice(braceEnd);
  const inner = block.slice(braceStart + 1, braceEnd);
  const parts = inner
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const name = p.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      return !symbols.has(name);
    });

  if (parts.length === 0) return null;
  if (parts.length === 1 && !prefix.includes(",")) {
    return block.replace(/\{[^}]+\}/, `{ ${parts[0]} }`);
  }
  return `${prefix}\n  ${parts.join(",\n  ")}\n${suffix}`;
}

let filesChanged = 0;

for (const [file, { dropImportLines, symbols }] of byFile) {
  if (dropImportLines.size === 0 && symbols.size === 0) continue;
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;

  let lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  const blocks = importBlocks(lines);

  const removeStarts = new Set(
    [...dropImportLines].map((ln) => blocks.find((b) => b.start === ln - 1)?.start).filter((x) => x !== undefined),
  );

  /** @type {{ start: number, end: number, replacement: string[] | null }[]} */
  const edits = [];

  for (const block of blocks) {
    if (removeStarts.has(block.start)) {
      edits.push({ start: block.start, end: block.end, replacement: null });
      continue;
    }
    if (symbols.size === 0) continue;
    const blockSyms = new Set(
      [...symbols].filter((s) => {
        const re = new RegExp(`\\b${s}\\b`);
        return re.test(block.text);
      }),
    );
    if (blockSyms.size === 0) continue;
    const next = stripSymbols(block.text, blockSyms);
    if (next === null) {
      edits.push({ start: block.start, end: block.end, replacement: null });
    } else if (next !== block.text) {
      edits.push({ start: block.start, end: block.end, replacement: next.split(/\r?\n/) });
    }
  }

  if (edits.length === 0) continue;
  edits.sort((a, b) => b.start - a.start);
  for (const edit of edits) {
    if (edit.replacement === null) {
      lines.splice(edit.start, edit.end - edit.start + 1);
    } else {
      lines.splice(edit.start, edit.end - edit.start + 1, ...edit.replacement);
    }
  }

  const out = lines.join("\n");
  const prev = fs.readFileSync(abs, "utf8");
  if (out !== prev) {
    fs.writeFileSync(abs, out.endsWith("\n") ? out : out + "\n");
    filesChanged++;
    console.log("fixed:", file);
  }
}

console.log(`Done. ${filesChanged} file(s) updated.`);
