import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { X, LayoutTemplate } from "lucide-react";
import { moduleLabel } from "@/lib/template-constants";

const STORAGE_KEY = "jiganto_save_as_template";

export function setSaveAsTemplateMode(moduleKey: string) {
  sessionStorage.setItem(STORAGE_KEY, moduleKey);
}

export function clearSaveAsTemplateMode() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function SavingAsTemplateBanner() {
  const [moduleKey, setModuleKey] = useState<string | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    setModuleKey(sessionStorage.getItem(STORAGE_KEY));
  }, [location]);

  if (!moduleKey) return null;

  return (
    <div
      className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-2 text-sm"
      data-testid="save-as-template-banner"
    >
      <LayoutTemplate className="h-4 w-4 text-primary shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="font-medium">Saving as template</span>
        <span className="text-muted-foreground"> — create your {moduleLabel(moduleKey).toLowerCase()} then use Save as Template</span>
      </span>
      <button
        type="button"
        onClick={() => { clearSaveAsTemplateMode(); setModuleKey(null); }}
        className="p-1 rounded hover:bg-primary/10"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
