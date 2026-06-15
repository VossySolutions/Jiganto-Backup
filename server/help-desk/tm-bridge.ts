import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { tmTestCases, tmTestResults } from "@shared/models/testmgmt";
import type { SdTicket } from "@shared/models/service-desk";
import * as sd from "../service-desk/service";

export async function createDefectFromTestResult(
  tenantId: number,
  userId: string,
  testResultId: number,
  extra?: { comment?: string; environment?: string; severity?: string; buildVersion?: string },
) {
  const [result] = await db.select().from(tmTestResults).where(eq(tmTestResults.id, testResultId));
  if (!result || result.status !== "fail") {
    throw new Error("Test result not found or not failed");
  }

  const [testCase] = await db
    .select()
    .from(tmTestCases)
    .where(and(eq(tmTestCases.id, result.testCaseId), eq(tmTestCases.tenantId, tenantId)));
  if (!testCase) throw new Error("Test case not found");

  const steps = (result.stepResults ?? []) as { stepId?: number; status?: string; comment?: string }[];
  const failedSteps = steps.filter((s) => s.status === "fail");
  const stepsText = failedSteps.length
    ? failedSteps.map((s, i) => `${i + 1}. Step failed${s.comment ? `: ${s.comment}` : ""}`).join("\n")
    : "1. Test execution failed";

  const severity = extra?.severity ?? (testCase.priority === "critical" ? "critical" : testCase.priority === "high" ? "high" : "medium");

  return sd.createTicket(tenantId, userId, {
    source: "help_desk",
    title: `Defect: ${testCase.title}`,
    type: "defect",
    priority: severity === "critical" ? "p1" : severity === "high" ? "p2" : "p3",
    description: { text: extra?.comment ?? result.comment ?? result.actualResult ?? "Failed during test execution" },
    projectId: testCase.projectId,
    linkedTestCaseId: testCase.id,
    linkedTestResultId: testResultId,
    defectSeverity: severity,
    defectStepsToReproduce: stepsText,
    defectExpectedResult: testCase.description ?? "See test case steps",
    defectActualResult: extra?.comment ?? result.actualResult ?? result.comment ?? "Test failed",
    defectEnvironment: extra?.environment ?? "uat",
    defectBuildVersion: extra?.buildVersion,
  });
}

export async function notifyTestCaseReadyForRetest(
  tenantId: number,
  ticket: SdTicket,
  _changedBy: string,
): Promise<void> {
  if (!ticket.linkedTestCaseId) return;

  await db
    .update(tmTestResults)
    .set({ status: "ready_for_retest", updatedAt: new Date() })
    .where(eq(tmTestResults.id, ticket.linkedTestResultId ?? 0));

  const [testCase] = await db
    .select()
    .from(tmTestCases)
    .where(eq(tmTestCases.id, ticket.linkedTestCaseId));

  const [origResult] = ticket.linkedTestResultId
    ? await db.select().from(tmTestResults).where(eq(tmTestResults.id, ticket.linkedTestResultId))
    : [null];

  const testerId = origResult?.executedBy;
  if (testerId) {
    try {
      const { notifyUser } = await import("../lib/user-notify");
      await notifyUser({
        userId: testerId,
        tenantId,
        title: `Defect ${ticket.ref} ready for retest`,
        message: `Defect ${ticket.ref} has been fixed and is ready for retest. Open: ${testCase?.title ?? "test case"}.`,
        category: "testManagement",
        source: "help-desk",
        sourceId: String(ticket.id),
      });
    } catch (err) {
      console.warn("[help-desk] retest notification skipped:", err);
    }
  }
}

export async function handleRetestResult(
  tenantId: number,
  testResultId: number,
  status: "pass" | "fail",
  userId: string,
): Promise<void> {
  const [result] = await db.select().from(tmTestResults).where(eq(tmTestResults.id, testResultId));
  if (!result) return;

  const tickets = await sd.listTickets(tenantId, { source: "help_desk", type: "defect" });
  const linked = tickets.find((t) => t.linkedTestResultId === testResultId || t.linkedTestCaseId === result.testCaseId);
  if (!linked) return;

  if (status === "pass") {
    await sd.updateTicketStatus(tenantId, linked.id, userId, "fixed", "Retest passed");
    await sd.updateTicketStatus(tenantId, linked.id, userId, "closed", "Auto-closed after successful retest");
  } else {
    await sd.updateTicketStatus(tenantId, linked.id, userId, "open", "Retest failed — reopened");
  }
}
