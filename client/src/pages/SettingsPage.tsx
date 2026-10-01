import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ModuleShell } from "@/components/ModuleShell";
import {
  modulePageContentOuterClass,
  modulePageContentScrollClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
  modulePageTabsListClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
  ModulePageLoadingShell,
} from "@/components/ModulePageChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings,
  Building2,
  Users,
  Shield,
  Plus,
  Edit,
  Trash2,
  Save,
  RefreshCw,
  Upload,
  Download,
  Palette,
  Type,
  ChevronRight,
  ChevronDown,
  Network,
  Wallet,
  User,
  ClipboardList,
  Plug,
  CreditCard,
  Bell,
  Sparkles,
  Loader2
} from "lucide-react";
import { ModuleHeader } from "@/components/ModuleHeader";
import type { Tenant, Profile, UserRole, UserInvitation, OrgUnit, CostCentre } from "@shared/schema";
import { ORG_UNIT_TYPE_LABELS } from "@shared/schema";
import SettingsUsersTab from "@/components/settings/SettingsUsersTab";
import SettingsCustomersTab from "@/components/settings/SettingsCustomersTab";
import SettingsPlatformRolesTab from "@/components/settings/SettingsPlatformRolesTab";
import SettingsPlatformRolesMatrix from "@/components/settings/SettingsPlatformRolesMatrix";
import SettingsClientWorkspaceGrants from "@/components/settings/SettingsClientWorkspaceGrants";
import SettingsRolesOverview from "@/components/settings/SettingsRolesOverview";
import SettingsModuleRolesTab from "@/components/settings/SettingsModuleRolesTab";
import SettingsImpersonationTab from "@/components/settings/SettingsImpersonationTab";
import SettingsPersonalTab from "@/components/settings/SettingsPersonalTab";
import { usePermissions } from "@/hooks/use-permissions";
import SettingsStaffAuditTab from "@/components/settings/SettingsStaffAuditTab";
import SettingsWorkspaceRolesGuide from "@/components/settings/SettingsWorkspaceRolesGuide";
import SettingsClientWorkspaceTab from "@/components/settings/SettingsClientWorkspaceTab";
import { useClientContext } from "@/hooks/use-client-context";
import { ORG_THEMES } from "@/hooks/use-org-branding";
import SettingsIntegrationsTab from "@/components/settings/SettingsIntegrationsTab";
import SettingsBillingTab from "@/components/settings/SettingsBillingTab";
import SettingsDataGovernanceTab from "@/components/settings/SettingsDataGovernanceTab";
import SettingsOrgNotificationsTab from "@/components/settings/SettingsOrgNotificationsTab";
import SettingsAiUsageTab from "@/components/settings/SettingsAiUsageTab";
import { CrmCustomFieldsSettings } from "@/components/crm/CrmCustomFieldsSettings";
import {
  getSettingsAccess,
  tenantNeedsAdminFetch,
  usersDataNeeded,
  type SettingsTabId,
} from "@/lib/settings-access";
import {
  SETTINGS_PATHS,
  settingsPathForTier,
  tierFromSettingsPath,
} from "@/lib/settings-routes";

type ProfileWithUser = Profile & { 
  user: { 
    id: string; 
    firstName: string | null; 
    lastName: string | null; 
    email: string | null;
    profileImageUrl: string | null 
  } 
};

const industryOptions = [
  "Aerospace & Defence",
  "Agriculture & Agribusiness",
  "Automotive",
  "Construction & Engineering",
  "Education & Training",
  "Energy & Utilities",
  "Financial Services, Banking & Insurance",
  "Food & Beverage",
  "Government & Public Sector",
  "Healthcare & Life Sciences",
  "Hospitality & Tourism",
  "Information Technology & Software",
  "Legal Services",
  "Manufacturing",
  "Media & Entertainment",
  "Mining & Resources",
  "Non-Profit & NGOs",
  "Pharmaceuticals & Biotechnology",
  "Professional Services (Consulting, Advisory)",
  "Real Estate & Property Management",
  "Retail & E-Commerce",
  "Telecommunications",
  "Transportation & Logistics",
  "Other",
];

const timezoneOptions = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore",
  "Australia/Sydney"
];

