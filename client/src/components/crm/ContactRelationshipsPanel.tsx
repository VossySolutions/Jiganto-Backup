import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Users, Pencil } from "lucide-react";

type Contact = { id: number; firstName: string; lastName: string; accountId: number | null };
type Account = { id: number; name: string };
type Relationship = {
  id: number;
  contactId: number;
  relatedContactId: number;
  relationshipType: string;
  reverseRelationshipType: string | null;
  sameAccount?: boolean;
};

const RELATIONSHIP_TYPES = [
  "Reports To", "Direct Report", "Colleague", "Stakeholder",
  "Champion", "Economic Buyer", "Technical Buyer", "End User", "Gatekeeper",
];

interface ContactRelationshipsPanelProps {
  contactId: number;
  contacts: Contact[];
  accounts?: Account[];
  embedded?: boolean;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function ContactRelationshipsPanel({ contactId, contacts, accounts = [], embedded }: ContactRelationshipsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
  const [relatedId, setRelatedId] = useState("");
  const [relType, setRelType] = useState("Colleague");
  const { toast } = useToast();

  const currentContact = contacts.find((c) => c.id === contactId);

  const { data: relationships = [] } = useQuery<Relationship[]>({
    queryKey: [`/api/crm/contacts/${contactId}/relationships`],
  });

  const sameAccountContacts = useMemo(() => {
    if (!currentContact?.accountId) return [];
    return contacts.filter(
      (c) => c.id !== contactId && c.accountId === currentContact.accountId,
    );
  }, [contacts, contactId, currentContact?.accountId]);

  const invalidateRelationships = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contactId}/relationships`] });
    if (currentContact?.accountId) {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/org-chart/${currentContact.accountId}`] });
    }
  };

  const accountName = (accountId: number | null | undefined) =>
    accounts.find((a) => a.id === accountId)?.name || "Unknown account";

  const enrichedRelationships = useMemo(() => {
    return relationships.map((r) => {
      const related = contacts.find((c) => c.id === r.relatedContactId);
      const sameAccount =
        r.sameAccount ??
        (!!currentContact?.accountId &&
          !!related?.accountId &&
          currentContact.accountId === related.accountId);
      return { ...r, related, sameAccount };
    });
  }, [relationships, contacts, currentContact?.accountId]);

  const createMutation = useMutation({
    mutationFn: (data: { relatedContactId: number; relationshipType: string }) =>
      apiRequest("POST", "/api/crm/contact-relationships", {
        contactId,
        relatedContactId: data.relatedContactId,
        relationshipType: data.relationshipType,
        reverseRelationshipType: null,
      }),
    onSuccess: () => {
      invalidateRelationships();
      closeDialog();
      toast({ title: "Relationship added" });
    },
    onError: (error) =>
      toast({
        title: "Failed to add relationship",
        description: getApiErrorMessage(error, "Relationships must be between contacts at the same account."),
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; relatedContactId: number; relationshipType: string }) =>
      apiRequest("PUT", `/api/crm/contact-relationships/${data.id}`, {
        relatedContactId: data.relatedContactId,
        relationshipType: data.relationshipType,
      }),
    onSuccess: () => {
      invalidateRelationships();
      closeDialog();
      toast({ title: "Relationship updated" });
    },
    onError: (error) =>
      toast({
        title: "Failed to update relationship",
        description: getApiErrorMessage(error, "Relationships must be between contacts at the same account."),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/contact-relationships/${id}`),
    onSuccess: () => {
      invalidateRelationships();
      toast({ title: "Relationship removed" });
    },
  });

  const contactName = (id: number) => {
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : `Contact #${id}`;
  };

  function closeDialog() {
    setDialogOpen(false);
    setEditingRelationship(null);
    setRelatedId("");
    setRelType("Colleague");
  }

  function openCreateDialog() {
    setEditingRelationship(null);
    setRelatedId("");
    setRelType("Colleague");
    setDialogOpen(true);
  }

  function openEditDialog(relationship: Relationship) {
    setEditingRelationship(relationship);
    setRelatedId(String(relationship.relatedContactId));
    setRelType(relationship.relationshipType);
    setDialogOpen(true);
  }

  function handleSubmit() {
    const relatedContactId = parseInt(relatedId, 10);
    if (!relatedContactId) return;
    if (editingRelationship) {
      updateMutation.mutate({
        id: editingRelationship.id,
        relatedContactId,
        relationshipType: relType,
      });
    } else {
      createMutation.mutate({ relatedContactId, relationshipType: relType });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const canSubmit = !!relatedId && sameAccountContacts.some((c) => String(c.id) === relatedId);

  function handleDelete(id: number) {
    if (!window.confirm("Remove this relationship? You can add a corrected one afterwards.")) return;
    deleteMutation.mutate(id);
  }

  const contactDisplayName = currentContact
    ? `${currentContact.firstName} ${currentContact.lastName}`
    : "Contact";

  return (
    <div className={cn("space-y-3", embedded && "pt-2")} data-testid="contact-relationships-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 shrink-0" /> Relationships
          </div>
          {embedded && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{contactDisplayName}</p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={openCreateDialog}
          disabled={!currentContact?.accountId || sameAccountContacts.length === 0}
          data-testid="button-add-relationship"
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      {!currentContact?.accountId ? (
        <p className="text-xs text-muted-foreground">
          Assign this contact to an account before creating relationships.
        </p>
      ) : sameAccountContacts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add other contacts at the same account to define relationships.
        </p>
      ) : null}

      {relationships.length === 0 ? (
        <p className="text-xs text-muted-foreground">No relationships defined</p>
      ) : (
        <div className="space-y-2">
          {enrichedRelationships.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center justify-between gap-2 text-xs border rounded-lg px-3 py-2",
                !r.sameAccount && "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
              )}
              data-testid={`relationship-${r.id}`}
            >
              <span className="min-w-0">
                <span className="font-medium text-[#0ea5e9]">{r.relationshipType}</span>
                {" → "}
                <span className="font-medium">{contactName(r.relatedContactId)}</span>
                {!r.sameAccount && (
                  <span className="block text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                    Invalid — contact is at {accountName(r.related?.accountId)} (relationships must stay within the same account)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {r.sameAccount && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => openEditDialog(r)}
                    data-testid={`button-edit-relationship-${r.id}`}
                    title="Edit relationship"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleDelete(r.id)}
                  data-testid={`button-delete-relationship-${r.id}`}
                  title="Remove relationship"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormDialogShell
        open={dialogOpen}
        onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}
        title={editingRelationship ? "Edit relationship" : "Add relationship"}
        subtitle="Link contacts within the same account"
        saveLabel={editingRelationship ? "Save changes" : "Add"}
        onCancel={closeDialog}
        onSubmit={handleSubmit}
        saving={isSaving}
        disabled={!canSubmit}
        saveTestId="button-save-relationship"
        size="sm"
      >
            <div className="space-y-4 py-1">
              <p className="text-xs text-muted-foreground">
                Only contacts at <span className="font-medium text-foreground">{accountName(currentContact?.accountId)}</span> can be linked.
              </p>
              <Select value={relatedId || undefined} onValueChange={setRelatedId}>
                <SelectTrigger data-testid="select-related-contact">
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {sameAccountContacts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={relType} onValueChange={setRelType}>
                <SelectTrigger data-testid="select-relationship-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
      </FormDialogShell>
    </div>
  );
}
