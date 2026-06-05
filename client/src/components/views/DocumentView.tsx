import { useState } from "react";
import { type Column, type Item } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Plus, 
  Search, 
  Clock,
  ChevronRight,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Image
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentViewProps {
  columns: Column[];
  items: Item[];
  onItemClick?: (item: Item) => void;
  onCreateDocument?: () => void;
  onSaveDocument?: (item: Item, content: string) => void;
}

export function DocumentView({ columns: columnsData, items, onItemClick, onCreateDocument, onSaveDocument }: DocumentViewProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [documentContent, setDocumentContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const titleColumn = columnsData.find(col => col.key === "title" || col.type === "text");

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const values = item.values as Record<string, any>;
    const title = titleColumn ? values[titleColumn.key] : "";
    return title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelectDocument = (item: Item) => {
    setSelectedItem(item);
    const values = item.values as Record<string, any>;
    setDocumentContent(values.content || values.description || "");
    onItemClick?.(item);
  };

  const handleSave = () => {
    if (selectedItem && onSaveDocument) {
      onSaveDocument(selectedItem, documentContent);
    }
  };

  return (
    <div className="flex gap-4 h-[600px]">
      <Card className="w-[300px] flex-shrink-0 rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-lg bg-muted/50 border-transparent"
              data-testid="doc-search"
            />
          </div>
        </div>
        
        <div className="p-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 rounded-lg border-dashed"
            onClick={onCreateDocument}
            data-testid="create-document-btn"
          >
            <Plus className="h-4 w-4" />
            New Document
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No documents found
            </div>
          ) : (
            filteredItems.map(item => {
              const values = item.values as Record<string, any>;
              const title = titleColumn ? values[titleColumn.key] : `Document ${item.id}`;
              const isSelected = selectedItem?.id === item.id;
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                    isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  )}
                  onClick={() => handleSelectDocument(item)}
                  data-testid={`doc-item-${item.id}`}
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="flex-1 rounded-2xl border-border/50 shadow-sm overflow-hidden flex flex-col">
        {selectedItem ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {titleColumn ? (selectedItem.values as any)[titleColumn.key] : `Document ${selectedItem.id}`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Last edited {new Date(selectedItem.updatedAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-md">Draft</Badge>
                <Button size="sm" onClick={handleSave} data-testid="save-document-btn">
                  Save
                </Button>
              </div>
            </div>

            <div className="p-2 border-b bg-muted/30 flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Bold className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Italic className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Underline className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <List className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ListOrdered className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Link className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Image className="h-4 w-4" />
              </Button>
            </div>

            <CardContent className="flex-1 p-4">
              <Textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                placeholder="Start writing your document..."
                className="h-full resize-none border-0 focus-visible:ring-0 text-base leading-relaxed"
                data-testid="document-editor"
              />
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Select a document to view or edit</p>
              <p className="text-sm mt-1">Or create a new one from the sidebar</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
