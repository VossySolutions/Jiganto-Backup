import { useCommandPalette } from "@/hooks/use-command-palette";
import { useReadOnly } from "@/hooks/use-read-only";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  FileText,
  Briefcase,
  FolderKanban,
  CheckSquare,
  TrendingUp,
  Plus,
  FilePlus,
  Building2,
  UserPlus,
  Search,
  Command,
  Settings,
  Star,
  Zap,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, MessageSquare, FileText, Briefcase, FolderKanban,
  CheckSquare, TrendingUp, Plus, FilePlus, Building2, UserPlus, Search, Command, Settings, Star,
};

// Detect OS once
const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Shortcut badge — shows both Win and Mac if they differ, otherwise just one
function ShortcutBadge({ hotkey }: { hotkey: string }) {
  // Sequence shortcuts (g d, n o, etc.) are identical on all platforms
  const isSequence = /^[a-z] [a-z]$/.test(hotkey);
  if (isSequence) {
    const [prefix, key] = hotkey.split(" ");
    return (
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        <kbd style={kbdStyle}>{prefix.toUpperCase()}</kbd>
        <span style={{ fontSize: 10, color: "#9C9890" }}>then</span>
        <kbd style={kbdStyle}>{key.toUpperCase()}</kbd>
      </div>
    );
  }
  // Ctrl shortcuts — show Win + Mac
  if (hotkey.startsWith("ctrl+")) {
    const rest = hotkey.replace("ctrl+", "").replace("shift+", "Shift+").toUpperCase();
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#9C9890" }}>Win</span>
          <kbd style={kbdStyle}>Ctrl+{rest}</kbd>
        </div>
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#9C9890" }}>Mac</span>
          <kbd style={kbdStyle}>⌘{rest}</kbd>
        </div>
      </div>
    );
  }
  return null;
}

const kbdStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "1px 5px", borderRadius: 4, fontSize: 10, fontFamily: "monospace",
  background: "#F2F0EB", border: "1px solid #DDD9D0", color: "#2E2C28",
  fontWeight: 600, lineHeight: 1.5,
};

export function QuickActionsDropdown() {
  const { actions, openPalette, executeAction } = useCommandPalette();
  const readOnly = useReadOnly();

  const navActions = actions.filter(a => a.enabled && a.category === "navigation").slice(0, 5);
  const createActions = readOnly
    ? []
    : actions.filter(a => a.enabled && a.category === "create");

  const ctrlK = isMac ? "⌘K" : "Ctrl+K";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="bg-brand-green text-white font-medium gap-1.5" data-testid="quick-actions-trigger">
          <Zap className="h-3.5 w-3.5" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" data-testid="quick-actions-menu">
        {/* Command palette promo strip */}
        <div
          onClick={openPalette}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", cursor: "pointer",
            background: "linear-gradient(135deg, #1A6B5A 0%, #0F3D31 100%)",
            borderRadius: "8px 8px 0 0",
          }}
          data-testid="open-command-palette"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search style={{ width: 14, height: 14, color: "rgba(255,255,255,.8)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Search all commands…</span>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            <kbd style={{ ...kbdStyle, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", color: "#fff" }}>
              {ctrlK}
            </kbd>
          </div>
        </div>

        {/* Navigate section */}
        <div style={{ padding: "8px 0 4px" }}>
          <div style={{
            padding: "3px 14px 6px", fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: ".09em", color: "#9C9890",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <LayoutDashboard style={{ width: 10, height: 10 }} />
            Navigate to
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#CBC7BC" }}>
              · press G then a letter
            </span>
          </div>
          {navActions.map(action => {
            const Icon = action.icon ? iconMap[action.icon] : Command;
            return (
              <DropdownMenuItem
                key={action.id}
                onClick={() => executeAction(action.id)}
                className="flex items-center justify-between cursor-pointer mx-1 rounded-md"
                data-testid={`quick-action-${action.id}`}
              >
                <div className="flex items-center gap-2.5">
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: "#F2F0EB", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">{action.name.replace("Open ", "").replace("Go to ", "")}</span>
                </div>
                {action.hotkey && <ShortcutBadge hotkey={action.hotkey} />}
              </DropdownMenuItem>
            );
          })}
        </div>

        {createActions.length > 0 && <DropdownMenuSeparator />}

        {/* Create section */}
        {createActions.length > 0 && <div style={{ padding: "4px 0 8px" }}>
          <div style={{
            padding: "3px 14px 6px", fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: ".09em", color: "#9C9890",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Plus style={{ width: 10, height: 10 }} />
            Create new
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#CBC7BC" }}>
              · press N then a letter
            </span>
          </div>
          {createActions.map(action => {
            const Icon = action.icon ? iconMap[action.icon] : Plus;
            return (
              <DropdownMenuItem
                key={action.id}
                onClick={() => executeAction(action.id)}
                className="flex items-center justify-between cursor-pointer mx-1 rounded-md"
                data-testid={`quick-action-${action.id}`}
              >
                <div className="flex items-center gap-2.5">
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: "#E4F2EE", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: "#1A6B5A" }} />
                  </div>
                  <span className="text-sm font-medium">{action.name}</span>
                </div>
                {action.hotkey && <ShortcutBadge hotkey={action.hotkey} />}
              </DropdownMenuItem>
            );
          })}
        </div>}

        <DropdownMenuSeparator />

        {/* Shortcut reference footer */}
        <div style={{ padding: "8px 14px 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#9C9890", marginBottom: 6 }}>
            Keyboard reference
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
            {[
              { label: "Command palette", win: "Ctrl+K", mac: "⌘K" },
              { label: "Navigate (Go to)", win: "G → key", mac: "G → key" },
              { label: "Create new", win: "N → key", mac: "N → key" },
              { label: "Search all", win: "Ctrl+/", mac: "⌘/" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, color: "#5C5952", fontWeight: 500 }}>{row.label}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "#9C9890" }}>Win</span>
                    <kbd style={kbdStyle}>{row.win}</kbd>
                  </div>
                  <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "#9C9890" }}>Mac</span>
                    <kbd style={kbdStyle}>{row.mac}</kbd>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
