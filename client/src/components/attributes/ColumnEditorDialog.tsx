import { useState } from "react";
import { ATTRIBUTE_TYPES, ATTRIBUTE_TYPE_INFO, type AttributeType } from "@shared/attributeTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, Calendar, Tag, CheckSquare, Type, FileText, ListChecks, Link, Paperclip, Hash, CircleDot, User,
  Link2, Users, ThumbsUp, TrendingUp, Star, Mail, Phone, Calculator, RefreshCw, UserCheck, MousePointerClick, Fingerprint
} from "lucide-react";

interface ColumnEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (column: { title: string; key: string; type: string; options?: Record<string, unknown> }) => void;
  existingColumn?: {
    title: string;
    key: string;
    type: string;
    options?: Record<string, unknown>;
  };
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Clock, Calendar, Tag, CheckSquare, Type, FileText, ListChecks, Link, Paperclip, Hash, CircleDot, User,
  Link2, Users, ThumbsUp, TrendingUp, Star, Mail, Phone, Calculator, RefreshCw, UserCheck, MousePointerClick, Fingerprint,
};

export function ColumnEditorDialog({ open, onOpenChange, onSave, existingColumn }: ColumnEditorDialogProps) {
  const [step, setStep] = useState<"type" | "configure">(existingColumn ? "configure" : "type");
  const [selectedType, setSelectedType] = useState<AttributeType | "">(existingColumn?.type as AttributeType || "");
  const [title, setTitle] = useState(existingColumn?.title || "");
  const [options, setOptions] = useState<Record<string, unknown>>(existingColumn?.options || {});

  const handleTypeSelect = (type: AttributeType) => {
    setSelectedType(type);
    const info = ATTRIBUTE_TYPE_INFO[type];
    setOptions(info.defaultOptions || {});
    setStep("configure");
  };

  const handleSave = () => {
    if (!selectedType || !title.trim()) return;
    
    const key = title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    onSave({
      title: title.trim(),
      key,
      type: selectedType,
      options: Object.keys(options).length > 0 ? options : undefined,
    });
    
    setStep("type");
    setSelectedType("");
    setTitle("");
    setOptions({});
    onOpenChange(false);
  };

  const handleClose = () => {
    setStep("type");
    setSelectedType("");
    setTitle("");
    setOptions({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "type" ? "Add Custom Attribute" : "Configure Attribute"}
          </DialogTitle>
        </DialogHeader>

        {step === "type" ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ATTRIBUTE_TYPE_INFO).map(([type, info]) => {
                const Icon = iconMap[info.icon] || Type;
                return (
                  <button
                    key={type}
                    onClick={() => handleTypeSelect(type as AttributeType)}
                    className="flex flex-col items-start gap-2 p-3 rounded-lg border hover-elevate text-left transition-colors"
                    data-testid={`attr-type-${type}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{info.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {info.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Attribute Name</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Due Date, Priority, Hours Logged"
                data-testid="column-title-input"
              />
            </div>

            {selectedType && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const Icon = iconMap[ATTRIBUTE_TYPE_INFO[selectedType as AttributeType].icon] || Type;
                    return <Icon className="h-4 w-4 text-primary" />;
                  })()}
                  <span className="font-medium text-sm">
                    {ATTRIBUTE_TYPE_INFO[selectedType as AttributeType].label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ATTRIBUTE_TYPE_INFO[selectedType as AttributeType].description}
                </p>
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.NUMBER && (
              <div className="space-y-2">
                <Label>Number Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["integer", "decimal", "currency", "percentage"].map((fmt) => (
                    <Button
                      key={fmt}
                      variant={options.format === fmt ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOptions({ ...options, format: fmt })}
                      data-testid={`format-${fmt}`}
                    >
                      {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.STATUS && (
              <div className="space-y-2">
                <Label>Status Options (comma-separated)</Label>
                <Input
                  value={(options.options as string[] || ["To Do", "In Progress", "Done"]).join(", ")}
                  onChange={(e) => setOptions({ ...options, options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="To Do, In Progress, Done"
                  data-testid="status-options-input"
                />
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.DATE && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeTime"
                  checked={options.includeTime as boolean || false}
                  onChange={(e) => setOptions({ ...options, includeTime: e.target.checked })}
                  data-testid="include-time-checkbox"
                />
                <Label htmlFor="includeTime">Include time</Label>
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.RATING && (
              <div className="space-y-2">
                <Label>Maximum Rating</Label>
                <div className="flex gap-2">
                  {[3, 5, 10].map((max) => (
                    <Button
                      key={max}
                      variant={options.max === max ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOptions({ ...options, max })}
                      data-testid={`rating-max-${max}`}
                    >
                      {max} Stars
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.PROGRESS && (
              <p className="text-xs text-muted-foreground">
                Progress is displayed as a 0-100% slider bar.
              </p>
            )}

            {selectedType === ATTRIBUTE_TYPES.FORMULA && (
              <div className="space-y-2">
                <Label>Formula Expression</Label>
                <Input
                  value={(options.formula as string) || ""}
                  onChange={(e) => setOptions({ ...options, formula: e.target.value })}
                  placeholder="e.g., {price} * {quantity}"
                  className="font-mono text-sm"
                  data-testid="formula-expression-input"
                />
                <p className="text-xs text-muted-foreground">
                  Use column keys in curly braces. E.g., {"{hours}"} * {"{rate}"}
                </p>
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.CREATED_BY && (
              <p className="text-xs text-muted-foreground">
                Automatically shows who created each item with their avatar.
              </p>
            )}

            {selectedType === ATTRIBUTE_TYPES.BUTTON && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Button Label</Label>
                  <Input
                    value={(options.label as string) || "Click"}
                    onChange={(e) => setOptions({ ...options, label: e.target.value })}
                    placeholder="e.g., Mark Complete"
                    data-testid="button-label-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "none", label: "None" },
                      { value: "mark_complete", label: "Mark Complete" },
                      { value: "send_notification", label: "Send Notification" },
                      { value: "custom", label: "Custom Automation" },
                    ].map((action) => (
                      <Button
                        key={action.value}
                        type="button"
                        variant={options.action === action.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOptions({ ...options, action: action.value })}
                        data-testid={`button-action-${action.value}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.CUSTOM_ID && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>ID Prefix (optional)</Label>
                  <Input
                    value={(options.prefix as string) || ""}
                    onChange={(e) => setOptions({ ...options, prefix: e.target.value })}
                    placeholder="e.g., TASK, PRJ, REQ"
                    className="font-mono"
                    data-testid="custom-id-prefix-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Items will display as PREFIX-001, PREFIX-002, etc.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoIncrement"
                    checked={options.autoIncrement !== false}
                    onChange={(e) => setOptions({ ...options, autoIncrement: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="custom-id-auto-increment"
                  />
                  <Label htmlFor="autoIncrement">Auto-increment IDs</Label>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "configure" && (
            <Button variant="ghost" onClick={() => setStep("type")} data-testid="back-button">
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} data-testid="cancel-button">
            Cancel
          </Button>
          {step === "configure" && (
            <Button onClick={handleSave} disabled={!title.trim()} data-testid="save-column-button">
              Add Attribute
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
