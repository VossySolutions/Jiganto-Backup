import { useEffect, useRef } from "react";
import { useCommandPalette, type ActionCategory } from "@/hooks/use-command-palette";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, MessageSquare, FileText, Briefcase, FolderKanban,
  CheckSquare, TrendingUp, Plus, FilePlus, Building2, UserPlus, Search, Command, Settings, Star,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, MessageSquare, FileText, Briefcase, FolderKanban,
  CheckSquare, TrendingUp, Plus, FilePlus, Building2, UserPlus, Search, Command, Settings, Star,
};

const categoryLabels: Record<ActionCategory, string> = {
  navigation: "Navigate to",
  create: "Create new",
  search: "Search",
  settings: "Settings",
  module: "Modules",
};

const categoryOrder: ActionCategory[] = ["create", "navigation", "search", "module", "settings"];

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const kbdStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "1px 5px", borderRadius: 4, fontSize: 10, fontFamily: "monospace",
  background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
  color: "hsl(var(--foreground))",
  fontWeight: 600, lineHeight: 1.5, whiteSpace: "nowrap",
};

function ShortcutDisplay({ hotkey }: { hotkey: string }) {
  // Sequence shortcuts (g d, n o) are platform-neutral
  const isSequence = /^[a-z] [a-z]$/.test(hotkey);
  if (isSequence) {
    const [prefix, key] = hotkey.split(" ");
    return (
      <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
        <kbd style={kbdStyle}>{prefix.toUpperCase()}</kbd>
        <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>→</span>
        <kbd style={kbdStyle}>{key.toUpperCase()}</kbd>
      </div>
    );
  }
  // Ctrl shortcuts — show Win and Mac side by side
  if (hotkey.startsWith("ctrl+")) {
    const rest = hotkey.replace("ctrl+", "").replace("/", "/");
    const winLabel = `Ctrl+${rest.toUpperCase()}`;
    const macLabel = `⌘${rest.toUpperCase()}`;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>Win</span>
          <kbd style={kbdStyle}>{winLabel}</kbd>
        </div>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>Mac</span>
          <kbd style={kbdStyle}>{macLabel}</kbd>
        </div>
      </div>
    );
  }
  return null;
}

