export type ForecastPeriodRange = {
  start: Date;
  end: Date;
  label: string;
};

export function parseForecastPeriodKey(periodKey: string): ForecastPeriodRange | null {
  if (periodKey.startsWith("FY-")) {
    const year = parseInt(periodKey.slice(3), 10);
    if (!Number.isFinite(year)) return null;
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
      label: `FY ${year}`,
    };
  }

  const match = periodKey.match(/^Q(\d)-(\d{4})$/);
  if (!match) return null;

  const quarter = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  if (quarter < 1 || quarter > 4 || !Number.isFinite(year)) return null;

  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 0, 23, 59, 59, 999),
    label: `Q${quarter} ${year}`,
  };
}

export function closeDateInForecastPeriod(
  closeDateStr: string | null | undefined,
  range: ForecastPeriodRange | null,
): boolean {
  if (!range) return true;
  if (!closeDateStr) return false;
  const closeDate = new Date(closeDateStr);
  return closeDate >= range.start && closeDate <= range.end;
}

export function forecastRecordOverlapsPeriod(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
  range: ForecastPeriodRange | null,
): boolean {
  if (!range) return true;
  if (!periodStart || !periodEnd) return false;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  return start <= range.end && end >= range.start;
}

export function buildForecastPeriodOptions(year: number) {
  const options = [];
  for (let q = 1; q <= 4; q++) {
    options.push({ label: `Q${q} ${year}`, value: `Q${q}-${year}` });
  }
  options.push({ label: `FY ${year}`, value: `FY-${year}` });
  return options;
}

export function getCurrentForecastPeriodKey(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter}-${now.getFullYear()}`;
}
