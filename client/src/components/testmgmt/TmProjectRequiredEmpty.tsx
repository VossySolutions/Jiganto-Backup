import { FolderKanban } from "lucide-react";

export function TmProjectRequiredEmpty({ title = "Select a test project" }: { title?: string }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[420px] text-center gap-3">
      <div className="bg-primary/10 rounded-full p-4">
        <FolderKanban className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Choose or create a project in the sidebar selector to view test data, cycles, and execution for that engagement.
      </p>
    </div>
  );
}
