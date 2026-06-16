import { runSignoffJobs } from "./service";

export async function runEsignJobs(): Promise<{ expired: number; reminders: number }> {
  return runSignoffJobs();
}
