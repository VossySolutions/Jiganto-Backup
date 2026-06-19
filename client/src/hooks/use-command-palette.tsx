import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { useToast } from "@/hooks/use-toast";
import { isTypingInEditableField } from "@/lib/utils";
import { useReadOnly } from "@/hooks/use-read-only";
import { useClientContext } from "@/hooks/use-client-context";
import { isCommandActionAllowedInWorkspace, NAV_ACTION_PATHS } from "@/lib/workspace-nav-filter";

export type ActionCategory = "navigation" | "create" | "search" | "settings" | "module";

export interface QuickAction {
  id: string;
  name: string;
  description: string;
  category: ActionCategory;
  icon?: string;
  hotkey?: string;
  hotkeyLabel?: string;
  action: () => void;
  enabled: boolean;
  pinned: boolean;
}

interface CommandPaletteContextType {
  isOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  actions: QuickAction[];
  pinnedActions: QuickAction[];
  enabledActions: QuickAction[];
  togglePin: (id: string) => void;
  toggleEnabled: (id: string) => void;
  setCustomHotkey: (id: string, hotkey: string) => void;
  executeAction: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredActions: QuickAction[];
}

const CommandPaletteContext = createContext<CommandPaletteContextType | null>(null);

const STORAGE_KEY = "jiganto-quick-actions";

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const readOnly = useReadOnly();
  const { activeClient } = useClientContext();
  const inClientWorkspace = !!activeClient;

  const createDefaultActions = useCallback((): QuickAction[] => [
    // ── Navigation (G then X) ───────────────────────────────────────────────
    {
      id: "nav-dashboard",
      name: "Go to Dashboard",
      description: "Return to main dashboard",
      category: "navigation",
      icon: "LayoutDashboard",
      hotkey: "g d",
      hotkeyLabel: "G → D",
      action: () => navigate(DASHBOARD_PATH),
      enabled: true,
      pinned: true,
    },
    {
      id: "nav-crm",
      name: "Open CRM",
      description: "Customer relationship management",
      category: "navigation",
      icon: "Users",
      hotkey: "g c",
      hotkeyLabel: "G → C",
      action: () => navigate("/modules/crm"),
      enabled: true,
      pinned: true,
    },
    {
      id: "nav-chat",
      name: "Open Chat",
      description: "Team messaging",
      category: "navigation",
      icon: "MessageSquare",
      hotkey: "g m",
      hotkeyLabel: "G → M",
      action: () => navigate("/modules/chat"),
      enabled: true,
      pinned: true,
    },
    {
      id: "nav-documents",
      name: "Open Documents",
      description: "Document management",
      category: "navigation",
      icon: "FileText",
      hotkey: "g f",
      hotkeyLabel: "G → F",
      action: () => navigate("/modules/documents"),
      enabled: true,
      pinned: false,
    },
    {
      id: "nav-business",
      name: "Open Business Management",
      description: "Strategic planning and OKRs",
      category: "navigation",
      icon: "Briefcase",
      hotkey: "g b",
      hotkeyLabel: "G → B",
      action: () => navigate("/modules/business-mgmt"),
      enabled: true,
      pinned: false,
    },
    {
      id: "nav-projects",
      name: "Open Projects",
      description: "Project management",
      category: "navigation",
      icon: "FolderKanban",
      hotkey: "g p",
      hotkeyLabel: "G → P",
      action: () => navigate("/modules/projects"),
      enabled: true,
      pinned: false,
    },
    {
      id: "nav-tasks",
      name: "Open Tasks",
      description: "Task management",
      category: "navigation",
      icon: "CheckSquare",
      hotkey: "g t",
      hotkeyLabel: "G → T",
      action: () => navigate("/modules/tasks"),
      enabled: true,
      pinned: false,
    },
    {
      id: "nav-esign",
      name: "Open e-Sign",
      description: "Electronic sign-off and approvals",
      category: "navigation",
      icon: "FileText",
      hotkey: "g e",
      hotkeyLabel: "G → E",
      action: () => navigate("/modules/e-sign"),
      enabled: true,
      pinned: false,
    },
    {
      id: "nav-surveys",
      name: "Open Surveys",
      description: "Surveys and feedback",
      category: "navigation",
      icon: "CheckSquare",
      hotkey: "g s",
      hotkeyLabel: "G → S",
      action: () => navigate("/modules/surveys"),
      enabled: true,
      pinned: false,
    },
    // ── Create (N then X) ─────────────────────────────────────────────────
    {
      id: "create-opportunity",
      name: "New Opportunity",
      description: "Create a new sales opportunity in CRM",
      category: "create",
      icon: "TrendingUp",
      hotkey: "n o",
      hotkeyLabel: "N → O",
      action: () => {
        navigate("/modules/crm");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("jiganto:create-opportunity"));
        }, 100);
      },
      enabled: true,
      pinned: true,
    },
    {
      id: "create-document",
      name: "New Document",
      description: "Create a new document",
      category: "create",
      icon: "FilePlus",
      hotkey: "n d",
      hotkeyLabel: "N → D",
      action: () => {
        navigate("/modules/documents");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("jiganto:create-document"));
        }, 100);
      },
      enabled: true,
      pinned: false,
    },
    {
      id: "create-task",
      name: "New Task",
      description: "Create a new task",
      category: "create",
      icon: "CheckSquare",
      hotkey: "n t",
      hotkeyLabel: "N → T",
      action: () => {
        navigate("/modules/tasks");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("jiganto:create-task"));
        }, 100);
      },
      enabled: true,
      pinned: true,
    },
    {
      id: "create-account",
      name: "New Account",
      description: "Create a new CRM account",
      category: "create",
      icon: "Building2",
      hotkey: "n a",
      hotkeyLabel: "N → A",
      action: () => {
        navigate("/modules/crm");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("jiganto:create-account"));
        }, 100);
      },
      enabled: true,
      pinned: false,
    },
    {
      id: "create-contact",
      name: "New Contact",
      description: "Create a new contact",
      category: "create",
      icon: "UserPlus",
      hotkey: "n c",
      hotkeyLabel: "N → C",
      action: () => {
        navigate("/modules/crm");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("jiganto:create-contact"));
        }, 100);
      },
      enabled: true,
      pinned: false,
    },
    {
      id: "create-project",
      name: "New Project",
      description: "Create a new project",
      category: "create",
      icon: "FolderKanban",
      hotkey: "n p",
      hotkeyLabel: "N → P",
      action: () => {
        navigate("/modules/projects");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("jiganto:create-project"));
        }, 100);
      },
      enabled: true,
      pinned: false,
    },
    // ── Search ────────────────────────────────────────────────────────────
    {
      id: "search-global",
      name: inClientWorkspace ? "Search workspace" : "Search Everything",
      description: inClientWorkspace
        ? "Search within the active client workspace"
        : "Search across all modules",
      category: "search",
      icon: "Search",
      hotkey: "ctrl+/",
      hotkeyLabel: "Ctrl+/ · ⌘/",
      action: () => {
        window.dispatchEvent(
          new CustomEvent("jiganto:global-search", {
            detail: { clientId: activeClient?.id ?? null },
          }),
        );
      },
      enabled: true,
      pinned: false,
    },
  ], [navigate, inClientWorkspace, activeClient?.id]);

  const [actions, setActions] = useState<QuickAction[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const defaultActions = createDefaultActions();
        return defaultActions.map(defaultAction => {
          const storedAction = parsed.find((a: { id: string }) => a.id === defaultAction.id);
          if (storedAction) {
            return {
              ...defaultAction,
              enabled: storedAction.enabled ?? defaultAction.enabled,
              pinned: storedAction.pinned ?? defaultAction.pinned,
              hotkey: storedAction.hotkey ?? defaultAction.hotkey,
              hotkeyLabel: storedAction.hotkeyLabel ?? defaultAction.hotkeyLabel,
            };
          }
          return defaultAction;
        });
      }
    } catch {}
    return createDefaultActions();
  });

  useEffect(() => {
    setActions((prev) => {
      const defaults = createDefaultActions();
      return defaults.map((d) => {
        const stored = prev.find((p) => p.id === d.id);
        return stored ? { ...d, enabled: stored.enabled, pinned: stored.pinned, hotkey: stored.hotkey, hotkeyLabel: stored.hotkeyLabel } : d;
      });
    });
  }, [createDefaultActions]);

  useEffect(() => {
    const toStore = actions.map(a => ({
      id: a.id,
      enabled: a.enabled,
      pinned: a.pinned,
      hotkey: a.hotkey,
      hotkeyLabel: a.hotkeyLabel,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }, [actions]);

  const effectiveActions = useMemo(
    () =>
      actions.map((a) => {
        let enabled = a.enabled;
        if (readOnly && a.category === "create") enabled = false;
        if (inClientWorkspace && !isCommandActionAllowedInWorkspace(a.id, NAV_ACTION_PATHS[a.id], true)) {
          enabled = false;
        }
        return { ...a, enabled };
      }),
    [actions, readOnly, inClientWorkspace],
  );

  const pinnedActions = effectiveActions.filter((a) => a.pinned && a.enabled);
  const enabledActions = effectiveActions.filter((a) => a.enabled);

  const filteredActions = searchQuery
    ? enabledActions.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : enabledActions;

  const togglePin = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, pinned: !a.pinned } : a));
  };

  const toggleEnabled = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const setCustomHotkey = (id: string, hotkey: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, hotkey, hotkeyLabel: hotkey } : a));
  };

  const executeAction = useCallback((id: string) => {
    const action = effectiveActions.find((a) => a.id === id);
    if (action && action.enabled) {
      action.action();
      setIsOpen(false);
      setSearchQuery("");
      // Brief toast confirmation
      toast({
        description: `⚡ ${action.name}`,
        duration: 1500,
      });
    }
  }, [effectiveActions, toast]);

  const openPalette = useCallback(() => {
    setIsOpen(true);
    setSearchQuery("");
  }, []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
  }, []);

  const togglePalette = useCallback(() => {
    setIsOpen(prev => !prev);
    if (isOpen) setSearchQuery("");
  }, [isOpen]);

  // ── Global keyboard handler ─────────────────────────────────────────────
  useEffect(() => {
    // Two-key prefix state
    let prefixKey: "g" | "n" | null = null;
    let prefixTimeout: ReturnType<typeof setTimeout>;

    const clearPrefix = () => {
      prefixKey = null;
      clearTimeout(prefixTimeout);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;

      // Ctrl+K / ⌘K → command palette (works on all browsers)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        togglePalette();
        clearPrefix();
        return;
      }

      // Escape closes palette
      if (isOpen && e.key === "Escape") {
        e.preventDefault();
        closePalette();
        clearPrefix();
        return;
      }

      // Don't intercept when user is typing in an input or rich-text editor
      if (isTypingInEditableField(e.target)) {
        clearPrefix();
        return;
      }

      // ── Prefix key pressed (G or N) ──────────────────────────────────
      if ((e.key === "g" || e.key === "n") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        prefixKey = e.key as "g" | "n";
        clearTimeout(prefixTimeout);
        prefixTimeout = setTimeout(clearPrefix, 600);
        return;
      }

      // ── Second key after prefix ───────────────────────────────────────
      if (prefixKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const hotkey = `${prefixKey} ${e.key.toLowerCase()}`;
        const action = effectiveActions.find(a => a.enabled && a.hotkey === hotkey);
        if (action) {
          e.preventDefault();
          executeAction(action.id);
        }
        clearPrefix();
        return;
      }

      // ── Ctrl+/ for search ─────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        const action = effectiveActions.find(a => a.enabled && a.hotkey === "ctrl+/");
        if (action) executeAction(action.id);
        return;
      }

      clearPrefix();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(prefixTimeout);
    };
  }, [effectiveActions, isOpen, togglePalette, closePalette, executeAction]);

  return (
    <CommandPaletteContext.Provider value={{
      isOpen,
      openPalette,
      closePalette,
      togglePalette,
      actions,
      pinnedActions,
      enabledActions,
      togglePin,
      toggleEnabled,
      setCustomHotkey,
      executeAction,
      searchQuery,
      setSearchQuery,
      filteredActions,
    }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
}
