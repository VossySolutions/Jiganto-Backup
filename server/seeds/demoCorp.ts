import { db } from "../db";
import { 
  strategyItems, risks, departments, processes, tools, 
  goals, objectives, initiatives, okrs, keyResults, kpis, businessTasks, meetings, documentLinks 
} from "@shared/models/business";
import { documents, documentFolders, documentInitiativeLinks } from "@shared/models/documents";
import { pmPortfolios, pmPrograms, pmProjects, pmProjectPhases, pmTasks, pmBacklogItems, pmWorkstreams, pmSprints, pmMilestones, pmTeamMembers, pmRaiddItems, pmBusinessRequirements, pmRaciAssignments, pmRaciActivities, pmRaciRoles } from "@shared/models/projects";
import { eq } from "drizzle-orm";

export async function seedDemoCorpData(tenantId: number) {
  const today = new Date();
  const nextQuarter = new Date(today);
  nextQuarter.setMonth(nextQuarter.getMonth() + 3);
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const endOfYear = new Date(today.getFullYear(), 11, 31);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  // ============================================
  // 1. STRATEGY ITEMS - Jiganto Platform Launch
  // ============================================

  const strategyData = [
    {
      tenantId,
      templateType: "vision",
      title: "Jiganto Platform Vision 2026",
      description: "To become the leading AI-native enterprise platform, empowering organisations with a modular, intelligent solution for project, document, finance, and resource management.",
      content: {
        mission: "Empowering enterprises with an AI-native, modular platform that accelerates business outcomes through intelligent automation and conversational UI",
        values: ["Innovation", "Modularity", "Intelligence", "Security", "Customer Success"],
        targetState: "By end of 2026, Jiganto will be the trusted AI-native enterprise platform for 100+ organisations, with a validated product-market fit across multiple industry verticals.",
        keyPillars: [
          "Product Platform Strategy",
          "Market Entry Strategy",
          "Technology Strategy",
          "Commercial Strategy",
          "Ecosystem Strategy",
          "Trust & Compliance Strategy"
        ]
      },
      status: "in_progress",
      ragStatus: "amber",
      progress: 35,
      trend: "improving",
      reviewCadence: "monthly"
    },
    {
      tenantId,
      templateType: "target_market",
      title: "Jiganto Target Market Analysis",
      description: "Analysis of target market segments and ideal customer profiles for the Jiganto platform launch.",
      content: {
        primarySegments: [
          "Professional Services Firms (50-500 employees)",
          "System Integrators & IT Consultancies",
          "Software Development Companies",
          "Mid-Market Enterprises seeking digital transformation"
        ],
        idealCustomerProfile: "Organisations with 50-500 knowledge workers who need integrated project, document, and resource management with AI-powered automation. Budget authority for enterprise software, existing pain with fragmented tooling.",
        geographicFocus: "UK primary, Europe secondary, North America tertiary",
        buyerPersonas: [
          "CTO/CIO - Technology decision maker seeking modern, AI-native solutions",
          "COO - Operations leader looking to streamline processes",
          "VP Engineering - Technical buyer evaluating development and project tools",
          "Head of PMO - Programme management leader needing portfolio visibility"
        ],
        marketSize: "TAM: $15B enterprise work management, SAM: $3B AI-native platforms, SOM: $150M first 3 years"
      },
      status: "on_track",
      ragStatus: "green",
      progress: 70
    },
    {
      tenantId,
      templateType: "competitor_analysis",
      title: "Jiganto Competitive Landscape",
      description: "Analysis of key competitors in the AI-native enterprise platform space.",
      content: {
        competitors: [
          { name: "Monday.com", strengths: "Strong brand, visual UI, marketplace", weaknesses: "Limited AI depth, not truly modular, high per-seat cost" },
          { name: "Asana", strengths: "Project management depth, integrations", weaknesses: "No document management, limited AI, no CRM" },
          { name: "ServiceNow", strengths: "Enterprise scale, ITSM leadership", weaknesses: "Complex, expensive, long implementation cycles" },
          { name: "Atlassian (Jira + Confluence)", strengths: "Developer ecosystem, documentation", weaknesses: "Fragmented products, weak AI, complex administration" },
          { name: "Notion", strengths: "Flexible docs, modern UX, AI features", weaknesses: "Not enterprise-ready, no project management depth, no CRM" }
        ],
        differentiators: [
          "AI-native with Conversational UI (CUI) across all modules",
          "12 integrated modules in one platform vs. point solutions",
          "Multi-tenant with data residency and enterprise security",
          "Rapid deployment with pre-configured industry templates",
          "Multi-region and multi-language support out of the box"
        ]
      },
      status: "on_track",
      ragStatus: "green",
      progress: 80
    },
    {
      tenantId,
      templateType: "swot",
      title: "Jiganto SWOT Analysis",
      description: "Strengths, Weaknesses, Opportunities, and Threats analysis for Jiganto platform launch.",
      content: {
        strengths: [
          "AI-native architecture with CUI from day one",
          "12 integrated modules covering full enterprise workflow",
          "Modern tech stack (React, TypeScript, PostgreSQL)",
          "Multi-tenant with built-in data residency",
          "Flexible deployment model"
        ],
        weaknesses: [
          "Pre-revenue stage with limited market validation",
          "Small team relative to competitors",
          "Brand recognition not yet established",
          "Limited customer references for enterprise sales"
        ],
        opportunities: [
          "Growing demand for AI-native enterprise tools",
          "Market fatigue with fragmented point solutions",
          "Enterprise need for data sovereignty and compliance",
          "Underserved mid-market segment",
          "Partnership opportunities with system integrators"
        ],
        threats: [
          "Well-funded competitors adding AI capabilities",
          "Economic uncertainty delaying enterprise purchasing",
          "Rapid AI technology evolution requiring constant adaptation",
          "Regulatory complexity across target markets"
        ]
      },
      status: "on_track",
      ragStatus: "green",
      progress: 90
    },
    {
      tenantId,
      templateType: "strategic_risks",
      title: "Jiganto Strategic Risks",
      description: "Key strategic risks to the Jiganto platform launch and mitigation strategies.",
      content: {
        riskCategories: ["Market Risk", "Technology Risk", "Financial Risk", "Talent Risk", "Competitive Risk"],
        riskAppetite: "Moderate - willing to take calculated risks on technology and market entry, conservative on security and compliance",
        reviewFrequency: "Monthly risk review with quarterly board updates"
      },
      status: "on_track",
      ragStatus: "amber",
      progress: 60
    }
  ];

  const insertedStrategy = await db.insert(strategyItems).values(strategyData).returning();

  // ============================================
  // 2. RISKS
  // ============================================

  const strategicRisksItem = insertedStrategy.find(s => s.templateType === "strategic_risks");

  const risksData = [
    {
      tenantId,
      strategyItemId: strategicRisksItem?.id,
      type: "risk",
      title: "Market adoption slower than projected",
      description: "Enterprise customers may delay purchasing decisions due to economic uncertainty or preference for established vendors, extending sales cycles.",
      likelihood: "medium",
      impact: "high",
      mitigation: "Implement freemium tier, offer extended pilots, build lighthouse client references early, target early adopters who are actively seeking innovation.",
      status: "open"
    },
    {
      tenantId,
      strategyItemId: strategicRisksItem?.id,
      type: "risk",
      title: "Key engineering talent departure",
      description: "Risk of losing critical engineering talent to larger tech companies offering higher compensation, impacting platform development velocity.",
      likelihood: "medium",
      impact: "high",
      mitigation: "Implement competitive equity packages, create strong engineering culture, provide technical leadership growth paths, maintain knowledge documentation.",
      status: "open"
    },
    {
      tenantId,
      strategyItemId: strategicRisksItem?.id,
      type: "risk",
      title: "AI technology disruption",
      description: "Rapid evolution of LLM and AI technologies may require significant architecture changes or make current approach obsolete.",
      likelihood: "medium",
      impact: "medium",
      mitigation: "Design AI layer as pluggable abstraction, maintain vendor-agnostic approach, invest in AI research team, monitor emerging models continuously.",
      status: "open"
    },
    {
      tenantId,
      strategyItemId: strategicRisksItem?.id,
      type: "risk",
      title: "Regulatory compliance complexity",
      description: "GDPR, SOC2, and ISO certification requirements may be more complex and time-consuming than anticipated, delaying enterprise sales.",
      likelihood: "high",
      impact: "medium",
      mitigation: "Engage compliance consultants early, build security into architecture from day one, begin certification process in parallel with development.",
      status: "open"
    },
    {
      tenantId,
      strategyItemId: strategicRisksItem?.id,
      type: "risk",
      title: "Competitive pressure from incumbents",
      description: "Established players like Monday.com, ServiceNow, and Atlassian may accelerate AI features, reducing Jiganto's differentiation window.",
      likelihood: "high",
      impact: "high",
      mitigation: "Focus on deep AI integration (CUI) that incumbents cannot easily replicate, build switching costs through integrated modules, move fast on market entry.",
      status: "open"
    },
    {
      tenantId,
      strategyItemId: strategicRisksItem?.id,
      type: "assumption",
      title: "Enterprise willingness to adopt AI-native platforms",
      description: "Assumption that enterprises are ready to move from traditional tools to AI-native platforms with conversational interfaces.",
      likelihood: "high",
      impact: "high",
      mitigation: "Validate through early adopter programme, offer hybrid mode (traditional + CUI), gather feedback continuously.",
      status: "open"
    }
  ];

  await db.insert(risks).values(risksData);

  // ============================================
  // 3. DEPARTMENTS
  // ============================================

  const departmentsData = [
    { tenantId, name: "Engineering", description: "Platform development, architecture, DevOps, and quality assurance. Responsible for building and maintaining the Jiganto platform." },
    { tenantId, name: "Product Management", description: "Product strategy, roadmap, requirements, and user research. Owns the Jiganto product vision and module prioritisation." },
    { tenantId, name: "Sales & Marketing", description: "Go-to-market, demand generation, enterprise sales, and brand building. Drives customer acquisition and market awareness." },
    { tenantId, name: "Customer Success", description: "Customer onboarding, adoption, support, and expansion. Ensures customers achieve value with Jiganto." },
    { tenantId, name: "Professional Services", description: "Implementation consulting, solution architecture, and training delivery. Supports enterprise deployments." },
    { tenantId, name: "Partner Ecosystem", description: "Partner recruitment, enablement, and marketplace management. Builds the Jiganto integration and partner network." },
    { tenantId, name: "Security & Compliance", description: "Information security, data protection, regulatory compliance, and audit management. Ensures enterprise-grade trust." },
    { tenantId, name: "Finance & Operations", description: "Financial planning, billing operations, legal, and HR. Manages business operations and commercial strategy." }
  ];

  const insertedDepartments = await db.insert(departments).values(departmentsData).returning();
  const deptMap = Object.fromEntries(insertedDepartments.map(d => [d.name, d.id]));

  // ============================================
  // 4. PROCESSES
  // ============================================

  const processesData = [
    { tenantId, departmentId: deptMap["Engineering"], name: "Agile Development", description: "Two-week sprint cycles with daily standups, sprint planning, and retrospectives for all platform modules.", status: "active", isCritical: true },
    { tenantId, departmentId: deptMap["Engineering"], name: "CI/CD Pipeline", description: "Automated build, test, and deployment pipeline for staging and production environments.", status: "active", isCritical: true },
    { tenantId, departmentId: deptMap["Engineering"], name: "Security Development Lifecycle", description: "Security review gates at design, development, and release stages for all platform components.", status: "active", isCritical: true },
    { tenantId, departmentId: deptMap["Product Management"], name: "Product Discovery", description: "Continuous discovery through user interviews, analytics, and early adopter feedback loops.", status: "active", isCritical: true },
    { tenantId, departmentId: deptMap["Product Management"], name: "Roadmap Planning", description: "Quarterly roadmap planning with input from sales, customers, and engineering capacity.", status: "active", isCritical: false },
    { tenantId, departmentId: deptMap["Sales & Marketing"], name: "Early Adopter Pipeline", description: "LOI generation, pilot onboarding, and conversion tracking for early adopter programme.", status: "active", isCritical: true },
    { tenantId, departmentId: deptMap["Sales & Marketing"], name: "Content Marketing", description: "Thought leadership content, case studies, and demand generation campaigns.", status: "active", isCritical: false },
    { tenantId, departmentId: deptMap["Customer Success"], name: "Customer Onboarding", description: "Structured 30/60/90 day onboarding programme for new customers.", status: "active", isCritical: true },
    { tenantId, departmentId: deptMap["Security & Compliance"], name: "Compliance Management", description: "Ongoing compliance monitoring, audit preparation, and certification maintenance.", status: "active", isCritical: true },
    { tenantId, departmentId: deptMap["Finance & Operations"], name: "Subscription Management", description: "Billing, invoicing, and revenue recognition for subscription customers.", status: "planned", isCritical: true }
  ];

  await db.insert(processes).values(processesData);

  // ============================================
  // 5. TOOLS
  // ============================================

  const toolsData = [
    { tenantId, name: "Jiganto", category: "Business Management", description: "Our own platform used internally for project, document, and business management.", vendor: "Jiganto", status: "active", cost: "Internal" },
    { tenantId, name: "GitHub", category: "Development", description: "Source code management, code review, and CI/CD orchestration.", vendor: "Microsoft", status: "active", cost: "Team plan" },
    { tenantId, name: "Cloud IDE", category: "Development", description: "Cloud-based development environment for rapid prototyping and deployment.", vendor: "Cloud IDE", status: "active", cost: "Core plan" },
    { tenantId, name: "Figma", category: "Design", description: "UI/UX design, prototyping, and design system management.", vendor: "Figma", status: "active", cost: "Professional plan" },
    { tenantId, name: "OpenAI", category: "AI/ML", description: "LLM provider for conversational UI, content generation, and intelligent automation.", vendor: "OpenAI", status: "active", cost: "API usage-based" },
    { tenantId, name: "Vercel", category: "Infrastructure", description: "Frontend hosting and edge deployment for marketing site and documentation.", vendor: "Vercel", status: "active", cost: "Pro plan" },
    { tenantId, name: "PostgreSQL (Neon)", category: "Database", description: "Serverless PostgreSQL database for multi-tenant data storage.", vendor: "Neon", status: "active", cost: "Scale plan" },
    { tenantId, name: "Stripe", category: "Payments", description: "Payment processing, subscription management, and billing automation.", vendor: "Stripe", status: "planned", cost: "Usage-based" },
    { tenantId, name: "Linear", category: "Project Tracking", description: "Internal issue tracking and sprint management for engineering team.", vendor: "Linear", status: "active", cost: "Standard plan" },
    { tenantId, name: "Slack", category: "Communication", description: "Team communication, notifications, and integration hub.", vendor: "Salesforce", status: "active", cost: "Pro plan" }
  ];

  await db.insert(tools).values(toolsData);

  // ============================================
  // 6. GOALS - 6 Strategic Pillars
  // ============================================

  const visionItem = insertedStrategy.find(s => s.templateType === "vision");

  const goalsData = [
    {
      tenantId,
      strategyItemId: visionItem?.id,
      type: "objective",
      title: "Build a modular AI-enabled enterprise platform",
      description: "Product Platform Strategy: Design, develop, and deliver a production-ready modular platform with AI-native capabilities across all 12 enterprise modules.",
      status: "on_track",
      ragStatus: "amber",
      progress: 40,
      trend: "improving",
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(endOfYear),
      reviewCadence: "monthly"
    },
    {
      tenantId,
      strategyItemId: visionItem?.id,
      type: "objective",
      title: "Launch with early adopters and lighthouse clients",
      description: "Market Entry Strategy: Build traction through LOIs, paid pilots, and lighthouse reference clients across target industry verticals.",
      status: "on_track",
      ragStatus: "amber",
      progress: 20,
      trend: "stable",
      startDate: formatDate(new Date(today.getFullYear(), 2, 1)),
      endDate: formatDate(endOfYear),
      reviewCadence: "monthly"
    },
    {
      tenantId,
      strategyItemId: visionItem?.id,
      type: "objective",
      title: "AI-first + CUI-driven architecture",
      description: "Technology Strategy: Build a conversational AI layer across all platform modules, enabling natural language task execution and intelligent automation.",
      status: "on_track",
      ragStatus: "green",
      progress: 30,
      trend: "improving",
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(endOfYear),
      reviewCadence: "monthly"
    },
    {
      tenantId,
      strategyItemId: visionItem?.id,
      type: "objective",
      title: "Establish subscription + enterprise licensing",
      description: "Commercial Strategy: Launch pricing model with Standard, Family, and Enterprise tiers, implement billing automation, and convert first paying customers.",
      status: "on_track",
      ragStatus: "amber",
      progress: 15,
      trend: "stable",
      startDate: formatDate(new Date(today.getFullYear(), 3, 1)),
      endDate: formatDate(endOfYear),
      reviewCadence: "quarterly"
    },
    {
      tenantId,
      strategyItemId: visionItem?.id,
      type: "objective",
      title: "Build partner + integration marketplace",
      description: "Ecosystem Strategy: Create an integration marketplace and partner programme to extend platform capabilities and drive indirect sales.",
      status: "on_track",
      ragStatus: "green",
      progress: 10,
      trend: "stable",
      startDate: formatDate(new Date(today.getFullYear(), 3, 1)),
      endDate: formatDate(endOfYear),
      reviewCadence: "quarterly"
    },
    {
      tenantId,
      strategyItemId: visionItem?.id,
      type: "objective",
      title: "Enterprise-grade security & governance",
      description: "Trust & Compliance Strategy: Achieve ISO 27001, SOC2, and GDPR certifications to enable enterprise sales and build market trust.",
      status: "at_risk",
      ragStatus: "red",
      progress: 15,
      trend: "stable",
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(endOfYear),
      reviewCadence: "monthly"
    }
  ];

  const insertedGoals = await db.insert(goals).values(goalsData).returning();
  const goalMap = Object.fromEntries(insertedGoals.map(g => [g.title, g.id]));

  // ============================================
  // 7. OBJECTIVES
  // ============================================

  const objectivesData = [
    {
      tenantId,
      goalId: goalMap["Build a modular AI-enabled enterprise platform"],
      title: "Complete product architecture blueprint",
      description: "Finalise the modular architecture design covering all 12 platform modules, multi-tenant infrastructure, and AI integration layer.",
      status: "on_track",
      ragStatus: "amber",
      progress: 45,
      trend: "improving",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(endOfYear)
    },
    {
      tenantId,
      goalId: goalMap["Launch with early adopters and lighthouse clients"],
      title: "Secure 25+ early adopter enterprise customers",
      description: "Sign LOIs and convert paid pilot customers across professional services, system integrators, and manufacturing verticals.",
      status: "on_track",
      ragStatus: "amber",
      progress: 20,
      trend: "stable",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 2, 1)),
      endDate: formatDate(endOfYear)
    },
    {
      tenantId,
      goalId: goalMap["AI-first + CUI-driven architecture"],
      title: "Build conversational AI layer across all modules",
      description: "Implement LLM integration layer enabling conversational UI (CUI) for task execution, intelligent suggestions, and automated workflows across all platform modules.",
      status: "on_track",
      ragStatus: "green",
      progress: 30,
      trend: "improving",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(endOfYear)
    },
    {
      tenantId,
      goalId: goalMap["Establish subscription + enterprise licensing"],
      title: "Launch pricing model for Standard, Family, Enterprise",
      description: "Design and implement a tiered pricing model with subscription billing, usage metering, and enterprise licensing capabilities.",
      status: "on_track",
      ragStatus: "amber",
      progress: 15,
      trend: "stable",
      timeframe: "h2",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 3, 1)),
      endDate: formatDate(endOfYear)
    },
    {
      tenantId,
      goalId: goalMap["Build partner + integration marketplace"],
      title: "Enable integrations with 3rd-party enterprise apps",
      description: "Build an integration framework and marketplace enabling connections to popular enterprise applications and partner-developed extensions.",
      status: "on_track",
      ragStatus: "green",
      progress: 10,
      trend: "stable",
      timeframe: "h2",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 3, 1)),
      endDate: formatDate(endOfYear)
    },
    {
      tenantId,
      goalId: goalMap["Enterprise-grade security & governance"],
      title: "Achieve key certifications (ISO, SOC2, GDPR)",
      description: "Complete ISO 27001 certification, SOC2 Type 1 readiness, and GDPR compliance verification to enable enterprise sales.",
      status: "at_risk",
      ragStatus: "red",
      progress: 15,
      trend: "stable",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(endOfYear)
    }
  ];

  const insertedObjectives = await db.insert(objectives).values(objectivesData).returning();
  const objectiveMap = Object.fromEntries(insertedObjectives.map(o => [o.title, o.id]));

  // ============================================
  // 8. KEY RESULTS (linked to goals)
  // ============================================

  const keyResultsData = [
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], title: "MVP feature coverage >= 80% of defined scope", targetValue: "80", currentValue: "52", unit: "%", status: "on_track" },
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], title: "Beta client satisfaction >= 8/10", targetValue: "8", currentValue: "0", unit: "score", status: "not_started" },
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], title: "System uptime >= 99.5% in pilot", targetValue: "99.5", currentValue: "99.2", unit: "%", status: "on_track" },
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], title: "AI assistant resolves >= 60% of user actions via CUI", targetValue: "60", currentValue: "25", unit: "%", status: "on_track" },
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], title: "Average workflow setup time < 5 minutes", targetValue: "5", currentValue: "12", unit: "minutes", status: "at_risk" },

    { tenantId, goalId: goalMap["Launch with early adopters and lighthouse clients"], title: "50 LOIs signed from target customers", targetValue: "50", currentValue: "12", unit: "LOIs", status: "on_track" },
    { tenantId, goalId: goalMap["Launch with early adopters and lighthouse clients"], title: "15 paid pilot customers onboarded", targetValue: "15", currentValue: "3", unit: "customers", status: "on_track" },
    { tenantId, goalId: goalMap["Launch with early adopters and lighthouse clients"], title: "3 lighthouse reference clients secured", targetValue: "3", currentValue: "0", unit: "clients", status: "at_risk" },
    { tenantId, goalId: goalMap["Launch with early adopters and lighthouse clients"], title: "2 industry verticals validated", targetValue: "2", currentValue: "1", unit: "verticals", status: "on_track" },

    { tenantId, goalId: goalMap["AI-first + CUI-driven architecture"], title: "90% of common tasks executable via CUI", targetValue: "90", currentValue: "35", unit: "%", status: "on_track" },
    { tenantId, goalId: goalMap["AI-first + CUI-driven architecture"], title: "AI response latency < 2 seconds", targetValue: "2", currentValue: "3.2", unit: "seconds", status: "at_risk" },
    { tenantId, goalId: goalMap["AI-first + CUI-driven architecture"], title: "AI error rate < 5%", targetValue: "5", currentValue: "8", unit: "%", status: "at_risk" },

    { tenantId, goalId: goalMap["Establish subscription + enterprise licensing"], title: "All pricing tiers implemented in platform", targetValue: "3", currentValue: "0", unit: "tiers", status: "not_started" },
    { tenantId, goalId: goalMap["Establish subscription + enterprise licensing"], title: "Billing automation tested and live", targetValue: "100", currentValue: "0", unit: "%", status: "not_started" },
    { tenantId, goalId: goalMap["Establish subscription + enterprise licensing"], title: "First 10 customers converted to paid", targetValue: "10", currentValue: "0", unit: "customers", status: "not_started" },

    { tenantId, goalId: goalMap["Build partner + integration marketplace"], title: "5 integrations live at launch", targetValue: "5", currentValue: "1", unit: "integrations", status: "on_track" },
    { tenantId, goalId: goalMap["Build partner + integration marketplace"], title: "2 partner reference clients secured", targetValue: "2", currentValue: "0", unit: "partners", status: "not_started" },
    { tenantId, goalId: goalMap["Build partner + integration marketplace"], title: "Developer onboarding guide published", targetValue: "1", currentValue: "0", unit: "guides", status: "not_started" },

    { tenantId, goalId: goalMap["Enterprise-grade security & governance"], title: "ISO 27001 certification completed", targetValue: "100", currentValue: "20", unit: "%", status: "at_risk" },
    { tenantId, goalId: goalMap["Enterprise-grade security & governance"], title: "SOC2 Type 1 readiness achieved", targetValue: "100", currentValue: "10", unit: "%", status: "at_risk" },
    { tenantId, goalId: goalMap["Enterprise-grade security & governance"], title: "GDPR compliance verified", targetValue: "100", currentValue: "35", unit: "%", status: "on_track" }
  ];

  await db.insert(keyResults).values(keyResultsData);

  // ============================================
  // 8b. KPIs
  // ============================================

  const kpisData = [
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], name: "Feature Delivery Velocity", description: "Number of features shipped per sprint across all modules", targetValue: "8", currentValue: "6", unit: "features/sprint", indicatorType: "leading", status: "on_track", ragStatus: "amber", progress: 75, trend: "improving" },
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], name: "Defect Escape Rate", description: "Percentage of defects found in production vs. caught in testing", targetValue: "5", currentValue: "8", unit: "%", indicatorType: "lagging", status: "at_risk", ragStatus: "amber", progress: 62, trend: "improving" },
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], name: "Module Adoption Rates", description: "Percentage of active users engaging with each module", targetValue: "70", currentValue: "0", unit: "%", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], name: "User Task Completion Time", description: "Average time to complete common tasks on the platform", targetValue: "3", currentValue: "0", unit: "minutes", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Build a modular AI-enabled enterprise platform"], name: "AI Response Accuracy", description: "Percentage of AI-generated responses that are correct and useful", targetValue: "90", currentValue: "72", unit: "%", indicatorType: "lagging", status: "on_track", ragStatus: "amber", progress: 80, trend: "improving" },

    { tenantId, goalId: goalMap["Launch with early adopters and lighthouse clients"], name: "Customer Acquisition Cost (CAC)", description: "Average cost to acquire a new customer including sales and marketing spend", targetValue: "5000", currentValue: "0", unit: "GBP", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Launch with early adopters and lighthouse clients"], name: "Trial to Paid Conversion Rate", description: "Percentage of trial/pilot customers converting to paid subscriptions", targetValue: "30", currentValue: "0", unit: "%", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Launch with early adopters and lighthouse clients"], name: "Monthly Recurring Revenue (MRR)", description: "Total monthly subscription revenue from all customers", targetValue: "50000", currentValue: "0", unit: "GBP", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Launch with early adopters and lighthouse clients"], name: "Customer Churn Rate", description: "Monthly rate of customers cancelling their subscriptions", targetValue: "3", currentValue: "0", unit: "%", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },

    { tenantId, goalId: goalMap["AI-first + CUI-driven architecture"], name: "API Latency (P95)", description: "95th percentile API response time across all endpoints", targetValue: "200", currentValue: "350", unit: "ms", indicatorType: "leading", status: "at_risk", ragStatus: "amber", progress: 57, trend: "improving" },
    { tenantId, goalId: goalMap["AI-first + CUI-driven architecture"], name: "Platform Uptime", description: "System availability percentage measured monthly", targetValue: "99.5", currentValue: "99.2", unit: "%", indicatorType: "lagging", status: "on_track", ragStatus: "green", progress: 99, trend: "stable" },
    { tenantId, goalId: goalMap["AI-first + CUI-driven architecture"], name: "CUI Task Accuracy", description: "Percentage of CUI-initiated tasks completed correctly without user intervention", targetValue: "85", currentValue: "68", unit: "%", indicatorType: "lagging", status: "on_track", ragStatus: "amber", progress: 80, trend: "improving" },

    { tenantId, goalId: goalMap["Establish subscription + enterprise licensing"], name: "Subscription MRR", description: "Monthly recurring revenue from subscription customers", targetValue: "50000", currentValue: "0", unit: "GBP", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Establish subscription + enterprise licensing"], name: "Billing Conversion Rate", description: "Percentage of free users converting to paid subscriptions", targetValue: "15", currentValue: "0", unit: "%", indicatorType: "leading", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Establish subscription + enterprise licensing"], name: "Payment Success Rate", description: "Percentage of payment transactions processed successfully", targetValue: "99", currentValue: "0", unit: "%", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },

    { tenantId, goalId: goalMap["Build partner + integration marketplace"], name: "Active Integrations Count", description: "Number of live, functioning integrations in the marketplace", targetValue: "5", currentValue: "1", unit: "integrations", indicatorType: "leading", status: "on_track", ragStatus: "amber", progress: 20, trend: "improving" },
    { tenantId, goalId: goalMap["Build partner + integration marketplace"], name: "Partner Satisfaction Score", description: "Average satisfaction rating from integration and channel partners", targetValue: "8", currentValue: "0", unit: "/10", indicatorType: "lagging", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Build partner + integration marketplace"], name: "Developer Adoption Rate", description: "Number of external developers actively building on the platform", targetValue: "20", currentValue: "0", unit: "developers", indicatorType: "leading", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },

    { tenantId, goalId: goalMap["Enterprise-grade security & governance"], name: "Security Incidents", description: "Number of security incidents per month", targetValue: "0", currentValue: "0", unit: "incidents", indicatorType: "lagging", status: "on_track", ragStatus: "green", progress: 100, trend: "stable" },
    { tenantId, goalId: goalMap["Enterprise-grade security & governance"], name: "Audit Findings (Open)", description: "Number of open audit findings requiring remediation", targetValue: "0", currentValue: "5", unit: "findings", indicatorType: "lagging", status: "at_risk", ragStatus: "red", progress: 0, trend: "stable" },
    { tenantId, goalId: goalMap["Enterprise-grade security & governance"], name: "Compliance Checklist Completion", description: "Percentage of compliance checklist items completed across all frameworks", targetValue: "100", currentValue: "25", unit: "%", indicatorType: "leading", status: "at_risk", ragStatus: "red", progress: 25, trend: "improving" }
  ];

  await db.insert(kpis).values(kpisData);

  // ============================================
  // 9. INITIATIVES - 6 Strategic Initiatives
  // ============================================

  const initiativesData = [
    {
      tenantId,
      goalId: goalMap["Build a modular AI-enabled enterprise platform"],
      objectiveId: objectiveMap["Complete product architecture blueprint"],
      title: "Core Platform Services Initiative",
      description: "Build the foundational platform services including multi-tenant architecture, module framework, workflow engine, and document versioning system.",
      status: "in_progress",
      ragStatus: "amber",
      progress: 45,
      trend: "improving",
      priority: "critical",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      dueDate: formatDate(new Date(today.getFullYear(), 9, 31))
    },
    {
      tenantId,
      goalId: goalMap["Launch with early adopters and lighthouse clients"],
      objectiveId: objectiveMap["Secure 25+ early adopter enterprise customers"],
      title: "Early Adopter Programme",
      description: "Design and execute the early adopter programme including LOI generation, pilot onboarding, feedback capture, and lighthouse client development.",
      status: "in_progress",
      ragStatus: "amber",
      progress: 20,
      trend: "stable",
      priority: "critical",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 2, 1)),
      dueDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      goalId: goalMap["AI-first + CUI-driven architecture"],
      objectiveId: objectiveMap["Build conversational AI layer across all modules"],
      title: "LLM Integration Layer",
      description: "Build the AI integration layer enabling conversational UI across all platform modules, including intent mapping, context management, and fallback handling.",
      status: "in_progress",
      ragStatus: "green",
      progress: 30,
      trend: "improving",
      priority: "critical",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      dueDate: formatDate(new Date(today.getFullYear(), 9, 31))
    },
    {
      tenantId,
      goalId: goalMap["Establish subscription + enterprise licensing"],
      objectiveId: objectiveMap["Launch pricing model for Standard, Family, Enterprise"],
      title: "Subscription & Billing Initiative",
      description: "Design pricing tiers, implement subscription management, billing automation, and payment gateway integration for commercial launch.",
      status: "not_started",
      ragStatus: "amber",
      progress: 5,
      trend: "stable",
      priority: "high",
      timeframe: "h2",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 5, 1)),
      dueDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      goalId: goalMap["Build partner + integration marketplace"],
      objectiveId: objectiveMap["Enable integrations with 3rd-party enterprise apps"],
      title: "Marketplace & Integration Initiative",
      description: "Build the integration framework, API catalog, developer sandbox, and partner marketplace to enable third-party extensions and integrations.",
      status: "not_started",
      ragStatus: "green",
      progress: 10,
      trend: "stable",
      priority: "high",
      timeframe: "h2",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 5, 1)),
      dueDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      goalId: goalMap["Enterprise-grade security & governance"],
      objectiveId: objectiveMap["Achieve key certifications (ISO, SOC2, GDPR)"],
      title: "Security & Compliance Initiative",
      description: "Achieve ISO 27001 certification, SOC2 Type 1 readiness, and GDPR compliance verification through systematic audit preparation and policy implementation.",
      status: "in_progress",
      ragStatus: "red",
      progress: 15,
      trend: "stable",
      priority: "critical",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      dueDate: formatDate(new Date(today.getFullYear(), 11, 31))
    }
  ];

  const insertedInitiatives = await db.insert(initiatives).values(initiativesData).returning();
  const initiativeMap = Object.fromEntries(insertedInitiatives.map(i => [i.title, i.id]));

  // ============================================
  // 10. OKRs - Objectives and Key Results
  // ============================================

  const okrsData = [
    {
      tenantId,
      initiativeId: initiativeMap["Core Platform Services Initiative"],
      objectiveId: objectiveMap["Complete product architecture blueprint"],
      title: "Deliver production-ready MVP platform",
      description: "Ship a production-ready MVP with 80%+ feature coverage, high satisfaction, and reliable uptime",
      status: "on_track",
      ragStatus: "amber",
      progress: 45,
      trend: "improving",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 9, 31))
    },
    {
      tenantId,
      initiativeId: initiativeMap["Early Adopter Programme"],
      objectiveId: objectiveMap["Secure 25+ early adopter enterprise customers"],
      title: "Build early adopter traction",
      description: "Generate LOIs, convert paid pilots, and secure lighthouse reference clients across target verticals",
      status: "on_track",
      ragStatus: "amber",
      progress: 20,
      trend: "stable",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 2, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      initiativeId: initiativeMap["LLM Integration Layer"],
      objectiveId: objectiveMap["Build conversational AI layer across all modules"],
      title: "Enable CUI-driven operations",
      description: "Achieve 90% task coverage via conversational UI with sub-2-second latency and under 5% error rate",
      status: "on_track",
      ragStatus: "green",
      progress: 30,
      trend: "improving",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 9, 31))
    },
    {
      tenantId,
      initiativeId: initiativeMap["Subscription & Billing Initiative"],
      objectiveId: objectiveMap["Launch pricing model for Standard, Family, Enterprise"],
      title: "Enable revenue tracking at launch",
      description: "Implement all pricing tiers, automate billing, and convert first 10 paying customers",
      status: "not_started",
      ragStatus: "amber",
      progress: 0,
      trend: "stable",
      timeframe: "h2",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 5, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      initiativeId: initiativeMap["Marketplace & Integration Initiative"],
      objectiveId: objectiveMap["Enable integrations with 3rd-party enterprise apps"],
      title: "Launch ecosystem for partners",
      description: "Deliver 5 live integrations, 2 partner references, and published developer onboarding guide",
      status: "not_started",
      ragStatus: "green",
      progress: 10,
      trend: "stable",
      timeframe: "h2",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 5, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      initiativeId: initiativeMap["Security & Compliance Initiative"],
      objectiveId: objectiveMap["Achieve key certifications (ISO, SOC2, GDPR)"],
      title: "Ensure platform is audit-ready",
      description: "Complete ISO 27001 certification, achieve SOC2 Type 1 readiness, and verify GDPR compliance",
      status: "at_risk",
      ragStatus: "red",
      progress: 15,
      trend: "stable",
      timeframe: "annual",
      fiscalYear: today.getFullYear(),
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    }
  ];

  const insertedOkrs = await db.insert(okrs).values(okrsData).returning();
  const okrMap = Object.fromEntries(insertedOkrs.map(o => [o.title, o.id]));

  // ============================================
  // 10b. OKR KEY RESULTS (linked to OKRs)
  // ============================================

  const okrKeyResultsData = [
    { tenantId, okrId: okrMap["Deliver production-ready MVP platform"], title: "MVP feature coverage >= 80% of defined scope", targetValue: "80", currentValue: "52", unit: "%", status: "on_track", ragStatus: "amber", progress: 65, trend: "improving" },
    { tenantId, okrId: okrMap["Deliver production-ready MVP platform"], title: "Beta client satisfaction >= 8/10", targetValue: "8", currentValue: "0", unit: "score", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, okrId: okrMap["Deliver production-ready MVP platform"], title: "System uptime >= 99.5% in pilot", targetValue: "99.5", currentValue: "99.2", unit: "%", status: "on_track", ragStatus: "green", progress: 99, trend: "stable" },
    { tenantId, okrId: okrMap["Deliver production-ready MVP platform"], title: "AI assistant resolves >= 60% via CUI", targetValue: "60", currentValue: "25", unit: "%", status: "on_track", ragStatus: "amber", progress: 42, trend: "improving" },
    { tenantId, okrId: okrMap["Deliver production-ready MVP platform"], title: "Average workflow setup time < 5 minutes", targetValue: "5", currentValue: "12", unit: "minutes", status: "at_risk", ragStatus: "red", progress: 42, trend: "improving" },

    { tenantId, okrId: okrMap["Build early adopter traction"], title: "50 LOIs signed from target customers", targetValue: "50", currentValue: "12", unit: "LOIs", status: "on_track", ragStatus: "amber", progress: 24, trend: "improving" },
    { tenantId, okrId: okrMap["Build early adopter traction"], title: "15 paid pilot customers onboarded", targetValue: "15", currentValue: "3", unit: "pilots", status: "on_track", ragStatus: "amber", progress: 20, trend: "stable" },
    { tenantId, okrId: okrMap["Build early adopter traction"], title: "3 lighthouse reference clients secured", targetValue: "3", currentValue: "0", unit: "clients", status: "at_risk", ragStatus: "red", progress: 0, trend: "stable" },
    { tenantId, okrId: okrMap["Build early adopter traction"], title: "2 industry verticals validated", targetValue: "2", currentValue: "1", unit: "verticals", status: "on_track", ragStatus: "amber", progress: 50, trend: "improving" },

    { tenantId, okrId: okrMap["Enable CUI-driven operations"], title: "90% of common tasks executable via CUI", targetValue: "90", currentValue: "35", unit: "%", status: "on_track", ragStatus: "amber", progress: 39, trend: "improving" },
    { tenantId, okrId: okrMap["Enable CUI-driven operations"], title: "AI response latency < 2 seconds", targetValue: "2", currentValue: "3.2", unit: "seconds", status: "at_risk", ragStatus: "red", progress: 62, trend: "improving" },
    { tenantId, okrId: okrMap["Enable CUI-driven operations"], title: "AI error rate < 5%", targetValue: "5", currentValue: "8", unit: "%", status: "at_risk", ragStatus: "amber", progress: 62, trend: "improving" },

    { tenantId, okrId: okrMap["Enable revenue tracking at launch"], title: "All pricing tiers implemented in platform", targetValue: "3", currentValue: "0", unit: "tiers", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, okrId: okrMap["Enable revenue tracking at launch"], title: "Billing automation tested and live", targetValue: "100", currentValue: "0", unit: "%", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, okrId: okrMap["Enable revenue tracking at launch"], title: "First 10 customers converted to paid", targetValue: "10", currentValue: "0", unit: "customers", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },

    { tenantId, okrId: okrMap["Launch ecosystem for partners"], title: "5 integrations live at launch", targetValue: "5", currentValue: "1", unit: "integrations", status: "on_track", ragStatus: "amber", progress: 20, trend: "improving" },
    { tenantId, okrId: okrMap["Launch ecosystem for partners"], title: "2 partner reference clients secured", targetValue: "2", currentValue: "0", unit: "partners", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },
    { tenantId, okrId: okrMap["Launch ecosystem for partners"], title: "Developer onboarding guide published", targetValue: "1", currentValue: "0", unit: "guides", status: "not_started", ragStatus: "grey", progress: 0, trend: "stable" },

    { tenantId, okrId: okrMap["Ensure platform is audit-ready"], title: "ISO 27001 certification completed", targetValue: "100", currentValue: "20", unit: "%", status: "at_risk", ragStatus: "red", progress: 20, trend: "stable" },
    { tenantId, okrId: okrMap["Ensure platform is audit-ready"], title: "SOC2 Type 1 readiness achieved", targetValue: "100", currentValue: "10", unit: "%", status: "at_risk", ragStatus: "red", progress: 10, trend: "stable" },
    { tenantId, okrId: okrMap["Ensure platform is audit-ready"], title: "GDPR compliance verified", targetValue: "100", currentValue: "35", unit: "%", status: "on_track", ragStatus: "amber", progress: 35, trend: "improving" }
  ];

  await db.insert(keyResults).values(okrKeyResultsData);

  // ============================================
  // 11. BUSINESS TASKS - Epics and Tasks within Initiatives
  // ============================================

  const tasksData = [
    // Core Platform Services Initiative - Epics
    { tenantId, initiativeId: initiativeMap["Core Platform Services Initiative"], title: "[Epic] Multi-tenant security model", status: "in_progress", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 4, 31)) },
    { tenantId, initiativeId: initiativeMap["Core Platform Services Initiative"], title: "[Epic] Workflow builder engine", status: "in_progress", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, initiativeId: initiativeMap["Core Platform Services Initiative"], title: "[Epic] Document versioning system", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 5, 30)) },
    // Core Platform Services Initiative - Tasks
    { tenantId, initiativeId: initiativeMap["Core Platform Services Initiative"], title: "Implement document version API", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 3, 30)) },
    { tenantId, initiativeId: initiativeMap["Core Platform Services Initiative"], title: "Build workspace permissions UI", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 4, 15)) },
    { tenantId, initiativeId: initiativeMap["Core Platform Services Initiative"], title: "Create onboarding wizard", status: "todo", priority: "medium", dueDate: formatDate(new Date(today.getFullYear(), 5, 30)) },

    // Early Adopter Programme - Epics
    { tenantId, initiativeId: initiativeMap["Early Adopter Programme"], title: "[Epic] Pilot onboarding flow", status: "in_progress", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 5, 30)) },
    { tenantId, initiativeId: initiativeMap["Early Adopter Programme"], title: "[Epic] Feedback capture workflow", status: "todo", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 7, 31)) },
    // Early Adopter Programme - Tasks
    { tenantId, initiativeId: initiativeMap["Early Adopter Programme"], title: "Create LOI template", status: "completed", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 2, 15)) },
    { tenantId, initiativeId: initiativeMap["Early Adopter Programme"], title: "Build client dashboard", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 4, 31)) },
    { tenantId, initiativeId: initiativeMap["Early Adopter Programme"], title: "Set up email notifications for pilots", status: "todo", priority: "medium", dueDate: formatDate(new Date(today.getFullYear(), 5, 15)) },

    // LLM Integration Layer - Epics
    { tenantId, initiativeId: initiativeMap["LLM Integration Layer"], title: "[Epic] CRM AI tasks", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, initiativeId: initiativeMap["LLM Integration Layer"], title: "[Epic] Project Management AI tasks", status: "todo", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 8, 30)) },
    // LLM Integration Layer - Tasks
    { tenantId, initiativeId: initiativeMap["LLM Integration Layer"], title: "Map AI intents per module", status: "in_progress", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 3, 30)) },
    { tenantId, initiativeId: initiativeMap["LLM Integration Layer"], title: "Train AI on sample workflows", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 5, 30)) },
    { tenantId, initiativeId: initiativeMap["LLM Integration Layer"], title: "Build fallback for unsupported actions", status: "todo", priority: "medium", dueDate: formatDate(new Date(today.getFullYear(), 6, 15)) },

    // Subscription & Billing Initiative - Epics
    { tenantId, initiativeId: initiativeMap["Subscription & Billing Initiative"], title: "[Epic] Subscription management module", status: "todo", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 9, 31)) },
    { tenantId, initiativeId: initiativeMap["Subscription & Billing Initiative"], title: "[Epic] Invoice automation", status: "todo", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 10, 30)) },
    // Subscription & Billing Initiative - Tasks
    { tenantId, initiativeId: initiativeMap["Subscription & Billing Initiative"], title: "Integrate payment gateways (Stripe)", status: "todo", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 7, 31)) },
    { tenantId, initiativeId: initiativeMap["Subscription & Billing Initiative"], title: "Test subscription renewals", status: "todo", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 9, 15)) },
    { tenantId, initiativeId: initiativeMap["Subscription & Billing Initiative"], title: "Build admin billing dashboard", status: "todo", priority: "medium", dueDate: formatDate(new Date(today.getFullYear(), 10, 30)) },

    // Marketplace & Integration Initiative - Epics
    { tenantId, initiativeId: initiativeMap["Marketplace & Integration Initiative"], title: "[Epic] API catalog", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 8, 30)) },
    { tenantId, initiativeId: initiativeMap["Marketplace & Integration Initiative"], title: "[Epic] Developer sandbox", status: "todo", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 10, 30)) },
    // Marketplace & Integration Initiative - Tasks
    { tenantId, initiativeId: initiativeMap["Marketplace & Integration Initiative"], title: "Build API documentation", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, initiativeId: initiativeMap["Marketplace & Integration Initiative"], title: "Create integration onboarding wizard", status: "todo", priority: "medium", dueDate: formatDate(new Date(today.getFullYear(), 9, 30)) },
    { tenantId, initiativeId: initiativeMap["Marketplace & Integration Initiative"], title: "Publish marketplace portal", status: "todo", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 10, 30)) },

    // Security & Compliance Initiative - Epics
    { tenantId, initiativeId: initiativeMap["Security & Compliance Initiative"], title: "[Epic] Security audit prep", status: "in_progress", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 8, 30)) },
    { tenantId, initiativeId: initiativeMap["Security & Compliance Initiative"], title: "[Epic] Privacy & data handling policies", status: "in_progress", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 7, 31)) },
    // Security & Compliance Initiative - Tasks
    { tenantId, initiativeId: initiativeMap["Security & Compliance Initiative"], title: "Perform penetration testing", status: "in_progress", priority: "critical", dueDate: formatDate(new Date(today.getFullYear(), 5, 30)) },
    { tenantId, initiativeId: initiativeMap["Security & Compliance Initiative"], title: "Review data handling procedures", status: "in_progress", priority: "high", dueDate: formatDate(new Date(today.getFullYear(), 4, 30)) },
    { tenantId, initiativeId: initiativeMap["Security & Compliance Initiative"], title: "Conduct internal compliance training", status: "todo", priority: "medium", dueDate: formatDate(new Date(today.getFullYear(), 6, 31)) }
  ];

  await db.insert(businessTasks).values(tasksData);

  // ============================================
  // 12. MEETINGS - Strategic Reviews
  // ============================================

  const meetingsData = [
    {
      tenantId,
      initiativeId: initiativeMap["Core Platform Services Initiative"],
      title: "Platform Build Weekly Sync",
      description: "Weekly review of platform development progress, sprint demos, and technical decisions.",
      startTime: new Date(nextWeek.setHours(10, 0, 0)),
      endTime: new Date(nextWeek.setHours(11, 0, 0)),
      location: "Virtual - Google Meet",
      status: "scheduled",
      notes: "Recurring meeting every Monday at 10:00 AM GMT"
    },
    {
      tenantId,
      initiativeId: initiativeMap["Early Adopter Programme"],
      title: "Early Adopter Programme Review",
      description: "Weekly review of early adopter pipeline, pilot feedback, and conversion metrics.",
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 14, 0),
      endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 15, 0),
      location: "Virtual - Google Meet",
      status: "scheduled",
      notes: "Recurring every Wednesday at 14:00 GMT"
    },
    {
      tenantId,
      initiativeId: initiativeMap["LLM Integration Layer"],
      title: "AI Integration Sprint Review",
      description: "Bi-weekly sprint demo and stakeholder feedback session for AI/CUI capabilities.",
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10, 14, 0),
      endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10, 15, 30),
      location: "Virtual - Google Meet",
      status: "scheduled",
      notes: "Recurring every other Friday"
    },
    {
      tenantId,
      initiativeId: initiativeMap["Security & Compliance Initiative"],
      title: "Security & Compliance Review",
      description: "Monthly review of certification progress, audit findings, and compliance readiness.",
      startTime: new Date(today.getFullYear(), today.getMonth() + 1, 5, 11, 0),
      endTime: new Date(today.getFullYear(), today.getMonth() + 1, 5, 12, 0),
      location: "Virtual - Google Meet",
      status: "scheduled",
      notes: "Monthly on first Thursday"
    },
    {
      tenantId,
      title: "Jiganto Executive Strategy Review",
      description: "Monthly leadership review of all 6 strategic pillars, initiatives, OKRs, and market readiness.",
      startTime: new Date(today.getFullYear(), today.getMonth() + 1, 1, 9, 0),
      endTime: new Date(today.getFullYear(), today.getMonth() + 1, 1, 12, 0),
      location: "Virtual - Google Meet",
      status: "scheduled",
      notes: "Attendees: Founder, CTO, Head of Product, Head of Sales, Head of Engineering"
    },
    {
      tenantId,
      title: "Jiganto Advisory Board Meeting",
      description: "Quarterly advisory board meeting to review company performance, market strategy, and funding readiness.",
      startTime: new Date(today.getFullYear(), today.getMonth() + 2, 20, 9, 0),
      endTime: new Date(today.getFullYear(), today.getMonth() + 2, 20, 17, 0),
      location: "London - Offsite Venue",
      status: "scheduled",
      notes: "Full day session with strategic planning and investor updates"
    }
  ];

  await db.insert(meetings).values(meetingsData);

  // ============================================
  // 13. DOCUMENT LINKS - Strategic Documents
  // ============================================

  const documentLinksData = [
    { tenantId, documentType: "Strategy", linkedEntityType: "strategy_item", linkedEntityId: insertedStrategy[0].id, title: "Jiganto Strategic Plan 2026", url: "https://docs.jiganto.com/strategy/plan-2026" },
    { tenantId, documentType: "Strategy", linkedEntityType: "strategy_item", linkedEntityId: insertedStrategy[1].id, title: "Target Market Research Report", url: "https://docs.jiganto.com/market/research-2026" },
    { tenantId, documentType: "Strategy", linkedEntityType: "strategy_item", linkedEntityId: insertedStrategy[2].id, title: "Competitive Intelligence Dashboard", url: "https://docs.jiganto.com/competitive" },
    { tenantId, documentType: "Financial", linkedEntityType: "goal", linkedEntityId: insertedGoals[3].id, title: "Jiganto Pricing Strategy Document", url: "https://docs.jiganto.com/commercial/pricing-strategy" },
    { tenantId, documentType: "Corporate", linkedEntityType: "initiative", linkedEntityId: insertedInitiatives[1].id, title: "Early Adopter Programme Guide", url: "https://docs.jiganto.com/sales/early-adopter-guide" },
    { tenantId, documentType: "Strategy", linkedEntityType: "initiative", linkedEntityId: insertedInitiatives[2].id, title: "AI/CUI Technical Architecture", url: "https://docs.jiganto.com/engineering/ai-architecture" },
    { tenantId, documentType: "Corporate", linkedEntityType: "initiative", linkedEntityId: insertedInitiatives[4].id, title: "Partner & Marketplace Strategy", url: "https://docs.jiganto.com/ecosystem/partner-strategy" },
    { tenantId, documentType: "Corporate", linkedEntityType: "initiative", linkedEntityId: insertedInitiatives[5].id, title: "Security & Compliance Playbook", url: "https://docs.jiganto.com/security/compliance-playbook" }
  ];

  await db.insert(documentLinks).values(documentLinksData);

  // ============================================
  // 14. INITIATIVE DOCUMENT TEMPLATES (Jiganto-branded)
  // ============================================

  const initiativeDocsFolder = await db.insert(documentFolders).values({
    tenantId,
    name: "Jiganto Initiative Documents",
    description: "Enterprise document templates linked to Jiganto strategic initiatives",
    icon: "briefcase",
    order: 1
  }).returning();

  const initiativeDocsFolderId = initiativeDocsFolder[0].id;

  const initiativeDocumentsData = [
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto Platform SoW",
      description: "Statement of Work for the Core Platform Services Initiative",
      content: `<h1>Jiganto Platform - Statement of Work</h1>
<h2>Project Overview</h2>
<p>This Statement of Work defines the scope, deliverables, timeline, and responsibilities for the Jiganto Core Platform Services Initiative.</p>
<h2>Scope of Work</h2>
<ul>
<li>Multi-tenant architecture with data residency support</li>
<li>12 integrated enterprise modules (CRM, Projects, Documents, etc.)</li>
<li>AI-native conversational UI (CUI) across all modules</li>
<li>Workflow builder engine with automation capabilities</li>
<li>Document versioning and collaboration system</li>
</ul>
<h2>Deliverables</h2>
<p>Production-ready MVP platform with 80%+ feature coverage, 99.5% uptime, and AI assistant resolving 60%+ user actions.</p>`,
      type: "sow",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto Early Adopter MSA",
      description: "Master Services Agreement for Early Adopter Programme participants",
      content: `<h1>Jiganto Early Adopter - Master Services Agreement</h1>
<h2>1. Parties</h2>
<p>This Master Services Agreement is entered into between Jiganto Ltd ("Provider") and the Early Adopter Customer ("Customer")...</p>
<h2>2. Early Adopter Programme Terms</h2>
<p>Customer agrees to participate in the Jiganto Early Adopter Programme, providing feedback and serving as a reference client in exchange for preferential pricing and direct product influence.</p>
<h2>3. Pricing</h2>
<p>Early adopter pricing: 50% discount on Standard tier for 12 months from programme start date...</p>
<h2>4. Feedback Obligations</h2>
<p>Customer agrees to participate in monthly feedback sessions, quarterly reviews, and annual case study creation...</p>`,
      type: "msa",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto CUI Platform User Guide",
      description: "End-user documentation for the Jiganto Conversational UI capabilities",
      content: `<h1>Jiganto CUI Platform - User Guide</h1>
<h2>Getting Started with Conversational UI</h2>
<p>Welcome to Jiganto's AI-powered Conversational UI. This guide helps you leverage natural language to manage projects, documents, and workflows.</p>
<h2>Key CUI Capabilities</h2>
<ul>
<li>Create and manage tasks via natural language commands</li>
<li>Generate documents and templates using AI</li>
<li>Query project status and KPIs conversationally</li>
<li>Automate workflows through conversational intents</li>
<li>Get intelligent suggestions based on context</li>
</ul>
<h2>Example Commands</h2>
<p>"Create a new project called Website Redesign with agile methodology"</p>
<p>"Show me all overdue tasks for the Platform Build programme"</p>
<p>"Generate a Statement of Work for the customer onboarding project"</p>`,
      type: "user_guide",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto AI Platform Training Guide",
      description: "Training materials for AI/CUI implementation and configuration",
      content: `<h1>Jiganto AI Platform - Training Guide</h1>
<h2>Training Objectives</h2>
<p>By the end of this training, participants will be able to:</p>
<ul>
<li>Configure AI models for specific enterprise use cases</li>
<li>Train custom intents for domain-specific workflows</li>
<li>Monitor and optimise CUI performance metrics</li>
<li>Troubleshoot common AI response issues</li>
<li>Build custom automation rules using the AI layer</li>
</ul>
<h2>Module 1: CUI Architecture</h2>
<p>Understanding the core components of Jiganto's conversational AI layer, including intent mapping, context management, and fallback handling...</p>`,
      type: "training_guide",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto Partner Ecosystem MSA",
      description: "Master Services Agreement template for Jiganto integration and channel partners",
      content: `<h1>Jiganto Partner - Master Services Agreement</h1>
<h2>Partnership Overview</h2>
<p>This agreement establishes the framework for collaboration between Jiganto Ltd and integration/channel partners to build, market, and deliver Jiganto solutions.</p>
<h2>Partner Tiers</h2>
<ul>
<li>Gold Partners: Premier implementation and reseller partners with dedicated support</li>
<li>Silver Partners: Regional solution providers with certified delivery capabilities</li>
<li>Technology Partners: Integration partners building connectors and extensions</li>
</ul>
<h2>Revenue Sharing</h2>
<p>Partner compensation based on deal registration (20%), implementation services (retained), and recurring revenue share (15%)...</p>`,
      type: "msa",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto Integration Hub User Guide",
      description: "Developer guide for building integrations on the Jiganto platform",
      content: `<h1>Jiganto Integration Hub - Developer Guide</h1>
<h2>Overview</h2>
<p>The Jiganto Integration Hub enables third-party developers and partners to build connectors, extensions, and integrations for the Jiganto platform.</p>
<h2>Getting Started</h2>
<ul>
<li>Register as a Jiganto Developer Partner</li>
<li>Access the developer sandbox environment</li>
<li>Review the API catalog and documentation</li>
<li>Build and test your integration</li>
<li>Submit for marketplace review</li>
</ul>
<h2>API Reference</h2>
<p>Full REST API documentation covering all 12 modules, authentication, webhooks, and event-driven integration patterns...</p>`,
      type: "user_guide",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto Security & Compliance Guide",
      description: "Security architecture and compliance documentation for enterprise customers",
      content: `<h1>Jiganto Security & Compliance Guide</h1>
<h2>Security Architecture</h2>
<p>Jiganto implements enterprise-grade security across all platform layers:</p>
<ul>
<li>Multi-tenant data isolation with encryption at rest and in transit</li>
<li>Role-based access control (RBAC) with fine-grained permissions</li>
<li>SOC2 Type 1 controls implementation</li>
<li>GDPR compliance with data residency options</li>
<li>Regular penetration testing and vulnerability assessments</li>
</ul>
<h2>Certifications</h2>
<p>ISO 27001 (in progress), SOC2 Type 1 (planned), GDPR (verified)...</p>`,
      type: "user_guide",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto Billing Platform SoW",
      description: "Statement of Work for the Subscription & Billing Initiative",
      content: `<h1>Jiganto Billing Platform - Statement of Work</h1>
<h2>Objective</h2>
<p>Design and implement a subscription billing system supporting Standard, Family, and Enterprise pricing tiers with automated invoicing and payment processing.</p>
<h2>Key Workstreams</h2>
<ol>
<li>Pricing tier design and implementation</li>
<li>Stripe payment gateway integration</li>
<li>Subscription lifecycle management (trials, upgrades, downgrades)</li>
<li>Invoice generation and automated billing</li>
<li>Admin billing dashboard and reporting</li>
</ol>`,
      type: "sow",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto Compliance Training Guide",
      description: "Training materials for security and compliance team members",
      content: `<h1>Jiganto Compliance Training Guide</h1>
<h2>Training Curriculum</h2>
<p>This comprehensive training programme prepares team members for security audit preparation and ongoing compliance management.</p>
<h2>Module 1: Security Fundamentals</h2>
<ul>
<li>Data classification and handling procedures</li>
<li>Access control and authentication best practices</li>
<li>Incident response procedures</li>
</ul>
<h2>Module 2: Compliance Frameworks</h2>
<p>Understanding ISO 27001, SOC2, and GDPR requirements and how they apply to the Jiganto platform...</p>`,
      type: "training_guide",
      status: "published"
    },
    {
      tenantId,
      folderId: initiativeDocsFolderId,
      title: "Jiganto Business Requirements Template",
      description: "Template for capturing business requirements during early adopter onboarding",
      content: `<h1>Jiganto - Business Requirements Document</h1>
<h2>Executive Summary</h2>
<p>This document captures business requirements for the Jiganto platform implementation.</p>
<h2>Current State Analysis</h2>
<p>Document existing processes, pain points, and current tooling landscape...</p>
<h2>Future State Vision</h2>
<p>Define target operating model with Jiganto, success criteria, and expected outcomes...</p>
<h2>Module Requirements</h2>
<p>Prioritised requirements by Jiganto module (CRM, Projects, Documents, etc.)...</p>`,
      type: "requirements",
      status: "published"
    }
  ];

  const insertedDocs = await db.insert(documents).values(initiativeDocumentsData).returning();

  const documentInitiativeLinksData = [
    { tenantId, documentId: insertedDocs[0].id, initiativeId: insertedInitiatives[0].id, linkType: "deliverable", notes: "Core Platform Services scope definition" },
    { tenantId, documentId: insertedDocs[1].id, initiativeId: insertedInitiatives[1].id, linkType: "contract", notes: "Standard MSA for early adopter participants" },
    { tenantId, documentId: insertedDocs[2].id, initiativeId: insertedInitiatives[2].id, linkType: "documentation", notes: "End-user guide for CUI capabilities" },
    { tenantId, documentId: insertedDocs[3].id, initiativeId: insertedInitiatives[2].id, linkType: "training", notes: "AI/CUI implementation training materials" },
    { tenantId, documentId: insertedDocs[4].id, initiativeId: insertedInitiatives[4].id, linkType: "contract", notes: "Partner ecosystem agreements template" },
    { tenantId, documentId: insertedDocs[5].id, initiativeId: insertedInitiatives[4].id, linkType: "documentation", notes: "Integration Hub developer guide" },
    { tenantId, documentId: insertedDocs[6].id, initiativeId: insertedInitiatives[5].id, linkType: "documentation", notes: "Security and compliance documentation" },
    { tenantId, documentId: insertedDocs[7].id, initiativeId: insertedInitiatives[3].id, linkType: "deliverable", notes: "Billing platform scope definition" },
    { tenantId, documentId: insertedDocs[8].id, initiativeId: insertedInitiatives[5].id, linkType: "training", notes: "Compliance training curriculum" },
    { tenantId, documentId: insertedDocs[9].id, initiativeId: insertedInitiatives[1].id, linkType: "template", notes: "Requirements gathering template for onboarding" }
  ];

  await db.insert(documentInitiativeLinks).values(documentInitiativeLinksData);

  // ============================================
  // 15. EXECUTION LAYER - Portfolio, Programmes, Projects
  // ============================================

  const [portfolio] = await db.insert(pmPortfolios).values({
    tenantId,
    name: "Jiganto Strategic Programmes",
    description: "Portfolio of all strategic programmes supporting the Jiganto market launch strategy",
    status: "active",
    ragStatus: "amber",
    startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
    endDate: formatDate(endOfYear)
  }).returning();

  const programmesData = [
    {
      tenantId,
      portfolioId: portfolio.id,
      name: "Jiganto Platform Build Programme",
      description: "Core platform development programme covering architecture, modules, and infrastructure",
      status: "active",
      ragStatus: "amber",
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 9, 31))
    },
    {
      tenantId,
      portfolioId: portfolio.id,
      name: "Jiganto Market Launch Programme",
      description: "Market entry programme covering early adopter acquisition, LOI generation, and lighthouse client development",
      status: "active",
      ragStatus: "amber",
      startDate: formatDate(new Date(today.getFullYear(), 2, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      portfolioId: portfolio.id,
      name: "Platform AI Programme",
      description: "AI and CUI development programme enabling conversational interfaces across all platform modules",
      status: "active",
      ragStatus: "green",
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 9, 31))
    },
    {
      tenantId,
      portfolioId: portfolio.id,
      name: "Billing & Subscription Programme",
      description: "Commercial platform programme covering pricing tiers, billing automation, and payment processing",
      status: "planning",
      ragStatus: "amber",
      startDate: formatDate(new Date(today.getFullYear(), 5, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      portfolioId: portfolio.id,
      name: "Partner Ecosystem Programme",
      description: "Ecosystem development programme covering integration marketplace, partner onboarding, and developer tools",
      status: "planning",
      ragStatus: "green",
      startDate: formatDate(new Date(today.getFullYear(), 5, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    },
    {
      tenantId,
      portfolioId: portfolio.id,
      name: "Security & Compliance Programme",
      description: "Trust and governance programme covering ISO 27001, SOC2, and GDPR certification readiness",
      status: "active",
      ragStatus: "red",
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    }
  ];

  const insertedProgrammes = await db.insert(pmPrograms).values(programmesData).returning();
  const programmeMap = Object.fromEntries(insertedProgrammes.map(p => [p.name, p.id]));

  // Create 6 Projects linked to Programmes and Initiatives
  const projectsData = [
    {
      tenantId,
      programId: programmeMap["Jiganto Platform Build Programme"],
      portfolioId: portfolio.id,
      initiativeId: initiativeMap["Core Platform Services Initiative"],
      code: "JIG-001",
      name: "AI CUI Engine Build",
      description: "Build the AI-powered Conversational UI engine, multi-tenant security model, workflow builder, and document versioning system",
      projectType: "large_project" as const,
      methodology: "hybrid" as const,
      status: "active",
      ragStatus: "amber",
      priority: "critical",
      progress: 45,
      startDate: formatDate(new Date(today.getFullYear(), 0, 15)),
      endDate: formatDate(new Date(today.getFullYear(), 9, 31))
    },
    {
      tenantId,
      programId: programmeMap["Jiganto Market Launch Programme"],
      portfolioId: portfolio.id,
      initiativeId: initiativeMap["Early Adopter Programme"],
      code: "JIG-002",
      name: "Early Adopter Portal",
      description: "Build the early adopter portal including pilot onboarding flow, feedback capture workflow, and client dashboard",
      projectType: "small_project" as const,
      methodology: "agile" as const,
      status: "active",
      ragStatus: "amber",
      priority: "critical",
      progress: 20,
      startDate: formatDate(new Date(today.getFullYear(), 2, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 8, 30))
    },
    {
      tenantId,
      programId: programmeMap["Platform AI Programme"],
      portfolioId: portfolio.id,
      initiativeId: initiativeMap["LLM Integration Layer"],
      code: "JIG-003",
      name: "Module-specific AI Integrations",
      description: "Build AI integrations for CRM, Project Management, and other modules enabling conversational task execution",
      projectType: "large_project" as const,
      methodology: "agile" as const,
      status: "active",
      ragStatus: "green",
      priority: "critical",
      progress: 30,
      startDate: formatDate(new Date(today.getFullYear(), 1, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 9, 31))
    },
    {
      tenantId,
      programId: programmeMap["Billing & Subscription Programme"],
      portfolioId: portfolio.id,
      initiativeId: initiativeMap["Subscription & Billing Initiative"],
      code: "JIG-004",
      name: "Billing Engine Development",
      description: "Develop the subscription management module, invoice automation, and Stripe payment gateway integration",
      projectType: "small_project" as const,
      methodology: "agile" as const,
      status: "planning",
      ragStatus: "amber",
      priority: "high",
      progress: 5,
      startDate: formatDate(new Date(today.getFullYear(), 5, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 30))
    },
    {
      tenantId,
      programId: programmeMap["Partner Ecosystem Programme"],
      portfolioId: portfolio.id,
      initiativeId: initiativeMap["Marketplace & Integration Initiative"],
      code: "JIG-005",
      name: "Integration Hub",
      description: "Build the API catalog, developer sandbox, integration onboarding wizard, and marketplace portal",
      projectType: "small_project" as const,
      methodology: "agile" as const,
      status: "planning",
      ragStatus: "green",
      priority: "high",
      progress: 10,
      startDate: formatDate(new Date(today.getFullYear(), 5, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 30))
    },
    {
      tenantId,
      programId: programmeMap["Security & Compliance Programme"],
      portfolioId: portfolio.id,
      initiativeId: initiativeMap["Security & Compliance Initiative"],
      code: "JIG-006",
      name: "Certification Readiness",
      description: "Prepare for ISO 27001 certification, SOC2 Type 1 readiness, and GDPR compliance verification",
      projectType: "small_project" as const,
      methodology: "waterfall" as const,
      status: "active",
      ragStatus: "red",
      priority: "critical",
      progress: 15,
      startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
      endDate: formatDate(new Date(today.getFullYear(), 11, 31))
    }
  ];

  const insertedProjects = await db.insert(pmProjects).values(projectsData).returning();
  const projectMap = Object.fromEntries(insertedProjects.map(p => [p.name, p.id]));

  // Update initiatives with projectId references
  for (const proj of insertedProjects) {
    if (proj.initiativeId) {
      await db.update(initiatives)
        .set({ projectId: proj.id })
        .where(eq(initiatives.id, proj.initiativeId));
    }
  }

  // ============================================
  // 15b. PROJECT PHASES
  // ============================================

  const phasesData = [
    // AI CUI Engine Build phases
    { tenantId, projectId: projectMap["AI CUI Engine Build"], name: "Architecture & Design", phaseNumber: 1, methodology: "waterfall", status: "completed", progress: 100, plannedStartDate: formatDate(new Date(today.getFullYear(), 0, 15)), plannedEndDate: formatDate(new Date(today.getFullYear(), 1, 28)) },
    { tenantId, projectId: projectMap["AI CUI Engine Build"], name: "Core Platform Build", phaseNumber: 2, methodology: "agile", status: "in_progress", progress: 55, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, projectId: projectMap["AI CUI Engine Build"], name: "Integration & Testing", phaseNumber: 3, methodology: "agile", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 7, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 8, 30)) },
    { tenantId, projectId: projectMap["AI CUI Engine Build"], name: "Pilot Deployment", phaseNumber: 4, methodology: "waterfall", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 9, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 31)) },

    // Early Adopter Portal phases
    { tenantId, projectId: projectMap["Early Adopter Portal"], name: "Discovery & Design", phaseNumber: 1, methodology: "agile", status: "completed", progress: 100, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 2, 31)) },
    { tenantId, projectId: projectMap["Early Adopter Portal"], name: "Portal Development", phaseNumber: 2, methodology: "agile", status: "in_progress", progress: 30, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, projectId: projectMap["Early Adopter Portal"], name: "Launch & Iterate", phaseNumber: 3, methodology: "agile", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 7, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 8, 30)) },

    // Module-specific AI Integrations phases
    { tenantId, projectId: projectMap["Module-specific AI Integrations"], name: "Intent Mapping & Research", phaseNumber: 1, methodology: "agile", status: "in_progress", progress: 60, plannedStartDate: formatDate(new Date(today.getFullYear(), 1, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 3, 30)) },
    { tenantId, projectId: projectMap["Module-specific AI Integrations"], name: "CRM AI Integration", phaseNumber: 2, methodology: "agile", status: "in_progress", progress: 25, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, projectId: projectMap["Module-specific AI Integrations"], name: "PM AI Integration", phaseNumber: 3, methodology: "agile", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 6, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 31)) },

    // Billing Engine Development phases
    { tenantId, projectId: projectMap["Billing Engine Development"], name: "Pricing Design", phaseNumber: 1, methodology: "waterfall", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 5, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 15)) },
    { tenantId, projectId: projectMap["Billing Engine Development"], name: "Billing Engine Build", phaseNumber: 2, methodology: "agile", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 6, 16)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 31)) },
    { tenantId, projectId: projectMap["Billing Engine Development"], name: "Payment Integration & Testing", phaseNumber: 3, methodology: "agile", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 10, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 11, 30)) },

    // Integration Hub phases
    { tenantId, projectId: projectMap["Integration Hub"], name: "API Design & Documentation", phaseNumber: 1, methodology: "waterfall", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 5, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 7, 15)) },
    { tenantId, projectId: projectMap["Integration Hub"], name: "Marketplace Build", phaseNumber: 2, methodology: "agile", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 7, 16)), plannedEndDate: formatDate(new Date(today.getFullYear(), 10, 30)) },
    { tenantId, projectId: projectMap["Integration Hub"], name: "Partner Onboarding", phaseNumber: 3, methodology: "waterfall", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 11, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 11, 30)) },

    // Certification Readiness phases
    { tenantId, projectId: projectMap["Certification Readiness"], name: "Gap Analysis", phaseNumber: 1, methodology: "waterfall", status: "completed", progress: 100, plannedStartDate: formatDate(new Date(today.getFullYear(), 0, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 1, 28)) },
    { tenantId, projectId: projectMap["Certification Readiness"], name: "Policy & Controls Implementation", phaseNumber: 2, methodology: "waterfall", status: "in_progress", progress: 25, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 7, 31)) },
    { tenantId, projectId: projectMap["Certification Readiness"], name: "Audit Preparation & Execution", phaseNumber: 3, methodology: "waterfall", status: "not_started", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 8, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 11, 31)) }
  ];

  const insertedPhases = await db.insert(pmProjectPhases).values(phasesData).returning();

  // ============================================
  // 15c. PROJECT TASKS (Key tasks from user's epics/tasks)
  // ============================================

  const projectTasksData = [
    // AI CUI Engine Build tasks
    { tenantId, projectId: projectMap["AI CUI Engine Build"], phaseId: insertedPhases[1].id, name: "Implement multi-tenant security model", status: "in_progress", priority: "critical", progress: 60, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 4, 31)) },
    { tenantId, projectId: projectMap["AI CUI Engine Build"], phaseId: insertedPhases[1].id, name: "Build workflow builder engine", status: "in_progress", priority: "critical", progress: 40, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, projectId: projectMap["AI CUI Engine Build"], phaseId: insertedPhases[1].id, name: "Implement document versioning system", status: "in_progress", priority: "high", progress: 50, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 15)), plannedEndDate: formatDate(new Date(today.getFullYear(), 5, 30)) },
    { tenantId, projectId: projectMap["AI CUI Engine Build"], phaseId: insertedPhases[1].id, name: "Implement document version API", status: "in_progress", priority: "high", progress: 70, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 3, 30)) },
    { tenantId, projectId: projectMap["AI CUI Engine Build"], phaseId: insertedPhases[1].id, name: "Build workspace permissions UI", status: "in_progress", priority: "high", progress: 45, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 15)), plannedEndDate: formatDate(new Date(today.getFullYear(), 4, 15)) },
    { tenantId, projectId: projectMap["AI CUI Engine Build"], phaseId: insertedPhases[2].id, name: "Create onboarding wizard", status: "todo", priority: "medium", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 7, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 8, 15)) },

    // Early Adopter Portal tasks
    { tenantId, projectId: projectMap["Early Adopter Portal"], phaseId: insertedPhases[4].id, name: "Design pilot onboarding flow", status: "done", priority: "critical", progress: 100, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 2, 15)) },
    { tenantId, projectId: projectMap["Early Adopter Portal"], phaseId: insertedPhases[5].id, name: "Create LOI template", status: "done", priority: "high", progress: 100, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 10)), plannedEndDate: formatDate(new Date(today.getFullYear(), 2, 15)) },
    { tenantId, projectId: projectMap["Early Adopter Portal"], phaseId: insertedPhases[5].id, name: "Build client dashboard", status: "in_progress", priority: "high", progress: 35, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 4, 31)) },
    { tenantId, projectId: projectMap["Early Adopter Portal"], phaseId: insertedPhases[5].id, name: "Build feedback capture workflow", status: "todo", priority: "high", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 5, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, projectId: projectMap["Early Adopter Portal"], phaseId: insertedPhases[5].id, name: "Set up email notifications for pilots", status: "todo", priority: "medium", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 5, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 5, 15)) },

    // Module-specific AI Integrations tasks
    { tenantId, projectId: projectMap["Module-specific AI Integrations"], phaseId: insertedPhases[7].id, name: "Map AI intents per module", status: "in_progress", priority: "critical", progress: 60, plannedStartDate: formatDate(new Date(today.getFullYear(), 1, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 3, 30)) },
    { tenantId, projectId: projectMap["Module-specific AI Integrations"], phaseId: insertedPhases[8].id, name: "Build CRM AI task automation", status: "in_progress", priority: "high", progress: 25, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, projectId: projectMap["Module-specific AI Integrations"], phaseId: insertedPhases[8].id, name: "Train AI on sample workflows", status: "in_progress", priority: "high", progress: 30, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 15)), plannedEndDate: formatDate(new Date(today.getFullYear(), 5, 30)) },
    { tenantId, projectId: projectMap["Module-specific AI Integrations"], phaseId: insertedPhases[9].id, name: "Build PM AI task automation", status: "todo", priority: "high", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 6, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 31)) },
    { tenantId, projectId: projectMap["Module-specific AI Integrations"], phaseId: insertedPhases[9].id, name: "Build fallback for unsupported actions", status: "todo", priority: "medium", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 8, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 15)) },

    // Billing Engine Development tasks
    { tenantId, projectId: projectMap["Billing Engine Development"], phaseId: insertedPhases[10].id, name: "Design pricing tiers (Standard/Family/Enterprise)", status: "todo", priority: "critical", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 5, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 5, 30)) },
    { tenantId, projectId: projectMap["Billing Engine Development"], phaseId: insertedPhases[11].id, name: "Integrate payment gateways (Stripe)", status: "todo", priority: "critical", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 6, 16)), plannedEndDate: formatDate(new Date(today.getFullYear(), 7, 31)) },
    { tenantId, projectId: projectMap["Billing Engine Development"], phaseId: insertedPhases[11].id, name: "Build subscription management module", status: "todo", priority: "critical", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 7, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 15)) },
    { tenantId, projectId: projectMap["Billing Engine Development"], phaseId: insertedPhases[11].id, name: "Build invoice automation", status: "todo", priority: "high", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 9, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 31)) },
    { tenantId, projectId: projectMap["Billing Engine Development"], phaseId: insertedPhases[12].id, name: "Test subscription renewals", status: "todo", priority: "high", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 10, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 10, 15)) },
    { tenantId, projectId: projectMap["Billing Engine Development"], phaseId: insertedPhases[12].id, name: "Build admin billing dashboard", status: "todo", priority: "medium", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 10, 16)), plannedEndDate: formatDate(new Date(today.getFullYear(), 11, 30)) },

    // Integration Hub tasks
    { tenantId, projectId: projectMap["Integration Hub"], phaseId: insertedPhases[13].id, name: "Build API documentation", status: "in_progress", priority: "high", progress: 20, plannedStartDate: formatDate(new Date(today.getFullYear(), 5, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, projectId: projectMap["Integration Hub"], phaseId: insertedPhases[13].id, name: "Design API catalog structure", status: "todo", priority: "high", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 5, 15)), plannedEndDate: formatDate(new Date(today.getFullYear(), 7, 15)) },
    { tenantId, projectId: projectMap["Integration Hub"], phaseId: insertedPhases[14].id, name: "Build developer sandbox", status: "todo", priority: "high", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 7, 16)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 30)) },
    { tenantId, projectId: projectMap["Integration Hub"], phaseId: insertedPhases[14].id, name: "Create integration onboarding wizard", status: "todo", priority: "medium", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 9, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 30)) },
    { tenantId, projectId: projectMap["Integration Hub"], phaseId: insertedPhases[14].id, name: "Publish marketplace portal", status: "todo", priority: "high", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 10, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 10, 30)) },

    // Certification Readiness tasks
    { tenantId, projectId: projectMap["Certification Readiness"], phaseId: insertedPhases[16].id, name: "Complete security gap analysis", status: "done", priority: "critical", progress: 100, plannedStartDate: formatDate(new Date(today.getFullYear(), 0, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 1, 15)) },
    { tenantId, projectId: projectMap["Certification Readiness"], phaseId: insertedPhases[17].id, name: "Perform penetration testing", status: "in_progress", priority: "critical", progress: 40, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 5, 30)) },
    { tenantId, projectId: projectMap["Certification Readiness"], phaseId: insertedPhases[17].id, name: "Implement privacy & data handling policies", status: "in_progress", priority: "critical", progress: 30, plannedStartDate: formatDate(new Date(today.getFullYear(), 2, 15)), plannedEndDate: formatDate(new Date(today.getFullYear(), 7, 31)) },
    { tenantId, projectId: projectMap["Certification Readiness"], phaseId: insertedPhases[17].id, name: "Review data handling procedures", status: "in_progress", priority: "high", progress: 45, plannedStartDate: formatDate(new Date(today.getFullYear(), 3, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 4, 30)) },
    { tenantId, projectId: projectMap["Certification Readiness"], phaseId: insertedPhases[17].id, name: "Conduct internal compliance training", status: "todo", priority: "medium", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 5, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 6, 31)) },
    { tenantId, projectId: projectMap["Certification Readiness"], phaseId: insertedPhases[18].id, name: "Submit ISO 27001 certification application", status: "todo", priority: "critical", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 8, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 9, 31)) },
    { tenantId, projectId: projectMap["Certification Readiness"], phaseId: insertedPhases[18].id, name: "Complete SOC2 Type 1 audit", status: "todo", priority: "critical", progress: 0, plannedStartDate: formatDate(new Date(today.getFullYear(), 10, 1)), plannedEndDate: formatDate(new Date(today.getFullYear(), 11, 31)) }
  ];

  await db.insert(pmTasks).values(projectTasksData);

  return {
    message: "Jiganto Market Launch Strategy data seeded successfully!",
    summary: {
      strategyItems: strategyData.length,
      risks: risksData.length,
      departments: departmentsData.length,
      processes: processesData.length,
      tools: toolsData.length,
      goals: goalsData.length,
      objectives: objectivesData.length,
      keyResults: keyResultsData.length,
      kpis: kpisData.length,
      initiatives: initiativesData.length,
      okrs: okrsData.length,
      okrKeyResults: okrKeyResultsData.length,
      tasks: tasksData.length,
      meetings: meetingsData.length,
      documentLinks: documentLinksData.length,
      initiativeDocuments: initiativeDocumentsData.length,
      documentInitiativeLinks: documentInitiativeLinksData.length,
      portfolio: 1,
      programmes: programmesData.length,
      projects: projectsData.length,
      projectPhases: phasesData.length,
      projectTasks: projectTasksData.length
    }
  };
}

