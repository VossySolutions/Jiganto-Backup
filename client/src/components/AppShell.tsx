import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ModuleShell } from "@/components/ModuleShell";

/** Authenticated layout: sidebar + main content with workspace banner. */
export function AppShell({ children }: { children: ReactNode }) {
  return <ModuleShell mainClassName="min-h-screen">{children}</ModuleShell>;
}

/** Shown while a lazy-loaded module page chunk is loading — keeps sidebar visible. */
export function ShellPageLoader() {
  return (
    <ModuleShell mainClassName="min-h-screen">
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    </ModuleShell>
  );
}
