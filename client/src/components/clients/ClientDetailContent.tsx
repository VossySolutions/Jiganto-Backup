import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { CLIENTS_PATH } from "@shared/app-routes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatClientDate } from "@/lib/client-workspace-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Pencil,
  Users,
} from "lucide-react";
import type { ClientWorkspace } from "./types";
import { userDisplayName } from "./types";

function userInitials(u?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null): string {
  if (!u) return "?";
  const first = u.firstName?.[0] ?? "";
  const last = u.lastName?.[0] ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return (u.email?.[0] ?? "?").toUpperCase();
}

function formatWebsiteLabel(url?: string | null): string {
  if (!url) return "";
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function websiteHref(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

function engagementStatusLabel(status?: string | null): string {
  if (!status) return "Active";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function engagementDurationLabel(start?: string | null): string {
  if (!start) return "—";
  const startDate = new Date(`${start}T12:00:00`);
  if (Number.isNaN(startDate.getTime())) return "—";
  const days = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  if (days === 0) return "Started today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2.5 mt-7 first:mt-0">
      {children}
    </p>
  );
}

function DetailCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[14px] border bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 px-[18px] py-3.5 border-b border-border/40">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-foreground">{title}</h3>
        {action}
      </div>
      <div className="px-[18px] py-[18px]">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 py-[11px]",
        !last && "border-b border-border/40",
      )}
    >
      <span className="text-xs font-semibold text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm font-semibold text-right">{children}</div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub: string;
  tone?: "default" | "warn" | "danger" | "zero";
}) {
  return (
    <div className="rounded-[10px] bg-muted/40 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p
        className={cn(
          "text-[22px] font-extrabold leading-none tabular-nums",
          tone === "warn" && "text-amber-700",
          tone === "danger" && "text-red-600",
          tone === "zero" && "text-muted-foreground/70",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

interface Props {
  client: ClientWorkspace;
  canConfigure: boolean;
  onEdit: () => void;
  onManageMembers: () => void;
  onModuleVisibility: () => void;
  showBackLink?: boolean;
}

export function ClientDetailContent({
  client,
  canConfigure,
  onEdit,
  onManageMembers,
  onModuleVisibility,
  showBackLink = true,
}: Props) {
  const { toast } = useToast();
  const [notesDraft, setNotesDraft] = useState(client.notes ?? "");

  useEffect(() => {
    setNotesDraft(client.notes ?? "");
  }, [client.id, client.notes]);

  const saveNotesMut = useMutation({
    mutationFn: async (notes: string) => {
      const res = await apiRequest("PUT", `/api/clients/${client.id}`, { notes: notes.trim() || null });
      return res.json() as Promise<ClientWorkspace>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id] });
      toast({ title: "Note saved" });
    },
    onError: () => toast({ title: "Could not save note", variant: "destructive" }),
  });

  const projectCount = client.projectCount ?? 0;
  const activeProjects = client.activeProjectCount ?? 0;
  const atRisk = client.atRiskCount ?? 0;
  const members = client.memberCount ?? 0;

  const showRiskBanner =
    !client.contractStart && activeProjects === 0 && client.status === "active";

  const statusTone = useMemo(() => {
    const s = (client.engagementStatus ?? client.status ?? "active").toLowerCase();
    if (s === "active") return "active";
    if (s === "on_hold") return "hold";
    return "muted";
  }, [client.engagementStatus, client.status]);

  const notesDirty = notesDraft.trim() !== (client.notes ?? "").trim();

  return (
    <div className="max-w-[980px] mx-auto px-4 sm:px-8 py-6 sm:py-8 pb-16">
      {showBackLink && (
        <Link
          href={CLIENTS_PATH}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspaces
        </Link>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-[18px] mb-6">
        <div
          className="h-16 w-16 rounded-[14px] flex items-center justify-center text-[15px] font-extrabold text-white shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${client.color}, ${client.color}CC)` }}
        >
          {client.shortCode}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">{client.name}</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                statusTone === "active" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                statusTone === "hold" && "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                statusTone === "muted" && "bg-muted text-muted-foreground",
              )}
            >
              {statusTone === "active" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
              {engagementStatusLabel(client.engagementStatus ?? client.status)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <span>{client.industry || "Client workspace"}</span>
            <span>·</span>
            <span className="font-mono text-xs text-muted-foreground/80 bg-muted px-2 py-0.5 rounded-md">
              {client.shortCode}
            </span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 w-full lg:w-auto">
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onManageMembers}>
            <Users className="h-4 w-4" />
            Manage members
          </Button>
          {canConfigure && (
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onModuleVisibility}>
              <Eye className="h-4 w-4" />
              Module visibility
            </Button>
          )}
          <Button size="sm" className="h-9 gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit details
          </Button>
        </div>
      </div>

      {showRiskBanner && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 mb-5">
          <span aria-hidden>⚠</span>
          <p>
            No engagement start date set, and the account has no active projects. Consider setting a start
            date or flagging this account for review.
          </p>
        </div>
      )}

      <SectionLabel>Account &amp; ownership</SectionLabel>
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4 mb-4">
        <DetailCard
          title="Account details"
          action={
            <button
              type="button"
              onClick={onEdit}
              className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          }
        >
          <FieldRow label="Account manager">
            <span>{userDisplayName(client.accountManagerUser)}</span>
          </FieldRow>
          <FieldRow label="Created by">
            <span className="text-muted-foreground font-medium">{userDisplayName(client.createdByUser)}</span>
          </FieldRow>
          <FieldRow label="Created on">
            <span className="text-muted-foreground font-medium">{formatClientDate(client.createdAt)}</span>
          </FieldRow>
          <FieldRow label="Website">
            {client.website ? (
              <a
                href={websiteHref(client.website)}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
              >
                {formatWebsiteLabel(client.website)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-muted-foreground font-medium">—</span>
            )}
          </FieldRow>
          <FieldRow label="Members" last>
            <span>
              {members}{" "}
              <button
                type="button"
                onClick={onManageMembers}
                className="text-primary text-xs font-semibold hover:underline ml-1"
              >
                View
              </button>
            </span>
          </FieldRow>
        </DetailCard>

        <DetailCard title="Engagement timeline">
          <FieldRow label="Engagement start">
            {client.contractStart ? (
              <span>{formatClientDate(client.contractStart)}</span>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                className="text-xs font-semibold text-primary border border-dashed border-primary/50 rounded-md px-2.5 py-0.5 hover:bg-primary/5"
              >
                + Set date
              </button>
            )}
          </FieldRow>
          <FieldRow label="Engagement end">
            {client.contractEnd ? (
              <span>{formatClientDate(client.contractEnd)}</span>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                className="text-xs font-semibold text-primary border border-dashed border-primary/50 rounded-md px-2.5 py-0.5 hover:bg-primary/5"
              >
                + Set date
              </button>
            )}
          </FieldRow>
          <FieldRow label="Duration so far" last>
            <span className="text-muted-foreground font-medium">
              {engagementDurationLabel(client.contractStart)}
            </span>
          </FieldRow>
        </DetailCard>
      </div>

      <SectionLabel>Account health</SectionLabel>
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4 mb-4">
        <DetailCard title="Activity snapshot">
          <div className="grid grid-cols-2 gap-2.5">
            <StatBox
              label="Projects"
              value={projectCount}
              sub={activeProjects > 0 ? `${activeProjects} active` : "No active projects yet"}
              tone={projectCount === 0 ? "zero" : "default"}
            />
            <StatBox
              label="At risk"
              value={atRisk}
              sub={atRisk > 0 ? "Needs attention" : "Nothing flagged"}
              tone={atRisk > 0 ? "danger" : "zero"}
            />
            <StatBox
              label="Members"
              value={members}
              sub="Workspace contacts"
            />
            <StatBox
              label="Open invoices"
              value="£0"
              sub="Nothing outstanding"
              tone="zero"
            />
          </div>
        </DetailCard>

        <DetailCard title="Key people">
          {client.accountManagerUser && (
            <div className="flex items-center gap-2.5 py-2.5 border-b border-border/40">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {userInitials(client.accountManagerUser)}
              </div>
              <div>
                <p className="text-[13px] font-semibold">{userDisplayName(client.accountManagerUser)}</p>
                <p className="text-[11px] text-muted-foreground">Account manager</p>
              </div>
            </div>
          )}
          {client.createdByUser && (
            <div className="flex items-center gap-2.5 py-2.5">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: `${client.color}22`, color: client.color }}
              >
                {userInitials(client.createdByUser)}
              </div>
              <div>
                <p className="text-[13px] font-semibold">{userDisplayName(client.createdByUser)}</p>
                <p className="text-[11px] text-muted-foreground">Created this account</p>
              </div>
            </div>
          )}
          {!client.accountManagerUser && !client.createdByUser && (
            <p className="text-sm text-muted-foreground py-2">No people assigned yet.</p>
          )}
        </DetailCard>
      </div>

      <SectionLabel>Notes</SectionLabel>
      <DetailCard title="Notes on the customer" className="notes-card">
        <div className="p-0 -mx-[18px] -my-[18px]">
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add context for your team — relationship history, key decisions, things to remember before the next call..."
            className="min-h-[120px] border-0 rounded-none px-[18px] py-4 text-sm resize-y focus-visible:ring-0 shadow-none"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-[18px] py-2.5 bg-muted/40 border-t border-border/40">
            <p className="text-[11px] text-muted-foreground">
              {client.updatedAt
                ? `Last edited ${formatClientDate(client.updatedAt)}`
                : "Not saved yet"}
              {client.createdByUser ? ` by ${userDisplayName(client.createdByUser)}` : ""}
            </p>
            <Button
              size="sm"
              className="h-8 text-xs font-bold shrink-0"
              disabled={!notesDirty || saveNotesMut.isPending}
              onClick={() => saveNotesMut.mutate(notesDraft)}
            >
              {saveNotesMut.isPending ? "Saving…" : "Save note"}
            </Button>
          </div>
        </div>
      </DetailCard>
    </div>
  );
}
