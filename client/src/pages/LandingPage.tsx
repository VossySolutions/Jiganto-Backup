import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Layers, Shield, Sparkles, UserCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { PLATFORM_ROLE_LABELS } from "@shared/models/permissions";
import type { PlatformRole } from "@shared/models/permissions";
import { formatAuthError, isValidSignupPassword } from "@/lib/auth-errors";
import { syncAppUserToDatabase } from "@/lib/sync-app-user";
import { supabase, supabaseAuthEnabled } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  getPendingInviteToken,
  redirectAfterAuth,
  savePendingInviteToken,
} from "@/lib/pending-invite";

type DevPreset = {
  preset: string;
  label: string;
  email: string;
  platformRole: PlatformRole;
  summary: string;
  loginPath: string;
};

type AuthConfig = {
  loginPath: string;
  mode?: "supabase" | "dev-session";
  supabaseAuth?: boolean;
  devLogin?: boolean;
  presets?: DevPreset[];
};

async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch("/api/auth/config");
  if (!res.ok) {
    return { loginPath: "/api/login" };
  }
  return res.json();
}

export function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authIsError, setAuthIsError] = useState(false);

  const pendingInviteToken = (() => {
    const fromUrl = new URLSearchParams(window.location.search).get("invite");
    const token = fromUrl || getPendingInviteToken();
    return token ? decodeURIComponent(token) : null;
  })();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email")?.trim().toLowerCase();
    if (emailParam) setEmail(emailParam);
    const inviteParam = params.get("invite");
    if (inviteParam) savePendingInviteToken(decodeURIComponent(inviteParam));
  }, []);

  const invitePreviewQuery = useQuery({
    queryKey: ["/api/auth/invitations/preview", pendingInviteToken],
    enabled: !!pendingInviteToken,
    queryFn: async () => {
      const res = await fetch(
        `/api/auth/invitations/${encodeURIComponent(pendingInviteToken)}/preview`,
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json() as Promise<{ email: string }>;
    },
  });

  useEffect(() => {
    const invited = invitePreviewQuery.data?.email?.trim().toLowerCase();
    if (invited) setEmail(invited);
  }, [invitePreviewQuery.data?.email]);

  const { data: authConfig } = useQuery({
    queryKey: ["/api/auth/config"],
    queryFn: fetchAuthConfig,
    staleTime: Infinity,
  });

  const loginPath = authConfig?.loginPath ?? "/api/login";
  const mode = authConfig?.mode ?? "dev-session";
  const devPresets = authConfig?.devLogin ? authConfig.presets ?? [] : [];
  const canUseSupabase = mode === "supabase" && supabaseAuthEnabled && !!supabase;

  async function handleEmailAuth(): Promise<void> {
    if (!supabase) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setAuthIsError(true);
      setAuthMessage("Enter both email and password.");
      return;
    }
    if (authMode === "signup") {
      const passwordError = isValidSignupPassword(password);
      if (passwordError) {
        setAuthIsError(true);
        setAuthMessage(passwordError);
        return;
      }
    }
    setAuthBusy(true);
    setAuthMessage(null);
    setAuthIsError(false);
    try {
      if (authMode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) {
          setAuthIsError(true);
          setAuthMessage(formatAuthError(error, "signin"));
          return;
        }
        await syncAppUserToDatabase();
        redirectAfterAuth();
        return;
      }

      // Do not pass emailRedirectTo unless that URL is in Supabase → Auth → URL Configuration.
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      if (error) {
        setAuthIsError(true);
        const message = formatAuthError(error, "signup");
        setAuthMessage(message);
        if (/already registered/i.test(message)) {
          setAuthMode("signin");
        }
        return;
      }
      if (data.session) {
        await syncAppUserToDatabase(data.session.access_token);
        redirectAfterAuth();
        return;
      }
      setAuthIsError(false);
      setAuthMessage(
        "Account created. If email confirmation is enabled in Supabase, check your inbox, then sign in.",
      );
      setAuthMode("signin");
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <div className="w-full md:w-1/2 lg:w-[55%] relative overflow-hidden bg-[#0A0F1E] text-white p-8 md:p-16 flex flex-col justify-between">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-ai/20 rounded-full blur-[100px]" />

        <div className="relative z-10 flex items-center gap-3">
          <img src="/jiganto-logo.png" alt="Jiganto" className="h-10 w-10 rounded-full" />
          <span className="text-xl font-bold font-display tracking-tight" style={{ color: "#009EE2" }}>
            Jiganto
          </span>
        </div>

        <div className="relative z-10 max-w-xl mt-12 md:mt-0">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI-Native Enterprise Platform</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold leading-[1.1] mb-6">
              Orchestrate your entire enterprise with{" "}
              <span style={{ color: "hsl(203, 74%, 55%)" }}>Intelligence.</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed mb-8">
              The unified platform for Professional Services, ERP, SaaS management, and IT projects.
            </p>
            <div className="flex flex-col gap-4">
              {[
                "Six platform roles for SI firms and clients",
                "Separate data per client workspace",
                "Sign in as different users in development",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-300">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 text-xs text-gray-500 mt-12">
          © 2024 Jiganto Inc. All rights reserved.
        </div>
      </div>

      <div className="w-full md:w-1/2 lg:w-[45%] bg-background p-8 md:p-16 flex flex-col justify-center items-center overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold font-display tracking-tight">Welcome</h2>
            <p className="text-muted-foreground">
              {pendingInviteToken
                ? "Sign in or create an account to accept your organisation invitation"
                : devPresets.length > 0
                  ? "Choose a role to sign in (development)"
                  : canUseSupabase
                    ? "Sign in with your organisation account"
                    : "Sign in to your enterprise workspace"}
            </p>
            {pendingInviteToken && invitePreviewQuery.data?.email && (
              <p className="text-sm text-primary font-medium">
                Invitation for {invitePreviewQuery.data.email}
              </p>
            )}
          </div>

          {devPresets.length > 0 ? (
            <div className="space-y-2">
              {pendingInviteToken && (
                <p className="text-xs text-amber-600 dark:text-amber-400 px-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                  You have a pending invitation. Use <strong>email sign-in</strong> below with the
                  invited address — dev role presets use different emails and will not accept the invite.
                </p>
              )}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                Sign in as — 6 platform roles
              </p>
              {devPresets.map((p) => (
                <Button
                  key={p.preset}
                  variant="outline"
                  className="w-full h-auto py-3 px-4 flex flex-col items-start gap-1 rounded-xl text-left"
                  onClick={() => {
                    window.location.href = p.loginPath;
                  }}
                  data-testid={`login-preset-${p.preset}`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <UserCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm">{p.label}</span>
                    <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {PLATFORM_ROLE_LABELS[p.platformRole]}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">{p.summary}</span>
                  <span className="text-[10px] text-muted-foreground pl-6">{p.email}</span>
                </Button>
              ))}
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                After sign-in, your role appears under your name in the sidebar. Use{" "}
                <strong>Log out</strong> to pick another role.
              </p>
            </div>
          ) : canUseSupabase ? (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Password</label>
                <input
                  type="password"
                  className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                />
              </div>
              <Button
                className="w-full h-12 text-base font-semibold rounded-xl bg-primary shadow-lg shadow-primary/20"
                onClick={() => {
                  void handleEmailAuth();
                }}
                disabled={authBusy}
              >
                {authBusy
                  ? "Please wait..."
                  : authMode === "signin"
                    ? "Sign in"
                    : "Create account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <button
                className="w-full text-xs text-primary hover:underline"
                onClick={() => {
                  setAuthMode((prev) => (prev === "signin" ? "signup" : "signin"));
                  setAuthMessage(null);
                  setAuthIsError(false);
                }}
                disabled={authBusy}
              >
                {authMode === "signin"
                  ? "No account? Create one"
                  : "Already have an account? Sign in"}
              </button>
              {authMessage && (
                <p
                  className={`text-center text-xs ${authIsError ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {authMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <Button
                className="w-full h-12 text-base font-semibold rounded-xl bg-primary shadow-lg shadow-primary/20"
                onClick={() => {
                  window.location.href = loginPath;
                }}
              >
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Production uses your organisation&apos;s identity provider. There is no public self-sign-up
                in this build.
              </p>
            </div>
          )}

          <div className="pt-8 flex justify-center gap-8 opacity-50">
            <Shield className="h-8 w-8 text-muted-foreground" />
            <Layers className="h-8 w-8 text-muted-foreground" />
            <Database className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Database(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}
