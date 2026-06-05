type AuthLikeError = {
  message?: string;
  status?: number;
  code?: string;
};

/** User-facing message for Supabase Auth errors (sign-in / sign-up). */
export function formatAuthError(error: AuthLikeError, mode: "signin" | "signup"): string {
  if (error.status === 429) {
    return "Too many attempts. Wait 5–10 minutes, then try again. If you already created an account, use Sign in.";
  }

  const msg = error.message ?? "Authentication failed.";
  const code = error.code ?? "";

  if (code === "signup_disabled" || /sign.?up.*disabled/i.test(msg)) {
    return "Sign-ups are turned off in Supabase. Enable them under Authentication → Providers → Email → Allow new users to sign up.";
  }

  if (mode === "signup" && (/already registered|already been registered|already exists/i.test(msg) || code === "user_already_exists")) {
    return "This email is already registered. Switch to Sign in and use the same password.";
  }

  if (/password/i.test(msg) && /weak|short|least|characters/i.test(msg)) {
    return msg;
  }

  if (/invalid login credentials/i.test(msg) && mode === "signin") {
    return "Wrong email or password. If you just signed up, confirm your email first (or turn off Confirm email in Supabase for local testing).";
  }

  return msg;
}

export function isValidSignupPassword(password: string): string | null {
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}
