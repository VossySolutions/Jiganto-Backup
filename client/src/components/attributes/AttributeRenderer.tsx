import { ATTRIBUTE_TYPES, type TimeTrackingValue, type ChecklistValue, type LinkValue, type LabelValue, type MembersValue, type VoteValue, type ReferenceValue } from "@shared/attributeTypes";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Clock,
  Calendar,
  ExternalLink,
  Paperclip,
  CheckSquare,
  Square,
  ThumbsUp,
  Star,
  Mail,
  Phone,
  Link2,
  MousePointerClick
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AttributeRendererProps {
  type: string;
  value: unknown;
  options?: Record<string, unknown>;
}

export function AttributeRenderer({ type, value, options }: AttributeRendererProps) {
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  switch (type) {
    case ATTRIBUTE_TYPES.TIME_TRACKING:
      return <TimeTrackingRenderer value={value as TimeTrackingValue} />;
    case ATTRIBUTE_TYPES.DATE:
      return <DateRenderer value={value as string} options={options} />;
    case ATTRIBUTE_TYPES.LABELS:
      return <LabelsRenderer value={value as LabelValue} />;
    case ATTRIBUTE_TYPES.CHECKBOX:
      return <CheckboxRenderer value={value as boolean} />;
    case ATTRIBUTE_TYPES.TEXT:
      return <TextRenderer value={value as string} />;
    case ATTRIBUTE_TYPES.LONG_TEXT:
      return <LongTextRenderer value={value as string} />;
    case ATTRIBUTE_TYPES.CHECKLIST:
      return <ChecklistRenderer value={value as ChecklistValue} />;
    case ATTRIBUTE_TYPES.LINKS:
      return <LinksRenderer value={value as LinkValue} />;
    case ATTRIBUTE_TYPES.ATTACHMENTS:
      return <AttachmentsRenderer value={value as { name: string; url: string }[]} />;
    case ATTRIBUTE_TYPES.NUMBER:
      return <NumberRenderer value={value as number} options={options} />;
    case ATTRIBUTE_TYPES.STATUS:
      return <StatusRenderer value={value as string} />;
    case ATTRIBUTE_TYPES.PERSON:
      return <PersonRenderer value={value as string} />;
    case ATTRIBUTE_TYPES.REFERENCE:
      return <ReferenceRenderer value={value as ReferenceValue} />;
    case ATTRIBUTE_TYPES.MEMBERS:
      return <MembersRenderer value={value as MembersValue} />;
    case ATTRIBUTE_TYPES.VOTE:
      return <VoteRenderer value={value as VoteValue} />;
    case ATTRIBUTE_TYPES.PROGRESS:
      return <ProgressRenderer value={value as number} />;
    case ATTRIBUTE_TYPES.RATING:
      return <RatingRenderer value={value as number} options={options} />;
    case ATTRIBUTE_TYPES.EMAIL:
      return <EmailRenderer value={value as string} />;
    case ATTRIBUTE_TYPES.PHONE:
      return <PhoneRenderer value={value as string} />;
    case ATTRIBUTE_TYPES.FORMULA:
      return <FormulaRenderer value={value as number | string} />;
    case ATTRIBUTE_TYPES.UPDATED_AT:
    case ATTRIBUTE_TYPES.CREATED_AT:
      return <TimestampRenderer value={value as string} />;
    case ATTRIBUTE_TYPES.CREATED_BY:
      return <CreatedByRenderer value={value as { id: string; name: string }} />;
    case ATTRIBUTE_TYPES.BUTTON:
      return <ButtonRenderer options={options} />;
    case ATTRIBUTE_TYPES.CUSTOM_ID:
      return <CustomIdRenderer value={value as string} options={options} />;
    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

function TimeTrackingRenderer({ value }: { value: TimeTrackingValue }) {
  const totalSeconds = value?.totalSeconds || 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  return (
    <div className="flex items-center gap-1 text-sm">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{hours}h {minutes}m</span>
    </div>
  );
}

function DateRenderer({ value, options }: { value: string; options?: Record<string, unknown> }) {
  const date = new Date(value);
  const includeTime = options?.includeTime as boolean;
  
  const formatted = includeTime
    ? date.toLocaleString()
    : date.toLocaleDateString();
  
  return (
    <div className="flex items-center gap-1 text-sm">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{formatted}</span>
    </div>
  );
}

function LabelsRenderer({ value }: { value: LabelValue }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  
  const colorMap: Record<string, string> = {
    blue: "bg-status-blue text-status-blue-foreground",
    green: "bg-status-green text-status-green-foreground",
    yellow: "bg-status-amber text-status-amber-foreground",
    red: "bg-status-red text-status-red-foreground",
    purple: "bg-status-purple text-status-purple-foreground",
    orange: "bg-status-amber text-status-amber-foreground",
  };
  
  return (
    <div className="flex flex-wrap gap-1">
      {value.map((label) => (
        <Badge
          key={label.id}
          variant="secondary"
          className={`text-xs ${colorMap[label.color] || ""}`}
        >
          {label.text}
        </Badge>
      ))}
    </div>
  );
}

function CheckboxRenderer({ value }: { value: boolean }) {
  return (
    <Checkbox checked={value} disabled className="pointer-events-none" />
  );
}

function TextRenderer({ value }: { value: string }) {
  return <span className="text-sm">{value}</span>;
}

function LongTextRenderer({ value }: { value: string }) {
  const truncated = value.length > 100 ? value.substring(0, 100) + "..." : value;
  return <span className="text-sm text-muted-foreground">{truncated}</span>;
}

function ChecklistRenderer({ value }: { value: ChecklistValue }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  
  const completed = value.filter((item) => item.completed).length;
  const total = value.length;
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1">
        {completed === total ? (
          <CheckSquare className="h-3.5 w-3.5 text-brand-green" />
        ) : (
          <Square className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>{completed}/{total}</span>
      </div>
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function LinksRenderer({ value }: { value: LinkValue }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      {value.slice(0, 3).map((link, idx) => (
        <a
          key={idx}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          data-testid={`link-${idx}`}
        >
          <ExternalLink className="h-3 w-3" />
          {link.title || "Link"}
        </a>
      ))}
      {value.length > 3 && (
        <span className="text-xs text-muted-foreground">+{value.length - 3} more</span>
      )}
    </div>
  );
}

function AttachmentsRenderer({ value }: { value: { name: string; url: string }[] }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  
  return (
    <div className="flex items-center gap-1 text-sm">
      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{value.length} file{value.length !== 1 ? "s" : ""}</span>
    </div>
  );
}

function NumberRenderer({ value, options }: { value: number; options?: Record<string, unknown> }) {
  const format = options?.format as string || "integer";
  const prefix = options?.prefix as string || "";
  const suffix = options?.suffix as string || "";
  const decimals = options?.decimals as number || 2;
  
  let formatted: string;
  switch (format) {
    case "currency":
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (options?.currency as string) || "USD",
      }).format(value);
      break;
    case "percentage":
      formatted = `${value}%`;
      break;
    case "decimal":
      formatted = value.toFixed(decimals);
      break;
    default:
      formatted = Math.round(value).toString();
  }
  
  return <span className="text-sm font-mono">{prefix}{formatted}{suffix}</span>;
}

function StatusRenderer({ value }: { value: string }) {
  const statusColors: Record<string, string> = {
    "To Do": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    "In Progress": "bg-status-blue text-status-blue-foreground",
    "Done": "bg-status-green text-status-green-foreground",
    "Blocked": "bg-status-red text-status-red-foreground",
  };
  
  return (
    <Badge variant="secondary" className={statusColors[value] || ""}>
      {value}
    </Badge>
  );
}

function PersonRenderer({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-xs">{value.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function ReferenceRenderer({ value }: { value: ReferenceValue }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      {value.map((ref) => (
        <Badge key={ref.itemId} variant="outline" className="gap-1 text-xs">
          <Link2 className="h-3 w-3" />
          {ref.title}
        </Badge>
      ))}
    </div>
  );
}

