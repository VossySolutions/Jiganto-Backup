import { useState } from "react";
import { LayoutTemplate, Sparkles, Search, Building2, User, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  scope: 'jiganto' | 'marketplace' | 'company' | 'user';
  columns: { title: string; key: string; type: string; options?: Record<string, unknown> }[];
  sampleItems?: Record<string, unknown>[];
  author?: string;
}

const defaultTemplates: BoardTemplate[] = [
  {
    id: 'project-tracking',
    name: 'Project Tracker',
    description: 'Track project tasks with status, priority, and due dates',
    category: 'Project Management',
    scope: 'jiganto',
    columns: [
      { title: 'Task Name', key: 'name', type: 'text' },
      { title: 'Status', key: 'status', type: 'status', options: { values: ['To Do', 'In Progress', 'Done'] } },
      { title: 'Priority', key: 'priority', type: 'labels', options: { colors: ['red', 'yellow', 'green'] } },
      { title: 'Due Date', key: 'due_date', type: 'date' },
      { title: 'Assignee', key: 'assignee', type: 'person' },
    ]
  },
  {
    id: 'crm-pipeline',
    name: 'Sales Pipeline',
    description: 'Manage leads and opportunities through your sales funnel',
    category: 'CRM',
    scope: 'jiganto',
    columns: [
      { title: 'Company', key: 'company', type: 'text' },
      { title: 'Contact', key: 'contact', type: 'text' },
      { title: 'Email', key: 'email', type: 'email' },
      { title: 'Phone', key: 'phone', type: 'phone' },
      { title: 'Deal Value', key: 'value', type: 'number', options: { format: 'currency' } },
      { title: 'Stage', key: 'stage', type: 'status', options: { values: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed'] } },
    ]
  },
  {
    id: 'sprint-board',
    name: 'Sprint Board',
    description: 'Agile sprint planning and tracking',
    category: 'Agile',
    scope: 'jiganto',
    columns: [
      { title: 'User Story', key: 'story', type: 'text' },
      { title: 'Story Points', key: 'points', type: 'number' },
      { title: 'Sprint', key: 'sprint', type: 'text' },
      { title: 'Status', key: 'status', type: 'status', options: { values: ['Backlog', 'Sprint', 'In Progress', 'Review', 'Done'] } },
      { title: 'Owner', key: 'owner', type: 'person' },
    ]
  },
  {
    id: 'bug-tracker',
    name: 'Bug Tracker',
    description: 'Track and manage software bugs and issues',
    category: 'Development',
    scope: 'jiganto',
    columns: [
      { title: 'Bug Title', key: 'title', type: 'text' },
      { title: 'Description', key: 'description', type: 'long_text' },
      { title: 'Severity', key: 'severity', type: 'labels', options: { colors: ['red', 'orange', 'yellow', 'green'] } },
      { title: 'Status', key: 'status', type: 'status', options: { values: ['New', 'Investigating', 'In Progress', 'Fixed', 'Closed'] } },
      { title: 'Reporter', key: 'reporter', type: 'person' },
      { title: 'Assignee', key: 'assignee', type: 'person' },
    ]
  },
  {
    id: 'content-calendar',
    name: 'Content Calendar',
    description: 'Plan and schedule content across channels',
    category: 'Marketing',
    scope: 'jiganto',
    columns: [
      { title: 'Content Title', key: 'title', type: 'text' },
      { title: 'Channel', key: 'channel', type: 'labels' },
      { title: 'Publish Date', key: 'publish_date', type: 'date' },
      { title: 'Status', key: 'status', type: 'status', options: { values: ['Idea', 'Draft', 'Review', 'Scheduled', 'Published'] } },
      { title: 'Author', key: 'author', type: 'person' },
    ]
  },
  {
    id: 'resource-allocation',
    name: 'Resource Allocation',
    description: 'Track team capacity and project assignments',
    category: 'Resource Management',
    scope: 'jiganto',
    columns: [
      { title: 'Resource', key: 'resource', type: 'person' },
      { title: 'Project', key: 'project', type: 'reference' },
      { title: 'Allocation %', key: 'allocation', type: 'progress' },
      { title: 'Start Date', key: 'start', type: 'date' },
      { title: 'End Date', key: 'end', type: 'date' },
    ]
  },
];

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: BoardTemplate) => void;
  onAskAI?: () => void;
}

export function TemplateSelector({ open, onOpenChange, onSelectTemplate, onAskAI }: TemplateSelectorProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  const filteredTemplates = defaultTemplates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                         t.description.toLowerCase().includes(search.toLowerCase()) ||
                         t.category.toLowerCase().includes(search.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    return matchesSearch && t.scope === activeTab;
  });

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'jiganto': return <Globe className="h-3 w-3" />;
      case 'marketplace': return <LayoutTemplate className="h-3 w-3" />;
      case 'company': return <Building2 className="h-3 w-3" />;
      case 'user': return <User className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            Choose a Template
          </DialogTitle>
          <DialogDescription>
            Start with a pre-built template or ask the AI assistant to create one for you
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search templates..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="template-search"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={onAskAI}
            className="gap-2"
            data-testid="ask-ai-template"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Ask AI to Build
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Templates</TabsTrigger>
            <TabsTrigger value="jiganto">Jiganto</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="user">My Templates</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 overflow-auto mt-4">
            <div className="grid grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  className={cn(
                    "border rounded-xl p-4 cursor-pointer transition-all hover-elevate",
                    "hover:border-primary/50 hover:shadow-md"
                  )}
                  data-testid={`template-${template.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{template.name}</h4>
                    <Badge variant="secondary" className="text-xs gap-1">
                      {getScopeIcon(template.scope)}
                      {template.scope}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{template.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {template.columns.length} columns
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredTemplates.length === 0 && (
                <div className="col-span-2 text-center py-12 text-muted-foreground">
                  <LayoutTemplate className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No templates found matching your search</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export { defaultTemplates };