export function CommandPalette() {
  const {
    isOpen, closePalette, searchQuery, setSearchQuery,
    filteredActions, executeAction, togglePin,
  } = useCommandPalette();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndexRef = useRef(0);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    selectedIndexRef.current = 0;
  }, [isOpen]);

  const groupedActions = categoryOrder
    .map(category => ({
      category,
      label: categoryLabels[category],
      actions: filteredActions.filter(a => a.category === category),
    }))
    .filter(group => group.actions.length > 0);

  const flatActions = groupedActions.flatMap(g => g.actions);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndexRef.current = Math.min(selectedIndexRef.current + 1, flatActions.length - 1);
      updateSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndexRef.current = Math.max(selectedIndexRef.current - 1, 0);
      updateSelection();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const action = flatActions[selectedIndexRef.current];
      if (action) executeAction(action.id);
    }
  };

  const updateSelection = () => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll("[data-action-item]");
      items.forEach((item, idx) => {
        if (idx === selectedIndexRef.current) {
          item.classList.add("bg-accent");
          item.scrollIntoView({ block: "nearest" });
        } else {
          item.classList.remove("bg-accent");
        }
      });
    }
  };

  useEffect(() => {
    selectedIndexRef.current = 0;
    setTimeout(updateSelection, 10);
  }, [searchQuery, filteredActions.length]);

  const ctrlK = isMac ? "⌘K" : "Ctrl+K";
  const categoryIcons: Record<ActionCategory, React.ReactNode> = {
    navigation: <LayoutDashboard style={{ width: 10, height: 10 }} />,
    create: <Plus style={{ width: 10, height: 10 }} />,
    search: <Search style={{ width: 10, height: 10 }} />,
    settings: <Settings style={{ width: 10, height: 10 }} />,
    module: <Command style={{ width: 10, height: 10 }} />,
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closePalette()}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden" data-testid="command-palette-dialog">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Search and execute commands. Use arrow keys to navigate, Enter to select.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex items-center border-b px-3 gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="h-12 border-0 focus-visible:ring-0 px-0"
            data-testid="command-palette-search"
          />
          <kbd style={{ ...kbdStyle, padding: "3px 8px", fontSize: 11 }}>{ctrlK}</kbd>
        </div>

        {/* Shortcut tip banner */}
        {!searchQuery && (
          <div style={{
            display: "flex", gap: 16, padding: "7px 14px",
            background: "hsl(var(--muted))", borderBottom: "1px solid hsl(var(--border))",
            fontSize: 11, color: "hsl(var(--muted-foreground))", alignItems: "center", flexWrap: "wrap",
          }}>
            <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>Shortcuts:</span>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <kbd style={kbdStyle}>G</kbd>
              <span style={{ color: "hsl(var(--muted-foreground))" }}>→</span>
              <kbd style={kbdStyle}>key</kbd>
              Navigate
            </span>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <kbd style={kbdStyle}>N</kbd>
              <span style={{ color: "hsl(var(--muted-foreground))" }}>→</span>
              <kbd style={kbdStyle}>key</kbd>
              Create new
            </span>
            <span style={{ color: "hsl(var(--border))" }}>|</span>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <kbd style={kbdStyle}>↑↓</kbd> navigate
              <kbd style={kbdStyle}>↵</kbd> select
              <kbd style={kbdStyle}>Esc</kbd> close
            </span>
          </div>
        )}

        {/* Action list */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-2" data-testid="command-palette-list">
          {groupedActions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No commands found for &quot;{searchQuery}&quot;
            </div>
          ) : (
            groupedActions.map((group) => (
              <div key={group.category}>
                <div style={{
                  padding: "4px 14px 5px", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: ".09em", color: "hsl(var(--muted-foreground))",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {categoryIcons[group.category]}
                  {group.label}
                </div>
                {group.actions.map((action) => {
                  const Icon = action.icon ? iconMap[action.icon] : Command;
                  const globalIdx = flatActions.indexOf(action);
                  return (
                    <button
                      key={action.id}
                      data-action-item
                      data-testid={`command-action-${action.id}`}
                      onClick={() => executeAction(action.id)}
                      onMouseEnter={() => {
                        selectedIndexRef.current = globalIdx;
                        updateSelection();
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        globalIdx === 0 && "bg-accent"
                      )}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: action.category === "create"
                          ? "hsl(var(--status-green))"
                          : "hsl(var(--muted))",
                        border: "1px solid hsl(var(--border))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon style={{
                          width: 15, height: 15,
                          color: action.category === "create"
                            ? "hsl(var(--status-green-foreground))"
                            : "hsl(var(--muted-foreground))",
                        }} />
                      </div>

                      {/* Label + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{action.name}</span>
                          {action.pinned && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                      </div>

                      {/* Shortcut (two-column Win/Mac where applicable) */}
                      {action.hotkey && (
                        <ShortcutDisplay hotkey={action.hotkey} />
                      )}

                      {/* Pin toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePin(action.id); }}
                        title={action.pinned ? "Unpin from Quick Actions" : "Pin to Quick Actions"}
                        style={{
                          width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                          background: action.pinned ? "hsl(var(--status-amber))" : "transparent",
                          border: `1px solid ${
                            action.pinned ? "hsl(var(--status-amber-foreground))" : "hsl(var(--border))"
                          }`,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Star style={{
                          width: 10, height: 10,
                          color: action.pinned
                            ? "hsl(var(--status-amber-foreground))"
                            : "hsl(var(--muted-foreground))",
                          fill: action.pinned ? "hsl(var(--status-amber-foreground))" : "none",
                        }} />
                      </button>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer: platform-specific reference */}
        <div style={{
          borderTop: "1px solid hsl(var(--border))", padding: "8px 14px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
            <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <kbd style={kbdStyle}>↑↓</kbd> navigate
            </span>
            <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <kbd style={kbdStyle}>↵</kbd> select
            </span>
            <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <kbd style={kbdStyle}>Esc</kbd> close
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, fontSize: 10, color: "hsl(var(--muted-foreground))", alignItems: "center" }}>
            <span>Click ★ to pin to Quick Actions</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
