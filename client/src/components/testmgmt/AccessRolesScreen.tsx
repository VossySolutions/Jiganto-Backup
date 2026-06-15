import { ShieldCheck, User, FlaskConical, Bug, Eye } from "lucide-react";
import { useTmProject } from "@/contexts/TmProjectContext";

const ROLES = [
  { id: "test_manager", label: "Test Manager", icon: ShieldCheck, desc: "Create cycles, assign cases, sign off areas and cycles" },
  { id: "tester", label: "Tester", icon: FlaskConical, desc: "Execute tests, record results, attach evidence, raise defects" },
  { id: "functional_consultant", label: "Functional Consultant", icon: User, desc: "Author scenarios and test cases, review traceability" },
  { id: "guest", label: "External Guest", icon: Eye, desc: "Read-only access to dashboards and signed-off results" },
];

export function AccessRolesScreen() {
  const { activeProject } = useTmProject();

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl w-full">
      <div>
        <h2 className="text-xl font-semibold">Access & Roles</h2>
        <p className="text-sm text-muted-foreground">
          Project-scoped roles for {activeProject?.name ?? "this project"}. Role assignment uses the organisation permissions module.
        </p>
      </div>
      <div className="grid gap-3">
        {ROLES.map(role => (
          <div key={role.id} className="border border-border rounded-xl p-4 flex gap-4 items-start bg-card">
            <div className="bg-primary/10 rounded-lg p-2"><role.icon className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="font-medium text-sm">{role.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{role.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 border border-dashed rounded-lg p-3">
        <Bug className="h-3.5 w-3.5" />
        Defect triage and Help Desk ticket access inherit from Help Desk agent permissions.
      </div>
    </div>
  );
}
