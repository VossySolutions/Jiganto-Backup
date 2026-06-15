import { useEffect } from "react";
import { useParams, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function HelpDeskCsatPage() {
  const { token } = useParams<{ token: string }>();
  const search = useSearch();
  const optOut = new URLSearchParams(search).get("optout") === "1";

  const { data: state, isLoading } = useQuery({
    queryKey: ["/api/help-desk/csat", token],
    queryFn: () => fetch(`/api/help-desk/csat/${token}`).then((r) => r.json()),
    enabled: !!token,
  });

  const submit = useMutation({
    mutationFn: () => fetch(`/api/help-desk/csat/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optOut }),
    }).then((r) => r.json()),
  });

  useEffect(() => {
    if (optOut && token) submit.mutate();
  }, [optOut, token]);

  useEffect(() => {
    if (state?.surveyUrl && !state.submitted && !optOut) {
      window.location.replace(state.surveyUrl);
    }
  }, [state, optOut]);

  if (isLoading || submit.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-600 to-sky-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (state?.submitted || submit.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-600 to-sky-900 p-4">
        <div className="bg-white dark:bg-card rounded-2xl p-10 text-center max-w-md">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Thank you!</h1>
          <p className="text-muted-foreground">Your feedback helps us improve.</p>
        </div>
      </div>
    );
  }

  if (state?.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-600 to-sky-900 p-4">
        <div className="bg-white dark:bg-card rounded-2xl p-8 text-center max-w-md">
          <p className="text-muted-foreground">This survey has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-600 to-sky-900 p-4">
      <div className="bg-white dark:bg-card rounded-2xl p-8 w-full max-w-md shadow-xl text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4 text-sky-600" />
        <p className="text-sm text-muted-foreground">Redirecting to Module 17 satisfaction survey…</p>
        {state?.surveyUrl && (
          <Button className="mt-4 w-full bg-sky-600 hover:bg-sky-700" asChild>
            <a href={state.surveyUrl}>Open Survey</a>
          </Button>
        )}
      </div>
    </div>
  );
}
