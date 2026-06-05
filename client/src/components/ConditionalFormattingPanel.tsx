import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical,
  Copy, Paintbrush, Palette, BookTemplate, Eye,
  Bold, Italic, ArrowUp, ArrowDown,
} from "lucide-react";
import type { ColumnDef } from "@/components/MondayTable";
import {
  ConditionalFormatRule,
  ConditionalFormatStyle,
  ConditionOperator,
  FormatScope,
  PRESET_COLORS,
  RULE_TEMPLATES,
  RuleTemplate,
  createDefaultRule,
  generateRuleId,
  getOperatorLabel,
  getOperatorsForColumnType,
  operatorNeedsValue,
  operatorNeedsSecondValue,
  evaluateConditionalFormatting,
} from "@/lib/conditionalFormatting";

interface ConditionalFormattingPanelProps<T extends { id: number | string }> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: ConditionalFormatRule[];
  onRulesChange: (rules: ConditionalFormatRule[]) => void;
  columns: ColumnDef<T>[];
  data: T[];
}

function RuleEditor<T extends { id: number | string }>({
  rule,
  columns,
  data,
  onChange,
  onDelete,
  onDuplicate,
  onMovePriority,
  totalRules,
}: {
  rule: ConditionalFormatRule;
  columns: ColumnDef<T>[];
  data: T[];
  onChange: (updated: ConditionalFormatRule) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMovePriority: (direction: "up" | "down") => void;
  totalRules: number;
}) {
  const [expanded, setExpanded] = useState(true);

  const selectedColumn = useMemo(
    () => columns.find(c => c.id === rule.columnId),
    [columns, rule.columnId]
  );

  const availableOperators = useMemo(
    () => getOperatorsForColumnType(selectedColumn?.type || "text"),
    [selectedColumn?.type]
  );

  const matchCount = useMemo(() => {
    if (!rule.columnId) return 0;
    const fmt = evaluateConditionalFormatting(data, columns, [rule]);
    return Object.keys(fmt).length;
  }, [data, columns, rule]);

  const update = (partial: Partial<ConditionalFormatRule>) => {
    onChange({ ...rule, ...partial });
  };

  const updateStyle = (partial: Partial<ConditionalFormatStyle>) => {
    onChange({ ...rule, style: { ...rule.style, ...partial } });
  };

  const visibleColumns = columns.filter(c => !c.hidden);

  return (
    <div
      className={cn(
        "rounded-md border border-border/40 bg-card",
        !rule.enabled && "opacity-60"
      )}
      data-testid={`cf-rule-${rule.id}`}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid={`cf-rule-header-${rule.id}`}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <div
          className="h-4 w-4 rounded-sm flex-shrink-0 border border-border/30"
          style={{ backgroundColor: rule.style.bgColor || "transparent" }}
        />
        <span className="text-sm font-medium truncate flex-1">{rule.name || "Unnamed Rule"}</span>
        <Badge variant="secondary" className="text-[10px]">
          {matchCount} {matchCount === 1 ? "match" : "matches"}
        </Badge>
        <Switch
          checked={rule.enabled}
          onCheckedChange={(checked) => update({ enabled: checked })}
          onClick={(e) => e.stopPropagation()}
          data-testid={`cf-rule-toggle-${rule.id}`}
        />
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/20 pt-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Rule Name</Label>
            <Input
              value={rule.name}
              onChange={(e) => update({ name: e.target.value })}
              className="h-8 text-sm"
              data-testid={`cf-rule-name-${rule.id}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Target Field</Label>
              <Select
                value={rule.columnId}
                onValueChange={(v) => {
                  const col = columns.find(c => c.id === v);
                  const ops = getOperatorsForColumnType(col?.type || "text");
                  const newOp = ops.includes(rule.operator) ? rule.operator : ops[0];
                  update({ columnId: v, operator: newOp });
                }}
              >
                <SelectTrigger className="h-8 text-sm" data-testid={`cf-rule-column-${rule.id}`}>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {visibleColumns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Scope</Label>
              <Select
                value={rule.scope}
                onValueChange={(v) => update({ scope: v as FormatScope })}
              >
                <SelectTrigger className="h-8 text-sm" data-testid={`cf-rule-scope-${rule.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cell">Cell Only</SelectItem>
                  <SelectItem value="row">Entire Row</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Condition</Label>
              <Select
                value={rule.operator}
                onValueChange={(v) => update({ operator: v as ConditionOperator })}
              >
                <SelectTrigger className="h-8 text-sm" data-testid={`cf-rule-operator-${rule.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {getOperatorLabel(op)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {operatorNeedsValue(rule.operator) && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {operatorNeedsSecondValue(rule.operator) ? "From" : "Value"}
                </Label>
                <Input
                  value={rule.value ?? ""}
                  onChange={(e) => update({ value: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="Enter value"
                  data-testid={`cf-rule-value-${rule.id}`}
                />
              </div>
            )}
          </div>

          {operatorNeedsSecondValue(rule.operator) && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
              <Input
                value={rule.value2 ?? ""}
                onChange={(e) => update({ value2: e.target.value })}
                className="h-8 text-sm"
                placeholder="Enter upper bound"
                data-testid={`cf-rule-value2-${rule.id}`}
              />
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Formatting Style</Label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((preset) => (
                  <Tooltip key={preset.label}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "h-6 w-6 rounded-md border border-border/50 transition-all",
                          rule.style.bgColor === preset.bg && "ring-2 ring-primary ring-offset-1"
                        )}
                        style={{ backgroundColor: preset.bg }}
                        onClick={() => updateStyle({ bgColor: preset.bg, textColor: preset.text })}
                        data-testid={`cf-color-${preset.label.toLowerCase()}-${rule.id}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{preset.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground">BG</Label>
                  <input
                    type="color"
                    value={rule.style.bgColor || "#FFFFFF"}
                    onChange={(e) => updateStyle({ bgColor: e.target.value })}
                    className="h-6 w-6 rounded cursor-pointer border border-border/50"
                    data-testid={`cf-bg-picker-${rule.id}`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground">Text</Label>
                  <input
                    type="color"
                    value={rule.style.textColor || "#000000"}
                    onChange={(e) => updateStyle({ textColor: e.target.value })}
                    className="h-6 w-6 rounded cursor-pointer border border-border/50"
                    data-testid={`cf-text-picker-${rule.id}`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7 toggle-elevate", rule.style.bold && "toggle-elevated bg-accent")}
                    onClick={() => updateStyle({ bold: !rule.style.bold })}
                    data-testid={`cf-bold-${rule.id}`}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7 toggle-elevate", rule.style.italic && "toggle-elevated bg-accent")}
                    onClick={() => updateStyle({ italic: !rule.style.italic })}
                    data-testid={`cf-italic-${rule.id}`}
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-md px-3 py-2 text-sm border border-border/20"
            style={{
              backgroundColor: rule.style.bgColor || "transparent",
              color: rule.style.textColor || "inherit",
              fontWeight: rule.style.bold ? "bold" : "normal",
              fontStyle: rule.style.italic ? "italic" : "normal",
            }}
            data-testid={`cf-preview-${rule.id}`}
          >
            <Eye className="h-3 w-3 inline mr-1.5 opacity-60" />
            Sample preview text — {matchCount} {matchCount === 1 ? "record matches" : "records match"}
          </div>

          <div className="flex items-center gap-1 pt-1 border-t border-border/20">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={rule.priority <= 1}
                  onClick={() => onMovePriority("up")}
                  data-testid={`cf-priority-up-${rule.id}`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Higher priority</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={rule.priority >= totalRules}
                  onClick={() => onMovePriority("down")}
                  data-testid={`cf-priority-down-${rule.id}`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lower priority</TooltipContent>
            </Tooltip>
            <span className="text-[10px] text-muted-foreground ml-1">Priority {rule.priority}</span>
            <div className="flex-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDuplicate}
                  data-testid={`cf-duplicate-${rule.id}`}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate rule</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                  data-testid={`cf-delete-${rule.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete rule</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateSelector<T extends { id: number | string }>({
  columns,
  onApplyTemplate,
}: {
  columns: ColumnDef<T>[];
  onApplyTemplate: (template: RuleTemplate, columnId: string) => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedColumn, setSelectedColumn] = useState<string>("");

  const visibleColumns = columns.filter(c => !c.hidden);

  return (
    <div className="space-y-2 rounded-md border border-border/30 p-3 bg-muted/20">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <BookTemplate className="h-3.5 w-3.5" />
        Quick Templates
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="h-8 text-sm" data-testid="cf-template-select">
            <SelectValue placeholder="Choose template" />
          </SelectTrigger>
          <SelectContent>
            {RULE_TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedColumn} onValueChange={setSelectedColumn}>
          <SelectTrigger className="h-8 text-sm" data-testid="cf-template-column">
            <SelectValue placeholder="Apply to field" />
          </SelectTrigger>
          <SelectContent>
            {visibleColumns.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.header}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedTemplate && (
        <p className="text-xs text-muted-foreground">
          {RULE_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={!selectedTemplate || !selectedColumn}
        onClick={() => {
          const template = RULE_TEMPLATES.find(t => t.id === selectedTemplate);
          if (template && selectedColumn) {
            onApplyTemplate(template, selectedColumn);
            setSelectedTemplate("");
            setSelectedColumn("");
          }
        }}
        className="w-full"
        data-testid="cf-apply-template"
      >
        <Palette className="h-3.5 w-3.5 mr-1.5" />
        Apply Template
      </Button>
    </div>
  );
}

export function ConditionalFormattingPanel<T extends { id: number | string }>({
  open,
  onOpenChange,
  rules,
  onRulesChange,
  columns,
  data,
}: ConditionalFormattingPanelProps<T>) {

  const addRule = () => {
    const firstCol = columns.find(c => !c.hidden);
    const nextPriority = rules.length > 0 ? Math.max(...rules.map(r => r.priority)) + 1 : 1;
    const newRule = createDefaultRule(firstCol?.id, nextPriority);
    onRulesChange([...rules, newRule]);
  };

  const updateRule = (updated: ConditionalFormatRule) => {
    onRulesChange(rules.map(r => r.id === updated.id ? updated : r));
  };

  const deleteRule = (id: string) => {
    const remaining = rules.filter(r => r.id !== id);
    const renumbered = remaining.map((r, i) => ({ ...r, priority: i + 1 }));
    onRulesChange(renumbered);
  };

  const duplicateRule = (rule: ConditionalFormatRule) => {
    const dup: ConditionalFormatRule = {
      ...rule,
      id: generateRuleId(),
      name: `${rule.name} (copy)`,
      priority: rules.length + 1,
    };
    onRulesChange([...rules, dup]);
  };

  const movePriority = (ruleId: string, direction: "up" | "down") => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex(r => r.id === ruleId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const tempPriority = sorted[idx].priority;
    sorted[idx] = { ...sorted[idx], priority: sorted[swapIdx].priority };
    sorted[swapIdx] = { ...sorted[swapIdx], priority: tempPriority };
    onRulesChange(sorted);
  };

  const applyTemplate = (template: RuleTemplate, columnId: string) => {
    const newRules = template.rules.map((r, i) => ({
      ...r,
      id: generateRuleId(),
      columnId,
      priority: rules.length + i + 1,
    }));
    onRulesChange([...rules, ...newRules]);
  };

  const clearAll = () => {
    onRulesChange([]);
  };

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules]
  );

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[460px] overflow-y-auto p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-primary" />
            <SheetTitle className="text-base">Conditional Formatting</SheetTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            {rules.length} {rules.length === 1 ? "rule" : "rules"} ({enabledCount} active)
          </p>
        </SheetHeader>

        <div className="p-4 space-y-3">
          <TemplateSelector
            columns={columns}
            onApplyTemplate={applyTemplate}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addRule}
              className="flex-1"
              data-testid="cf-add-rule"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Rule
            </Button>
            {rules.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-destructive hover:text-destructive"
                data-testid="cf-clear-all"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {sortedRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Paintbrush className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No formatting rules yet</p>
              <p className="text-xs mt-1">Add a rule or apply a template to get started</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="cf-rules-list">
              {sortedRules.map((rule) => (
                <RuleEditor
                  key={rule.id}
                  rule={rule}
                  columns={columns}
                  data={data}
                  onChange={updateRule}
                  onDelete={() => deleteRule(rule.id)}
                  onDuplicate={() => duplicateRule(rule)}
                  onMovePriority={(dir) => movePriority(rule.id, dir)}
                  totalRules={rules.length}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
