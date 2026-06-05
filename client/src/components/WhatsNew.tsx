import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Sparkles, CheckSquare, FileText, Briefcase, MessageSquare, 
  Users, ArrowRight, Rocket, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const WHATS_NEW_VERSION = "2026.01.31";
const STORAGE_KEY = "jiganto-whats-new-seen";

interface Feature {
  id: string;
  title: string;
  description: string;
  benefit: string;
  icon: React.ElementType;
  link: string;
  linkText: string;
  isNew: boolean;
  date: string;
}

const features: Feature[] = [
  {
    id: "task-management",
    title: "Task Management",
    description: "Comprehensive task tracking with List and Kanban views. Create, organize, and track tasks with priorities, due dates, and multiple source types.",
    benefit: "Boost productivity by centralizing all your tasks in one place with powerful filtering and multiple view options.",
    icon: CheckSquare,
    link: "/modules/tasks",
    linkText: "Open Tasks",
    isNew: true,
    date: "January 31, 2026",
  },
  {
    id: "document-management",
    title: "Document Management",
    description: "Notion-inspired document management with hierarchical folder structure, rich text editing, and version control.",
    benefit: "Keep all your documents organized and accessible with a familiar, intuitive interface.",
    icon: FileText,
    link: "/modules/documents",
    linkText: "Open Documents",
    isNew: false,
    date: "January 30, 2026",
  },
  {
    id: "business-management",
    title: "Business Management",
    description: "Strategic planning with OKRs, initiatives, and operational oversight. Track goals and measure progress across your organization.",
    benefit: "Align your team around shared objectives and drive strategic outcomes.",
    icon: Briefcase,
    link: "/modules/business-mgmt",
    linkText: "Open Business Mgmt",
    isNew: false,
    date: "January 29, 2026",
  },
  {
    id: "crm",
    title: "CRM Module",
    description: "Full-featured customer relationship management with accounts, contacts, and opportunity pipeline tracking.",
    benefit: "Manage your sales pipeline and customer relationships more effectively.",
    icon: Users,
    link: "/modules/crm",
    linkText: "Open CRM",
    isNew: false,
    date: "January 28, 2026",
  },
  {
    id: "chat",
    title: "Team Chat",
    description: "Real-time team communication with channels, direct messages, and presence indicators.",
    benefit: "Collaborate seamlessly with your team in one unified platform.",
    icon: MessageSquare,
    link: "/modules/chat",
    linkText: "Open Chat",
    isNew: false,
    date: "January 27, 2026",
  },
];

export function WhatsNewButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);

  useEffect(() => {
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (seenVersion !== WHATS_NEW_VERSION) {
      setHasUnseen(true);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    setHasUnseen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className="relative"
        data-testid="button-whats-new"
      >
        <Sparkles className="h-4 w-4" />
        {hasUnseen && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
        )}
      </Button>
      <WhatsNewDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

export function WhatsNewDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [, navigate] = useLocation();

  const handleFeatureClick = (link: string) => {
    navigate(link);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold font-display">What's New in Jiganto</DialogTitle>
              <DialogDescription className="mt-1">
                Discover the latest features and improvements
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh]">
          <div className="p-6 space-y-4">
            {features.map((feature) => (
              <Card
                key={feature.id}
                className={cn(
                  "hover-elevate cursor-pointer transition-all",
                  feature.isNew && "ring-1 ring-primary/20 bg-primary/[0.02]"
                )}
                onClick={() => handleFeatureClick(feature.link)}
                data-testid={`feature-card-${feature.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-2.5 rounded-lg shrink-0",
                      feature.isNew 
                        ? "bg-primary/10 text-primary" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{feature.title}</h3>
                        {feature.isNew && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            New
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">{feature.date}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {feature.description}
                      </p>
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-muted">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-sm">
                            <span className="font-medium">Benefit:</span> {feature.benefit}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 mt-3 text-primary hover:bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFeatureClick(feature.link);
                        }}
                        data-testid={`link-${feature.id}`}
                      >
                        {feature.linkText}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              Have feedback? We'd love to hear from you.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WhatsNewAutoPopup() {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (seenVersion !== WHATS_NEW_VERSION) {
      const timer = setTimeout(() => {
        setShowPopup(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = (open: boolean) => {
    setShowPopup(open);
    if (!open) {
      localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    }
  };

  return <WhatsNewDialog open={showPopup} onOpenChange={handleClose} />;
}