export async function clearDemoCorpData(tenantId: number) {
  // 1. Clear RACI tables first (NO ACTION FK to pm_projects, pm_workstreams, pm_project_phases)
  await db.delete(pmRaciAssignments).where(eq(pmRaciAssignments.tenantId, tenantId));
  await db.delete(pmRaciActivities).where(eq(pmRaciActivities.tenantId, tenantId));
  await db.delete(pmRaciRoles).where(eq(pmRaciRoles.tenantId, tenantId));

  // 2. Clear project child tables (most cascade, but explicit is safer)
  await db.delete(pmTasks).where(eq(pmTasks.tenantId, tenantId));
  await db.delete(pmBacklogItems).where(eq(pmBacklogItems.tenantId, tenantId));
  await db.delete(pmBusinessRequirements).where(eq(pmBusinessRequirements.tenantId, tenantId));
  await db.delete(pmRaiddItems).where(eq(pmRaiddItems.tenantId, tenantId));
  await db.delete(pmTeamMembers).where(eq(pmTeamMembers.tenantId, tenantId));
  await db.delete(pmWorkstreams).where(eq(pmWorkstreams.tenantId, tenantId));
  await db.delete(pmSprints).where(eq(pmSprints.tenantId, tenantId));
  await db.delete(pmMilestones).where(eq(pmMilestones.tenantId, tenantId));
  await db.delete(pmProjectPhases).where(eq(pmProjectPhases.tenantId, tenantId));

  // 3. Clear projects, programs, portfolios (pm_projects references initiatives with NO ACTION)
  await db.delete(pmProjects).where(eq(pmProjects.tenantId, tenantId));
  await db.delete(pmPrograms).where(eq(pmPrograms.tenantId, tenantId));
  await db.delete(pmPortfolios).where(eq(pmPortfolios.tenantId, tenantId));

  // 4. Clear document data (document child tables cascade from documents)
  await db.delete(documentInitiativeLinks).where(eq(documentInitiativeLinks.tenantId, tenantId));
  await db.delete(documents).where(eq(documents.tenantId, tenantId));
  await db.delete(documentFolders).where(eq(documentFolders.tenantId, tenantId));
  await db.delete(documentLinks).where(eq(documentLinks.tenantId, tenantId));

  // 5. Clear business management data (respect FK order)
  await db.delete(meetings).where(eq(meetings.tenantId, tenantId));
  await db.delete(businessTasks).where(eq(businessTasks.tenantId, tenantId));
  await db.delete(kpis).where(eq(kpis.tenantId, tenantId));
  await db.delete(okrs).where(eq(okrs.tenantId, tenantId));
  await db.delete(keyResults).where(eq(keyResults.tenantId, tenantId));
  await db.delete(initiatives).where(eq(initiatives.tenantId, tenantId));
  await db.delete(objectives).where(eq(objectives.tenantId, tenantId));
  await db.delete(goals).where(eq(goals.tenantId, tenantId));
  await db.delete(risks).where(eq(risks.tenantId, tenantId));
  await db.delete(strategyItems).where(eq(strategyItems.tenantId, tenantId));
  await db.delete(tools).where(eq(tools.tenantId, tenantId));
  await db.delete(processes).where(eq(processes.tenantId, tenantId));
  await db.delete(departments).where(eq(departments.tenantId, tenantId));
  
  return { message: "Jiganto data cleared successfully" };
}
