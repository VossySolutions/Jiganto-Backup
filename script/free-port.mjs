/**
 * Frees PORT (default 5000) before dev — avoids EADDRINUSE when a stale node process remains.
 */
import { execSync } from "node:child_process";

const port = process.env.PORT || "5000";

function freePortWindows(p) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${p} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique"`,
      { encoding: "utf8" },
    );
    const ids = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s));
    for (const id of ids) {
      try {
        execSync(`taskkill /PID ${id} /F`, { stdio: "ignore" });
        console.log(`[free-port] Stopped PID ${id} on port ${p}`);
      } catch {
        /* already gone */
      }
    }
    if (ids.length === 0) {
      console.log(`[free-port] Port ${p} is free`);
    }
  } catch {
    console.log(`[free-port] Port ${p} is free`);
  }
}

function freePortUnix(p) {
  try {
    execSync(`lsof -ti :${p} | xargs kill -9 2>/dev/null`, { shell: true, stdio: "ignore" });
    console.log(`[free-port] Attempted to free port ${p}`);
  } catch {
    console.log(`[free-port] Port ${p} is free`);
  }
}

if (process.platform === "win32") {
  freePortWindows(port);
} else {
  freePortUnix(port);
}
