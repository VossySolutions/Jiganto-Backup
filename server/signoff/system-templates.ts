export type EsignSystemTemplate = {
  title: string;
  description: string;
  category: string;
  contentHtml: string;
};

export const SYSTEM_ESIGN_TEMPLATES: EsignSystemTemplate[] = [
  {
    title: "Non-Disclosure Agreement (NDA)",
    description: "Standard mutual NDA for commercial engagements",
    category: "Legal",
    contentHtml: `<h1>Mutual Non-Disclosure Agreement</h1>
<p>This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the date of signature below.</p>
<h2>1. Definition of Confidential Information</h2>
<p>Each party may disclose confidential information to the other in connection with evaluating or performing professional services.</p>
<h2>2. Obligations</h2>
<p>The receiving party shall use confidential information solely for the permitted purpose and protect it with reasonable care.</p>
<h2>3. Term</h2>
<p>This Agreement remains in effect for three (3) years from the date of last disclosure.</p>`,
  },
  {
    title: "Statement of Work (SOW)",
    description: "Project scope, objectives, deliverables, timeline, and fees",
    category: "Commercial",
    contentHtml: `<h1>Statement of Work</h1>
<h2>Project Overview</h2>
<p>[Describe the project objectives and business context.]</p>
<h2>Scope &amp; Deliverables</h2>
<ul><li>Deliverable 1</li><li>Deliverable 2</li><li>Deliverable 3</li></ul>
<h2>Timeline</h2>
<p>Start date: [DATE] · Target completion: [DATE]</p>
<h2>Fees</h2>
<p>Fixed fee / T&amp;M: [AMOUNT]</p>`,
  },
  {
    title: "Change Request (CR)",
    description: "Formal scope, cost, or timeline change requiring PM and client sponsor signatures",
    category: "Project",
    contentHtml: `<h1>Change Request</h1>
<h2>Change Description</h2>
<p>[Describe the proposed change to scope, schedule, or cost.]</p>
<h2>Impact Assessment</h2>
<p><strong>Schedule impact:</strong> [days/weeks]</p>
<p><strong>Cost impact:</strong> [amount]</p>
<h2>Approval</h2>
<p>By signing below, both parties agree to implement this change.</p>`,
  },
  {
    title: "Project Charter",
    description: "Formal project authorisation signed by the sponsor",
    category: "Project",
    contentHtml: `<h1>Project Charter</h1>
<h2>Project Name</h2>
<p>[Project name]</p>
<h2>Business Case</h2>
<p>[Summary of business justification]</p>
<h2>Objectives &amp; Success Criteria</h2>
<ul><li>Objective 1</li><li>Objective 2</li></ul>
<h2>Authorisation</h2>
<p>The undersigned sponsor authorises the project to proceed.</p>`,
  },
  {
    title: "UAT Sign-Off Certificate",
    description: "Formal acceptance of solution after user acceptance testing",
    category: "Testing",
    contentHtml: `<h1>UAT Sign-Off Certificate</h1>
<h2>System / Release</h2>
<p>[System name and release version]</p>
<h2>Test Summary</h2>
<p>All agreed UAT test scenarios have been executed and accepted.</p>
<h2>Acceptance</h2>
<p>The undersigned confirms the solution meets agreed requirements and is accepted for go-live.</p>`,
  },
  {
    title: "Engagement Letter",
    description: "Professional services commencement letter",
    category: "Commercial",
    contentHtml: `<h1>Engagement Letter</h1>
<p>Dear Client,</p>
<p>We are pleased to confirm our engagement to provide professional services as outlined below.</p>
<h2>Services</h2>
<p>[Description of services]</p>
<h2>Terms</h2>
<p>Standard terms and conditions apply. Fees and payment schedule as agreed.</p>`,
  },
  {
    title: "Invoice Approval",
    description: "Internal approval document for client invoices",
    category: "Finance",
    contentHtml: `<h1>Invoice Approval</h1>
<h2>Invoice Details</h2>
<p><strong>Invoice #:</strong> [NUMBER]</p>
<p><strong>Amount:</strong> [AMOUNT]</p>
<p><strong>Client:</strong> [CLIENT NAME]</p>
<h2>Approval</h2>
<p>The undersigned approves this invoice for issue to the client.</p>`,
  },
];
