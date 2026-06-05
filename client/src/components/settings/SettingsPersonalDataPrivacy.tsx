import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Download, ExternalLink } from "lucide-react";
import { useCurrentOrganisation } from "@/hooks/use-jiganto";

type DataGovernanceConfig = {
  allowSelfServiceExport?: boolean;
  privacyPolicyUrl?: string;
  dpoEmail?: string;
};

export default function SettingsPersonalDataPrivacy() {
  const { toast } = useToast();
  const { data: organisation } = useCurrentOrganisation();
  const dg = (organisation?.brandingConfig as { dataGovernance?: DataGovernanceConfig })
    ?.dataGovernance;

  const requestExport = async () => {
    try {
      const res = await fetchWithAuth("/api/settings/data-export", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();
      toast({
        title: "Export requested",
        description: body.message ?? "Your organisation admin will process this request.",
      });
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    }
  };

  const downloadExport = async (format: "json" | "zip") => {
    try {
      const res = await fetchWithAuth(
        `/api/settings/data-export/download?format=${format}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "zip" ? "jiganto-personal-data.zip" : "jiganto-personal-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Download started",
        description:
          format === "zip"
            ? "ZIP contains export.json and readme."
            : "JSON export of your profile and notifications.",
      });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  if (!dg?.allowSelfServiceExport && !dg?.privacyPolicyUrl && !dg?.dpoEmail) {
    return null;
  }

  return (
    <Card data-testid="settings-personal-data-privacy">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Data & privacy
        </CardTitle>
        <CardDescription>Your rights regarding personal data in this organisation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {dg.privacyPolicyUrl && (
          <p>
            <a
              href={dg.privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              Privacy policy <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
        {dg.dpoEmail && (
          <p className="text-muted-foreground">
            Data protection contact:{" "}
            <a href={`mailto:${dg.dpoEmail}`} className="text-primary hover:underline">
              {dg.dpoEmail}
            </a>
          </p>
        )}
        {dg.allowSelfServiceExport && (
          <div className="pt-2 flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => downloadExport("zip")}
              data-testid="button-download-export-zip"
            >
              <Download className="h-4 w-4 mr-2" />
              Download ZIP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadExport("json")}
              data-testid="button-download-export-json"
            >
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={requestExport} data-testid="button-request-export">
              Log admin request
            </Button>
            <p className="text-xs text-muted-foreground w-full mt-2">
              Export includes profile and in-app notifications.
            </p>
          </div>
        )}
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetchWithAuth("/api/settings/data-erasure-request", {
                  method: "POST",
                });
                if (!res.ok) throw new Error(await res.text());
                toast({
                  title: "Erasure requested",
                  description: "An administrator will review your request.",
                });
              } catch {
                toast({ title: "Request failed", variant: "destructive" });
              }
            }}
            data-testid="button-request-erasure"
          >
            Request account erasure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
