import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "../db";
import { shouldRunDatabaseMiddleware } from "../lib/request-paths";
import {
  isSessionAuthUser,
  registerSessionAuthRoutes,
  sessionSecretOrThrow,
  useSecureCookies,
} from "./sessionAuth";
import {
  attachSupabaseIdentity,
  isSupabaseAuthUser,
  authMode,
} from "./supabaseAuth";
import { isDevLoginEnabled } from "./devLogin";

const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const PgSession = connectPg(session);
const sessionStore = new PgSession({
  pool,
  createTableIfMissing: false,
  ttl: sessionTtl,
  tableName: "sessions",
});

const sessionMiddleware = session({
  secret: sessionSecretOrThrow(),
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax",
    maxAge: sessionTtl,
  },
});

/** Session middleware (shared pool). Exported for tests or custom mounting. */
export function getSession() {
  return sessionMiddleware;
}

/** Skip Postgres session lookup for Vite module requests (/src/*, etc.). */
const conditionalSession: RequestHandler = (req, res, next) => {
  if (!shouldRunDatabaseMiddleware(req.path)) {
    return next();
  }
  return sessionMiddleware(req, res, next);
};

const conditionalPassportSession: RequestHandler = (req, res, next) => {
  if (!shouldRunDatabaseMiddleware(req.path)) {
    return next();
  }
  return passport.session()(req, res, next);
};

export async function setupAuth(app: Express): Promise<void> {
  app.set("trust proxy", 1);
  app.use(conditionalSession);
  app.use(passport.initialize());
  app.use(conditionalPassportSession);
  app.use(attachSupabaseIdentity);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  registerSessionAuthRoutes(app);

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });

  const port = process.env.PORT || "5000";
  const mode = authMode();
  if (mode === "supabase") {
    console.log(`[auth] Supabase auth ready on http://localhost:${port}`);
  } else {
    console.log(
      `[auth] Session auth ready — sign in at http://localhost:${port}/api/login`,
    );
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as { expires_at?: number } | undefined;
  const now = Math.floor(Date.now() / 1000);
  const sessionValid = Boolean(user?.expires_at && user.expires_at > now);

  if (sessionValid && isSupabaseAuthUser(user)) {
    return next();
  }

  const devSessionOk =
    sessionValid &&
    req.isAuthenticated?.() &&
    isSessionAuthUser(user) &&
    (process.env.NODE_ENV !== "production" || isDevLoginEnabled());

  if (devSessionOk) {
    return next();
  }

  if (authMode() === "supabase") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.status(401).json({ message: "Unauthorized" });
};
