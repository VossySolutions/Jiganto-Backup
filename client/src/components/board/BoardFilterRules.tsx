import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BOARD_FILTER_OPERATORS,
  newBoardFilterRule,
  type BoardFilterFieldDef,
  type BoardFilterOperator,
  type BoardFilterRule,
} from "@/lib/board-filters";

type BoardFilterRulesProps = {
  rules: BoardFilterRule[];
  onChange: (rules: BoardFilterRule[]) => void;
  fields: BoardFilterFieldDef[];
  getFieldOptions: (field: string) => { value: string; label: string }[];
};

export function BoardFilterRules({
  rules,
  onChange,
  fields,
  getFieldOptions,
}: BoardFilterRulesProps) {
  const update = (id: string, patch: Partial<BoardFilterRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id));
  const add = () => onChange([...rules, newBoardFilterRule(fields[0]?.field || "name")]);

  return (
    <div className="space-y-2">
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">No filters applied.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, idx) => {
            const op = rule.operator || "is";
            const opMeta = BOARD_FILTER_OPERATORS.find((o) => o.value === op) || BOARD_FILTER_OPERATORS[0];
            const fieldDef = fields.find((f) => f.field === rule.field);
            const useTextInput =
              op === "contains" ||
              op === "not_contains" ||
              op === "gt" ||
              op === "lt" ||
              !!fieldDef?.textInput;
            return (
              <div key={rule.id} className="flex items-center gap-1.5" data-testid={`filter-rule-${idx}`}>
                <span className="text-xs text-muted-foreground w-9 shrink-0">
                  {idx === 0 ? "Where" : "and"}
                </span>
                <Select
                  value={rule.field}
                  onValueChange={(v) => update(rule.id, { field: v, value: "" })}
                >
                  <SelectTrigger className="h-8 w-[100px] text-xs shrink-0" data-testid={`filter-rule-field-${idx}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.field} value={f.field}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={op}
                  onValueChange={(v) =>
                    update(rule.id, {
                      operator: v as BoardFilterOperator,
                      value: BOARD_FILTER_OPERATORS.find((o) => o.value === v)?.needsValue ? rule.value : "",
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[120px] text-xs shrink-0" data-testid={`filter-rule-op-${idx}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOARD_FILTER_OPERATORS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {opMeta.needsValue &&
                  (useTextInput ? (
                    <Input
                      className="h-8 flex-1 text-xs"
                      value={rule.value}
                      placeholder={op === "gt" || op === "lt" ? "Value…" : "Text…"}
                      onChange={(e) => update(rule.id, { value: e.target.value })}
                      data-testid={`filter-rule-value-${idx}`}
                    />
                  ) : (
                    <Select value={rule.value} onValueChange={(v) => update(rule.id, { value: v })}>
                      <SelectTrigger className="h-8 flex-1 text-xs" data-testid={`filter-rule-value-${idx}`}>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFieldOptions(rule.field).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => remove(rule.id)}
                  data-testid={`button-remove-filter-${idx}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-primary hover:text-primary hover:bg-primary/10 gap-1 h-7 px-1.5"
        onClick={add}
        data-testid="button-new-filter"
      >
        <Plus className="h-3.5 w-3.5" />
        New Filter
      </Button>
      {rules.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange([])}
          data-testid="button-clear-filters"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
