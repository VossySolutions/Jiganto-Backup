import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { crmToolBtn } from "@/lib/crm-monday-chrome";

export type BoardPersonUser = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

type BoardPersonFilterProps = {
  users: BoardPersonUser[];
  value: string; // "all" | "__unassigned__" | userId
  onChange: (value: string) => void;
  maxAvatars?: number;
};

/** Leads-identical Person / avatar owner filter strip. */
export function BoardPersonFilter({
  users,
  value,
  onChange,
  maxAvatars = 12,
}: BoardPersonFilterProps) {
  return (
    <div className="flex items-center gap-0.5" data-testid="board-person-filter">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={crmToolBtn(value === "all" || !value)}
        title="All people"
      >
        <UserRound className="h-3.5 w-3.5" />
        Person
      </button>
      <button
        type="button"
        onClick={() => onChange(value === "__unassigned__" ? "all" : "__unassigned__")}
        className={cn(
          "h-7 w-7 rounded-full border text-[10px] font-semibold transition-colors",
          value === "__unassigned__"
            ? "ring-2 ring-primary border-primary"
            : "border-border bg-background text-muted-foreground hover:bg-muted",
        )}
        title="Unassigned"
      >
        —
      </button>
      {users.slice(0, maxAvatars).map((user) => {
        const active = value === user.id;
        return (
          <button
            key={user.id}
            type="button"
            title={user.name}
            onClick={() => onChange(active ? "all" : user.id)}
            className={cn(
              "h-7 w-7 rounded-full text-white text-[10px] font-semibold transition-transform",
              active && "ring-2 ring-offset-1 ring-offset-background ring-primary scale-105",
            )}
            style={{ backgroundColor: user.color }}
            data-testid={`filter-owner-avatar-${user.id}`}
          >
            {user.initials}
          </button>
        );
      })}
    </div>
  );
}
