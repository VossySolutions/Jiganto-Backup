import { useState } from "react";
import { type Column } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AttributeEditor } from "@/components/attributes";

interface FormViewProps {
  columns: Column[];
  boardName: string;
  onSubmit?: (values: Record<string, unknown>) => void;
  isSubmitting?: boolean;
}

export function FormView({ columns, boardName, onSubmit, isSubmitting }: FormViewProps) {
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [showShareOptions, setShowShareOptions] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formValues);
    setFormValues({});
  };

  const handleChange = (key: string, value: unknown) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied",
      description: "Form link copied to clipboard",
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{boardName}</CardTitle>
              <CardDescription>Fill out this form to submit a new entry</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setShowShareOptions(!showShareOptions)}
              data-testid="share-form-btn"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </CardHeader>

        {showShareOptions && (
          <div className="p-4 bg-muted/20 border-b flex items-center gap-3">
            <Input 
              value={window.location.href} 
              readOnly 
              className="flex-1 bg-background"
            />
            <Button variant="outline" size="icon" onClick={handleCopyLink} data-testid="copy-link-btn">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" data-testid="open-form-btn">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        )}

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {columns.map((col) => (
              <div key={col.id} className="space-y-2">
                <Label htmlFor={col.key} className="text-sm font-medium">
                  {col.title}
                </Label>
                <AttributeEditor
                  type={col.type}
                  value={formValues[col.key]}
                  options={col.options as Record<string, unknown>}
                  onChange={(value) => handleChange(col.key, value)}
                />
              </div>
            ))}

            {columns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No fields defined yet.</p>
                <p className="text-sm">Add custom attributes to this board to create form fields.</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full rounded-xl shadow-lg shadow-primary/20"
              disabled={isSubmitting || columns.length === 0}
              data-testid="form-submit-btn"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
