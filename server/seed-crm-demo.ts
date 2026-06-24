import { db } from "./db";
import { 
  crmOpportunityStages, 
  crmAccounts, 
  crmContacts, 
  crmOpportunities,
  crmLeads,
  crmContracts,
  crmActivities,
  crmNotes,
  crmForecasts,
  crmPipelines,
  crmEmailLogs,
  opportunityResourcePlans,
  opportunityResourceRows,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const TENANT_ID = 1;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const repOwners = ["Sales Manager", "Account Executive", "Solutions Architect", "VP of Sales"];

function quarterCloseDate(year: number, quarter: number): Date {
  const month = (quarter - 1) * 3 + 1;
  return new Date(year, month, 15);
}

const opportunityStagesData = [
  { name: "Prospecting", order: 1, probability: 10, isClosed: false, isWon: false, color: "#94a3b8" },
  { name: "Qualification", order: 2, probability: 20, isClosed: false, isWon: false, color: "#60a5fa" },
  { name: "Needs Analysis", order: 3, probability: 40, isClosed: false, isWon: false, color: "#818cf8" },
  { name: "Proposal", order: 4, probability: 60, isClosed: false, isWon: false, color: "#a78bfa" },
  { name: "Negotiation", order: 5, probability: 80, isClosed: false, isWon: false, color: "#f59e0b" },
  { name: "Closed Won", order: 6, probability: 100, isClosed: true, isWon: true, color: "#22c55e" },
  { name: "Closed Lost", order: 7, probability: 0, isClosed: true, isWon: false, color: "#ef4444" },
];

const existingCustomers = [
  { name: "TechFlow Solutions", industry: "Technology", website: "https://techflow.com", country: "USA", city: "San Francisco", state: "CA", employeeCount: 250, annualRevenue: "15000000", description: "Enterprise software company specializing in workflow automation" },
  { name: "Nordic Digital Systems", industry: "Technology", website: "https://nordicdigital.eu", country: "Sweden", city: "Stockholm", employeeCount: 180, annualRevenue: "12000000", description: "Digital transformation consultancy with Scandinavian roots" },
  { name: "Meridian Manufacturing", industry: "Manufacturing", website: "https://meridianmfg.co.uk", country: "UK", city: "Manchester", employeeCount: 450, annualRevenue: "45000000", description: "Precision manufacturing company seeking ERP modernization" },
  { name: "FinServe Global", industry: "Financial Services", website: "https://finserveglobal.com", country: "UK", city: "London", employeeCount: 800, annualRevenue: "120000000", description: "International financial services provider" },
  { name: "CloudFirst Partners", industry: "Technology", website: "https://cloudfirst.io", country: "USA", city: "Seattle", state: "WA", employeeCount: 120, annualRevenue: "8000000", description: "Cloud migration and managed services partner" },
  { name: "EuroTech Innovations", industry: "Technology", website: "https://eurotech-innov.de", country: "Germany", city: "Munich", employeeCount: 320, annualRevenue: "28000000", description: "R&D focused technology company" },
  { name: "Atlantic Healthcare Systems", industry: "Healthcare", website: "https://atlantichealth.com", country: "USA", city: "Boston", state: "MA", employeeCount: 650, annualRevenue: "75000000", description: "Healthcare technology provider for hospital networks" },
  { name: "Swiss Precision AG", industry: "Manufacturing", website: "https://swiss-precision.ch", country: "Switzerland", city: "Zurich", employeeCount: 200, annualRevenue: "35000000", description: "High-precision equipment manufacturer" },
  { name: "DataStream Analytics", industry: "Technology", website: "https://datastream.co.uk", country: "UK", city: "Cambridge", employeeCount: 95, annualRevenue: "6000000", description: "Big data and analytics platform provider" },
  { name: "Pacific Retail Group", industry: "Retail", website: "https://pacificretail.com", country: "USA", city: "Los Angeles", state: "CA", employeeCount: 1200, annualRevenue: "180000000", description: "Multi-channel retail conglomerate" },
];

const prospectAccounts = [
  { name: "Apex Consulting Group", industry: "Consulting", website: "https://apexconsulting.com", country: "USA", city: "Chicago", state: "IL", employeeCount: 150, description: "Management consulting firm looking for project management software" },
  { name: "Berlin Tech Ventures", industry: "Technology", website: "https://berlintech.de", country: "Germany", city: "Berlin", employeeCount: 85, description: "Tech startup accelerator seeking collaboration tools" },
  { name: "Royal Insurance Ltd", industry: "Insurance", website: "https://royalinsurance.co.uk", country: "UK", city: "Birmingham", employeeCount: 2500, annualRevenue: "500000000", description: "Major UK insurance provider exploring digital transformation" },
  { name: "GreenEnergy Solutions", industry: "Energy", website: "https://greenenergy.eu", country: "Netherlands", city: "Amsterdam", employeeCount: 280, description: "Renewable energy company needing resource management" },
  { name: "Metro Transit Authority", industry: "Government", website: "https://metrotransit.gov", country: "USA", city: "New York", state: "NY", employeeCount: 5000, description: "Public transit authority modernizing operations" },
  { name: "Alpine Pharma AG", industry: "Pharmaceutical", website: "https://alpinepharma.ch", country: "Switzerland", city: "Basel", employeeCount: 1800, annualRevenue: "250000000", description: "Pharmaceutical company seeking compliance management" },
  { name: "CyberShield Security", industry: "Technology", website: "https://cybershield.io", country: "Israel", city: "Tel Aviv", employeeCount: 120, description: "Cybersecurity firm evaluating project tracking tools" },
  { name: "Northern Logistics", industry: "Logistics", website: "https://northernlogistics.fi", country: "Finland", city: "Helsinki", employeeCount: 350, description: "Supply chain company optimizing operations" },
  { name: "MediaWave Studios", industry: "Media", website: "https://mediawave.com", country: "USA", city: "Austin", state: "TX", employeeCount: 200, description: "Digital media company needing workflow automation" },
  { name: "Paris Fashion House", industry: "Retail", website: "https://parisfashion.fr", country: "France", city: "Paris", employeeCount: 450, annualRevenue: "95000000", description: "Luxury fashion brand seeking omnichannel solutions" },
  { name: "Tokyo Systems Inc", industry: "Technology", website: "https://tokyosystems.jp", country: "Japan", city: "Tokyo", employeeCount: 500, description: "Enterprise software reseller for APAC market" },
  { name: "Dubai Trade Hub", industry: "Trade", website: "https://dubaitradehub.ae", country: "UAE", city: "Dubai", employeeCount: 180, description: "Trade facilitation company needing CRM integration" },
  { name: "Scottish Renewables", industry: "Energy", website: "https://scottishrenewables.co.uk", country: "UK", city: "Edinburgh", employeeCount: 220, description: "Wind farm operator seeking asset management" },
  { name: "MidWest Manufacturing", industry: "Manufacturing", website: "https://midwestmfg.com", country: "USA", city: "Detroit", state: "MI", employeeCount: 680, annualRevenue: "85000000", description: "Auto parts supplier modernizing production" },
  { name: "Roma Costruzioni", industry: "Construction", website: "https://romacostruzioni.it", country: "Italy", city: "Rome", employeeCount: 400, description: "Construction company needing project management" },
  { name: "Brussels EU Affairs", industry: "Consulting", website: "https://euaffairs.be", country: "Belgium", city: "Brussels", employeeCount: 45, description: "EU policy consultancy seeking document management" },
  { name: "Vancouver Health Network", industry: "Healthcare", website: "https://vanhealthnet.ca", country: "Canada", city: "Vancouver", employeeCount: 3200, description: "Healthcare network evaluating patient management" },
  { name: "Sydney Tech Partners", industry: "Technology", website: "https://sydneytech.com.au", country: "Australia", city: "Sydney", employeeCount: 150, description: "IT services company exploring partnership" },
  { name: "Madrid Telecom", industry: "Telecommunications", website: "https://madridtelecom.es", country: "Spain", city: "Madrid", employeeCount: 890, annualRevenue: "120000000", description: "Telecom provider seeking OSS/BSS modernization" },
  { name: "Warsaw FinTech", industry: "Financial Services", website: "https://warsawfintech.pl", country: "Poland", city: "Warsaw", employeeCount: 75, description: "FinTech startup needing compliance tools" },
];

const contactTemplates = [
  { firstNames: ["John", "Sarah", "Michael", "Emma", "David", "Lisa", "James", "Anna", "Robert", "Maria"], lastNames: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"], titles: ["CEO", "CTO", "VP of Operations", "Director of IT", "Head of Procurement", "CFO", "COO", "VP of Engineering", "Director of Strategy", "Head of Digital"], departments: ["Executive", "Technology", "Operations", "IT", "Procurement", "Finance", "Operations", "Engineering", "Strategy", "Digital"] },
  { firstNames: ["Thomas", "Jennifer", "William", "Elizabeth", "Richard", "Susan", "Joseph", "Margaret", "Charles", "Dorothy"], lastNames: ["Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Robinson", "Clark"], titles: ["Project Manager", "Business Analyst", "IT Manager", "Systems Architect", "Product Owner", "Technical Lead", "Solutions Consultant", "Enterprise Architect", "Program Director", "Innovation Manager"], departments: ["PMO", "Business", "IT", "Technology", "Product", "Development", "Consulting", "Architecture", "Programs", "Innovation"] },
  { firstNames: ["Daniel", "Nancy", "Matthew", "Betty", "Anthony", "Sandra", "Mark", "Ashley", "Steven", "Dorothy"], lastNames: ["Lewis", "Lee", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott", "Green"], titles: ["Senior Engineer", "Data Analyst", "Security Lead", "DevOps Manager", "QA Director", "UX Lead", "Integration Specialist", "Cloud Architect", "AI/ML Lead", "Platform Manager"], departments: ["Engineering", "Analytics", "Security", "DevOps", "Quality", "Design", "Integration", "Cloud", "AI/ML", "Platform"] },
];

const opportunityData = [
  { name: "Enterprise Platform License", type: "New Business", amount: "450000", probability: 80, stage: "Negotiation" },
  { name: "Cloud Migration Project", type: "Professional Services", amount: "280000", probability: 60, stage: "Proposal" },
  { name: "Digital Transformation Initiative", type: "Professional Services", amount: "750000", probability: 40, stage: "Needs Analysis" },
  { name: "Annual Support Renewal", type: "Renewal", amount: "85000", probability: 90, stage: "Negotiation" },
  { name: "Integration Services Package", type: "Professional Services", amount: "120000", probability: 20, stage: "Qualification" },
  { name: "Partner Reseller Agreement", type: "Partnership", amount: "200000", probability: 10, stage: "Prospecting" },
  { name: "Custom Development Project", type: "Professional Services", amount: "380000", probability: 60, stage: "Proposal" },
  { name: "SaaS Platform Subscription", type: "New Business", amount: "156000", probability: 40, stage: "Needs Analysis" },
  { name: "Training & Enablement Package", type: "Professional Services", amount: "45000", probability: 80, stage: "Negotiation" },
  { name: "Enterprise License Expansion", type: "Upsell", amount: "220000", probability: 60, stage: "Proposal" },
  { name: "Compliance Module Implementation", type: "Professional Services", amount: "175000", probability: 20, stage: "Qualification" },
  { name: "API Integration Suite", type: "New Business", amount: "95000", probability: 40, stage: "Needs Analysis" },
  { name: "Data Analytics Platform", type: "New Business", amount: "320000", probability: 10, stage: "Prospecting" },
  { name: "Mobile Application Development", type: "Professional Services", amount: "250000", probability: 60, stage: "Proposal" },
  { name: "Security Enhancement Project", type: "Professional Services", amount: "180000", probability: 80, stage: "Negotiation" },
  { name: "System Integration Contract", type: "Professional Services", amount: "420000", probability: 40, stage: "Needs Analysis" },
  { name: "Managed Services Agreement", type: "New Business", amount: "144000", probability: 20, stage: "Qualification" },
  { name: "IoT Platform License", type: "New Business", amount: "280000", probability: 10, stage: "Prospecting" },
  { name: "Business Intelligence Suite", type: "New Business", amount: "195000", probability: 60, stage: "Proposal" },
  { name: "Workflow Automation Project", type: "Professional Services", amount: "135000", probability: 40, stage: "Needs Analysis" },
];

const leadsData = [
  { firstName: "Alexandra", lastName: "Petrov", email: "a.petrov@quantumleap.io", phone: "+44-20-7946-0958", company: "Quantum Leap Technologies", title: "VP of Engineering", source: "Website", status: "new", score: 85, rating: "hot", industry: "Technology", website: "https://quantumleap.io", description: "Downloaded enterprise whitepaper and requested demo" },
  { firstName: "Marcus", lastName: "Chen", email: "m.chen@globalretail.com", phone: "+1-212-555-0147", company: "Global Retail Corp", title: "Chief Digital Officer", source: "Referral", status: "contacted", score: 92, rating: "hot", industry: "Retail", website: "https://globalretail.com", description: "Referred by Pacific Retail Group - looking for enterprise platform" },
  { firstName: "Sofia", lastName: "Bergmann", email: "s.bergmann@autowerkstatt.de", phone: "+49-89-4520-1234", company: "AutoWerkstatt GmbH", title: "Head of IT", source: "Event", status: "qualified", score: 78, rating: "warm", industry: "Manufacturing", website: "https://autowerkstatt.de", description: "Met at Industry 4.0 conference, interested in IoT integration" },
  { firstName: "Raj", lastName: "Patel", email: "r.patel@mumbaifinance.in", phone: "+91-22-6789-0123", company: "Mumbai Finance Ltd", title: "CTO", source: "Partner", status: "new", score: 65, rating: "warm", industry: "Financial Services", website: "https://mumbaifinance.in", description: "Partner referral from FinServe Global for APAC expansion" },
  { firstName: "Eleanor", lastName: "Whitfield", email: "e.whitfield@nhstrust.nhs.uk", phone: "+44-121-456-7890", company: "Midlands NHS Trust", title: "Director of Digital Services", source: "Website", status: "contacted", score: 70, rating: "warm", industry: "Healthcare", website: "https://midlandsnhs.nhs.uk", description: "Exploring patient management and workflow automation" },
  { firstName: "Carlos", lastName: "Mendoza", email: "c.mendoza@latinenergia.mx", phone: "+52-55-1234-5678", company: "Latin Energia SA", title: "Operations Director", source: "Cold Call", status: "new", score: 45, rating: "cold", industry: "Energy", website: "https://latinenergia.mx", description: "Initial interest in resource management capabilities" },
  { firstName: "Yuki", lastName: "Tanaka", email: "y.tanaka@nipponsoft.co.jp", phone: "+81-3-1234-5678", company: "NipponSoft Corporation", title: "VP of Sales", source: "Event", status: "qualified", score: 88, rating: "hot", industry: "Technology", website: "https://nipponsoft.co.jp", description: "Strong interest in CRM and project management suite - budget approved" },
  { firstName: "Ingrid", lastName: "Larsson", email: "i.larsson@scandishipping.se", phone: "+46-31-123-4567", company: "Scandi Shipping AB", title: "CFO", source: "Website", status: "contacted", score: 55, rating: "warm", industry: "Logistics", website: "https://scandishipping.se", description: "Looking for financial and contract management modules" },
  { firstName: "Ahmed", lastName: "Al-Rashid", email: "a.alrashid@riyadhdev.sa", phone: "+966-11-987-6543", company: "Riyadh Development Corp", title: "Program Director", source: "Partner", status: "new", score: 72, rating: "warm", industry: "Construction", website: "https://riyadhdev.sa", description: "Large-scale construction projects needing PM software" },
  { firstName: "Olivia", lastName: "Hart", email: "o.hart@brightonmedia.co.uk", phone: "+44-1273-456-789", company: "Brighton Media Group", title: "Managing Director", source: "Referral", status: "qualified", score: 80, rating: "hot", industry: "Media", website: "https://brightonmedia.co.uk", description: "Urgently needs document management and collaboration tools" },
  { firstName: "Friedrich", lastName: "Weber", email: "f.weber@berlinpharma.de", phone: "+49-30-9876-5432", company: "Berlin Pharma AG", title: "Head of Compliance", source: "Event", status: "contacted", score: 68, rating: "warm", industry: "Pharmaceutical", website: "https://berlinpharma.de", description: "Compliance and audit trail requirements for pharma industry" },
  { firstName: "Isabella", lastName: "Romano", email: "i.romano@milanfashion.it", phone: "+39-02-5678-9012", company: "Milan Fashion SpA", title: "COO", source: "Website", status: "new", score: 40, rating: "cold", industry: "Retail", website: "https://milanfashion.it", description: "Early stage exploration of enterprise platforms" },
  { firstName: "James", lastName: "O'Brien", email: "j.obrien@dublintech.ie", phone: "+353-1-234-5678", company: "Dublin Tech Innovations", title: "CEO", source: "Referral", status: "qualified", score: 90, rating: "hot", industry: "Technology", website: "https://dublintech.ie", description: "Fast-growing startup needs full enterprise suite within 3 months" },
  { firstName: "Anika", lastName: "Muller", email: "a.muller@viennabank.at", phone: "+43-1-987-6543", company: "Vienna Banking Group", title: "Head of Digital Banking", source: "Cold Call", status: "contacted", score: 58, rating: "warm", industry: "Financial Services", website: "https://viennabank.at", description: "Digital transformation initiative for retail banking division" },
  { firstName: "Liam", lastName: "McKenzie", email: "l.mckenzie@melbournehealth.com.au", phone: "+61-3-9876-5432", company: "Melbourne Health Alliance", title: "CIO", source: "Partner", status: "new", score: 75, rating: "warm", industry: "Healthcare", website: "https://melbournehealth.com.au", description: "Healthcare network seeking integrated patient and resource management" },
  { firstName: "Natasha", lastName: "Volkov", email: "n.volkov@balticlogistics.lv", phone: "+371-6789-0123", company: "Baltic Logistics Group", title: "VP of Operations", source: "Event", status: "contacted", score: 62, rating: "warm", industry: "Logistics", website: "https://balticlogistics.lv", description: "Supply chain optimization and project tracking requirements" },
  { firstName: "Henrik", lastName: "Johansson", email: "h.johansson@copenhagenai.dk", phone: "+45-33-123-456", company: "Copenhagen AI Labs", title: "Co-Founder", source: "Website", status: "new", score: 82, rating: "hot", industry: "Technology", website: "https://copenhagenai.dk", description: "AI startup scaling rapidly, needs enterprise infrastructure" },
  { firstName: "Carmen", lastName: "Santos", email: "c.santos@lisboninvest.pt", phone: "+351-21-123-4567", company: "Lisbon Investment Fund", title: "Portfolio Manager", source: "Referral", status: "qualified", score: 71, rating: "warm", industry: "Financial Services", website: "https://lisboninvest.pt", description: "Investment fund tracking and reporting requirements" },
];

const contractsData = [
  { name: "Enterprise Platform License - TechFlow", type: "license", status: "active", value: "450000", startOffset: -365, endOffset: 0, terms: "Annual enterprise license for 250 seats including standard support. Auto-renewal with 60-day notice period." },
  { name: "Cloud Infrastructure Services - Nordic Digital", type: "service", status: "active", value: "180000", startOffset: -200, endOffset: 165, terms: "Managed cloud hosting and DevOps services. Monthly billing with quarterly reviews." },
  { name: "ERP Modernization Phase 1 - Meridian", type: "project", status: "active", value: "750000", startOffset: -120, endOffset: 245, terms: "Fixed-price delivery for Phase 1 ERP modernization. Milestone-based payments." },
  { name: "Compliance Suite License - FinServe", type: "license", status: "active", value: "320000", startOffset: -300, endOffset: 65, terms: "Annual compliance suite license with premium support. Covers all regulatory modules." },
  { name: "Data Migration Services - CloudFirst", type: "service", status: "completed", value: "95000", startOffset: -400, endOffset: -100, terms: "Fixed-scope data migration from legacy systems to cloud platform." },
  { name: "R&D Platform License - EuroTech", type: "license", status: "active", value: "280000", startOffset: -180, endOffset: 185, terms: "Annual R&D collaboration platform license. Includes API access and custom integrations." },
  { name: "Patient Management System - Atlantic Healthcare", type: "project", status: "active", value: "1200000", startOffset: -90, endOffset: 275, terms: "Multi-phase patient management system deployment. T&M with monthly cap." },
  { name: "Precision Engineering Tools - Swiss Precision", type: "license", status: "pending_renewal", value: "150000", startOffset: -350, endOffset: 15, terms: "Annual precision engineering toolset license. Renewal discussion pending." },
  { name: "Analytics Platform Subscription - DataStream", type: "subscription", status: "active", value: "72000", startOffset: -150, endOffset: 215, terms: "Annual analytics platform subscription. 95 user seats with premium data connectors." },
  { name: "Omnichannel Retail Suite - Pacific Retail", type: "license", status: "active", value: "560000", startOffset: -250, endOffset: 115, terms: "Enterprise retail suite covering POS, inventory, and customer analytics." },
  { name: "Consulting Services Framework - Apex", type: "framework", status: "draft", value: "200000", startOffset: 0, endOffset: 365, terms: "Framework agreement for ongoing consulting services. Rate card attached." },
  { name: "Digital Transformation MSA - Royal Insurance", type: "service", status: "in_review", value: "2500000", startOffset: 30, endOffset: 395, terms: "Master services agreement for 18-month digital transformation programme." },
];

const activitiesData = [
  { type: "call", subject: "Quarterly business review call", description: "Discussed Q4 performance metrics and renewal terms. Customer satisfied with platform stability. Agreed to expand license scope.", status: "completed", daysAgo: 2 },
  { type: "email", subject: "Proposal follow-up", description: "Sent updated pricing proposal with volume discount options. Awaiting CFO approval by end of week.", status: "completed", daysAgo: 1 },
  { type: "meeting", subject: "Product demo - Enterprise Suite", description: "Presented new Enterprise Suite features to stakeholder group. Strong interest in AI capabilities and workflow automation. Follow-up scheduled.", status: "completed", daysAgo: 5 },
  { type: "task", subject: "Prepare RFP response", description: "Draft comprehensive RFP response including technical architecture, pricing, and implementation timeline.", status: "pending", daysAgo: 0 },
  { type: "call", subject: "Technical requirements discovery", description: "Deep-dive into integration requirements with their IT team. Identified API compatibility needs and SSO requirements.", status: "completed", daysAgo: 7 },
  { type: "email", subject: "Contract renewal notice", description: "Sent 60-day renewal notice with updated terms and pricing for year 2. Highlighted new features included.", status: "completed", daysAgo: 3 },
  { type: "meeting", subject: "Strategic partnership discussion", description: "Explored partnership opportunities for APAC market. Agreed on joint go-to-market strategy for Q2.", status: "completed", daysAgo: 10 },
  { type: "call", subject: "Support escalation - Performance issue", description: "Customer reported performance degradation during peak hours. Escalated to engineering team. Fix deployed within 4 hours.", status: "completed", daysAgo: 4 },
  { type: "meeting", subject: "Architecture review session", description: "Reviewed proposed system architecture for Phase 2 implementation. Approved microservices approach.", status: "completed", daysAgo: 14 },
  { type: "email", subject: "New feature announcement", description: "Sent personalised feature announcement for AI-powered analytics module. Included exclusive early access offer.", status: "completed", daysAgo: 6 },
  { type: "task", subject: "Update CRM records after site visit", description: "Record all meeting notes, update contact details, and log new requirements discovered during Manchester site visit.", status: "completed", daysAgo: 8 },
  { type: "call", subject: "Budget planning discussion", description: "Discussed 2026 budget allocation for platform investment. Customer indicated 15% increase in IT spend.", status: "completed", daysAgo: 12 },
  { type: "meeting", subject: "Compliance audit preparation", description: "Pre-audit meeting to review compliance documentation and data handling procedures. All gaps addressed.", status: "completed", daysAgo: 20 },
  { type: "email", subject: "Case study collaboration request", description: "Invited customer to participate in joint case study. Customer interested, legal team reviewing NDA.", status: "completed", daysAgo: 15 },
  { type: "call", subject: "Upsell discussion - Analytics module", description: "Presented analytics module capabilities. Customer keen on predictive analytics feature. Sent trial access.", status: "completed", daysAgo: 9 },
  { type: "meeting", subject: "Executive sponsor check-in", description: "Monthly check-in with CTO. Discussed roadmap alignment and strategic value. Very positive sentiment.", status: "completed", daysAgo: 18 },
  { type: "task", subject: "Prepare competitive analysis", description: "Build comparison document for upcoming procurement evaluation. Include feature matrix and TCO analysis.", status: "pending", daysAgo: 0 },
  { type: "email", subject: "Training schedule confirmation", description: "Confirmed training schedule for 20 end users across 3 sessions. Materials to be sent 1 week prior.", status: "completed", daysAgo: 11 },
  { type: "call", subject: "Integration planning call", description: "Technical planning call for Salesforce-to-Jiganto data migration. Mapped 15 custom fields and 3 workflows.", status: "completed", daysAgo: 16 },
  { type: "meeting", subject: "Pilot programme kick-off", description: "Kicked off 90-day pilot programme with 50 users. Success criteria agreed: adoption rate > 80%, satisfaction > 4.2/5.", status: "completed", daysAgo: 25 },
  { type: "call", subject: "Renewal negotiation", description: "Multi-year renewal discussion. Customer requesting 3-year lock-in with 10% discount. Counter-offer prepared.", status: "completed", daysAgo: 3 },
  { type: "email", subject: "Invoice query resolution", description: "Resolved billing discrepancy from Q3. Credit note issued and payment schedule adjusted.", status: "completed", daysAgo: 22 },
  { type: "meeting", subject: "Innovation workshop", description: "Half-day innovation workshop exploring AI use cases for their industry. Generated 8 potential projects.", status: "completed", daysAgo: 30 },
  { type: "task", subject: "Send NDA for review", description: "Draft and send mutual NDA for data sharing agreement. Legal team to review within 5 business days.", status: "pending", daysAgo: 0 },
  { type: "call", subject: "Post-implementation review", description: "6-month post-implementation review. System uptime 99.7%. User adoption at 85%. Three enhancement requests logged.", status: "completed", daysAgo: 35 },
  { type: "email", subject: "Quarterly newsletter - personalised", description: "Sent Q1 personalised newsletter highlighting industry-specific insights and product updates relevant to their sector.", status: "completed", daysAgo: 28 },
  { type: "meeting", subject: "Board presentation preparation", description: "Helped CTO prepare board presentation on digital transformation ROI. Provided metrics and benchmarks.", status: "completed", daysAgo: 40 },
  { type: "call", subject: "New stakeholder introduction", description: "Introductory call with newly appointed VP of Operations. Briefed on current engagement and future roadmap.", status: "completed", daysAgo: 13 },
  { type: "task", subject: "Create custom demo environment", description: "Set up customised demo environment with industry-specific data and workflows for upcoming presentation.", status: "completed", daysAgo: 6 },
  { type: "email", subject: "Security audit documentation", description: "Sent SOC 2 Type II report and penetration test results as requested by their security team.", status: "completed", daysAgo: 19 },
  { type: "meeting", subject: "Data governance workshop", description: "Workshop on data governance framework setup. Defined data ownership, retention policies, and access controls.", status: "completed", daysAgo: 45 },
  { type: "call", subject: "Feature request deep-dive", description: "Detailed discussion on custom reporting requirements. Identified 5 report templates needed. Logging as feature requests.", status: "completed", daysAgo: 8 },
  { type: "email", subject: "Webinar invitation - Industry trends", description: "Invited key contacts to upcoming industry trends webinar featuring their peer companies as speakers.", status: "completed", daysAgo: 5 },
  { type: "task", subject: "Compile monthly engagement report", description: "Monthly engagement report covering usage metrics, support tickets, and satisfaction scores for executive review.", status: "completed", daysAgo: 1 },
  { type: "meeting", subject: "Change management planning", description: "Planned change management strategy for Phase 2 rollout. Defined communication plan and training schedule.", status: "completed", daysAgo: 21 },
];

const notesData = [
  { content: "[TAG:QBR Meeting][SENTIMENT:Positive] Excellent quarterly business review. Customer reported 30% productivity improvement since implementation. Expanding to 3 additional departments next quarter. Executive sponsor very engaged and championing internally.", daysAgo: 3 },
  { content: "[TAG:Discovery Call][SENTIMENT:Positive] Initial discovery call went very well. Strong alignment between their digital transformation strategy and our platform capabilities. Key pain points: manual reporting, siloed data, and lack of real-time visibility.", daysAgo: 7 },
  { content: "[TAG:Risk Alert][SENTIMENT:Watch] Competitor (Salesforce) has reached out to the CTO directly. Need to strengthen executive relationships and demonstrate unique value proposition. Schedule executive dinner ASAP.", daysAgo: 2 },
  { content: "[TAG:Contract Discussion][SENTIMENT:Positive] Renewal terms discussed and largely agreed. Customer requesting 3-year commitment with price protection. Finance team finalising approval. Expected signature within 2 weeks.", daysAgo: 5 },
  { content: "[TAG:Product Feedback][SENTIMENT:Watch] Customer raised concerns about mobile app performance on older Android devices. Their field team relies heavily on mobile access. Escalated to product team for Q2 sprint.", daysAgo: 10 },
  { content: "[TAG:Strategic Update][SENTIMENT:Positive] Customer approved budget for Phase 2 expansion including AI analytics module and advanced workflow automation. Total additional investment of approximately 350K.", daysAgo: 1 },
  { content: "[TAG:Technical Review][SENTIMENT:Positive] Passed security audit with zero critical findings. Customer compliance team impressed with our data encryption and access control capabilities. This strengthens the renewal position.", daysAgo: 14 },
  { content: "[TAG:Escalation][SENTIMENT:Negative] Unresolved integration issue with their legacy SAP system causing data sync delays. Customer frustrated with 3-week resolution timeline. Assigned senior engineer dedicated to fix.", daysAgo: 4 },
  { content: "[TAG:Relationship Building][SENTIMENT:Positive] Hosted customer at innovation lab. CTO very impressed with AI roadmap preview. Discussed potential co-development partnership for industry-specific features.", daysAgo: 20 },
  { content: "[TAG:Discovery Call][SENTIMENT:Watch] Promising initial conversation but budget constraints evident. They are exploring 3 vendors and decision timeline is 6 months. Need to stay engaged without being pushy.", daysAgo: 8 },
  { content: "[TAG:QBR Meeting][SENTIMENT:Positive] User adoption reached 92% across all departments. NPS score of 72. Three user-generated process improvements documented and shared with product team.", daysAgo: 30 },
  { content: "[TAG:Risk Alert][SENTIMENT:Negative] Key champion (VP of Digital) leaving the organisation. New replacement not yet identified. Risk of losing momentum on expansion plans. Need to build relationships with remaining stakeholders.", daysAgo: 6 },
  { content: "[TAG:Product Feedback][SENTIMENT:Positive] Customer submitted feature request for custom dashboard builder. Aligns with our Q3 roadmap. Shared early mockups and received enthusiastic feedback.", daysAgo: 12 },
  { content: "[TAG:Contract Discussion][SENTIMENT:Watch] Customer pushing for significant discount on multi-year deal. Our standard discount structure may not meet their expectations. Need to explore value-added services as alternative.", daysAgo: 9 },
  { content: "[TAG:Strategic Update][SENTIMENT:Positive] Selected as strategic technology partner for 2026-2028. Will be included in their digital roadmap presentations to the board. Significant reputational value.", daysAgo: 15 },
  { content: "[TAG:Technical Review][SENTIMENT:Positive] Completed performance benchmark testing. System handling 3x expected concurrent users with sub-200ms response times. Customer technical team very satisfied.", daysAgo: 25 },
  { content: "[TAG:Escalation][SENTIMENT:Watch] Minor billing discrepancy identified in Q4 invoice. Amount is small but customer finance team is meticulous. Issuing credit note immediately to maintain trust.", daysAgo: 11 },
  { content: "[TAG:Relationship Building][SENTIMENT:Positive] Invited customer to annual user conference as keynote speaker. They accepted and will present their digital transformation journey. Great PR opportunity.", daysAgo: 18 },
];

export async function seedCrmDemoData() {
  console.log("Starting CRM demo data seed...");

  const existingStages = await db.select().from(crmOpportunityStages).where(eq(crmOpportunityStages.tenantId, TENANT_ID));
  
  let stages: { id: number; name: string }[] = [];
  
  if (existingStages.length === 0) {
    for (const stage of opportunityStagesData) {
      const [created] = await db.insert(crmOpportunityStages).values({
        tenantId: TENANT_ID,
        ...stage,
      }).returning();
      stages.push({ id: created.id, name: created.name });
    }
    console.log(`Created ${stages.length} opportunity stages`);
  } else {
    stages = existingStages.map(s => ({ id: s.id, name: s.name }));
    console.log(`Using ${stages.length} existing opportunity stages`);
  }

  const getStageId = (stageName: string) => {
    const stage = stages.find(s => s.name === stageName);
    return stage?.id;
  };

  const existingAccounts = await db.select().from(crmAccounts).where(eq(crmAccounts.tenantId, TENANT_ID));
  let allAccountIds: number[] = [];
  let customerAccountIds: number[] = [];
  let prospectAccountIds: number[] = [];

  if (existingAccounts.length > 0) {
    allAccountIds = existingAccounts.map(a => a.id);
    customerAccountIds = existingAccounts.filter(a => a.type === "customer").map(a => a.id);
    prospectAccountIds = existingAccounts.filter(a => a.type === "prospect").map(a => a.id);
    console.log(`Using ${allAccountIds.length} existing accounts (${customerAccountIds.length} customers, ${prospectAccountIds.length} prospects)`);
  } else {
    console.log("Creating customer accounts...");
    for (const customer of existingCustomers) {
      const [account] = await db.insert(crmAccounts).values({
        tenantId: TENANT_ID,
        type: "customer",
        ...customer,
      }).returning();
      customerAccountIds.push(account.id);
    }

    console.log("Creating prospect accounts...");
    for (const prospect of prospectAccounts) {
      const [account] = await db.insert(crmAccounts).values({
        tenantId: TENANT_ID,
        type: "prospect",
        ...prospect,
      }).returning();
      prospectAccountIds.push(account.id);
    }
    allAccountIds = [...customerAccountIds, ...prospectAccountIds];
    console.log(`Created ${allAccountIds.length} accounts`);
  }

  const existingContactsList = await db.select().from(crmContacts).where(eq(crmContacts.tenantId, TENANT_ID));
  const contactIdsByAccount: Map<number, number[]> = new Map();

  if (existingContactsList.length > 0) {
    for (const c of existingContactsList) {
      if (c.accountId) {
        if (!contactIdsByAccount.has(c.accountId)) contactIdsByAccount.set(c.accountId, []);
        contactIdsByAccount.get(c.accountId)!.push(c.id);
      }
    }
    console.log(`Using ${existingContactsList.length} existing contacts`);
  } else {
    console.log("Creating contacts...");
    let contactCount = 0;
    for (const accountId of allAccountIds) {
      const accountContactIds: number[] = [];
      for (let i = 0; i < 3; i++) {
        const template = contactTemplates[i];
        const randFirst = pick(template.firstNames);
        const randLast = pick(template.lastNames);
        const randTitle = pick(template.titles);
        const randDept = pick(template.departments);
        const [contact] = await db.insert(crmContacts).values({
          tenantId: TENANT_ID,
          accountId,
          firstName: randFirst,
          lastName: randLast,
          email: `${randFirst.toLowerCase()}.${randLast.toLowerCase()}@example.com`,
          phone: `+1-${randBetween(100,999)}-${randBetween(100,999)}-${randBetween(1000,9999)}`,
          title: randTitle,
          department: randDept,
          role: i === 0 ? "decision_maker" : i === 1 ? "influencer" : "contact",
          isPrimary: i === 0,
        }).returning();
        accountContactIds.push(contact.id);
        contactCount++;
      }
      contactIdsByAccount.set(accountId, accountContactIds);
    }
    console.log(`Created ${contactCount} contacts`);
  }

  const existingOpps = await db.select().from(crmOpportunities).where(eq(crmOpportunities.tenantId, TENANT_ID));
  let opportunityIds: number[] = [];

  if (existingOpps.length > 0) {
    opportunityIds = existingOpps.map(o => o.id);
    console.log(`Using ${existingOpps.length} existing opportunities`);
  } else {
    console.log("Creating opportunities...");
    for (let i = 0; i < opportunityData.length; i++) {
      const oppData = opportunityData[i];
      const accountId = prospectAccountIds[i % prospectAccountIds.length];
      const contactIds = contactIdsByAccount.get(accountId) || [];
      const primaryContactId = contactIds[0];
      const [opp] = await db.insert(crmOpportunities).values({
        tenantId: TENANT_ID,
        accountId,
        contactId: primaryContactId,
        stageId: getStageId(oppData.stage),
        name: oppData.name,
        description: `Opportunity for ${oppData.name}`,
        amount: oppData.amount,
        probability: oppData.probability,
        type: oppData.type,
        source: pick(["Website", "Referral", "Partner", "Event", "Cold Call"]),
        ownerUserId: repOwners[i % repOwners.length],
        expectedCloseDate: quarterCloseDate(new Date().getFullYear(), (i % 4) + 1),
      }).returning();
      opportunityIds.push(opp.id);
    }
    console.log(`Created ${opportunityIds.length} opportunities`);
  }

  // Spread close dates and owners across quarters so period filters show varied demo data
  const oppsForForecast = await db.select().from(crmOpportunities).where(eq(crmOpportunities.tenantId, TENANT_ID));
  const forecastYear = new Date().getFullYear();
  for (let i = 0; i < oppsForForecast.length; i++) {
    const opp = oppsForForecast[i];
    await db.update(crmOpportunities).set({
      ownerUserId: opp.ownerUserId || repOwners[i % repOwners.length],
      expectedCloseDate: quarterCloseDate(forecastYear, (i % 4) + 1),
    }).where(eq(crmOpportunities.id, opp.id));
  }
  if (oppsForForecast.length > 0) {
    console.log(`Enriched ${oppsForForecast.length} opportunities for forecasting (owners + quarter close dates)`);
  }

  // === OPPORTUNITY RESOURCE PLANS (for CRM Resource Plan tab) ===
  const existingResourcePlans = await db.select().from(opportunityResourcePlans).where(eq(opportunityResourcePlans.tenantId, TENANT_ID));
  if (existingResourcePlans.length === 0) {
    const tenantStages = await db.select().from(crmOpportunityStages).where(eq(crmOpportunityStages.tenantId, TENANT_ID));
    const closedStageIds = new Set(tenantStages.filter((s) => s.isClosed).map((s) => s.id));
    const openOpps = oppsForForecast.filter((o) => !o.stageId || !closedStageIds.has(o.stageId)).slice(0, 8);

    const planRoles = [
      { phase: "Discovery", roleName: "Project Manager", daysPerWeek: "5", dailyRate: "950", weeks: 4 },
      { phase: "Discovery", roleName: "Solution Architect", daysPerWeek: "4", dailyRate: "1050", weeks: 3 },
      { phase: "Build", roleName: "Business Analyst", daysPerWeek: "5", dailyRate: "700", weeks: 8 },
      { phase: "Build", roleName: "Developer", daysPerWeek: "5", dailyRate: "750", weeks: 10 },
      { phase: "UAT", roleName: "Test Manager", daysPerWeek: "5", dailyRate: "800", weeks: 4 },
    ];

    let planCount = 0;
    for (const opp of openOpps) {
      const start = daysFromNow(14 + planCount * 7);
      const [plan] = await db.insert(opportunityResourcePlans).values({
        tenantId: TENANT_ID,
        opportunityId: opp.id,
        planName: `${opp.name} — Baseline`,
        templateName: "CRM Demo",
        currency: "GBP",
        notes: "Demo resource plan seeded for CRM Resource Plan tab",
      }).returning();

      let cursor = new Date(start);
      for (let i = 0; i < planRoles.length; i++) {
        const role = planRoles[i];
        const rowStart = new Date(cursor);
        const rowEnd = new Date(cursor);
        rowEnd.setDate(rowEnd.getDate() + role.weeks * 7);
        await db.insert(opportunityResourceRows).values({
          planId: plan.id,
          phase: role.phase,
          roleName: role.roleName,
          namedResourceLabel: role.roleName,
          startDate: rowStart,
          endDate: rowEnd,
          daysPerWeek: role.daysPerWeek,
          dailyRate: role.dailyRate,
          discountPercent: "0",
          status: i < 2 ? "Confirmed" : "Proposed",
          sortOrder: i,
          breaks: [],
          weekOverrides: {},
        });
        cursor = new Date(rowEnd);
        cursor.setDate(cursor.getDate() + 1);
      }
      planCount++;
    }
    console.log(`Created ${planCount} opportunity resource plans with staffing rows`);
  } else {
    console.log(`Skipping resource plans — already have ${existingResourcePlans.length}`);
  }

  // === PIPELINES (before contracts — links stages to pipelines for matrix filtering) ===
  const existingPipelines = await db.select().from(crmPipelines).where(eq(crmPipelines.tenantId, TENANT_ID));
  if (existingPipelines.length === 0) {
    console.log("Creating pipelines...");
    const pipelineData = [
      { name: "Enterprise Sales", description: "Pipeline for enterprise-level deals above 100K", isDefault: true, color: "#3b82f6" },
      { name: "SMB Pipeline", description: "Small and medium business deals", isDefault: false, color: "#22c55e" },
      { name: "Partner Channel", description: "Deals sourced through partner network", isDefault: false, color: "#8b5cf6" },
    ];
    for (const p of pipelineData) {
      await db.insert(crmPipelines).values({ tenantId: TENANT_ID, ...p });
    }
    console.log(`Created ${pipelineData.length} pipelines`);
  }

  const allPipelines = await db.select().from(crmPipelines).where(eq(crmPipelines.tenantId, TENANT_ID));
  const defaultPipeline = allPipelines.find((p) => p.isDefault) ?? allPipelines[0];
  const smbPipeline = allPipelines.find((p) => p.name === "SMB Pipeline");
  const partnerPipeline = allPipelines.find((p) => p.name === "Partner Channel");

  if (defaultPipeline) {
    const tenantStages = await db.select().from(crmOpportunityStages).where(eq(crmOpportunityStages.tenantId, TENANT_ID));
    for (const stage of tenantStages) {
      if (stage.pipelineId == null) {
        await db.update(crmOpportunityStages)
          .set({ pipelineId: defaultPipeline.id })
          .where(eq(crmOpportunityStages.id, stage.id));
      }
    }

    const ensurePipelineStages = async (
      pipelineId: number,
      prefix: string,
      stageTemplates: typeof opportunityStagesData,
    ) => {
      const currentStages = await db.select().from(crmOpportunityStages).where(eq(crmOpportunityStages.tenantId, TENANT_ID));
      const existing = currentStages.filter((s) => s.pipelineId === pipelineId);
      if (existing.length > 0) return existing.map((s) => ({ id: s.id, name: s.name }));
      const created: { id: number; name: string }[] = [];
      for (const stage of stageTemplates) {
        const [row] = await db.insert(crmOpportunityStages).values({
          tenantId: TENANT_ID,
          pipelineId,
          ...stage,
          name: `${prefix}${stage.name}`,
        }).returning();
        created.push({ id: row.id, name: row.name });
      }
      return created;
    };

    const smbStages = smbPipeline
      ? await ensurePipelineStages(smbPipeline.id, "SMB — ", opportunityStagesData.filter((s) => !s.isClosed).slice(0, 4))
      : [];
    const partnerStages = partnerPipeline
      ? await ensurePipelineStages(partnerPipeline.id, "Partner — ", opportunityStagesData.filter((s) => !s.isClosed).slice(0, 4))
      : [];

    const smbStageIds = new Set(smbStages.map((s) => s.id));
    const partnerStageIds = new Set(partnerStages.map((s) => s.id));
    const allOpps = await db.select().from(crmOpportunities).where(eq(crmOpportunities.tenantId, TENANT_ID));
    for (let i = 0; i < allOpps.length; i++) {
      const opp = allOpps[i];
      if (smbStageIds.has(opp.stageId ?? -1) || partnerStageIds.has(opp.stageId ?? -1)) continue;
      let targetStageId: number | undefined;
      if (i % 3 === 1 && smbStages.length > 0) {
        targetStageId = smbStages[i % smbStages.length]?.id;
      } else if (i % 3 === 2 && partnerStages.length > 0) {
        targetStageId = partnerStages[i % partnerStages.length]?.id;
      }
      if (targetStageId) {
        await db.update(crmOpportunities)
          .set({ stageId: targetStageId })
          .where(eq(crmOpportunities.id, opp.id));
      }
    }
    console.log("Linked CRM stages to pipelines for forecast matrix filtering");
  }

  // === LEADS ===
  const existingLeadsList = await db.select().from(crmLeads).where(eq(crmLeads.tenantId, TENANT_ID));
  if (existingLeadsList.length < 5) {
    console.log("Creating leads...");
    let leadCount = 0;
    for (const lead of leadsData) {
      await db.insert(crmLeads).values({
        tenantId: TENANT_ID,
        ...lead,
        createdAt: daysAgo(randBetween(1, 60)),
      });
      leadCount++;
    }
    console.log(`Created ${leadCount} leads`);
  } else {
    console.log(`Skipping leads - already have ${existingLeadsList.length}`);
  }

  // === CONTRACTS ===
  const existingContractsList = await db.select().from(crmContracts).where(eq(crmContracts.tenantId, TENANT_ID));
  if (existingContractsList.length < 5) {
    console.log("Creating contracts...");
    let contractCount = 0;
    for (let i = 0; i < contractsData.length; i++) {
      const cData = contractsData[i];
      const accountId = i < customerAccountIds.length ? customerAccountIds[i] : customerAccountIds[i % customerAccountIds.length];
      const contactIds = contactIdsByAccount.get(accountId) || [];
      const signedContactId = contactIds[0];
      const oppId = i < opportunityIds.length ? opportunityIds[i] : undefined;
      
      await db.insert(crmContracts).values({
        tenantId: TENANT_ID,
        accountId,
        opportunityId: oppId,
        name: cData.name,
        type: cData.type,
        status: cData.status,
        value: cData.value,
        startDate: daysAgo(-cData.startOffset),
        endDate: daysAgo(-cData.endOffset),
        terms: cData.terms,
        signedByContactId: cData.status !== "draft" && cData.status !== "in_review" ? signedContactId : undefined,
        signedDate: cData.status === "active" || cData.status === "completed" ? daysAgo(-cData.startOffset + 5) : undefined,
      });
      contractCount++;
    }
    console.log(`Created ${contractCount} contracts`);
  } else {
    console.log(`Skipping contracts - already have ${existingContractsList.length}`);
  }

  // === ACTIVITIES ===
  const existingActivitiesList = await db.select().from(crmActivities).where(eq(crmActivities.tenantId, TENANT_ID));
  if (existingActivitiesList.length < 10) {
    console.log("Creating activities...");
    let activityCount = 0;
    for (let i = 0; i < activitiesData.length; i++) {
      const aData = activitiesData[i];
      const accountId = allAccountIds[i % allAccountIds.length];
      const contactIds = contactIdsByAccount.get(accountId) || [];
      const contactId = contactIds.length > 0 ? pick(contactIds) : undefined;
      
      await db.insert(crmActivities).values({
        tenantId: TENANT_ID,
        type: aData.type,
        subject: aData.subject,
        description: aData.description,
        status: aData.status,
        priority: pick(["low", "normal", "high"]),
        accountId,
        contactId,
        opportunityId: i < opportunityIds.length ? opportunityIds[i % opportunityIds.length] : undefined,
        dueDate: aData.status === "pending" ? daysFromNow(randBetween(1, 14)) : undefined,
        completedAt: aData.status === "completed" ? daysAgo(aData.daysAgo) : undefined,
        createdAt: daysAgo(aData.daysAgo + randBetween(0, 2)),
      });
      activityCount++;
    }
    console.log(`Created ${activityCount} activities`);
  } else {
    console.log(`Skipping activities - already have ${existingActivitiesList.length}`);
  }

  // === NOTES ===
  const existingNotesList = await db.select().from(crmNotes).where(eq(crmNotes.tenantId, TENANT_ID));
  if (existingNotesList.length < 5) {
    console.log("Creating notes...");
    let noteCount = 0;
    for (let i = 0; i < notesData.length; i++) {
      const nData = notesData[i];
      const accountId = allAccountIds[i % allAccountIds.length];
      
      await db.insert(crmNotes).values({
        tenantId: TENANT_ID,
        entityType: "account",
        entityId: accountId,
        content: nData.content,
        createdByUserId: pick(["Sales Manager", "Account Executive", "Customer Success", "Solutions Architect", "VP of Sales"]),
        createdAt: daysAgo(nData.daysAgo),
      });
      noteCount++;
    }
    console.log(`Created ${noteCount} notes`);
  } else {
    console.log(`Skipping notes - already have ${existingNotesList.length}`);
  }

  // === EMAIL CORRESPONDENCE (demo logs for account detail) ===
  const existingEmailLogs = await db.select().from(crmEmailLogs).where(eq(crmEmailLogs.tenantId, TENANT_ID));
  if (existingEmailLogs.length === 0 && allAccountIds.length > 0) {
    console.log("Creating CRM email correspondence logs...");
    const sampleAccountId = allAccountIds[0];
    const sampleContactId = contactIdsByAccount.get(sampleAccountId)?.[0];
    const demoEmails: Array<{
      entityType: "account" | "contact";
      entityId: number;
      recipientEmail: string;
      subject: string;
      body: string;
      status: string;
      daysAgo: number;
    }> = [
      {
        entityType: "account" as const,
        entityId: sampleAccountId,
        recipientEmail: "info@techflow.com",
        subject: "Re: Q2 platform renewal discussion",
        body: "Thanks for the proposal summary. Our team will review pricing options and revert by Friday.",
        status: "opened",
        daysAgo: 3,
      },
      {
        entityType: "account" as const,
        entityId: sampleAccountId,
        recipientEmail: "procurement@techflow.com",
        subject: "Follow-up: Enterprise licence expansion",
        body: "Attaching the updated scope document for 250 additional seats as discussed on our call.",
        status: "sent",
        daysAgo: 7,
      },
    ];
    if (sampleContactId) {
      demoEmails.push({
        entityType: "contact" as const,
        entityId: sampleContactId,
        recipientEmail: "j.smith@example.com",
        subject: "Meeting notes — technical discovery",
        body: "Summary of SSO and audit log requirements captured during yesterday's workshop.",
        status: "sent",
        daysAgo: 5,
      });
    }
    for (const e of demoEmails) {
      await db.insert(crmEmailLogs).values({
        tenantId: TENANT_ID,
        entityType: e.entityType,
        entityId: e.entityId,
        recipientEmail: e.recipientEmail,
        subject: e.subject,
        body: e.body,
        status: e.status,
        sentByUserId: "Account Executive",
        sentAt: daysAgo(e.daysAgo),
      });
    }
    console.log(`Created ${demoEmails.length} email correspondence logs`);
  }

  // === FORECASTS ===
  const existingForecastsList = await db.select().from(crmForecasts).where(eq(crmForecasts.tenantId, TENANT_ID));
  if (existingForecastsList.length < 3) {
    console.log("Creating forecasts...");
    const now = new Date();
    const currentQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const currentQuarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
    const nextQuarterStart = new Date(currentQuarterEnd);
    nextQuarterStart.setDate(nextQuarterStart.getDate() + 1);
    const nextQuarterEnd = new Date(nextQuarterStart.getFullYear(), nextQuarterStart.getMonth() + 3, 0);
    const prevQuarterEnd = new Date(currentQuarterStart);
    prevQuarterEnd.setDate(prevQuarterEnd.getDate() - 1);
    const prevQuarterStart = new Date(prevQuarterEnd.getFullYear(), prevQuarterEnd.getMonth() - 2, 1);

    const forecastEntries = [
      { userId: "Sales Manager", period: "quarterly", start: prevQuarterStart, end: prevQuarterEnd, quota: "2000000", forecast: "1850000", closed: "1780000", pipeline: "0", weighted: "1780000", notes: "Strong quarter. Exceeded target by 5% despite two deal slippages." },
      { userId: "Sales Manager", period: "quarterly", start: currentQuarterStart, end: currentQuarterEnd, quota: "2200000", forecast: "2100000", closed: "950000", pipeline: "3500000", weighted: "1680000", notes: "On track for target. Key deals in negotiation stage expected to close within 4 weeks." },
      { userId: "Sales Manager", period: "quarterly", start: nextQuarterStart, end: nextQuarterEnd, quota: "2500000", forecast: "2300000", closed: "0", pipeline: "4200000", weighted: "1260000", notes: "Pipeline building well. Several enterprise prospects in qualification." },
      { userId: "Account Executive", period: "quarterly", start: prevQuarterStart, end: prevQuarterEnd, quota: "1500000", forecast: "1400000", closed: "1520000", pipeline: "0", weighted: "1520000", notes: "Exceeded quota. Closed Royal Insurance framework deal ahead of schedule." },
      { userId: "Account Executive", period: "quarterly", start: currentQuarterStart, end: currentQuarterEnd, quota: "1600000", forecast: "1500000", closed: "680000", pipeline: "2800000", weighted: "1120000", notes: "Good pipeline. Need to accelerate 3 deals in proposal stage." },
      { userId: "Account Executive", period: "quarterly", start: nextQuarterStart, end: nextQuarterEnd, quota: "1800000", forecast: "1650000", closed: "0", pipeline: "3100000", weighted: "930000", notes: "Building pipeline through partner channel. Two large enterprise prospects expected." },
      { userId: "Solutions Architect", period: "quarterly", start: currentQuarterStart, end: currentQuarterEnd, quota: "800000", forecast: "750000", closed: "320000", pipeline: "1500000", weighted: "600000", notes: "Technical wins driving pipeline. Demo conversion rate at 65%." },
      { userId: "VP of Sales", period: "quarterly", start: currentQuarterStart, end: currentQuarterEnd, quota: "5000000", forecast: "4800000", closed: "2100000", pipeline: "8500000", weighted: "3800000", notes: "Team performing well. Enterprise segment leading growth. Need to address SMB pipeline gap." },
    ];

    for (const f of forecastEntries) {
      await db.insert(crmForecasts).values({
        tenantId: TENANT_ID,
        userId: f.userId,
        forecastPeriod: f.period,
        periodStart: f.start,
        periodEnd: f.end,
        quotaAmount: f.quota,
        forecastAmount: f.forecast,
        closedAmount: f.closed,
        pipelineAmount: f.pipeline,
        weightedAmount: f.weighted,
        notes: f.notes,
      });
    }
    console.log(`Created ${forecastEntries.length} forecast entries`);
  } else {
    console.log(`Skipping forecasts - already have ${existingForecastsList.length}`);
  }

  const finalCounts = await Promise.all([
    db.select({ count: sql`count(*)` }).from(crmAccounts).where(eq(crmAccounts.tenantId, TENANT_ID)),
    db.select({ count: sql`count(*)` }).from(crmContacts).where(eq(crmContacts.tenantId, TENANT_ID)),
    db.select({ count: sql`count(*)` }).from(crmLeads).where(eq(crmLeads.tenantId, TENANT_ID)),
    db.select({ count: sql`count(*)` }).from(crmOpportunities).where(eq(crmOpportunities.tenantId, TENANT_ID)),
    db.select({ count: sql`count(*)` }).from(crmContracts).where(eq(crmContracts.tenantId, TENANT_ID)),
    db.select({ count: sql`count(*)` }).from(crmActivities).where(eq(crmActivities.tenantId, TENANT_ID)),
    db.select({ count: sql`count(*)` }).from(crmNotes).where(eq(crmNotes.tenantId, TENANT_ID)),
    db.select({ count: sql`count(*)` }).from(crmForecasts).where(eq(crmForecasts.tenantId, TENANT_ID)),
  ]);

  console.log("\n=== CRM Demo Data Seed Complete ===");
  console.log(`- Accounts: ${finalCounts[0][0].count}`);
  console.log(`- Contacts: ${finalCounts[1][0].count}`);
  console.log(`- Leads: ${finalCounts[2][0].count}`);
  console.log(`- Opportunities: ${finalCounts[3][0].count}`);
  console.log(`- Contracts: ${finalCounts[4][0].count}`);
  console.log(`- Activities: ${finalCounts[5][0].count}`);
  console.log(`- Notes: ${finalCounts[6][0].count}`);
  console.log(`- Forecasts: ${finalCounts[7][0].count}`);

  return {
    accounts: Number(finalCounts[0][0].count),
    contacts: Number(finalCounts[1][0].count),
    leads: Number(finalCounts[2][0].count),
    opportunities: Number(finalCounts[3][0].count),
    contracts: Number(finalCounts[4][0].count),
    activities: Number(finalCounts[5][0].count),
    notes: Number(finalCounts[6][0].count),
    forecasts: Number(finalCounts[7][0].count),
  };
}

const isDirectRun = process.argv[1]?.includes("seed-crm-demo");
if (isDirectRun) {
  seedCrmDemoData()
    .then((counts) => {
      console.log("\nSeed completed successfully!", counts);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
