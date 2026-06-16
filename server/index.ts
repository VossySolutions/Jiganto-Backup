import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);
httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 70000;
httpServer.requestTimeout = 300000;
httpServer.timeout = 300000;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const isMultipartOrStreamUpload = (req: any) => {
  const ct = req.headers["content-type"] || "";
  if (ct.startsWith("multipart/form-data")) return true;
  if (req.method === "POST" && /^\/api\/documents\/\d+\/content$/.test(req.path)) return true;
  return false;
};

const isStripeWebhook = (req: any) =>
  req.method === "POST" && req.path === "/api/customer-mgmt/stripe/webhook";

// Compress all responses except SSE streams (those need flush control)
app.use(compression({
  filter: (req, res) => {
    if (req.headers["accept"] === "text/event-stream") return false;
    return compression.filter(req, res);
  },
}));

app.post(
  "/api/customer-mgmt/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    import("./customer-management/stripe")
      .then(({ handleStripeWebhook }) => handleStripeWebhook(req, res))
      .catch(next);
  },
);

app.use((req, res, next) => {
  if (isStripeWebhook(req) || isMultipartOrStreamUpload(req)) return next();
  express.json({
    limit: "50mb",
    verify: (req: any, _res: any, buf: any) => {
      req.rawBody = buf;
    },
  })(req, res, next);
});

app.use((req, res, next) => {
  if (isStripeWebhook(req) || isMultipartOrStreamUpload(req)) return next();
  express.urlencoded({ extended: false, limit: "50mb" })(req, res, next);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const logResponseBody =
    process.env.LOG_API_BODY === "true" || process.env.NODE_ENV !== "production";
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  if (logResponseBody) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (logResponseBody && capturedJsonResponse) {
        const jsonStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${jsonStr.length > 2000 ? jsonStr.slice(0, 2000) + "...[truncated]" : jsonStr}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  const { startPlatformBackgroundJobs } = await import("./lib/platform-jobs");
  startPlatformBackgroundJobs();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
    const { initializeWhiteboardWebSocket } = await import("./whiteboard/websocket");
    initializeWhiteboardWebSocket(httpServer);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST ?? "0.0.0.0";

  const onListen = () => {
      log(`serving on port ${port}`);
      if (process.env.NODE_ENV === "development" && process.env.AUTO_SEED_TM !== "false") {
      // Auto-seed TM demo data if not already present, then migrate to project
      setTimeout(async () => {
        try {
          const seedRes = await fetch(`http://localhost:${port}/api/tm/seed-demo`, { method: "POST" });
          if (seedRes.status === 409) {
            log("TM demo data already present — skipping auto-seed", "seed");
          } else if (seedRes.ok) {
            const body = await seedRes.json() as any;
            log(`TM demo data auto-seeded: ${body.suites} suites, ${body.cases} cases, ${body.defects} defects, ${body.requirements} requirements`, "seed");
          } else {
            const text = await seedRes.text();
            log(`TM auto-seed failed (${seedRes.status}): ${text}`, "seed");
          }
          // Always run migration to ensure project linkage is up to date
          const migrateRes = await fetch(`http://localhost:${port}/api/tm/migrate-project`, { method: "POST" });
          if (migrateRes.ok) {
            const mb = await migrateRes.json() as any;
            log(`TM project ready: "${mb.project?.name}" (id=${mb.project?.id})`, "seed");
          }
          // Apply TM schema extensions (idempotent)
          const schemaRes = await fetch(`http://localhost:${port}/api/tm/migrate-schema`, { method: "POST" });
          if (schemaRes.ok) {
            const sb = await schemaRes.json() as any;
            log(`TM schema patched (${sb.executed ?? 0} statements)`, "seed");
          }
          // Seed demo scenarios if none exist
          const scenariosRes = await fetch(`http://localhost:${port}/api/tm/seed-scenarios`, { method: "POST" });
          if (scenariosRes.ok) {
            const sb = await scenariosRes.json() as any;
            if (sb.seeded) log(`TM scenarios auto-seeded: ${sb.count} scenarios`, "seed");
          }
        } catch (e: any) {
          log(`TM auto-seed error: ${e.message}`, "seed");
        }
      }, 2000);
      }
  };

  // reusePort is Linux-only; Windows throws ENOTSUP
  if (process.platform === "win32") {
    httpServer.listen(port, host, onListen);
  } else {
    httpServer.listen({ port, host, reusePort: true }, onListen);
  }
})();
