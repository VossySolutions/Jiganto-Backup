import { useState } from "react";
import { ATTRIBUTE_TYPES, ATTRIBUTE_TYPE_INFO, type AttributeType } from "@shared/attributeTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Plus, Clock, Calendar, Tag, CheckSquare, Type, FileText, ListChecks, Link, Paperclip, Hash, CircleDot, User,
  Link2, Users, ThumbsUp, TrendingUp, Star, Mail, Phone, Calculator, RefreshCw, UserCheck, MousePointerClick, Fingerprint,
  ChevronDown
} from "lucide-react";

interface AddColumnDropdownProps {
  onAddColumn: (column: { title: string; key: string; type: string; options?: Record<string, unknown> }) => void;
  variant?: "default" | "minimal";
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Clock, Calendar, Tag, CheckSquare, Type, FileText, ListChecks, Link, Paperclip, Hash, CircleDot, User,
  Link2, Users, ThumbsUp, TrendingUp, Star, Mail, Phone, Calculator, RefreshCw, UserCheck, MousePointerClick, Fingerprint,
};

const attributeGroups = [
  {
    label: "Core",
    types: [
      ATTRIBUTE_TYPES.TEXT,
      ATTRIBUTE_TYPES.LONG_TEXT,
      ATTRIBUTE_TYPES.NUMBER,
      ATTRIBUTE_TYPES.DATE,
      ATTRIBUTE_TYPES.CHECKBOX,
      ATTRIBUTE_TYPES.STATUS,
      ATTRIBUTE_TYPES.LABELS,
      ATTRIBUTE_TYPES.PERSON,
    ]
  },
  {
    label: "Advanced",
    types: [
      ATTRIBUTE_TYPES.CHECKLIST,
      ATTRIBUTE_TYPES.LINKS,
      ATTRIBUTE_TYPES.ATTACHMENTS,
      ATTRIBUTE_TYPES.TIME_TRACKING,
      ATTRIBUTE_TYPES.PROGRESS,
      ATTRIBUTE_TYPES.RATING,
      ATTRIBUTE_TYPES.VOTE,
      ATTRIBUTE_TYPES.MEMBERS,
    ]
  },
  {
    label: "Contact",
    types: [
      ATTRIBUTE_TYPES.EMAIL,
      ATTRIBUTE_TYPES.PHONE,
    ]
  },
  {
    label: "Automation",
    types: [
      ATTRIBUTE_TYPES.FORMULA,
      ATTRIBUTE_TYPES.BUTTON,
      ATTRIBUTE_TYPES.CUSTOM_ID,
      ATTRIBUTE_TYPES.REFERENCE,
    ]
  },
  {
    label: "System",
    types: [
      ATTRIBUTE_TYPES.CREATED_AT,
      ATTRIBUTE_TYPES.UPDATED_AT,
      ATTRIBUTE_TYPES.CREATED_BY,
    ]
  },
];

export function AddColumnDropdown({ onAddColumn, variant = "default" }: AddColumnDropdownProps) {
  const [selectedType, setSelectedType] = useState<AttributeType | null>(null);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const handleTypeSelect = (type: AttributeType) => {
    const info = ATTRIBUTE_TYPE_INFO[type];
    setSelectedType(type);
    setTitle(info.label);
    setOptions(info.defaultOptions || {});
    setConfigDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedType || !title.trim()) return;
    
    const key = title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    onAddColumn({
      title: title.trim(),
      key,
      type: selectedType,
      options,
    });
    
    setConfigDialogOpen(false);
    setSelectedType(null);
    setTitle("");
    setOptions({});
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "minimal" ? (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 gap-1 text-muted-foreground text-xs font-normal" 
              data-testid="add-column-dropdown"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Column
            </Button>
          ) : (
            <Button variant="outline" className="gap-2 rounded-xl" data-testid="add-column-dropdown">
              <Plus className="h-4 w-4" />
              Add Column
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
          {attributeGroups.map((group, idx) => (
            <div key={group.label}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground">{group.label}</DropdownMenuLabel>
              {group.types.map((type) => {
                const info = ATTRIBUTE_TYPE_INFO[type];
                const IconComponent = iconMap[info.icon] || Hash;
                return (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => handleTypeSelect(type)}
                    className="gap-2 cursor-pointer"
                    data-testid={`add-attr-${type}`}
                  >
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    <span>{info.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Configure Column</DialogTitle>
            <DialogDescription>
              {selectedType && ATTRIBUTE_TYPE_INFO[selectedType]?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Column Name</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter column name"
                data-testid="column-name-input"
              />
            </div>

            {selectedType === ATTRIBUTE_TYPES.NUMBER && (
              <div className="space-y-2">
                <Label>Number Format</Label>
                <div className="flex flex-wrap gap-2">
                  {["integer", "decimal", "currency", "percentage"].map((fmt) => (
                    <Button
                      key={fmt}
                      type="button"
                      variant={options.format === fmt ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOptions({ ...options, format: fmt })}
                    >
                      {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.RATING && (
              <div className="space-y-2">
                <Label>Max Stars</Label>
                <div className="flex gap-2">
                  {[3, 5, 10].map((max) => (
                    <Button
                      key={max}
                      type="button"
                      variant={options.max === max ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOptions({ ...options, max })}
                    >
                      {max} Stars
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedType === ATTRIBUTE_TYPES.CUSTOM_ID && (
              <div className="space-y-2">
                <Label>ID Prefix (optional)</Label>
                <Input
                  value={(options.prefix as string) || ""}
                  onChange={(e) => setOptions({ ...options, prefix: e.target.value })}
                  placeholder="e.g., TASK, PRJ"
                  className="font-mono"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!title.trim()} data-testid="save-column-btn">
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
