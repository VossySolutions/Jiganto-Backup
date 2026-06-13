
import { 
  tenants, profiles, userModulePermissions, modules, boards, columns, items,
  userRoles, userInvitations, notifications, feedback,
  orgUnits, userProjectAssignments, costCentres,
  type OrgUnit, type InsertOrgUnit,
  type CostCentre, type InsertCostCentre,
  type UserProjectAssignment, type InsertUserProjectAssignment,
  projects, customers, projectMembers, channels, channelMembers, chatMessages, messageReactions, userFavorites, channelFavorites, messageAttachments, pinnedMessages,
  crmAccounts, crmContacts, crmContactRelationships, crmLeads, crmPipelines, crmOpportunityStages, crmOpportunities,
  crmResourceRequirements, crmActivities, crmTasks, crmNotes, crmContracts, crmCustomerSystems, crmAttachments,
  crmSavedViews, crmEmailTemplates, crmEmailLogs, crmForecasts, crmTerritories, crmAutomationRules, crmCustomFields,
  strategyItems, risks, departments, processes, tools, goals, objectives, okrs, keyResults, kpis, initiatives, businessTasks, meetings, documentLinks,
  governanceItems, strategyDocumentLinks, strategyKpiValues, strategyReviewNotes, strategyRagHistory,
  strategyRefCounters, strategyEntityRefs,
  documentFolders, documents, documentVersions, tags, documentTags, documentAcl, documentComments, documentTemplates, documentAuditLogs, documentInitiativeLinks,
  tasks, taskBoards, taskLinks, taskSubtasks, taskViews,
  pmPortfolios, pmPrograms, pmProjects, pmProjectPhases, pmMilestones, pmTasks, pmTeamMembers, pmRaiddItems, pmPhaseTemplates, pmProjectTools,
  pmDeliverablePhases, pmDeliverables,
  type Tenant, type Profile, type Module, type Board, type Column, type Item,
  type InsertTenant, type InsertProfile, type InsertModule, type InsertBoard, type InsertColumn, type InsertItem,
  type UserRole, type InsertUserRole, type UserInvitation, type InsertUserInvitation,
  type Project, type InsertProject, type Customer, type InsertCustomer,
  type ProjectMember, type InsertProjectMember, type Channel, type InsertChannel,
  type ChannelMember, type InsertChannelMember, type ChatMessage, type InsertChatMessage,
  type MessageReaction, type InsertMessageReaction, type UserFavorite,
  type ChatInboxItem, type ChatMessageWithMeta, type ChatSearchHit, type ChannelBridgeConfig, type ChatNotificationPref,
  type MessageAttachment, type InsertMessageAttachment, type PinnedMessage,
  type CrmAccount, type InsertCrmAccount, type CrmContact, type InsertCrmContact,
  type CrmContactRelationship, type InsertCrmContactRelationship,
  type CrmLead, type InsertCrmLead, type CrmPipeline, type InsertCrmPipeline, type CrmOpportunityStage, type InsertCrmOpportunityStage,
  type CrmOpportunity, type InsertCrmOpportunity, type CrmResourceRequirement, type InsertCrmResourceRequirement,
  type CrmActivity, type InsertCrmActivity, type CrmTask, type InsertCrmTask,
  type CrmNote, type InsertCrmNote, type CrmContract, type InsertCrmContract,
  type CrmCustomerSystem, type InsertCrmCustomerSystem, type CrmAttachment, type InsertCrmAttachment,
  type CrmSavedView, type InsertCrmSavedView, type CrmEmailTemplate, type InsertCrmEmailTemplate,
  type CrmEmailLog, type InsertCrmEmailLog, type CrmForecast, type InsertCrmForecast,
  type CrmTerritory, type InsertCrmTerritory, type CrmAutomationRule, type InsertCrmAutomationRule,
  type CrmCustomField, type InsertCrmCustomField,
  type StrategyItem, type InsertStrategyItem, type Risk, type InsertRisk,
  type Department, type InsertDepartment, type Process, type InsertProcess, type Tool, type InsertTool,
  type Goal, type InsertGoal, type Objective, type InsertObjective, type Okr, type InsertOkr,
  type KeyResult, type InsertKeyResult, type Kpi, type InsertKpi,
  type Initiative, type InsertInitiative, type BusinessTask, type InsertBusinessTask,
  type Meeting, type InsertMeeting, type DocumentLink, type InsertDocumentLink,
  type DocumentFolder, type InsertDocumentFolder, type Document, type InsertDocument,
  type DocumentVersion, type InsertDocumentVersion, type Tag as DocTag, type InsertTag as InsertDocTag,
  type DocumentTag, type InsertDocumentTag, type DocumentAcl, type InsertDocumentAcl,
  type DocumentComment, type InsertDocumentComment, type DocumentTemplate, type InsertDocumentTemplate,
  type DocumentAuditLog, type InsertDocumentAuditLog, type DocumentInitiativeLink, type InsertDocumentInitiativeLink,
  type Task, type InsertTask, type TaskBoard, type InsertTaskBoard,
  type TaskLink, type InsertTaskLink, type TaskSubtask, type InsertTaskSubtask,
  type TaskView, type InsertTaskView,
  type Notification, type InsertNotification,
  type Feedback, type InsertFeedback,
  type UserModulePermission, type InsertUserModulePermission,
  type PmPortfolio, type InsertPmPortfolio, type PmProgram, type InsertPmProgram,
  type PmProject, type InsertPmProject, type PmProjectPhase, type InsertPmProjectPhase,
  type PmMilestone, type InsertPmMilestone, type PmTask, type InsertPmTask,
  type PmTeamMember, type InsertPmTeamMember, type PmRaiddItem, type InsertPmRaiddItem,
  type PmDeliverablePhase, type InsertPmDeliverablePhase, type PmDeliverable, type InsertPmDeliverable,
  type PmBusinessRequirement, type InsertPmBusinessRequirement, pmBusinessRequirements,
  type PmPhaseTemplate, type InsertPmPhaseTemplate,
  type PmWorkstream, type InsertPmWorkstream, type PmSprint, type InsertPmSprint,
  type PmBacklogItem, type InsertPmBacklogItem,
  type PmProjectTool, type InsertPmProjectTool,
  pmWorkstreams, pmSprints, pmBacklogItems,
  pmAgileWorkstreams, pmEpics, pmAgileSprints, pmAgileStories, pmAgileDefects,
  type PmAgileWorkstream, type InsertPmAgileWorkstream,
  type PmEpic, type InsertPmEpic,
  type PmAgileSprint, type InsertPmAgileSprint,
  type PmAgileStory, type InsertPmAgileStory,
  type PmAgileDefect, type InsertPmAgileDefect,
  type PmRaciRole, type InsertPmRaciRole, type PmRaciActivity, type InsertPmRaciActivity,
  type PmRaciType, type InsertPmRaciType, type PmRaciAssignment, type InsertPmRaciAssignment,
  type PmRaciTemplate, type InsertPmRaciTemplate,
  pmRaciRoles, pmRaciActivities, pmRaciTypes, pmRaciAssignments, pmRaciTemplates,
  rateCards, rateCardItems, resourcePlanTemplates, resourcePlanTemplateRows,
  opportunityResourcePlans, opportunityResourceRows,
  type RateCard, type InsertRateCard, type RateCardItem, type InsertRateCardItem,
  type ResourcePlanTemplate, type InsertResourcePlanTemplate, type ResourcePlanTemplateRow, type InsertResourcePlanTemplateRow,
  type OpportunityResourcePlan, type InsertOpportunityResourcePlan, type OpportunityResourceRow, type InsertOpportunityResourceRow,
  resources, skillCategories, skills, resourceSkills, resourceAllocations, timesheetPeriods, timesheetEntries, projectCodes,
  type Resource, type InsertResource, type SkillCategory, type InsertSkillCategory,
  type Skill, type InsertSkill, type ResourceSkill, type InsertResourceSkill,
  type ResourceAllocation, type InsertResourceAllocation,
  type TimesheetPeriod, type InsertTimesheetPeriod, type TimesheetEntry, type InsertTimesheetEntry,
  type ProjectCode, type InsertProjectCode,
  bpmDiagrams, bpmNodes, bpmEdges, bpmSwimlanes, bpmLibraries, bpmTemplates, bpmAttachments,
  type BpmDiagram, type InsertBpmDiagram, type BpmNode, type InsertBpmNode,
  type BpmEdge, type InsertBpmEdge, type BpmSwimlane, type InsertBpmSwimlane,
  type BpmLibrary, type InsertBpmLibrary,
  type BpmTemplate, type InsertBpmTemplate, type BpmAttachment, type InsertBpmAttachment,
  frameworks, type Framework, type InsertFramework,
  portalMenuNodes, portalDiagramAssignments, processResources,
  type PortalMenuNode, type InsertPortalMenuNode,
  type PortalDiagramAssignment, type InsertPortalDiagramAssignment,
  type ProcessResource, type InsertProcessResource,
  orgCharts, orgChartMembers, orgChartTemplates,
  type OrgChart, type InsertOrgChart,
  type OrgChartMember, type InsertOrgChartMember,
  type OrgChartTemplate, type InsertOrgChartTemplate,
  workspaces, workspacePages, workspaceDatabases, workspaceDatabaseColumns, workspaceDatabaseRows, workspaceSavedViews,
  workspaceMembers,
  type Workspace, type InsertWorkspace,
  type WorkspaceMember, type InsertWorkspaceMember,
  type WorkspacePage, type InsertWorkspacePage,
  type WorkspaceDatabase, type InsertWorkspaceDatabase,
  type WorkspaceDatabaseColumn, type InsertWorkspaceDatabaseColumn,
  type WorkspaceDatabaseRow, type InsertWorkspaceDatabaseRow,
  type WorkspaceSavedView, type InsertWorkspaceSavedView,
  tmProjects, tmTestSuites, tmTestCases, tmTestSteps, tmTestRuns, tmTestResults, tmDefects, tmRequirements, tmScenarios,
  type TmProject, type InsertTmProject,
  type TmTestSuite, type InsertTmTestSuite,
  type TmTestCase, type InsertTmTestCase,
  type TmTestStep, type InsertTmTestStep,
  type TmTestRun, type InsertTmTestRun,
  type TmTestResult, type InsertTmTestResult,
  type TmDefect, type InsertTmDefect,
  type TmRequirement, type InsertTmRequirement,
  type TmScenario, type InsertTmScenario,
} from "@shared/schema";
import {
  bpmlTemplates, bpmlEntries,
  type BpmlTemplate, type InsertBpmlTemplate,
  type BpmlEntry, type InsertBpmlEntry,
} from "@shared/models/bpml";
import {
  signoffRequests, signoffSigners, signoffAuditLog,
  type SignoffRequest, type InsertSignoffRequest,
  type SignoffSigner, type InsertSignoffSigner,
  type SignoffAuditLog, type InsertSignoffAuditLog,
  type SignoffRequestWithDetails,
} from "@shared/models/signoff";
import {
  type StrategyReviewNote, type InsertStrategyReviewNote,
  type StrategyRagHistory, type InsertStrategyRagHistory,
  type GovernanceItem, type InsertGovernanceItem,
  type StrategyDocumentLink, type InsertStrategyDocumentLink,
  type StrategyKpiValue, type InsertStrategyKpiValue,
} from "@shared/models/business";
import {
  surveys, surveyQuestions, surveyResponses, surveyAnswers,
  type Survey, type InsertSurvey,
  type SurveyQuestion, type InsertSurveyQuestion,
  type SurveyResponse, type InsertSurveyResponse,
  type SurveyAnswer, type InsertSurveyAnswer,
  type SurveyWithDetails, type SurveyResponseWithAnswers,
} from "@shared/models/surveys";
import {
  clients, clientUsers, clientModuleVisibility, clientInvitations,
  type Client, type InsertClient,
  type ClientUser, type InsertClientUser,
  type ClientModuleVisibility, type ClientInvitation,
} from "@shared/models/clients";
import { documents } from "@shared/models/documents";
import { db } from "./db";
import { eq, and, desc, isNull, or, sql, inArray, gt, lt, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { users } from "@shared/models/auth";
import { orgMemberships } from "@shared/models/permissions";

export type GlobalSearchHit = {
  type: "document" | "project" | "task" | "chat";
  id: number;
  title: string;
  subtitle?: string;
  href: string;
};

export interface IStorage {
  // Tenants
  getTenants(): Promise<Tenant[]>;
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, updates: Partial<InsertTenant>): Promise<Tenant | undefined>;

  // User Roles
  getUserRoles(tenantId: number): Promise<UserRole[]>;
  getUserRole(id: number): Promise<UserRole | undefined>;
  createUserRole(role: InsertUserRole): Promise<UserRole>;
  updateUserRole(id: number, updates: Partial<InsertUserRole>): Promise<UserRole | undefined>;
  deleteUserRole(id: number): Promise<void>;

  // User Invitations
  getUserInvitations(tenantId: number): Promise<UserInvitation[]>;
  getUserInvitation(id: number): Promise<UserInvitation | undefined>;
  getUserInvitationByToken(token: string): Promise<UserInvitation | undefined>;
  createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  updateUserInvitation(id: number, updates: Partial<InsertUserInvitation>): Promise<UserInvitation | undefined>;
  deleteUserInvitation(id: number): Promise<void>;

  // Profiles (extended)
  getProfiles(tenantId: number): Promise<(Profile & { user: { id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null } })[]>;
  getProfile(userId: string): Promise<Profile | undefined>;
  getProfileByUserId(userId: string, tenantId: number): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: number, updates: Partial<InsertProfile>): Promise<Profile | undefined>;
  deleteProfile(id: number): Promise<void>;

  // User Module Permissions
  getUserModulePermissions(profileId: number): Promise<UserModulePermission[]>;
  upsertUserModulePermissions(profileId: number, tenantId: number, permissions: { moduleKey: string; canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }[]): Promise<UserModulePermission[]>;

  // Org Units
  getOrgUnits(tenantId: number): Promise<OrgUnit[]>;
  getOrgUnit(id: number): Promise<OrgUnit | undefined>;
  createOrgUnit(orgUnit: InsertOrgUnit): Promise<OrgUnit>;
  updateOrgUnit(id: number, updates: Partial<InsertOrgUnit>): Promise<OrgUnit | undefined>;
  deleteOrgUnit(id: number): Promise<void>;

  // Cost Centres
  getCostCentres(tenantId: number): Promise<CostCentre[]>;
  getCostCentre(id: number): Promise<CostCentre | undefined>;
  createCostCentre(costCentre: InsertCostCentre): Promise<CostCentre>;
  updateCostCentre(id: number, updates: Partial<InsertCostCentre>): Promise<CostCentre | undefined>;
  deleteCostCentre(id: number): Promise<void>;

  // User Project Assignments
  getUserProjectAssignments(profileId: number): Promise<UserProjectAssignment[]>;
  getAssignmentCountsByTenant(tenantId: number): Promise<Record<number, number>>;
  createUserProjectAssignment(assignment: InsertUserProjectAssignment): Promise<UserProjectAssignment>;
  updateUserProjectAssignment(id: number, updates: Partial<InsertUserProjectAssignment>): Promise<UserProjectAssignment | undefined>;
  deleteUserProjectAssignment(id: number): Promise<void>;

  // Modules
  getModules(): Promise<Module[]>;
  createModule(module: InsertModule): Promise<Module>;

  // Boards
  getBoards(tenantId?: number, moduleId?: number, workspaceId?: number): Promise<Board[]>;
  getBoard(id: number): Promise<Board | undefined>;
  createBoard(board: InsertBoard): Promise<Board>;

  // Columns
  getColumns(boardId: number): Promise<Column[]>;
  createColumn(column: InsertColumn): Promise<Column>;

  // Items
  getItems(boardId: number): Promise<Item[]>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, item: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: number): Promise<void>;

  // Projects
  getProjects(tenantId: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<Pick<InsertProject, "name" | "description" | "status">>): Promise<Project | undefined>;
  getUserProjects(userId: string, tenantId: number): Promise<Project[]>;

  // Project Members
  getProjectMembers(projectId: number): Promise<(ProjectMember & { user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]>;
  addProjectMember(member: InsertProjectMember): Promise<ProjectMember>;
  removeProjectMember(projectId: number, userId: string): Promise<void>;
  isProjectMember(projectId: number, userId: string): Promise<boolean>;

  // Channels
  getChannels(tenantId: number, userId: string, projectId?: number | null): Promise<Channel[]>;
  getChannel(id: number): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannel(id: number, updates: Partial<InsertChannel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<void>;

  // Channel Members
  getChannelMembers(channelId: number): Promise<(ChannelMember & { user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]>;
  addChannelMember(member: InsertChannelMember): Promise<ChannelMember>;
  removeChannelMember(channelId: number, userId: string): Promise<void>;
  isChannelMember(channelId: number, userId: string): Promise<boolean>;
  updateLastRead(channelId: number, userId: string): Promise<void>;

  // Messages
  getMessages(channelId: number, limit?: number, before?: number, parentId?: number | null, currentUserId?: string): Promise<ChatMessageWithMeta[]>;
  getMessage(id: number): Promise<ChatMessage | undefined>;
  getMessageWithUser(id: number): Promise<
    (ChatMessage & { user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } }) | undefined
  >;
  createMessage(message: InsertChatMessage): Promise<ChatMessage>;
  updateMessage(id: number, content: string): Promise<ChatMessage | undefined>;
  deleteMessage(id: number): Promise<ChatMessage | undefined>;

  // Reactions
  addReaction(reaction: InsertMessageReaction): Promise<MessageReaction>;
  removeReaction(messageId: number, userId: string, emoji: string): Promise<void>;
  getMessageReactions(messageId: number): Promise<MessageReaction[]>;

  // User Favorites
  getUserFavorites(userId: string, tenantId: number): Promise<{ id: number; favoriteUserId: string; user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } }[]>;
  addUserFavorite(userId: string, favoriteUserId: string, tenantId: number): Promise<UserFavorite>;
  removeUserFavorite(userId: string, favoriteUserId: string, tenantId: number): Promise<void>;

  // User Search
  searchUsers(tenantId: number, query: string, projectId?: number): Promise<{ id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null }[]>;
  getTenantUsers(tenantId: number): Promise<{ id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null }[]>;

  // Direct Messages
  getOrCreateDMChannel(userId: string, otherUserId: string, tenantId: number): Promise<Channel>;
  getDirectMessageChannels(userId: string, tenantId: number): Promise<(Channel & { otherUser: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]>;

  // Chat inbox & favourites
  getChatInbox(userId: string, tenantId: number, clientId?: number): Promise<ChatInboxItem[]>;
  getFavoriteChannelIds(userId: string, tenantId: number): Promise<number[]>;
  addChannelFavorite(userId: string, channelId: number, tenantId: number): Promise<void>;
  removeChannelFavorite(userId: string, channelId: number, tenantId: number): Promise<void>;
  createChatTeam(
    userId: string,
    tenantId: number,
    input: { name: string; description?: string; isPrivate?: boolean; memberIds?: string[] },
  ): Promise<{ project: Project; channel: Channel }>;
  searchChatMessages(userId: string, tenantId: number, query: string, channelId?: number): Promise<ChatSearchHit[]>;
  getThreadReplies(
    parentId: number,
  ): Promise<(ChatMessage & { user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null }; reactions: MessageReaction[] })[]>;

  createMessageAttachment(row: InsertMessageAttachment): Promise<MessageAttachment>;
  linkAttachmentsToMessage(messageId: number, attachmentIds: number[], channelId: number, userId: string): Promise<void>;
  getAttachmentsForMessages(messageIds: number[]): Promise<MessageAttachment[]>;
  pinMessage(channelId: number, messageId: number, userId: string): Promise<PinnedMessage>;
  unpinMessage(channelId: number, messageId: number): Promise<void>;
  getPinnedMessages(channelId: number): Promise<(PinnedMessage & { message: ChatMessage & { user: { id: string; firstName: string | null; lastName: string | null } } })[]>;
  updateChannelBridge(channelId: number, bridgeConfig: ChannelBridgeConfig | null): Promise<Channel | undefined>;
  updateChannelNotificationPref(channelId: number, userId: string, pref: ChatNotificationPref): Promise<void>;
  getChannelMemberRecord(channelId: number, userId: string): Promise<ChannelMember | undefined>;
  isChannelAdmin(channelId: number, userId: string): Promise<boolean>;

  // CRM Accounts
  getCrmAccounts(tenantId: number, clientId?: number): Promise<CrmAccount[]>;
  getCrmAccount(id: number): Promise<CrmAccount | undefined>;
  createCrmAccount(account: InsertCrmAccount): Promise<CrmAccount>;
  updateCrmAccount(id: number, updates: Partial<InsertCrmAccount>): Promise<CrmAccount | undefined>;
  deleteCrmAccount(id: number): Promise<void>;

  // CRM Contacts
  getCrmContacts(tenantId: number, accountId?: number, clientId?: number): Promise<CrmContact[]>;
  getCrmContact(id: number): Promise<CrmContact | undefined>;
  createCrmContact(contact: InsertCrmContact): Promise<CrmContact>;
  updateCrmContact(id: number, updates: Partial<InsertCrmContact>): Promise<CrmContact | undefined>;
  deleteCrmContact(id: number): Promise<void>;

  // CRM Contact Relationships
  getCrmContactRelationships(contactId: number): Promise<CrmContactRelationship[]>;
  createCrmContactRelationship(relationship: InsertCrmContactRelationship): Promise<CrmContactRelationship>;
  deleteCrmContactRelationship(id: number): Promise<void>;

  // CRM Saved Views
  getCrmSavedViews(tenantId: number, entityType?: string, userId?: string): Promise<CrmSavedView[]>;
  getCrmSavedView(id: number): Promise<CrmSavedView | undefined>;
  createCrmSavedView(view: InsertCrmSavedView): Promise<CrmSavedView>;
  updateCrmSavedView(id: number, updates: Partial<InsertCrmSavedView>): Promise<CrmSavedView | undefined>;
  deleteCrmSavedView(id: number): Promise<void>;

  // CRM Email Templates
  getCrmEmailTemplates(tenantId: number): Promise<CrmEmailTemplate[]>;
  getCrmEmailTemplate(id: number): Promise<CrmEmailTemplate | undefined>;
  createCrmEmailTemplate(template: InsertCrmEmailTemplate): Promise<CrmEmailTemplate>;
  updateCrmEmailTemplate(id: number, updates: Partial<InsertCrmEmailTemplate>): Promise<CrmEmailTemplate | undefined>;
  deleteCrmEmailTemplate(id: number): Promise<void>;

  // CRM Email Logs
  getCrmEmailLogs(tenantId: number, entityType?: string, entityId?: number): Promise<CrmEmailLog[]>;
  createCrmEmailLog(log: InsertCrmEmailLog): Promise<CrmEmailLog>;

  // CRM Forecasts
  getCrmForecasts(tenantId: number, userId?: string): Promise<CrmForecast[]>;
  getCrmForecast(id: number): Promise<CrmForecast | undefined>;
  createCrmForecast(forecast: InsertCrmForecast): Promise<CrmForecast>;
  updateCrmForecast(id: number, updates: Partial<InsertCrmForecast>): Promise<CrmForecast | undefined>;
  deleteCrmForecast(id: number): Promise<void>;

  // CRM Territories
  getCrmTerritories(tenantId: number): Promise<CrmTerritory[]>;
  getCrmTerritory(id: number): Promise<CrmTerritory | undefined>;
  createCrmTerritory(territory: InsertCrmTerritory): Promise<CrmTerritory>;
  updateCrmTerritory(id: number, updates: Partial<InsertCrmTerritory>): Promise<CrmTerritory | undefined>;
  deleteCrmTerritory(id: number): Promise<void>;

  // CRM Automation Rules
  getCrmAutomationRules(tenantId: number, entityType?: string): Promise<CrmAutomationRule[]>;
  getCrmAutomationRule(id: number): Promise<CrmAutomationRule | undefined>;
  createCrmAutomationRule(rule: InsertCrmAutomationRule): Promise<CrmAutomationRule>;
  updateCrmAutomationRule(id: number, updates: Partial<InsertCrmAutomationRule>): Promise<CrmAutomationRule | undefined>;
  deleteCrmAutomationRule(id: number): Promise<void>;

  // CRM Custom Fields
  getCrmCustomFields(tenantId: number, entityType?: string): Promise<CrmCustomField[]>;
  createCrmCustomField(field: InsertCrmCustomField): Promise<CrmCustomField>;
  updateCrmCustomField(id: number, updates: Partial<InsertCrmCustomField>): Promise<CrmCustomField | undefined>;
  deleteCrmCustomField(id: number): Promise<void>;

  // Rate Cards
  getRateCards(tenantId: number): Promise<RateCard[]>;
  getRateCard(id: number): Promise<RateCard | undefined>;
  createRateCard(card: InsertRateCard): Promise<RateCard>;
  updateRateCard(id: number, updates: Partial<InsertRateCard>): Promise<RateCard | undefined>;
  deleteRateCard(id: number): Promise<void>;
  getRateCardItems(rateCardId: number): Promise<RateCardItem[]>;
  createRateCardItem(item: InsertRateCardItem): Promise<RateCardItem>;
  deleteRateCardItem(id: number): Promise<void>;

  // Resource Plan Templates
  getResourcePlanTemplates(tenantId: number): Promise<ResourcePlanTemplate[]>;
  getResourcePlanTemplate(id: number): Promise<ResourcePlanTemplate | undefined>;
  createResourcePlanTemplate(template: InsertResourcePlanTemplate): Promise<ResourcePlanTemplate>;
  updateResourcePlanTemplate(id: number, updates: Partial<InsertResourcePlanTemplate>): Promise<ResourcePlanTemplate | undefined>;
  deleteResourcePlanTemplate(id: number): Promise<void>;
  getResourcePlanTemplateRows(templateId: number): Promise<ResourcePlanTemplateRow[]>;
  createResourcePlanTemplateRow(row: InsertResourcePlanTemplateRow): Promise<ResourcePlanTemplateRow>;
  deleteResourcePlanTemplateRow(id: number): Promise<void>;

  // Opportunity Resource Plans
  getOpportunityResourcePlan(opportunityId: number): Promise<OpportunityResourcePlan | undefined>;
  getOpportunityResourcePlans(opportunityId: number): Promise<OpportunityResourcePlan[]>;
  getOpportunityResourcePlanById(id: number): Promise<OpportunityResourcePlan | undefined>;
  cloneOpportunityResourcePlan(planId: number, planName?: string): Promise<OpportunityResourcePlan | undefined>;
  cloneCrmOpportunity(id: number): Promise<CrmOpportunity | undefined>;
  createOpportunityResourcePlan(plan: InsertOpportunityResourcePlan): Promise<OpportunityResourcePlan>;
  updateOpportunityResourcePlan(id: number, updates: Partial<InsertOpportunityResourcePlan>): Promise<OpportunityResourcePlan | undefined>;

  // Opportunity Resource Rows
  getOpportunityResourceRows(planId: number): Promise<OpportunityResourceRow[]>;
  getAllOpportunityResourceRowsWithPlans(tenantId: number): Promise<Array<OpportunityResourceRow & { planId: number; opportunityId: number; opportunityName?: string }>>;
  createOpportunityResourceRow(row: InsertOpportunityResourceRow): Promise<OpportunityResourceRow>;
  updateOpportunityResourceRow(id: number, updates: Partial<InsertOpportunityResourceRow>): Promise<OpportunityResourceRow | undefined>;
  deleteOpportunityResourceRow(id: number): Promise<void>;

  // CRM Leads
  getCrmLeads(tenantId: number, clientId?: number): Promise<CrmLead[]>;
  getCrmLead(id: number): Promise<CrmLead | undefined>;
  createCrmLead(lead: InsertCrmLead): Promise<CrmLead>;
  updateCrmLead(id: number, updates: Partial<InsertCrmLead>): Promise<CrmLead | undefined>;
  deleteCrmLead(id: number): Promise<void>;
  convertLead(id: number, accountId: number, contactId: number, opportunityId?: number): Promise<CrmLead | undefined>;

  // CRM Opportunity Stages
  getCrmOpportunityStages(tenantId: number): Promise<CrmOpportunityStage[]>;
  createCrmOpportunityStage(stage: InsertCrmOpportunityStage): Promise<CrmOpportunityStage>;
  updateCrmOpportunityStage(id: number, updates: Partial<InsertCrmOpportunityStage>): Promise<CrmOpportunityStage | undefined>;
  deleteCrmOpportunityStage(id: number): Promise<void>;

  // CRM Opportunities
  getCrmOpportunities(tenantId: number, stageId?: number, accountId?: number, clientId?: number): Promise<CrmOpportunity[]>;
  getCrmOpportunity(id: number): Promise<CrmOpportunity | undefined>;
  createCrmOpportunity(opportunity: InsertCrmOpportunity): Promise<CrmOpportunity>;
  updateCrmOpportunity(id: number, updates: Partial<InsertCrmOpportunity>): Promise<CrmOpportunity | undefined>;
  deleteCrmOpportunity(id: number): Promise<void>;

  // CRM Activities
  getCrmActivities(tenantId: number, entityType?: string, entityId?: number, accountId?: number, clientId?: number): Promise<CrmActivity[]>;
  getCrmActivity(id: number): Promise<CrmActivity | undefined>;
  createCrmActivity(activity: InsertCrmActivity): Promise<CrmActivity>;
  updateCrmActivity(id: number, updates: Partial<InsertCrmActivity>): Promise<CrmActivity | undefined>;
  deleteCrmActivity(id: number): Promise<void>;

  // CRM Tasks
  getCrmTasks(tenantId: number, entityType?: string, entityId?: number, accountId?: number, clientId?: number): Promise<CrmTask[]>;
  getCrmAccountTickets(tenantId: number, accountId: number, clientId?: number): Promise<{
    id: number;
    subject: string;
    status: string | null;
    priority: string | null;
    createdAt: Date;
    dueDate: Date | null;
    source: "task" | "activity";
  }[]>;
  getCrmTask(id: number): Promise<CrmTask | undefined>;
  createCrmTask(task: InsertCrmTask): Promise<CrmTask>;
  updateCrmTask(id: number, updates: Partial<InsertCrmTask>): Promise<CrmTask | undefined>;
  deleteCrmTask(id: number): Promise<void>;

  // CRM Notes
  getCrmNotes(tenantId: number, entityType: string, entityId: number, clientId?: number): Promise<CrmNote[]>;
  createCrmNote(note: InsertCrmNote): Promise<CrmNote>;
  updateCrmNote(id: number, content: string): Promise<CrmNote | undefined>;
  deleteCrmNote(id: number): Promise<void>;

  // CRM Contracts
  getCrmContracts(tenantId: number, accountId?: number, clientId?: number): Promise<CrmContract[]>;
  getCrmContract(id: number): Promise<CrmContract | undefined>;
  createCrmContract(contract: InsertCrmContract): Promise<CrmContract>;
  updateCrmContract(id: number, updates: Partial<InsertCrmContract>): Promise<CrmContract | undefined>;
  deleteCrmContract(id: number): Promise<void>;

  // CRM Bulk Import
  bulkImportCrmLeads(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportCrmContacts(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportCrmAccounts(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportCrmOpportunities(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportCrmContracts(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportTasks(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportStrategyItems(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportResources(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportBpmlEntries(templateId: number, tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportFrameworks(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportOrgChartMembers(chartId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;
  bulkImportPmRaiddItems(projectId: number, tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }>;

  // CRM Customer Systems
  getCrmCustomerSystems(tenantId: number, accountId?: number, clientId?: number): Promise<CrmCustomerSystem[]>;
  getCrmCustomerSystem(id: number): Promise<CrmCustomerSystem | undefined>;
  createCrmCustomerSystem(system: InsertCrmCustomerSystem): Promise<CrmCustomerSystem>;
  updateCrmCustomerSystem(id: number, updates: Partial<InsertCrmCustomerSystem>): Promise<CrmCustomerSystem | undefined>;
  deleteCrmCustomerSystem(id: number): Promise<void>;

  // Business Management - Strategy Items
  getStrategyItems(tenantId: number, templateType?: string, clientId?: number): Promise<StrategyItem[]>;
  getStrategyItem(id: number): Promise<StrategyItem | undefined>;
  createStrategyItem(item: InsertStrategyItem): Promise<StrategyItem>;
  updateStrategyItem(id: number, updates: Partial<InsertStrategyItem>): Promise<StrategyItem | undefined>;
  deleteStrategyItem(id: number): Promise<void>;

  // Business Management - Risks
  getRisks(tenantId: number, strategyItemId?: number, clientId?: number): Promise<Risk[]>;
  getRisk(id: number): Promise<Risk | undefined>;
  createRisk(risk: InsertRisk): Promise<Risk>;
  updateRisk(id: number, updates: Partial<InsertRisk>): Promise<Risk | undefined>;
  deleteRisk(id: number): Promise<void>;

  // Business Management - Departments
  getDepartments(tenantId: number): Promise<Department[]>;
  getDepartment(id: number): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, updates: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<void>;

  // Business Management - Processes
  getProcesses(tenantId: number, departmentId?: number): Promise<Process[]>;
  getProcess(id: number): Promise<Process | undefined>;
  createProcess(process: InsertProcess): Promise<Process>;
  updateProcess(id: number, updates: Partial<InsertProcess>): Promise<Process | undefined>;
  deleteProcess(id: number): Promise<void>;

  // Business Management - Tools
  getTools(tenantId: number): Promise<Tool[]>;
  getTool(id: number): Promise<Tool | undefined>;
  createTool(tool: InsertTool): Promise<Tool>;
  updateTool(id: number, updates: Partial<InsertTool>): Promise<Tool | undefined>;
  deleteTool(id: number): Promise<void>;

  // Business Management - Goals
  getGoals(tenantId: number, strategyItemId?: number, clientId?: number): Promise<Goal[]>;
  getGoal(id: number): Promise<Goal | undefined>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal | undefined>;
  deleteGoal(id: number): Promise<void>;

  // Business Management - Objectives
  getObjectives(tenantId: number, goalId?: number, clientId?: number): Promise<Objective[]>;
  getObjective(id: number): Promise<Objective | undefined>;
  createObjective(objective: InsertObjective): Promise<Objective>;
  updateObjective(id: number, updates: Partial<InsertObjective>): Promise<Objective | undefined>;
  deleteObjective(id: number): Promise<void>;

  // Business Management - OKRs
  getOkrs(tenantId: number, initiativeId?: number, clientId?: number): Promise<Okr[]>;
  getOkr(id: number): Promise<Okr | undefined>;
  createOkr(okr: InsertOkr): Promise<Okr>;
  updateOkr(id: number, updates: Partial<InsertOkr>): Promise<Okr | undefined>;
  deleteOkr(id: number): Promise<void>;

  // Business Management - Key Results
  getKeyResults(tenantId: number, goalId?: number): Promise<KeyResult[]>;
  getKeyResult(id: number): Promise<KeyResult | undefined>;
  createKeyResult(keyResult: InsertKeyResult): Promise<KeyResult>;
  updateKeyResult(id: number, updates: Partial<InsertKeyResult>): Promise<KeyResult | undefined>;
  deleteKeyResult(id: number): Promise<void>;

  // Business Management - KPIs
  getKpis(tenantId: number, goalId?: number, clientId?: number): Promise<Kpi[]>;
  getKpi(id: number): Promise<Kpi | undefined>;
  createKpi(kpi: InsertKpi): Promise<Kpi>;
  updateKpi(id: number, updates: Partial<InsertKpi>): Promise<Kpi | undefined>;
  deleteKpi(id: number): Promise<void>;

  // Business Management - Initiatives
  getInitiatives(tenantId: number, goalId?: number, clientId?: number): Promise<Initiative[]>;
  getInitiative(id: number): Promise<Initiative | undefined>;
  createInitiative(initiative: InsertInitiative): Promise<Initiative>;
  updateInitiative(id: number, updates: Partial<InsertInitiative>): Promise<Initiative | undefined>;
  deleteInitiative(id: number): Promise<void>;

  // Business Management - Tasks
  getBusinessTasks(tenantId: number, initiativeId?: number, clientId?: number): Promise<BusinessTask[]>;
  getBusinessTask(id: number): Promise<BusinessTask | undefined>;
  createBusinessTask(task: InsertBusinessTask): Promise<BusinessTask>;
  updateBusinessTask(id: number, updates: Partial<InsertBusinessTask>): Promise<BusinessTask | undefined>;
  deleteBusinessTask(id: number): Promise<void>;

  // Business Management - Meetings
  getMeetings(tenantId: number, initiativeId?: number): Promise<Meeting[]>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, updates: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: number): Promise<void>;

  // Business Governance - Review Notes
  getStrategyReviewNotes(tenantId: number, entityType: string, entityId: number): Promise<StrategyReviewNote[]>;
  getAllStrategyReviewNotes(tenantId: number): Promise<StrategyReviewNote[]>;
  createStrategyReviewNote(note: InsertStrategyReviewNote): Promise<StrategyReviewNote>;
  deleteStrategyReviewNote(id: number): Promise<void>;
  updateStrategyReviewNote(id: number, userId: string, content: string): Promise<StrategyReviewNote | null>;

  // Business Governance - RAG History
  getStrategyRagHistory(tenantId: number, entityType?: string, entityId?: number): Promise<StrategyRagHistory[]>;
  createStrategyRagHistory(entry: InsertStrategyRagHistory): Promise<StrategyRagHistory>;

  // Business Governance - Overdue Reviews
  getOverdueReviews(tenantId: number): Promise<{ entityType: string; entityId: number; entityTitle: string; ownerName: string | null; nextReviewDate: string; reviewCadence: string; daysOverdue: number }[]>;

  // Business Governance - Governance Items
  getGovernanceItems(tenantId: number): Promise<GovernanceItem[]>;
  getGovernanceItem(id: number): Promise<GovernanceItem | undefined>;
  createGovernanceItem(item: InsertGovernanceItem): Promise<GovernanceItem>;
  updateGovernanceItem(id: number, updates: Partial<InsertGovernanceItem>): Promise<GovernanceItem | undefined>;
  deleteGovernanceItem(id: number): Promise<void>;

  // Business - Strategy Document Links
  getStrategyDocLinks(tenantId: number, layerType?: string, layerItemId?: number): Promise<StrategyDocumentLink[]>;
  createStrategyDocLink(link: InsertStrategyDocumentLink): Promise<StrategyDocumentLink>;
  deleteStrategyDocLink(id: number): Promise<void>;

  // Business - KPI Time-series Values
  getStrategyKpiValues(tenantId: number, kpiId?: number): Promise<StrategyKpiValue[]>;
  createStrategyKpiValue(val: InsertStrategyKpiValue): Promise<StrategyKpiValue>;
  deleteStrategyKpiValue(id: number): Promise<void>;

  // Ref sequencer
  getNextEntityRef(tenantId: number, layer: string): Promise<number>;
  getEntityRef(tenantId: number, entityType: string, entityId: number): Promise<number | null>;
  assignEntityRef(tenantId: number, entityType: string, entityId: number): Promise<number>;
  getEntityRefs(tenantId: number): Promise<Array<{ entityType: string; entityId: number; refSeq: number }>>;
  backfillEntityRefs(tenantId: number): Promise<{ assigned: number }>;
  bulkImportBusinessLayers(tenantId: number, userId: string, rows: Record<string, unknown>[]): Promise<{ created: Record<string, number>; skipped: number }>;

  // Document Management - Folders
  getDocumentFolders(tenantId: number, parentId?: number | null, clientId?: number): Promise<DocumentFolder[]>;
  getDocumentFolder(id: number): Promise<DocumentFolder | undefined>;
  createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder>;
  updateDocumentFolder(id: number, updates: Partial<InsertDocumentFolder>): Promise<DocumentFolder | undefined>;
  deleteDocumentFolder(id: number): Promise<void>;

  // Document Management - Documents
  getDocuments(tenantId: number, folderId?: number | null, clientId?: number): Promise<Document[]>;
  getDocumentsWithOwner(tenantId: number, folderId?: number | null, clientId?: number): Promise<(Document & { ownerName: string | null })[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<void>;
  searchDocuments(tenantId: number, query: string, clientId?: number): Promise<Document[]>;
  getFavoriteDocuments(tenantId: number, userId: string, clientId?: number): Promise<Document[]>;
  getRecentDocuments(tenantId: number, userId: string, limit?: number, clientId?: number): Promise<Document[]>;
  getSharedWithMeDocuments(tenantId: number, userId: string, clientId?: number): Promise<(Document & { ownerName: string | null })[]>;
  getDocumentByPublicToken(token: string): Promise<Document | undefined>;

  // Document Management - Versions
  getDocumentVersions(documentId: number): Promise<DocumentVersion[]>;
  getDocumentVersion(id: number): Promise<DocumentVersion | undefined>;
  createDocumentVersion(version: InsertDocumentVersion): Promise<DocumentVersion>;
  getNextDocumentVersionNumber(documentId: number): Promise<number>;
  restoreDocumentVersion(documentId: number, versionId: number): Promise<Document | undefined>;

  // Document Management - Tags
  getTags(tenantId: number): Promise<DocTag[]>;
  getTag(id: number): Promise<DocTag | undefined>;
  createTag(tag: InsertDocTag): Promise<DocTag>;
  updateTag(id: number, updates: Partial<InsertDocTag>): Promise<DocTag | undefined>;
  deleteTag(id: number): Promise<void>;

  // Document Management - Document Tags
  getDocumentTags(documentId: number): Promise<(DocumentTag & { tag: DocTag })[]>;
  addDocumentTag(documentTag: InsertDocumentTag): Promise<DocumentTag>;
  removeDocumentTag(documentId: number, tagId: number): Promise<void>;

  // Document Management - Access Control
  getDocumentAcl(documentId?: number, folderId?: number): Promise<DocumentAcl[]>;
  getDocumentAclEntry(id: number): Promise<DocumentAcl | undefined>;
  createDocumentAcl(acl: InsertDocumentAcl): Promise<DocumentAcl>;
  updateDocumentAcl(id: number, updates: Partial<InsertDocumentAcl>): Promise<DocumentAcl | undefined>;
  deleteDocumentAcl(id: number): Promise<void>;

  // Document Management - Comments
  getDocumentComments(documentId: number): Promise<(DocumentComment & { author: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]>;
  getDocumentComment(id: number): Promise<DocumentComment | undefined>;
  createDocumentComment(comment: InsertDocumentComment): Promise<DocumentComment>;
  updateDocumentComment(id: number, content: string, isResolved?: boolean): Promise<DocumentComment | undefined>;
  deleteDocumentComment(id: number): Promise<void>;

  // Document Management - Templates
  getDocumentTemplates(tenantId: number, category?: string): Promise<DocumentTemplate[]>;
  getDocumentTemplate(id: number): Promise<DocumentTemplate | undefined>;
  createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: number, updates: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate | undefined>;
  deleteDocumentTemplate(id: number): Promise<void>;

  // Document Management - Audit Logs
  getDocumentAuditLogs(tenantId: number, documentId?: number): Promise<DocumentAuditLog[]>;
  createDocumentAuditLog(log: InsertDocumentAuditLog): Promise<DocumentAuditLog>;

  // Document-Initiative Links
  getDocumentInitiativeLinks(tenantId: number, initiativeId?: number, documentId?: number): Promise<DocumentInitiativeLink[]>;
  createDocumentInitiativeLink(link: InsertDocumentInitiativeLink): Promise<DocumentInitiativeLink>;
  deleteDocumentInitiativeLink(id: number): Promise<void>;

  // Task Management - Tasks
  getTasks(tenantId: number, filters?: { assigneeId?: string; status?: string; priority?: string; source?: string; boardId?: number; clientId?: number }): Promise<(Task & { assignee?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;

  // Task Management - Task Boards
  getTaskBoards(tenantId: number, clientId?: number): Promise<(TaskBoard & { board: Board })[]>;
  getTaskBoard(id: number): Promise<TaskBoard | undefined>;
  createTaskBoard(taskBoard: InsertTaskBoard): Promise<TaskBoard>;
  updateTaskBoard(id: number, updates: Partial<InsertTaskBoard>): Promise<TaskBoard | undefined>;
  deleteTaskBoard(id: number): Promise<void>;

  // Task Management - Task Links
  getTaskLinks(taskId: number): Promise<TaskLink[]>;
  createTaskLink(link: InsertTaskLink): Promise<TaskLink>;
  deleteTaskLink(id: number): Promise<void>;

  // Task Management - Task Subtasks
  getTaskSubtasks(taskId: number): Promise<TaskSubtask[]>;
  createTaskSubtask(subtask: InsertTaskSubtask): Promise<TaskSubtask>;
  updateTaskSubtask(id: number, updates: Partial<InsertTaskSubtask>): Promise<TaskSubtask | undefined>;
  deleteTaskSubtask(id: number): Promise<void>;

  // Task Management - Task Views
  getTaskViews(tenantId: number, userId: string): Promise<TaskView[]>;
  getTaskView(id: number): Promise<TaskView | undefined>;
  createTaskView(view: InsertTaskView): Promise<TaskView>;
  updateTaskView(id: number, updates: Partial<InsertTaskView>): Promise<TaskView | undefined>;
  deleteTaskView(id: number): Promise<void>;

  // Projects Module - Portfolios
  getPmPortfolios(tenantId: number, clientId?: number): Promise<PmPortfolio[]>;
  getPmPortfolio(id: number): Promise<PmPortfolio | undefined>;
  createPmPortfolio(portfolio: InsertPmPortfolio): Promise<PmPortfolio>;
  updatePmPortfolio(id: number, updates: Partial<InsertPmPortfolio>): Promise<PmPortfolio | undefined>;
  deletePmPortfolio(id: number): Promise<void>;

  // Projects Module - Programs
  getPmPrograms(tenantId: number, portfolioId?: number, clientId?: number): Promise<PmProgram[]>;
  getPmProgram(id: number): Promise<PmProgram | undefined>;
  createPmProgram(program: InsertPmProgram): Promise<PmProgram>;
  updatePmProgram(id: number, updates: Partial<InsertPmProgram>): Promise<PmProgram | undefined>;
  deletePmProgram(id: number): Promise<void>;

  // Projects Module - Projects
  getPmProjects(tenantId: number, filters?: { portfolioId?: number; programId?: number; status?: string; methodology?: string; clientId?: number | null }): Promise<PmProject[]>;
  getClientBySlug(slug: string, tenantId: number): Promise<Client | undefined>;
  getPmProject(id: number): Promise<PmProject | undefined>;
  createPmProject(project: InsertPmProject): Promise<PmProject>;
  updatePmProject(id: number, updates: Partial<InsertPmProject>): Promise<PmProject | undefined>;
  deletePmProject(id: number): Promise<void>;

  // Projects Module - Project Tools
  getPmProjectTools(projectId: number): Promise<PmProjectTool[]>;
  createPmProjectTool(tool: InsertPmProjectTool): Promise<PmProjectTool>;
  updatePmProjectTool(id: number, updates: Partial<InsertPmProjectTool>): Promise<PmProjectTool | undefined>;
  deletePmProjectTool(id: number): Promise<void>;
  bulkCreatePmProjectTools(tools: InsertPmProjectTool[]): Promise<PmProjectTool[]>;

  // Projects Module - Phases
  getPmProjectPhases(projectId: number): Promise<PmProjectPhase[]>;
  getPmProjectPhase(id: number): Promise<PmProjectPhase | undefined>;
  createPmProjectPhase(phase: InsertPmProjectPhase): Promise<PmProjectPhase>;
  updatePmProjectPhase(id: number, updates: Partial<InsertPmProjectPhase>): Promise<PmProjectPhase | undefined>;
  deletePmProjectPhase(id: number): Promise<void>;

  // Projects Module - Milestones
  getAllPmMilestones(tenantId?: number): Promise<PmMilestone[]>;
  getPmMilestones(projectId: number, phaseId?: number): Promise<PmMilestone[]>;
  getPmMilestone(id: number): Promise<PmMilestone | undefined>;
  createPmMilestone(milestone: InsertPmMilestone): Promise<PmMilestone>;
  updatePmMilestone(id: number, updates: Partial<InsertPmMilestone>): Promise<PmMilestone | undefined>;
  deletePmMilestone(id: number): Promise<void>;

  // Projects Module - Tasks
  getPmTasks(projectId: number, filters?: { phaseId?: number; status?: string; assigneeId?: string }): Promise<PmTask[]>;
  getPmTask(id: number): Promise<PmTask | undefined>;
  createPmTask(task: InsertPmTask): Promise<PmTask>;
  updatePmTask(id: number, updates: Partial<InsertPmTask>): Promise<PmTask | undefined>;
  deletePmTask(id: number): Promise<void>;
  deleteAllPmTasksByProject(projectId: number): Promise<void>;
  bulkImportPmTasks(projectId: number, tasks: { tempId: string; parentTempId: string | null; data: InsertPmTask }[]): Promise<{ tempId: string; dbId: number }[]>;
  bulkImportGanttPlan(projectId: number, tenantId: number, mode: "append" | "overwrite", items: {
    wbs: string; name: string; type: number; parentWbs?: string | null; predecessorWbs?: string | null;
    owner?: string; start: string; end?: string; progress?: number; rag?: string; notes?: string;
  }[]): Promise<{ imported: number }>;

  // Projects Module - Team Members
  getPmTeamMembers(projectId: number): Promise<(PmTeamMember & { user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]>;
  getPmTeamMember(id: number): Promise<PmTeamMember | undefined>;
  createPmTeamMember(member: InsertPmTeamMember): Promise<PmTeamMember>;
  updatePmTeamMember(id: number, updates: Partial<InsertPmTeamMember>): Promise<PmTeamMember | undefined>;
  deletePmTeamMember(id: number): Promise<void>;

  // Projects Module - RAIDD Items
  getPmRaiddItems(projectId: number, type?: string): Promise<PmRaiddItem[]>;
  getPmRaiddItem(id: number): Promise<PmRaiddItem | undefined>;
  createPmRaiddItem(item: InsertPmRaiddItem): Promise<PmRaiddItem>;
  updatePmRaiddItem(id: number, updates: Partial<InsertPmRaiddItem>): Promise<PmRaiddItem | undefined>;
  deletePmRaiddItem(id: number): Promise<void>;

  // Projects Module - Deliverable Phases
  getPmDeliverablePhases(projectId: number): Promise<PmDeliverablePhase[]>;
  createPmDeliverablePhase(phase: InsertPmDeliverablePhase): Promise<PmDeliverablePhase>;
  updatePmDeliverablePhase(id: number, updates: Partial<InsertPmDeliverablePhase>): Promise<PmDeliverablePhase | undefined>;
  deletePmDeliverablePhase(id: number): Promise<void>;
  replaceAllPmDeliverablePhases(projectId: number, phases: InsertPmDeliverablePhase[]): Promise<PmDeliverablePhase[]>;

  // Projects Module - Deliverables
  getPmDeliverables(projectId: number): Promise<PmDeliverable[]>;
  createPmDeliverable(item: InsertPmDeliverable): Promise<PmDeliverable>;
  updatePmDeliverable(id: number, updates: Partial<InsertPmDeliverable>): Promise<PmDeliverable | undefined>;
  deletePmDeliverable(id: number): Promise<void>;

  // Projects Module - Business Requirements
  getPmBusinessRequirements(projectId: number): Promise<PmBusinessRequirement[]>;
  getPmBusinessRequirement(id: number): Promise<PmBusinessRequirement | undefined>;
  createPmBusinessRequirement(item: InsertPmBusinessRequirement): Promise<PmBusinessRequirement>;
  updatePmBusinessRequirement(id: number, updates: Partial<InsertPmBusinessRequirement>): Promise<PmBusinessRequirement | undefined>;
  deletePmBusinessRequirement(id: number): Promise<void>;

  // Projects Module - Phase Templates
  getPmPhaseTemplates(tenantId?: number): Promise<PmPhaseTemplate[]>;
  getPmPhaseTemplate(id: number): Promise<PmPhaseTemplate | undefined>;
  createPmPhaseTemplate(template: InsertPmPhaseTemplate): Promise<PmPhaseTemplate>;
  updatePmPhaseTemplate(id: number, updates: Partial<InsertPmPhaseTemplate>): Promise<PmPhaseTemplate | undefined>;
  deletePmPhaseTemplate(id: number): Promise<void>;

  // Projects Module - Workstreams
  getPmWorkstreams(projectId: number): Promise<PmWorkstream[]>;
  getPmWorkstream(id: number): Promise<PmWorkstream | undefined>;
  createPmWorkstream(workstream: InsertPmWorkstream): Promise<PmWorkstream>;
  updatePmWorkstream(id: number, updates: Partial<InsertPmWorkstream>): Promise<PmWorkstream | undefined>;
  deletePmWorkstream(id: number): Promise<void>;

  // Projects Module - Sprints
  getPmSprints(projectId: number): Promise<PmSprint[]>;
  getPmSprint(id: number): Promise<PmSprint | undefined>;
  createPmSprint(sprint: InsertPmSprint): Promise<PmSprint>;
  updatePmSprint(id: number, updates: Partial<InsertPmSprint>): Promise<PmSprint | undefined>;
  deletePmSprint(id: number): Promise<void>;

  // Projects Module - Backlog Items
  getPmBacklogItems(projectId: number, sprintId?: number): Promise<PmBacklogItem[]>;
  getPmBacklogItem(id: number): Promise<PmBacklogItem | undefined>;
  createPmBacklogItem(item: InsertPmBacklogItem): Promise<PmBacklogItem>;
  updatePmBacklogItem(id: number, updates: Partial<InsertPmBacklogItem>): Promise<PmBacklogItem | undefined>;
  deletePmBacklogItem(id: number): Promise<void>;

  // RACI Module - Roles
  getPmRaciRoles(tenantId: number, projectId?: number): Promise<PmRaciRole[]>;
  getPmRaciRole(id: number): Promise<PmRaciRole | undefined>;
  createPmRaciRole(role: InsertPmRaciRole): Promise<PmRaciRole>;
  updatePmRaciRole(id: number, updates: Partial<InsertPmRaciRole>): Promise<PmRaciRole | undefined>;
  deletePmRaciRole(id: number): Promise<void>;

  // RACI Module - Activities
  getPmRaciActivities(tenantId: number, projectId?: number): Promise<PmRaciActivity[]>;
  getPmRaciActivity(id: number): Promise<PmRaciActivity | undefined>;
  createPmRaciActivity(activity: InsertPmRaciActivity): Promise<PmRaciActivity>;
  updatePmRaciActivity(id: number, updates: Partial<InsertPmRaciActivity>): Promise<PmRaciActivity | undefined>;
  deletePmRaciActivity(id: number): Promise<void>;

  // RACI Module - Types
  getPmRaciTypes(tenantId: number): Promise<PmRaciType[]>;
  getPmRaciType(id: number): Promise<PmRaciType | undefined>;
  createPmRaciType(type: InsertPmRaciType): Promise<PmRaciType>;
  updatePmRaciType(id: number, updates: Partial<InsertPmRaciType>): Promise<PmRaciType | undefined>;
  deletePmRaciType(id: number): Promise<void>;

  // RACI Module - Assignments
  getPmRaciAssignments(tenantId: number, projectId?: number): Promise<PmRaciAssignment[]>;
  getPmRaciAssignment(id: number): Promise<PmRaciAssignment | undefined>;
  createPmRaciAssignment(assignment: InsertPmRaciAssignment): Promise<PmRaciAssignment>;
  updatePmRaciAssignment(id: number, updates: Partial<InsertPmRaciAssignment>): Promise<PmRaciAssignment | undefined>;
  deletePmRaciAssignment(id: number): Promise<void>;

  // RACI Module - Templates
  getPmRaciTemplates(tenantId: number): Promise<PmRaciTemplate[]>;
  getPmRaciTemplate(id: number): Promise<PmRaciTemplate | undefined>;
  createPmRaciTemplate(template: InsertPmRaciTemplate): Promise<PmRaciTemplate>;
  updatePmRaciTemplate(id: number, updates: Partial<InsertPmRaciTemplate>): Promise<PmRaciTemplate | undefined>;
  deletePmRaciTemplate(id: number): Promise<void>;

  // Projects Module - Agile Board
  getPmAgileWorkstreams(projectId: number): Promise<PmAgileWorkstream[]>;
  createPmAgileWorkstream(data: InsertPmAgileWorkstream): Promise<PmAgileWorkstream>;
  updatePmAgileWorkstream(id: number, updates: Partial<InsertPmAgileWorkstream>): Promise<PmAgileWorkstream | undefined>;
  deletePmAgileWorkstream(id: number): Promise<void>;

  getPmEpics(agileWorkstreamId: number): Promise<PmEpic[]>;
  createPmEpic(data: InsertPmEpic): Promise<PmEpic>;
  updatePmEpic(id: number, updates: Partial<InsertPmEpic>): Promise<PmEpic | undefined>;
  deletePmEpic(id: number): Promise<void>;

  getPmAgileSprints(agileWorkstreamId: number): Promise<PmAgileSprint[]>;
  createPmAgileSprint(data: InsertPmAgileSprint): Promise<PmAgileSprint>;
  updatePmAgileSprint(id: number, updates: Partial<InsertPmAgileSprint>): Promise<PmAgileSprint | undefined>;
  deletePmAgileSprint(id: number): Promise<void>;

  getPmAgileStories(agileWorkstreamId: number): Promise<PmAgileStory[]>;
  createPmAgileStory(data: InsertPmAgileStory): Promise<PmAgileStory>;
  updatePmAgileStory(id: number, updates: Partial<InsertPmAgileStory>): Promise<PmAgileStory | undefined>;
  deletePmAgileStory(id: number): Promise<void>;

  getPmAgileDefects(agileWorkstreamId: number): Promise<PmAgileDefect[]>;
  createPmAgileDefect(data: InsertPmAgileDefect): Promise<PmAgileDefect>;
  updatePmAgileDefect(id: number, updates: Partial<InsertPmAgileDefect>): Promise<PmAgileDefect | undefined>;
  deletePmAgileDefect(id: number): Promise<void>;
  getPmAgileDashboard(projectId: number): Promise<{
    kpis: { label: string; value: string | number; change: string; trend: string; color: string }[];
    workstreams: {
      id: number; name: string; color: string; sprintName: string; sprintProgress: number;
      velocity: number; storyPoints: { done: number; total: number };
      defects: { open: number; closed: number }; epics: number; stories: number; team: number; health: string;
    }[];
    velocityData: { sprint: string; planned: number; delivered: number }[];
    burndownData: { day: string; ideal: number; actual: number | null }[];
    epicProgress: { id: string; title: string; ws: string; color: string; progress: number; stories: number; done: number; status: string }[];
    recentActivity: { time: string; user: string; action: string; ws: string; color: string }[];
    risks: { id: string; title: string; severity: string; ws: string; color: string }[];
  }>;

  // Resources
  getResources(tenantId: number): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, updates: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<void>;

  // Skill Categories
  getSkillCategories(tenantId: number): Promise<SkillCategory[]>;
  createSkillCategory(category: InsertSkillCategory): Promise<SkillCategory>;
  updateSkillCategory(id: number, updates: Partial<InsertSkillCategory>): Promise<SkillCategory | undefined>;
  deleteSkillCategory(id: number): Promise<void>;

  // Skills
  getSkills(tenantId: number): Promise<Skill[]>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: number, updates: Partial<InsertSkill>): Promise<Skill | undefined>;
  deleteSkill(id: number): Promise<void>;

  // Resource Skills
  getResourceSkills(resourceId: number): Promise<ResourceSkill[]>;
  addResourceSkill(resourceSkill: InsertResourceSkill): Promise<ResourceSkill>;
  updateResourceSkill(id: number, updates: Partial<InsertResourceSkill>): Promise<ResourceSkill | undefined>;
  removeResourceSkill(id: number): Promise<void>;

  // Resource Allocations
  getAllocations(tenantId: number, projectId?: number): Promise<(ResourceAllocation & { resourceName?: string | null })[]>;
  getAllocation(id: number): Promise<ResourceAllocation | undefined>;
  createAllocation(allocation: InsertResourceAllocation): Promise<ResourceAllocation>;
  updateAllocation(id: number, updates: Partial<InsertResourceAllocation>): Promise<ResourceAllocation | undefined>;
  deleteAllocation(id: number): Promise<void>;

  getTimesheetEntriesByProject(tenantId: number, projectId: number): Promise<{
    id: number; entryDate: string | null; hours: string | null; description: string | null;
    personName: string | null; status: string | null;
  }[]>;

  getDocumentsForProject(tenantId: number, projectId: number, linkedIds?: number[]): Promise<(Document & { ownerName: string | null })[]>;

  // Timesheet Periods
  getTimesheetPeriods(tenantId: number, resourceId?: number): Promise<TimesheetPeriod[]>;
  getTimesheetPeriod(id: number): Promise<TimesheetPeriod | undefined>;
  createTimesheetPeriod(period: InsertTimesheetPeriod): Promise<TimesheetPeriod>;
  updateTimesheetPeriod(id: number, updates: Partial<InsertTimesheetPeriod>): Promise<TimesheetPeriod | undefined>;

  // Timesheet Entries
  getTimesheetEntries(periodId: number): Promise<TimesheetEntry[]>;
  createTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry>;
  updateTimesheetEntry(id: number, updates: Partial<InsertTimesheetEntry>): Promise<TimesheetEntry | undefined>;
  deleteTimesheetEntry(id: number): Promise<void>;

  // Project Codes
  getProjectCodes(tenantId: number): Promise<ProjectCode[]>;
  createProjectCode(code: InsertProjectCode): Promise<ProjectCode>;
  updateProjectCode(id: number, updates: Partial<InsertProjectCode>): Promise<ProjectCode | undefined>;
  deleteProjectCode(id: number): Promise<void>;

  // BPM - Diagrams
  getBpmDiagrams(tenantId: number): Promise<BpmDiagram[]>;
  getBpmDiagram(id: number): Promise<BpmDiagram | undefined>;
  createBpmDiagram(diagram: InsertBpmDiagram): Promise<BpmDiagram>;
  updateBpmDiagram(id: number, updates: Partial<InsertBpmDiagram>): Promise<BpmDiagram | undefined>;
  deleteBpmDiagram(id: number): Promise<void>;

  // BPM - Nodes
  getBpmNodes(diagramId: number): Promise<BpmNode[]>;
  createBpmNode(node: InsertBpmNode): Promise<BpmNode>;
  updateBpmNode(id: number, updates: Partial<InsertBpmNode>): Promise<BpmNode | undefined>;
  deleteBpmNode(id: number): Promise<void>;
  deleteBpmNodesByDiagram(diagramId: number): Promise<void>;

  // BPM - Edges
  getBpmEdges(diagramId: number): Promise<BpmEdge[]>;
  createBpmEdge(edge: InsertBpmEdge): Promise<BpmEdge>;
  updateBpmEdge(id: number, updates: Partial<InsertBpmEdge>): Promise<BpmEdge | undefined>;
  deleteBpmEdge(id: number): Promise<void>;
  deleteBpmEdgesByDiagram(diagramId: number): Promise<void>;

  // BPM - Swimlanes
  getBpmSwimlanes(diagramId: number): Promise<BpmSwimlane[]>;
  createBpmSwimlane(swimlane: InsertBpmSwimlane): Promise<BpmSwimlane>;
  updateBpmSwimlane(id: number, updates: Partial<InsertBpmSwimlane>): Promise<BpmSwimlane | undefined>;
  deleteBpmSwimlane(id: number): Promise<void>;

  // BPM - Libraries
  getBpmLibraries(tenantId: number): Promise<BpmLibrary[]>;
  getBpmLibrary(id: number): Promise<BpmLibrary | undefined>;
  createBpmLibrary(library: InsertBpmLibrary): Promise<BpmLibrary>;
  updateBpmLibrary(id: number, updates: Partial<InsertBpmLibrary>): Promise<BpmLibrary | undefined>;
  deleteBpmLibrary(id: number): Promise<void>;

  // BPM - Templates
  getBpmTemplates(): Promise<BpmTemplate[]>;
  getBpmTemplatesByLibrary(libraryId: number): Promise<BpmTemplate[]>;
  getBpmTemplate(id: number): Promise<BpmTemplate | undefined>;
  createBpmTemplate(template: InsertBpmTemplate): Promise<BpmTemplate>;

  // BPM - Attachments
  getBpmAttachments(diagramId: number, nodeId?: number): Promise<BpmAttachment[]>;
  createBpmAttachment(attachment: InsertBpmAttachment): Promise<BpmAttachment>;
  deleteBpmAttachment(id: number): Promise<void>;

  // Frameworks
  getFrameworks(tenantId: number): Promise<Framework[]>;
  getFramework(id: number): Promise<Framework | undefined>;
  createFramework(framework: InsertFramework): Promise<Framework>;
  updateFramework(id: number, updates: Partial<InsertFramework>): Promise<Framework | undefined>;
  deleteFramework(id: number): Promise<void>;

  // BPML Templates
  getBpmlTemplates(tenantId: number): Promise<BpmlTemplate[]>;
  getBpmlTemplate(id: number): Promise<BpmlTemplate | undefined>;
  createBpmlTemplate(template: InsertBpmlTemplate): Promise<BpmlTemplate>;
  updateBpmlTemplate(id: number, updates: Partial<InsertBpmlTemplate>): Promise<BpmlTemplate | undefined>;
  deleteBpmlTemplate(id: number): Promise<void>;

  // BPML Entries
  getBpmlEntries(templateId: number, tenantId: number): Promise<BpmlEntry[]>;
  getBpmlEntry(id: number): Promise<BpmlEntry | undefined>;
  createBpmlEntry(entry: InsertBpmlEntry): Promise<BpmlEntry>;
  createBpmlEntries(entries: InsertBpmlEntry[]): Promise<BpmlEntry[]>;
  updateBpmlEntry(id: number, updates: Partial<InsertBpmlEntry>): Promise<BpmlEntry | undefined>;
  deleteBpmlEntry(id: number): Promise<void>;
  deleteBpmlEntries(ids: number[]): Promise<void>;

  // Portal Menu Nodes
  getPortalMenuNodes(tenantId: number): Promise<PortalMenuNode[]>;
  getPortalMenuNode(id: number): Promise<PortalMenuNode | undefined>;
  createPortalMenuNode(node: InsertPortalMenuNode): Promise<PortalMenuNode>;
  updatePortalMenuNode(id: number, updates: Partial<InsertPortalMenuNode>): Promise<PortalMenuNode | undefined>;
  deletePortalMenuNode(id: number): Promise<void>;

  // Portal Diagram Assignments
  getPortalDiagramAssignments(menuNodeId: number): Promise<PortalDiagramAssignment[]>;
  getAllPortalDiagramAssignments(tenantId: number): Promise<PortalDiagramAssignment[]>;
  createPortalDiagramAssignment(assignment: InsertPortalDiagramAssignment): Promise<PortalDiagramAssignment>;
  deletePortalDiagramAssignment(id: number): Promise<void>;

  // Process Resources
  getProcessResources(tenantId: number): Promise<ProcessResource[]>;
  getProcessResourcesByEntry(entryId: number): Promise<ProcessResource[]>;
  getProcessResourcesByMenuNode(menuNodeId: number): Promise<ProcessResource[]>;
  createProcessResource(resource: InsertProcessResource): Promise<ProcessResource>;
  updateProcessResource(id: number, updates: Partial<InsertProcessResource>): Promise<ProcessResource | undefined>;
  deleteProcessResource(id: number): Promise<void>;

  // Org Chart Templates
  getOrgChartTemplates(tenantId: number): Promise<OrgChartTemplate[]>;
  getOrgChartTemplate(id: number): Promise<OrgChartTemplate | undefined>;
  createOrgChartTemplate(template: InsertOrgChartTemplate): Promise<OrgChartTemplate>;
  updateOrgChartTemplate(id: number, updates: Partial<InsertOrgChartTemplate>): Promise<OrgChartTemplate | undefined>;
  deleteOrgChartTemplate(id: number): Promise<void>;

  // Org Charts
  getOrgCharts(tenantId: number): Promise<OrgChart[]>;
  getOrgChart(id: number): Promise<OrgChart | undefined>;
  createOrgChart(chart: InsertOrgChart): Promise<OrgChart>;
  updateOrgChart(id: number, updates: Partial<InsertOrgChart>): Promise<OrgChart | undefined>;
  deleteOrgChart(id: number): Promise<void>;

  // Org Chart Members
  getOrgChartMembers(chartId: number): Promise<OrgChartMember[]>;
  getOrgChartMember(id: number): Promise<OrgChartMember | undefined>;
  createOrgChartMember(member: InsertOrgChartMember): Promise<OrgChartMember>;
  updateOrgChartMember(id: number, updates: Partial<InsertOrgChartMember>): Promise<OrgChartMember | undefined>;
  deleteOrgChartMember(id: number): Promise<void>;

  // Workspaces
  getWorkspaces(tenantId: number): Promise<Workspace[]>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: number, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined>;
  deleteWorkspace(id: number): Promise<void>;

  // Workspace Members
  getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]>;
  addWorkspaceMember(data: InsertWorkspaceMember): Promise<WorkspaceMember>;
  removeWorkspaceMember(id: number): Promise<void>;

  // Workspace Pages
  getWorkspacePages(workspaceId: number): Promise<WorkspacePage[]>;
  getAllFavoritePages(): Promise<WorkspacePage[]>;
  getWorkspacePage(id: number): Promise<WorkspacePage | undefined>;
  createWorkspacePage(page: InsertWorkspacePage): Promise<WorkspacePage>;
  updateWorkspacePage(id: number, updates: Partial<InsertWorkspacePage>): Promise<WorkspacePage | undefined>;
  deleteWorkspacePage(id: number): Promise<void>;
  reorderWorkspacePages(updates: { id: number; sortOrder: number }[]): Promise<void>;

  // Workspace Databases
  getWorkspaceDatabases(pageId: number): Promise<WorkspaceDatabase[]>;
  getWorkspaceDatabase(id: number): Promise<WorkspaceDatabase | undefined>;
  createWorkspaceDatabase(database: InsertWorkspaceDatabase): Promise<WorkspaceDatabase>;
  updateWorkspaceDatabase(id: number, updates: Partial<InsertWorkspaceDatabase>): Promise<WorkspaceDatabase | undefined>;
  deleteWorkspaceDatabase(id: number): Promise<void>;

  // Workspace Database Columns
  getWorkspaceDatabaseColumns(databaseId: number): Promise<WorkspaceDatabaseColumn[]>;
  createWorkspaceDatabaseColumn(column: InsertWorkspaceDatabaseColumn): Promise<WorkspaceDatabaseColumn>;
  updateWorkspaceDatabaseColumn(id: number, updates: Partial<InsertWorkspaceDatabaseColumn>): Promise<WorkspaceDatabaseColumn | undefined>;
  deleteWorkspaceDatabaseColumn(id: number): Promise<void>;

  // Workspace Database Rows
  getWorkspaceDatabaseRows(databaseId: number): Promise<WorkspaceDatabaseRow[]>;
  createWorkspaceDatabaseRow(row: InsertWorkspaceDatabaseRow): Promise<WorkspaceDatabaseRow>;
  updateWorkspaceDatabaseRow(id: number, updates: Partial<InsertWorkspaceDatabaseRow>): Promise<WorkspaceDatabaseRow | undefined>;
  deleteWorkspaceDatabaseRow(id: number): Promise<void>;

  // Workspace Saved Views
  getWorkspaceSavedViews(databaseId: number): Promise<WorkspaceSavedView[]>;
  createWorkspaceSavedView(view: InsertWorkspaceSavedView): Promise<WorkspaceSavedView>;
  updateWorkspaceSavedView(id: number, updates: Partial<InsertWorkspaceSavedView>): Promise<WorkspaceSavedView | undefined>;
  deleteWorkspaceSavedView(id: number): Promise<void>;

  // Sign-Off
  getSignoffRequests(tenantId: number): Promise<SignoffRequestWithDetails[]>;
  getSignoffRequest(id: number): Promise<SignoffRequestWithDetails | undefined>;
  getSignoffRequestByToken(token: string): Promise<SignoffRequestWithDetails | undefined>;
  createSignoffRequest(data: InsertSignoffRequest): Promise<SignoffRequest>;
  updateSignoffRequest(id: number, data: Partial<InsertSignoffRequest>): Promise<SignoffRequest | undefined>;
  deleteSignoffRequest(id: number): Promise<void>;
  createSignoffSigner(data: InsertSignoffSigner & { token?: string; tokenExpiresAt?: Date }): Promise<SignoffSigner>;
  updateSignoffSigner(id: number, data: Partial<SignoffSigner>): Promise<SignoffSigner | undefined>;
  deleteSignoffSigner(id: number): Promise<void>;
  getSignoffSignerByToken(token: string): Promise<SignoffSigner | undefined>;
  getSignoffRequestsForSigner(email: string): Promise<any[]>;
  createSignoffAuditLog(data: InsertSignoffAuditLog): Promise<SignoffAuditLog>;
  getSignoffAuditLog(requestId: number): Promise<SignoffAuditLog[]>;

  // Surveys
  getSurveys(tenantId: number): Promise<SurveyWithDetails[]>;
  getSurvey(id: number): Promise<SurveyWithDetails | undefined>;
  getSurveyByToken(token: string): Promise<SurveyWithDetails | undefined>;
  createSurvey(data: InsertSurvey): Promise<Survey>;
  updateSurvey(id: number, data: Partial<InsertSurvey>): Promise<Survey | undefined>;
  deleteSurvey(id: number): Promise<void>;
  getSurveyQuestions(surveyId: number): Promise<SurveyQuestion[]>;
  createSurveyQuestion(data: InsertSurveyQuestion): Promise<SurveyQuestion>;
  updateSurveyQuestion(id: number, data: Partial<InsertSurveyQuestion>): Promise<SurveyQuestion | undefined>;
  deleteSurveyQuestion(id: number): Promise<void>;
  reorderSurveyQuestions(surveyId: number, orderedIds: number[]): Promise<void>;
  getSurveyResponses(surveyId: number): Promise<SurveyResponseWithAnswers[]>;
  createSurveyResponse(data: InsertSurveyResponse): Promise<SurveyResponse>;
  completeSurveyResponse(id: number, timeSeconds: number): Promise<SurveyResponse | undefined>;
  createSurveyAnswer(data: InsertSurveyAnswer): Promise<SurveyAnswer>;

  // Clients
  getClients(tenantId: number, opts?: { includeArchived?: boolean }): Promise<Client[]>;
  getClientSlugs(tenantId: number): Promise<string[]>;
  getAccessibleClients(
    userId: string,
    tenantId: number,
    options?: { platformRole?: string; isJigantoStaff?: boolean; includeArchived?: boolean },
  ): Promise<Client[]>;
  /** Workspace IDs assigned via client_users and/or client_workspace_grants. */
  getAssignedClientIdsForUser(userId: string, tenantId: number): Promise<number[]>;
  globalSearch(
    userId: string,
    tenantId: number,
    query: string,
    clientId?: number,
  ): Promise<GlobalSearchHit[]>;
  getClientById(id: number, tenantId: number): Promise<Client | undefined>;
  getClientBySlug(slug: string, tenantId: number, opts?: { allowArchived?: boolean }): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: number, tenantId: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  archiveClient(id: number, tenantId: number): Promise<Client | undefined>;
  unarchiveClient(id: number, tenantId: number): Promise<Client | undefined>;
  requestClientDeletion(id: number, tenantId: number): Promise<Client | undefined>;
  restoreClient(id: number, tenantId: number): Promise<Client | undefined>;
  purgeExpiredDeletedClients(): Promise<number>;
  getClientsPendingDelete(tenantId: number): Promise<Client[]>;
  getClientUsers(clientId: number): Promise<(ClientUser & { userInfo?: { firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null } })[]>;
  getClientMemberCounts(clientIds: number[]): Promise<Map<number, number>>;
  addClientUser(data: InsertClientUser): Promise<ClientUser>;
  removeClientUser(clientId: number, userId: string): Promise<void>;
  getClientByUserId(userId: string, tenantId: number): Promise<Client | undefined>;
  getClientMembershipByUserId(userId: string, tenantId: number): Promise<{ client: Client; role: string; memberType: string } | undefined>;
  /** External client users only (member_type = client) — used for workspace lock. */
  getLockedClientMembershipByUserId(userId: string, tenantId: number): Promise<{ client: Client; role: string; memberType: string } | undefined>;
  getClientProjectSummary(tenantId: number): Promise<{ clientId: number | null; projectCount: number; atRiskCount: number; activeProjectCount: number }[]>;
  getActiveEngagementCount(tenantId: number): Promise<number>;
  getClientModuleVisibility(clientId: number): Promise<ClientModuleVisibility[]>;
  upsertClientModuleVisibility(clientId: number, moduleKey: string, isVisible: number, updatedBy: string): Promise<ClientModuleVisibility>;
  createClientInvitation(data: {
    tenantId: number;
    clientId: number;
    email: string;
    role: string;
    memberType: string;
    token: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<ClientInvitation>;
  getClientInvitationByToken(token: string): Promise<ClientInvitation | undefined>;
  acceptClientInvitation(token: string, userId: string): Promise<ClientUser | undefined>;
  getClientInvitations(clientId: number): Promise<ClientInvitation[]>;
  userCanAccessClient(userId: string, tenantId: number, clientId: number, options?: { platformRole?: string; isJigantoStaff?: boolean }): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Tenants
  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(insertTenant).returning();
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant;
  }

  async updateTenant(id: number, updates: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [result] = await db.update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return result;
  }

  // User Roles
  async getUserRoles(tenantId: number): Promise<UserRole[]> {
    return await db.select().from(userRoles).where(eq(userRoles.tenantId, tenantId));
  }

  async getUserRole(id: number): Promise<UserRole | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.id, id));
    return role;
  }

  async createUserRole(role: InsertUserRole): Promise<UserRole> {
    const [result] = await db.insert(userRoles).values(role).returning();
    return result;
  }

  async updateUserRole(id: number, updates: Partial<InsertUserRole>): Promise<UserRole | undefined> {
    const [result] = await db.update(userRoles)
      .set(updates)
      .where(eq(userRoles.id, id))
      .returning();
    return result;
  }

  async deleteUserRole(id: number): Promise<void> {
    await db.delete(userRoles).where(eq(userRoles.id, id));
  }

  // User Invitations
  async getUserInvitations(tenantId: number): Promise<UserInvitation[]> {
    return await db.select().from(userInvitations).where(eq(userInvitations.tenantId, tenantId));
  }

  async getUserInvitation(id: number): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.id, id));
    return invitation;
  }

  async getUserInvitationByToken(token: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.token, token));
    return invitation;
  }

  async createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation> {
    const [result] = await db.insert(userInvitations).values(invitation).returning();
    return result;
  }

  async updateUserInvitation(id: number, updates: Partial<InsertUserInvitation>): Promise<UserInvitation | undefined> {
    const [result] = await db.update(userInvitations)
      .set(updates)
      .where(eq(userInvitations.id, id))
      .returning();
    return result;
  }

  async deleteUserInvitation(id: number): Promise<void> {
    await db.delete(userInvitations).where(eq(userInvitations.id, id));
  }

  // Notifications
  async getNotifications(
    userId: string,
    limit?: number,
    clientId?: number | null,
  ): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId)];
    if (clientId != null) {
      conditions.push(eq(notifications.clientId, clientId));
    }
    const query = db.select().from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async getUnreadNotificationCount(userId: string, clientId?: number | null): Promise<number> {
    const conditions = [eq(notifications.userId, userId), eq(notifications.isRead, false)];
    if (clientId != null) {
      conditions.push(eq(notifications.clientId, clientId));
    }
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...conditions));
    return result[0]?.count || 0;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    return notification;
  }

  async markNotificationAsRead(id: number, userId: string): Promise<Notification | undefined> {
    const [notification] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async deleteNotification(id: number, userId: string): Promise<void> {
    await db.delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  // Feedback
  async getFeedback(tenantId?: number): Promise<Feedback[]> {
    if (tenantId) {
      return db.select().from(feedback)
        .where(eq(feedback.tenantId, tenantId))
        .orderBy(desc(feedback.createdAt));
    }
    return db.select().from(feedback).orderBy(desc(feedback.createdAt));
  }

  async getFeedbackItem(id: number): Promise<Feedback | undefined> {
    const [item] = await db.select().from(feedback).where(eq(feedback.id, id));
    return item;
  }

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [item] = await db.insert(feedback).values(data).returning();
    return item;
  }

  async updateFeedbackStatus(id: number, status: string): Promise<Feedback | undefined> {
    const [item] = await db.update(feedback)
      .set({ status, updatedAt: new Date() })
      .where(eq(feedback.id, id))
      .returning();
    return item;
  }

  // Profiles (extended)
  async getProfiles(tenantId: number): Promise<(Profile & { user: { id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null } })[]> {
    const results = await db.select({
      id: profiles.id,
      userId: profiles.userId,
      tenantId: profiles.tenantId,
      roleId: profiles.roleId,
      orgUnitId: profiles.orgUnitId,
      costCentreId: profiles.costCentreId,
      managerId: profiles.managerId,
      photoUrl: profiles.photoUrl,
      role: profiles.role,
      userType: profiles.userType,
      department: profiles.department,
      jobTitle: profiles.jobTitle,
      phone: profiles.phone,
      bio: profiles.bio,
      isActive: profiles.isActive,
      startDate: profiles.startDate,
      endDate: profiles.endDate,
      lastLoginAt: profiles.lastLoginAt,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
      },
    })
    .from(profiles)
    .leftJoin(users, eq(profiles.userId, users.id))
    .where(eq(profiles.tenantId, tenantId));
    
    return results.map(r => ({
      ...r,
      user: r.user || { id: r.userId, firstName: null, lastName: null, email: null, profileImageUrl: null }
    }));
  }

  async getProfile(userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile;
  }

  async getProfileByUserId(userId: string, tenantId: number): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles)
      .where(and(eq(profiles.userId, userId), eq(profiles.tenantId, tenantId)));
    return profile;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [result] = await db.insert(profiles).values(profile).returning();
    return result;
  }

  async updateProfile(id: number, updates: Partial<InsertProfile>): Promise<Profile | undefined> {
    const [result] = await db.update(profiles)
      .set(updates)
      .where(eq(profiles.id, id))
      .returning();
    return result;
  }

  async deleteProfile(id: number): Promise<void> {
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  async getUserModulePermissions(profileId: number): Promise<UserModulePermission[]> {
    return await db.select().from(userModulePermissions).where(eq(userModulePermissions.profileId, profileId));
  }

  async upsertUserModulePermissions(profileId: number, tenantId: number, permissions: { moduleKey: string; canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }[]): Promise<UserModulePermission[]> {
    await db.delete(userModulePermissions).where(eq(userModulePermissions.profileId, profileId));
    if (permissions.length === 0) return [];
    const values = permissions.map(p => ({
      profileId,
      tenantId,
      moduleKey: p.moduleKey,
      canCreate: p.canCreate,
      canRead: p.canRead,
      canUpdate: p.canUpdate,
      canDelete: p.canDelete,
    }));
    return await db.insert(userModulePermissions).values(values).returning();
  }

  // Org Units
  async getOrgUnits(tenantId: number): Promise<OrgUnit[]> {
    return await db.select().from(orgUnits).where(eq(orgUnits.tenantId, tenantId)).orderBy(orgUnits.name);
  }

  async getOrgUnit(id: number): Promise<OrgUnit | undefined> {
    const [result] = await db.select().from(orgUnits).where(eq(orgUnits.id, id));
    return result;
  }

  async createOrgUnit(orgUnit: InsertOrgUnit): Promise<OrgUnit> {
    const [result] = await db.insert(orgUnits).values(orgUnit).returning();
    return result;
  }

  async updateOrgUnit(id: number, updates: Partial<InsertOrgUnit>): Promise<OrgUnit | undefined> {
    const [result] = await db.update(orgUnits).set({ ...updates, updatedAt: new Date() }).where(eq(orgUnits.id, id)).returning();
    return result;
  }

  async deleteOrgUnit(id: number): Promise<void> {
    await db.delete(orgUnits).where(eq(orgUnits.id, id));
  }

  // Cost Centres
  async getCostCentres(tenantId: number): Promise<CostCentre[]> {
    return await db.select().from(costCentres).where(eq(costCentres.tenantId, tenantId)).orderBy(costCentres.name);
  }

  async getCostCentre(id: number): Promise<CostCentre | undefined> {
    const [result] = await db.select().from(costCentres).where(eq(costCentres.id, id));
    return result;
  }

  async createCostCentre(costCentre: InsertCostCentre): Promise<CostCentre> {
    const [result] = await db.insert(costCentres).values(costCentre).returning();
    return result;
  }

  async updateCostCentre(id: number, updates: Partial<InsertCostCentre>): Promise<CostCentre | undefined> {
    const [result] = await db.update(costCentres).set({ ...updates, updatedAt: new Date() }).where(eq(costCentres.id, id)).returning();
    return result;
  }

  async deleteCostCentre(id: number): Promise<void> {
    await db.delete(costCentres).where(eq(costCentres.id, id));
  }

  // User Project Assignments
  async getUserProjectAssignments(profileId: number): Promise<UserProjectAssignment[]> {
    return await db.select().from(userProjectAssignments).where(eq(userProjectAssignments.profileId, profileId));
  }

  async getAssignmentCountsByTenant(tenantId: number): Promise<Record<number, number>> {
    const rows = await db
      .select({
        profileId: userProjectAssignments.profileId,
        count: sql<number>`count(*)::int`,
      })
      .from(userProjectAssignments)
      .where(eq(userProjectAssignments.tenantId, tenantId))
      .groupBy(userProjectAssignments.profileId);
    const result: Record<number, number> = {};
    for (const row of rows) {
      result[row.profileId] = row.count;
    }
    return result;
  }

  async createUserProjectAssignment(assignment: InsertUserProjectAssignment): Promise<UserProjectAssignment> {
    const [result] = await db.insert(userProjectAssignments).values(assignment).returning();
    return result;
  }

  async updateUserProjectAssignment(id: number, updates: Partial<InsertUserProjectAssignment>): Promise<UserProjectAssignment | undefined> {
    const [result] = await db.update(userProjectAssignments).set(updates).where(eq(userProjectAssignments.id, id)).returning();
    return result;
  }

  async deleteUserProjectAssignment(id: number): Promise<void> {
    await db.delete(userProjectAssignments).where(eq(userProjectAssignments.id, id));
  }

  // Modules
  async getModules(): Promise<Module[]> {
    return await db.select().from(modules);
  }

  async createModule(insertModule: InsertModule): Promise<Module> {
    const [module] = await db.insert(modules).values(insertModule).returning();
    return module;
  }

  // Boards
  async getBoards(tenantId?: number, moduleId?: number, workspaceId?: number): Promise<Board[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(boards.tenantId, tenantId));
    if (moduleId) conditions.push(eq(boards.moduleId, moduleId));
    if (workspaceId !== undefined) conditions.push(eq(boards.workspaceId, workspaceId));
    if (conditions.length === 0) return await db.select().from(boards);
    return await db.select().from(boards).where(and(...conditions));
  }

  async getBoard(id: number): Promise<Board | undefined> {
    const [board] = await db.select().from(boards).where(eq(boards.id, id));
    return board;
  }

  async createBoard(insertBoard: InsertBoard): Promise<Board> {
    const [board] = await db.insert(boards).values(insertBoard).returning();
    return board;
  }

  // Columns
  async getColumns(boardId: number): Promise<Column[]> {
    return await db.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(columns.order);
  }

  async createColumn(insertColumn: InsertColumn): Promise<Column> {
    const [column] = await db.insert(columns).values(insertColumn).returning();
    return column;
  }

  // Items
  async getItems(boardId: number): Promise<Item[]> {
    return await db.select().from(items).where(eq(items.boardId, boardId)).orderBy(items.createdAt);
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }

  async updateItem(id: number, updates: Partial<InsertItem>): Promise<Item | undefined> {
    const [item] = await db.update(items)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return item;
  }

  async deleteItem(id: number): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  // Projects
  async getProjects(tenantId: number): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.tenantId, tenantId)).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(
    id: number,
    updates: Partial<Pick<InsertProject, "name" | "description" | "status">>,
  ): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async getUserProjects(userId: string, tenantId: number): Promise<Project[]> {
    const memberProjects = await db
      .select({ project: projects })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(and(eq(projectMembers.userId, userId), eq(projects.tenantId, tenantId)));
    return memberProjects.map(mp => mp.project);
  }

  // Project Members
  async getProjectMembers(projectId: number): Promise<(ProjectMember & { user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]> {
    const result = await db
      .select({
        member: projectMembers,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId));
    
    return result.map(r => ({ ...r.member, user: r.user }));
  }

  async addProjectMember(member: InsertProjectMember): Promise<ProjectMember> {
    const [result] = await db.insert(projectMembers).values(member).returning();
    return result;
  }

  async removeProjectMember(projectId: number, userId: string): Promise<void> {
    await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  }

  async isProjectMember(projectId: number, userId: string): Promise<boolean> {
    const [member] = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
    return !!member;
  }

  // Channels
  async getChannels(tenantId: number, userId: string, projectId?: number | null): Promise<Channel[]> {
    // Single LEFT JOIN — returns channel if it's public OR the user is a member
    const myMembership = alias(channelMembers, "cm_user");
    const conditions = [eq(channels.tenantId, tenantId)];
    if (projectId === null) {
      conditions.push(isNull(channels.projectId));
    } else if (projectId !== undefined) {
      conditions.push(eq(channels.projectId, projectId));
    }

    const rows = await db
      .select({ channel: channels, isMember: myMembership.userId })
      .from(channels)
      .leftJoin(myMembership, and(eq(myMembership.channelId, channels.id), eq(myMembership.userId, userId)))
      .where(and(...conditions))
      .orderBy(channels.name);

    return rows
      .filter((r) => r.channel.type === "public" || r.isMember != null)
      .map((r) => r.channel);
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel;
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const [channel] = await db.insert(channels).values(insertChannel).returning();
    return channel;
  }

  async updateChannel(id: number, updates: Partial<InsertChannel>): Promise<Channel | undefined> {
    const [channel] = await db.update(channels).set({ ...updates, updatedAt: new Date() }).where(eq(channels.id, id)).returning();
    return channel;
  }

  async deleteChannel(id: number): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
  }

  // Channel Members
  async getChannelMembers(channelId: number): Promise<(ChannelMember & { user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]> {
    const result = await db
      .select({
        member: channelMembers,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, channelId));
    
    return result.map(r => ({ ...r.member, user: r.user }));
  }

  async addChannelMember(member: InsertChannelMember): Promise<ChannelMember> {
    const [result] = await db.insert(channelMembers).values(member).returning();
    return result;
  }

  async removeChannelMember(channelId: number, userId: string): Promise<void> {
    await db.delete(channelMembers).where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
  }

  async isChannelMember(channelId: number, userId: string): Promise<boolean> {
    const [member] = await db.select().from(channelMembers).where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
    return !!member;
  }

  async updateLastRead(channelId: number, userId: string): Promise<void> {
    await db.update(channelMembers).set({ lastReadAt: new Date() }).where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
  }

  // Messages
  async getMessages(
    channelId: number,
    limit: number = 50,
    before?: number,
    parentId: number | null = null,
    currentUserId?: string,
  ): Promise<ChatMessageWithMeta[]> {
    const conditions = [
      eq(chatMessages.channelId, channelId),
      eq(chatMessages.isDeleted, false),
    ];
    if (parentId === null) {
      conditions.push(isNull(chatMessages.parentId));
    } else {
      conditions.push(eq(chatMessages.parentId, parentId));
    }
    if (before) {
      conditions.push(lt(chatMessages.id, before));
    }

    const result = await db
      .select({
        message: chatMessages,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    const rows = result.map((r) => ({ ...r.message, user: r.user })).reverse();
    if (rows.length === 0) return [];

    const messageIds = rows.map((m) => m.id);
    const reactionRows = await db
      .select()
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, messageIds));

    const threadStats =
      parentId === null
        ? await db
            .select({
              parentId: chatMessages.parentId,
              count: sql<number>`count(*)::int`,
              lastAt: sql<string>`max(${chatMessages.createdAt})`,
            })
            .from(chatMessages)
            .where(
              and(
                eq(chatMessages.channelId, channelId),
                eq(chatMessages.isDeleted, false),
                inArray(chatMessages.parentId, messageIds),
              ),
            )
            .groupBy(chatMessages.parentId)
        : [];

    const threadMap = new Map(
      threadStats.map((t) => [t.parentId!, { count: t.count, lastAt: t.lastAt }]),
    );

    const attachmentRows =
      messageIds.length > 0
        ? await db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, messageIds))
        : [];

    const pinnedRows =
      messageIds.length > 0
        ? await db
            .select({ messageId: pinnedMessages.messageId })
            .from(pinnedMessages)
            .where(
              and(
                eq(pinnedMessages.channelId, channelId),
                inArray(pinnedMessages.messageId, messageIds),
              ),
            )
        : [];
    const pinnedSet = new Set(pinnedRows.map((p) => p.messageId));

    return rows.map((message) => {
      const grouped = new Map<string, { count: number; userIds: string[] }>();
      for (const r of reactionRows.filter((x) => x.messageId === message.id)) {
        const existing = grouped.get(r.emoji) ?? { count: 0, userIds: [] };
        existing.count += 1;
        existing.userIds.push(r.userId);
        grouped.set(r.emoji, existing);
      }
      const thread = threadMap.get(message.id);
      return {
        ...message,
        reactions: Array.from(grouped.entries()).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          userIds: data.userIds,
          reactedByMe: currentUserId ? data.userIds.includes(currentUserId) : false,
        })),
        threadReplyCount: thread?.count ?? 0,
        threadLastReplyAt: thread?.lastAt ?? null,
        attachments: attachmentRows
          .filter((a) => a.messageId === message.id)
          .map((a) => ({
            id: a.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            url: a.url,
          })),
        isPinned: pinnedSet.has(message.id),
      };
    });
  }

  async getMessage(id: number): Promise<ChatMessage | undefined> {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return message;
  }

  async getMessageWithUser(id: number) {
    const [row] = await db
      .select({
        message: chatMessages,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(and(eq(chatMessages.id, id), eq(chatMessages.isDeleted, false)));
    if (!row) return undefined;
    return { ...row.message, user: row.user };
  }

  async createMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(insertMessage).returning();
    return message;
  }

  async updateMessage(id: number, content: string): Promise<ChatMessage | undefined> {
    const [message] = await db.update(chatMessages).set({ content, isEdited: true, editedAt: new Date() }).where(eq(chatMessages.id, id)).returning();
    return message;
  }

  async deleteMessage(id: number): Promise<ChatMessage | undefined> {
    const [message] = await db.update(chatMessages).set({ isDeleted: true, deletedAt: new Date() }).where(eq(chatMessages.id, id)).returning();
    return message;
  }

  // Reactions
  async addReaction(reaction: InsertMessageReaction): Promise<MessageReaction> {
    const [result] = await db.insert(messageReactions).values(reaction).returning();
    return result;
  }

  async removeReaction(messageId: number, userId: string, emoji: string): Promise<void> {
    await db.delete(messageReactions).where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId), eq(messageReactions.emoji, emoji)));
  }

  async getMessageReactions(messageId: number): Promise<MessageReaction[]> {
    return await db.select().from(messageReactions).where(eq(messageReactions.messageId, messageId));
  }

  // User Favorites
  async getUserFavorites(userId: string, tenantId: number): Promise<{ id: number; favoriteUserId: string; user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } }[]> {
    const favorites = await db
      .select({
        id: userFavorites.id,
        favoriteUserId: userFavorites.favoriteUserId,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(userFavorites)
      .innerJoin(users, eq(userFavorites.favoriteUserId, users.id))
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.tenantId, tenantId)));
    return favorites;
  }

  async addUserFavorite(userId: string, favoriteUserId: string, tenantId: number): Promise<UserFavorite> {
    const [favorite] = await db.insert(userFavorites).values({
      userId,
      favoriteUserId,
      tenantId,
    }).returning();
    return favorite;
  }

  async removeUserFavorite(userId: string, favoriteUserId: string, tenantId: number): Promise<void> {
    await db.delete(userFavorites).where(
      and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.favoriteUserId, favoriteUserId),
        eq(userFavorites.tenantId, tenantId)
      )
    );
  }

  // User Search
  async searchUsers(tenantId: number, query: string, projectId?: number): Promise<{ id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null }[]> {
    const lowerQuery = query.trim() ? `%${query.toLowerCase()}%` : null;

    if (projectId) {
      const conditions = [
        eq(projectMembers.projectId, projectId),
        eq(orgMemberships.orgId, tenantId),
        eq(orgMemberships.isActive, true),
      ];
      if (lowerQuery) {
        conditions.push(
          or(
            sql`LOWER(${users.firstName}) LIKE ${lowerQuery}`,
            sql`LOWER(${users.lastName}) LIKE ${lowerQuery}`,
            sql`LOWER(${users.email}) LIKE ${lowerQuery}`,
          )!,
        );
      }
      return db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        })
        .from(users)
        .innerJoin(projectMembers, eq(projectMembers.userId, users.id))
        .innerJoin(
          orgMemberships,
          and(eq(orgMemberships.userId, users.id), eq(orgMemberships.orgId, tenantId), eq(orgMemberships.isActive, true)),
        )
        .where(and(...conditions))
        .limit(lowerQuery ? 20 : 100);
    }

    if (!lowerQuery) {
      return this.getTenantUsers(tenantId);
    }

    return this.getTenantUsersQuery(tenantId)
      .where(
        or(
          sql`LOWER(${users.firstName}) LIKE ${lowerQuery}`,
          sql`LOWER(${users.lastName}) LIKE ${lowerQuery}`,
          sql`LOWER(${users.email}) LIKE ${lowerQuery}`,
        ),
      )
      .limit(20);
  }

  private getTenantUsersQuery(tenantId: number) {
    return db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .innerJoin(
        orgMemberships,
        and(eq(orgMemberships.userId, users.id), eq(orgMemberships.orgId, tenantId), eq(orgMemberships.isActive, true)),
      );
  }

  async getTenantUsers(tenantId: number): Promise<{ id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null }[]> {
    return this.getTenantUsersQuery(tenantId).limit(100);
  }

  // Direct Messages
  async getOrCreateDMChannel(userId: string, otherUserId: string, tenantId: number): Promise<Channel> {
    // Sort user IDs to create a consistent name for the DM channel
    const sortedIds = [userId, otherUserId].sort();
    const dmName = `dm-${sortedIds[0]}-${sortedIds[1]}`;
    
    // Check if DM channel already exists
    const [existing] = await db
      .select()
      .from(channels)
      .where(and(
        eq(channels.tenantId, tenantId),
        eq(channels.type, "direct"),
        eq(channels.name, dmName)
      ));
    
    if (existing) {
      return existing;
    }
    
    // Create new DM channel
    const [channel] = await db.insert(channels).values({
      tenantId,
      name: dmName,
      type: "direct",
      createdById: userId,
    }).returning();
    
    // Add both users as members
    await db.insert(channelMembers).values([
      { channelId: channel.id, userId },
      { channelId: channel.id, userId: otherUserId },
    ]).onConflictDoNothing();
    
    return channel;
  }

  async getDirectMessageChannels(userId: string, tenantId: number): Promise<(Channel & { otherUser: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]> {
    // Single query: join channels → my membership → other member → other user profile
    const myMembership = alias(channelMembers, "my_cm");
    const otherMembership = alias(channelMembers, "other_cm");

    const rows = await db
      .select({
        channel: channels,
        otherUser: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(channels)
      .innerJoin(myMembership, and(eq(channels.id, myMembership.channelId), eq(myMembership.userId, userId)))
      .leftJoin(otherMembership, and(eq(channels.id, otherMembership.channelId), ne(otherMembership.userId, userId)))
      .leftJoin(users, eq(otherMembership.userId, users.id))
      .where(and(eq(channels.tenantId, tenantId), eq(channels.type, "direct")));

    // Deduplicate by channel ID — group DMs can produce multiple rows (one per other member)
    const seen = new Set<number>();
    return rows
      .filter((r) => {
        if (seen.has(r.channel.id)) return false;
        seen.add(r.channel.id);
        return true;
      })
      .map((r) => ({
        ...r.channel,
        otherUser: r.otherUser ?? { id: "", firstName: null, lastName: null, profileImageUrl: null },
      }));
  }

  async getFavoriteChannelIds(userId: string, tenantId: number): Promise<number[]> {
    const rows = await db
      .select({ channelId: channelFavorites.channelId })
      .from(channelFavorites)
      .where(and(eq(channelFavorites.userId, userId), eq(channelFavorites.tenantId, tenantId)));
    return rows.map((r) => r.channelId);
  }

  async addChannelFavorite(userId: string, channelId: number, tenantId: number): Promise<void> {
    await db
      .insert(channelFavorites)
      .values({ userId, channelId, tenantId })
      .onConflictDoNothing();
  }

  async removeChannelFavorite(userId: string, channelId: number, tenantId: number): Promise<void> {
    await db
      .delete(channelFavorites)
      .where(
        and(
          eq(channelFavorites.userId, userId),
          eq(channelFavorites.channelId, channelId),
          eq(channelFavorites.tenantId, tenantId),
        ),
      );
  }

  private async buildInboxItem(
    userId: string,
    channel: Channel & {
      bridgeConfig?: ChannelBridgeConfig | null;
      otherUser?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null };
    },
    favoriteIds: Set<number>,
    lastReadAt: Date | null | undefined,
    projectName: string | null,
    notificationPref: ChatNotificationPref,
    memberRole: string,
  ): Promise<ChatInboxItem> {
    const [lastMsg] = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, channel.id),
          isNull(chatMessages.parentId),
          eq(chatMessages.isDeleted, false),
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(1);

    const unreadConditions = [
      eq(chatMessages.channelId, channel.id),
      isNull(chatMessages.parentId),
      eq(chatMessages.isDeleted, false),
      ne(chatMessages.userId, userId),
    ];
    if (lastReadAt) unreadConditions.push(gt(chatMessages.createdAt, lastReadAt));

    const [{ unreadCount }] = await db
      .select({ unreadCount: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(and(...unreadConditions));

    const displayName =
      channel.type === "direct" && channel.otherUser
        ? [channel.otherUser.firstName, channel.otherUser.lastName].filter(Boolean).join(" ") || "Direct message"
        : channel.name.startsWith("#")
          ? channel.name
          : `#${channel.name}`;

    let preview = lastMsg?.content ?? null;
    if (lastMsg?.messageType === "poll") preview = `📊 ${preview?.replace(/^📊\s*/, "") ?? "Poll"}`;
    if (preview && preview.length > 80) preview = `${preview.slice(0, 77)}…`;

    return {
      channelId: channel.id,
      name: channel.name,
      displayName,
      type: channel.type,
      projectId: channel.projectId,
      projectName,
      unreadCount: unreadCount ?? 0,
      lastMessagePreview: preview,
      lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
      isFavorite: favoriteIds.has(channel.id),
      bridge: (channel.bridgeConfig as ChannelBridgeConfig | null) ?? null,
      notificationPref,
      memberRole,
      canPost: channel.type !== "announcement" || memberRole === "admin" || memberRole === "owner",
      otherUser: channel.otherUser,
    };
  }

  async getChatInbox(userId: string, tenantId: number, clientId?: number): Promise<ChatInboxItem[]> {
    const [channelList, dmList, favoriteIdsList, memberRows, projectList] = await Promise.all([
      this.getChannels(tenantId, userId),
      this.getDirectMessageChannels(userId, tenantId),
      this.getFavoriteChannelIds(userId, tenantId),
      db.select().from(channelMembers).where(eq(channelMembers.userId, userId)),
      this.getProjects(tenantId),
    ]);

    const favoriteIds = new Set(favoriteIdsList);
    const lastReadMap = new Map(memberRows.map((m) => [m.channelId, m.lastReadAt]));
    const notifMap = new Map(
      memberRows.map((m) => [m.channelId, (m.notificationPref ?? "mentions") as ChatNotificationPref]),
    );
    const roleMap = new Map(memberRows.map((m) => [m.channelId, m.role ?? "member"]));
    const projectNameMap = new Map(projectList.map((p) => [p.id, p.name]));

    const nonDmChannels = channelList.filter((c) => c.type !== "direct");
    const allEntries: Array<Channel & { otherUser?: ChatInboxItem["otherUser"] }> = [
      ...nonDmChannels,
      ...dmList,
    ];

    if (allEntries.length === 0) return [];

    const allChannelIds = [...new Set(allEntries.map((c) => c.id))];

    // ─── BATCH 1: Last top-level message per channel (max-ID subquery approach) ───
    const maxIdSub = db
      .select({
        channelId: chatMessages.channelId,
        maxId: sql<number>`max(${chatMessages.id})`.as("max_id"),
      })
      .from(chatMessages)
      .where(
        and(
          inArray(chatMessages.channelId, allChannelIds),
          isNull(chatMessages.parentId),
          eq(chatMessages.isDeleted, false),
        ),
      )
      .groupBy(chatMessages.channelId)
      .as("last_msg_sub");

    const lastMsgRows = await db
      .select({
        channelId: chatMessages.channelId,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
        messageType: chatMessages.messageType,
      })
      .from(chatMessages)
      .innerJoin(maxIdSub, eq(chatMessages.id, maxIdSub.maxId));

    const lastMsgMap = new Map(
      lastMsgRows.map((r) => [r.channelId, r]),
    );

    // ─── BATCH 2: Unread counts per channel (single JOIN + GROUP BY query) ─────────
    const myMembershipRef = alias(channelMembers, "cm_read");
    const unreadRows = await db
      .select({
        channelId: chatMessages.channelId,
        unreadCount: sql<number>`count(*)::int`,
      })
      .from(chatMessages)
      .leftJoin(
        myMembershipRef,
        and(eq(myMembershipRef.channelId, chatMessages.channelId), eq(myMembershipRef.userId, userId)),
      )
      .where(
        and(
          inArray(chatMessages.channelId, allChannelIds),
          isNull(chatMessages.parentId),
          eq(chatMessages.isDeleted, false),
          ne(chatMessages.userId, userId),
          or(isNull(myMembershipRef.lastReadAt), gt(chatMessages.createdAt, myMembershipRef.lastReadAt)),
        ),
      )
      .groupBy(chatMessages.channelId);
    const unreadMap = new Map(unreadRows.map((r) => [r.channelId, r.unreadCount ?? 0]));

    // ─── Build inbox items in-memory (zero additional DB queries) ────────────────
    const items: ChatInboxItem[] = allEntries.map((ch) => {
      const lastMsg = lastMsgMap.get(ch.id);
      const memberRole = roleMap.get(ch.id) ?? "member";
      const notificationPref = notifMap.get(ch.id) ?? "mentions";

      const displayName =
        ch.type === "direct" && ch.otherUser
          ? [ch.otherUser.firstName, ch.otherUser.lastName].filter(Boolean).join(" ") || "Direct message"
          : ch.name.startsWith("#")
            ? ch.name
            : `#${ch.name}`;

      let preview = lastMsg?.content ?? null;
      if (lastMsg?.messageType === "poll") preview = `📊 ${preview?.replace(/^📊\s*/, "") ?? "Poll"}`;
      if (preview && preview.length > 80) preview = `${preview.slice(0, 77)}…`;

      const lastReadAt = lastReadMap.get(ch.id);
      return {
        channelId: ch.id,
        name: ch.name,
        displayName,
        description: ch.description ?? null,
        type: ch.type,
        projectId: ch.projectId,
        projectName: ch.projectId ? (projectNameMap.get(ch.projectId) ?? null) : null,
        unreadCount: unreadMap.get(ch.id) ?? 0,
        lastMessagePreview: preview,
        lastMessageAt: lastMsg ? new Date(lastMsg.createdAt).toISOString() : null,
        lastReadAt: lastReadAt ? lastReadAt.toISOString() : null,
        isFavorite: favoriteIds.has(ch.id),
        bridge: (ch.bridgeConfig as ChannelBridgeConfig | null) ?? null,
        notificationPref,
        memberRole,
        canPost: ch.type !== "announcement" || memberRole === "admin" || memberRole === "owner",
        otherUser: ch.otherUser,
      };
    });

    let filtered = items;
    if (clientId != null && clientId > 0) {
      const client = await this.getClientById(clientId, tenantId);
      if (client) {
        const teamName = `${client.name} Team`;
        const clientProjectIds = new Set(
          projectList.filter((p) => p.name === teamName).map((p) => p.id),
        );
        filtered = items.filter(
          (item) => item.projectId != null && clientProjectIds.has(item.projectId),
        );
      }
    }

    return filtered.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async createChatTeam(
    userId: string,
    tenantId: number,
    input: { name: string; description?: string; isPrivate?: boolean; memberIds?: string[] },
  ): Promise<{ project: Project; channel: Channel }> {
    const project = await this.createProject({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      status: "active",
    });
    await this.addProjectMember({ projectId: project.id, userId, role: "owner" });
    for (const memberId of input.memberIds ?? []) {
      if (memberId !== userId) {
        await this.addProjectMember({ projectId: project.id, userId: memberId, role: "member" });
      }
    }
    const channel = await this.createChannel({
      tenantId,
      projectId: project.id,
      name: "general",
      description: `General discussion for ${input.name}`,
      type: input.isPrivate ? "private" : "public",
      isDefault: true,
      createdById: userId,
    });
    await this.addChannelMember({ channelId: channel.id, userId, role: "admin" });
    for (const memberId of input.memberIds ?? []) {
      if (memberId !== userId) {
        await this.addChannelMember({ channelId: channel.id, userId: memberId, role: "member" });
      }
    }
    return { project, channel };
  }

  async searchChatMessages(
    userId: string,
    tenantId: number,
    query: string,
    channelId?: number,
  ): Promise<ChatSearchHit[]> {
    if (!query.trim()) return [];
    const accessible = await this.getChannels(tenantId, userId);
    const dms = await this.getDirectMessageChannels(userId, tenantId);
    const allowedIds = new Set([
      ...accessible.map((c) => c.id),
      ...dms.map((d) => d.id),
    ]);
    if (channelId && !allowedIds.has(channelId)) return [];

    const targetIds = channelId ? [channelId] : Array.from(allowedIds);
    if (targetIds.length === 0) return [];

    const pattern = `%${query.toLowerCase()}%`;
    const rows = await db
      .select({
        message: chatMessages,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        channel: channels,
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .innerJoin(channels, eq(chatMessages.channelId, channels.id))
      .where(
        and(
          inArray(chatMessages.channelId, targetIds),
          eq(chatMessages.isDeleted, false),
          sql`LOWER(${chatMessages.content}) LIKE ${pattern}`,
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(40);

    return rows.map((r) => ({
      messageId: r.message.id,
      channelId: r.channel.id,
      channelName: r.channel.type === "direct" ? "Direct message" : r.channel.name,
      content: r.message.content,
      createdAt: r.message.createdAt.toISOString(),
      user: r.user,
    }));
  }

  async getThreadReplies(
    parentId: number,
  ): Promise<
    (ChatMessage & {
      user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null };
      reactions: MessageReaction[];
    })[]
  > {
    const parent = await this.getMessage(parentId);
    if (!parent) return [];

    const rows = await db
      .select({
        message: chatMessages,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(
        and(
          eq(chatMessages.parentId, parentId),
          eq(chatMessages.isDeleted, false),
        ),
      )
      .orderBy(chatMessages.createdAt);

    const ids = rows.map((r) => r.message.id);
    const reactionRows =
      ids.length > 0
        ? await db.select().from(messageReactions).where(inArray(messageReactions.messageId, ids))
        : [];

    return rows.map((r) => ({
      ...r.message,
      user: r.user,
      reactions: reactionRows.filter((x) => x.messageId === r.message.id),
    }));
  }

  async createMessageAttachment(row: InsertMessageAttachment): Promise<MessageAttachment> {
    const [result] = await db.insert(messageAttachments).values(row).returning();
    return result;
  }

  async linkAttachmentsToMessage(
    messageId: number,
    attachmentIds: number[],
    channelId: number,
    userId: string,
  ): Promise<void> {
    if (attachmentIds.length === 0) return;
    await db
      .update(messageAttachments)
      .set({ messageId })
      .where(
        and(
          inArray(messageAttachments.id, attachmentIds),
          eq(messageAttachments.channelId, channelId),
          eq(messageAttachments.userId, userId),
        ),
      );
  }

  async getAttachmentsForMessages(messageIds: number[]): Promise<MessageAttachment[]> {
    if (messageIds.length === 0) return [];
    return db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, messageIds));
  }

  async pinMessage(channelId: number, messageId: number, userId: string): Promise<PinnedMessage> {
    const [row] = await db
      .insert(pinnedMessages)
      .values({ channelId, messageId, pinnedByUserId: userId })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
    const [existing] = await db
      .select()
      .from(pinnedMessages)
      .where(and(eq(pinnedMessages.channelId, channelId), eq(pinnedMessages.messageId, messageId)));
    return existing!;
  }

  async unpinMessage(channelId: number, messageId: number): Promise<void> {
    await db
      .delete(pinnedMessages)
      .where(and(eq(pinnedMessages.channelId, channelId), eq(pinnedMessages.messageId, messageId)));
  }

  async getPinnedMessages(channelId: number) {
    const rows = await db
      .select({
        pin: pinnedMessages,
        message: chatMessages,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(pinnedMessages)
      .innerJoin(chatMessages, eq(pinnedMessages.messageId, chatMessages.id))
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(eq(pinnedMessages.channelId, channelId))
      .orderBy(desc(pinnedMessages.pinnedAt));
    return rows.map((r) => ({ ...r.pin, message: { ...r.message, user: r.user } }));
  }

  async updateChannelBridge(channelId: number, bridgeConfig: ChannelBridgeConfig | null): Promise<Channel | undefined> {
    const [channel] = await db
      .update(channels)
      .set({ bridgeConfig, updatedAt: new Date() })
      .where(eq(channels.id, channelId))
      .returning();
    return channel;
  }

  async updateChannelNotificationPref(
    channelId: number,
    userId: string,
    pref: ChatNotificationPref,
  ): Promise<void> {
    await db
      .update(channelMembers)
      .set({ notificationPref: pref })
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
  }

  async getChannelMemberRecord(channelId: number, userId: string): Promise<ChannelMember | undefined> {
    const [row] = await db
      .select()
      .from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
    return row;
  }

  async isChannelAdmin(channelId: number, userId: string): Promise<boolean> {
    const member = await this.getChannelMemberRecord(channelId, userId);
    return member?.role === "admin";
  }

  // CRM Accounts
  async getCrmAccounts(tenantId: number, clientId?: number): Promise<CrmAccount[]> {
    const conditions = [eq(crmAccounts.tenantId, tenantId)];
    if (clientId !== undefined) conditions.push(eq(crmAccounts.clientId, clientId));
    return await db.select().from(crmAccounts).where(and(...conditions)).orderBy(crmAccounts.name);
  }

  async getCrmAccount(id: number): Promise<CrmAccount | undefined> {
    const [account] = await db.select().from(crmAccounts).where(eq(crmAccounts.id, id));
    return account;
  }

  async createCrmAccount(account: InsertCrmAccount): Promise<CrmAccount> {
    const [result] = await db.insert(crmAccounts).values(account).returning();
    return result;
  }

  async updateCrmAccount(id: number, updates: Partial<InsertCrmAccount>): Promise<CrmAccount | undefined> {
    const [result] = await db.update(crmAccounts).set({ ...updates, updatedAt: new Date() }).where(eq(crmAccounts.id, id)).returning();
    return result;
  }

  async deleteCrmAccount(id: number): Promise<void> {
    await db.delete(crmAccounts).where(eq(crmAccounts.id, id));
  }

  // CRM Contacts
  async getCrmContacts(tenantId: number, accountId?: number, clientId?: number): Promise<CrmContact[]> {
    if (clientId !== undefined) {
      const conditions = [
        eq(crmContacts.tenantId, tenantId),
        eq(crmAccounts.clientId, clientId),
      ];
      if (accountId) conditions.push(eq(crmContacts.accountId, accountId));
      return await db
        .select({ contact: crmContacts })
        .from(crmContacts)
        .innerJoin(crmAccounts, eq(crmContacts.accountId, crmAccounts.id))
        .where(and(...conditions))
        .orderBy(crmContacts.lastName)
        .then((rows) => rows.map((r) => r.contact));
    }
    if (accountId) {
      return await db.select().from(crmContacts).where(and(eq(crmContacts.tenantId, tenantId), eq(crmContacts.accountId, accountId))).orderBy(crmContacts.lastName);
    }
    return await db.select().from(crmContacts).where(eq(crmContacts.tenantId, tenantId)).orderBy(crmContacts.lastName);
  }

  async getCrmContact(id: number): Promise<CrmContact | undefined> {
    const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, id));
    return contact;
  }

  async createCrmContact(contact: InsertCrmContact): Promise<CrmContact> {
    const [result] = await db.insert(crmContacts).values(contact).returning();
    return result;
  }

  async updateCrmContact(id: number, updates: Partial<InsertCrmContact>): Promise<CrmContact | undefined> {
    const [result] = await db.update(crmContacts).set({ ...updates, updatedAt: new Date() }).where(eq(crmContacts.id, id)).returning();
    return result;
  }

  async deleteCrmContact(id: number): Promise<void> {
    await db.delete(crmContacts).where(eq(crmContacts.id, id));
  }

  // CRM Contact Relationships
  async getCrmContactRelationships(contactId: number): Promise<CrmContactRelationship[]> {
    return await db.select().from(crmContactRelationships).where(eq(crmContactRelationships.contactId, contactId));
  }

  async createCrmContactRelationship(relationship: InsertCrmContactRelationship): Promise<CrmContactRelationship> {
    const [created] = await db.insert(crmContactRelationships).values(relationship).returning();
    return created;
  }

  async deleteCrmContactRelationship(id: number): Promise<void> {
    await db.delete(crmContactRelationships).where(eq(crmContactRelationships.id, id));
  }

  // CRM Saved Views
  async getCrmSavedViews(tenantId: number, entityType?: string, userId?: string): Promise<CrmSavedView[]> {
    const conditions = [eq(crmSavedViews.tenantId, tenantId)];
    if (entityType) conditions.push(eq(crmSavedViews.entityType, entityType));
    if (userId) conditions.push(eq(crmSavedViews.userId, userId));
    return await db.select().from(crmSavedViews).where(and(...conditions));
  }

  async getCrmSavedView(id: number): Promise<CrmSavedView | undefined> {
    const [view] = await db.select().from(crmSavedViews).where(eq(crmSavedViews.id, id));
    return view;
  }

  async createCrmSavedView(view: InsertCrmSavedView): Promise<CrmSavedView> {
    const [created] = await db.insert(crmSavedViews).values(view).returning();
    return created;
  }

  async updateCrmSavedView(id: number, updates: Partial<InsertCrmSavedView>): Promise<CrmSavedView | undefined> {
    const [updated] = await db.update(crmSavedViews).set({ ...updates, updatedAt: new Date() }).where(eq(crmSavedViews.id, id)).returning();
    return updated;
  }

  async deleteCrmSavedView(id: number): Promise<void> {
    await db.delete(crmSavedViews).where(eq(crmSavedViews.id, id));
  }

  // CRM Email Templates
  async getCrmEmailTemplates(tenantId: number): Promise<CrmEmailTemplate[]> {
    return await db.select().from(crmEmailTemplates).where(eq(crmEmailTemplates.tenantId, tenantId));
  }

  async getCrmEmailTemplate(id: number): Promise<CrmEmailTemplate | undefined> {
    const [template] = await db.select().from(crmEmailTemplates).where(eq(crmEmailTemplates.id, id));
    return template;
  }

  async createCrmEmailTemplate(template: InsertCrmEmailTemplate): Promise<CrmEmailTemplate> {
    const [created] = await db.insert(crmEmailTemplates).values(template).returning();
    return created;
  }

  async updateCrmEmailTemplate(id: number, updates: Partial<InsertCrmEmailTemplate>): Promise<CrmEmailTemplate | undefined> {
    const [updated] = await db.update(crmEmailTemplates).set({ ...updates, updatedAt: new Date() }).where(eq(crmEmailTemplates.id, id)).returning();
    return updated;
  }

  async deleteCrmEmailTemplate(id: number): Promise<void> {
    await db.delete(crmEmailTemplates).where(eq(crmEmailTemplates.id, id));
  }

  // CRM Email Logs
  async getCrmEmailLogs(tenantId: number, entityType?: string, entityId?: number): Promise<CrmEmailLog[]> {
    const conditions = [eq(crmEmailLogs.tenantId, tenantId)];
    if (entityType) conditions.push(eq(crmEmailLogs.entityType, entityType));
    if (entityId) conditions.push(eq(crmEmailLogs.entityId, entityId));
    return await db.select().from(crmEmailLogs).where(and(...conditions));
  }

  async createCrmEmailLog(log: InsertCrmEmailLog): Promise<CrmEmailLog> {
    const [created] = await db.insert(crmEmailLogs).values(log).returning();
    return created;
  }

  // CRM Forecasts
  async getCrmForecasts(tenantId: number, userId?: string): Promise<CrmForecast[]> {
    const conditions = [eq(crmForecasts.tenantId, tenantId)];
    if (userId) conditions.push(eq(crmForecasts.userId, userId));
    return await db.select().from(crmForecasts).where(and(...conditions));
  }

  async getCrmForecast(id: number): Promise<CrmForecast | undefined> {
    const [forecast] = await db.select().from(crmForecasts).where(eq(crmForecasts.id, id));
    return forecast;
  }

  async createCrmForecast(forecast: InsertCrmForecast): Promise<CrmForecast> {
    const [created] = await db.insert(crmForecasts).values(forecast).returning();
    return created;
  }

  async updateCrmForecast(id: number, updates: Partial<InsertCrmForecast>): Promise<CrmForecast | undefined> {
    const [updated] = await db.update(crmForecasts).set({ ...updates, updatedAt: new Date() }).where(eq(crmForecasts.id, id)).returning();
    return updated;
  }

  async deleteCrmForecast(id: number): Promise<void> {
    await db.delete(crmForecasts).where(eq(crmForecasts.id, id));
  }

  // CRM Territories
  async getCrmTerritories(tenantId: number): Promise<CrmTerritory[]> {
    return await db.select().from(crmTerritories).where(eq(crmTerritories.tenantId, tenantId));
  }

  async getCrmTerritory(id: number): Promise<CrmTerritory | undefined> {
    const [territory] = await db.select().from(crmTerritories).where(eq(crmTerritories.id, id));
    return territory;
  }

  async createCrmTerritory(territory: InsertCrmTerritory): Promise<CrmTerritory> {
    const [created] = await db.insert(crmTerritories).values(territory).returning();
    return created;
  }

  async updateCrmTerritory(id: number, updates: Partial<InsertCrmTerritory>): Promise<CrmTerritory | undefined> {
    const [updated] = await db.update(crmTerritories).set({ ...updates, updatedAt: new Date() }).where(eq(crmTerritories.id, id)).returning();
    return updated;
  }

  async deleteCrmTerritory(id: number): Promise<void> {
    await db.delete(crmTerritories).where(eq(crmTerritories.id, id));
  }

  // CRM Automation Rules
  async getCrmAutomationRules(tenantId: number, entityType?: string): Promise<CrmAutomationRule[]> {
    const conditions = [eq(crmAutomationRules.tenantId, tenantId)];
    if (entityType) conditions.push(eq(crmAutomationRules.entityType, entityType));
    return await db.select().from(crmAutomationRules).where(and(...conditions));
  }

  async getCrmAutomationRule(id: number): Promise<CrmAutomationRule | undefined> {
    const [rule] = await db.select().from(crmAutomationRules).where(eq(crmAutomationRules.id, id));
    return rule;
  }

  async createCrmAutomationRule(rule: InsertCrmAutomationRule): Promise<CrmAutomationRule> {
    const [created] = await db.insert(crmAutomationRules).values(rule).returning();
    return created;
  }

  async updateCrmAutomationRule(id: number, updates: Partial<InsertCrmAutomationRule>): Promise<CrmAutomationRule | undefined> {
    const [updated] = await db.update(crmAutomationRules).set({ ...updates, updatedAt: new Date() }).where(eq(crmAutomationRules.id, id)).returning();
    return updated;
  }

  async deleteCrmAutomationRule(id: number): Promise<void> {
    await db.delete(crmAutomationRules).where(eq(crmAutomationRules.id, id));
  }

  async getCrmCustomFields(tenantId: number, entityType?: string): Promise<CrmCustomField[]> {
    const conditions = [eq(crmCustomFields.tenantId, tenantId)];
    if (entityType) conditions.push(eq(crmCustomFields.entityType, entityType));
    return await db.select().from(crmCustomFields).where(and(...conditions)).orderBy(crmCustomFields.position);
  }

  async createCrmCustomField(field: InsertCrmCustomField): Promise<CrmCustomField> {
    const [created] = await db.insert(crmCustomFields).values(field).returning();
    return created;
  }

  async updateCrmCustomField(id: number, updates: Partial<InsertCrmCustomField>): Promise<CrmCustomField | undefined> {
    const [updated] = await db.update(crmCustomFields).set(updates).where(eq(crmCustomFields.id, id)).returning();
    return updated;
  }

  async deleteCrmCustomField(id: number): Promise<void> {
    await db.delete(crmCustomFields).where(eq(crmCustomFields.id, id));
  }

  // Rate Cards
  async getRateCards(tenantId: number): Promise<RateCard[]> {
    return await db.select().from(rateCards).where(eq(rateCards.tenantId, tenantId)).orderBy(desc(rateCards.createdAt));
  }

  async getRateCard(id: number): Promise<RateCard | undefined> {
    const [card] = await db.select().from(rateCards).where(eq(rateCards.id, id));
    return card;
  }

  async createRateCard(card: InsertRateCard): Promise<RateCard> {
    const [created] = await db.insert(rateCards).values(card).returning();
    return created;
  }

  async updateRateCard(id: number, updates: Partial<InsertRateCard>): Promise<RateCard | undefined> {
    const [updated] = await db.update(rateCards).set({ ...updates, updatedAt: new Date() }).where(eq(rateCards.id, id)).returning();
    return updated;
  }

  async deleteRateCard(id: number): Promise<void> {
    await db.delete(rateCards).where(eq(rateCards.id, id));
  }

  async getRateCardItems(rateCardId: number): Promise<RateCardItem[]> {
    return await db.select().from(rateCardItems).where(eq(rateCardItems.rateCardId, rateCardId));
  }

  async createRateCardItem(item: InsertRateCardItem): Promise<RateCardItem> {
    const [created] = await db.insert(rateCardItems).values(item).returning();
    return created;
  }

  async deleteRateCardItem(id: number): Promise<void> {
    await db.delete(rateCardItems).where(eq(rateCardItems.id, id));
  }

  // Resource Plan Templates
  async getResourcePlanTemplates(tenantId: number): Promise<ResourcePlanTemplate[]> {
    return await db.select().from(resourcePlanTemplates).where(eq(resourcePlanTemplates.tenantId, tenantId)).orderBy(desc(resourcePlanTemplates.createdAt));
  }

  async getResourcePlanTemplate(id: number): Promise<ResourcePlanTemplate | undefined> {
    const [template] = await db.select().from(resourcePlanTemplates).where(eq(resourcePlanTemplates.id, id));
    return template;
  }

  async createResourcePlanTemplate(template: InsertResourcePlanTemplate): Promise<ResourcePlanTemplate> {
    const [created] = await db.insert(resourcePlanTemplates).values(template).returning();
    return created;
  }

  async updateResourcePlanTemplate(id: number, updates: Partial<InsertResourcePlanTemplate>): Promise<ResourcePlanTemplate | undefined> {
    const [updated] = await db.update(resourcePlanTemplates).set({ ...updates, updatedAt: new Date() }).where(eq(resourcePlanTemplates.id, id)).returning();
    return updated;
  }

  async deleteResourcePlanTemplate(id: number): Promise<void> {
    await db.delete(resourcePlanTemplates).where(eq(resourcePlanTemplates.id, id));
  }

  async getResourcePlanTemplateRows(templateId: number): Promise<ResourcePlanTemplateRow[]> {
    return await db.select().from(resourcePlanTemplateRows).where(eq(resourcePlanTemplateRows.templateId, templateId)).orderBy(resourcePlanTemplateRows.sortOrder);
  }

  async createResourcePlanTemplateRow(row: InsertResourcePlanTemplateRow): Promise<ResourcePlanTemplateRow> {
    const [created] = await db.insert(resourcePlanTemplateRows).values(row).returning();
    return created;
  }

  async deleteResourcePlanTemplateRow(id: number): Promise<void> {
    await db.delete(resourcePlanTemplateRows).where(eq(resourcePlanTemplateRows.id, id));
  }

  // Opportunity Resource Plans
  async getOpportunityResourcePlan(opportunityId: number): Promise<OpportunityResourcePlan | undefined> {
    const plans = await db.select().from(opportunityResourcePlans).where(eq(opportunityResourcePlans.opportunityId, opportunityId)).orderBy(desc(opportunityResourcePlans.createdAt));
    return plans[0];
  }

  async getOpportunityResourcePlans(opportunityId: number): Promise<OpportunityResourcePlan[]> {
    return await db.select().from(opportunityResourcePlans).where(eq(opportunityResourcePlans.opportunityId, opportunityId)).orderBy(desc(opportunityResourcePlans.createdAt));
  }

  async getOpportunityResourcePlanById(id: number): Promise<OpportunityResourcePlan | undefined> {
    const [plan] = await db.select().from(opportunityResourcePlans).where(eq(opportunityResourcePlans.id, id));
    return plan;
  }

  async createOpportunityResourcePlan(plan: InsertOpportunityResourcePlan): Promise<OpportunityResourcePlan> {
    const [created] = await db.insert(opportunityResourcePlans).values(plan).returning();
    return created;
  }

  async cloneOpportunityResourcePlan(planId: number, planName?: string): Promise<OpportunityResourcePlan | undefined> {
    const plan = await this.getOpportunityResourcePlanById(planId);
    if (!plan) return undefined;
    const rows = await this.getOpportunityResourceRows(planId);
    const newPlan = await this.createOpportunityResourcePlan({
      tenantId: plan.tenantId,
      opportunityId: plan.opportunityId,
      planName: planName || `${plan.planName || "Plan"} (Copy)`,
      templateName: plan.templateName,
      rateCardId: plan.rateCardId,
      currency: plan.currency,
      notes: plan.notes,
    });
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await this.createOpportunityResourceRow({
        planId: newPlan.id,
        phase: r.phase,
        roleName: r.roleName,
        resourceId: r.resourceId,
        namedResourceLabel: r.namedResourceLabel,
        startDate: r.startDate,
        endDate: r.endDate,
        daysPerWeek: r.daysPerWeek,
        dailyRate: r.dailyRate,
        discountPercent: r.discountPercent,
        status: r.status,
        sortOrder: i,
        breaks: r.breaks,
        weekOverrides: r.weekOverrides,
      });
    }
    return newPlan;
  }

  async updateOpportunityResourcePlan(id: number, updates: Partial<InsertOpportunityResourcePlan>): Promise<OpportunityResourcePlan | undefined> {
    const [updated] = await db.update(opportunityResourcePlans).set({ ...updates, updatedAt: new Date() }).where(eq(opportunityResourcePlans.id, id)).returning();
    return updated;
  }

  // Opportunity Resource Rows
  async getOpportunityResourceRows(planId: number): Promise<OpportunityResourceRow[]> {
    return await db.select().from(opportunityResourceRows).where(eq(opportunityResourceRows.planId, planId)).orderBy(opportunityResourceRows.sortOrder);
  }

  async getAllOpportunityResourceRowsWithPlans(tenantId: number): Promise<Array<OpportunityResourceRow & { planId: number; opportunityId: number; opportunityName?: string }>> {
    const plans = await db.select().from(opportunityResourcePlans).where(eq(opportunityResourcePlans.tenantId, tenantId));
    if (plans.length === 0) return [];
    const opps = await db.select({ id: crmOpportunities.id, name: crmOpportunities.name }).from(crmOpportunities).where(eq(crmOpportunities.tenantId, tenantId));
    const oppMap = new Map(opps.map(o => [o.id, o.name]));
    const allRows: Array<OpportunityResourceRow & { planId: number; opportunityId: number; opportunityName?: string }> = [];
    for (const plan of plans) {
      const rows = await db.select().from(opportunityResourceRows).where(eq(opportunityResourceRows.planId, plan.id)).orderBy(opportunityResourceRows.sortOrder);
      for (const row of rows) {
        allRows.push({
          ...row,
          planId: plan.id,
          opportunityId: plan.opportunityId,
          opportunityName: oppMap.get(plan.opportunityId) || undefined,
        });
      }
    }
    return allRows;
  }

  async createOpportunityResourceRow(row: InsertOpportunityResourceRow): Promise<OpportunityResourceRow> {
    const [created] = await db.insert(opportunityResourceRows).values(row).returning();
    return created;
  }

  async updateOpportunityResourceRow(id: number, updates: Partial<InsertOpportunityResourceRow>): Promise<OpportunityResourceRow | undefined> {
    const [updated] = await db.update(opportunityResourceRows).set(updates).where(eq(opportunityResourceRows.id, id)).returning();
    return updated;
  }

  async deleteOpportunityResourceRow(id: number): Promise<void> {
    await db.delete(opportunityResourceRows).where(eq(opportunityResourceRows.id, id));
  }

  // CRM Leads
  async getCrmLeads(tenantId: number, clientId?: number): Promise<CrmLead[]> {
    if (clientId !== undefined) {
      const clientAccounts = await db
        .select({ id: crmAccounts.id })
        .from(crmAccounts)
        .where(and(eq(crmAccounts.tenantId, tenantId), eq(crmAccounts.clientId, clientId)));
      const accountIds = clientAccounts.map((a) => a.id);
      const conditions = [eq(crmLeads.tenantId, tenantId)];
      if (accountIds.length > 0) {
        conditions.push(
          or(
            isNull(crmLeads.convertedAccountId),
            inArray(crmLeads.convertedAccountId, accountIds),
          )!,
        );
      } else {
        conditions.push(isNull(crmLeads.convertedAccountId));
      }
      return await db
        .select()
        .from(crmLeads)
        .where(and(...conditions))
        .orderBy(desc(crmLeads.createdAt));
    }
    return await db.select().from(crmLeads).where(eq(crmLeads.tenantId, tenantId)).orderBy(desc(crmLeads.createdAt));
  }

  async getCrmLead(id: number): Promise<CrmLead | undefined> {
    const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, id));
    return lead;
  }

  async createCrmLead(lead: InsertCrmLead): Promise<CrmLead> {
    const [result] = await db.insert(crmLeads).values(lead).returning();
    return result;
  }

  async updateCrmLead(id: number, updates: Partial<InsertCrmLead>): Promise<CrmLead | undefined> {
    const [result] = await db.update(crmLeads).set({ ...updates, updatedAt: new Date() }).where(eq(crmLeads.id, id)).returning();
    return result;
  }

  async deleteCrmLead(id: number): Promise<void> {
    await db.delete(crmLeads).where(eq(crmLeads.id, id));
  }

  async convertLead(id: number, accountId: number, contactId: number, opportunityId?: number): Promise<CrmLead | undefined> {
    const [result] = await db.update(crmLeads).set({
      convertedAccountId: accountId,
      convertedContactId: contactId,
      convertedOpportunityId: opportunityId,
      convertedAt: new Date(),
      status: 'converted',
      updatedAt: new Date()
    }).where(eq(crmLeads.id, id)).returning();
    return result;
  }

  // CRM Pipelines
  async getCrmPipelines(tenantId: number): Promise<CrmPipeline[]> {
    return await db.select().from(crmPipelines).where(eq(crmPipelines.tenantId, tenantId)).orderBy(crmPipelines.createdAt);
  }

  async getCrmPipeline(id: number): Promise<CrmPipeline | undefined> {
    const [pipeline] = await db.select().from(crmPipelines).where(eq(crmPipelines.id, id));
    return pipeline;
  }

  async createCrmPipeline(pipeline: InsertCrmPipeline): Promise<CrmPipeline> {
    const [result] = await db.insert(crmPipelines).values(pipeline).returning();
    return result;
  }

  async updateCrmPipeline(id: number, updates: Partial<InsertCrmPipeline>): Promise<CrmPipeline | undefined> {
    const [result] = await db.update(crmPipelines).set({ ...updates, updatedAt: new Date() }).where(eq(crmPipelines.id, id)).returning();
    return result;
  }

  async deleteCrmPipeline(id: number): Promise<void> {
    await db.delete(crmPipelines).where(eq(crmPipelines.id, id));
  }

  // CRM Opportunity Stages
  async getCrmOpportunityStages(tenantId: number, pipelineId?: number): Promise<CrmOpportunityStage[]> {
    let conditions = [eq(crmOpportunityStages.tenantId, tenantId)];
    if (pipelineId) conditions.push(eq(crmOpportunityStages.pipelineId, pipelineId));
    return await db.select().from(crmOpportunityStages).where(and(...conditions)).orderBy(crmOpportunityStages.order);
  }

  async createCrmOpportunityStage(stage: InsertCrmOpportunityStage): Promise<CrmOpportunityStage> {
    const [result] = await db.insert(crmOpportunityStages).values(stage).returning();
    return result;
  }

  async updateCrmOpportunityStage(id: number, updates: Partial<InsertCrmOpportunityStage>): Promise<CrmOpportunityStage | undefined> {
    const [result] = await db.update(crmOpportunityStages).set(updates).where(eq(crmOpportunityStages.id, id)).returning();
    return result;
  }

  async deleteCrmOpportunityStage(id: number): Promise<void> {
    await db.delete(crmOpportunityStages).where(eq(crmOpportunityStages.id, id));
  }

  // CRM Opportunities
  async getCrmOpportunities(tenantId: number, stageId?: number, accountId?: number, clientId?: number): Promise<CrmOpportunity[]> {
    const conditions = [eq(crmOpportunities.tenantId, tenantId)];
    if (stageId) conditions.push(eq(crmOpportunities.stageId, stageId));
    if (accountId) conditions.push(eq(crmOpportunities.accountId, accountId));
    if (clientId !== undefined) {
      return await db
        .select({ opportunity: crmOpportunities })
        .from(crmOpportunities)
        .innerJoin(crmAccounts, eq(crmOpportunities.accountId, crmAccounts.id))
        .where(and(...conditions, eq(crmAccounts.clientId, clientId)))
        .orderBy(desc(crmOpportunities.createdAt))
        .then((rows) => rows.map((r) => r.opportunity));
    }
    return await db.select().from(crmOpportunities).where(and(...conditions)).orderBy(desc(crmOpportunities.createdAt));
  }

  async getCrmOpportunity(id: number): Promise<CrmOpportunity | undefined> {
    const [opportunity] = await db.select().from(crmOpportunities).where(eq(crmOpportunities.id, id));
    return opportunity;
  }

  async createCrmOpportunity(opportunity: InsertCrmOpportunity): Promise<CrmOpportunity> {
    const [result] = await db.insert(crmOpportunities).values(opportunity).returning();
    return result;
  }

  async updateCrmOpportunity(id: number, updates: Partial<InsertCrmOpportunity>): Promise<CrmOpportunity | undefined> {
    const [result] = await db.update(crmOpportunities).set({ ...updates, updatedAt: new Date() }).where(eq(crmOpportunities.id, id)).returning();
    return result;
  }

  async cloneCrmOpportunity(id: number): Promise<CrmOpportunity | undefined> {
    const source = await this.getCrmOpportunity(id);
    if (!source) return undefined;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
    const [cloned] = await db.insert(crmOpportunities).values({
      ...rest,
      name: `${source.name} (Copy)`,
      isArchived: false,
    }).returning();
    return cloned;
  }

  async deleteCrmOpportunity(id: number): Promise<void> {
    await db.delete(crmOpportunities).where(eq(crmOpportunities.id, id));
  }

  // CRM Activities
  async getCrmActivities(tenantId: number, entityType?: string, entityId?: number, accountId?: number, clientId?: number): Promise<CrmActivity[]> {
    const conditions = [eq(crmActivities.tenantId, tenantId)];
    if (entityType === "account" && entityId) conditions.push(eq(crmActivities.accountId, entityId));
    else if (entityType === "contact" && entityId) conditions.push(eq(crmActivities.contactId, entityId));
    else if (entityType === "opportunity" && entityId) conditions.push(eq(crmActivities.opportunityId, entityId));
    else if (entityType === "lead" && entityId) conditions.push(eq(crmActivities.leadId, entityId));
    else if (accountId) conditions.push(eq(crmActivities.accountId, accountId));

    if (clientId !== undefined) {
      return await db
        .select({ activity: crmActivities })
        .from(crmActivities)
        .innerJoin(crmAccounts, eq(crmActivities.accountId, crmAccounts.id))
        .where(and(...conditions, eq(crmAccounts.clientId, clientId)))
        .orderBy(desc(crmActivities.createdAt))
        .then((rows) => rows.map((r) => r.activity));
    }
    return await db.select().from(crmActivities).where(and(...conditions)).orderBy(desc(crmActivities.createdAt));
  }

  async getCrmActivityClientId(activityId: number): Promise<number | null | undefined> {
    const activity = await this.getCrmActivity(activityId);
    if (!activity?.accountId) return null;
    const account = await this.getCrmAccount(activity.accountId);
    return account?.clientId;
  }

  async getCrmActivity(id: number): Promise<CrmActivity | undefined> {
    const [activity] = await db.select().from(crmActivities).where(eq(crmActivities.id, id));
    return activity;
  }

  async createCrmActivity(activity: InsertCrmActivity): Promise<CrmActivity> {
    const [result] = await db.insert(crmActivities).values(activity).returning();
    return result;
  }

  async updateCrmActivity(id: number, updates: Partial<InsertCrmActivity>): Promise<CrmActivity | undefined> {
    const [result] = await db.update(crmActivities).set({ ...updates, updatedAt: new Date() }).where(eq(crmActivities.id, id)).returning();
    return result;
  }

  async deleteCrmActivity(id: number): Promise<void> {
    await db.delete(crmActivities).where(eq(crmActivities.id, id));
  }

  // CRM Tasks
  async getCrmTasks(tenantId: number, entityType?: string, entityId?: number, accountId?: number, clientId?: number): Promise<CrmTask[]> {
    const conditions = [eq(crmTasks.tenantId, tenantId)];
    if (entityType === "account" && entityId) conditions.push(eq(crmTasks.accountId, entityId));
    else if (entityType === "contact" && entityId) conditions.push(eq(crmTasks.contactId, entityId));
    else if (entityType === "opportunity" && entityId) conditions.push(eq(crmTasks.opportunityId, entityId));
    else if (entityType === "lead" && entityId) conditions.push(eq(crmTasks.leadId, entityId));
    else if (accountId) conditions.push(eq(crmTasks.accountId, accountId));

    if (clientId !== undefined) {
      return await db
        .select({ task: crmTasks })
        .from(crmTasks)
        .innerJoin(crmAccounts, eq(crmTasks.accountId, crmAccounts.id))
        .where(and(...conditions, eq(crmAccounts.clientId, clientId)))
        .orderBy(crmTasks.dueDate)
        .then((rows) => rows.map((r) => r.task));
    }
    return await db.select().from(crmTasks).where(and(...conditions)).orderBy(crmTasks.dueDate);
  }

  async getCrmAccountTickets(tenantId: number, accountId: number, clientId?: number): Promise<{
    id: number;
    subject: string;
    status: string | null;
    priority: string | null;
    createdAt: Date;
    dueDate: Date | null;
    source: "task" | "activity";
  }[]> {
    const [tasks, activities] = await Promise.all([
      this.getCrmTasks(tenantId, undefined, undefined, accountId, clientId),
      this.getCrmActivities(tenantId, "account", accountId, accountId, clientId),
    ]);
    const ticketActivities = activities.filter((a) => a.type === "ticket");
    const supportTasks = tasks.filter(
      (t) =>
        t.status !== "completed" &&
        (t.priority === "high" || t.priority === "urgent" || /ticket|support/i.test(t.subject)),
    );
    const merged = [
      ...supportTasks.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        dueDate: t.dueDate,
        source: "task" as const,
      })),
      ...ticketActivities.map((a) => ({
        id: a.id,
        subject: a.subject,
        status: a.status,
        priority: a.priority,
        createdAt: a.createdAt,
        dueDate: a.dueDate,
        source: "activity" as const,
      })),
    ];
    return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCrmTaskClientId(taskId: number): Promise<number | null | undefined> {
    const task = await this.getCrmTask(taskId);
    if (!task?.accountId) return null;
    const account = await this.getCrmAccount(task.accountId);
    return account?.clientId;
  }

  async getCrmTask(id: number): Promise<CrmTask | undefined> {
    const [task] = await db.select().from(crmTasks).where(eq(crmTasks.id, id));
    return task;
  }

  async createCrmTask(task: InsertCrmTask): Promise<CrmTask> {
    const [result] = await db.insert(crmTasks).values(task).returning();
    return result;
  }

  async updateCrmTask(id: number, updates: Partial<InsertCrmTask>): Promise<CrmTask | undefined> {
    const [result] = await db.update(crmTasks).set({ ...updates, updatedAt: new Date() }).where(eq(crmTasks.id, id)).returning();
    return result;
  }

  async deleteCrmTask(id: number): Promise<void> {
    await db.delete(crmTasks).where(eq(crmTasks.id, id));
  }

  // CRM Notes
  async getCrmNotes(tenantId: number, entityType: string, entityId: number, clientId?: number): Promise<CrmNote[]> {
    if (clientId === undefined) {
      return await db
        .select()
        .from(crmNotes)
        .where(
          and(
            eq(crmNotes.tenantId, tenantId),
            eq(crmNotes.entityType, entityType),
            eq(crmNotes.entityId, entityId),
          ),
        )
        .orderBy(desc(crmNotes.createdAt));
    }
    if (entityType === "account") {
      const account = await this.getCrmAccount(entityId);
      if (account?.clientId !== clientId) return [];
    } else if (entityType === "contact") {
      const contact = await this.getCrmContact(entityId);
      if (contact?.accountId) {
        const account = await this.getCrmAccount(contact.accountId);
        if (account?.clientId !== clientId) return [];
      } else return [];
    } else if (entityType === "opportunity") {
      const opp = await this.getCrmOpportunity(entityId);
      if (opp?.accountId) {
        const account = await this.getCrmAccount(opp.accountId);
        if (account?.clientId !== clientId) return [];
      } else return [];
    }
    return await db
      .select()
      .from(crmNotes)
      .where(
        and(
          eq(crmNotes.tenantId, tenantId),
          eq(crmNotes.entityType, entityType),
          eq(crmNotes.entityId, entityId),
        ),
      )
      .orderBy(desc(crmNotes.createdAt));
  }

  async createCrmNote(note: InsertCrmNote): Promise<CrmNote> {
    const [result] = await db.insert(crmNotes).values(note).returning();
    return result;
  }

  async updateCrmNote(id: number, content: string): Promise<CrmNote | undefined> {
    const [result] = await db.update(crmNotes).set({ content, updatedAt: new Date() }).where(eq(crmNotes.id, id)).returning();
    return result;
  }

  async deleteCrmNote(id: number): Promise<void> {
    await db.delete(crmNotes).where(eq(crmNotes.id, id));
  }

  // CRM Contracts
  async getCrmContracts(tenantId: number, accountId?: number, clientId?: number): Promise<CrmContract[]> {
    if (clientId !== undefined) {
      const conditions = [eq(crmContracts.tenantId, tenantId), eq(crmAccounts.clientId, clientId)];
      if (accountId) conditions.push(eq(crmContracts.accountId, accountId));
      return await db
        .select({ contract: crmContracts })
        .from(crmContracts)
        .innerJoin(crmAccounts, eq(crmContracts.accountId, crmAccounts.id))
        .where(and(...conditions))
        .orderBy(desc(crmContracts.createdAt))
        .then((rows) => rows.map((r) => r.contract));
    }
    if (accountId) {
      return await db.select().from(crmContracts).where(and(eq(crmContracts.tenantId, tenantId), eq(crmContracts.accountId, accountId))).orderBy(desc(crmContracts.createdAt));
    }
    return await db.select().from(crmContracts).where(eq(crmContracts.tenantId, tenantId)).orderBy(desc(crmContracts.createdAt));
  }

  async getCrmContract(id: number): Promise<CrmContract | undefined> {
    const [contract] = await db.select().from(crmContracts).where(eq(crmContracts.id, id));
    return contract;
  }

  async createCrmContract(contract: InsertCrmContract): Promise<CrmContract> {
    const [result] = await db.insert(crmContracts).values(contract).returning();
    return result;
  }

  async updateCrmContract(id: number, updates: Partial<InsertCrmContract>): Promise<CrmContract | undefined> {
    const [result] = await db.update(crmContracts).set({ ...updates, updatedAt: new Date() }).where(eq(crmContracts.id, id)).returning();
    return result;
  }

  async deleteCrmContract(id: number): Promise<void> {
    await db.delete(crmContracts).where(eq(crmContracts.id, id));
  }

  async bulkImportCrmLeads(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(crmLeads).where(eq(crmLeads.tenantId, tenantId));
    let imported = 0;
    for (const row of rows) {
      const firstName = (row.firstName || row["First Name"] || "").trim();
      const lastName = (row.lastName || row["Last Name"] || "").trim();
      if (!firstName && !lastName) continue;
      await db.insert(crmLeads).values({
        tenantId,
        firstName: firstName || "Unknown",
        lastName: lastName || "Unknown",
        email: row.email || row["Email"] || null,
        phone: row.phone || row["Phone"] || null,
        company: row.company || row["Company"] || null,
        title: row.title || row["Title"] || null,
        source: row.source || row["Source"] || null,
        status: row.status || row["Status"] || "new",
        rating: row.rating || row["Rating"] || null,
        industry: row.industry || row["Industry"] || null,
        website: row.website || row["Website"] || null,
        description: row.description || row["Description"] || null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportCrmContacts(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(crmContacts).where(eq(crmContacts.tenantId, tenantId));
    const accounts = await db.select({ id: crmAccounts.id, name: crmAccounts.name }).from(crmAccounts).where(eq(crmAccounts.tenantId, tenantId));
    let imported = 0;
    for (const row of rows) {
      const firstName = (row.firstName || row["First Name"] || "").trim();
      const lastName = (row.lastName || row["Last Name"] || "").trim();
      if (!firstName && !lastName) continue;
      const accountName = row.accountName || row["Account Name"] || row["Company"] || null;
      const account = accountName ? accounts.find(a => a.name.toLowerCase() === accountName.toLowerCase()) : null;
      await db.insert(crmContacts).values({
        tenantId,
        firstName: firstName || "Unknown",
        lastName: lastName || "Unknown",
        accountId: account?.id ?? null,
        email: row.email || row["Email"] || null,
        phone: row.phone || row["Phone"] || null,
        mobile: row.mobile || row["Mobile"] || null,
        title: row.title || row["Title"] || null,
        department: row.department || row["Department"] || null,
        role: row.role || row["Role"] || "contact",
        notes: row.notes || row["Notes"] || null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportCrmAccounts(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(crmAccounts).where(eq(crmAccounts.tenantId, tenantId));
    let imported = 0;
    for (const row of rows) {
      const name = (row.name || row["Name"] || row["Company"] || "").trim();
      if (!name) continue;
      await db.insert(crmAccounts).values({
        tenantId,
        name,
        type: row.type || row["Type"] || "prospect",
        industry: row.industry || row["Industry"] || null,
        website: row.website || row["Website"] || null,
        phone: row.phone || row["Phone"] || null,
        email: row.email || row["Email"] || null,
        address: row.address || row["Address"] || null,
        city: row.city || row["City"] || null,
        state: row.state || row["State"] || null,
        country: row.country || row["Country"] || null,
        postalCode: row.postalCode || row["Postal Code"] || null,
        annualRevenue: row.annualRevenue || row["Annual Revenue"] ? String(row.annualRevenue || row["Annual Revenue"]) : null,
        employeeCount: row.employeeCount || row["Employee Count"] ? Number(row.employeeCount || row["Employee Count"]) || null : null,
        description: row.description || row["Description"] || null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportCrmOpportunities(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(crmOpportunities).where(eq(crmOpportunities.tenantId, tenantId));
    const accounts = await db.select({ id: crmAccounts.id, name: crmAccounts.name }).from(crmAccounts).where(eq(crmAccounts.tenantId, tenantId));
    const stages = await db.select({ id: crmOpportunityStages.id, name: crmOpportunityStages.name }).from(crmOpportunityStages).where(eq(crmOpportunityStages.tenantId, tenantId));
    let imported = 0;
    for (const row of rows) {
      const name = (row.name || row["Name"] || row["Opportunity Name"] || "").trim();
      if (!name) continue;
      const accountName = row.accountName || row["Account Name"] || null;
      const stageName = row.stageName || row["Stage"] || row["Stage Name"] || null;
      const account = accountName ? accounts.find(a => a.name.toLowerCase() === accountName.toLowerCase()) : null;
      const stage = stageName ? stages.find(s => s.name.toLowerCase() === stageName.toLowerCase()) : null;
      const closeDate = row.expectedCloseDate || row["Expected Close Date"] || null;
      await db.insert(crmOpportunities).values({
        tenantId,
        name,
        accountId: account?.id ?? null,
        stageId: stage?.id ?? null,
        description: row.description || row["Description"] || null,
        amount: row.amount || row["Amount"] ? String(row.amount || row["Amount"]) : null,
        probability: row.probability || row["Probability"] ? Number(row.probability || row["Probability"]) || 0 : 0,
        expectedCloseDate: closeDate ? new Date(closeDate) : null,
        type: row.type || row["Type"] || null,
        source: row.source || row["Source"] || null,
        nextStep: row.nextStep || row["Next Step"] || null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportCrmContracts(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(crmContracts).where(eq(crmContracts.tenantId, tenantId));
    const accounts = await db.select({ id: crmAccounts.id, name: crmAccounts.name }).from(crmAccounts).where(eq(crmAccounts.tenantId, tenantId));
    let imported = 0;
    for (const row of rows) {
      const name = (row.name || row["Name"] || row["Contract Name"] || "").trim();
      if (!name) continue;
      const accountName = row.accountName || row["Account Name"] || null;
      const account = accountName ? accounts.find(a => a.name.toLowerCase() === accountName.toLowerCase()) : null;
      await db.insert(crmContracts).values({
        tenantId,
        name,
        accountId: account?.id ?? null,
        type: row.type || row["Type"] || null,
        status: row.status || row["Status"] || "draft",
        startDate: row.startDate || row["Start Date"] ? new Date(row.startDate || row["Start Date"]) : null,
        endDate: row.endDate || row["End Date"] ? new Date(row.endDate || row["End Date"]) : null,
        value: row.value || row["Value"] ? String(row.value || row["Value"]) : null,
        recurringValue: row.recurringValue || row["Recurring Value"] ? String(row.recurringValue || row["Recurring Value"]) : null,
        terms: row.terms || row["Terms"] || null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportTasks(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(tasks).where(eq(tasks.tenantId, tenantId));
    let imported = 0;
    for (const row of rows) {
      const title = (row.title || row["Title"] || "").trim();
      if (!title) continue;
      const tagsRaw = row.tags || row["Tags"] || "";
      await db.insert(tasks).values({
        tenantId,
        title,
        description: row.description || row["Description"] || null,
        status: row.status || row["Status"] || "todo",
        priority: row.priority || row["Priority"] || "medium",
        source: row.source || row["Source"] || "personal",
        dueDate: row.dueDate || row["Due Date"] || null,
        startDate: row.startDate || row["Start Date"] || null,
        estimatedHours: (row.estimatedHours || row["Estimated Hours"]) ? Number(row.estimatedHours || row["Estimated Hours"]) || null : null,
        tags: tagsRaw ? tagsRaw.split(";").map((t: string) => t.trim()).filter(Boolean) : null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportStrategyItems(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(strategyItems).where(eq(strategyItems.tenantId, tenantId));
    let imported = 0;
    for (const row of rows) {
      const title = (row.title || row["Title"] || "").trim();
      if (!title) continue;
      await db.insert(strategyItems).values({
        tenantId,
        templateType: row.templateType || row["Template Type"] || "vision",
        title,
        description: row.description || row["Description"] || null,
        ownerName: row.ownerName || row["Owner Name"] || null,
        status: row.status || row["Status"] || "not_started",
        ragStatus: row.ragStatus || row["RAG Status"] || "green",
        progress: (row.progress || row["Progress"]) ? Number(row.progress || row["Progress"]) || 0 : 0,
        timeframe: row.timeframe || row["Timeframe"] || null,
        fiscalYear: (row.fiscalYear || row["Fiscal Year"]) ? Number(row.fiscalYear || row["Fiscal Year"]) || null : null,
        targetDate: row.targetDate || row["Target Date"] || null,
        notes: row.notes || row["Notes"] || null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportBusinessLayers(
    tenantId: number,
    userId: string,
    rows: Record<string, unknown>[],
  ): Promise<{ created: Record<string, number>; skipped: number }> {
    const get = (row: Record<string, unknown>, ...keys: string[]): string => {
      for (const key of keys) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
      }
      return "";
    };
    const parseRag = (raw: string): string => {
      const s = raw.toLowerCase();
      if (["green", "amber", "red"].includes(s)) return s;
      if (s.includes("risk") || s.includes("amber")) return "amber";
      if (s.includes("behind") || s.includes("off track") || s.includes("red")) return "red";
      if (s.includes("track") || s.includes("green")) return "green";
      return "green";
    };
    const parseProgress = (row: Record<string, unknown>): number => {
      const raw = get(row, "Progress %", "Progress", "progress").replace(/%/g, "");
      const n = Number(raw);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
    };
    const isDataRow = (row: Record<string, unknown>): boolean => {
      const title = get(row, "Title", "Name", "title", "name");
      if (!title) return false;
      const upper = title.toUpperCase();
      if (upper === "TITLE" || upper === "NAME" || upper === "CODE") return false;
      return true;
    };
    const normalizeSheet = (raw: string): string | null => {
      const s = raw.trim().toLowerCase();
      if (!s || s === "instructions") return null;
      if (s === "strategy" || s === "strategies") return "strategies";
      if (s === "goal" || s === "goals") return "goals";
      if (s === "objective" || s === "objectives") return "objectives";
      if (s === "initiative" || s === "initiatives") return "initiatives";
      if (s === "okr" || s === "okrs") return "okrs";
      if (s === "kpi" || s === "kpis") return "kpis";
      if (s === "governance") return "governance";
      return null;
    };

    const prefixByType: Record<string, string> = {
      strategy: "S", goal: "G", objective: "O", initiative: "I", okr: "K", kpi: "P", governance: "GV",
    };
    const refs = await this.getEntityRefs(tenantId);
    const codeToId: Record<string, number> = {};
    for (const ref of refs) {
      const prefix = prefixByType[ref.entityType];
      if (prefix) codeToId[`${prefix}${String(ref.refSeq).padStart(2, "0")}`] = ref.entityId;
    }

    const grouped = new Map<string, Record<string, unknown>[]>();
    let skipped = 0;
    for (const row of rows) {
      const sheet = normalizeSheet(String(row._sheet ?? ""));
      if (!sheet) { skipped++; continue; }
      if (!grouped.has(sheet)) grouped.set(sheet, []);
      grouped.get(sheet)!.push(row);
    }

    const resolveCode = (code: string): number | null => {
      const key = code.trim().toUpperCase();
      return key ? (codeToId[key] ?? null) : null;
    };

    const created: Record<string, number> = {};
    const sheetOrder = ["strategies", "goals", "objectives", "initiatives", "okrs", "kpis", "governance"];

    for (const sheet of sheetOrder) {
      for (const row of grouped.get(sheet) ?? []) {
        if (!isDataRow(row)) { skipped++; continue; }
        const code = get(row, "Code").toUpperCase();

        if (sheet === "strategies") {
          const item = await this.createStrategyItem({
            tenantId,
            ownerId: userId,
            title: get(row, "Title", "title"),
            description: get(row, "Description", "description") || null,
            templateType: get(row, "Type", "type", "Template Type") || "strategy",
            ownerName: get(row, "Owner Name", "ownerName") || null,
            ragStatus: parseRag(get(row, "RAG Status", "ragStatus")),
            progress: parseProgress(row),
            targetDate: get(row, "Target Date", "targetDate") || null,
          });
          await this.assignEntityRef(tenantId, "strategy", item.id);
          if (code) codeToId[code] = item.id;
          created.strategy = (created.strategy ?? 0) + 1;
        } else if (sheet === "goals") {
          const strategyItemId = resolveCode(get(row, "Strategy Code", "strategyCode"));
          const item = await this.createGoal({
            tenantId,
            ownerId: userId,
            strategyItemId: strategyItemId ?? undefined,
            title: get(row, "Title", "title"),
            description: get(row, "Description", "description") || null,
            ownerName: get(row, "Owner Name", "ownerName") || null,
            ragStatus: parseRag(get(row, "RAG Status", "ragStatus")),
            progress: parseProgress(row),
            targetDate: get(row, "Target Date", "targetDate") || null,
          });
          await this.assignEntityRef(tenantId, "goal", item.id);
          if (code) codeToId[code] = item.id;
          created.goals = (created.goals ?? 0) + 1;
        } else if (sheet === "objectives") {
          const goalId = resolveCode(get(row, "Goal Code", "goalCode"));
          const item = await this.createObjective({
            tenantId,
            ownerId: userId,
            goalId: goalId ?? undefined,
            title: get(row, "Title", "title"),
            description: get(row, "Description", "description") || null,
            ownerName: get(row, "Owner Name", "ownerName") || null,
            ragStatus: parseRag(get(row, "RAG Status", "ragStatus")),
            progress: parseProgress(row),
            targetDate: get(row, "Target Date", "targetDate") || null,
          });
          await this.assignEntityRef(tenantId, "objective", item.id);
          if (code) codeToId[code] = item.id;
          created.objectives = (created.objectives ?? 0) + 1;
        } else if (sheet === "initiatives") {
          const objectiveId = resolveCode(get(row, "Objective Code", "objectiveCode"));
          let goalId: number | undefined;
          if (objectiveId) {
            const objective = await this.getObjective(objectiveId);
            goalId = objective?.goalId ?? undefined;
          }
          const item = await this.createInitiative({
            tenantId,
            ownerId: userId,
            objectiveId: objectiveId ?? undefined,
            goalId,
            title: get(row, "Title", "title"),
            description: get(row, "Description", "description") || null,
            ownerName: get(row, "Owner Name", "ownerName") || null,
            priority: get(row, "Priority", "priority") || "medium",
            ragStatus: parseRag(get(row, "RAG Status", "ragStatus")),
            progress: parseProgress(row),
            startDate: get(row, "Start Date", "startDate") || undefined,
            dueDate: get(row, "End Date", "endDate", "Due Date", "dueDate") || undefined,
            targetDate: get(row, "Target Date", "targetDate") || null,
          });
          await this.assignEntityRef(tenantId, "initiative", item.id);
          if (code) codeToId[code] = item.id;
          created.initiatives = (created.initiatives ?? 0) + 1;
        } else if (sheet === "okrs") {
          const objectiveId = resolveCode(get(row, "Objective Code", "objectiveCode"));
          const item = await this.createOkr({
            tenantId,
            ownerId: userId,
            objectiveId: objectiveId ?? undefined,
            title: get(row, "Title", "title"),
            description: get(row, "Key Result Description", "Description", "description") || null,
            ownerName: get(row, "Owner Name", "ownerName") || null,
            ragStatus: parseRag(get(row, "RAG Status", "ragStatus")),
            targetDate: get(row, "Target Date", "targetDate") || null,
          });
          await this.assignEntityRef(tenantId, "okr", item.id);
          if (code) codeToId[code] = item.id;
          created.okrs = (created.okrs ?? 0) + 1;
        } else if (sheet === "kpis") {
          const goalId = resolveCode(get(row, "Goal Code", "goalCode"));
          const item = await this.createKpi({
            tenantId,
            ownerId: userId,
            goalId: goalId ?? undefined,
            name: get(row, "Name", "Title", "name", "title"),
            description: get(row, "Description", "description") || null,
            ownerName: get(row, "Owner Name", "ownerName") || null,
            indicatorType: get(row, "KPI Type", "indicatorType") || "lagging",
            currentValue: get(row, "Current Value", "currentValue") || null,
            targetValue: get(row, "Target Value", "targetValue") || null,
            unit: get(row, "Unit", "unit") || null,
            ragStatus: parseRag(get(row, "RAG Status", "ragStatus")),
            targetDate: get(row, "Target Date", "targetDate") || null,
          });
          await this.assignEntityRef(tenantId, "kpi", item.id);
          if (code) codeToId[code] = item.id;
          created.kpis = (created.kpis ?? 0) + 1;
        } else if (sheet === "governance") {
          const linkedStrategyItemId = resolveCode(get(row, "Strategy Code", "strategyCode"));
          const item = await this.createGovernanceItem({
            tenantId,
            ownerId: userId,
            linkedStrategyItemId: linkedStrategyItemId ?? undefined,
            title: get(row, "Title", "title"),
            govType: get(row, "Type", "govType", "type") || "board_decision",
            description: get(row, "Description", "description") || null,
            ownerName: get(row, "Owner Name", "ownerName") || null,
            departmentName: get(row, "Department", "departmentName") || null,
            ragStatus: parseRag(get(row, "RAG Status", "ragStatus")),
            status: get(row, "Status", "status") || "not_started",
            progress: parseProgress(row),
            targetDate: get(row, "Target Date", "targetDate") || null,
          });
          await this.assignEntityRef(tenantId, "governance", item.id);
          if (code) codeToId[code] = item.id;
          created.governance = (created.governance ?? 0) + 1;
        }
      }
    }

    return { created, skipped };
  }

  async bulkImportResources(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(resources).where(eq(resources.tenantId, tenantId));
    let imported = 0;
    for (const row of rows) {
      const firstName = (row.firstName || row["First Name"] || "").trim();
      const lastName = (row.lastName || row["Last Name"] || "").trim();
      if (!firstName && !lastName) continue;
      await db.insert(resources).values({
        tenantId,
        firstName: firstName || "Unknown",
        lastName,
        email: row.email || row["Email"] || null,
        phone: row.phone || row["Phone"] || null,
        jobTitle: row.jobTitle || row["Job Title"] || null,
        department: row.department || row["Department"] || null,
        location: row.location || row["Location"] || null,
        employmentType: row.employmentType || row["Employment Type"] || "full-time",
        status: row.status || row["Status"] || "available",
        costRate: (row.costRate || row["Cost Rate"]) ? String(row.costRate || row["Cost Rate"]) : null,
        billRate: (row.billRate || row["Bill Rate"]) ? String(row.billRate || row["Bill Rate"]) : null,
        weeklyCapacityHours: (row.weeklyCapacityHours || row["Weekly Capacity Hours"]) ? String(row.weeklyCapacityHours || row["Weekly Capacity Hours"]) : "40",
        notes: row.notes || row["Notes"] || null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportBpmlEntries(templateId: number, tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(bpmlEntries).where(and(eq(bpmlEntries.templateId, templateId), eq(bpmlEntries.tenantId, tenantId)));
    let imported = 0;
    for (const row of rows) {
      const processName = (row.processName || row["Process Name"] || "").trim();
      if (!processName) continue;
      await db.insert(bpmlEntries).values({
        templateId,
        tenantId,
        bpmlId: row.bpmlId || row["BPML ID"] || null,
        processCode: row.processCode || row["Process Code"] || null,
        processName,
        processDescription: row.processDescription || row["Description"] || null,
        level1: row.level1 || row["L1"] || null,
        level2: row.level2 || row["L2"] || null,
        level3: row.level3 || row["L3"] || null,
        level4: row.level4 || row["L4"] || null,
        level5: row.level5 || row["L5"] || null,
        processOwner: row.processOwner || row["Process Owner"] || null,
        businessOwner: row.businessOwner || row["Business Owner"] || null,
        itOwner: row.itOwner || row["IT Owner"] || null,
        department: row.department || row["Department"] || null,
        fitGapStatus: row.fitGapStatus || row["Fit/Gap"] || "not_assessed",
        priority: row.priority || row["Priority"] || null,
        complexity: row.complexity || row["Complexity"] || null,
        overallStatus: row.overallStatus || row["Overall Status"] || "not_started",
        erpPlatform: row.erpPlatform || row["ERP Platform"] || null,
        application: row.application || row["Application"] || null,
        countryScope: row.countryScope || row["Country Scope"] || null,
        legalEntity: row.legalEntity || row["Legal Entity"] || null,
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportFrameworks(tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(frameworks).where(and(eq(frameworks.tenantId, tenantId), eq(frameworks.isBuiltIn, false)));
    let imported = 0;
    for (const row of rows) {
      const name = (row.name || row["Name"] || "").trim();
      if (!name) continue;
      const tagsRaw = row.tags || row["Tags"] || "";
      await db.insert(frameworks).values({
        tenantId,
        name,
        description: row.description || row["Description"] || null,
        category: row.category || row["Category"] || "other",
        vendor: row.vendor || row["Vendor"] || null,
        version: row.version || row["Version"] || "1.0",
        status: row.status || row["Status"] || "draft",
        tags: tagsRaw ? tagsRaw.split(";").map((t: string) => t.trim()).filter(Boolean) : [],
      });
      imported++;
    }
    return { imported };
  }

  async bulkImportOrgChartMembers(chartId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(orgChartMembers).where(eq(orgChartMembers.chartId, chartId));
    let imported = 0;
    const nameToId = new Map<string, number>();
    for (const row of rows) {
      const name = (row.name || row["Name"] || "").trim();
      if (!name) continue;
      const [created] = await db.insert(orgChartMembers).values({
        chartId,
        name,
        title: row.title || row["Title"] || null,
        department: row.department || row["Department"] || null,
        email: row.email || row["Email"] || null,
        phone: row.phone || row["Phone"] || null,
        sortOrder: imported,
      }).returning();
      nameToId.set(name.toLowerCase(), created.id);
      imported++;
    }
    for (const row of rows) {
      const name = (row.name || row["Name"] || "").trim();
      const managerName = (row.managerName || row["Manager Name"] || row["Reports To"] || "").trim();
      if (!name || !managerName) continue;
      const memberId = nameToId.get(name.toLowerCase());
      const parentId = nameToId.get(managerName.toLowerCase());
      if (memberId && parentId) {
        await db.update(orgChartMembers).set({ parentMemberId: parentId }).where(eq(orgChartMembers.id, memberId));
      }
    }
    return { imported };
  }

  async bulkImportPmRaiddItems(projectId: number, tenantId: number, rows: Record<string, string>[], mode: "append" | "replace"): Promise<{ imported: number }> {
    if (mode === "replace") await db.delete(pmRaiddItems).where(and(eq(pmRaiddItems.projectId, projectId), eq(pmRaiddItems.tenantId, tenantId)));
    let imported = 0;
    for (const row of rows) {
      const title = (row.title || row["Title"] || "").trim();
      if (!title) continue;
      await db.insert(pmRaiddItems).values({
        tenantId,
        projectId,
        type: (row.type || row["Type"] || "risk").toLowerCase(),
        code: row.code || row["Code"] || null,
        title,
        description: row.description || row["Description"] || null,
        status: row.status || row["Status"] || "open",
        priority: row.priority || row["Priority"] || "medium",
        category: row.category || row["Category"] || null,
        ownerName: row.ownerName || row["Owner"] || null,
        impact: row.impact || row["Impact"] || null,
        likelihood: row.likelihood || row["Likelihood"] || null,
        mitigation: row.mitigation || row["Mitigation"] || null,
        dueDate: row.dueDate || row["Due Date"] || null,
      });
      imported++;
    }
    return { imported };
  }

  // CRM Customer Systems
  async getCrmCustomerSystems(tenantId: number, accountId?: number, clientId?: number): Promise<CrmCustomerSystem[]> {
    if (clientId !== undefined) {
      const conditions = [eq(crmCustomerSystems.tenantId, tenantId), eq(crmAccounts.clientId, clientId)];
      if (accountId) conditions.push(eq(crmCustomerSystems.accountId, accountId));
      return await db
        .select({ system: crmCustomerSystems })
        .from(crmCustomerSystems)
        .innerJoin(crmAccounts, eq(crmCustomerSystems.accountId, crmAccounts.id))
        .where(and(...conditions))
        .orderBy(crmCustomerSystems.name)
        .then((rows) => rows.map((r) => r.system));
    }
    if (accountId) {
      return await db.select().from(crmCustomerSystems).where(and(eq(crmCustomerSystems.tenantId, tenantId), eq(crmCustomerSystems.accountId, accountId))).orderBy(crmCustomerSystems.name);
    }
    return await db.select().from(crmCustomerSystems).where(eq(crmCustomerSystems.tenantId, tenantId)).orderBy(crmCustomerSystems.name);
  }

  async getCrmCustomerSystem(id: number): Promise<CrmCustomerSystem | undefined> {
    const [system] = await db.select().from(crmCustomerSystems).where(eq(crmCustomerSystems.id, id));
    return system;
  }

  async createCrmCustomerSystem(system: InsertCrmCustomerSystem): Promise<CrmCustomerSystem> {
    const [result] = await db.insert(crmCustomerSystems).values(system).returning();
    return result;
  }

  async updateCrmCustomerSystem(id: number, updates: Partial<InsertCrmCustomerSystem>): Promise<CrmCustomerSystem | undefined> {
    const [result] = await db.update(crmCustomerSystems).set({ ...updates, updatedAt: new Date() }).where(eq(crmCustomerSystems.id, id)).returning();
    return result;
  }

  async deleteCrmCustomerSystem(id: number): Promise<void> {
    await db.delete(crmCustomerSystems).where(eq(crmCustomerSystems.id, id));
  }

  // Business Management - Strategy Items
  async getStrategyItems(tenantId: number, templateType?: string, clientId?: number): Promise<StrategyItem[]> {
    const conditions = [eq(strategyItems.tenantId, tenantId)];
    if (templateType) conditions.push(eq(strategyItems.templateType, templateType));
    if (clientId !== undefined) conditions.push(eq(strategyItems.clientId, clientId));
    return await db.select().from(strategyItems).where(and(...conditions)).orderBy(strategyItems.order);
  }

  async getStrategyItem(id: number): Promise<StrategyItem | undefined> {
    const [item] = await db.select().from(strategyItems).where(eq(strategyItems.id, id));
    return item;
  }

  async createStrategyItem(item: InsertStrategyItem): Promise<StrategyItem> {
    const [result] = await db.insert(strategyItems).values(item).returning();
    return result;
  }

  async updateStrategyItem(id: number, updates: Partial<InsertStrategyItem>): Promise<StrategyItem | undefined> {
    const [result] = await db.update(strategyItems).set({ ...updates, updatedAt: new Date() }).where(eq(strategyItems.id, id)).returning();
    return result;
  }

  async deleteStrategyItem(id: number): Promise<void> {
    await db.delete(strategyItems).where(eq(strategyItems.id, id));
  }

  // Business Management - Risks
  async getRisks(tenantId: number, strategyItemId?: number, clientId?: number): Promise<Risk[]> {
    if (clientId !== undefined) {
      const conditions = [eq(risks.tenantId, tenantId), eq(strategyItems.clientId, clientId)];
      if (strategyItemId) conditions.push(eq(risks.strategyItemId, strategyItemId));
      return await db
        .select({ risk: risks })
        .from(risks)
        .innerJoin(strategyItems, eq(risks.strategyItemId, strategyItems.id))
        .where(and(...conditions))
        .orderBy(desc(risks.createdAt))
        .then((rows) => rows.map((r) => r.risk));
    }
    if (strategyItemId) {
      return await db.select().from(risks).where(and(eq(risks.tenantId, tenantId), eq(risks.strategyItemId, strategyItemId))).orderBy(desc(risks.createdAt));
    }
    return await db.select().from(risks).where(eq(risks.tenantId, tenantId)).orderBy(desc(risks.createdAt));
  }

  async getRisk(id: number): Promise<Risk | undefined> {
    const [risk] = await db.select().from(risks).where(eq(risks.id, id));
    return risk;
  }

  async createRisk(risk: InsertRisk): Promise<Risk> {
    const [result] = await db.insert(risks).values(risk).returning();
    return result;
  }

  async updateRisk(id: number, updates: Partial<InsertRisk>): Promise<Risk | undefined> {
    const [result] = await db.update(risks).set(updates).where(eq(risks.id, id)).returning();
    return result;
  }

  async deleteRisk(id: number): Promise<void> {
    await db.delete(risks).where(eq(risks.id, id));
  }

  // Business Management - Departments
  async getDepartments(tenantId: number): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.tenantId, tenantId)).orderBy(departments.name);
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [result] = await db.insert(departments).values(department).returning();
    return result;
  }

  async updateDepartment(id: number, updates: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [result] = await db.update(departments).set(updates).where(eq(departments.id, id)).returning();
    return result;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  // Business Management - Processes
  async getProcesses(tenantId: number, departmentId?: number): Promise<Process[]> {
    if (departmentId) {
      return await db.select().from(processes).where(and(eq(processes.tenantId, tenantId), eq(processes.departmentId, departmentId))).orderBy(processes.name);
    }
    return await db.select().from(processes).where(eq(processes.tenantId, tenantId)).orderBy(processes.name);
  }

  async getProcess(id: number): Promise<Process | undefined> {
    const [process] = await db.select().from(processes).where(eq(processes.id, id));
    return process;
  }

  async createProcess(process: InsertProcess): Promise<Process> {
    const [result] = await db.insert(processes).values(process).returning();
    return result;
  }

  async updateProcess(id: number, updates: Partial<InsertProcess>): Promise<Process | undefined> {
    const [result] = await db.update(processes).set(updates).where(eq(processes.id, id)).returning();
    return result;
  }

  async deleteProcess(id: number): Promise<void> {
    await db.delete(processes).where(eq(processes.id, id));
  }

  // Business Management - Tools
  async getTools(tenantId: number): Promise<Tool[]> {
    return await db.select().from(tools).where(eq(tools.tenantId, tenantId)).orderBy(tools.name);
  }

  async getTool(id: number): Promise<Tool | undefined> {
    const [tool] = await db.select().from(tools).where(eq(tools.id, id));
    return tool;
  }

  async createTool(tool: InsertTool): Promise<Tool> {
    const [result] = await db.insert(tools).values(tool).returning();
    return result;
  }

  async updateTool(id: number, updates: Partial<InsertTool>): Promise<Tool | undefined> {
    const [result] = await db.update(tools).set(updates).where(eq(tools.id, id)).returning();
    return result;
  }

  async deleteTool(id: number): Promise<void> {
    await db.delete(tools).where(eq(tools.id, id));
  }

  // Business Management - Goals
  async getGoals(tenantId: number, strategyItemId?: number, clientId?: number): Promise<Goal[]> {
    if (clientId !== undefined) {
      const conditions = [eq(goals.tenantId, tenantId), eq(strategyItems.clientId, clientId)];
      if (strategyItemId) conditions.push(eq(goals.strategyItemId, strategyItemId));
      return await db
        .select({ goal: goals })
        .from(goals)
        .innerJoin(strategyItems, eq(goals.strategyItemId, strategyItems.id))
        .where(and(...conditions))
        .orderBy(desc(goals.createdAt))
        .then((rows) => rows.map((r) => r.goal));
    }
    if (strategyItemId) {
      return await db.select().from(goals).where(and(eq(goals.tenantId, tenantId), eq(goals.strategyItemId, strategyItemId))).orderBy(desc(goals.createdAt));
    }
    return await db.select().from(goals).where(eq(goals.tenantId, tenantId)).orderBy(desc(goals.createdAt));
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal;
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [result] = await db.insert(goals).values(goal).returning();
    return result;
  }

  async updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal | undefined> {
    const [result] = await db.update(goals).set({ ...updates, updatedAt: new Date() }).where(eq(goals.id, id)).returning();
    return result;
  }

  async deleteGoal(id: number): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }

  // Business Management - Objectives
  async getObjectives(tenantId: number, goalId?: number, clientId?: number): Promise<Objective[]> {
    if (clientId !== undefined) {
      const conditions = [eq(objectives.tenantId, tenantId), eq(strategyItems.clientId, clientId)];
      if (goalId) conditions.push(eq(objectives.goalId, goalId));
      return await db
        .select({ objective: objectives })
        .from(objectives)
        .innerJoin(goals, eq(objectives.goalId, goals.id))
        .innerJoin(strategyItems, eq(goals.strategyItemId, strategyItems.id))
        .where(and(...conditions))
        .orderBy(desc(objectives.createdAt))
        .then((rows) => rows.map((r) => r.objective));
    }
    if (goalId) {
      return await db.select().from(objectives).where(and(eq(objectives.tenantId, tenantId), eq(objectives.goalId, goalId))).orderBy(desc(objectives.createdAt));
    }
    return await db.select().from(objectives).where(eq(objectives.tenantId, tenantId)).orderBy(desc(objectives.createdAt));
  }

  async getObjective(id: number): Promise<Objective | undefined> {
    const [objective] = await db.select().from(objectives).where(eq(objectives.id, id));
    return objective;
  }

  async createObjective(objective: InsertObjective): Promise<Objective> {
    const [result] = await db.insert(objectives).values(objective).returning();
    return result;
  }

  async updateObjective(id: number, updates: Partial<InsertObjective>): Promise<Objective | undefined> {
    const [result] = await db.update(objectives).set({ ...updates, updatedAt: new Date() }).where(eq(objectives.id, id)).returning();
    return result;
  }

  async deleteObjective(id: number): Promise<void> {
    await db.delete(objectives).where(eq(objectives.id, id));
  }

  // Business Management - OKRs
  async getOkrs(tenantId: number, initiativeId?: number, clientId?: number): Promise<Okr[]> {
    if (clientId !== undefined) {
      const conditions = [eq(okrs.tenantId, tenantId), eq(initiatives.clientId, clientId)];
      if (initiativeId) conditions.push(eq(okrs.initiativeId, initiativeId));
      return await db
        .select({ okr: okrs })
        .from(okrs)
        .innerJoin(initiatives, eq(okrs.initiativeId, initiatives.id))
        .where(and(...conditions))
        .orderBy(desc(okrs.createdAt))
        .then((rows) => rows.map((r) => r.okr));
    }
    if (initiativeId) {
      return await db.select().from(okrs).where(and(eq(okrs.tenantId, tenantId), eq(okrs.initiativeId, initiativeId))).orderBy(desc(okrs.createdAt));
    }
    return await db.select().from(okrs).where(eq(okrs.tenantId, tenantId)).orderBy(desc(okrs.createdAt));
  }

  async getOkr(id: number): Promise<Okr | undefined> {
    const [okr] = await db.select().from(okrs).where(eq(okrs.id, id));
    return okr;
  }

  async createOkr(okr: InsertOkr): Promise<Okr> {
    const [result] = await db.insert(okrs).values(okr).returning();
    return result;
  }

  async updateOkr(id: number, updates: Partial<InsertOkr>): Promise<Okr | undefined> {
    const [result] = await db.update(okrs).set({ ...updates, updatedAt: new Date() }).where(eq(okrs.id, id)).returning();
    return result;
  }

  async deleteOkr(id: number): Promise<void> {
    await db.delete(okrs).where(eq(okrs.id, id));
  }

  // Business Management - Key Results
  async getKeyResults(tenantId: number, goalId?: number): Promise<KeyResult[]> {
    if (goalId) {
      return await db.select().from(keyResults).where(and(eq(keyResults.tenantId, tenantId), eq(keyResults.goalId, goalId))).orderBy(desc(keyResults.createdAt));
    }
    return await db.select().from(keyResults).where(eq(keyResults.tenantId, tenantId)).orderBy(desc(keyResults.createdAt));
  }

  async getKeyResult(id: number): Promise<KeyResult | undefined> {
    const [kr] = await db.select().from(keyResults).where(eq(keyResults.id, id));
    return kr;
  }

  async createKeyResult(keyResult: InsertKeyResult): Promise<KeyResult> {
    const [result] = await db.insert(keyResults).values(keyResult).returning();
    return result;
  }

  async updateKeyResult(id: number, updates: Partial<InsertKeyResult>): Promise<KeyResult | undefined> {
    const [result] = await db.update(keyResults).set({ ...updates, updatedAt: new Date() }).where(eq(keyResults.id, id)).returning();
    return result;
  }

  async deleteKeyResult(id: number): Promise<void> {
    await db.delete(keyResults).where(eq(keyResults.id, id));
  }

  // Business Management - KPIs
  async getKpis(tenantId: number, goalId?: number, clientId?: number): Promise<Kpi[]> {
    if (clientId !== undefined) {
      const conditions = [eq(kpis.tenantId, tenantId), eq(strategyItems.clientId, clientId)];
      if (goalId) conditions.push(eq(kpis.goalId, goalId));
      return await db
        .select({ kpi: kpis })
        .from(kpis)
        .innerJoin(goals, eq(kpis.goalId, goals.id))
        .innerJoin(strategyItems, eq(goals.strategyItemId, strategyItems.id))
        .where(and(...conditions))
        .orderBy(desc(kpis.createdAt))
        .then((rows) => rows.map((r) => r.kpi));
    }
    if (goalId) {
      return await db.select().from(kpis).where(and(eq(kpis.tenantId, tenantId), eq(kpis.goalId, goalId))).orderBy(desc(kpis.createdAt));
    }
    return await db.select().from(kpis).where(eq(kpis.tenantId, tenantId)).orderBy(desc(kpis.createdAt));
  }

  async getKpi(id: number): Promise<Kpi | undefined> {
    const [kpi] = await db.select().from(kpis).where(eq(kpis.id, id));
    return kpi;
  }

  async createKpi(kpi: InsertKpi): Promise<Kpi> {
    const [result] = await db.insert(kpis).values(kpi).returning();
    return result;
  }

  async updateKpi(id: number, updates: Partial<InsertKpi>): Promise<Kpi | undefined> {
    const [result] = await db.update(kpis).set({ ...updates, updatedAt: new Date() }).where(eq(kpis.id, id)).returning();
    return result;
  }

  async deleteKpi(id: number): Promise<void> {
    await db.delete(kpis).where(eq(kpis.id, id));
  }

  // Business Management - Initiatives
  async getInitiatives(tenantId: number, goalId?: number, clientId?: number): Promise<Initiative[]> {
    const conditions = [eq(initiatives.tenantId, tenantId)];
    if (goalId) conditions.push(eq(initiatives.goalId, goalId));
    if (clientId !== undefined) conditions.push(eq(initiatives.clientId, clientId));
    return await db.select().from(initiatives).where(and(...conditions)).orderBy(desc(initiatives.createdAt));
  }

  async getInitiative(id: number): Promise<Initiative | undefined> {
    const [initiative] = await db.select().from(initiatives).where(eq(initiatives.id, id));
    return initiative;
  }

  async createInitiative(initiative: InsertInitiative): Promise<Initiative> {
    const [result] = await db.insert(initiatives).values(initiative).returning();
    return result;
  }

  async updateInitiative(id: number, updates: Partial<InsertInitiative>): Promise<Initiative | undefined> {
    const [result] = await db.update(initiatives).set({ ...updates, updatedAt: new Date() }).where(eq(initiatives.id, id)).returning();
    return result;
  }

  async deleteInitiative(id: number): Promise<void> {
    await db.delete(initiatives).where(eq(initiatives.id, id));
  }

  // Business Management - Tasks
  async getBusinessTasks(tenantId: number, initiativeId?: number, clientId?: number): Promise<BusinessTask[]> {
    if (clientId !== undefined) {
      const conditions = [eq(businessTasks.tenantId, tenantId), eq(initiatives.clientId, clientId)];
      if (initiativeId) conditions.push(eq(businessTasks.initiativeId, initiativeId));
      return await db
        .select({ task: businessTasks })
        .from(businessTasks)
        .innerJoin(initiatives, eq(businessTasks.initiativeId, initiatives.id))
        .where(and(...conditions))
        .orderBy(businessTasks.dueDate)
        .then((rows) => rows.map((r) => r.task));
    }
    if (initiativeId) {
      return await db.select().from(businessTasks).where(and(eq(businessTasks.tenantId, tenantId), eq(businessTasks.initiativeId, initiativeId))).orderBy(businessTasks.dueDate);
    }
    return await db.select().from(businessTasks).where(eq(businessTasks.tenantId, tenantId)).orderBy(businessTasks.dueDate);
  }

  async getBusinessTask(id: number): Promise<BusinessTask | undefined> {
    const [task] = await db.select().from(businessTasks).where(eq(businessTasks.id, id));
    return task;
  }

  async createBusinessTask(task: InsertBusinessTask): Promise<BusinessTask> {
    const [result] = await db.insert(businessTasks).values(task).returning();
    return result;
  }

  async updateBusinessTask(id: number, updates: Partial<InsertBusinessTask>): Promise<BusinessTask | undefined> {
    const [result] = await db.update(businessTasks).set({ ...updates, updatedAt: new Date() }).where(eq(businessTasks.id, id)).returning();
    return result;
  }

  async deleteBusinessTask(id: number): Promise<void> {
    await db.delete(businessTasks).where(eq(businessTasks.id, id));
  }

  // Business Management - Meetings
  async getMeetings(tenantId: number, initiativeId?: number): Promise<Meeting[]> {
    if (initiativeId) {
      return await db.select().from(meetings).where(and(eq(meetings.tenantId, tenantId), eq(meetings.initiativeId, initiativeId))).orderBy(meetings.startTime);
    }
    return await db.select().from(meetings).where(eq(meetings.tenantId, tenantId)).orderBy(meetings.startTime);
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting;
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const [result] = await db.insert(meetings).values(meeting).returning();
    return result;
  }

  async updateMeeting(id: number, updates: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const [result] = await db.update(meetings).set(updates).where(eq(meetings.id, id)).returning();
    return result;
  }

  async deleteMeeting(id: number): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  // Business Governance - Review Notes
  async getStrategyReviewNotes(tenantId: number, entityType: string, entityId: number): Promise<StrategyReviewNote[]> {
    return await db.select().from(strategyReviewNotes)
      .where(and(eq(strategyReviewNotes.tenantId, tenantId), eq(strategyReviewNotes.entityType, entityType), eq(strategyReviewNotes.entityId, entityId)))
      .orderBy(desc(strategyReviewNotes.createdAt));
  }

  async getAllStrategyReviewNotes(tenantId: number): Promise<StrategyReviewNote[]> {
    return await db.select().from(strategyReviewNotes)
      .where(eq(strategyReviewNotes.tenantId, tenantId))
      .orderBy(desc(strategyReviewNotes.createdAt));
  }

  async createStrategyReviewNote(note: InsertStrategyReviewNote): Promise<StrategyReviewNote> {
    const [row] = await db.insert(strategyReviewNotes).values(note).returning();
    return row;
  }

  async deleteStrategyReviewNote(id: number): Promise<void> {
    await db.delete(strategyReviewNotes).where(eq(strategyReviewNotes.id, id));
  }

  async updateStrategyReviewNote(id: number, userId: string, content: string): Promise<StrategyReviewNote | null> {
    const [existing] = await db.select().from(strategyReviewNotes).where(eq(strategyReviewNotes.id, id));
    if (!existing || existing.authorId !== userId) return null;
    const [row] = await db
      .update(strategyReviewNotes)
      .set({ content })
      .where(eq(strategyReviewNotes.id, id))
      .returning();
    return row ?? null;
  }

  // Business Governance - RAG History
  async getStrategyRagHistory(tenantId: number, entityType?: string, entityId?: number): Promise<StrategyRagHistory[]> {
    const conditions = [eq(strategyRagHistory.tenantId, tenantId)];
    if (entityType) conditions.push(eq(strategyRagHistory.entityType, entityType));
    if (entityId) conditions.push(eq(strategyRagHistory.entityId, entityId));
    return await db.select().from(strategyRagHistory)
      .where(and(...conditions))
      .orderBy(desc(strategyRagHistory.createdAt));
  }

  async createStrategyRagHistory(entry: InsertStrategyRagHistory): Promise<StrategyRagHistory> {
    const [row] = await db.insert(strategyRagHistory).values(entry).returning();
    return row;
  }

  // Business Governance - Overdue Reviews
  async getOverdueReviews(tenantId: number): Promise<{ entityType: string; entityId: number; entityTitle: string; ownerName: string | null; nextReviewDate: string; reviewCadence: string; daysOverdue: number }[]> {
    const today = new Date().toISOString().slice(0, 10);
    const strategies = await db.select().from(strategyItems)
      .where(and(eq(strategyItems.tenantId, tenantId)));
    const goalsList = await db.select().from(goals)
      .where(and(eq(goals.tenantId, tenantId)));

    const result: { entityType: string; entityId: number; entityTitle: string; ownerName: string | null; nextReviewDate: string; reviewCadence: string; daysOverdue: number }[] = [];

    for (const s of strategies) {
      if (s.nextReviewDate && s.nextReviewDate < today) {
        const days = Math.floor((new Date(today).getTime() - new Date(s.nextReviewDate).getTime()) / 86400000);
        result.push({ entityType: "strategy", entityId: s.id, entityTitle: s.title, ownerName: s.ownerName, nextReviewDate: s.nextReviewDate, reviewCadence: s.reviewCadence ?? "quarterly", daysOverdue: days });
      }
    }
    for (const g of goalsList) {
      if (g.reviewCadence) {
        const cadenceDays = g.reviewCadence === "monthly" ? 30 : g.reviewCadence === "quarterly" ? 90 : 365;
        const lastReview = g.updatedAt;
        const daysSince = Math.floor((new Date().getTime() - new Date(lastReview).getTime()) / 86400000);
        if (daysSince > cadenceDays) {
          result.push({ entityType: "goal", entityId: g.id, entityTitle: g.title, ownerName: g.ownerName, nextReviewDate: "", reviewCadence: g.reviewCadence, daysOverdue: daysSince - cadenceDays });
        }
      }
    }
    return result.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  // Business Governance - Governance Items
  async getGovernanceItems(tenantId: number): Promise<GovernanceItem[]> {
    return await db.select().from(governanceItems)
      .where(eq(governanceItems.tenantId, tenantId))
      .orderBy(desc(governanceItems.updatedAt));
  }

  async getGovernanceItem(id: number): Promise<GovernanceItem | undefined> {
    const [item] = await db.select().from(governanceItems).where(eq(governanceItems.id, id));
    return item;
  }

  async createGovernanceItem(item: InsertGovernanceItem): Promise<GovernanceItem> {
    const [result] = await db.insert(governanceItems).values(item).returning();
    return result;
  }

  async updateGovernanceItem(id: number, updates: Partial<InsertGovernanceItem>): Promise<GovernanceItem | undefined> {
    const [result] = await db.update(governanceItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(governanceItems.id, id))
      .returning();
    return result;
  }

  async deleteGovernanceItem(id: number): Promise<void> {
    await db.delete(governanceItems).where(eq(governanceItems.id, id));
  }

  // Business - Strategy Document Links
  async getStrategyDocLinks(tenantId: number, layerType?: string, layerItemId?: number): Promise<StrategyDocumentLink[]> {
    const conditions = [eq(strategyDocumentLinks.tenantId, tenantId)];
    if (layerType) conditions.push(eq(strategyDocumentLinks.layerType, layerType));
    if (layerItemId !== undefined) conditions.push(eq(strategyDocumentLinks.layerItemId, layerItemId));
    return await db.select().from(strategyDocumentLinks)
      .where(and(...conditions))
      .orderBy(desc(strategyDocumentLinks.createdAt));
  }

  async createStrategyDocLink(link: InsertStrategyDocumentLink): Promise<StrategyDocumentLink> {
    const [result] = await db.insert(strategyDocumentLinks).values(link).returning();
    return result;
  }

  async deleteStrategyDocLink(id: number): Promise<void> {
    await db.delete(strategyDocumentLinks).where(eq(strategyDocumentLinks.id, id));
  }

  // Business - KPI Time-series Values
  async getStrategyKpiValues(tenantId: number, kpiId?: number): Promise<StrategyKpiValue[]> {
    const conditions = [eq(strategyKpiValues.tenantId, tenantId)];
    if (kpiId !== undefined) conditions.push(eq(strategyKpiValues.kpiId, kpiId));
    return await db.select().from(strategyKpiValues)
      .where(and(...conditions))
      .orderBy(desc(strategyKpiValues.periodDate));
  }

  async createStrategyKpiValue(val: InsertStrategyKpiValue): Promise<StrategyKpiValue> {
    const [result] = await db.insert(strategyKpiValues).values(val).returning();
    return result;
  }

  async deleteStrategyKpiValue(id: number): Promise<void> {
    await db.delete(strategyKpiValues).where(eq(strategyKpiValues.id, id));
  }

  // Ref sequencer
  async getNextEntityRef(tenantId: number, layer: string): Promise<number> {
    const [existing] = await db.select().from(strategyRefCounters)
      .where(and(eq(strategyRefCounters.tenantId, tenantId), eq(strategyRefCounters.layer, layer)));
    if (existing) {
      const next = existing.lastSeq + 1;
      await db.update(strategyRefCounters)
        .set({ lastSeq: next })
        .where(eq(strategyRefCounters.id, existing.id));
      return next;
    } else {
      await db.insert(strategyRefCounters).values({ tenantId, layer, lastSeq: 1 });
      return 1;
    }
  }

  async getEntityRef(tenantId: number, entityType: string, entityId: number): Promise<number | null> {
    const [row] = await db.select().from(strategyEntityRefs)
      .where(and(
        eq(strategyEntityRefs.tenantId, tenantId),
        eq(strategyEntityRefs.entityType, entityType),
        eq(strategyEntityRefs.entityId, entityId),
      ));
    return row?.refSeq ?? null;
  }

  async assignEntityRef(tenantId: number, entityType: string, entityId: number): Promise<number> {
    const existing = await this.getEntityRef(tenantId, entityType, entityId);
    if (existing !== null) return existing;
    const seq = await this.getNextEntityRef(tenantId, entityType);
    await db.insert(strategyEntityRefs).values({ tenantId, entityType, entityId, refSeq: seq });
    return seq;
  }

  async getEntityRefs(tenantId: number): Promise<Array<{ entityType: string; entityId: number; refSeq: number }>> {
    return await db.select({
      entityType: strategyEntityRefs.entityType,
      entityId: strategyEntityRefs.entityId,
      refSeq: strategyEntityRefs.refSeq,
    }).from(strategyEntityRefs).where(eq(strategyEntityRefs.tenantId, tenantId));
  }

  async backfillEntityRefs(tenantId: number): Promise<{ assigned: number }> {
    const layers: Array<{ type: string; items: Array<{ id: number }> }> = [
      { type: "strategy", items: await this.getStrategyItems(tenantId) },
      { type: "goal", items: await this.getGoals(tenantId) },
      { type: "objective", items: await this.getObjectives(tenantId) },
      { type: "initiative", items: await this.getInitiatives(tenantId) },
      { type: "okr", items: await this.getOkrs(tenantId) },
      { type: "kpi", items: await this.getKpis(tenantId) },
      { type: "governance", items: await this.getGovernanceItems(tenantId) },
    ];
    let assigned = 0;
    for (const { type, items } of layers) {
      const sorted = [...items].sort((a, b) => a.id - b.id);
      for (const item of sorted) {
        const existing = await this.getEntityRef(tenantId, type, item.id);
        if (existing === null) {
          await this.assignEntityRef(tenantId, type, item.id);
          assigned++;
        }
      }
    }
    return { assigned };
  }

  // Document Management - Folders
  async getDocumentFolders(tenantId: number, parentId?: number | null, clientId?: number): Promise<DocumentFolder[]> {
    const base = [eq(documentFolders.tenantId, tenantId)];
    if (clientId !== undefined) base.push(eq(documentFolders.clientId, clientId));
    if (parentId === null) {
      return await db.select().from(documentFolders)
        .where(and(...base, isNull(documentFolders.parentId)))
        .orderBy(documentFolders.order, documentFolders.name);
    }
    if (parentId !== undefined) {
      return await db.select().from(documentFolders)
        .where(and(...base, eq(documentFolders.parentId, parentId)))
        .orderBy(documentFolders.order, documentFolders.name);
    }
    return await db.select().from(documentFolders)
      .where(and(...base))
      .orderBy(documentFolders.order, documentFolders.name);
  }

  async getDocumentFolder(id: number): Promise<DocumentFolder | undefined> {
    const [folder] = await db.select().from(documentFolders).where(eq(documentFolders.id, id));
    return folder;
  }

  async createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder> {
    const [result] = await db.insert(documentFolders).values(folder).returning();
    return result;
  }

  async updateDocumentFolder(id: number, updates: Partial<InsertDocumentFolder>): Promise<DocumentFolder | undefined> {
    const [result] = await db.update(documentFolders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentFolders.id, id))
      .returning();
    return result;
  }

  async deleteDocumentFolder(id: number): Promise<void> {
    await db.delete(documentFolders).where(eq(documentFolders.id, id));
  }

  // Document Management - Documents
  async getDocuments(tenantId: number, folderId?: number | null, clientId?: number): Promise<Document[]> {
    const conditions = [eq(documents.tenantId, tenantId)];
    if (folderId === null) conditions.push(isNull(documents.folderId));
    else if (folderId !== undefined) conditions.push(eq(documents.folderId, folderId));
    if (clientId !== undefined) conditions.push(eq(documents.clientId, clientId));
    return await db.select().from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt));
  }

  async getDocumentsWithOwner(tenantId: number, folderId?: number | null, clientId?: number): Promise<(Document & { ownerName: string | null })[]> {
    const conditions = [eq(documents.tenantId, tenantId)];
    if (folderId === null) conditions.push(isNull(documents.folderId));
    else if (folderId !== undefined) conditions.push(eq(documents.folderId, folderId));
    if (clientId !== undefined) conditions.push(eq(documents.clientId, clientId));

    return await db.select({
      id: documents.id,
      tenantId: documents.tenantId,
      clientId: documents.clientId,
      folderId: documents.folderId,
      title: documents.title,
      description: documents.description,
      content: documents.content,
      type: documents.type,
      status: documents.status,
      ownerId: documents.ownerId,
      currentVersion: documents.currentVersion,
      isFavorite: documents.isFavorite,
      isPinned: documents.isPinned,
      viewCount: documents.viewCount,
      lastViewedAt: documents.lastViewedAt,
      metadata: documents.metadata,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      ownerName: sql<string | null>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email}, ${documents.ownerId})`,
    })
    .from(documents)
    .leftJoin(users, eq(documents.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(documents.updatedAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [result] = await db.insert(documents).values(document).returning();
    return result;
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const [result] = await db.update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return result;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async searchDocuments(tenantId: number, query: string, clientId?: number): Promise<Document[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    const conditions = [
      eq(documents.tenantId, tenantId),
      or(
        sql`LOWER(${documents.title}) LIKE ${searchTerm}`,
        sql`LOWER(${documents.description}) LIKE ${searchTerm}`,
        sql`LOWER(${documents.content}) LIKE ${searchTerm}`,
      ),
    ];
    if (clientId !== undefined) conditions.push(eq(documents.clientId, clientId));
    return await db.select().from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt));
  }

  async getFavoriteDocuments(tenantId: number, userId: string, clientId?: number): Promise<Document[]> {
    const conditions = [
      eq(documents.tenantId, tenantId),
      eq(documents.isFavorite, true),
    ];
    if (clientId !== undefined) conditions.push(eq(documents.clientId, clientId));
    return await db.select().from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt));
  }

  async getRecentDocuments(tenantId: number, userId: string, limit: number = 10, clientId?: number): Promise<Document[]> {
    const conditions = [
      eq(documents.tenantId, tenantId),
      eq(documents.ownerId, userId),
    ];
    if (clientId !== undefined) conditions.push(eq(documents.clientId, clientId));
    return await db.select().from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.lastViewedAt))
      .limit(limit);
  }

  async getSharedWithMeDocuments(tenantId: number, userId: string, clientId?: number): Promise<(Document & { ownerName: string | null })[]> {
    const aclEntries = await db.select().from(documentAcl)
      .where(and(
        eq(documentAcl.subjectType, "user"),
        eq(documentAcl.subjectId, userId),
      ));
    if (!aclEntries.length) return [];
    const docIds = Array.from(new Set(aclEntries.map(a => a.documentId).filter((id): id is number => id != null)));
    if (!docIds.length) return [];

    const conditions = [
      eq(documents.tenantId, tenantId),
      inArray(documents.id, docIds),
      ne(documents.ownerId, userId),
    ];
    if (clientId !== undefined) conditions.push(eq(documents.clientId, clientId));

    return await db.select({
      id: documents.id,
      tenantId: documents.tenantId,
      clientId: documents.clientId,
      folderId: documents.folderId,
      title: documents.title,
      description: documents.description,
      content: documents.content,
      type: documents.type,
      status: documents.status,
      ownerId: documents.ownerId,
      currentVersion: documents.currentVersion,
      isFavorite: documents.isFavorite,
      isPinned: documents.isPinned,
      viewCount: documents.viewCount,
      lastViewedAt: documents.lastViewedAt,
      metadata: documents.metadata,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      ownerName: sql<string | null>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email}, ${documents.ownerId})`,
    })
      .from(documents)
      .leftJoin(users, eq(documents.ownerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt));
  }

  async getDocumentByPublicToken(token: string): Promise<Document | undefined> {
    const all = await db.select().from(documents)
      .where(sql`(${documents.metadata}->>'publicToken') = ${token}`)
      .limit(1);
    return all[0];
  }

  // Document Management - Versions
  async getDocumentVersions(documentId: number): Promise<DocumentVersion[]> {
    return await db.select().from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.version));
  }

  async getDocumentVersion(id: number): Promise<DocumentVersion | undefined> {
    const [version] = await db.select().from(documentVersions).where(eq(documentVersions.id, id));
    return version;
  }

  async createDocumentVersion(version: InsertDocumentVersion): Promise<DocumentVersion> {
    const [result] = await db.insert(documentVersions).values(version).returning();
    return result;
  }

  async getNextDocumentVersionNumber(documentId: number): Promise<number> {
    const versions = await this.getDocumentVersions(documentId);
    const maxFromRows = versions.reduce((max, v) => Math.max(max, v.version), 0);
    const [doc] = await db.select({ currentVersion: documents.currentVersion }).from(documents).where(eq(documents.id, documentId));
    const baseline = Math.max(maxFromRows, doc?.currentVersion ?? 0);
    return baseline + 1;
  }

  async restoreDocumentVersion(documentId: number, versionId: number): Promise<Document | undefined> {
    const [version] = await db.select().from(documentVersions).where(eq(documentVersions.id, versionId));
    if (!version) return undefined;

    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
    if (!doc) return undefined;

    await db.insert(documentVersions).values({
      documentId,
      version: doc.currentVersion! + 1,
      title: doc.title,
      content: doc.content,
      changeDescription: "Version before restore",
      authorId: doc.ownerId,
    });

    const [result] = await db.update(documents)
      .set({
        title: version.title,
        content: version.content,
        currentVersion: doc.currentVersion! + 2,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();

    return result;
  }

  // Document Management - Tags
  async getTags(tenantId: number): Promise<DocTag[]> {
    return await db.select().from(tags).where(eq(tags.tenantId, tenantId)).orderBy(tags.name);
  }

  async getTag(id: number): Promise<DocTag | undefined> {
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    return tag;
  }

  async createTag(tag: InsertDocTag): Promise<DocTag> {
    const [result] = await db.insert(tags).values(tag).returning();
    return result;
  }

  async updateTag(id: number, updates: Partial<InsertDocTag>): Promise<DocTag | undefined> {
    const [result] = await db.update(tags).set(updates).where(eq(tags.id, id)).returning();
    return result;
  }

  async deleteTag(id: number): Promise<void> {
    await db.delete(tags).where(eq(tags.id, id));
  }

  // Document Management - Document Tags
  async getDocumentTags(documentId: number): Promise<(DocumentTag & { tag: DocTag })[]> {
    const result = await db
      .select({
        docTag: documentTags,
        tag: tags,
      })
      .from(documentTags)
      .innerJoin(tags, eq(documentTags.tagId, tags.id))
      .where(eq(documentTags.documentId, documentId));
    
    return result.map(r => ({ ...r.docTag, tag: r.tag }));
  }

  async addDocumentTag(docTag: InsertDocumentTag): Promise<DocumentTag> {
    const [result] = await db.insert(documentTags).values(docTag).returning();
    return result;
  }

  async removeDocumentTag(documentId: number, tagId: number): Promise<void> {
    await db.delete(documentTags).where(and(eq(documentTags.documentId, documentId), eq(documentTags.tagId, tagId)));
  }

  // Document Management - Access Control
  async getDocumentAcl(documentId?: number, folderId?: number): Promise<DocumentAcl[]> {
    if (documentId) {
      return await db.select().from(documentAcl).where(eq(documentAcl.documentId, documentId));
    } else if (folderId) {
      return await db.select().from(documentAcl).where(eq(documentAcl.folderId, folderId));
    }
    return [];
  }

  async getDocumentAclEntry(id: number): Promise<DocumentAcl | undefined> {
    const [result] = await db.select().from(documentAcl).where(eq(documentAcl.id, id));
    return result;
  }

  async createDocumentAcl(acl: InsertDocumentAcl): Promise<DocumentAcl> {
    const [result] = await db.insert(documentAcl).values(acl).returning();
    return result;
  }

  async updateDocumentAcl(id: number, updates: Partial<InsertDocumentAcl>): Promise<DocumentAcl | undefined> {
    const [result] = await db.update(documentAcl).set(updates).where(eq(documentAcl.id, id)).returning();
    return result;
  }

  async deleteDocumentAcl(id: number): Promise<void> {
    await db.delete(documentAcl).where(eq(documentAcl.id, id));
  }

  // Document Management - Comments
  async getDocumentComments(documentId: number): Promise<(DocumentComment & { author: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]> {
    const result = await db
      .select({
        comment: documentComments,
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(documentComments)
      .innerJoin(users, eq(documentComments.authorId, users.id))
      .where(eq(documentComments.documentId, documentId))
      .orderBy(documentComments.createdAt);
    
    return result.map(r => ({ ...r.comment, author: r.author }));
  }

  async getDocumentComment(id: number): Promise<DocumentComment | undefined> {
    const [comment] = await db.select().from(documentComments).where(eq(documentComments.id, id));
    return comment;
  }

  async createDocumentComment(comment: InsertDocumentComment): Promise<DocumentComment> {
    const [result] = await db.insert(documentComments).values(comment).returning();
    return result;
  }

  async updateDocumentComment(id: number, content: string, isResolved?: boolean): Promise<DocumentComment | undefined> {
    const updateData: Partial<DocumentComment> = { content, updatedAt: new Date() };
    if (isResolved !== undefined) updateData.isResolved = isResolved;
    const [result] = await db.update(documentComments).set(updateData).where(eq(documentComments.id, id)).returning();
    return result;
  }

  async deleteDocumentComment(id: number): Promise<void> {
    await db.delete(documentComments).where(eq(documentComments.id, id));
  }

  // Document Management - Templates
  async getDocumentTemplates(tenantId: number, category?: string): Promise<DocumentTemplate[]> {
    if (category) {
      return await db.select().from(documentTemplates)
        .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.category, category)))
        .orderBy(documentTemplates.name);
    }
    return await db.select().from(documentTemplates)
      .where(eq(documentTemplates.tenantId, tenantId))
      .orderBy(documentTemplates.name);
  }

  async getDocumentTemplate(id: number): Promise<DocumentTemplate | undefined> {
    const [template] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, id));
    return template;
  }

  async createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate> {
    const [result] = await db.insert(documentTemplates).values(template).returning();
    return result;
  }

  async updateDocumentTemplate(id: number, updates: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate | undefined> {
    const [result] = await db.update(documentTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentTemplates.id, id))
      .returning();
    return result;
  }

  async deleteDocumentTemplate(id: number): Promise<void> {
    await db.delete(documentTemplates).where(eq(documentTemplates.id, id));
  }

  // Document Management - Audit Logs
  async getDocumentAuditLogs(tenantId: number, documentId?: number): Promise<DocumentAuditLog[]> {
    if (documentId) {
      return await db.select().from(documentAuditLogs)
        .where(and(eq(documentAuditLogs.tenantId, tenantId), eq(documentAuditLogs.documentId, documentId)))
        .orderBy(desc(documentAuditLogs.createdAt));
    }
    return await db.select().from(documentAuditLogs)
      .where(eq(documentAuditLogs.tenantId, tenantId))
      .orderBy(desc(documentAuditLogs.createdAt));
  }

  async createDocumentAuditLog(log: InsertDocumentAuditLog): Promise<DocumentAuditLog> {
    const [result] = await db.insert(documentAuditLogs).values(log).returning();
    return result;
  }

  // Document-Initiative Links
  async getDocumentInitiativeLinks(tenantId: number, initiativeId?: number, documentId?: number): Promise<DocumentInitiativeLink[]> {
    if (!tenantId || isNaN(tenantId)) {
      return [];
    }
    const conditions = [eq(documentInitiativeLinks.tenantId, tenantId)];
    if (initiativeId && !isNaN(initiativeId)) {
      conditions.push(eq(documentInitiativeLinks.initiativeId, initiativeId));
    }
    if (documentId && !isNaN(documentId)) {
      conditions.push(eq(documentInitiativeLinks.documentId, documentId));
    }
    return await db.select().from(documentInitiativeLinks)
      .where(and(...conditions))
      .orderBy(desc(documentInitiativeLinks.createdAt));
  }

  async createDocumentInitiativeLink(link: InsertDocumentInitiativeLink): Promise<DocumentInitiativeLink> {
    const [result] = await db.insert(documentInitiativeLinks).values(link).returning();
    return result;
  }

  async deleteDocumentInitiativeLink(id: number): Promise<void> {
    await db.delete(documentInitiativeLinks).where(eq(documentInitiativeLinks.id, id));
  }

  // Task Management - Tasks
  async getTasks(tenantId: number, filters?: { assigneeId?: string; status?: string; priority?: string; source?: string; boardId?: number; clientId?: number }): Promise<(Task & { assignee?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]> {
    const conditions = [eq(tasks.tenantId, tenantId)];
    
    if (filters?.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    if (filters?.status) conditions.push(eq(tasks.status, filters.status));
    if (filters?.priority) conditions.push(eq(tasks.priority, filters.priority));
    if (filters?.source) conditions.push(eq(tasks.source, filters.source));
    if (filters?.boardId) conditions.push(eq(tasks.boardId, filters.boardId));
    if (filters?.clientId) conditions.push(eq(tasks.clientId, filters.clientId));
    
    const result = await db
      .select({
        task: tasks,
        assignee: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(and(...conditions))
      .orderBy(tasks.order, tasks.createdAt);
    
    return result.map(r => ({ ...r.task, assignee: r.assignee || undefined }));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [result] = await db.update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return result;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Task Management - Task Boards
  async getTaskBoards(tenantId: number, clientId?: number): Promise<(TaskBoard & { board: Board })[]> {
    const conditions = [eq(taskBoards.tenantId, tenantId)];
    if (clientId !== undefined) conditions.push(eq(boards.workspaceId, clientId));
    const result = await db
      .select({
        taskBoard: taskBoards,
        board: boards,
      })
      .from(taskBoards)
      .innerJoin(boards, eq(taskBoards.boardId, boards.id))
      .where(and(...conditions));

    return result.map((r) => ({ ...r.taskBoard, board: r.board }));
  }

  async getPmEntityClientIdByProjectId(projectId: number): Promise<number | null | undefined> {
    const project = await this.getPmProject(projectId);
    return project?.clientId;
  }

  async getTaskBoard(id: number): Promise<TaskBoard | undefined> {
    const [result] = await db.select().from(taskBoards).where(eq(taskBoards.id, id));
    return result;
  }

  async createTaskBoard(taskBoard: InsertTaskBoard): Promise<TaskBoard> {
    const [result] = await db.insert(taskBoards).values(taskBoard).returning();
    return result;
  }

  async updateTaskBoard(id: number, updates: Partial<InsertTaskBoard>): Promise<TaskBoard | undefined> {
    const [result] = await db.update(taskBoards)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(taskBoards.id, id))
      .returning();
    return result;
  }

  async deleteTaskBoard(id: number): Promise<void> {
    await db.delete(taskBoards).where(eq(taskBoards.id, id));
  }

  // Task Management - Task Links
  async getTaskLinks(taskId: number): Promise<TaskLink[]> {
    return await db.select().from(taskLinks).where(eq(taskLinks.taskId, taskId));
  }

  async createTaskLink(link: InsertTaskLink): Promise<TaskLink> {
    const [result] = await db.insert(taskLinks).values(link).returning();
    return result;
  }

  async deleteTaskLink(id: number): Promise<void> {
    await db.delete(taskLinks).where(eq(taskLinks.id, id));
  }

  // Task Management - Task Subtasks
  async getTaskSubtasks(taskId: number): Promise<TaskSubtask[]> {
    return await db.select().from(taskSubtasks)
      .where(eq(taskSubtasks.taskId, taskId))
      .orderBy(taskSubtasks.order);
  }

  async createTaskSubtask(subtask: InsertTaskSubtask): Promise<TaskSubtask> {
    const [result] = await db.insert(taskSubtasks).values(subtask).returning();
    return result;
  }

  async updateTaskSubtask(id: number, updates: Partial<InsertTaskSubtask>): Promise<TaskSubtask | undefined> {
    const [result] = await db.update(taskSubtasks)
      .set(updates)
      .where(eq(taskSubtasks.id, id))
      .returning();
    return result;
  }

  async deleteTaskSubtask(id: number): Promise<void> {
    await db.delete(taskSubtasks).where(eq(taskSubtasks.id, id));
  }

  // Task Management - Task Views
  async getTaskViews(tenantId: number, userId: string): Promise<TaskView[]> {
    return await db.select().from(taskViews)
      .where(and(eq(taskViews.tenantId, tenantId), eq(taskViews.userId, userId)));
  }

  async getTaskView(id: number): Promise<TaskView | undefined> {
    const [result] = await db.select().from(taskViews).where(eq(taskViews.id, id));
    return result;
  }

  async createTaskView(view: InsertTaskView): Promise<TaskView> {
    const [result] = await db.insert(taskViews).values(view).returning();
    return result;
  }

  async updateTaskView(id: number, updates: Partial<InsertTaskView>): Promise<TaskView | undefined> {
    const [result] = await db.update(taskViews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(taskViews.id, id))
      .returning();
    return result;
  }

  async deleteTaskView(id: number): Promise<void> {
    await db.delete(taskViews).where(eq(taskViews.id, id));
  }

  // Projects Module - Portfolios
  async getPmPortfolios(tenantId: number, clientId?: number): Promise<PmPortfolio[]> {
    if (clientId === undefined) {
      return await db.select().from(pmPortfolios).where(eq(pmPortfolios.tenantId, tenantId)).orderBy(pmPortfolios.name);
    }
    const rows = await db
      .selectDistinct({ portfolio: pmPortfolios })
      .from(pmPortfolios)
      .innerJoin(pmProjects, eq(pmProjects.portfolioId, pmPortfolios.id))
      .where(and(eq(pmPortfolios.tenantId, tenantId), eq(pmProjects.clientId, clientId)))
      .orderBy(pmPortfolios.name);
    return rows.map((r) => r.portfolio);
  }

  async getPmPortfolio(id: number): Promise<PmPortfolio | undefined> {
    const [result] = await db.select().from(pmPortfolios).where(eq(pmPortfolios.id, id));
    return result;
  }

  async createPmPortfolio(portfolio: InsertPmPortfolio): Promise<PmPortfolio> {
    const [result] = await db.insert(pmPortfolios).values(portfolio).returning();
    return result;
  }

  async updatePmPortfolio(id: number, updates: Partial<InsertPmPortfolio>): Promise<PmPortfolio | undefined> {
    const [result] = await db.update(pmPortfolios).set({ ...updates, updatedAt: new Date() }).where(eq(pmPortfolios.id, id)).returning();
    return result;
  }

  async deletePmPortfolio(id: number): Promise<void> {
    await db.delete(pmPortfolios).where(eq(pmPortfolios.id, id));
  }

  // Projects Module - Programs
  async getPmPrograms(tenantId: number, portfolioId?: number, clientId?: number): Promise<PmProgram[]> {
    if (clientId !== undefined) {
      const conditions = [eq(pmPrograms.tenantId, tenantId), eq(pmProjects.clientId, clientId)];
      if (portfolioId) conditions.push(eq(pmPrograms.portfolioId, portfolioId));
      const rows = await db
        .selectDistinct({ program: pmPrograms })
        .from(pmPrograms)
        .innerJoin(pmProjects, eq(pmProjects.programId, pmPrograms.id))
        .where(and(...conditions))
        .orderBy(pmPrograms.name);
      return rows.map((r) => r.program);
    }
    if (portfolioId) {
      return await db.select().from(pmPrograms).where(and(eq(pmPrograms.tenantId, tenantId), eq(pmPrograms.portfolioId, portfolioId))).orderBy(pmPrograms.name);
    }
    return await db.select().from(pmPrograms).where(eq(pmPrograms.tenantId, tenantId)).orderBy(pmPrograms.name);
  }

  async getPmProgram(id: number): Promise<PmProgram | undefined> {
    const [result] = await db.select().from(pmPrograms).where(eq(pmPrograms.id, id));
    return result;
  }

  async createPmProgram(program: InsertPmProgram): Promise<PmProgram> {
    const [result] = await db.insert(pmPrograms).values(program).returning();
    return result;
  }

  async updatePmProgram(id: number, updates: Partial<InsertPmProgram>): Promise<PmProgram | undefined> {
    const [result] = await db.update(pmPrograms).set({ ...updates, updatedAt: new Date() }).where(eq(pmPrograms.id, id)).returning();
    return result;
  }

  async deletePmProgram(id: number): Promise<void> {
    await db.delete(pmPrograms).where(eq(pmPrograms.id, id));
  }

  // Projects Module - Projects
  async getPmProjects(tenantId: number, filters?: { portfolioId?: number; programId?: number; status?: string; methodology?: string; clientId?: number | null }): Promise<PmProject[]> {
    const conditions = [eq(pmProjects.tenantId, tenantId)];
    if (filters?.portfolioId) conditions.push(eq(pmProjects.portfolioId, filters.portfolioId));
    if (filters?.programId) conditions.push(eq(pmProjects.programId, filters.programId));
    if (filters?.status) conditions.push(eq(pmProjects.status, filters.status));
    if (filters?.methodology) conditions.push(eq(pmProjects.methodology, filters.methodology));
    if (filters?.clientId !== undefined && filters.clientId !== null) {
      conditions.push(eq(pmProjects.clientId, filters.clientId));
    }
    return await db.select().from(pmProjects).where(and(...conditions)).orderBy(pmProjects.name);
  }

  async getPmProject(id: number): Promise<PmProject | undefined> {
    const [result] = await db.select().from(pmProjects).where(eq(pmProjects.id, id));
    return result;
  }

  async createPmProject(project: InsertPmProject): Promise<PmProject> {
    const [result] = await db.insert(pmProjects).values(project).returning();
    return result;
  }

  async updatePmProject(id: number, updates: Partial<InsertPmProject>): Promise<PmProject | undefined> {
    const [result] = await db.update(pmProjects).set({ ...updates, updatedAt: new Date() }).where(eq(pmProjects.id, id)).returning();
    return result;
  }

  async deletePmProject(id: number): Promise<void> {
    await db.delete(pmProjects).where(eq(pmProjects.id, id));
  }

  // Projects Module - Project Tools
  async getPmProjectTools(projectId: number): Promise<PmProjectTool[]> {
    return await db.select().from(pmProjectTools).where(eq(pmProjectTools.projectId, projectId)).orderBy(pmProjectTools.sortOrder);
  }

  async createPmProjectTool(tool: InsertPmProjectTool): Promise<PmProjectTool> {
    const [result] = await db.insert(pmProjectTools).values(tool).returning();
    return result;
  }

  async updatePmProjectTool(id: number, updates: Partial<InsertPmProjectTool>): Promise<PmProjectTool | undefined> {
    const [result] = await db.update(pmProjectTools).set(updates).where(eq(pmProjectTools.id, id)).returning();
    return result;
  }

  async deletePmProjectTool(id: number): Promise<void> {
    await db.delete(pmProjectTools).where(eq(pmProjectTools.id, id));
  }

  async bulkCreatePmProjectTools(tools: InsertPmProjectTool[]): Promise<PmProjectTool[]> {
    if (tools.length === 0) return [];
    return await db.insert(pmProjectTools).values(tools).returning();
  }

  // Projects Module - Phases
  async getPmProjectPhases(projectId: number): Promise<PmProjectPhase[]> {
    return await db.select().from(pmProjectPhases).where(eq(pmProjectPhases.projectId, projectId)).orderBy(pmProjectPhases.phaseNumber);
  }

  async getPmProjectPhase(id: number): Promise<PmProjectPhase | undefined> {
    const [result] = await db.select().from(pmProjectPhases).where(eq(pmProjectPhases.id, id));
    return result;
  }

  async createPmProjectPhase(phase: InsertPmProjectPhase): Promise<PmProjectPhase> {
    const [result] = await db.insert(pmProjectPhases).values(phase).returning();
    return result;
  }

  async updatePmProjectPhase(id: number, updates: Partial<InsertPmProjectPhase>): Promise<PmProjectPhase | undefined> {
    const [result] = await db.update(pmProjectPhases).set({ ...updates, updatedAt: new Date() }).where(eq(pmProjectPhases.id, id)).returning();
    return result;
  }

  async deletePmProjectPhase(id: number): Promise<void> {
    await db.delete(pmProjectPhases).where(eq(pmProjectPhases.id, id));
  }

  // Projects Module - Milestones
  async getAllPmMilestones(tenantId?: number): Promise<PmMilestone[]> {
    if (tenantId) {
      return await db.select().from(pmMilestones).where(eq(pmMilestones.tenantId, tenantId)).orderBy(pmMilestones.targetDate, pmMilestones.order);
    }
    return await db.select().from(pmMilestones).orderBy(pmMilestones.targetDate, pmMilestones.order);
  }

  async getPmMilestones(projectId: number, phaseId?: number): Promise<PmMilestone[]> {
    if (phaseId) {
      return await db.select().from(pmMilestones).where(and(eq(pmMilestones.projectId, projectId), eq(pmMilestones.phaseId, phaseId))).orderBy(pmMilestones.order);
    }
    return await db.select().from(pmMilestones).where(eq(pmMilestones.projectId, projectId)).orderBy(pmMilestones.order);
  }

  async getPmMilestone(id: number): Promise<PmMilestone | undefined> {
    const [result] = await db.select().from(pmMilestones).where(eq(pmMilestones.id, id));
    return result;
  }

  async createPmMilestone(milestone: InsertPmMilestone): Promise<PmMilestone> {
    const [result] = await db.insert(pmMilestones).values(milestone).returning();
    return result;
  }

  async updatePmMilestone(id: number, updates: Partial<InsertPmMilestone>): Promise<PmMilestone | undefined> {
    const [result] = await db.update(pmMilestones).set({ ...updates, updatedAt: new Date() }).where(eq(pmMilestones.id, id)).returning();
    return result;
  }

  async deletePmMilestone(id: number): Promise<void> {
    await db.delete(pmMilestones).where(eq(pmMilestones.id, id));
  }

  // Projects Module - Tasks
  async getPmTasks(projectId: number, filters?: { phaseId?: number; status?: string; assigneeId?: string }): Promise<PmTask[]> {
    const conditions = [eq(pmTasks.projectId, projectId)];
    if (filters?.phaseId) conditions.push(eq(pmTasks.phaseId, filters.phaseId));
    if (filters?.status) conditions.push(eq(pmTasks.status, filters.status));
    if (filters?.assigneeId) conditions.push(eq(pmTasks.assigneeId, filters.assigneeId));
    return await db.select().from(pmTasks).where(and(...conditions)).orderBy(pmTasks.order);
  }

  async getPmTask(id: number): Promise<PmTask | undefined> {
    const [result] = await db.select().from(pmTasks).where(eq(pmTasks.id, id));
    return result;
  }

  async createPmTask(task: InsertPmTask): Promise<PmTask> {
    const [result] = await db.insert(pmTasks).values(task).returning();
    return result;
  }

  async updatePmTask(id: number, updates: Partial<InsertPmTask>): Promise<PmTask | undefined> {
    const [result] = await db.update(pmTasks).set({ ...updates, updatedAt: new Date() }).where(eq(pmTasks.id, id)).returning();
    return result;
  }

  async deletePmTask(id: number): Promise<void> {
    await db.delete(pmTasks).where(eq(pmTasks.id, id));
  }

  async deleteAllPmTasksByProject(projectId: number): Promise<void> {
    await db.delete(pmTasks).where(eq(pmTasks.projectId, projectId));
  }

  async bulkImportPmTasks(projectId: number, tasks: { tempId: string; parentTempId: string | null; data: InsertPmTask }[]): Promise<{ tempId: string; dbId: number }[]> {
    await db.delete(pmTasks).where(eq(pmTasks.projectId, projectId));

    const idMap = new Map<string, number>();
    const results: { tempId: string; dbId: number }[] = [];

    for (const t of tasks) {
      const parentDbId = t.parentTempId ? idMap.get(t.parentTempId) ?? null : null;
      const [created] = await db.insert(pmTasks).values({
        ...t.data,
        projectId,
        parentTaskId: parentDbId,
      }).returning();
      idMap.set(t.tempId, created.id);
      results.push({ tempId: t.tempId, dbId: created.id });
    }

    return results;
  }

  async bulkImportGanttPlan(projectId: number, tenantId: number, mode: "append" | "overwrite", items: {
    wbs: string; name: string; type: number; parentWbs?: string | null; predecessorWbs?: string | null;
    owner?: string; start: string; end?: string; progress?: number; rag?: string; notes?: string;
  }[]): Promise<{ imported: number }> {
    const ragMap: Record<string, string> = { g: "green", a: "amber", r: "red", green: "green", amber: "amber", red: "red" };
    if (mode === "overwrite") {
      await this.deleteAllPmTasksByProject(projectId);
      const milestones = await this.getPmMilestones(projectId);
      for (const m of milestones) await this.deletePmMilestone(m.id);
      const workstreams = await this.getPmWorkstreams(projectId);
      for (const w of workstreams) await this.deletePmWorkstream(w.id);
      const phases = await this.getPmProjectPhases(projectId);
      for (const p of phases) await this.deletePmProjectPhase(p.id);
    }

    type WbsRef = { kind: "phase" | "ws" | "task" | "ms"; id: number; phaseId?: number | null };
    const wbsMap = new Map<string, WbsRef>();
    const sorted = [...items]
      .filter((i) => i.type >= 2 && i.type <= 6 && i.name && i.start)
      .sort((a, b) => a.type - b.type || a.wbs.localeCompare(b.wbs, undefined, { numeric: true }));

    let phaseOrder = 0;
    let wsOrder = 0;
    let taskOrder = 0;
    let msOrder = 0;

    for (const item of sorted) {
      const parent = item.parentWbs ? wbsMap.get(item.parentWbs) : undefined;
      const rag = ragMap[(item.rag || "g").toLowerCase()] || "green";
      const end = item.end || item.start;

      if (item.type === 2) {
        phaseOrder++;
        const phase = await this.createPmProjectPhase({
          tenantId,
          projectId,
          name: item.name,
          phaseNumber: phaseOrder,
          plannedStartDate: item.start,
          plannedEndDate: end,
          progress: item.progress ?? 0,
          ragStatus: rag,
          description: item.notes || null,
          order: phaseOrder,
        });
        wbsMap.set(item.wbs, { kind: "phase", id: phase.id });
      } else if (item.type === 3) {
        wsOrder++;
        const phaseId = parent?.kind === "phase" ? parent.id : null;
        const ws = await this.createPmWorkstream({
          tenantId,
          projectId,
          phaseId,
          name: item.name,
          plannedStartDate: item.start,
          plannedEndDate: end,
          progress: item.progress ?? 0,
          ragStatus: rag,
          description: item.notes || null,
          wbsCode: item.wbs,
          order: wsOrder,
        });
        wbsMap.set(item.wbs, { kind: "ws", id: ws.id, phaseId });
      } else if (item.type === 4 || item.type === 5) {
        taskOrder++;
        let phaseId: number | null = null;
        let parentTaskId: number | null = null;
        if (parent?.kind === "phase") phaseId = parent.id;
        else if (parent?.kind === "ws") phaseId = parent.phaseId ?? null;
        else if (parent?.kind === "task") {
          parentTaskId = parent.id;
          phaseId = parent.phaseId ?? null;
        }
        const predRef = item.predecessorWbs ? wbsMap.get(item.predecessorWbs) : undefined;
        const predecessorIds = predRef?.kind === "task" ? [predRef.id] : undefined;
        const task = await this.createPmTask({
          tenantId,
          projectId,
          phaseId,
          parentTaskId,
          name: item.name,
          plannedStartDate: item.start,
          plannedEndDate: end,
          progress: item.progress ?? 0,
          status: "todo",
          description: item.notes || null,
          wbsCode: item.wbs,
          isSummary: item.type === 4,
          ganttType: item.type === 4 ? "summary" : "task",
          predecessorIds,
          order: taskOrder,
        });
        wbsMap.set(item.wbs, { kind: "task", id: task.id, phaseId });
      } else if (item.type === 6) {
        msOrder++;
        const phaseId = parent?.kind === "phase"
          ? parent.id
          : parent?.kind === "ws"
            ? parent.phaseId ?? null
            : null;
        const ms = await this.createPmMilestone({
          tenantId,
          projectId,
          phaseId,
          name: item.name,
          dueDate: item.start,
          status: (item.progress ?? 0) >= 100 ? "completed" : "pending",
          ragStatus: rag,
          order: msOrder,
        });
        wbsMap.set(item.wbs, { kind: "ms", id: ms.id, phaseId });
      }
    }

    return { imported: sorted.length };
  }

  // Projects Module - Team Members
  async getPmTeamMembers(projectId: number): Promise<(PmTeamMember & { user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } })[]> {
    const result = await db
      .select({
        member: pmTeamMembers,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(pmTeamMembers)
      .leftJoin(users, eq(pmTeamMembers.userId, users.id))
      .where(eq(pmTeamMembers.projectId, projectId));
    return result.map(r => ({ ...r.member, user: r.user! }));
  }

  async getPmTeamMember(id: number): Promise<PmTeamMember | undefined> {
    const [result] = await db.select().from(pmTeamMembers).where(eq(pmTeamMembers.id, id));
    return result;
  }

  async createPmTeamMember(member: InsertPmTeamMember): Promise<PmTeamMember> {
    const [result] = await db.insert(pmTeamMembers).values(member).returning();
    return result;
  }

  async updatePmTeamMember(id: number, updates: Partial<InsertPmTeamMember>): Promise<PmTeamMember | undefined> {
    const [result] = await db.update(pmTeamMembers).set(updates).where(eq(pmTeamMembers.id, id)).returning();
    return result;
  }

  async deletePmTeamMember(id: number): Promise<void> {
    await db.delete(pmTeamMembers).where(eq(pmTeamMembers.id, id));
  }

  // Projects Module - RAIDD Items
  async getPmRaiddItems(projectId: number, type?: string): Promise<PmRaiddItem[]> {
    if (type) {
      return await db.select().from(pmRaiddItems).where(and(eq(pmRaiddItems.projectId, projectId), eq(pmRaiddItems.type, type))).orderBy(pmRaiddItems.createdAt);
    }
    return await db.select().from(pmRaiddItems).where(eq(pmRaiddItems.projectId, projectId)).orderBy(pmRaiddItems.createdAt);
  }

  async getPmRaiddItem(id: number): Promise<PmRaiddItem | undefined> {
    const [result] = await db.select().from(pmRaiddItems).where(eq(pmRaiddItems.id, id));
    return result;
  }

  async createPmRaiddItem(item: InsertPmRaiddItem): Promise<PmRaiddItem> {
    const [result] = await db.insert(pmRaiddItems).values(item).returning();
    return result;
  }

  async updatePmRaiddItem(id: number, updates: Partial<InsertPmRaiddItem>): Promise<PmRaiddItem | undefined> {
    const [result] = await db.update(pmRaiddItems).set({ ...updates, updatedAt: new Date() }).where(eq(pmRaiddItems.id, id)).returning();
    return result;
  }

  async deletePmRaiddItem(id: number): Promise<void> {
    await db.delete(pmRaiddItems).where(eq(pmRaiddItems.id, id));
  }

  // Projects Module - Deliverable Phases
  async getPmDeliverablePhases(projectId: number): Promise<PmDeliverablePhase[]> {
    return await db.select().from(pmDeliverablePhases).where(eq(pmDeliverablePhases.projectId, projectId)).orderBy(pmDeliverablePhases.sortOrder);
  }

  async createPmDeliverablePhase(phase: InsertPmDeliverablePhase): Promise<PmDeliverablePhase> {
    const [result] = await db.insert(pmDeliverablePhases).values(phase).returning();
    return result;
  }

  async updatePmDeliverablePhase(id: number, updates: Partial<InsertPmDeliverablePhase>): Promise<PmDeliverablePhase | undefined> {
    const [result] = await db.update(pmDeliverablePhases).set(updates).where(eq(pmDeliverablePhases.id, id)).returning();
    return result;
  }

  async deletePmDeliverablePhase(id: number): Promise<void> {
    await db.delete(pmDeliverablePhases).where(eq(pmDeliverablePhases.id, id));
  }

  async replaceAllPmDeliverablePhases(
    projectId: number,
    phases: InsertPmDeliverablePhase[],
    deliverableUpdates?: Array<{ id: number; phaseName: string | null }>
  ): Promise<PmDeliverablePhase[]> {
    return await db.transaction(async (tx) => {
      if (deliverableUpdates?.length) {
        for (const upd of deliverableUpdates) {
          await tx.update(pmDeliverables).set({ phaseName: upd.phaseName }).where(eq(pmDeliverables.id, upd.id));
        }
      }
      await tx.delete(pmDeliverablePhases).where(eq(pmDeliverablePhases.projectId, projectId));
      const results: PmDeliverablePhase[] = [];
      for (const phase of phases) {
        const [result] = await tx.insert(pmDeliverablePhases).values({ ...phase, projectId }).returning();
        results.push(result);
      }
      const newNames = new Set(phases.map(p => p.name));
      const allDels = await tx.select().from(pmDeliverables).where(eq(pmDeliverables.projectId, projectId));
      for (const del of allDels) {
        if (del.phaseName && !newNames.has(del.phaseName)) {
          await tx.update(pmDeliverables).set({ phaseName: null }).where(eq(pmDeliverables.id, del.id));
        }
      }
      return results;
    });
  }

  // Projects Module - Deliverables
  async getPmDeliverables(projectId: number): Promise<PmDeliverable[]> {
    return await db.select().from(pmDeliverables).where(eq(pmDeliverables.projectId, projectId)).orderBy(pmDeliverables.createdAt);
  }

  async createPmDeliverable(item: InsertPmDeliverable): Promise<PmDeliverable> {
    const [result] = await db.insert(pmDeliverables).values(item).returning();
    return result;
  }

  async updatePmDeliverable(id: number, updates: Partial<InsertPmDeliverable>): Promise<PmDeliverable | undefined> {
    const [result] = await db.update(pmDeliverables).set({ ...updates, updatedAt: new Date() }).where(eq(pmDeliverables.id, id)).returning();
    return result;
  }

  async deletePmDeliverable(id: number): Promise<void> {
    await db.delete(pmDeliverables).where(eq(pmDeliverables.id, id));
  }

  // Projects Module - Business Requirements
  async getPmBusinessRequirements(projectId: number): Promise<PmBusinessRequirement[]> {
    return await db.select().from(pmBusinessRequirements).where(eq(pmBusinessRequirements.projectId, projectId)).orderBy(pmBusinessRequirements.code);
  }

  async getPmBusinessRequirement(id: number): Promise<PmBusinessRequirement | undefined> {
    const [result] = await db.select().from(pmBusinessRequirements).where(eq(pmBusinessRequirements.id, id));
    return result;
  }

  async createPmBusinessRequirement(item: InsertPmBusinessRequirement): Promise<PmBusinessRequirement> {
    // Generate code if not provided
    if (!item.code) {
      const existing = await db.select().from(pmBusinessRequirements).where(eq(pmBusinessRequirements.projectId, item.projectId));
      item.code = `BR-${String(existing.length + 1).padStart(3, '0')}`;
    }
    const [result] = await db.insert(pmBusinessRequirements).values(item).returning();
    return result;
  }

  async updatePmBusinessRequirement(id: number, updates: Partial<InsertPmBusinessRequirement>): Promise<PmBusinessRequirement | undefined> {
    const [result] = await db.update(pmBusinessRequirements).set({ ...updates, updatedAt: new Date() }).where(eq(pmBusinessRequirements.id, id)).returning();
    return result;
  }

  async deletePmBusinessRequirement(id: number): Promise<void> {
    await db.delete(pmBusinessRequirements).where(eq(pmBusinessRequirements.id, id));
  }

  // Projects Module - Phase Templates
  async getPmPhaseTemplates(tenantId?: number): Promise<PmPhaseTemplate[]> {
    if (tenantId) {
      return await db.select().from(pmPhaseTemplates).where(or(eq(pmPhaseTemplates.tenantId, tenantId), isNull(pmPhaseTemplates.tenantId))).orderBy(pmPhaseTemplates.name);
    }
    return await db.select().from(pmPhaseTemplates).where(isNull(pmPhaseTemplates.tenantId)).orderBy(pmPhaseTemplates.name);
  }

  async getPmPhaseTemplate(id: number): Promise<PmPhaseTemplate | undefined> {
    const [result] = await db.select().from(pmPhaseTemplates).where(eq(pmPhaseTemplates.id, id));
    return result;
  }

  async createPmPhaseTemplate(template: InsertPmPhaseTemplate): Promise<PmPhaseTemplate> {
    const [result] = await db.insert(pmPhaseTemplates).values(template).returning();
    return result;
  }

  async updatePmPhaseTemplate(id: number, updates: Partial<InsertPmPhaseTemplate>): Promise<PmPhaseTemplate | undefined> {
    const [result] = await db.update(pmPhaseTemplates).set(updates).where(eq(pmPhaseTemplates.id, id)).returning();
    return result;
  }

  async deletePmPhaseTemplate(id: number): Promise<void> {
    await db.delete(pmPhaseTemplates).where(eq(pmPhaseTemplates.id, id));
  }

  // Projects Module - Workstreams
  async getPmWorkstreams(projectId: number): Promise<PmWorkstream[]> {
    return await db.select().from(pmWorkstreams).where(eq(pmWorkstreams.projectId, projectId)).orderBy(pmWorkstreams.order);
  }

  async getPmWorkstream(id: number): Promise<PmWorkstream | undefined> {
    const [result] = await db.select().from(pmWorkstreams).where(eq(pmWorkstreams.id, id));
    return result;
  }

  async createPmWorkstream(workstream: InsertPmWorkstream): Promise<PmWorkstream> {
    const [result] = await db.insert(pmWorkstreams).values(workstream).returning();
    return result;
  }

  async updatePmWorkstream(id: number, updates: Partial<InsertPmWorkstream>): Promise<PmWorkstream | undefined> {
    const [result] = await db.update(pmWorkstreams).set({ ...updates, updatedAt: new Date() }).where(eq(pmWorkstreams.id, id)).returning();
    return result;
  }

  async deletePmWorkstream(id: number): Promise<void> {
    await db.delete(pmWorkstreams).where(eq(pmWorkstreams.id, id));
  }

  // Projects Module - Sprints
  async getPmSprints(projectId: number): Promise<PmSprint[]> {
    return await db.select().from(pmSprints).where(eq(pmSprints.projectId, projectId)).orderBy(pmSprints.sprintNumber);
  }

  async getPmSprint(id: number): Promise<PmSprint | undefined> {
    const [result] = await db.select().from(pmSprints).where(eq(pmSprints.id, id));
    return result;
  }

  async createPmSprint(sprint: InsertPmSprint): Promise<PmSprint> {
    const [result] = await db.insert(pmSprints).values(sprint).returning();
    return result;
  }

  async updatePmSprint(id: number, updates: Partial<InsertPmSprint>): Promise<PmSprint | undefined> {
    const [result] = await db.update(pmSprints).set({ ...updates, updatedAt: new Date() }).where(eq(pmSprints.id, id)).returning();
    return result;
  }

  async deletePmSprint(id: number): Promise<void> {
    await db.delete(pmSprints).where(eq(pmSprints.id, id));
  }

  // Projects Module - Backlog Items
  async getPmBacklogItems(projectId: number, sprintId?: number): Promise<PmBacklogItem[]> {
    if (sprintId) {
      return await db.select().from(pmBacklogItems).where(and(eq(pmBacklogItems.projectId, projectId), eq(pmBacklogItems.sprintId, sprintId))).orderBy(pmBacklogItems.sprintOrder);
    }
    return await db.select().from(pmBacklogItems).where(eq(pmBacklogItems.projectId, projectId)).orderBy(pmBacklogItems.backlogOrder);
  }

  async getPmBacklogItem(id: number): Promise<PmBacklogItem | undefined> {
    const [result] = await db.select().from(pmBacklogItems).where(eq(pmBacklogItems.id, id));
    return result;
  }

  async createPmBacklogItem(item: InsertPmBacklogItem): Promise<PmBacklogItem> {
    const [result] = await db.insert(pmBacklogItems).values(item).returning();
    return result;
  }

  async updatePmBacklogItem(id: number, updates: Partial<InsertPmBacklogItem>): Promise<PmBacklogItem | undefined> {
    const [result] = await db.update(pmBacklogItems).set({ ...updates, updatedAt: new Date() }).where(eq(pmBacklogItems.id, id)).returning();
    return result;
  }

  async deletePmBacklogItem(id: number): Promise<void> {
    await db.delete(pmBacklogItems).where(eq(pmBacklogItems.id, id));
  }

  // RACI Module - Roles
  async getPmRaciRoles(tenantId: number, projectId?: number): Promise<PmRaciRole[]> {
    if (projectId) {
      return await db.select().from(pmRaciRoles).where(and(eq(pmRaciRoles.tenantId, tenantId), eq(pmRaciRoles.projectId, projectId)));
    }
    return await db.select().from(pmRaciRoles).where(eq(pmRaciRoles.tenantId, tenantId));
  }

  async getPmRaciRole(id: number): Promise<PmRaciRole | undefined> {
    const [result] = await db.select().from(pmRaciRoles).where(eq(pmRaciRoles.id, id));
    return result;
  }

  async createPmRaciRole(role: InsertPmRaciRole): Promise<PmRaciRole> {
    // Auto-generate code from name if not provided
    const code = role.code || this.generateRoleCode(role.name);
    const [result] = await db.insert(pmRaciRoles).values({ ...role, code }).returning();
    return result;
  }

  private generateRoleCode(name: string): string {
    // Generate a code from name: uppercase, replace spaces with underscores, max 20 chars
    const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 15);
    const suffix = Date.now().toString(36).toUpperCase().substring(-5);
    return `${base}_${suffix}`;
  }

  async updatePmRaciRole(id: number, updates: Partial<InsertPmRaciRole>): Promise<PmRaciRole | undefined> {
    const [result] = await db.update(pmRaciRoles).set({ ...updates, updatedAt: new Date() }).where(eq(pmRaciRoles.id, id)).returning();
    return result;
  }

  async deletePmRaciRole(id: number): Promise<void> {
    await db.delete(pmRaciRoles).where(eq(pmRaciRoles.id, id));
  }

  // RACI Module - Activities
  async getPmRaciActivities(tenantId: number, projectId?: number): Promise<PmRaciActivity[]> {
    if (projectId) {
      return await db.select().from(pmRaciActivities).where(and(eq(pmRaciActivities.tenantId, tenantId), eq(pmRaciActivities.projectId, projectId)));
    }
    return await db.select().from(pmRaciActivities).where(eq(pmRaciActivities.tenantId, tenantId));
  }

  async getPmRaciActivity(id: number): Promise<PmRaciActivity | undefined> {
    const [result] = await db.select().from(pmRaciActivities).where(eq(pmRaciActivities.id, id));
    return result;
  }

  async createPmRaciActivity(activity: InsertPmRaciActivity): Promise<PmRaciActivity> {
    // Auto-generate code from name if not provided
    const code = activity.code || this.generateActivityCode(activity.name);
    const [result] = await db.insert(pmRaciActivities).values({ ...activity, code }).returning();
    return result;
  }

  private generateActivityCode(name: string): string {
    // Generate a code from name: uppercase, replace spaces with underscores, max 20 chars
    const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 15);
    const suffix = Date.now().toString(36).toUpperCase().substring(-5);
    return `ACT_${base}_${suffix}`;
  }

  async updatePmRaciActivity(id: number, updates: Partial<InsertPmRaciActivity>): Promise<PmRaciActivity | undefined> {
    const [result] = await db.update(pmRaciActivities).set({ ...updates, updatedAt: new Date() }).where(eq(pmRaciActivities.id, id)).returning();
    return result;
  }

  async deletePmRaciActivity(id: number): Promise<void> {
    await db.delete(pmRaciActivities).where(eq(pmRaciActivities.id, id));
  }

  // RACI Module - Types
  async getPmRaciTypes(tenantId: number): Promise<PmRaciType[]> {
    return await db.select().from(pmRaciTypes).where(eq(pmRaciTypes.tenantId, tenantId));
  }

  async getPmRaciType(id: number): Promise<PmRaciType | undefined> {
    const [result] = await db.select().from(pmRaciTypes).where(eq(pmRaciTypes.id, id));
    return result;
  }

  async createPmRaciType(type: InsertPmRaciType): Promise<PmRaciType> {
    const [result] = await db.insert(pmRaciTypes).values(type).returning();
    return result;
  }

  async updatePmRaciType(id: number, updates: Partial<InsertPmRaciType>): Promise<PmRaciType | undefined> {
    const [result] = await db.update(pmRaciTypes).set(updates).where(eq(pmRaciTypes.id, id)).returning();
    return result;
  }

  async deletePmRaciType(id: number): Promise<void> {
    await db.delete(pmRaciTypes).where(eq(pmRaciTypes.id, id));
  }

  // RACI Module - Assignments
  async getPmRaciAssignments(tenantId: number, projectId?: number): Promise<PmRaciAssignment[]> {
    if (projectId) {
      return await db.select().from(pmRaciAssignments).where(and(eq(pmRaciAssignments.tenantId, tenantId), eq(pmRaciAssignments.projectId, projectId)));
    }
    return await db.select().from(pmRaciAssignments).where(eq(pmRaciAssignments.tenantId, tenantId));
  }

  async getPmRaciAssignment(id: number): Promise<PmRaciAssignment | undefined> {
    const [result] = await db.select().from(pmRaciAssignments).where(eq(pmRaciAssignments.id, id));
    return result;
  }

  async createPmRaciAssignment(assignment: InsertPmRaciAssignment): Promise<PmRaciAssignment> {
    const [result] = await db.insert(pmRaciAssignments).values(assignment).returning();
    return result;
  }

  async updatePmRaciAssignment(id: number, updates: Partial<InsertPmRaciAssignment>): Promise<PmRaciAssignment | undefined> {
    const [result] = await db.update(pmRaciAssignments).set({ ...updates, updatedAt: new Date() }).where(eq(pmRaciAssignments.id, id)).returning();
    return result;
  }

  async deletePmRaciAssignment(id: number): Promise<void> {
    await db.delete(pmRaciAssignments).where(eq(pmRaciAssignments.id, id));
  }

  // RACI Module - Templates
  async getPmRaciTemplates(tenantId: number): Promise<PmRaciTemplate[]> {
    return await db.select().from(pmRaciTemplates).where(eq(pmRaciTemplates.tenantId, tenantId));
  }

  async getPmRaciTemplate(id: number): Promise<PmRaciTemplate | undefined> {
    const [result] = await db.select().from(pmRaciTemplates).where(eq(pmRaciTemplates.id, id));
    return result;
  }

  async createPmRaciTemplate(template: InsertPmRaciTemplate): Promise<PmRaciTemplate> {
    const [result] = await db.insert(pmRaciTemplates).values(template).returning();
    return result;
  }

  async updatePmRaciTemplate(id: number, updates: Partial<InsertPmRaciTemplate>): Promise<PmRaciTemplate | undefined> {
    const [result] = await db.update(pmRaciTemplates).set({ ...updates, updatedAt: new Date() }).where(eq(pmRaciTemplates.id, id)).returning();
    return result;
  }

  async deletePmRaciTemplate(id: number): Promise<void> {
    await db.delete(pmRaciTemplates).where(eq(pmRaciTemplates.id, id));
  }

  // === Agile Board ===

  async getPmAgileWorkstreams(projectId: number): Promise<PmAgileWorkstream[]> {
    return await db.select().from(pmAgileWorkstreams).where(eq(pmAgileWorkstreams.projectId, projectId)).orderBy(pmAgileWorkstreams.sortOrder);
  }

  async createPmAgileWorkstream(data: InsertPmAgileWorkstream): Promise<PmAgileWorkstream> {
    const [result] = await db.insert(pmAgileWorkstreams).values(data).returning();
    return result;
  }

  async updatePmAgileWorkstream(id: number, updates: Partial<InsertPmAgileWorkstream>): Promise<PmAgileWorkstream | undefined> {
    const [result] = await db.update(pmAgileWorkstreams).set({ ...updates, updatedAt: new Date() }).where(eq(pmAgileWorkstreams.id, id)).returning();
    return result;
  }

  async deletePmAgileWorkstream(id: number): Promise<void> {
    await db.delete(pmAgileWorkstreams).where(eq(pmAgileWorkstreams.id, id));
  }

  async getPmAgileWorkstreamsById(id: number): Promise<PmAgileWorkstream | undefined> {
    const [result] = await db.select().from(pmAgileWorkstreams).where(eq(pmAgileWorkstreams.id, id));
    return result;
  }

  async getPmEpicById(id: number): Promise<PmEpic | undefined> {
    const [result] = await db.select().from(pmEpics).where(eq(pmEpics.id, id));
    return result;
  }

  async getPmAgileSprintById(id: number): Promise<PmAgileSprint | undefined> {
    const [result] = await db.select().from(pmAgileSprints).where(eq(pmAgileSprints.id, id));
    return result;
  }

  async getPmAgileStoryById(id: number): Promise<PmAgileStory | undefined> {
    const [result] = await db.select().from(pmAgileStories).where(eq(pmAgileStories.id, id));
    return result;
  }

  async getPmProjectToolById(id: number): Promise<PmProjectTool | undefined> {
    const [result] = await db.select().from(pmProjectTools).where(eq(pmProjectTools.id, id));
    return result;
  }

  async getPmPortfolioClientId(portfolioId: number): Promise<number | null | undefined> {
    const rows = await db
      .select({ clientId: pmProjects.clientId })
      .from(pmProjects)
      .where(eq(pmProjects.portfolioId, portfolioId));
    const ids = [...new Set(rows.map((r) => r.clientId).filter((id): id is number => id != null))];
    if (ids.length === 0) return null;
    if (ids.length === 1) return ids[0];
    return null;
  }

  async getPmProgramClientId(programId: number): Promise<number | null | undefined> {
    const rows = await db
      .select({ clientId: pmProjects.clientId })
      .from(pmProjects)
      .where(eq(pmProjects.programId, programId));
    const ids = [...new Set(rows.map((r) => r.clientId).filter((id): id is number => id != null))];
    if (ids.length === 0) return null;
    if (ids.length === 1) return ids[0];
    return null;
  }

  async getCrmLeadClientId(leadId: number): Promise<number | null | undefined> {
    const lead = await this.getCrmLead(leadId);
    if (!lead?.convertedAccountId) return null;
    const account = await this.getCrmAccount(lead.convertedAccountId);
    return account?.clientId;
  }

  async getPmEpics(agileWorkstreamId: number): Promise<PmEpic[]> {
    return await db.select().from(pmEpics).where(eq(pmEpics.agileWorkstreamId, agileWorkstreamId)).orderBy(pmEpics.createdAt);
  }

  async createPmEpic(data: InsertPmEpic): Promise<PmEpic> {
    const [result] = await db.insert(pmEpics).values(data).returning();
    return result;
  }

  async updatePmEpic(id: number, updates: Partial<InsertPmEpic>): Promise<PmEpic | undefined> {
    const [result] = await db.update(pmEpics).set({ ...updates, updatedAt: new Date() }).where(eq(pmEpics.id, id)).returning();
    return result;
  }

  async deletePmEpic(id: number): Promise<void> {
    await db.delete(pmEpics).where(eq(pmEpics.id, id));
  }

  async getPmAgileSprints(agileWorkstreamId: number): Promise<PmAgileSprint[]> {
    return await db.select().from(pmAgileSprints).where(eq(pmAgileSprints.agileWorkstreamId, agileWorkstreamId)).orderBy(pmAgileSprints.createdAt);
  }

  async createPmAgileSprint(data: InsertPmAgileSprint): Promise<PmAgileSprint> {
    const [result] = await db.insert(pmAgileSprints).values(data).returning();
    return result;
  }

  async updatePmAgileSprint(id: number, updates: Partial<InsertPmAgileSprint>): Promise<PmAgileSprint | undefined> {
    const [result] = await db.update(pmAgileSprints).set({ ...updates, updatedAt: new Date() }).where(eq(pmAgileSprints.id, id)).returning();
    return result;
  }

  async deletePmAgileSprint(id: number): Promise<void> {
    await db.delete(pmAgileSprints).where(eq(pmAgileSprints.id, id));
  }

  async getPmAgileStories(agileWorkstreamId: number): Promise<PmAgileStory[]> {
    return await db.select().from(pmAgileStories).where(eq(pmAgileStories.agileWorkstreamId, agileWorkstreamId)).orderBy(pmAgileStories.createdAt);
  }

  async createPmAgileStory(data: InsertPmAgileStory): Promise<PmAgileStory> {
    const [result] = await db.insert(pmAgileStories).values(data).returning();
    return result;
  }

  async updatePmAgileStory(id: number, updates: Partial<InsertPmAgileStory>): Promise<PmAgileStory | undefined> {
    const [result] = await db.update(pmAgileStories).set({ ...updates, updatedAt: new Date() }).where(eq(pmAgileStories.id, id)).returning();
    return result;
  }

  async deletePmAgileStory(id: number): Promise<void> {
    await db.delete(pmAgileStories).where(eq(pmAgileStories.id, id));
  }

  async getPmAgileDefects(agileWorkstreamId: number): Promise<PmAgileDefect[]> {
    return await db.select().from(pmAgileDefects).where(eq(pmAgileDefects.agileWorkstreamId, agileWorkstreamId)).orderBy(pmAgileDefects.createdAt);
  }

  async createPmAgileDefect(data: InsertPmAgileDefect): Promise<PmAgileDefect> {
    const [result] = await db.insert(pmAgileDefects).values(data).returning();
    return result;
  }

  async updatePmAgileDefect(id: number, updates: Partial<InsertPmAgileDefect>): Promise<PmAgileDefect | undefined> {
    const [result] = await db.update(pmAgileDefects).set({ ...updates, updatedAt: new Date() }).where(eq(pmAgileDefects.id, id)).returning();
    return result;
  }

  async deletePmAgileDefect(id: number): Promise<void> {
    await db.delete(pmAgileDefects).where(eq(pmAgileDefects.id, id));
  }

  async getPmAgileDashboard(projectId: number) {
    const workstreams = await this.getPmAgileWorkstreams(projectId);
    let totalPoints = 0;
    let donePoints = 0;
    let openDefects = 0;
    let activeEpics = 0;
    let storyCount = 0;
    const assignees = new Set<string>();
    const wsSummaries: {
      id: number; name: string; color: string; sprintName: string; sprintProgress: number;
      velocity: number; storyPoints: { done: number; total: number };
      defects: { open: number; closed: number }; epics: number; stories: number; team: number; health: string;
      velocityChart: { sprint: string; planned: number; delivered: number }[];
      burndownChart: { day: string; ideal: number; actual: number | null }[];
      epicItems: { id: string; title: string; ws: string; color: string; progress: number; stories: number; done: number; status: string }[];
    }[] = [];
    const velocityData: { sprint: string; planned: number; delivered: number }[] = [];
    const epicProgress: { id: string; title: string; ws: string; color: string; progress: number; stories: number; done: number; status: string }[] = [];
    const recentActivity: { time: string; user: string; action: string; ws: string; color: string }[] = [];
    const risks: { id: string; title: string; severity: string; ws: string; color: string }[] = [];
    let burndownData: { day: string; ideal: number; actual: number | null }[] = [];

    for (const ws of workstreams) {
      const epics = await this.getPmEpics(ws.id);
      const stories = await this.getPmAgileStories(ws.id);
      const sprints = await this.getPmAgileSprints(ws.id);
      const defects = await this.getPmAgileDefects(ws.id);

      const wsTotal = stories.reduce((a, s) => a + (s.points || 0), 0);
      const wsDone = stories.filter((s) => s.status === "Done").reduce((a, s) => a + (s.points || 0), 0);
      totalPoints += wsTotal;
      donePoints += wsDone;
      storyCount += stories.length;
      activeEpics += epics.filter((e) => (e.status || "").toLowerCase() === "active").length;
      openDefects += defects.filter((d) => !["Fixed", "Verified", "Closed"].includes(d.status || "")).length;

      stories.forEach((s) => { if (s.assignee) assignees.add(s.assignee); });

      const activeSprint = sprints.find((s) => (s.status || "").toLowerCase() === "active")
        || sprints.find((s) => (s.status || "").toLowerCase() === "planned");
      const sprintProgress = activeSprint?.totalPoints
        ? Math.round(((activeSprint.donePoints || 0) / activeSprint.totalPoints) * 100)
        : wsTotal ? Math.round((wsDone / wsTotal) * 100) : 0;

      const closedSprints = sprints.filter((s) => (s.status || "").toLowerCase() === "closed");
      const velocity = closedSprints.length
        ? Math.round(closedSprints.reduce((a, s) => a + (s.donePoints || 0), 0) / closedSprints.length)
        : 0;

      const openDef = defects.filter((d) => !["Fixed", "Verified", "Closed"].includes(d.status || "")).length;
      const closedDef = defects.length - openDef;
      let health = "green";
      if (openDef >= 3 || sprintProgress < 40) health = "red";
      else if (openDef >= 1 || sprintProgress < 65) health = "amber";

      wsSummaries.push({
        id: ws.id,
        name: ws.name,
        color: ws.color || "#2563EB",
        sprintName: activeSprint?.name || "—",
        sprintProgress,
        velocity,
        storyPoints: { done: wsDone, total: wsTotal },
        defects: { open: openDef, closed: closedDef },
        epics: epics.length,
        stories: stories.length,
        team: new Set(stories.map((s) => s.assignee).filter(Boolean)).size,
        health,
        velocityChart: [] as { sprint: string; planned: number; delivered: number }[],
        burndownChart: [] as { day: string; ideal: number; actual: number | null }[],
        epicItems: [] as { id: string; title: string; ws: string; color: string; progress: number; stories: number; done: number; status: string }[],
      });
      const wsSummary = wsSummaries[wsSummaries.length - 1];

      const wsVelocityChart: { sprint: string; planned: number; delivered: number }[] = [];
      for (const sp of sprints.slice(-4)) {
        const entry = {
          sprint: sp.name.replace("Sprint ", "S"),
          planned: sp.totalPoints || 0,
          delivered: sp.donePoints || 0,
        };
        velocityData.push(entry);
        wsVelocityChart.push(entry);
      }

      const wsEpicItems: { id: string; title: string; ws: string; color: string; progress: number; stories: number; done: number; status: string }[] = [];
      for (const e of epics) {
        const eStories = stories.filter((s) => s.epicId === e.id);
        const done = eStories.filter((s) => s.status === "Done").length;
        const progress = eStories.length ? Math.round((done / eStories.length) * 100) : (e.progress || 0);
        const item = {
          id: String(e.id),
          title: e.title,
          ws: ws.name,
          color: e.color || ws.color || "#2563EB",
          progress,
          stories: eStories.length,
          done,
          status: e.status || "planning",
        };
        epicProgress.push(item);
        wsEpicItems.push(item);
        if (progress < 30 && (e.status || "").toLowerCase() === "active") {
          risks.push({
            id: `R-${e.id}`,
            title: `${e.title} behind schedule (${progress}%)`,
            severity: progress < 15 ? "High" : "Medium",
            ws: ws.name,
            color: ws.color || "#2563EB",
          });
        }
      }

      if (activeSprint) {
        const total = activeSprint.totalPoints || wsTotal || 1;
        const remaining = Math.max(0, total - (activeSprint.donePoints || wsDone));
        const wsBurndown: { day: string; ideal: number; actual: number | null }[] = [];
        for (let i = 0; i < 14; i++) {
          wsBurndown.push({
            day: `D${i + 1}`,
            ideal: Math.round((total - (total / 13) * i) * 10) / 10,
            actual: i <= 8 ? Math.round(total - ((total - remaining) / 8) * i) : (i === 9 ? remaining : null),
          });
        }
        wsSummary.burndownChart = wsBurndown;
        if (burndownData.length === 0) burndownData = wsBurndown;
      }
      wsSummary.velocityChart = wsVelocityChart;
      wsSummary.epicItems = wsEpicItems;

      const sortedStories = [...stories].sort((a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime(),
      );
      for (const s of sortedStories.slice(0, 3)) {
        recentActivity.push({
          time: "Recently",
          user: s.assignee || s.creator || "Team",
          action: `${s.id}: ${s.status} — ${s.title.slice(0, 50)}`,
          ws: ws.name,
          color: ws.color || "#2563EB",
        });
      }
    }

    const sprintCompletion = totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0;
    const avgVelocity = velocityData.length
      ? Math.round(velocityData.reduce((a, v) => a + v.delivered, 0) / velocityData.length)
      : 0;

    return {
      kpis: [
        { label: "Total Story Points", value: String(totalPoints), change: `${storyCount} stories`, trend: "neutral", color: "#2563EB" },
        { label: "Velocity (avg)", value: String(avgVelocity), change: "Last sprints", trend: avgVelocity > 0 ? "up" : "neutral", color: "#0EA5E9" },
        { label: "Open Defects", value: String(openDefects), change: openDefects > 0 ? "Needs attention" : "Clear", trend: openDefects > 0 ? "down" : "up", color: "#DC2626" },
        { label: "Sprint Completion", value: `${sprintCompletion}%`, change: sprintCompletion >= 50 ? "On track" : "At risk", trend: sprintCompletion >= 50 ? "up" : "down", color: "#16A34A" },
        { label: "Team Members", value: String(assignees.size), change: `${workstreams.length} workstreams`, trend: "neutral", color: "#7C3AED" },
        { label: "Active Epics", value: String(activeEpics), change: `${epicProgress.filter((e) => e.progress < 40).length} at risk`, trend: "neutral", color: "#D97706" },
      ],
      workstreams: wsSummaries,
      velocityData: velocityData.slice(-4),
      burndownData,
      epicProgress,
      recentActivity: recentActivity.slice(0, 8),
      risks: risks.slice(0, 5),
    };
  }

  // === Resource Management ===

  async getResources(tenantId: number): Promise<Resource[]> {
    return await db.select().from(resources).where(eq(resources.tenantId, tenantId)).orderBy(resources.firstName);
  }

  async getResource(id: number): Promise<Resource | undefined> {
    const [result] = await db.select().from(resources).where(eq(resources.id, id));
    return result;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [result] = await db.insert(resources).values(resource).returning();
    return result;
  }

  async updateResource(id: number, updates: Partial<InsertResource>): Promise<Resource | undefined> {
    const [result] = await db.update(resources).set({ ...updates, updatedAt: new Date() }).where(eq(resources.id, id)).returning();
    return result;
  }

  async deleteResource(id: number): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  }

  // Skill Categories
  async getSkillCategories(tenantId: number): Promise<SkillCategory[]> {
    return await db.select().from(skillCategories).where(eq(skillCategories.tenantId, tenantId)).orderBy(skillCategories.order);
  }

  async createSkillCategory(category: InsertSkillCategory): Promise<SkillCategory> {
    const [result] = await db.insert(skillCategories).values(category).returning();
    return result;
  }

  async updateSkillCategory(id: number, updates: Partial<InsertSkillCategory>): Promise<SkillCategory | undefined> {
    const [result] = await db.update(skillCategories).set(updates).where(eq(skillCategories.id, id)).returning();
    return result;
  }

  async deleteSkillCategory(id: number): Promise<void> {
    await db.delete(skillCategories).where(eq(skillCategories.id, id));
  }

  // Skills
  async getSkills(tenantId: number): Promise<Skill[]> {
    return await db.select().from(skills).where(eq(skills.tenantId, tenantId)).orderBy(skills.name);
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    const [result] = await db.insert(skills).values(skill).returning();
    return result;
  }

  async updateSkill(id: number, updates: Partial<InsertSkill>): Promise<Skill | undefined> {
    const [result] = await db.update(skills).set(updates).where(eq(skills.id, id)).returning();
    return result;
  }

  async deleteSkill(id: number): Promise<void> {
    await db.delete(skills).where(eq(skills.id, id));
  }

  // Resource Skills
  async getResourceSkills(resourceId: number): Promise<ResourceSkill[]> {
    return await db.select().from(resourceSkills).where(eq(resourceSkills.resourceId, resourceId));
  }

  async addResourceSkill(resourceSkill: InsertResourceSkill): Promise<ResourceSkill> {
    const [result] = await db.insert(resourceSkills).values(resourceSkill).returning();
    return result;
  }

  async updateResourceSkill(id: number, updates: Partial<InsertResourceSkill>): Promise<ResourceSkill | undefined> {
    const [result] = await db.update(resourceSkills).set(updates).where(eq(resourceSkills.id, id)).returning();
    return result;
  }

  async removeResourceSkill(id: number): Promise<void> {
    await db.delete(resourceSkills).where(eq(resourceSkills.id, id));
  }

  // Resource Allocations
  async getAllocations(tenantId: number, projectId?: number): Promise<(ResourceAllocation & { resourceName?: string | null })[]> {
    const conditions = [eq(resourceAllocations.tenantId, tenantId)];
    if (projectId) conditions.push(eq(resourceAllocations.projectId, projectId));
    return await db
      .select({
        id: resourceAllocations.id,
        tenantId: resourceAllocations.tenantId,
        resourceId: resourceAllocations.resourceId,
        projectId: resourceAllocations.projectId,
        projectName: resourceAllocations.projectName,
        allocationType: resourceAllocations.allocationType,
        allocationPercentage: resourceAllocations.allocationPercentage,
        daysPerWeek: resourceAllocations.daysPerWeek,
        hoursPerWeek: resourceAllocations.hoursPerWeek,
        role: resourceAllocations.role,
        startDate: resourceAllocations.startDate,
        endDate: resourceAllocations.endDate,
        notes: resourceAllocations.notes,
        status: resourceAllocations.status,
        createdAt: resourceAllocations.createdAt,
        updatedAt: resourceAllocations.updatedAt,
        resourceName: sql<string | null>`${resources.firstName} || ' ' || ${resources.lastName}`,
      })
      .from(resourceAllocations)
      .leftJoin(resources, eq(resourceAllocations.resourceId, resources.id))
      .where(and(...conditions));
  }

  async getAllocation(id: number): Promise<ResourceAllocation | undefined> {
    const [result] = await db.select().from(resourceAllocations).where(eq(resourceAllocations.id, id));
    return result;
  }

  async createAllocation(allocation: InsertResourceAllocation): Promise<ResourceAllocation> {
    const [result] = await db.insert(resourceAllocations).values(allocation).returning();
    return result;
  }

  async updateAllocation(id: number, updates: Partial<InsertResourceAllocation>): Promise<ResourceAllocation | undefined> {
    const [result] = await db.update(resourceAllocations).set({ ...updates, updatedAt: new Date() }).where(eq(resourceAllocations.id, id)).returning();
    return result;
  }

  async deleteAllocation(id: number): Promise<void> {
    await db.delete(resourceAllocations).where(eq(resourceAllocations.id, id));
  }

  async getTimesheetEntriesByProject(tenantId: number, projectId: number) {
    const rows = await db
      .select({
        id: timesheetEntries.id,
        entryDate: timesheetEntries.entryDate,
        hours: timesheetEntries.hours,
        description: timesheetEntries.description,
        personName: sql<string | null>`${resources.firstName} || ' ' || ${resources.lastName}`,
        status: timesheetPeriods.status,
      })
      .from(timesheetEntries)
      .innerJoin(timesheetPeriods, eq(timesheetEntries.timesheetPeriodId, timesheetPeriods.id))
      .innerJoin(resources, eq(timesheetEntries.resourceId, resources.id))
      .where(and(
        eq(timesheetPeriods.tenantId, tenantId),
        eq(timesheetEntries.projectId, projectId),
      ))
      .orderBy(desc(timesheetEntries.entryDate));
    return rows;
  }

  async getDocumentsForProject(tenantId: number, projectId: number, linkedIds: number[] = []) {
    const metaMatch = sql`(${documents.metadata}->>'projectId')::int = ${projectId}`;
    const idMatch = linkedIds.length > 0 ? inArray(documents.id, linkedIds) : undefined;
    const projectFilter = idMatch ? or(metaMatch, idMatch) : metaMatch;

    return await db.select({
      id: documents.id,
      tenantId: documents.tenantId,
      clientId: documents.clientId,
      folderId: documents.folderId,
      title: documents.title,
      description: documents.description,
      content: documents.content,
      type: documents.type,
      status: documents.status,
      ownerId: documents.ownerId,
      currentVersion: documents.currentVersion,
      isFavorite: documents.isFavorite,
      isPinned: documents.isPinned,
      viewCount: documents.viewCount,
      lastViewedAt: documents.lastViewedAt,
      metadata: documents.metadata,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      ownerName: sql<string | null>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email}, ${documents.ownerId})`,
    })
      .from(documents)
      .leftJoin(users, eq(documents.ownerId, users.id))
      .where(and(eq(documents.tenantId, tenantId), projectFilter))
      .orderBy(desc(documents.updatedAt));
  }

  // Timesheet Periods
  async getTimesheetPeriods(tenantId: number, resourceId?: number): Promise<TimesheetPeriod[]> {
    if (resourceId) {
      return await db.select().from(timesheetPeriods).where(and(eq(timesheetPeriods.tenantId, tenantId), eq(timesheetPeriods.resourceId, resourceId))).orderBy(desc(timesheetPeriods.weekStartDate));
    }
    return await db.select().from(timesheetPeriods).where(eq(timesheetPeriods.tenantId, tenantId)).orderBy(desc(timesheetPeriods.weekStartDate));
  }

  async getTimesheetPeriod(id: number): Promise<TimesheetPeriod | undefined> {
    const [result] = await db.select().from(timesheetPeriods).where(eq(timesheetPeriods.id, id));
    return result;
  }

  async createTimesheetPeriod(period: InsertTimesheetPeriod): Promise<TimesheetPeriod> {
    const [result] = await db.insert(timesheetPeriods).values(period).returning();
    return result;
  }

  async updateTimesheetPeriod(id: number, updates: Partial<InsertTimesheetPeriod>): Promise<TimesheetPeriod | undefined> {
    const [result] = await db.update(timesheetPeriods).set({ ...updates, updatedAt: new Date() }).where(eq(timesheetPeriods.id, id)).returning();
    return result;
  }

  // Timesheet Entries
  async getTimesheetEntries(periodId: number): Promise<TimesheetEntry[]> {
    return await db.select().from(timesheetEntries).where(eq(timesheetEntries.timesheetPeriodId, periodId));
  }

  async createTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry> {
    const [result] = await db.insert(timesheetEntries).values(entry).returning();
    return result;
  }

  async updateTimesheetEntry(id: number, updates: Partial<InsertTimesheetEntry>): Promise<TimesheetEntry | undefined> {
    const [result] = await db.update(timesheetEntries).set({ ...updates, updatedAt: new Date() }).where(eq(timesheetEntries.id, id)).returning();
    return result;
  }

  async deleteTimesheetEntry(id: number): Promise<void> {
    await db.delete(timesheetEntries).where(eq(timesheetEntries.id, id));
  }

  // Project Codes
  async getProjectCodes(tenantId: number): Promise<ProjectCode[]> {
    return await db.select().from(projectCodes).where(eq(projectCodes.tenantId, tenantId)).orderBy(projectCodes.code);
  }

  async createProjectCode(code: InsertProjectCode): Promise<ProjectCode> {
    const [result] = await db.insert(projectCodes).values(code).returning();
    return result;
  }

  async updateProjectCode(id: number, updates: Partial<InsertProjectCode>): Promise<ProjectCode | undefined> {
    const [result] = await db.update(projectCodes).set(updates).where(eq(projectCodes.id, id)).returning();
    return result;
  }

  async deleteProjectCode(id: number): Promise<void> {
    await db.delete(projectCodes).where(eq(projectCodes.id, id));
  }

  // BPM - Diagrams
  async getBpmDiagrams(tenantId: number): Promise<BpmDiagram[]> {
    return await db.select().from(bpmDiagrams).where(eq(bpmDiagrams.tenantId, tenantId)).orderBy(desc(bpmDiagrams.updatedAt));
  }

  async getBpmDiagram(id: number): Promise<BpmDiagram | undefined> {
    const [result] = await db.select().from(bpmDiagrams).where(eq(bpmDiagrams.id, id));
    return result;
  }

  async createBpmDiagram(diagram: InsertBpmDiagram): Promise<BpmDiagram> {
    const [result] = await db.insert(bpmDiagrams).values(diagram).returning();
    return result;
  }

  async updateBpmDiagram(id: number, updates: Partial<InsertBpmDiagram>): Promise<BpmDiagram | undefined> {
    const [result] = await db.update(bpmDiagrams).set({ ...updates, updatedAt: new Date() }).where(eq(bpmDiagrams.id, id)).returning();
    return result;
  }

  async deleteBpmDiagram(id: number): Promise<void> {
    await db.delete(bpmDiagrams).where(eq(bpmDiagrams.id, id));
  }

  // BPM - Nodes
  async getBpmNodes(diagramId: number): Promise<BpmNode[]> {
    return await db.select().from(bpmNodes).where(eq(bpmNodes.diagramId, diagramId));
  }

  async createBpmNode(node: InsertBpmNode): Promise<BpmNode> {
    const [result] = await db.insert(bpmNodes).values(node).returning();
    return result;
  }

  async updateBpmNode(id: number, updates: Partial<InsertBpmNode>): Promise<BpmNode | undefined> {
    const [result] = await db.update(bpmNodes).set(updates).where(eq(bpmNodes.id, id)).returning();
    return result;
  }

  async deleteBpmNode(id: number): Promise<void> {
    await db.delete(bpmNodes).where(eq(bpmNodes.id, id));
  }

  async deleteBpmNodesByDiagram(diagramId: number): Promise<void> {
    await db.delete(bpmNodes).where(eq(bpmNodes.diagramId, diagramId));
  }

  // BPM - Edges
  async getBpmEdges(diagramId: number): Promise<BpmEdge[]> {
    return await db.select().from(bpmEdges).where(eq(bpmEdges.diagramId, diagramId));
  }

  async createBpmEdge(edge: InsertBpmEdge): Promise<BpmEdge> {
    const [result] = await db.insert(bpmEdges).values(edge).returning();
    return result;
  }

  async updateBpmEdge(id: number, updates: Partial<InsertBpmEdge>): Promise<BpmEdge | undefined> {
    const [result] = await db.update(bpmEdges).set(updates).where(eq(bpmEdges.id, id)).returning();
    return result;
  }

  async deleteBpmEdge(id: number): Promise<void> {
    await db.delete(bpmEdges).where(eq(bpmEdges.id, id));
  }

  async deleteBpmEdgesByDiagram(diagramId: number): Promise<void> {
    await db.delete(bpmEdges).where(eq(bpmEdges.diagramId, diagramId));
  }

  // BPM - Swimlanes
  async getBpmSwimlanes(diagramId: number): Promise<BpmSwimlane[]> {
    return await db.select().from(bpmSwimlanes).where(eq(bpmSwimlanes.diagramId, diagramId)).orderBy(bpmSwimlanes.order);
  }

  async createBpmSwimlane(swimlane: InsertBpmSwimlane): Promise<BpmSwimlane> {
    const [result] = await db.insert(bpmSwimlanes).values(swimlane).returning();
    return result;
  }

  async updateBpmSwimlane(id: number, updates: Partial<InsertBpmSwimlane>): Promise<BpmSwimlane | undefined> {
    const [result] = await db.update(bpmSwimlanes).set(updates).where(eq(bpmSwimlanes.id, id)).returning();
    return result;
  }

  async deleteBpmSwimlane(id: number): Promise<void> {
    await db.delete(bpmSwimlanes).where(eq(bpmSwimlanes.id, id));
  }

  // BPM - Libraries
  async getBpmLibraries(tenantId: number): Promise<BpmLibrary[]> {
    return await db.select().from(bpmLibraries).where(eq(bpmLibraries.tenantId, tenantId));
  }

  async getBpmLibrary(id: number): Promise<BpmLibrary | undefined> {
    const [result] = await db.select().from(bpmLibraries).where(eq(bpmLibraries.id, id));
    return result;
  }

  async createBpmLibrary(library: InsertBpmLibrary): Promise<BpmLibrary> {
    const [result] = await db.insert(bpmLibraries).values(library).returning();
    return result;
  }

  async updateBpmLibrary(id: number, updates: Partial<InsertBpmLibrary>): Promise<BpmLibrary | undefined> {
    const [result] = await db.update(bpmLibraries).set(updates).where(eq(bpmLibraries.id, id)).returning();
    return result;
  }

  async deleteBpmLibrary(id: number): Promise<void> {
    await db.delete(bpmLibraries).where(eq(bpmLibraries.id, id));
  }

  // BPM - Templates
  async getBpmTemplates(): Promise<BpmTemplate[]> {
    return await db.select().from(bpmTemplates);
  }

  async getBpmTemplatesByLibrary(libraryId: number): Promise<BpmTemplate[]> {
    return await db.select().from(bpmTemplates).where(eq(bpmTemplates.libraryId, libraryId));
  }

  async getBpmTemplate(id: number): Promise<BpmTemplate | undefined> {
    const [result] = await db.select().from(bpmTemplates).where(eq(bpmTemplates.id, id));
    return result;
  }

  async createBpmTemplate(template: InsertBpmTemplate): Promise<BpmTemplate> {
    const [result] = await db.insert(bpmTemplates).values(template).returning();
    return result;
  }

  // BPM - Attachments
  async getBpmAttachments(diagramId: number, nodeId?: number): Promise<BpmAttachment[]> {
    if (nodeId !== undefined) {
      return await db.select().from(bpmAttachments).where(and(eq(bpmAttachments.diagramId, diagramId), eq(bpmAttachments.nodeId, nodeId)));
    }
    return await db.select().from(bpmAttachments).where(eq(bpmAttachments.diagramId, diagramId));
  }

  async createBpmAttachment(attachment: InsertBpmAttachment): Promise<BpmAttachment> {
    const [result] = await db.insert(bpmAttachments).values(attachment).returning();
    return result;
  }

  async deleteBpmAttachment(id: number): Promise<void> {
    await db.delete(bpmAttachments).where(eq(bpmAttachments.id, id));
  }

  async getFrameworks(tenantId: number): Promise<Framework[]> {
    return await db.select().from(frameworks).where(eq(frameworks.tenantId, tenantId)).orderBy(desc(frameworks.updatedAt));
  }

  async getFramework(id: number): Promise<Framework | undefined> {
    const [result] = await db.select().from(frameworks).where(eq(frameworks.id, id));
    return result;
  }

  async createFramework(framework: InsertFramework): Promise<Framework> {
    const [result] = await db.insert(frameworks).values(framework).returning();
    return result;
  }

  async updateFramework(id: number, updates: Partial<InsertFramework>): Promise<Framework | undefined> {
    const [result] = await db.update(frameworks).set({ ...updates, updatedAt: new Date() }).where(eq(frameworks.id, id)).returning();
    return result;
  }

  async deleteFramework(id: number): Promise<void> {
    await db.delete(frameworks).where(eq(frameworks.id, id));
  }

  // BPML Templates
  async getBpmlTemplates(tenantId: number): Promise<BpmlTemplate[]> {
    return await db.select().from(bpmlTemplates).where(eq(bpmlTemplates.tenantId, tenantId)).orderBy(desc(bpmlTemplates.updatedAt));
  }

  async getBpmlTemplate(id: number): Promise<BpmlTemplate | undefined> {
    const [result] = await db.select().from(bpmlTemplates).where(eq(bpmlTemplates.id, id));
    return result;
  }

  async createBpmlTemplate(template: InsertBpmlTemplate): Promise<BpmlTemplate> {
    const [result] = await db.insert(bpmlTemplates).values(template).returning();
    return result;
  }

  async updateBpmlTemplate(id: number, updates: Partial<InsertBpmlTemplate>): Promise<BpmlTemplate | undefined> {
    const [result] = await db.update(bpmlTemplates).set({ ...updates, updatedAt: new Date() }).where(eq(bpmlTemplates.id, id)).returning();
    return result;
  }

  async deleteBpmlTemplate(id: number): Promise<void> {
    await db.delete(bpmlTemplates).where(eq(bpmlTemplates.id, id));
  }

  // BPML Entries
  async getBpmlEntries(templateId: number, tenantId: number): Promise<BpmlEntry[]> {
    return await db.select().from(bpmlEntries)
      .where(and(eq(bpmlEntries.templateId, templateId), eq(bpmlEntries.tenantId, tenantId)))
      .orderBy(bpmlEntries.sequenceOrder);
  }

  async getBpmlEntry(id: number): Promise<BpmlEntry | undefined> {
    const [result] = await db.select().from(bpmlEntries).where(eq(bpmlEntries.id, id));
    return result;
  }

  async createBpmlEntry(entry: InsertBpmlEntry): Promise<BpmlEntry> {
    const [result] = await db.insert(bpmlEntries).values(entry).returning();
    return result;
  }

  async createBpmlEntries(entries: InsertBpmlEntry[]): Promise<BpmlEntry[]> {
    if (entries.length === 0) return [];
    return await db.insert(bpmlEntries).values(entries).returning();
  }

  async updateBpmlEntry(id: number, updates: Partial<InsertBpmlEntry>): Promise<BpmlEntry | undefined> {
    const [result] = await db.update(bpmlEntries).set({ ...updates, updatedAt: new Date() }).where(eq(bpmlEntries.id, id)).returning();
    return result;
  }

  async deleteBpmlEntry(id: number): Promise<void> {
    await db.delete(bpmlEntries).where(eq(bpmlEntries.id, id));
  }

  async deleteBpmlEntries(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(bpmlEntries).where(inArray(bpmlEntries.id, ids));
  }

  // Portal Menu Nodes
  async getPortalMenuNodes(tenantId: number): Promise<PortalMenuNode[]> {
    return await db.select().from(portalMenuNodes).where(eq(portalMenuNodes.tenantId, tenantId)).orderBy(portalMenuNodes.sortOrder);
  }

  async getPortalMenuNode(id: number): Promise<PortalMenuNode | undefined> {
    const [result] = await db.select().from(portalMenuNodes).where(eq(portalMenuNodes.id, id));
    return result;
  }

  async createPortalMenuNode(node: InsertPortalMenuNode): Promise<PortalMenuNode> {
    const [result] = await db.insert(portalMenuNodes).values(node).returning();
    return result;
  }

  async updatePortalMenuNode(id: number, updates: Partial<InsertPortalMenuNode>): Promise<PortalMenuNode | undefined> {
    const [result] = await db.update(portalMenuNodes).set({ ...updates, updatedAt: new Date() }).where(eq(portalMenuNodes.id, id)).returning();
    return result;
  }

  async deletePortalMenuNode(id: number): Promise<void> {
    await db.delete(portalDiagramAssignments).where(eq(portalDiagramAssignments.menuNodeId, id));
    await db.delete(portalMenuNodes).where(or(eq(portalMenuNodes.id, id), eq(portalMenuNodes.parentId, id)));
  }

  // Portal Diagram Assignments
  async getPortalDiagramAssignments(menuNodeId: number): Promise<PortalDiagramAssignment[]> {
    return await db.select().from(portalDiagramAssignments).where(eq(portalDiagramAssignments.menuNodeId, menuNodeId)).orderBy(portalDiagramAssignments.sortOrder);
  }

  async getAllPortalDiagramAssignments(tenantId: number): Promise<PortalDiagramAssignment[]> {
    return await db
      .select({ id: portalDiagramAssignments.id, menuNodeId: portalDiagramAssignments.menuNodeId, diagramId: portalDiagramAssignments.diagramId, sortOrder: portalDiagramAssignments.sortOrder, createdAt: portalDiagramAssignments.createdAt })
      .from(portalDiagramAssignments)
      .innerJoin(portalMenuNodes, eq(portalDiagramAssignments.menuNodeId, portalMenuNodes.id))
      .where(eq(portalMenuNodes.tenantId, tenantId))
      .orderBy(portalDiagramAssignments.sortOrder);
  }

  async createPortalDiagramAssignment(assignment: InsertPortalDiagramAssignment): Promise<PortalDiagramAssignment> {
    const [result] = await db.insert(portalDiagramAssignments).values(assignment).returning();
    return result;
  }

  async deletePortalDiagramAssignment(id: number): Promise<void> {
    await db.delete(portalDiagramAssignments).where(eq(portalDiagramAssignments.id, id));
  }

  // Process Resources
  async getProcessResources(tenantId: number): Promise<ProcessResource[]> {
    return await db.select().from(processResources).where(eq(processResources.tenantId, tenantId)).orderBy(processResources.sortOrder);
  }

  async getProcessResourcesByEntry(entryId: number): Promise<ProcessResource[]> {
    return await db.select().from(processResources).where(eq(processResources.entryId, entryId)).orderBy(processResources.sortOrder);
  }

  async getProcessResourcesByMenuNode(menuNodeId: number): Promise<ProcessResource[]> {
    return await db.select().from(processResources).where(eq(processResources.menuNodeId, menuNodeId)).orderBy(processResources.sortOrder);
  }

  async createProcessResource(resource: InsertProcessResource): Promise<ProcessResource> {
    const [result] = await db.insert(processResources).values(resource).returning();
    return result;
  }

  async updateProcessResource(id: number, updates: Partial<InsertProcessResource>): Promise<ProcessResource | undefined> {
    const [result] = await db.update(processResources).set({ ...updates, updatedAt: new Date() }).where(eq(processResources.id, id)).returning();
    return result;
  }

  async deleteProcessResource(id: number): Promise<void> {
    await db.delete(processResources).where(eq(processResources.id, id));
  }

  // Org Charts
  // Org Chart Templates
  async getOrgChartTemplates(tenantId: number): Promise<OrgChartTemplate[]> {
    return await db.select().from(orgChartTemplates).where(eq(orgChartTemplates.tenantId, tenantId)).orderBy(desc(orgChartTemplates.updatedAt));
  }

  async getOrgChartTemplate(id: number): Promise<OrgChartTemplate | undefined> {
    const [result] = await db.select().from(orgChartTemplates).where(eq(orgChartTemplates.id, id));
    return result;
  }

  async createOrgChartTemplate(template: InsertOrgChartTemplate): Promise<OrgChartTemplate> {
    const [result] = await db.insert(orgChartTemplates).values(template).returning();
    return result;
  }

  async updateOrgChartTemplate(id: number, updates: Partial<InsertOrgChartTemplate>): Promise<OrgChartTemplate | undefined> {
    const [result] = await db.update(orgChartTemplates).set({ ...updates, updatedAt: new Date() }).where(eq(orgChartTemplates.id, id)).returning();
    return result;
  }

  async deleteOrgChartTemplate(id: number): Promise<void> {
    await db.delete(orgChartTemplates).where(eq(orgChartTemplates.id, id));
  }

  async getOrgCharts(tenantId: number): Promise<OrgChart[]> {
    return await db.select().from(orgCharts).where(eq(orgCharts.tenantId, tenantId)).orderBy(desc(orgCharts.updatedAt));
  }

  async getOrgChart(id: number): Promise<OrgChart | undefined> {
    const [result] = await db.select().from(orgCharts).where(eq(orgCharts.id, id));
    return result;
  }

  async createOrgChart(chart: InsertOrgChart): Promise<OrgChart> {
    const [result] = await db.insert(orgCharts).values(chart).returning();
    return result;
  }

  async updateOrgChart(id: number, updates: Partial<InsertOrgChart>): Promise<OrgChart | undefined> {
    const [result] = await db.update(orgCharts).set({ ...updates, updatedAt: new Date() }).where(eq(orgCharts.id, id)).returning();
    return result;
  }

  async deleteOrgChart(id: number): Promise<void> {
    await db.delete(orgCharts).where(eq(orgCharts.id, id));
  }

  // Org Chart Members
  async getOrgChartMembers(chartId: number): Promise<OrgChartMember[]> {
    return await db.select().from(orgChartMembers).where(eq(orgChartMembers.chartId, chartId)).orderBy(orgChartMembers.sortOrder);
  }

  async getOrgChartMember(id: number): Promise<OrgChartMember | undefined> {
    const [result] = await db.select().from(orgChartMembers).where(eq(orgChartMembers.id, id));
    return result;
  }

  async createOrgChartMember(member: InsertOrgChartMember): Promise<OrgChartMember> {
    const [result] = await db.insert(orgChartMembers).values(member).returning();
    return result;
  }

  async updateOrgChartMember(id: number, updates: Partial<InsertOrgChartMember>): Promise<OrgChartMember | undefined> {
    const [result] = await db.update(orgChartMembers).set(updates).where(eq(orgChartMembers.id, id)).returning();
    return result;
  }

  async deleteOrgChartMember(id: number): Promise<void> {
    await db.delete(orgChartMembers).where(eq(orgChartMembers.id, id));
  }

  // Workspaces
  async getWorkspaces(tenantId: number): Promise<Workspace[]> {
    return await db.select().from(workspaces).where(eq(workspaces.tenantId, tenantId)).orderBy(desc(workspaces.updatedAt));
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [result] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return result;
  }

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const [result] = await db.insert(workspaces).values(workspace).returning();
    return result;
  }

  async updateWorkspace(id: number, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const [result] = await db.update(workspaces).set({ ...updates, updatedAt: new Date() }).where(eq(workspaces.id, id)).returning();
    return result;
  }

  async deleteWorkspace(id: number): Promise<void> {
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }

  // Workspace Members
  async getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]> {
    return await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  }

  async addWorkspaceMember(data: InsertWorkspaceMember): Promise<WorkspaceMember> {
    const [result] = await db.insert(workspaceMembers).values(data).returning();
    return result;
  }

  async removeWorkspaceMember(id: number): Promise<void> {
    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, id));
  }

  // Workspace Pages
  async getWorkspacePages(workspaceId: number): Promise<WorkspacePage[]> {
    return await db.select().from(workspacePages).where(eq(workspacePages.workspaceId, workspaceId)).orderBy(workspacePages.sortOrder);
  }

  async getAllFavoritePages(): Promise<WorkspacePage[]> {
    return await db.select().from(workspacePages).where(eq(workspacePages.isFavorite, true)).orderBy(workspacePages.sortOrder);
  }

  async getWorkspacePage(id: number): Promise<WorkspacePage | undefined> {
    const [result] = await db.select().from(workspacePages).where(eq(workspacePages.id, id));
    return result;
  }

  async createWorkspacePage(page: InsertWorkspacePage): Promise<WorkspacePage> {
    const [result] = await db.insert(workspacePages).values(page).returning();
    return result;
  }

  async updateWorkspacePage(id: number, updates: Partial<InsertWorkspacePage>): Promise<WorkspacePage | undefined> {
    const [result] = await db.update(workspacePages).set({ ...updates, updatedAt: new Date() }).where(eq(workspacePages.id, id)).returning();
    return result;
  }

  async deleteWorkspacePage(id: number): Promise<void> {
    await db.delete(workspacePages).where(eq(workspacePages.id, id));
  }

  async reorderWorkspacePages(updates: { id: number; sortOrder: number }[]): Promise<void> {
    for (const u of updates) {
      await db.update(workspacePages).set({ sortOrder: u.sortOrder }).where(eq(workspacePages.id, u.id));
    }
  }

  // Workspace Databases
  async getWorkspaceDatabases(pageId: number): Promise<WorkspaceDatabase[]> {
    return await db.select().from(workspaceDatabases).where(eq(workspaceDatabases.pageId, pageId));
  }

  async getWorkspaceDatabase(id: number): Promise<WorkspaceDatabase | undefined> {
    const [result] = await db.select().from(workspaceDatabases).where(eq(workspaceDatabases.id, id));
    return result;
  }

  async createWorkspaceDatabase(database: InsertWorkspaceDatabase): Promise<WorkspaceDatabase> {
    const [result] = await db.insert(workspaceDatabases).values(database).returning();
    return result;
  }

  async updateWorkspaceDatabase(id: number, updates: Partial<InsertWorkspaceDatabase>): Promise<WorkspaceDatabase | undefined> {
    const [result] = await db.update(workspaceDatabases).set(updates).where(eq(workspaceDatabases.id, id)).returning();
    return result;
  }

  async deleteWorkspaceDatabase(id: number): Promise<void> {
    await db.delete(workspaceDatabases).where(eq(workspaceDatabases.id, id));
  }

  // Workspace Database Columns
  async getWorkspaceDatabaseColumns(databaseId: number): Promise<WorkspaceDatabaseColumn[]> {
    return await db.select().from(workspaceDatabaseColumns).where(eq(workspaceDatabaseColumns.databaseId, databaseId)).orderBy(workspaceDatabaseColumns.sortOrder);
  }

  async createWorkspaceDatabaseColumn(column: InsertWorkspaceDatabaseColumn): Promise<WorkspaceDatabaseColumn> {
    const [result] = await db.insert(workspaceDatabaseColumns).values(column).returning();
    return result;
  }

  async updateWorkspaceDatabaseColumn(id: number, updates: Partial<InsertWorkspaceDatabaseColumn>): Promise<WorkspaceDatabaseColumn | undefined> {
    const [result] = await db.update(workspaceDatabaseColumns).set(updates).where(eq(workspaceDatabaseColumns.id, id)).returning();
    return result;
  }

  async deleteWorkspaceDatabaseColumn(id: number): Promise<void> {
    await db.delete(workspaceDatabaseColumns).where(eq(workspaceDatabaseColumns.id, id));
  }

  // Workspace Database Rows
  async getWorkspaceDatabaseRows(databaseId: number): Promise<WorkspaceDatabaseRow[]> {
    return await db.select().from(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.databaseId, databaseId)).orderBy(workspaceDatabaseRows.sortOrder);
  }

  async createWorkspaceDatabaseRow(row: InsertWorkspaceDatabaseRow): Promise<WorkspaceDatabaseRow> {
    const [result] = await db.insert(workspaceDatabaseRows).values(row).returning();
    return result;
  }

  async updateWorkspaceDatabaseRow(id: number, updates: Partial<InsertWorkspaceDatabaseRow>): Promise<WorkspaceDatabaseRow | undefined> {
    const [result] = await db.update(workspaceDatabaseRows).set({ ...updates, updatedAt: new Date() }).where(eq(workspaceDatabaseRows.id, id)).returning();
    return result;
  }

  async deleteWorkspaceDatabaseRow(id: number): Promise<void> {
    await db.delete(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.id, id));
  }

  // Workspace Saved Views
  async getWorkspaceSavedViews(databaseId: number): Promise<WorkspaceSavedView[]> {
    return await db.select().from(workspaceSavedViews).where(eq(workspaceSavedViews.databaseId, databaseId)).orderBy(workspaceSavedViews.sortOrder);
  }

  async createWorkspaceSavedView(view: InsertWorkspaceSavedView): Promise<WorkspaceSavedView> {
    const [result] = await db.insert(workspaceSavedViews).values(view).returning();
    return result;
  }

  async updateWorkspaceSavedView(id: number, updates: Partial<InsertWorkspaceSavedView>): Promise<WorkspaceSavedView | undefined> {
    const [result] = await db.update(workspaceSavedViews).set(updates).where(eq(workspaceSavedViews.id, id)).returning();
    return result;
  }

  async deleteWorkspaceSavedView(id: number): Promise<void> {
    await db.delete(workspaceSavedViews).where(eq(workspaceSavedViews.id, id));
  }

  // ─── TEST MANAGEMENT ──────────────────────────────────────────────────────

  // Projects
  async getTmProjects(tenantId: number): Promise<TmProject[]> {
    return await db.select().from(tmProjects).where(eq(tmProjects.tenantId, tenantId)).orderBy(tmProjects.createdAt);
  }
  async getTmProject(id: number): Promise<TmProject | undefined> {
    const [row] = await db.select().from(tmProjects).where(eq(tmProjects.id, id));
    return row;
  }
  async createTmProject(data: InsertTmProject): Promise<TmProject> {
    const [row] = await db.insert(tmProjects).values(data).returning();
    return row;
  }
  async updateTmProject(id: number, data: Partial<InsertTmProject>): Promise<TmProject | undefined> {
    const [row] = await db.update(tmProjects).set({ ...data, updatedAt: new Date() }).where(eq(tmProjects.id, id)).returning();
    return row;
  }
  async deleteTmProject(id: number): Promise<void> {
    await db.delete(tmProjects).where(eq(tmProjects.id, id));
  }

  async getTmTestSuites(tenantId: number, projectId?: number): Promise<TmTestSuite[]> {
    const conds = projectId !== undefined
      ? and(eq(tmTestSuites.tenantId, tenantId), eq(tmTestSuites.projectId, projectId))
      : eq(tmTestSuites.tenantId, tenantId);
    return await db.select().from(tmTestSuites).where(conds).orderBy(tmTestSuites.sortOrder);
  }
  async getTmTestSuite(id: number): Promise<TmTestSuite | undefined> {
    const [row] = await db.select().from(tmTestSuites).where(eq(tmTestSuites.id, id));
    return row;
  }
  async createTmTestSuite(data: InsertTmTestSuite): Promise<TmTestSuite> {
    const [row] = await db.insert(tmTestSuites).values(data).returning();
    return row;
  }
  async updateTmTestSuite(id: number, data: Partial<InsertTmTestSuite>): Promise<TmTestSuite | undefined> {
    const [row] = await db.update(tmTestSuites).set({ ...data, updatedAt: new Date() }).where(eq(tmTestSuites.id, id)).returning();
    return row;
  }
  async deleteTmTestSuite(id: number): Promise<void> {
    await db.delete(tmTestSuites).where(eq(tmTestSuites.id, id));
  }

  async getTmTestCases(tenantId: number, suiteId?: number, projectId?: number): Promise<TmTestCase[]> {
    const conds = [eq(tmTestCases.tenantId, tenantId)];
    if (suiteId !== undefined) conds.push(eq(tmTestCases.suiteId, suiteId));
    if (projectId !== undefined) conds.push(eq(tmTestCases.projectId, projectId));
    return await db.select().from(tmTestCases).where(and(...conds)).orderBy(tmTestCases.createdAt);
  }
  async getTmTestCase(id: number): Promise<TmTestCase | undefined> {
    const [row] = await db.select().from(tmTestCases).where(eq(tmTestCases.id, id));
    return row;
  }
  async createTmTestCase(data: InsertTmTestCase): Promise<TmTestCase> {
    const [row] = await db.insert(tmTestCases).values(data).returning();
    return row;
  }
  async updateTmTestCase(id: number, data: Partial<InsertTmTestCase>): Promise<TmTestCase | undefined> {
    const [row] = await db.update(tmTestCases).set({ ...data, updatedAt: new Date() }).where(eq(tmTestCases.id, id)).returning();
    return row;
  }
  async deleteTmTestCase(id: number): Promise<void> {
    await db.delete(tmTestCases).where(eq(tmTestCases.id, id));
  }

  async getTmTestSteps(testCaseId: number): Promise<TmTestStep[]> {
    return await db.select().from(tmTestSteps).where(eq(tmTestSteps.testCaseId, testCaseId)).orderBy(tmTestSteps.stepOrder);
  }
  async createTmTestStep(data: InsertTmTestStep): Promise<TmTestStep> {
    const [row] = await db.insert(tmTestSteps).values(data).returning();
    return row;
  }
  async updateTmTestStep(id: number, data: Partial<InsertTmTestStep>): Promise<TmTestStep | undefined> {
    const [row] = await db.update(tmTestSteps).set(data).where(eq(tmTestSteps.id, id)).returning();
    return row;
  }
  async deleteTmTestStep(id: number): Promise<void> {
    await db.delete(tmTestSteps).where(eq(tmTestSteps.id, id));
  }
  async deleteAllTmTestSteps(testCaseId: number): Promise<void> {
    await db.delete(tmTestSteps).where(eq(tmTestSteps.testCaseId, testCaseId));
  }

  async getTmTestRuns(tenantId: number, projectId?: number): Promise<TmTestRun[]> {
    const conds = projectId !== undefined
      ? and(eq(tmTestRuns.tenantId, tenantId), eq(tmTestRuns.projectId, projectId))
      : eq(tmTestRuns.tenantId, tenantId);
    return await db.select().from(tmTestRuns).where(conds).orderBy(tmTestRuns.createdAt);
  }
  async getTmTestRun(id: number): Promise<TmTestRun | undefined> {
    const [row] = await db.select().from(tmTestRuns).where(eq(tmTestRuns.id, id));
    return row;
  }
  async createTmTestRun(data: InsertTmTestRun): Promise<TmTestRun> {
    const [row] = await db.insert(tmTestRuns).values(data).returning();
    return row;
  }
  async updateTmTestRun(id: number, data: Partial<InsertTmTestRun>): Promise<TmTestRun | undefined> {
    const [row] = await db.update(tmTestRuns).set({ ...data, updatedAt: new Date() }).where(eq(tmTestRuns.id, id)).returning();
    return row;
  }
  async deleteTmTestRun(id: number): Promise<void> {
    await db.delete(tmTestRuns).where(eq(tmTestRuns.id, id));
  }

  async getTmTestResults(testRunId: number): Promise<TmTestResult[]> {
    return await db.select().from(tmTestResults).where(eq(tmTestResults.testRunId, testRunId));
  }
  async createTmTestResult(data: InsertTmTestResult): Promise<TmTestResult> {
    const [row] = await db.insert(tmTestResults).values(data).returning();
    return row;
  }
  async updateTmTestResult(id: number, data: Partial<InsertTmTestResult>): Promise<TmTestResult | undefined> {
    const [row] = await db.update(tmTestResults).set({ ...data, updatedAt: new Date() }).where(eq(tmTestResults.id, id)).returning();
    return row;
  }
  async deleteTmTestResult(id: number): Promise<void> {
    await db.delete(tmTestResults).where(eq(tmTestResults.id, id));
  }

  async getTmDefects(tenantId: number, projectId?: number): Promise<TmDefect[]> {
    const conds = projectId !== undefined
      ? and(eq(tmDefects.tenantId, tenantId), eq(tmDefects.projectId, projectId))
      : eq(tmDefects.tenantId, tenantId);
    return await db.select().from(tmDefects).where(conds).orderBy(tmDefects.createdAt);
  }
  async getTmDefect(id: number): Promise<TmDefect | undefined> {
    const [row] = await db.select().from(tmDefects).where(eq(tmDefects.id, id));
    return row;
  }
  async createTmDefect(data: InsertTmDefect): Promise<TmDefect> {
    const [row] = await db.insert(tmDefects).values(data).returning();
    return row;
  }
  async updateTmDefect(id: number, data: Partial<InsertTmDefect>): Promise<TmDefect | undefined> {
    const [row] = await db.update(tmDefects).set({ ...data, updatedAt: new Date() }).where(eq(tmDefects.id, id)).returning();
    return row;
  }
  async deleteTmDefect(id: number): Promise<void> {
    await db.delete(tmDefects).where(eq(tmDefects.id, id));
  }

  // Requirements (RTM)
  async getTmRequirements(tenantId: number, projectId?: number): Promise<TmRequirement[]> {
    const conds = projectId !== undefined
      ? and(eq(tmRequirements.tenantId, tenantId), eq(tmRequirements.projectId, projectId))
      : eq(tmRequirements.tenantId, tenantId);
    return await db.select().from(tmRequirements).where(conds).orderBy(tmRequirements.reqId);
  }
  async getTmRequirement(id: number): Promise<TmRequirement | undefined> {
    const [row] = await db.select().from(tmRequirements).where(eq(tmRequirements.id, id));
    return row;
  }
  async createTmRequirement(data: InsertTmRequirement): Promise<TmRequirement> {
    const [row] = await db.insert(tmRequirements).values(data).returning();
    return row;
  }
  async updateTmRequirement(id: number, data: Partial<InsertTmRequirement>): Promise<TmRequirement | undefined> {
    const [row] = await db.update(tmRequirements).set({ ...data, updatedAt: new Date() }).where(eq(tmRequirements.id, id)).returning();
    return row;
  }
  async deleteTmRequirement(id: number): Promise<void> {
    await db.delete(tmRequirements).where(eq(tmRequirements.id, id));
  }

  // ── Scenarios ──────────────────────────────────────────────────────────────
  async getTmScenarios(tenantId: number, projectId?: number): Promise<TmScenario[]> {
    const conds = projectId
      ? and(eq(tmScenarios.tenantId, tenantId), eq(tmScenarios.projectId, projectId))
      : eq(tmScenarios.tenantId, tenantId);
    return await db.select().from(tmScenarios).where(conds).orderBy(tmScenarios.scenarioId);
  }
  async getTmScenario(id: number): Promise<TmScenario | undefined> {
    const [row] = await db.select().from(tmScenarios).where(eq(tmScenarios.id, id));
    return row;
  }
  async createTmScenario(data: InsertTmScenario): Promise<TmScenario> {
    const [row] = await db.insert(tmScenarios).values(data).returning();
    return row;
  }
  async updateTmScenario(id: number, data: Partial<InsertTmScenario>): Promise<TmScenario | undefined> {
    const [row] = await db.update(tmScenarios).set({ ...data, updatedAt: new Date() }).where(eq(tmScenarios.id, id)).returning();
    return row;
  }
  async deleteTmScenario(id: number): Promise<void> {
    await db.delete(tmScenarios).where(eq(tmScenarios.id, id));
  }

  // ── Sign-Off ────────────────────────────────────────────────────────────────
  async getSignoffRequests(tenantId: number): Promise<SignoffRequestWithDetails[]> {
    const requests = await db.select().from(signoffRequests)
      .where(eq(signoffRequests.tenantId, tenantId))
      .orderBy(desc(signoffRequests.createdAt));
    if (requests.length === 0) return [];
    const ids = requests.map(r => r.id);
    const allSigners = await db.select().from(signoffSigners)
      .where(inArray(signoffSigners.requestId, ids))
      .orderBy(signoffSigners.signerOrder);
    return requests.map(r => ({
      ...r,
      signers: allSigners.filter(s => s.requestId === r.id),
      auditLog: [],
      sourceDocument: null,
    }));
  }

  async getSignoffRequest(id: number): Promise<SignoffRequestWithDetails | undefined> {
    const [req] = await db.select().from(signoffRequests).where(eq(signoffRequests.id, id));
    if (!req) return undefined;
    const signers = await db.select().from(signoffSigners)
      .where(eq(signoffSigners.requestId, id))
      .orderBy(signoffSigners.signerOrder);
    const auditLog = await db.select().from(signoffAuditLog)
      .where(eq(signoffAuditLog.requestId, id))
      .orderBy(signoffAuditLog.createdAt);
    let sourceDocument = null;
    if (req.sourceDocumentId) {
      const [doc] = await db.select({ id: documents.id, title: documents.title, content: documents.content })
        .from(documents).where(eq(documents.id, req.sourceDocumentId));
      sourceDocument = doc || null;
    }
    return { ...req, signers, auditLog, sourceDocument };
  }

  async getSignoffRequestByToken(token: string): Promise<SignoffRequestWithDetails | undefined> {
    const [signer] = await db.select().from(signoffSigners).where(eq(signoffSigners.token, token));
    if (!signer) return undefined;
    return this.getSignoffRequest(signer.requestId);
  }

  async createSignoffRequest(data: InsertSignoffRequest): Promise<SignoffRequest> {
    const [row] = await db.insert(signoffRequests).values(data).returning();
    return row;
  }

  async updateSignoffRequest(id: number, data: Partial<InsertSignoffRequest>): Promise<SignoffRequest | undefined> {
    const [row] = await db.update(signoffRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(signoffRequests.id, id))
      .returning();
    return row;
  }

  async deleteSignoffRequest(id: number): Promise<void> {
    await db.delete(signoffRequests).where(eq(signoffRequests.id, id));
  }

  async createSignoffSigner(data: InsertSignoffSigner & { token?: string; tokenExpiresAt?: Date }): Promise<SignoffSigner> {
    const [row] = await db.insert(signoffSigners).values(data).returning();
    return row;
  }

  async updateSignoffSigner(id: number, data: Partial<SignoffSigner>): Promise<SignoffSigner | undefined> {
    const [row] = await db.update(signoffSigners).set(data).where(eq(signoffSigners.id, id)).returning();
    return row;
  }

  async deleteSignoffSigner(id: number): Promise<void> {
    await db.delete(signoffSigners).where(eq(signoffSigners.id, id));
  }

  async getSignoffSignerByToken(token: string): Promise<SignoffSigner | undefined> {
    const [row] = await db.select().from(signoffSigners).where(eq(signoffSigners.token, token));
    return row;
  }

  async getSignoffRequestsForSigner(email: string): Promise<any[]> {
    const pendingSigners = await db.select().from(signoffSigners)
      .where(and(eq(signoffSigners.email, email), inArray(signoffSigners.status, ['pending', 'viewed'])));
    if (pendingSigners.length === 0) return [];
    const results = [];
    for (const signer of pendingSigners) {
      const req = await this.getSignoffRequest(signer.requestId);
      if (req && req.status === 'sent') {
        results.push({ ...req, mySignerToken: signer.token, mySignerStatus: signer.status });
      }
    }
    return results;
  }

  async createSignoffAuditLog(data: InsertSignoffAuditLog): Promise<SignoffAuditLog> {
    const [row] = await db.insert(signoffAuditLog).values(data).returning();
    return row;
  }

  async getSignoffAuditLog(requestId: number): Promise<SignoffAuditLog[]> {
    return await db.select().from(signoffAuditLog)
      .where(eq(signoffAuditLog.requestId, requestId))
      .orderBy(signoffAuditLog.createdAt);
  }

  // ─── Surveys ───────────────────────────────────────────────────────────────

  private async attachSurveyDetails(rows: Survey[]): Promise<SurveyWithDetails[]> {
    if (rows.length === 0) return [];
    const ids = rows.map(r => r.id);
    const questions = await db.select().from(surveyQuestions)
      .where(inArray(surveyQuestions.surveyId, ids))
      .orderBy(surveyQuestions.questionOrder);
    const responseCounts = await db.select({
      surveyId: surveyResponses.surveyId,
      count: sql<number>`cast(count(*) as int)`,
    }).from(surveyResponses)
      .where(and(inArray(surveyResponses.surveyId, ids)))
      .groupBy(surveyResponses.surveyId);
    const countMap = new Map(responseCounts.map(r => [r.surveyId, r.count]));
    const questionMap = new Map<number, SurveyQuestion[]>();
    for (const q of questions) {
      if (!questionMap.has(q.surveyId)) questionMap.set(q.surveyId, []);
      questionMap.get(q.surveyId)!.push(q);
    }
    return rows.map(r => ({
      ...r,
      questions: questionMap.get(r.id) ?? [],
      responseCount: countMap.get(r.id) ?? 0,
    }));
  }

  async getSurveys(tenantId: number): Promise<SurveyWithDetails[]> {
    const rows = await db.select().from(surveys)
      .where(eq(surveys.tenantId, tenantId))
      .orderBy(desc(surveys.createdAt));
    return this.attachSurveyDetails(rows);
  }

  async getSurvey(id: number): Promise<SurveyWithDetails | undefined> {
    const rows = await db.select().from(surveys).where(eq(surveys.id, id));
    if (rows.length === 0) return undefined;
    const [result] = await this.attachSurveyDetails(rows);
    return result;
  }

  async getSurveyByToken(token: string): Promise<SurveyWithDetails | undefined> {
    const rows = await db.select().from(surveys).where(eq(surveys.token, token));
    if (rows.length === 0) return undefined;
    const [result] = await this.attachSurveyDetails(rows);
    return result;
  }

  async createSurvey(data: InsertSurvey): Promise<Survey> {
    const [row] = await db.insert(surveys).values(data).returning();
    return row;
  }

  async updateSurvey(id: number, data: Partial<InsertSurvey>): Promise<Survey | undefined> {
    const [row] = await db.update(surveys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(surveys.id, id))
      .returning();
    return row;
  }

  async deleteSurvey(id: number): Promise<void> {
    await db.delete(surveys).where(eq(surveys.id, id));
  }

  async getSurveyQuestions(surveyId: number): Promise<SurveyQuestion[]> {
    return db.select().from(surveyQuestions)
      .where(eq(surveyQuestions.surveyId, surveyId))
      .orderBy(surveyQuestions.questionOrder);
  }

  async createSurveyQuestion(data: InsertSurveyQuestion): Promise<SurveyQuestion> {
    const [row] = await db.insert(surveyQuestions).values(data).returning();
    return row;
  }

  async updateSurveyQuestion(id: number, data: Partial<InsertSurveyQuestion>): Promise<SurveyQuestion | undefined> {
    const [row] = await db.update(surveyQuestions).set(data).where(eq(surveyQuestions.id, id)).returning();
    return row;
  }

  async deleteSurveyQuestion(id: number): Promise<void> {
    await db.delete(surveyQuestions).where(eq(surveyQuestions.id, id));
  }

  async reorderSurveyQuestions(surveyId: number, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(surveyQuestions)
        .set({ questionOrder: i + 1 })
        .where(and(eq(surveyQuestions.id, orderedIds[i]), eq(surveyQuestions.surveyId, surveyId)));
    }
  }

  async getSurveyResponses(surveyId: number): Promise<SurveyResponseWithAnswers[]> {
    const responses = await db.select().from(surveyResponses)
      .where(eq(surveyResponses.surveyId, surveyId))
      .orderBy(desc(surveyResponses.createdAt));
    if (responses.length === 0) return [];
    const ids = responses.map(r => r.id);
    const answers = await db.select().from(surveyAnswers)
      .where(inArray(surveyAnswers.responseId, ids));
    const answerMap = new Map<number, SurveyAnswer[]>();
    for (const a of answers) {
      if (!answerMap.has(a.responseId)) answerMap.set(a.responseId, []);
      answerMap.get(a.responseId)!.push(a);
    }
    return responses.map(r => ({ ...r, answers: answerMap.get(r.id) ?? [] }));
  }

  async createSurveyResponse(data: InsertSurveyResponse): Promise<SurveyResponse> {
    const [row] = await db.insert(surveyResponses).values(data).returning();
    return row;
  }

  async completeSurveyResponse(id: number, timeSeconds: number): Promise<SurveyResponse | undefined> {
    const [row] = await db.update(surveyResponses)
      .set({ completedAt: new Date(), timeSeconds })
      .where(eq(surveyResponses.id, id))
      .returning();
    return row;
  }

  async createSurveyAnswer(data: InsertSurveyAnswer): Promise<SurveyAnswer> {
    const [row] = await db.insert(surveyAnswers).values(data).returning();
    return row;
  }

  // ===== Clients =====

  async getClients(tenantId: number, opts?: { includeArchived?: boolean }): Promise<Client[]> {
    const conditions = [eq(clients.tenantId, tenantId)];
    if (!opts?.includeArchived) {
      conditions.push(eq(clients.status, "active"));
    } else {
      conditions.push(ne(clients.status, "pending_delete"));
    }
    return db.select().from(clients)
      .where(and(...conditions))
      .orderBy(clients.name);
  }

  async getClientSlugs(tenantId: number): Promise<string[]> {
    const rows = await db
      .select({ slug: clients.slug })
      .from(clients)
      .where(eq(clients.tenantId, tenantId));
    return rows.map((r) => r.slug).filter((s): s is string => Boolean(s));
  }

  async getAccessibleClients(
    userId: string,
    tenantId: number,
    options?: { platformRole?: string; isJigantoStaff?: boolean; includeArchived?: boolean },
  ): Promise<Client[]> {
    const statusConditions = !options?.includeArchived
      ? [eq(clients.status, "active")]
      : [ne(clients.status, "pending_delete")];

    if (options?.isJigantoStaff) {
      return this.getClients(tenantId, { includeArchived: options?.includeArchived });
    }
    if (
      options?.platformRole === "si_super_admin" ||
      options?.platformRole === "client_jiganto_user" ||
      options?.platformRole === "jiganto_staff"
    ) {
      return this.getClients(tenantId, { includeArchived: options?.includeArchived });
    }
    if (options?.platformRole === "si_consultant_pm") {
      const ids = await this.getAssignedClientIdsForUser(userId, tenantId);
      if (ids.length === 0) return [];
      return db
        .select()
        .from(clients)
        .where(and(eq(clients.tenantId, tenantId), inArray(clients.id, ids), ...statusConditions))
        .orderBy(clients.name);
    }
    return this.getClients(tenantId, { includeArchived: options?.includeArchived });
  }

  async getAssignedClientIdsForUser(userId: string, tenantId: number): Promise<number[]> {
    const { clientWorkspaceGrants } = await import("@shared/models/permissions");

    const [memberships, grants] = await Promise.all([
      db
        .select({ clientId: clientUsers.clientId })
        .from(clientUsers)
        .where(
          and(
            eq(clientUsers.userId, userId),
            eq(clientUsers.tenantId, tenantId),
            eq(clientUsers.isActive, 1),
          ),
        ),
      db
        .select({ clientId: clientWorkspaceGrants.clientId })
        .from(clientWorkspaceGrants)
        .where(
          and(
            eq(clientWorkspaceGrants.userId, userId),
            eq(clientWorkspaceGrants.tenantId, tenantId),
          ),
        ),
    ]);

    const ids = new Set<number>();
    for (const row of memberships) ids.add(row.clientId);
    for (const row of grants) ids.add(row.clientId);
    return Array.from(ids);
  }

  async globalSearch(
    userId: string,
    tenantId: number,
    query: string,
    clientId?: number,
  ): Promise<GlobalSearchHit[]> {
    const q = query.trim();
    if (!q) return [];

    const hits: GlobalSearchHit[] = [];
    const pattern = `%${q.toLowerCase()}%`;

    const docs = await this.searchDocuments(tenantId, q, clientId);
    for (const doc of docs.slice(0, 8)) {
      hits.push({
        type: "document",
        id: doc.id,
        title: doc.title,
        subtitle: doc.type ?? "Document",
        href: `/modules/documents?document=${doc.id}`,
      });
    }

    const projectConditions = [
      eq(pmProjects.tenantId, tenantId),
      or(
        sql`LOWER(${pmProjects.name}) LIKE ${pattern}`,
        sql`LOWER(${pmProjects.description}) LIKE ${pattern}`,
      ),
    ];
    if (clientId !== undefined) {
      projectConditions.push(eq(pmProjects.clientId, clientId));
    }
    const projects = await db
      .select({ id: pmProjects.id, name: pmProjects.name, status: pmProjects.status })
      .from(pmProjects)
      .where(and(...projectConditions))
      .orderBy(desc(pmProjects.updatedAt))
      .limit(8);
    for (const project of projects) {
      hits.push({
        type: "project",
        id: project.id,
        title: project.name,
        subtitle: project.status ?? "Project",
        href: `/modules/projects/${project.id}`,
      });
    }

    const taskConditions = [
      eq(tasks.tenantId, tenantId),
      or(
        sql`LOWER(${tasks.title}) LIKE ${pattern}`,
        sql`LOWER(${tasks.description}) LIKE ${pattern}`,
      ),
    ];
    if (clientId !== undefined) {
      taskConditions.push(eq(tasks.clientId, clientId));
    }
    const taskRows = await db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(and(...taskConditions))
      .orderBy(desc(tasks.updatedAt))
      .limit(8);
    for (const task of taskRows) {
      hits.push({
        type: "task",
        id: task.id,
        title: task.title,
        subtitle: task.status ?? "Task",
        href: `/modules/tasks?task=${task.id}`,
      });
    }

    const chatHits = await this.searchChatMessages(userId, tenantId, q);
    for (const msg of chatHits.slice(0, 8)) {
      hits.push({
        type: "chat",
        id: msg.messageId,
        title: msg.channelName,
        subtitle: msg.content.slice(0, 120),
        href: `/modules/chat/${msg.channelId}`,
      });
    }

    return hits.slice(0, 24);
  }

  async userCanAccessClient(
    userId: string,
    tenantId: number,
    clientId: number,
    options?: { platformRole?: string; isJigantoStaff?: boolean },
  ): Promise<boolean> {
    if (options?.isJigantoStaff) return true;

    const role = options?.platformRole;
    if (
      role === "si_super_admin" ||
      role === "client_jiganto_user" ||
      role === "jiganto_staff"
    ) {
      const [row] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId)));
      return !!row;
    }

    if (role === "si_consultant_pm") {
      const ids = await this.getAssignedClientIdsForUser(userId, tenantId);
      return ids.includes(clientId);
    }

    const [row] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId)));
    return !!row;
  }

  async getClientById(id: number, tenantId: number): Promise<Client | undefined> {
    const [row] = await db.select().from(clients)
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
    return row;
  }

  async getClientBySlug(
    slug: string,
    tenantId: number,
    opts?: { allowArchived?: boolean },
  ): Promise<Client | undefined> {
    const conditions = [
      eq(clients.slug, slug),
      eq(clients.tenantId, tenantId),
    ];
    if (!opts?.allowArchived) {
      conditions.push(eq(clients.status, "active"));
    }
    const [row] = await db.select().from(clients).where(and(...conditions));
    return row;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [row] = await db.insert(clients).values(data).returning();
    return row;
  }

  async updateClient(id: number, tenantId: number, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [row] = await db.update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
      .returning();
    return row;
  }

  async archiveClient(id: number, tenantId: number): Promise<Client | undefined> {
    const [row] = await db.update(clients)
      .set({ status: "archived", engagementStatus: "archived", updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
      .returning();
    return row;
  }

  async unarchiveClient(id: number, tenantId: number): Promise<Client | undefined> {
    const [row] = await db.update(clients)
      .set({ status: "active", engagementStatus: "active", updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
      .returning();
    return row;
  }

  async requestClientDeletion(id: number, tenantId: number): Promise<Client | undefined> {
    const purgeAt = new Date();
    purgeAt.setDate(purgeAt.getDate() + 30);
    const [row] = await db.update(clients)
      .set({
        status: "pending_delete",
        engagementStatus: "archived",
        deletedAt: new Date(),
        purgeAt,
        updatedAt: new Date(),
      })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
      .returning();
    return row;
  }

  async restoreClient(id: number, tenantId: number): Promise<Client | undefined> {
    const [row] = await db.update(clients)
      .set({
        status: "active",
        engagementStatus: "active",
        deletedAt: null,
        purgeAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
      .returning();
    return row;
  }

  async purgeExpiredDeletedClients(): Promise<number> {
    const now = new Date();
    const expired = await db.select().from(clients)
      .where(and(eq(clients.status, "pending_delete"), lt(clients.purgeAt, now)));
    for (const c of expired) {
      await db.delete(clients).where(eq(clients.id, c.id));
    }
    return expired.length;
  }

  async getClientsPendingDelete(tenantId: number): Promise<Client[]> {
    return db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.status, "pending_delete")));
  }

  async getClientUsers(clientId: number): Promise<(ClientUser & { userInfo?: { firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null } })[]> {
    const rows = await db.select().from(clientUsers).where(eq(clientUsers.clientId, clientId));
    if (rows.length === 0) return [];

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const userRows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .where(inArray(users.id, userIds));
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    return rows.map((row) => ({
      ...row,
      userInfo: userMap.get(row.userId) ?? undefined,
    }));
  }

  async getClientMemberCounts(clientIds: number[]): Promise<Map<number, number>> {
    if (clientIds.length === 0) return new Map();
    const rows = await db
      .select({
        clientId: clientUsers.clientId,
        count: sql<number>`count(*)::int`,
      })
      .from(clientUsers)
      .where(inArray(clientUsers.clientId, clientIds))
      .groupBy(clientUsers.clientId);
    return new Map(rows.map((r) => [r.clientId, r.count]));
  }

  async addClientUser(data: InsertClientUser): Promise<ClientUser> {
    const [row] = await db.insert(clientUsers).values(data).returning();
    return row;
  }

  async removeClientUser(clientId: number, userId: string): Promise<void> {
    await db.delete(clientUsers)
      .where(and(eq(clientUsers.clientId, clientId), eq(clientUsers.userId, userId)));
  }

  async getClientByUserId(userId: string, tenantId: number): Promise<Client | undefined> {
    const [cu] = await db.select().from(clientUsers)
      .where(and(eq(clientUsers.userId, userId), eq(clientUsers.tenantId, tenantId)));
    if (!cu) return undefined;
    return this.getClientById(cu.clientId, tenantId);
  }

  async getClientMembershipByUserId(userId: string, tenantId: number): Promise<{ client: Client; role: string; memberType: string } | undefined> {
    const [cu] = await db.select().from(clientUsers)
      .where(and(eq(clientUsers.userId, userId), eq(clientUsers.tenantId, tenantId)));
    if (!cu) return undefined;
    const client = await this.getClientById(cu.clientId, tenantId);
    if (!client) return undefined;
    return { client, role: cu.role, memberType: cu.memberType };
  }

  async getLockedClientMembershipByUserId(userId: string, tenantId: number): Promise<{ client: Client; role: string; memberType: string } | undefined> {
    const [row] = await db
      .select({
        client: clients,
        role: clientUsers.role,
        memberType: clientUsers.memberType,
      })
      .from(clientUsers)
      .innerJoin(clients, eq(clientUsers.clientId, clients.id))
      .where(
        and(
          eq(clientUsers.userId, userId),
          eq(clientUsers.tenantId, tenantId),
          eq(clientUsers.memberType, "client"),
        ),
      );
    if (!row) return undefined;
    return { client: row.client, role: row.role, memberType: row.memberType };
  }

  async getClientProjectSummary(tenantId: number): Promise<{ clientId: number | null; projectCount: number; atRiskCount: number; activeProjectCount: number }[]> {
    const rows = await db
      .select({
        clientId: pmProjects.clientId,
        projectCount: sql<number>`count(*)::int`,
        activeProjectCount: sql<number>`count(*) filter (where ${pmProjects.status} = 'active')::int`,
        atRiskCount: sql<number>`count(*) filter (where lower(${pmProjects.ragStatus}) in ('red', 'amber'))::int`,
      })
      .from(pmProjects)
      .where(eq(pmProjects.tenantId, tenantId))
      .groupBy(pmProjects.clientId);

    return rows.map((r) => ({
      clientId: r.clientId ?? null,
      projectCount: r.projectCount,
      atRiskCount: r.atRiskCount,
      activeProjectCount: r.activeProjectCount,
    }));
  }

  async getActiveEngagementCount(tenantId: number): Promise<number> {
    const summaries = await this.getClientProjectSummary(tenantId);
    return summaries.filter((s) => s.clientId != null && s.activeProjectCount > 0).length;
  }

  async getClientModuleVisibility(clientId: number): Promise<ClientModuleVisibility[]> {
    return db.select().from(clientModuleVisibility).where(eq(clientModuleVisibility.clientId, clientId));
  }

  async upsertClientModuleVisibility(
    clientId: number,
    moduleKey: string,
    isVisible: number,
    updatedBy: string,
  ): Promise<ClientModuleVisibility> {
    const existing = await db.select().from(clientModuleVisibility)
      .where(and(eq(clientModuleVisibility.clientId, clientId), eq(clientModuleVisibility.moduleKey, moduleKey)));
    if (existing[0]) {
      const [row] = await db.update(clientModuleVisibility)
        .set({ isVisible, updatedBy, updatedAt: new Date() })
        .where(eq(clientModuleVisibility.id, existing[0].id))
        .returning();
      return row;
    }
    const [row] = await db.insert(clientModuleVisibility)
      .values({ clientId, moduleKey, isVisible, updatedBy })
      .returning();
    return row;
  }

  async createClientInvitation(data: {
    tenantId: number;
    clientId: number;
    email: string;
    role: string;
    memberType: string;
    token: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<ClientInvitation> {
    const [row] = await db.insert(clientInvitations).values(data).returning();
    return row;
  }

  async getClientInvitationByToken(token: string): Promise<ClientInvitation | undefined> {
    const [row] = await db.select().from(clientInvitations).where(eq(clientInvitations.token, token));
    return row;
  }

  async getClientInvitations(clientId: number): Promise<ClientInvitation[]> {
    return db.select().from(clientInvitations)
      .where(and(eq(clientInvitations.clientId, clientId), isNull(clientInvitations.acceptedAt)))
      .orderBy(desc(clientInvitations.createdAt));
  }

  async acceptClientInvitation(token: string, userId: string): Promise<ClientUser | undefined> {
    const invite = await this.getClientInvitationByToken(token);
    if (!invite || invite.acceptedAt) return undefined;
    if (invite.expiresAt < new Date()) return undefined;
    const [accepted] = await db.update(clientInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(clientInvitations.id, invite.id))
      .returning();
    if (!accepted) return undefined;
    return this.addClientUser({
      tenantId: invite.tenantId,
      clientId: invite.clientId,
      userId,
      role: invite.role,
      memberType: invite.memberType,
      invitedBy: invite.invitedBy,
      joinedAt: new Date(),
      isActive: 1,
    });
  }
}

export const storage = new DatabaseStorage();