function MembersRenderer({ value }: { value: MembersValue }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  
  return (
    <div className="flex -space-x-2">
      {value.slice(0, 4).map((member) => (
        <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
          <AvatarFallback className="text-xs">{member.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      ))}
      {value.length > 4 && (
        <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
          +{value.length - 4}
        </div>
      )}
    </div>
  );
}

function VoteRenderer({ value }: { value: VoteValue }) {
  const count = value?.count || 0;
  
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-medium">{count}</span>
    </div>
  );
}

function ProgressRenderer({ value }: { value: number }) {
  const progress = Math.min(100, Math.max(0, value || 0));
  
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{progress}%</span>
    </div>
  );
}

function RatingRenderer({ value, options }: { value: number; options?: Record<string, unknown> }) {
  const max = (options?.max as number) || 5;
  const rating = Math.min(max, Math.max(0, value || 0));
  
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, idx) => (
        <Star
          key={idx}
          className={`h-4 w-4 ${idx < rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

function EmailRenderer({ value }: { value: string }) {
  return (
    <a
      href={`mailto:${value}`}
      className="flex items-center gap-1 text-sm text-primary hover:underline"
      data-testid="email-link"
    >
      <Mail className="h-3.5 w-3.5" />
      <span>{value}</span>
    </a>
  );
}

function PhoneRenderer({ value }: { value: string }) {
  return (
    <a
      href={`tel:${value}`}
      className="flex items-center gap-1 text-sm text-primary hover:underline"
      data-testid="phone-link"
    >
      <Phone className="h-3.5 w-3.5" />
      <span>{value}</span>
    </a>
  );
}

function FormulaRenderer({ value }: { value: number | string }) {
  return <span className="text-sm font-mono">{value}</span>;
}

function TimestampRenderer({ value }: { value: string }) {
  const date = new Date(value);
  return (
    <span className="text-sm text-muted-foreground">
      {date.toLocaleString()}
    </span>
  );
}

function CreatedByRenderer({ value }: { value: { id: string; name: string } }) {
  if (!value?.name) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  
  const initials = value.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-1.5">
      <Avatar className="h-5 w-5">
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm">{value.name}</span>
    </div>
  );
}

function ButtonRenderer({ options }: { options?: Record<string, unknown> }) {
  const label = (options?.label as string) || "Click";
  
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        console.log("Button triggered:", options?.action);
      }}
      data-testid="button-attribute-cell"
    >
      <MousePointerClick className="h-3 w-3 mr-1" />
      {label}
    </Button>
  );
}

function CustomIdRenderer({ value, options }: { value: string; options?: Record<string, unknown> }) {
  const prefix = (options?.prefix as string) || "";
  const displayValue = prefix ? `${prefix}-${value}` : value;
  
  return (
    <span className="text-sm font-mono text-muted-foreground">
      {displayValue || "—"}
    </span>
  );
}
