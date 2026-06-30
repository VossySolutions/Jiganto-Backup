import { Save, Share2, BarChart3, Rocket, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  onBack: () => void;
  onSave: () => void;
  onShare?: () => void;
  onActivate?: () => void;
  onResults?: () => void;
  savePending?: boolean;
  activatePending?: boolean;
  autoSaveStatus?: "idle" | "saving" | "saved";
  status?: string;
  className?: string;
};

export function SurveyBuilderActions({
  title,
  onBack,
  onSave,
  onShare,
  onActivate,
  onResults,
  savePending,
  activatePending,
  autoSaveStatus,
  status,
  className,
}: Props) {
  return (
    <div className={cn("survey-builder-topbar w-full bg-card border-b border-border shrink-0", className)}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>
        <span className="text-sm font-semibold text-foreground truncate min-w-0" title={title}>
          {title || "Untitled Survey"}
        </span>
      </div>
      <div className="survey-builder-actions">
        {autoSaveStatus === "saving" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <SurveyButtonSpinner /> Saving…
          </span>
        )}
        {autoSaveStatus === "saved" && (
          <span className="text-xs text-primary font-medium">✓ Saved</span>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={savePending} data-testid="button-builder-save">
          {savePending ? <SurveyButtonSpinner /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Save
        </Button>
        {onShare && (
          <Button type="button" variant="outline" size="sm" onClick={onShare}>
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            Share
          </Button>
        )}
        {status === "draft" && onActivate && (
          <Button type="button" size="sm" onClick={onActivate} disabled={activatePending}>
            {activatePending ? <SurveyButtonSpinner /> : <Rocket className="h-3.5 w-3.5 mr-1.5" />}
            Activate
          </Button>
        )}
        {status === "active" && onResults && (
          <Button type="button" size="sm" onClick={onResults}>
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Results
          </Button>
        )}
      </div>
    </div>
  );
}
