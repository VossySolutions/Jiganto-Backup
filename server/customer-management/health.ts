import type {
  CustomerCommercialStatus,
  HealthBand,
  HealthSignal,
} from "@shared/models/customer-mgmt";

export interface HealthComputeInput {
  userUsed: number;
  userLimit: number;
  aiUsed: number;
  aiLimit: number;
  followUpCount90d: number;
  status: CustomerCommercialStatus;
  trialDaysLeft: number | null;
  renewalDaysAway: number | null;
}

function bandFromScore(score: number): HealthBand {
  if (score >= 70) return "healthy";
  if (score >= 40) return "watch";
  return "at_risk";
}

export function computeHealthMetrics(input: HealthComputeInput): {
  score: number;
  band: HealthBand;
  signals: HealthSignal[];
} {
  const loginScore =
    input.userLimit > 0
      ? Math.min(100, Math.round((input.userUsed / input.userLimit) * 100))
      : input.userUsed > 0
        ? 65
        : 15;

  const featureScore =
    input.userUsed >= 10 ? 90 : input.userUsed >= 5 ? 78 : input.userUsed >= 2 ? 62 : input.userUsed >= 1 ? 48 : 22;

  const aiAdoption =
    input.aiLimit > 0 ? Math.min(100, Math.round((input.aiUsed / input.aiLimit) * 100)) : 0;
  const featureBreadth = Math.round(featureScore * 0.6 + aiAdoption * 0.4);

  const supportScore = Math.max(25, 100 - Math.min(75, input.followUpCount90d * 12));

  const npsScore =
    input.status === "active" ? 80 : input.status === "trial" ? 65 : input.status === "free_access" ? 70 : 45;

  let renewalScore = 72;
  if (input.trialDaysLeft != null) {
    if (input.trialDaysLeft <= 3) renewalScore = 35;
    else if (input.trialDaysLeft <= 7) renewalScore = 50;
    else if (input.trialDaysLeft <= 14) renewalScore = 62;
  }
  if (input.renewalDaysAway != null) {
    if (input.renewalDaysAway < 0) renewalScore = Math.min(renewalScore, 30);
    else if (input.renewalDaysAway <= 14) renewalScore = Math.min(renewalScore, 55);
    else if (input.renewalDaysAway > 60) renewalScore = Math.max(renewalScore, 85);
  }

  const signals: HealthSignal[] = [
    { key: "login", label: "Login frequency", score: loginScore },
    { key: "features", label: "Feature breadth", score: featureBreadth },
    { key: "support", label: "Support & follow-ups", score: supportScore },
    { key: "nps", label: "Engagement", score: npsScore },
    { key: "renewal", label: "Renewal intent", score: renewalScore },
  ];

  const score = Math.round(signals.reduce((sum, s) => sum + s.score, 0) / signals.length);

  return {
    score,
    band: bandFromScore(score),
    signals,
  };
}

export function weakestSignalLabel(signals: HealthSignal[]): string {
  if (signals.length === 0) return "Review account health";
  const weakest = [...signals].sort((a, b) => a.score - b.score)[0];
  return `${weakest!.label} (${weakest!.score})`;
}
