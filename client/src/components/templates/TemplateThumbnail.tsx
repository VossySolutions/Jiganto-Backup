import { moduleColor, moduleLabel } from "@/lib/template-constants";
import type { PlatformTemplateWithMeta } from "@shared/models/templates";
import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

export function templateThumbnailStyle(template: PlatformTemplateWithMeta): React.CSSProperties {
  const color = moduleColor(template.module);
  return {
    background: `linear-gradient(135deg, ${color}22 0%, ${color}44 50%, ${color}18 100%)`,
  };
}

export function TemplateThumbnail({
  template,
  className,
}: {
  template: PlatformTemplateWithMeta;
  className?: string;
}) {
  const color = moduleColor(template.module);
  if (template.thumbnailUrl) {
    return <img src={template.thumbnailUrl} alt="" className={className} />;
  }
  return (
    <div className={cn("flex flex-col items-center justify-center", className)} style={templateThumbnailStyle(template)}>
      <LayoutTemplate className="h-10 w-10 opacity-40" style={{ color }} />
      <p className="text-[10px] text-center mt-2 opacity-60 px-2 truncate w-full" style={{ color }}>
        {moduleLabel(template.module)}
      </p>
    </div>
  );
}
