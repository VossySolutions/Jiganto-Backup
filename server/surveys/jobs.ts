import { autoCloseExpiredSurveys, sendSurveyReminders, ensureSystemTemplates } from "./service";

export async function runSurveyJobs(): Promise<{ surveysClosed: number; pollsClosed: number; reminders: number }> {
  await ensureSystemTemplates();
  const closed = await autoCloseExpiredSurveys();
  const reminders = await sendSurveyReminders();
  return { ...closed, reminders };
}
