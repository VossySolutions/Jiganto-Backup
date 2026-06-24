/** Shared survey branching logic (used by server + client). */
export type SurveyLogicRule = { operator: string; value: unknown; skipToQuestionId: number };

export function applyLogicSkip<T extends { id: number; logicJson?: unknown }>(
  questions: T[],
  answers: Record<number, unknown>,
  currentIndex: number,
): number {
  const q = questions[currentIndex];
  if (!q?.logicJson || !Array.isArray(q.logicJson) || !(q.logicJson as SurveyLogicRule[]).length) {
    return currentIndex + 1;
  }
  for (const rule of q.logicJson as SurveyLogicRule[]) {
    const ans = answers[q.id];
    let match = false;
    if (rule.operator === "equals") match = ans === rule.value;
    else if (rule.operator === "not_equals") match = ans !== rule.value;
    else if (rule.operator === "contains") match = String(ans ?? "").includes(String(rule.value));
    if (match) {
      const targetIdx = questions.findIndex((x) => x.id === rule.skipToQuestionId);
      return targetIdx >= 0 ? targetIdx : currentIndex + 1;
    }
  }
  return currentIndex + 1;
}
