import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bug, Lightbulb, Wrench, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: string;
}

const feedbackTypes = [
  { value: "bug", label: "Report a Bug", icon: Bug, color: "text-red-500" },
  { value: "feature", label: "Request a Feature", icon: Lightbulb, color: "text-amber-500" },
  { value: "improvement", label: "Suggest Improvement", icon: Wrench, color: "text-blue-500" },
  { value: "general", label: "General Feedback", icon: MessageSquare, color: "text-green-500" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function FeedbackDialog({ open, onOpenChange, initialType = "" }: FeedbackDialogProps) {
  const { toast } = useToast();
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (open && initialType) {
      setType(initialType);
    }
  }, [open, initialType]);

  useEffect(() => {
    if (!open) {
      setType("");
      setTitle("");
      setDescription("");
      setPriority("medium");
    }
  }, [open]);

  const resetForm = () => {
    setType("");
    setTitle("");
    setDescription("");
    setPriority("medium");
  };

  const submitMutation = useMutation({
    mutationFn: async (data: { type: string; title: string; description: string; priority: string; pageUrl: string; userAgent: string }) => {
      return apiRequest("POST", "/api/feedback", data);
    },
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback! We'll review it shortly.",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !title || !description) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate({
      type,
      title,
      description,
      priority,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    });
  };

  const selectedType = feedbackTypes.find(t => t.value === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="feedback-dialog">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by sharing your thoughts, reporting issues, or suggesting new features.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!type ? (
            <div className="grid grid-cols-2 gap-3">
              {feedbackTypes.map((feedbackType) => (
                <Button
                  key={feedbackType.value}
                  type="button"
                  variant="outline"
                  className="h-auto flex-col gap-2 p-4"
                  onClick={() => setType(feedbackType.value)}
                  data-testid={`feedback-type-${feedbackType.value}`}
                >
                  <feedbackType.icon className={cn("h-6 w-6", feedbackType.color)} />
                  <span className="text-sm">{feedbackType.label}</span>
                </Button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                {selectedType && (
                  <>
                    <selectedType.icon className={cn("h-5 w-5", selectedType.color)} />
                    <span className="text-sm font-medium">{selectedType.label}</span>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={() => setType("")}
                >
                  Change
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder={type === "bug" ? "Brief description of the issue" : "What would you like to share?"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="feedback-title-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder={
                    type === "bug"
                      ? "Steps to reproduce, expected behavior, actual behavior..."
                      : "Please provide details..."
                  }
                  className="min-h-[120px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="feedback-description-input"
                />
              </div>

              {(type === "bug" || type === "feature") && (
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger data-testid="feedback-priority-select">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="feedback-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  data-testid="feedback-submit-button"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
