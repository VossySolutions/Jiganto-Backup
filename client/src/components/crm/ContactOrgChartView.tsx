import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";

type Contact = { id: number; accountId?: number | null; firstName: string; lastName: string; title: string | null; role: string | null };
type Relationship = {
  id: number;
  contactId: number;
  relatedContactId: number;
  relationshipType: string;
};

interface ContactOrgChartViewProps {
  accountId: number;
  contacts: Contact[];
}

export function ContactOrgChartView({ accountId, contacts }: ContactOrgChartViewProps) {
  const accountContacts = contacts.filter(c => c.accountId === accountId);

  const { data: allRelationships = [] } = useQuery<Relationship[]>({
    queryKey: [`/api/crm/contacts/org-chart/${accountId}`],
    queryFn: async () => {
      const rels: Relationship[] = [];
      for (const c of accountContacts) {
        const res = await fetchWithAuth(`/api/crm/contacts/${c.id}/relationships`);
        if (res.ok) {
          const data = await res.json();
          rels.push(...data);
        }
      }
      return rels;
    },
    enabled: accountContacts.length > 0,
  });

  const hierarchy = useMemo(() => {
    const reportsTo = new Map<number, number>();
    for (const r of allRelationships) {
      if (r.relationshipType === "Reports To") {
        reportsTo.set(r.contactId, r.relatedContactId);
      }
    }
    const roots = accountContacts.filter(c => !reportsTo.has(c.id));
    const childrenOf = (parentId: number): Contact[] =>
      accountContacts.filter(c => reportsTo.get(c.id) === parentId);

    return { roots, childrenOf };
  }, [accountContacts, allRelationships]);

  function Node({ contact, depth }: { contact: Contact; depth: number }) {
    const children = hierarchy.childrenOf(contact.id);
    const name = `${contact.firstName} ${contact.lastName}`;
    return (
      <div className="flex flex-col items-center" style={{ marginLeft: depth > 0 ? 0 : 0 }}>
        <div
          className="border rounded-lg px-4 py-2 bg-card shadow-sm min-w-[140px] text-center"
          data-testid={`org-node-${contact.id}`}
        >
          <div className="text-xs font-semibold">{name}</div>
          <div className="text-[10px] text-muted-foreground">{contact.title || contact.role || "—"}</div>
        </div>
        {children.length > 0 && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-dashed relative">
            {children.map(child => (
              <Node key={child.id} contact={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (accountContacts.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">No contacts to display</p>;
  }

  return (
    <div className="overflow-x-auto py-4" data-testid="contact-org-chart">
      <div className="flex justify-center gap-8 min-w-max">
        {hierarchy.roots.length > 0
          ? hierarchy.roots.map(c => <Node key={c.id} contact={c} depth={0} />)
          : accountContacts.slice(0, 6).map(c => <Node key={c.id} contact={c} depth={0} />)}
      </div>
    </div>
  );
}
