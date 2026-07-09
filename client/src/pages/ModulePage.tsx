import { useRoute } from "wouter";
import { ModuleShell } from "@/components/ModuleShell";
import { BoardView } from "@/components/BoardView";
import { Button } from "@/components/ui/button";
import { useBoards, useCreateBoard, useCreateColumn } from "@/hooks/use-jiganto";
import { useTenants } from "@/hooks/use-jiganto";
import { Plus, LayoutGrid, LayoutTemplate } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { type InsertBoard } from "@shared/schema";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { TemplateSelector, type BoardTemplate } from "@/components/TemplateSelector";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";

export function ModulePage() {
  const [, params] = useRoute("/modules/:key");
  const moduleKey = params?.key;
  
  const { data: tenants } = useTenants();
  const tenantId = tenants?.[0]?.id;

  const { data: boards } = useBoards(tenantId?.toString());
  const createBoard = useCreateBoard();
  const createColumn = useCreateColumn();
  const [newBoardName, setNewBoardName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);

  useEffect(() => {
    if (!activeBoardId && boards && boards.length > 0) {
      setActiveBoardId(boards[0].id);
    }
  }, [activeBoardId, boards]);

  const activeBoard = boards?.find(b => b.id === activeBoardId);

  const handleCreateBoard = () => {
    if (!tenantId) return;
    
    const boardData: InsertBoard = {
      name: newBoardName,
      tenantId,
      type: "project"
    };
    
    createBoard.mutate(boardData, {
      onSuccess: (data) => {
        setIsDialogOpen(false);
        setActiveBoardId(data.id);
        setNewBoardName("");
      }
    });
  };

  const handleSelectTemplate = (template: BoardTemplate) => {
    if (!tenantId) return;
    
    const boardData: InsertBoard = {
      name: template.name,
      tenantId,
      type: "project"
    };
    
    createBoard.mutate(boardData, {
      onSuccess: (data) => {
        template.columns.forEach((col, index) => {
          createColumn.mutate({
            boardId: data.id,
            title: col.title,
            key: col.key,
            type: col.type,
            order: index + 1,
            options: col.options || {}
          });
        });
        setIsTemplateOpen(false);
        setActiveBoardId(data.id);
      }
    });
  };

  const moduleTitle = moduleKey 
    ? moduleKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : "Module";

  return (
    <>
    <ModuleShell className="min-h-screen bg-background">
        {moduleKey && (
          <div className="px-8 pt-4">
            <ModuleWelcomeBanner moduleKey={moduleKey} />
          </div>
        )}
        <div className="h-14 border-b flex items-center px-8 justify-between bg-card backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold font-display" data-testid="module-title">{moduleTitle}</h2>
            <div className="h-4 w-px bg-border" />
            
            <div className="flex gap-1">
              {boards?.map(board => (
                <button
                  key={board.id}
                  onClick={() => setActiveBoardId(board.id)}
                  data-testid={`board-tab-${board.id}`}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${activeBoardId === board.id 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                  `}
                >
                  {board.name}
                </button>
              ))}
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button 
                    className="px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    data-testid="create-board-trigger"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <FormDialogShell
                  open={isDialogOpen}
                  onOpenChange={setIsDialogOpen}
                  title="Create New Board"
                  subtitle="Add a new board to this module"
                  saveLabel="Create Board"
                  onCancel={() => setIsDialogOpen(false)}
                  onSubmit={handleCreateBoard}
                  saving={createBoard.isPending}
                  disabled={!newBoardName.trim()}
                  saveTestId="create-board-btn"
                  size="sm"
                >
                  <FormSection title="Board details">
                    <div className="space-y-1.5 mb-3.5">
                      <FieldLabel required>Board Name</FieldLabel>
                      <Input 
                        value={newBoardName} 
                        onChange={e => setNewBoardName(e.target.value)} 
                        placeholder="e.g. Q4 Roadmap"
                        data-testid="new-board-name"
                      />
                    </div>
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => { setIsDialogOpen(false); setIsTemplateOpen(true); }}
                      data-testid="use-template-btn"
                    >
                      <LayoutTemplate className="h-4 w-4 mr-2" />
                      Use Template
                    </Button>
                  </FormSection>
                </FormDialogShell>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="p-8">
          {activeBoardId ? (
            <BoardView boardId={activeBoardId} boardName={activeBoard?.name || "Board"} />
          ) : (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
              <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mb-2">
                <LayoutGrid className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">No Boards Yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Create a board to start tracking items, projects, and data for this module.
              </p>
              <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl mt-4" data-testid="create-first-board">
                Create First Board
              </Button>
            </div>
          )}
        </div>
    </ModuleShell>
      <TemplateSelector 
        open={isTemplateOpen}
        onOpenChange={setIsTemplateOpen}
        onSelectTemplate={handleSelectTemplate}
        onAskAI={() => { setIsTemplateOpen(false); }}
      />
    </>
  );
}
