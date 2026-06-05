import { Construction } from "lucide-react";

interface PlaceholderScreenProps {
  title: string;
  description: string;
  phase?: string;
}

export function PlaceholderScreen({ title, description, phase = "Phase 2" }: PlaceholderScreenProps) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="bg-muted/50 rounded-full p-4 mb-4">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm max-w-md mb-3">{description}</p>
      <span className="text-xs font-mono bg-primary/10 text-primary px-3 py-1 rounded-full">Coming in {phase}</span>
    </div>
  );
}
