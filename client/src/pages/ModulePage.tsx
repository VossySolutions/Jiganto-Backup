import { useRoute } from "wouter";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
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
import {
  modulePageBannerWrapClass,
  modulePageContentOuterClass,
  modulePageContentScrollClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
  modulePageTabsListClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
} from "@/components/ModulePageChrome";
import { TemplateSelector, type BoardTemplate } from "@/components/TemplateSelector";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import { cn } from "@/lib/utils";

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
    <ModuleShell className={modulePageShellClass} testId="generic-module-page" mainClassName={modulePageMainClass}>
        {moduleKey && (
          <div className={modulePageBannerWrapClass}>
            <ModuleWelcomeBanner moduleKey={moduleKey} />
          </div>
        )}
        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={LayoutGrid}
            title={moduleTitle}
            subtitle="Boards and tracking for this module"
            titleTestId="module-title"
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIsTemplateOpen(true)}
                  data-testid="use-template-btn-header"
                >
                  <LayoutTemplate className="h-4 w-4" />
                  <span className="hidden sm:inline">Template</span>
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5" data-testid="create-board-trigger">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">New Board</span>
                    </Button>
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
            }
          />
          {boards && boards.length > 0 && (
            <div className={modulePageTabsWrapClass}>
              <div className={cn(modulePageTabsListClass, "pb-1")}>
                {boards.map(board => (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => setActiveBoardId(board.id)}
                    data-testid={`board-tab-${board.id}`}
                    className={cn(
                      modulePageTabTriggerClass,
                      "inline-flex items-center py-1.5 font-medium transition-colors",
                      activeBoardId === board.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {board.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={modulePageContentOuterClass}>
          <div className={cn(modulePageContentScrollClass, "p-3 sm:p-4 md:p-6")}>
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
        </div>
    </ModuleShell>
      <TemplateSelector
        open={isTemplateOpen}
        onOpenChange={setIsTemplateOpen}
        onSelectTemplate={handleSelectTemplate}
      />
    </>
  );
}