export default function SettingsPage() {
  const { toast } = useToast();
  useAuth();
  const { activeClient } = useClientContext();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("personal");
  const [brandingForm, setBrandingForm] = useState({
    defaultFontFamily: "Inter, system-ui, sans-serif",
    defaultFontSize: "14px",
    primaryColor: "#1E88C8",
    secondaryColor: "#7C3AED",
    accentColor: "#22C55E",
    headingFontFamily: "Inter, system-ui, sans-serif",
    headingColor: "#111827",
    h1Size: "28px",
    h2Size: "22px",
    h3Size: "18px",
  });

  const [isThemeSaving, setIsThemeSaving] = useState(false);

  const [isOrgUnitDialogOpen, setIsOrgUnitDialogOpen] = useState(false);
  const [editingOrgUnit, setEditingOrgUnit] = useState<OrgUnit | null>(null);
  const [orgUnitForm, setOrgUnitForm] = useState({ name: "", type: "department" as string, parentId: "" as string, description: "" });
  const [expandedOrgUnits, setExpandedOrgUnits] = useState<Set<number>>(new Set());

  const [isCostCentreDialogOpen, setIsCostCentreDialogOpen] = useState(false);
  const [editingCostCentre, setEditingCostCentre] = useState<CostCentre | null>(null);
  const [costCentreForm, setCostCentreForm] = useState({ name: "", code: "", description: "", parentId: "" as string });
  const [expandedCostCentres, setExpandedCostCentres] = useState<Set<number>>(new Set());

  const { sessionReady, isAuthenticated } = useAuth();
  const { permissions, isLoading: permissionsLoading } = usePermissions();
  const tenantId = permissions?.orgId;
  const settingsAccess = getSettingsAccess(
    permissions?.platformRole,
    permissions?.isJigantoStaff,
  );
  const settingsBasePath = settingsPathForTier(settingsAccess.tier);
  const needsTenant = tenantNeedsAdminFetch(settingsAccess.tabs);
  const needsUsersData = usersDataNeeded(settingsAccess.tabs);

  useEffect(() => {
    if (permissionsLoading) return;
    const pathTier = tierFromSettingsPath(location);
    if (location === SETTINGS_PATHS.root) {
      setLocation(settingsBasePath);
      return;
    }
    if (pathTier && pathTier !== settingsAccess.tier) {
      setLocation(settingsBasePath);
    }
  }, [
    location,
    settingsAccess.tier,
    settingsBasePath,
    permissionsLoading,
    setLocation,
  ]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && settingsAccess.tabs.includes(tab as SettingsTabId)) {
      setActiveTab(tab as SettingsTabId);
    }
  }, [location, settingsAccess.tabs]);

  const handleSettingsTabChange = useCallback(
    (tab: SettingsTabId) => {
      setActiveTab(tab);
      const path = settingsPathForTier(settingsAccess.tier);
      const qs = `?tab=${encodeURIComponent(tab)}`;
      window.history.replaceState(null, "", `${path}${qs}`);
    },
    [settingsAccess.tier],
  );

  useEffect(() => {
    if (!settingsAccess.tabs.includes(activeTab)) {
      handleSettingsTabChange(settingsAccess.tabs[0]);
    }
  }, [settingsAccess.tabs, activeTab, handleSettingsTabChange]);

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", tenantId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/tenants/${tenantId}`);
      if (!res.ok) throw new Error("Failed to fetch organisation");
      return (await res.json()) as Tenant;
    },
    enabled: needsTenant && tenantId != null && sessionReady && isAuthenticated,
  });

  const { data: orgUnits = [] } = useQuery<OrgUnit[]>({
    queryKey: [`/api/settings/org-units?tenantId=${tenantId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled:
      tenantId != null &&
      sessionReady &&
      isAuthenticated &&
      settingsAccess.tabs.includes("organization"),
  });

  const createOrgUnitMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/settings/org-units", { ...data, tenantId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/settings/org-units?tenantId=${tenantId}`],
      });
      setIsOrgUnitDialogOpen(false);
      setEditingOrgUnit(null);
      resetOrgUnitForm();
      toast({ title: "Organization unit created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create organization unit.", variant: "destructive" });
    },
  });

  const updateOrgUnitMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PUT", `/api/settings/org-units/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/settings/org-units?tenantId=${tenantId}`],
      });
      setIsOrgUnitDialogOpen(false);
      setEditingOrgUnit(null);
      resetOrgUnitForm();
      toast({ title: "Organization unit updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update organization unit.", variant: "destructive" });
    },
  });

  const deleteOrgUnitMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settings/org-units/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/settings/org-units?tenantId=${tenantId}`],
      });
      toast({ title: "Organization unit deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete organization unit.", variant: "destructive" });
    },
  });

  const resetOrgUnitForm = () => {
    setOrgUnitForm({ name: "", type: "department", parentId: "", description: "" });
  };

  const openOrgUnitDialog = (parentId?: number, editUnit?: OrgUnit) => {
    if (editUnit) {
      setEditingOrgUnit(editUnit);
      setOrgUnitForm({
        name: editUnit.name,
        type: editUnit.type,
        parentId: editUnit.parentId ? String(editUnit.parentId) : "",
        description: editUnit.description || "",
      });
    } else {
      setEditingOrgUnit(null);
      resetOrgUnitForm();
      if (parentId) {
        setOrgUnitForm(prev => ({ ...prev, parentId: String(parentId) }));
      }
    }
    setIsOrgUnitDialogOpen(true);
  };

  const handleSaveOrgUnit = () => {
    if (!orgUnitForm.name.trim()) return;
    const parentIdNum = orgUnitForm.parentId && orgUnitForm.parentId !== "none" ? Number(orgUnitForm.parentId) : null;
    const payload: Record<string, unknown> = {
      name: orgUnitForm.name.trim(),
      type: orgUnitForm.type,
      parentId: Number.isNaN(parentIdNum) ? null : parentIdNum,
      description: orgUnitForm.description || null,
    };
    if (editingOrgUnit) {
      updateOrgUnitMutation.mutate({ id: editingOrgUnit.id, data: payload });
    } else {
      createOrgUnitMutation.mutate(payload);
    }
  };

  const toggleOrgUnitExpanded = (id: number) => {
    setExpandedOrgUnits(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getOrgUnitChildren = (parentId: number | null): OrgUnit[] => {
    return orgUnits.filter(u => u.parentId === parentId);
  };

  const unitTypeOrder: Record<string, number> = { group: 0, company: 1, division: 2, brand: 3, department: 4 };

  const renderOrgUnitTree = (parentId: number | null, depth: number = 0): JSX.Element[] => {
    const children = getOrgUnitChildren(parentId).sort((a, b) =>
      (unitTypeOrder[a.type] ?? 5) - (unitTypeOrder[b.type] ?? 5) || a.name.localeCompare(b.name)
    );
    const elements: JSX.Element[] = [];
    for (const unit of children) {
      const hasChildren = orgUnits.some(u => u.parentId === unit.id);
      const isExpanded = expandedOrgUnits.has(unit.id);
      elements.push(
        <div key={unit.id} style={{ paddingLeft: `${depth * 24}px` }}>
          <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover-elevate group" data-testid={`org-unit-row-${unit.id}`}>
            <button
              className="w-5 h-5 flex items-center justify-center shrink-0"
              onClick={() => toggleOrgUnitExpanded(unit.id)}
              data-testid={`button-toggle-org-${unit.id}`}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : <span className="w-3.5" />}
            </button>
            <Badge variant="secondary" className="text-xs shrink-0">{ORG_UNIT_TYPE_LABELS[unit.type as keyof typeof ORG_UNIT_TYPE_LABELS] || unit.type}</Badge>
            <span className="text-sm font-medium flex-1 min-w-0 truncate">{unit.name}</span>
            <div className="flex items-center gap-1 invisible group-hover:visible">
              <Button variant="ghost" size="icon" onClick={() => openOrgUnitDialog(unit.id)} data-testid={`button-add-child-org-${unit.id}`}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => openOrgUnitDialog(undefined, unit)} data-testid={`button-edit-org-${unit.id}`}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteOrgUnitMutation.mutate(unit.id)} data-testid={`button-delete-org-${unit.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {isExpanded && renderOrgUnitTree(unit.id, depth + 1)}
        </div>
      );
    }
    return elements;
  };

  const { data: costCentres = [] } = useQuery<CostCentre[]>({
    queryKey: [`/api/settings/cost-centres?tenantId=${tenantId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled:
      tenantId != null &&
      sessionReady &&
      isAuthenticated &&
      settingsAccess.tabs.includes("cost-centres"),
  });

  const createCostCentreMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/settings/cost-centres", { ...data, tenantId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/settings/cost-centres?tenantId=${tenantId}`],
      });
      setIsCostCentreDialogOpen(false);
      setEditingCostCentre(null);
      resetCostCentreForm();
      toast({ title: "Cost centre created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create cost centre.", variant: "destructive" });
    },
  });

  const updateCostCentreMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PUT", `/api/settings/cost-centres/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/settings/cost-centres?tenantId=${tenantId}`],
      });
      setIsCostCentreDialogOpen(false);
      setEditingCostCentre(null);
      resetCostCentreForm();
      toast({ title: "Cost centre updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update cost centre.", variant: "destructive" });
    },
  });

  const deleteCostCentreMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settings/cost-centres/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/settings/cost-centres?tenantId=${tenantId}`],
      });
      toast({ title: "Cost centre deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete cost centre.", variant: "destructive" });
    },
  });

  const resetCostCentreForm = () => {
    setCostCentreForm({ name: "", code: "", description: "", parentId: "" });
  };

  const openCostCentreDialog = (parentId?: number, editItem?: CostCentre) => {
    if (editItem) {
      setEditingCostCentre(editItem);
      setCostCentreForm({
        name: editItem.name,
        code: editItem.code || "",
        description: editItem.description || "",
        parentId: editItem.parentId ? String(editItem.parentId) : "",
      });
    } else {
      setEditingCostCentre(null);
      resetCostCentreForm();
      if (parentId) {
        setCostCentreForm(prev => ({ ...prev, parentId: String(parentId) }));
      }
    }
    setIsCostCentreDialogOpen(true);
  };

  const handleSaveCostCentre = () => {
    if (!costCentreForm.name.trim()) return;
    const parentIdNum = costCentreForm.parentId && costCentreForm.parentId !== "none" ? Number(costCentreForm.parentId) : null;
    const payload: Record<string, unknown> = {
      name: costCentreForm.name.trim(),
      code: costCentreForm.code.trim() || null,
      description: costCentreForm.description || null,
      parentId: Number.isNaN(parentIdNum) ? null : parentIdNum,
    };
    if (editingCostCentre) {
      updateCostCentreMutation.mutate({ id: editingCostCentre.id, data: payload });
    } else {
      createCostCentreMutation.mutate(payload);
    }
  };

  const toggleCostCentreExpanded = (id: number) => {
    setExpandedCostCentres(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getCostCentreChildren = (parentId: number | null): CostCentre[] => {
    return costCentres.filter(c => c.parentId === parentId);
  };

  const renderCostCentreTree = (parentId: number | null, depth: number = 0, parentIsLast: boolean[] = []): JSX.Element[] => {
    const children = getCostCentreChildren(parentId).sort((a, b) => a.name.localeCompare(b.name));
    const elements: JSX.Element[] = [];
    for (let i = 0; i < children.length; i++) {
      const cc = children[i];
      const hasChildrenNodes = costCentres.some(c => c.parentId === cc.id);
      const isExpanded = expandedCostCentres.has(cc.id);
      const isLast = i === children.length - 1;

      elements.push(
        <div key={cc.id}>
          <div className="flex items-center group" data-testid={`cost-centre-row-${cc.id}`}>
            {Array.from({ length: depth }).map((_, d) => (
              <div key={d} className="w-6 h-9 flex-shrink-0 relative">
                {!parentIsLast[d] && (
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border/50" />
                )}
              </div>
            ))}
            {depth > 0 && (
              <div className="w-6 h-9 flex-shrink-0 relative">
                <div className={cn("absolute left-3 top-0 w-px bg-border/50", isLast ? "h-[18px]" : "h-full")} />
                <div className="absolute left-3 top-[18px] h-px w-3 bg-border/50" />
              </div>
            )}
            <div className="flex items-center gap-2 py-1.5 px-2 flex-1 min-w-0 rounded-md hover-elevate border-b border-border/20">
              <button
                className="w-5 h-5 flex items-center justify-center shrink-0"
                onClick={() => toggleCostCentreExpanded(cc.id)}
                data-testid={`button-toggle-cc-${cc.id}`}
              >
                {hasChildrenNodes ? (
                  isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : <span className="w-3.5" />}
              </button>
              <span className="text-sm font-medium min-w-0 truncate">{cc.name}</span>
              {cc.code && (
                <span className="text-xs text-muted-foreground shrink-0">({cc.code})</span>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-1 invisible group-hover:visible">
                <Button variant="ghost" size="icon" onClick={() => openCostCentreDialog(cc.id)} data-testid={`button-add-child-cc-${cc.id}`}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openCostCentreDialog(undefined, cc)} data-testid={`button-edit-cc-${cc.id}`}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteCostCentreMutation.mutate(cc.id)} data-testid={`button-delete-cc-${cc.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          {isExpanded && renderCostCentreTree(cc.id, depth + 1, [...parentIsLast, isLast])}
        </div>
      );
    }
    return elements;
  };

  const { data: profiles = [], isLoading: profilesLoading } = useQuery<ProfileWithUser[]>({
    queryKey: [`/api/settings/users?tenantId=${tenantId}`],
    enabled: needsUsersData && tenantId != null && sessionReady && isAuthenticated,
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<UserRole[]>({
    queryKey: [`/api/settings/roles?tenantId=${tenantId}`],
    enabled: needsUsersData && tenantId != null && sessionReady && isAuthenticated,
  });

  const { data: invitations = [] } = useQuery<UserInvitation[]>({
    queryKey: [`/api/settings/invitations?tenantId=${tenantId}`],
    enabled: needsUsersData && tenantId != null && sessionReady && isAuthenticated,
  });

  const { data: clientWorkspaces = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: [`/api/settings/clients?tenantId=${tenantId}`],
    enabled:
      tenantId != null &&
      sessionReady &&
      isAuthenticated &&
      (settingsAccess.tabs.includes("roles") || settingsAccess.tabs.includes("users")),
  });

  const canManagePlatformRoles =
    permissions?.isJigantoStaff ||
    permissions?.platformRole === "si_super_admin" ||
    permissions?.platformRole === "client_jiganto_user";

  const [orgForm, setOrgForm] = useState({
    name: "",
    displayName: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    website: "",
    industry: "",
    timezone: "",
    licenseContactName: "",
    licenseContactEmail: "",
    supportContactName: "",
    supportContactEmail: "",
    defaultCurrency: "GBP",
    dateFormat: "DD/MM/YYYY",
    fiscalYearStart: "04-01",
    businessHoursStart: "09:00",
    businessHoursEnd: "18:00",
    vatNumber: "",
    companyRegistrationNumber: "",
    publicHolidayRegion: "",
  });

  useEffect(() => {
    if (!tenant) return;
    const branding = tenant.brandingConfig as {
      displayName?: string;
      organization?: Record<string, string | undefined>;
    } | null | undefined;
    const org = branding?.organization ?? {};
    setOrgForm({
      name: tenant.name ?? "",
      displayName: branding?.displayName ?? "",
      address: tenant.address ?? "",
      city: tenant.city ?? "",
      state: tenant.state ?? "",
      postalCode: tenant.postalCode ?? "",
      country: tenant.country ?? "",
      phone: tenant.phone ?? "",
      website: tenant.website ?? "",
      industry: tenant.industry ?? "",
      timezone: tenant.timezone ?? "",
      licenseContactName: tenant.licenseContactName ?? "",
      licenseContactEmail: tenant.licenseContactEmail ?? "",
      supportContactName: tenant.supportContactName ?? "",
      supportContactEmail: tenant.supportContactEmail ?? "",
      defaultCurrency: org.defaultCurrency ?? "GBP",
      dateFormat: org.dateFormat ?? "DD/MM/YYYY",
      fiscalYearStart: org.fiscalYearStart ?? "04-01",
      businessHoursStart: org.businessHoursStart ?? "09:00",
      businessHoursEnd: org.businessHoursEnd ?? "18:00",
      vatNumber: org.vatNumber ?? "",
      companyRegistrationNumber: org.companyRegistrationNumber ?? "",
      publicHolidayRegion: org.publicHolidayRegion ?? "",
    });
  }, [tenant]);

  const updateTenantMutation = useMutation({
    mutationFn: async (data: Partial<Tenant>) => {
      if (tenantId == null) throw new Error("Organisation context required");
      const res = await apiRequest("PUT", `/api/tenants/${tenantId}`, data);
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: "Organization updated", description: "Your organization details have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update organization.", variant: "destructive" });
    },
  });

  const handleSaveOrg = () => {
    const currentBranding = (tenant?.brandingConfig as Record<string, unknown>) || {};
    updateTenantMutation.mutate({
      name: orgForm.name || tenant?.name,
      address: orgForm.address || tenant?.address,
      city: orgForm.city || tenant?.city,
      state: orgForm.state || tenant?.state,
      postalCode: orgForm.postalCode || tenant?.postalCode,
      country: orgForm.country || tenant?.country,
      phone: orgForm.phone || tenant?.phone,
      website: orgForm.website || tenant?.website,
      industry: orgForm.industry || tenant?.industry,
      timezone: orgForm.timezone || tenant?.timezone,
      licenseContactName: orgForm.licenseContactName || tenant?.licenseContactName,
      licenseContactEmail: orgForm.licenseContactEmail || tenant?.licenseContactEmail,
      supportContactName: orgForm.supportContactName || tenant?.supportContactName,
      supportContactEmail: orgForm.supportContactEmail || tenant?.supportContactEmail,
      brandingConfig: {
        ...currentBranding,
        displayName: orgForm.displayName.trim() || undefined,
        organization: {
          ...((currentBranding.organization as Record<string, unknown>) || {}),
          defaultCurrency: orgForm.defaultCurrency || undefined,
          dateFormat: orgForm.dateFormat || undefined,
          fiscalYearStart: orgForm.fiscalYearStart || undefined,
          businessHoursStart: orgForm.businessHoursStart || undefined,
          businessHoursEnd: orgForm.businessHoursEnd || undefined,
          vatNumber: orgForm.vatNumber.trim() || undefined,
          companyRegistrationNumber: orgForm.companyRegistrationNumber.trim() || undefined,
          publicHolidayRegion: orgForm.publicHolidayRegion.trim() || undefined,
        },
      },
    } as Partial<Tenant>);
  };


  const needsOrgContext = needsTenant || needsUsersData;
  const missingOrg =
    sessionReady && isAuthenticated && !permissionsLoading && needsOrgContext && !tenantId;

  const isLoading =
    permissionsLoading ||
    (needsTenant && tenantId != null && tenantLoading) ||
    (needsUsersData && tenantId != null && (profilesLoading || rolesLoading));

  if (missingOrg) {
    return (
      <ModuleShell className={modulePageShellClass} testId="settings-page" mainClassName="h-full flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No organisation linked</CardTitle>
              <CardDescription>
                Your account is signed in but not assigned to an organisation yet. Accept an invite
                link or ask an administrator to add you.
              </CardDescription>
            </CardHeader>
          </Card>
      </ModuleShell>
    );
  }

  if (isLoading) {
    return <ModulePageLoadingShell label="Loading settings..." testId="settings-page" />;
  }

  return (
    <ModuleShell className={modulePageShellClass} testId="settings-page" mainClassName={modulePageMainClass}>
        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={Settings}
            title="Settings"
            subtitle={settingsAccess.subtitle}
            titleTestId="settings-title"
          />

          <div className={cn(modulePageTabsWrapClass, "pb-2 flex items-center gap-2 flex-wrap")}>
            <Badge variant="outline" data-testid="settings-tier-badge">
              {settingsAccess.tierLabel}
            </Badge>
          </div>
          <Tabs
            value={activeTab}
            onValueChange={(v) => handleSettingsTabChange(v as SettingsTabId)}
            className={cn(modulePageTabsWrapClass, "overflow-x-auto")}
          >
            <TabsList className={modulePageTabsListClass}>
              {settingsAccess.tabs.includes("personal") && (
                <TabsTrigger
                  value="personal"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-personal"
                >
                  <div className="p-1 rounded-md bg-status-blue">
                    <User className="h-3 w-3 text-status-blue-foreground" />
                  </div>
                  Profile
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("organization") && (
                <TabsTrigger
                  value="organization"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-organization"
                >
                  <div className="p-1 rounded-md bg-status-blue">
                    <Building2 className="h-3 w-3 text-status-blue-foreground" />
                  </div>
                  Organization
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("users") && (
                <TabsTrigger
                  value="users"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-users"
                >
                  <div className="p-1 rounded-md bg-status-green">
                    <Users className="h-3 w-3 text-status-green-foreground" />
                  </div>
                  Users
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("customers") && (
                <TabsTrigger
                  value="customers"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-customers"
                >
                  <div className="p-1 rounded-md bg-status-amber">
                    <Building2 className="h-3 w-3 text-status-amber-foreground" />
                  </div>
                  Customers
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("cost-centres") && (
                <TabsTrigger
                  value="cost-centres"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-cost-centres"
                >
                  <div className="p-1 rounded-md bg-status-purple">
                    <Wallet className="h-3 w-3 text-status-purple-foreground" />
                  </div>
                  Cost Centres
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("branding") && (
                <TabsTrigger
                  value="branding"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-branding"
                >
                  <div className="p-1 rounded-md bg-status-amber">
                    <Palette className="h-3 w-3 text-status-amber-foreground" />
                  </div>
                  Branding
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("roles") && (
                <TabsTrigger
                  value="roles"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-roles"
                >
                  <div className="p-1 rounded-md bg-status-purple">
                    <Shield className="h-3 w-3 text-status-purple-foreground" />
                  </div>
                  Roles & Permissions
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("audit") && (
                <TabsTrigger
                  value="audit"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-audit"
                >
                  <div className="p-1 rounded-md bg-status-amber">
                    <ClipboardList className="h-3 w-3 text-status-amber-foreground" />
                  </div>
                  Audit
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("integrations") && (
                <TabsTrigger
                  value="integrations"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-integrations"
                >
                  <div className="p-1 rounded-md bg-status-blue">
                    <Plug className="h-3 w-3 text-status-blue-foreground" />
                  </div>
                  Integrations
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("notifications") && (
                <TabsTrigger
                  value="notifications"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-notifications"
                >
                  <div className="p-1 rounded-md bg-status-blue">
                    <Bell className="h-3 w-3 text-status-blue-foreground" />
                  </div>
                  Notifications
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("billing") && (
                <TabsTrigger
                  value="billing"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-billing"
                >
                  <div className="p-1 rounded-md bg-status-green">
                    <CreditCard className="h-3 w-3 text-status-green-foreground" />
                  </div>
                  Billing
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("data") && (
                <TabsTrigger
                  value="data"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-data"
                >
                  <div className="p-1 rounded-md bg-status-purple">
                    <Shield className="h-3 w-3 text-status-purple-foreground" />
                  </div>
                  Data & Privacy
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("ai-usage") && (
                <TabsTrigger
                  value="ai-usage"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-ai-usage"
                >
                  <div className="p-1 rounded-md bg-status-purple">
                    <Sparkles className="h-3 w-3 text-status-purple-foreground" />
                  </div>
                  AI Usage
                </TabsTrigger>
              )}
              {settingsAccess.tabs.includes("crm") && (
                <TabsTrigger
                  value="crm"
                  className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                  data-testid="tab-crm"
                >
                  <div className="p-1 rounded-md bg-sky-100 dark:bg-sky-900/30">
                    <Building2 className="h-3 w-3 text-sky-600" />
                  </div>
                  CRM Fields
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <div className={modulePageContentOuterClass}>
          <div
            className={cn(
              modulePageContentScrollClass,
              activeTab === "users" || activeTab === "customers" || activeTab === "cost-centres"
                ? "overflow-auto"
                : "overflow-y-auto overflow-x-hidden",
            )}
          >
          <div
            className={cn(
              "p-3 sm:p-4 md:p-6",
              activeTab === "users" || activeTab === "customers" || activeTab === "cost-centres"
                ? "min-w-0 w-full"
                : "min-w-0 max-w-4xl",
            )}
          >
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTabId)}>
              <TabsContent value="personal" className="m-0">
                <SettingsPersonalTab />
              </TabsContent>
              <TabsContent value="organization" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Company Details
                    </CardTitle>
                    <CardDescription>
                      Basic information about your organization
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name (legal)</Label>
                        <Input
                          value={orgForm.name || tenant?.name || ""}
                          onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                          placeholder="Enter legal company name"
                          data-testid="input-org-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Display / trading name</Label>
                        <Input
                          value={orgForm.displayName}
                          onChange={(e) => setOrgForm({ ...orgForm, displayName: e.target.value })}
                          placeholder="Short name shown in the app header"
                          data-testid="input-org-display-name"
                        />
                        <p className="text-xs text-muted-foreground">
                          Used in the sidebar and navigation when set (e.g. &quot;Vossys SI&quot;).
                        </p>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Industry</Label>
                        <Select 
                          value={orgForm.industry || tenant?.industry || ""} 
                          onValueChange={(v) => setOrgForm({ ...orgForm, industry: v })}
                        >
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
                            {industryOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input
                        value={orgForm.address || tenant?.address || ""}
                        onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                        placeholder="Street address"
                        data-testid="input-org-address"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={orgForm.city || tenant?.city || ""}
                          onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                          placeholder="City"
                          data-testid="input-org-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State/Region</Label>
                        <Input
                          value={orgForm.state || tenant?.state || ""}
                          onChange={(e) => setOrgForm({ ...orgForm, state: e.target.value })}
                          placeholder="State"
                          data-testid="input-org-state"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Postal Code</Label>
                        <Input
                          value={orgForm.postalCode || tenant?.postalCode || ""}
                          onChange={(e) => setOrgForm({ ...orgForm, postalCode: e.target.value })}
                          placeholder="Postal code"
                          data-testid="input-org-postal"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Input
                          value={orgForm.country || tenant?.country || ""}
                          onChange={(e) => setOrgForm({ ...orgForm, country: e.target.value })}
                          placeholder="Country"
                          data-testid="input-org-country"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Select 
                          value={orgForm.timezone || tenant?.timezone || "UTC"} 
                          onValueChange={(v) => setOrgForm({ ...orgForm, timezone: v })}
                        >
                          <SelectTrigger data-testid="select-timezone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timezoneOptions.map(tz => (
                              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Default currency</Label>
                        <Input
                          value={orgForm.defaultCurrency}
                          onChange={(e) => setOrgForm({ ...orgForm, defaultCurrency: e.target.value })}
                          placeholder="GBP"
                          data-testid="input-org-currency"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Date format</Label>
                        <Select
                          value={orgForm.dateFormat}
                          onValueChange={(v) => setOrgForm({ ...orgForm, dateFormat: v })}
                        >
                          <SelectTrigger data-testid="select-date-format">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (UK/EU)</SelectItem>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Fiscal year start (MM-DD)</Label>
                        <Input
                          value={orgForm.fiscalYearStart}
                          onChange={(e) => setOrgForm({ ...orgForm, fiscalYearStart: e.target.value })}
                          placeholder="04-01"
                          data-testid="input-fiscal-year-start"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Public holidays region</Label>
                        <Input
                          value={orgForm.publicHolidayRegion}
                          onChange={(e) =>
                            setOrgForm({ ...orgForm, publicHolidayRegion: e.target.value })
                          }
                          placeholder="e.g. GB-England"
                          data-testid="input-holiday-region"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Business hours start</Label>
                        <Input
                          type="time"
                          value={orgForm.businessHoursStart}
                          onChange={(e) =>
                            setOrgForm({ ...orgForm, businessHoursStart: e.target.value })
                          }
                          data-testid="input-business-hours-start"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Business hours end</Label>
                        <Input
                          type="time"
                          value={orgForm.businessHoursEnd}
                          onChange={(e) =>
                            setOrgForm({ ...orgForm, businessHoursEnd: e.target.value })
                          }
                          data-testid="input-business-hours-end"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>VAT / tax number</Label>
                        <Input
                          value={orgForm.vatNumber}
                          onChange={(e) => setOrgForm({ ...orgForm, vatNumber: e.target.value })}
                          data-testid="input-vat-number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Company registration number</Label>
                        <Input
                          value={orgForm.companyRegistrationNumber}
                          onChange={(e) =>
                            setOrgForm({ ...orgForm, companyRegistrationNumber: e.target.value })
                          }
                          data-testid="input-company-reg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={orgForm.phone || tenant?.phone || ""}
                          onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                          placeholder="+1 (555) 123-4567"
                          data-testid="input-org-phone"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Website</Label>
                        <Input
                          value={orgForm.website || tenant?.website || ""}
                          onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
                          placeholder="https://example.com"
                          data-testid="input-org-website"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Primary Contacts</CardTitle>
                    <CardDescription>Key contacts for license renewals and support issues</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-medium">License Renewals Contact</h4>
                        <p className="text-xs text-muted-foreground">Person responsible for managing software license renewals and billing</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={orgForm.licenseContactName || tenant?.licenseContactName || ""}
                              onChange={(e) => setOrgForm({ ...orgForm, licenseContactName: e.target.value })}
                              placeholder="Full name"
                              data-testid="input-license-contact-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={orgForm.licenseContactEmail || tenant?.licenseContactEmail || ""}
                              onChange={(e) => setOrgForm({ ...orgForm, licenseContactEmail: e.target.value })}
                              placeholder="email@company.com"
                              data-testid="input-license-contact-email"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-medium">Support Issues Contact</h4>
                        <p className="text-xs text-muted-foreground">Person responsible for handling support-related issues and escalations</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={orgForm.supportContactName || tenant?.supportContactName || ""}
                              onChange={(e) => setOrgForm({ ...orgForm, supportContactName: e.target.value })}
                              placeholder="Full name"
                              data-testid="input-support-contact-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={orgForm.supportContactEmail || tenant?.supportContactEmail || ""}
                              onChange={(e) => setOrgForm({ ...orgForm, supportContactEmail: e.target.value })}
                              placeholder="email@company.com"
                              data-testid="input-support-contact-email"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button 
                        onClick={handleSaveOrg}
                        disabled={updateTenantMutation.isPending}
                        data-testid="button-save-org"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateTenantMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <Network className="h-5 w-5" />
                      Organization Structure
                    </CardTitle>
                    <CardDescription>
                      Define your organizational hierarchy: Groups, Companies, Divisions, Brands, and Departments
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const res = await fetchWithAuth("/api/settings/org-units/export");
                          if (!res.ok) return;
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `org-units-${tenantId}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        data-testid="button-export-org-units"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                      <label>
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Import CSV
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const text = await file.text();
                            const lines = text.split(/\r?\n/).filter(Boolean);
                            const rows = lines.slice(1).map((line) => {
                              const parts = line.match(/("([^"]|"")*"|[^,]*)/g) ?? [];
                              const name = (parts[1] ?? parts[0] ?? "")
                                .replace(/^"|"$/g, "")
                                .replace(/""/g, '"');
                              const type = (parts[2] ?? "department").replace(/"/g, "");
                              const parentRaw = (parts[3] ?? "").replace(/"/g, "");
                              const description = (parts[4] ?? "")
                                .replace(/^"|"$/g, "")
                                .replace(/""/g, '"');
                              return {
                                name,
                                type: type || "department",
                                parentId: parentRaw ? Number(parentRaw) : null,
                                description: description || undefined,
                              };
                            }).filter((r) => r.name);
                            const res = await apiRequest("POST", "/api/settings/org-units/import", { rows });
                            const body = await res.json();
                            toast({ title: `Imported ${body.created} org units` });
                            queryClient.invalidateQueries({
                              queryKey: [`/api/settings/org-units?tenantId=${tenantId}`],
                            });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm text-muted-foreground">
                        {orgUnits.length} unit{orgUnits.length !== 1 ? "s" : ""} defined
                      </p>
                      <Button size="sm" onClick={() => openOrgUnitDialog()} data-testid="button-add-org-unit">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Unit
                      </Button>
                    </div>

                    {orgUnits.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No organization units defined yet.</p>
                        <p className="text-xs mt-1">Start by creating a Group or Company, then add Divisions, Brands, and Departments underneath.</p>
                      </div>
                    ) : (
                      <div className="border rounded-md p-2 space-y-0.5" data-testid="org-unit-tree">
                        {renderOrgUnitTree(null)}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Dialog open={isOrgUnitDialogOpen} onOpenChange={(open) => { if (!open) { setIsOrgUnitDialogOpen(false); setEditingOrgUnit(null); resetOrgUnitForm(); } }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingOrgUnit ? "Edit Organization Unit" : "Add Organization Unit"}</DialogTitle>
                      <DialogDescription>
                        {editingOrgUnit ? "Update the details of this organizational unit." : "Create a new unit in your organizational hierarchy."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={orgUnitForm.name}
                          onChange={(e) => setOrgUnitForm({ ...orgUnitForm, name: e.target.value })}
                          placeholder="e.g. Engineering Department"
                          data-testid="input-org-unit-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select value={orgUnitForm.type} onValueChange={(v) => setOrgUnitForm({ ...orgUnitForm, type: v })}>
                            <SelectTrigger data-testid="select-org-unit-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="group">Group</SelectItem>
                              <SelectItem value="company">Company</SelectItem>
                              <SelectItem value="division">Division</SelectItem>
                              <SelectItem value="brand">Brand</SelectItem>
                              <SelectItem value="department">Department</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Parent Unit</Label>
                          <Select value={orgUnitForm.parentId || "none"} onValueChange={(v) => setOrgUnitForm({ ...orgUnitForm, parentId: v === "none" ? "" : v })}>
                            <SelectTrigger data-testid="select-org-unit-parent">
                              <SelectValue placeholder="None (top level)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (top level)</SelectItem>
                              {orgUnits.filter(u => !editingOrgUnit || u.id !== editingOrgUnit.id).map((u) => (
                                <SelectItem key={u.id} value={String(u.id)}>
                                  {ORG_UNIT_TYPE_LABELS[u.type as keyof typeof ORG_UNIT_TYPE_LABELS] || u.type}: {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={orgUnitForm.description}
                          onChange={(e) => setOrgUnitForm({ ...orgUnitForm, description: e.target.value })}
                          placeholder="Optional description"
                          data-testid="input-org-unit-description"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setIsOrgUnitDialogOpen(false); setEditingOrgUnit(null); resetOrgUnitForm(); }} data-testid="button-cancel-org-unit">
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveOrgUnit}
                        disabled={!orgUnitForm.name.trim() || createOrgUnitMutation.isPending || updateOrgUnitMutation.isPending}
                        data-testid="button-save-org-unit"
                      >
                        {(createOrgUnitMutation.isPending || updateOrgUnitMutation.isPending)
                          ? <RefreshCw className="h-4 w-4 animate-spin" />
                          : editingOrgUnit ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              <TabsContent value="branding" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Document Branding
                    </CardTitle>
                    <CardDescription>
                      Set default fonts and colors for all documents across your organization
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3 rounded-lg border p-4">
                      <Label>Organisation logo</Label>
                      <div className="flex items-center gap-4 flex-wrap">
                        {tenant?.logoUrl && (
                          <img
                            src={tenant.logoUrl}
                            alt="Organisation logo"
                            className="h-14 w-14 object-contain rounded border"
                          />
                        )}
                        <label>
                          <Button variant="outline" size="sm" asChild>
                            <span>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload PNG/SVG
                            </span>
                          </Button>
                          <input
                            type="file"
                            accept="image/png,image/svg+xml,image/jpeg"
                            className="hidden"
                            onChange={async (ev) => {
                              const file = ev.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = async () => {
                                const dataUrl = reader.result as string;
                                const res = await apiRequest("POST", "/api/settings/logo", {
                                  dataUrl,
                                });
                                if (res.ok) {
                                  queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId] });
                                  toast({ title: "Logo updated" });
                                }
                              };
                              reader.readAsDataURL(file);
                              ev.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">Shown in the app header when set.</p>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        Default Document Font
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Font Family</Label>
                          <Select
                            value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.defaultFontFamily !== "Inter, system-ui, sans-serif" ? brandingForm.defaultFontFamily : bc?.defaultFontFamily || "Inter, system-ui, sans-serif"; })()}
                            onValueChange={(v) => setBrandingForm({ ...brandingForm, defaultFontFamily: v })}
                          >
                            <SelectTrigger data-testid="select-default-font">
                              <SelectValue placeholder="Select font" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Inter, system-ui, sans-serif">Inter (Sans Serif)</SelectItem>
                              <SelectItem value="Arial, Helvetica, sans-serif">Arial</SelectItem>
                              <SelectItem value="Verdana, Geneva, sans-serif">Verdana</SelectItem>
                              <SelectItem value="Georgia, serif">Georgia</SelectItem>
                              <SelectItem value="Garamond, serif">Garamond</SelectItem>
                              <SelectItem value='Georgia, "Times New Roman", serif'>Times New Roman</SelectItem>
                              <SelectItem value='"Trebuchet MS", sans-serif'>Trebuchet MS</SelectItem>
                              <SelectItem value='"Fira Code", "Courier New", monospace'>Monospace</SelectItem>
                              <SelectItem value="Calibri, sans-serif">Calibri</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Default Font Size</Label>
                          <Select
                            value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.defaultFontSize !== "14px" ? brandingForm.defaultFontSize : bc?.defaultFontSize || "14px"; })()}
                            onValueChange={(v) => setBrandingForm({ ...brandingForm, defaultFontSize: v })}
                          >
                            <SelectTrigger data-testid="select-default-font-size">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                            <SelectContent>
                              {["10px", "11px", "12px", "14px", "16px", "18px", "20px"].map((s) => (
                                <SelectItem key={s} value={s}>{s.replace("px", "")}pt</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="p-3 rounded-md border bg-card">
                        <p className="text-xs text-muted-foreground mb-1">Preview</p>
                        <p style={{ 
                          fontFamily: brandingForm.defaultFontFamily, 
                          fontSize: brandingForm.defaultFontSize 
                        }} data-testid="font-preview">
                          The quick brown fox jumps over the lazy dog. 1234567890
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        App Theme
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Switches the whole application's look, not just documents. Safe to trial —
                        it only applies to this organisation.
                      </p>
                      <div className="space-y-2 max-w-xs">
                        <Label className="flex items-center gap-2">
                          Theme
                          {isThemeSaving && (
                            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Saving…
                            </span>
                          )}
                        </Label>
                        <Select
                          disabled={isThemeSaving}
                          value={(tenant?.brandingConfig as any)?.theme || "default"}
                          onValueChange={(v) => {
                            const currentBranding = (tenant?.brandingConfig as Record<string, unknown>) || {};
                            setIsThemeSaving(true);
                            updateTenantMutation.mutate(
                              { brandingConfig: { ...currentBranding, theme: v } } as Partial<Tenant>,
                              { onSettled: () => setIsThemeSaving(false) }
                            );
                          }}
                        >
                          <SelectTrigger data-testid="select-app-theme">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                            {ORG_THEMES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Corporate Colors
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Primary Color</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.primaryColor !== "#1E88C8" ? brandingForm.primaryColor : bc?.primaryColor || "#1E88C8"; })()}
                              onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                              className="w-10 h-8 rounded-md border cursor-pointer p-0"
                              data-testid="input-primary-color"
                            />
                            <Input
                              value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.primaryColor !== "#1E88C8" ? brandingForm.primaryColor : bc?.primaryColor || "#1E88C8"; })()}
                              onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                              className="h-8 font-mono text-xs flex-1"
                              data-testid="input-primary-color-hex"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Secondary Color</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.secondaryColor !== "#7C3AED" ? brandingForm.secondaryColor : bc?.secondaryColor || "#7C3AED"; })()}
                              onChange={(e) => setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })}
                              className="w-10 h-8 rounded-md border cursor-pointer p-0"
                              data-testid="input-secondary-color"
                            />
                            <Input
                              value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.secondaryColor !== "#7C3AED" ? brandingForm.secondaryColor : bc?.secondaryColor || "#7C3AED"; })()}
                              onChange={(e) => setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })}
                              className="h-8 font-mono text-xs flex-1"
                              data-testid="input-secondary-color-hex"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Accent Color</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.accentColor !== "#22C55E" ? brandingForm.accentColor : bc?.accentColor || "#22C55E"; })()}
                              onChange={(e) => setBrandingForm({ ...brandingForm, accentColor: e.target.value })}
                              className="w-10 h-8 rounded-md border cursor-pointer p-0"
                              data-testid="input-accent-color"
                            />
                            <Input
                              value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.accentColor !== "#22C55E" ? brandingForm.accentColor : bc?.accentColor || "#22C55E"; })()}
                              onChange={(e) => setBrandingForm({ ...brandingForm, accentColor: e.target.value })}
                              className="h-8 font-mono text-xs flex-1"
                              data-testid="input-accent-color-hex"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-md border bg-card space-y-3" data-testid="corporate-colors-preview">
                        <p className="text-xs text-muted-foreground mb-2">Preview</p>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-md shadow-sm" style={{ backgroundColor: brandingForm.primaryColor }} />
                            <span className="text-[10px] text-muted-foreground">Primary</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-md shadow-sm" style={{ backgroundColor: brandingForm.secondaryColor }} />
                            <span className="text-[10px] text-muted-foreground">Secondary</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-md shadow-sm" style={{ backgroundColor: brandingForm.accentColor }} />
                            <span className="text-[10px] text-muted-foreground">Accent</span>
                          </div>
                        </div>
                        <div className="rounded-md border overflow-hidden">
                          <div className="h-2" style={{ background: `linear-gradient(90deg, ${brandingForm.primaryColor} 0%, ${brandingForm.secondaryColor} 50%, ${brandingForm.accentColor} 100%)` }} />
                          <div className="p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: brandingForm.primaryColor }}>Document Title</span>
                              <Badge variant="outline" className="text-[10px]" style={{ borderColor: brandingForm.accentColor, color: brandingForm.accentColor }}>Published</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground" style={{ fontFamily: brandingForm.defaultFontFamily }}>
                              This preview shows how your corporate colors will appear across documents, headers, and UI elements.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <div className="h-6 px-3 rounded-md flex items-center justify-center" style={{ backgroundColor: brandingForm.primaryColor }}>
                                <span className="text-[10px] text-white font-medium">Primary Button</span>
                              </div>
                              <div className="h-6 px-3 rounded-md flex items-center justify-center border" style={{ borderColor: brandingForm.secondaryColor, color: brandingForm.secondaryColor }}>
                                <span className="text-[10px] font-medium">Secondary</span>
                              </div>
                              <div className="h-6 px-3 rounded-md flex items-center justify-center" style={{ backgroundColor: brandingForm.accentColor }}>
                                <span className="text-[10px] text-white font-medium">Accent</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-semibold">Heading Styles</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Heading Font</Label>
                          <Select
                            value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.headingFontFamily !== "Inter, system-ui, sans-serif" ? brandingForm.headingFontFamily : bc?.headingFontFamily || "Inter, system-ui, sans-serif"; })()}
                            onValueChange={(v) => setBrandingForm({ ...brandingForm, headingFontFamily: v })}
                          >
                            <SelectTrigger data-testid="select-heading-font">
                              <SelectValue placeholder="Select font" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Inter, system-ui, sans-serif">Inter (Sans Serif)</SelectItem>
                              <SelectItem value="Arial, Helvetica, sans-serif">Arial</SelectItem>
                              <SelectItem value="Georgia, serif">Georgia</SelectItem>
                              <SelectItem value='Georgia, "Times New Roman", serif'>Times New Roman</SelectItem>
                              <SelectItem value="Calibri, sans-serif">Calibri</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Heading Color</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.headingColor !== "#111827" ? brandingForm.headingColor : bc?.headingColor || "#111827"; })()}
                              onChange={(e) => setBrandingForm({ ...brandingForm, headingColor: e.target.value })}
                              className="w-10 h-8 rounded-md border cursor-pointer p-0"
                              data-testid="input-heading-color"
                            />
                            <Input
                              value={(() => { const bc = (tenant?.brandingConfig as any); return brandingForm.headingColor !== "#111827" ? brandingForm.headingColor : bc?.headingColor || "#111827"; })()}
                              onChange={(e) => setBrandingForm({ ...brandingForm, headingColor: e.target.value })}
                              className="h-8 font-mono text-xs flex-1"
                              data-testid="input-heading-color-hex"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-md border bg-card space-y-3" data-testid="heading-styles-preview">
                        <p className="text-xs text-muted-foreground mb-2">Preview</p>
                        <div className="rounded-md border overflow-hidden">
                          <div className="h-1.5" style={{ backgroundColor: brandingForm.primaryColor }} />
                          <div className="p-4 space-y-3">
                            <h1 className="text-xl font-bold" style={{ fontFamily: brandingForm.headingFontFamily, color: brandingForm.headingColor }}>
                              Heading 1 - Document Title
                            </h1>
                            <p className="text-xs text-muted-foreground" style={{ fontFamily: brandingForm.defaultFontFamily, fontSize: brandingForm.defaultFontSize }}>
                              Body text using your default font appears below headings in documents.
                            </p>
                            <h2 className="text-lg font-semibold" style={{ fontFamily: brandingForm.headingFontFamily, color: brandingForm.headingColor }}>
                              Heading 2 - Section Title
                            </h2>
                            <p className="text-xs text-muted-foreground" style={{ fontFamily: brandingForm.defaultFontFamily, fontSize: brandingForm.defaultFontSize }}>
                              More body content with your selected font and size settings.
                            </p>
                            <h3 className="text-base font-medium" style={{ fontFamily: brandingForm.headingFontFamily, color: brandingForm.headingColor }}>
                              Heading 3 - Subsection
                            </h3>
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-8 rounded-full" style={{ backgroundColor: brandingForm.primaryColor }} />
                              <p className="text-xs text-muted-foreground italic" style={{ fontFamily: brandingForm.defaultFontFamily }}>
                                Blockquote styled with your primary color accent
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={() => {
                          const currentBranding = (tenant?.brandingConfig as any) || {};
                          updateTenantMutation.mutate({
                            brandingConfig: { ...currentBranding, ...brandingForm },
                          } as any);
                        }}
                        disabled={updateTenantMutation.isPending}
                        data-testid="button-save-branding"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateTenantMutation.isPending ? "Saving..." : "Save Branding"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="m-0 min-w-0 w-full">
                {tenantId != null && (
                  <SettingsUsersTab
                    profiles={profiles}
                    roles={roles}
                    invitations={invitations}
                    tenantId={tenantId}
                    clients={clientWorkspaces}
                  />
                )}
              </TabsContent>

              <TabsContent value="customers" className="m-0">
                {tenantId != null && (
                  <SettingsCustomersTab
                    profiles={profiles}
                    roles={roles}
                    tenantId={tenantId}
                  />
                )}
              </TabsContent>

              <TabsContent value="cost-centres" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Wallet className="h-5 w-5" />
                          Cost Centre Hierarchy
                        </CardTitle>
                        <CardDescription>
                          Define and manage your organization's cost centre structure for financial tracking and reporting
                        </CardDescription>
                      </div>
                      <Button onClick={() => openCostCentreDialog()} data-testid="button-add-cost-centre">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Cost Centre
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {costCentres.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="text-no-cost-centres">
                        <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No cost centres defined yet</p>
                        <p className="text-xs mt-1">Click "Add Cost Centre" to create your first cost centre</p>
                      </div>
                    ) : (
                      <div className="space-y-0.5" data-testid="cost-centre-tree">
                        {renderCostCentreTree(null)}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Dialog open={isCostCentreDialogOpen} onOpenChange={(open) => { setIsCostCentreDialogOpen(open); if (!open) { setEditingCostCentre(null); resetCostCentreForm(); } }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCostCentre ? "Edit Cost Centre" : "Add Cost Centre"}</DialogTitle>
                      <DialogDescription>
                        {editingCostCentre ? "Update cost centre details" : "Create a new cost centre in the hierarchy"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                          value={costCentreForm.name}
                          onChange={(e) => setCostCentreForm({ ...costCentreForm, name: e.target.value })}
                          placeholder="e.g., Marketing, Engineering"
                          data-testid="input-cost-centre-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input
                          value={costCentreForm.code}
                          onChange={(e) => setCostCentreForm({ ...costCentreForm, code: e.target.value })}
                          placeholder="e.g., CC-100, MKT-01"
                          data-testid="input-cost-centre-code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={costCentreForm.description}
                          onChange={(e) => setCostCentreForm({ ...costCentreForm, description: e.target.value })}
                          placeholder="Optional description"
                          data-testid="input-cost-centre-description"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Parent Cost Centre</Label>
                        <Select
                          value={costCentreForm.parentId || "none"}
                          onValueChange={(v) => setCostCentreForm({ ...costCentreForm, parentId: v === "none" ? "" : v })}
                        >
                          <SelectTrigger data-testid="select-cost-centre-parent">
                            <SelectValue placeholder="Select parent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (top level)</SelectItem>
                            {costCentres
                              .filter(cc => cc.id !== editingCostCentre?.id)
                              .map(cc => (
                                <SelectItem key={cc.id} value={String(cc.id)}>
                                  {cc.name}{cc.code ? ` (${cc.code})` : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setIsCostCentreDialogOpen(false); setEditingCostCentre(null); resetCostCentreForm(); }}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveCostCentre}
                        disabled={!costCentreForm.name.trim() || createCostCentreMutation.isPending || updateCostCentreMutation.isPending}
                        data-testid="button-save-cost-centre"
                      >
                        {editingCostCentre ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              <TabsContent value="roles" className="m-0 space-y-6">
                <SettingsRolesOverview canManagePlatformRoles={canManagePlatformRoles} />
                {tenantId != null && <SettingsImpersonationTab tenantId={tenantId} />}
                {canManagePlatformRoles && tenantId != null && (
                  <>
                    <SettingsPlatformRolesTab
                      tenantId={tenantId}
                      clients={clientWorkspaces.map((c) => ({ id: c.id, name: c.name }))}
                    />
                    <SettingsClientWorkspaceGrants
                      tenantId={tenantId}
                      clients={clientWorkspaces.map((c) => ({ id: c.id, name: c.name }))}
                    />
                    <SettingsPlatformRolesMatrix />
                  </>
                )}
                <SettingsWorkspaceRolesGuide />
                {activeClient && <SettingsClientWorkspaceTab />}
                {tenantId != null && <SettingsModuleRolesTab tenantId={tenantId} />}
              </TabsContent>

              <TabsContent value="audit" className="m-0 space-y-6">
                {tenantId != null && <SettingsStaffAuditTab tenantId={tenantId} />}
              </TabsContent>

              <TabsContent value="integrations" className="m-0">
                {tenantId != null && (
                  <SettingsIntegrationsTab tenantId={tenantId} tenant={tenant} />
                )}
              </TabsContent>

              <TabsContent value="notifications" className="m-0">
                {tenantId != null && (
                  <SettingsOrgNotificationsTab tenantId={tenantId} tenant={tenant} />
                )}
              </TabsContent>

              <TabsContent value="ai-usage" className="m-0">
                {tenantId != null && <SettingsAiUsageTab tenantId={tenantId} />}
              </TabsContent>

              <TabsContent value="billing" className="m-0">
                {tenantId != null && (
                  <SettingsBillingTab tenantId={tenantId} tenant={tenant} />
                )}
              </TabsContent>

              <TabsContent value="data" className="m-0">
                {tenantId != null && (
                  <SettingsDataGovernanceTab tenantId={tenantId} tenant={tenant} />
                )}
              </TabsContent>

              <TabsContent value="crm" className="m-0">
                <CrmCustomFieldsSettings />
              </TabsContent>
            </Tabs>
          </div>
          </div>
        </div>
    </ModuleShell>
  );
}
