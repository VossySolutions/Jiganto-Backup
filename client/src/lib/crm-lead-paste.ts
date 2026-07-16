/** Parse Excel / Google Sheets clipboard (TSV/CSV) and infer column attribute types. */

export type InferredFieldType =
  | "text"
  | "number"
  | "date"
  | "email"
  | "url"
  | "dropdown"
  | "phone";

export type PasteColumnPlan = {
  header: string;
  fieldKey: string;
  inferredType: InferredFieldType;
  /** Maps to a built-in lead column when possible */
  builtin?:
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "company"
    | "title"
    | "source"
    | "status"
    | "rating"
    | "industry"
    | "website"
    | "description"
    | "score";
  /** Distinct values for dropdown inference */
  sampleValues: string[];
};

export type ParsedPasteTable = {
  columns: PasteColumnPlan[];
  rows: Record<string, string>[];
};

const BUILTIN_ALIASES: Record<string, PasteColumnPlan["builtin"]> = {
  firstname: "firstName",
  "first name": "firstName",
  first_name: "firstName",
  lastname: "lastName",
  "last name": "lastName",
  last_name: "lastName",
  email: "email",
  "e-mail": "email",
  phone: "phone",
  mobile: "phone",
  company: "company",
  account: "company",
  organisation: "company",
  organization: "company",
  title: "title",
  job: "title",
  "job title": "title",
  source: "source",
  status: "status",
  rating: "rating",
  industry: "industry",
  website: "website",
  url: "website",
  description: "description",
  notes: "description",
  score: "score",
  name: undefined, // handled specially — may split
};

function slugifyField(header: string): string {
  const base = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return (base || `field_${Date.now()}`).slice(0, 40);
}

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function looksLikeUrl(v: string): boolean {
  return /^(https?:\/\/|www\.)/i.test(v);
}

function looksLikePhone(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && /[\d+\-()\s.]{7,}/.test(v);
}

function looksLikeDate(v: string): boolean {
  if (!v.trim()) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v)) return true;
  const t = Date.parse(v);
  return Number.isFinite(t) && v.length >= 6;
}

function looksLikeNumber(v: string): boolean {
  if (!v.trim()) return false;
  return /^-?\d+(\.\d+)?$/.test(v.replace(/,/g, ""));
}

function inferType(values: string[]): InferredFieldType {
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "text";
  const sample = nonEmpty.slice(0, 40);
  const ratio = (fn: (v: string) => boolean) =>
    sample.filter(fn).length / sample.length;

  if (ratio(looksLikeEmail) >= 0.7) return "email";
  if (ratio(looksLikeUrl) >= 0.7) return "url";
  if (ratio(looksLikePhone) >= 0.7) return "phone";
  if (ratio(looksLikeDate) >= 0.7) return "date";
  if (ratio(looksLikeNumber) >= 0.8) return "number";

  const unique = new Set(sample.map((v) => v.toLowerCase()));
  if (unique.size >= 2 && unique.size <= 12 && unique.size / sample.length <= 0.5) {
    return "dropdown";
  }
  return "text";
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") return line.split("\t");
  // Simple CSV: respect quoted cells
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/** Detect delimiter: prefer tab (Excel/Sheets), else comma. */
export function detectDelimiter(text: string): "\t" | "," {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const tabs = (first.match(/\t/g) || []).length;
  const commas = (first.match(/,/g) || []).length;
  return tabs >= commas ? "\t" : ",";
}

export function parseClipboardTable(text: string): ParsedPasteTable | null {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return null;
  const delimiter = detectDelimiter(raw);
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  const headers = splitDelimitedLine(lines[0], delimiter).map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => !h)) return null;

  const dataRows = lines.slice(1).map((line) => splitDelimitedLine(line, delimiter));
  const columns: PasteColumnPlan[] = headers.map((header, colIdx) => {
    const values = dataRows.map((r) => (r[colIdx] ?? "").trim());
    const norm = header.toLowerCase().trim();
    const builtin = BUILTIN_ALIASES[norm];
    const inferredType = builtin
      ? builtin === "email"
        ? "email"
        : builtin === "website"
          ? "url"
          : builtin === "phone"
            ? "phone"
            : builtin === "score"
              ? "number"
              : "text"
      : inferType(values);
    const unique = Array.from(new Set(values.filter(Boolean))).slice(0, 20);
    return {
      header,
      fieldKey: slugifyField(header),
      inferredType,
      builtin,
      sampleValues: unique,
    };
  });

  const rows: Record<string, string>[] = dataRows.map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });

  return { columns, rows };
}

export function customFieldTypeFromInferred(t: InferredFieldType): string {
  switch (t) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "url":
      return "url";
    case "dropdown":
      return "dropdown";
    case "email":
    case "phone":
    case "text":
    default:
      return "text";
  }
}

/** Map paste rows into bulk-import payload + customData. */
export function mapPasteRowsToLeadImport(
  parsed: ParsedPasteTable,
  columnOverrides?: PasteColumnPlan[],
): Record<string, string>[] {
  const cols = columnOverrides || parsed.columns;
  return parsed.rows.map((raw) => {
    const out: Record<string, string> = {};
    const custom: Record<string, string> = {};
    for (const col of cols) {
      const val = raw[col.header] ?? "";
      if (col.builtin) {
        out[col.builtin] = val;
      } else if (val) {
        custom[col.fieldKey] = val;
      }
    }
    // If only a Name column existed, split into first/last
    if (!out.firstName && !out.lastName && raw["Name"]) {
      const parts = raw["Name"].trim().split(/\s+/);
      out.firstName = parts[0] || "Unknown";
      out.lastName = parts.slice(1).join(" ") || "Unknown";
    }
    if (!out.firstName && !out.lastName && out.company) {
      out.firstName = out.company;
      out.lastName = "Lead";
    }
    if (Object.keys(custom).length > 0) {
      out.__customData = JSON.stringify(custom);
    }
    return out;
  });
}
