export { applyLogicSkip, type SurveyLogicRule } from "@shared/survey-logic";
import type { SurveyQuestion } from "@shared/models/surveys";
import { applyLogicSkip } from "@shared/survey-logic";

/** Questions visible on single-page surveys given current answers (respects skip rules). */
export function visibleSurveyQuestions(
  questions: SurveyQuestion[],
  answers: Record<number, unknown>,
): SurveyQuestion[] {
  if (questions.length === 0) return [];
  const visible = new Set<number>();
  let idx = 0;
  let guard = 0;
  while (idx >= 0 && idx < questions.length && guard < questions.length * 2) {
    guard++;
    const q = questions[idx];
    if (q) visible.add(q.id);
    const next = applyLogicSkip(questions, answers, idx);
    if (next <= idx) break;
    idx = next;
  }
  return questions.filter((q) => visible.has(q.id));
}
