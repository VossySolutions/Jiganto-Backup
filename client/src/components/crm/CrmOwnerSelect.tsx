import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmUsers } from "./CrmUsersProvider";

interface CrmOwnerSelectProps {
  value: string;
  onChange: (ownerUserId: string) => void;
  label?: string;
  testId?: string;
  className?: string;
}

export function CrmOwnerSelect({
  value,
  onChange,
  label = "Owner",
  testId = "select-owner",
  className,
}: CrmOwnerSelectProps) {
  const { users, resolveOwner } = useCrmUsers();

  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select
        value={value || "unassigned"}
        onValueChange={(v) => onChange(v === "unassigned" ? "" : v)}
      >
        <SelectTrigger data-testid={testId}>
          <SelectValue placeholder="Select owner..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {resolveOwner(user.id).name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
