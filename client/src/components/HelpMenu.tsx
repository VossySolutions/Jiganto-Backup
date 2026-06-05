import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquarePlus, Bug, Lightbulb, Wrench, MessageSquare, BookOpen, ExternalLink } from "lucide-react";
import { FeedbackDialog } from "./FeedbackDialog";

export function HelpMenu() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("");

  const openFeedbackWithType = (type: string) => {
    setFeedbackType(type);
    setDialogOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" data-testid="help-menu-button">
            <MessageSquarePlus className="h-5 w-5 text-[#1E88C8]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" data-testid="help-menu-content">
          <DropdownMenuItem
            onClick={() => openFeedbackWithType("bug")}
            className="gap-2"
            data-testid="help-menu-report-bug"
          >
            <Bug className="h-4 w-4 text-red-500" />
            Report a Bug
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openFeedbackWithType("feature")}
            className="gap-2"
            data-testid="help-menu-request-feature"
          >
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Request a Feature
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openFeedbackWithType("improvement")}
            className="gap-2"
            data-testid="help-menu-suggest-improvement"
          >
            <Wrench className="h-4 w-4 text-blue-500" />
            Suggest Improvement
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openFeedbackWithType("general")}
            className="gap-2"
            data-testid="help-menu-general-feedback"
          >
            <MessageSquare className="h-4 w-4 text-green-500" />
            General Feedback
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" data-testid="help-menu-documentation">
            <BookOpen className="h-4 w-4" />
            Documentation
            <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        initialType={feedbackType}
      />
    </>
  );
}
