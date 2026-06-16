import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import type { ComposeSigner } from "@/lib/signoff-constants";

export type PlacedField = {
  id?: number;
  signerEmail: string;
  fieldType: "signature" | "date" | "text" | "initials";
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  isRequired: boolean;
  label?: string;
};

const FIELD_TYPES: PlacedField["fieldType"][] = ["signature", "date", "text", "initials"];

type Props = {
  signers: ComposeSigner[];
  fields: PlacedField[];
  onChange: (fields: PlacedField[]) => void;
  pdfPreviewUrl?: string | null;
};

export function FieldPlacementEditor({ signers, fields, onChange, pdfPreviewUrl }: Props) {
  const [selectedSigner, setSelectedSigner] = useState(signers[0]?.email ?? "");
  const [fieldType, setFieldType] = useState<PlacedField["fieldType"]>("signature");

  function addField() {
    if (!selectedSigner) return;
    onChange([
      ...fields,
      {
        signerEmail: selectedSigner,
        fieldType,
        pageNumber: 1,
        xPercent: 10 + (fields.length % 4) * 20,
        yPercent: 70 + (fields.length % 3) * 8,
        widthPercent: fieldType === "signature" ? 28 : 18,
        heightPercent: fieldType === "signature" ? 8 : 5,
        isRequired: true,
        label: fieldType === "text" ? "Custom text" : undefined,
      },
    ]);
  }

  function updateField(idx: number, patch: Partial<PlacedField>) {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  if (!signers.length) {
    return <p className="text-sm text-muted-foreground">Add signers first to place fields.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Place signature, date, initials, or text fields on the PDF. Signers complete each assigned field in the signing portal.
      </p>

      {pdfPreviewUrl && (
        <div className="relative border border-border rounded-xl overflow-hidden bg-muted/30">
          <iframe src={pdfPreviewUrl} className="w-full h-64 sm:h-80" title="PDF preview for field placement" />
          {fields.map((f, i) => (
            <div
              key={i}
              className="absolute border-2 border-primary bg-primary/10 rounded pointer-events-none text-[10px] font-medium text-primary px-1"
              style={{
                left: `${f.xPercent}%`,
                top: `${f.yPercent}%`,
                width: `${f.widthPercent}%`,
                height: `${f.heightPercent}%`,
              }}
            >
              {f.fieldType}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Signer</label>
          <select value={selectedSigner} onChange={e => setSelectedSigner(e.target.value)}
            className="px-2 py-1.5 border border-border rounded-lg text-sm bg-background">
            {signers.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Field type</label>
          <select value={fieldType} onChange={e => setFieldType(e.target.value as PlacedField["fieldType"])}
            className="px-2 py-1.5 border border-border rounded-lg text-sm bg-background">
            {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button type="button" onClick={addField}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Add field
        </button>
      </div>

      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center bg-card border border-border rounded-lg p-3 text-sm">
              <span className="truncate font-medium col-span-2 sm:col-span-1">{f.signerEmail.split("@")[0]}</span>
              <select value={f.fieldType} onChange={e => updateField(i, { fieldType: e.target.value as PlacedField["fieldType"] })}
                className="px-2 py-1 border border-border rounded text-xs bg-background">
                {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" min={1} value={f.pageNumber} onChange={e => updateField(i, { pageNumber: Number(e.target.value) })}
                className="px-2 py-1 border border-border rounded text-xs" title="Page" />
              <input type="number" min={0} max={100} value={f.xPercent} onChange={e => updateField(i, { xPercent: Number(e.target.value) })}
                className="px-2 py-1 border border-border rounded text-xs" title="X %" />
              <input type="number" min={0} max={100} value={f.yPercent} onChange={e => updateField(i, { yPercent: Number(e.target.value) })}
                className="px-2 py-1 border border-border rounded text-xs" title="Y %" />
              <button type="button" onClick={() => onChange(fields.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-red-500 justify-self-end">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!pdfPreviewUrl && fields.length > 0 && (
        <p className={cn("text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2")}>
          Upload a PDF in step 1 to preview field positions.
        </p>
      )}
    </div>
  );
}
