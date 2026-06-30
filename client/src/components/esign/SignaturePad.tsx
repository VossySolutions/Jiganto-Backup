import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type SigMethod = "draw" | "type" | "upload";

type Props = {
  name: string;
  onNameChange: (v: string) => void;
  method: SigMethod;
  onMethodChange: (m: SigMethod) => void;
  signatureData: string;
  onSignatureDataChange: (v: string) => void;
};

const SIG_FONTS = ["'Brush Script MT', cursive", "'Segoe Script', cursive", "'Lucida Handwriting', cursive"];

export function SignaturePad({ name, onNameChange, method, onMethodChange, signatureData, onSignatureDataChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [typedFont, setTypedFont] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || method !== "draw") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [method]);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onSignatureDataChange(canvas.toDataURL("image/png"));
  }

  function clearDraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    onSignatureDataChange("");
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onSignatureDataChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (method === "type" && name.trim()) {
      onSignatureDataChange(JSON.stringify({ type: "typed", name: name.trim(), font: SIG_FONTS[typedFont] }));
    }
  }, [method, name, typedFont, onSignatureDataChange]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {(["draw", "type", "upload"] as SigMethod[]).map(m => (
          <button key={m} type="button" onClick={() => onMethodChange(m)}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
              method === m ? "bg-card shadow text-foreground" : "text-muted-foreground")}>
            {m === "draw" ? "Draw" : m === "type" ? "Type" : "Upload"}
          </button>
        ))}
      </div>

      {method === "draw" && (
        <div>
          <canvas ref={canvasRef} width={280} height={100}
            className="w-full border border-border rounded-lg bg-white dark:bg-card cursor-crosshair touch-none"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
          <button type="button" onClick={clearDraw} className="text-xs text-muted-foreground mt-1 hover:underline">Clear</button>
        </div>
      )}

      {method === "type" && (
        <div className="space-y-2">
          <input value={name} onChange={e => onNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            placeholder="Type your full legal name" />
          <div className="flex gap-2">
            {SIG_FONTS.map((f, i) => (
              <button key={i} type="button" onClick={() => setTypedFont(i)}
                className={cn("flex-1 py-3 border rounded-lg text-lg transition-colors",
                  typedFont === i ? "border-primary bg-primary/5" : "border-border")}
                style={{ fontFamily: f }}>{name || "Signature"}</button>
            ))}
          </div>
        </div>
      )}

      {method === "upload" && (
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="text-sm" />
          {signatureData && signatureData.startsWith("data:image") && (
            <img src={signatureData} alt="Signature" className="mx-auto mt-3 max-h-16" />
          )}
          <p className="text-xs text-muted-foreground mt-2">PNG or JPG with transparent background recommended</p>
        </div>
      )}
    </div>
  );
}
