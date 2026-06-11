import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type OpportunityFormData,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_SOURCES,
  RECURRING_FREQUENCIES,
  calcGpPercent,
} from "@/lib/crm-form";
import { CrmCustomFieldsForm } from "./CrmCustomFieldsForm";
import { CrmOwnerSelect } from "./CrmOwnerSelect";

type Stage = { id: number; name: string };
type Account = { id: number; name: string };
type Contact = { id: number; firstName: string; lastName: string; accountId: number | null };

interface OpportunityFormFieldsProps {
  formData: OpportunityFormData;
  setFormData: React.Dispatch<React.SetStateAction<OpportunityFormData>>;
  stages: Stage[];
  accounts: Account[];
  contacts: Contact[];
  customData?: Record<string, unknown>;
  onCustomDataChange?: (fieldName: string, value: unknown) => void;
}

export function OpportunityFormFields({ formData, setFormData, stages, accounts, contacts, customData = {}, onCustomDataChange }: OpportunityFormFieldsProps) {
  const accountContacts = formData.accountId
    ? contacts.filter(c => c.accountId === parseInt(formData.accountId))
    : contacts;

  const gpPct = calcGpPercent(
    formData.revenue ? parseFloat(formData.revenue) : null,
    formData.grossProfit ? parseFloat(formData.grossProfit) : null,
  );

  const set = (key: keyof OpportunityFormData, value: string) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
      <div>
        <Label>Opportunity Name *</Label>
        <Input value={formData.name} onChange={e => set("name", e.target.value)} data-testid="input-opp-name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Deal Value ($)</Label>
          <Input type="number" value={formData.amount} onChange={e => set("amount", e.target.value)} data-testid="input-opp-amount" />
        </div>
        <div>
          <Label>Recurring Amount</Label>
          <Input type="number" value={formData.recurringAmount} onChange={e => set("recurringAmount", e.target.value)} data-testid="input-opp-recurring" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Recurring Frequency</Label>
          <Select value={formData.recurringFrequency} onValueChange={v => set("recurringFrequency", v)}>
            <SelectTrigger data-testid="select-opp-recurring-freq"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {RECURRING_FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Win Probability (%)</Label>
          <Input type="number" min={0} max={100} value={formData.probability} onChange={e => set("probability", e.target.value)} data-testid="input-opp-probability" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Stage</Label>
          <Select value={formData.stageId} onValueChange={v => set("stageId", v)}>
            <SelectTrigger data-testid="select-opp-stage"><SelectValue placeholder="Select stage" /></SelectTrigger>
            <SelectContent>{stages.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={v => set("type", v)}>
            <SelectTrigger data-testid="select-opp-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{OPPORTUNITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Account</Label>
          <Select value={formData.accountId} onValueChange={v => set("accountId", v)}>
            <SelectTrigger data-testid="select-opp-account"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Contact</Label>
          <Select value={formData.contactId} onValueChange={v => set("contactId", v)}>
            <SelectTrigger data-testid="select-opp-contact"><SelectValue placeholder="Select contact" /></SelectTrigger>
            <SelectContent>{accountContacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Source</Label>
          <Select value={formData.source} onValueChange={v => set("source", v)}>
            <SelectTrigger data-testid="select-opp-source"><SelectValue placeholder="Select source" /></SelectTrigger>
            <SelectContent>{OPPORTUNITY_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Next Step</Label>
          <Input value={formData.nextStep} onChange={e => set("nextStep", e.target.value)} data-testid="input-opp-next-step" />
        </div>
      </div>
      <div>
        <Label>Competitor</Label>
        <Input value={formData.competitor} onChange={e => set("competitor", e.target.value)} placeholder="Competing vendor or solution" data-testid="input-opp-competitor" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Expected Close Date</Label>
          <Input type="date" value={formData.expectedCloseDate} onChange={e => set("expectedCloseDate", e.target.value)} data-testid="input-opp-close-date" />
        </div>
        <div>
          <Label>Actual Close Date</Label>
          <Input type="date" value={formData.actualCloseDate} onChange={e => set("actualCloseDate", e.target.value)} data-testid="input-opp-actual-close" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Revenue</Label>
          <Input type="number" value={formData.revenue} onChange={e => set("revenue", e.target.value)} data-testid="input-opp-revenue" />
        </div>
        <div>
          <Label>Gross Profit</Label>
          <Input type="number" value={formData.grossProfit} onChange={e => set("grossProfit", e.target.value)} data-testid="input-opp-gross-profit" />
        </div>
        <div>
          <Label>GP %</Label>
          <Input readOnly value={gpPct != null ? `${gpPct}%` : "—"} className="bg-muted" data-testid="input-opp-gp-pct" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Win Reason</Label>
          <Input value={formData.winReason} onChange={e => set("winReason", e.target.value)} data-testid="input-opp-win-reason" />
        </div>
        <div>
          <Label>Loss Reason</Label>
          <Input value={formData.lossReason} onChange={e => set("lossReason", e.target.value)} data-testid="input-opp-loss-reason" />
        </div>
      </div>
      <CrmOwnerSelect
        value={formData.ownerUserId}
        onChange={(v) => set("ownerUserId", v)}
        testId="select-opp-owner"
      />
      <div>
        <Label>Description</Label>
        <Textarea value={formData.description} onChange={e => set("description", e.target.value)} rows={3} data-testid="input-opp-description" />
      </div>
      {onCustomDataChange && (
        <CrmCustomFieldsForm entityType="opportunity" values={customData} onChange={onCustomDataChange} />
      )}
    </div>
  );
}
