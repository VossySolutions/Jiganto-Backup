import { useState } from "react";
import { ATTRIBUTE_TYPES, type TimeTrackingValue, type ChecklistValue, type LinkValue, type LabelValue, type MembersValue, type VoteValue, type ReferenceValue } from "@shared/attributeTypes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, X, Play, Pause, ExternalLink, Trash2, ThumbsUp, Star, Link2, Clock } from "lucide-react";
import { format } from "date-fns";

interface AttributeEditorProps {
  type: string;
  value: unknown;
  options?: Record<string, unknown>;
  onChange: (value: unknown) => void;
  readonly?: boolean;
}

export function AttributeEditor({ type, value, options, onChange, readonly }: AttributeEditorProps) {
  if (readonly) {
    return <span className="text-sm text-muted-foreground">{String(value || "—")}</span>;
  }

  switch (type) {
    case ATTRIBUTE_TYPES.TIME_TRACKING:
      return <TimeTrackingEditor value={value as TimeTrackingValue} onChange={onChange} />;
    case ATTRIBUTE_TYPES.DATE:
      return <DateEditor value={value as string} onChange={onChange} />;
    case ATTRIBUTE_TYPES.LABELS:
      return <LabelsEditor value={value as LabelValue} options={options} onChange={onChange} />;
    case ATTRIBUTE_TYPES.CHECKBOX:
      return <CheckboxEditor value={value as boolean} onChange={onChange} />;
    case ATTRIBUTE_TYPES.TEXT:
      return <TextEditor value={value as string} options={options} onChange={onChange} />;
    case ATTRIBUTE_TYPES.LONG_TEXT:
      return <LongTextEditor value={value as string} onChange={onChange} />;
    case ATTRIBUTE_TYPES.CHECKLIST:
      return <ChecklistEditor value={value as ChecklistValue} onChange={onChange} />;
    case ATTRIBUTE_TYPES.LINKS:
      return <LinksEditor value={value as LinkValue} onChange={onChange} />;
    case ATTRIBUTE_TYPES.ATTACHMENTS:
      return <AttachmentsEditor value={value as { name: string; url: string }[]} onChange={onChange} />;
    case ATTRIBUTE_TYPES.NUMBER:
      return <NumberEditor value={value as number} options={options} onChange={onChange} />;
    case ATTRIBUTE_TYPES.STATUS:
      return <StatusEditor value={value as string} options={options} onChange={onChange} />;
    case ATTRIBUTE_TYPES.PERSON:
      return <PersonEditor value={value as string} onChange={onChange} />;
    case ATTRIBUTE_TYPES.REFERENCE:
      return <ReferenceEditor value={value as ReferenceValue} onChange={onChange} />;
    case ATTRIBUTE_TYPES.MEMBERS:
      return <MembersEditor value={value as MembersValue} onChange={onChange} />;
    case ATTRIBUTE_TYPES.VOTE:
      return <VoteEditor value={value as VoteValue} onChange={onChange} />;
    case ATTRIBUTE_TYPES.PROGRESS:
      return <ProgressEditor value={value as number} onChange={onChange} />;
    case ATTRIBUTE_TYPES.RATING:
      return <RatingEditor value={value as number} options={options} onChange={onChange} />;
    case ATTRIBUTE_TYPES.EMAIL:
      return <EmailEditor value={value as string} onChange={onChange} />;
    case ATTRIBUTE_TYPES.PHONE:
      return <PhoneEditor value={value as string} onChange={onChange} />;
    case ATTRIBUTE_TYPES.FORMULA:
      return <FormulaEditor value={value as number | string} />;
    case ATTRIBUTE_TYPES.UPDATED_AT:
    case ATTRIBUTE_TYPES.CREATED_AT:
      return <TimestampEditor value={value as string} />;
    case ATTRIBUTE_TYPES.CREATED_BY:
      return <CreatedByEditor value={value as { id: string; name: string } | null} />;
    case ATTRIBUTE_TYPES.BUTTON:
      return <ButtonEditor options={options} />;
    case ATTRIBUTE_TYPES.CUSTOM_ID:
      return <CustomIdEditor value={value as string} onChange={onChange} options={options} />;
    default:
      return <Input value={String(value || "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

function TimeTrackingEditor({ value, onChange }: { value: TimeTrackingValue; onChange: (v: TimeTrackingValue) => void }) {
  const [isTracking, setIsTracking] = useState(false);
  const totalSeconds = value?.totalSeconds || 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const handleToggle = () => {
    setIsTracking(!isTracking);
  };

  const handleAddTime = (mins: number) => {
    onChange({
      ...value,
      totalSeconds: totalSeconds + mins * 60,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-lg font-mono">{hours}h {minutes}m</span>
        <Button size="sm" variant="outline" onClick={handleToggle} data-testid="time-toggle">
          {isTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => handleAddTime(15)} data-testid="add-15m">+15m</Button>
        <Button size="sm" variant="ghost" onClick={() => handleAddTime(30)} data-testid="add-30m">+30m</Button>
        <Button size="sm" variant="ghost" onClick={() => handleAddTime(60)} data-testid="add-1h">+1h</Button>
      </div>
    </div>
  );
}

function DateEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const date = value ? new Date(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="date-picker-trigger">
          {date ? format(date, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(d.toISOString())}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function LabelsEditor({ value, options, onChange }: { value: LabelValue; options?: Record<string, unknown>; onChange: (v: LabelValue) => void }) {
  const [newLabel, setNewLabel] = useState("");
  const labels = value || [];
  const colors = (options?.colors as string[]) || ["blue", "green", "yellow", "red", "purple", "orange"];

  const addLabel = () => {
    if (!newLabel.trim()) return;
    const color = colors[labels.length % colors.length];
    onChange([...labels, { id: crypto.randomUUID(), text: newLabel, color }]);
    setNewLabel("");
  };

  const removeLabel = (id: string) => {
    onChange(labels.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {labels.map((label) => (
          <Badge key={label.id} variant="secondary" className="gap-1">
            {label.text}
            <button onClick={() => removeLabel(label.id)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add label..."
          onKeyDown={(e) => e.key === "Enter" && addLabel()}
          data-testid="label-input"
        />
        <Button size="sm" onClick={addLabel} data-testid="add-label">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CheckboxEditor({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={value || false}
        onCheckedChange={(checked) => onChange(checked as boolean)}
        data-testid="checkbox-editor"
      />
      <span className="text-sm text-muted-foreground">{value ? "Completed" : "Not completed"}</span>
    </div>
  );
}

function TextEditor({ value, options, onChange }: { value: string; options?: Record<string, unknown>; onChange: (v: string) => void }) {
  const maxLength = (options?.maxLength as number) || 255;
  return (
    <Input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      data-testid="text-editor"
    />
  );
}

function LongTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="resize-none"
      data-testid="long-text-editor"
    />
  );
}

function ChecklistEditor({ value, onChange }: { value: ChecklistValue; onChange: (v: ChecklistValue) => void }) {
  const [newItem, setNewItem] = useState("");
  const items = value || [];

  const addItem = () => {
    if (!newItem.trim()) return;
    onChange([...items, { id: crypto.randomUUID(), text: newItem, completed: false }]);
    setNewItem("");
  };

  const toggleItem = (id: string) => {
    onChange(items.map((item) => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <Checkbox
            checked={item.completed}
            onCheckedChange={() => toggleItem(item.id)}
          />
          <span className={item.completed ? "line-through text-muted-foreground" : ""}>
            {item.text}
          </span>
          <button onClick={() => removeItem(item.id)} className="ml-auto text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add item..."
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          data-testid="checklist-input"
        />
        <Button size="sm" onClick={addItem} data-testid="add-checklist-item">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function LinksEditor({ value, onChange }: { value: LinkValue; onChange: (v: LinkValue) => void }) {
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const links = value || [];

  const addLink = () => {
    if (!newUrl.trim()) return;
    try {
      new URL(newUrl);
      onChange([...links, { url: newUrl, title: newTitle || undefined }]);
      setNewUrl("");
      setNewTitle("");
    } catch {
      // Invalid URL
    }
  };

  const removeLink = (idx: number) => {
    onChange(links.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {links.map((link, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex-1 truncate">
            {link.title || link.url}
          </a>
          <button onClick={() => removeLink(idx)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="space-y-1">
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://..."
          data-testid="link-url-input"
        />
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title (optional)"
            data-testid="link-title-input"
          />
          <Button size="sm" onClick={addLink} data-testid="add-link">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttachmentsEditor({ value, onChange }: { value: { name: string; url: string }[]; onChange: (v: { name: string; url: string }[]) => void }) {
  const attachments = value || [];

  const removeAttachment = (idx: number) => {
    onChange(attachments.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {attachments.map((file, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
          <span className="flex-1 truncate">{file.name}</span>
          <button onClick={() => removeAttachment(idx)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button variant="outline" className="w-full" data-testid="upload-attachment">
        <Plus className="h-4 w-4 mr-2" />
        Upload File
      </Button>
      <p className="text-xs text-muted-foreground">File upload coming soon</p>
    </div>
  );
}

function NumberEditor({ value, options, onChange }: { value: number; options?: Record<string, unknown>; onChange: (v: number) => void }) {
  const format = options?.format as string || "integer";

  return (
    <Input
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const val = format === "integer" ? parseInt(e.target.value) : parseFloat(e.target.value);
        onChange(isNaN(val) ? 0 : val);
      }}
      step={format === "integer" ? 1 : 0.01}
      data-testid="number-editor"
    />
  );
}

function StatusEditor({ value, options, onChange }: { value: string; options?: Record<string, unknown>; onChange: (v: string) => void }) {
  const statusOptions = (options?.options as string[]) || ["To Do", "In Progress", "Done"];

  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger data-testid="status-select">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((opt) => (
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PersonEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter name..."
      data-testid="person-editor"
    />
  );
}

function ReferenceEditor({ value, onChange }: { value: ReferenceValue; onChange: (v: ReferenceValue) => void }) {
  const refs = value || [];

  return (
    <div className="space-y-2">
      {refs.map((ref) => (
        <div key={ref.itemId} className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm">{ref.title}</span>
          <button 
            onClick={() => onChange(refs.filter(r => r.itemId !== ref.itemId))} 
            className="ml-auto text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" data-testid="add-reference">
        <Plus className="h-4 w-4 mr-2" />
        Link Item
      </Button>
    </div>
  );
}

function MembersEditor({ value, onChange }: { value: MembersValue; onChange: (v: MembersValue) => void }) {
  const [newMember, setNewMember] = useState("");
  const members = value || [];

  const addMember = () => {
    if (!newMember.trim()) return;
    onChange([...members, { id: crypto.randomUUID(), name: newMember }]);
    setNewMember("");
  };

  const removeMember = (id: string) => {
    onChange(members.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-1 bg-muted rounded-full px-2 py-1">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs">{member.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{member.name}</span>
            <button onClick={() => removeMember(member.id)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newMember}
          onChange={(e) => setNewMember(e.target.value)}
          placeholder="Add member..."
          onKeyDown={(e) => e.key === "Enter" && addMember()}
          data-testid="member-input"
        />
        <Button size="sm" onClick={addMember} data-testid="add-member">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function VoteEditor({ value, onChange }: { value: VoteValue; onChange: (v: VoteValue) => void }) {
  const voteData = value || { count: 0, voters: [] };

  const handleVote = () => {
    onChange({
      count: voteData.count + 1,
      voters: [...voteData.voters, "current-user"],
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button 
        variant="outline" 
        size="sm" 
        className="gap-2"
        onClick={handleVote}
        data-testid="vote-button"
      >
        <ThumbsUp className="h-4 w-4" />
        Upvote
      </Button>
      <span className="text-lg font-semibold">{voteData.count}</span>
    </div>
  );
}

function ProgressEditor({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const progress = value || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Slider
          value={[progress]}
          onValueChange={([v]) => onChange(v)}
          max={100}
          step={5}
          className="flex-1"
          data-testid="progress-slider"
        />
        <span className="text-sm font-medium w-12 text-right">{progress}%</span>
      </div>
    </div>
  );
}

function RatingEditor({ value, options, onChange }: { value: number; options?: Record<string, unknown>; onChange: (v: number) => void }) {
  const max = (options?.max as number) || 5;
  const rating = value || 0;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, idx) => (
        <button
          key={idx}
          onClick={() => onChange(idx + 1)}
          className="focus:outline-none"
          data-testid={`rating-star-${idx}`}
        >
          <Star
            className={`h-6 w-6 transition-colors ${idx < rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground hover:text-yellow-400"}`}
          />
        </button>
      ))}
    </div>
  );
}

function EmailEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      type="email"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="email@example.com"
      data-testid="email-editor"
    />
  );
}

function PhoneEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      type="tel"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="+1 (555) 000-0000"
      data-testid="phone-editor"
    />
  );
}

function FormulaEditor({ value }: { value: number | string }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-mono py-2 px-3 bg-muted rounded">
        {value ?? "—"}
      </div>
      <p className="text-xs text-muted-foreground">
        Formula results are calculated automatically
      </p>
    </div>
  );
}

function TimestampEditor({ value }: { value: string }) {
  const date = value ? new Date(value) : null;
  return (
    <div className="text-sm text-muted-foreground py-2">
      {date ? date.toLocaleString() : "Auto-generated"}
    </div>
  );
}

function CreatedByEditor({ value }: { value: { id: string; name: string } | null }) {
  if (!value) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        —
        <p className="text-xs mt-1">Auto-assigned on creation</p>
      </div>
    );
  }
  
  const initials = value.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
        {initials}
      </div>
      <span className="text-sm">{value.name}</span>
    </div>
  );
}

function ButtonEditor({ options }: { options?: Record<string, unknown> }) {
  const label = (options?.label as string) || "Click";
  const action = (options?.action as string) || "none";
  
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (action !== "none") {
            console.log("Button action triggered:", action);
          }
        }}
        data-testid="button-attribute-trigger"
      >
        {label}
      </Button>
      <p className="text-xs text-muted-foreground">
        Action: {action === "none" ? "Not configured" : action}
      </p>
    </div>
  );
}

function CustomIdEditor({ value, onChange, options }: { value: string; onChange: (v: string) => void; options?: Record<string, unknown> }) {
  const prefix = (options?.prefix as string) || "";
  const autoIncrement = options?.autoIncrement !== false;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {prefix && <span className="text-sm text-muted-foreground font-mono">{prefix}-</span>}
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={autoIncrement ? "Auto-generated" : "Enter ID"}
          className="font-mono"
          disabled={autoIncrement && !!value}
          data-testid="custom-id-input"
        />
      </div>
      {autoIncrement && (
        <p className="text-xs text-muted-foreground">ID will be auto-generated</p>
      )}
    </div>
  );
}
