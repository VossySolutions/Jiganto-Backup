import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { ReadOnlyGuard } from "@/components/ReadOnlyGuard";

/** Button that is disabled with tooltip when the user has read-only access. */
export function ReadOnlyButton(props: ComponentProps<typeof Button>) {
  return (
    <ReadOnlyGuard>
      <Button {...props} />
    </ReadOnlyGuard>
  );
}
