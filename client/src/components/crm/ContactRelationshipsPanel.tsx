import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Users } from "lucide-react";

type Contact = { id: number; firstName: string; lastName: string; accountId: number | null };
type Relationship = {
  id: number;
  contactId: number;
  relatedContactId: number;
  relationshipType: string;
  reverseRelationshipType: string | null;
};

const RELATIONSHIP_TYPES = [
  "Reports To", "Direct Report", "Colleague", "Stakeholder",
  "Champion", "Economic Buyer", "Technical Buyer", "End User", "Gatekeeper",
];

interface ContactRelationshipsPanelProps {
  contactId: number;
  contacts: Contact[];
}

export function ContactRelationshipsPanel({ contactId, contacts }: ContactRelationshipsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [relatedId, setRelatedId] = useState("");
  const [relType, setRelType] = useState("Colleague");
  const { toast } = useToast();

  const { data: relationships = [] } = useQuery<Relationship[]>({
    queryKey: [`/api/crm/contacts/${contactId}/relationships`],
  });

  const createMutation = useMutation({
    mutationFn: (data: { relatedContactId: number; relationshipType: string }) =>
      apiRequest("POST", "/api/crm/contact-relationships", {
        contactId,
        relatedContactId: data.relatedContactId,
        relationshipType: data.relationshipType,
        reverseRelationshipType: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contactId}/relationships`] });
      setDialogOpen(false);
      setRelatedId("");
      toast({ title: "Relationship added" });
    },
    onError: () => toast({ title: "Failed to add relationship", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/contact-relationships/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contactId}/relationships`] });
      toast({ title: "Relationship removed" });
    },
  });

  const contactName = (id: number) => {
    const c = contacts.find(x => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : `Contact #${id}`;
  };

  const otherContacts = contacts.filter(c => c.id !== contactId);

  return (
    <div className="space-y-3" data-testid="contact-relationships-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Relationships
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setDialogOpen(true)} data-testid="button-add-relationship">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {relationships.length === 0 ? (
        <p className="text-xs text-muted-foreground">No relationships defined</p>
      ) : (
        <div className="space-y-2">
          {relationships.map(r => (
            <div key={r.id} className="flex items-center justify-between text-xs border rounded-lg px-3 py-2" data-testid={`relationship-${r.id}`}>
              <span>
                <span className="font-medium text-[#0ea5e9]">{r.relationshipType}</span>
                {" → "}
                {contactName(r.relatedContactId)}
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deleteMutation.mutate(r.id)}>
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <SubmitForm onSubmit={() => createMutation.mutate({ relatedContactId: parseInt(relatedId), relationshipType: relType })} disabled={!relatedId}>
            <DialogHeader><DialogTitle>Add Relationship</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={relatedId} onValueChange={setRelatedId}>
                <SelectTrigger data-testid="select-related-contact"><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  {otherContacts.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={relType} onValueChange={setRelType}>
                <SelectTrigger data-testid="select-relationship-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={!relatedId}>Add</Button>
            </DialogFooter>
          </SubmitForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
