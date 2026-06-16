import { C } from "@/lib/survey-constants";
import { SURVEY_AI_EMPTY_BANNER, useSurveyAiStatus } from "@/hooks/use-survey-ai-status";

export function SurveyAiTokenBanner() {
  const { data, isLoading } = useSurveyAiStatus();
  if (isLoading || !data?.empty) return null;

  return (
    <div
      role="alert"
      data-testid="survey-ai-token-empty-banner"
      style={{
        background: C.amberL,
        border: `1px solid ${C.amber}`,
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 16,
        fontSize: 14,
        color: C.amber,
        lineHeight: 1.5,
      }}
    >
      {SURVEY_AI_EMPTY_BANNER} AI features in Surveys are disabled until tokens are replenished.
    </div>
  );
}
