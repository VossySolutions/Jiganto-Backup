import { usePermissions } from "@/hooks/use-permissions";
import { useClientContext } from "@/hooks/use-client-context";

/** Section 3: read-only roles cannot create or modify data in the UI. */
export function useReadOnly(): boolean {
  const { isReadOnly: fromPerms } = usePermissions();
  const { isReadOnly: fromContext } = useClientContext();
  return fromPerms || fromContext;
}
