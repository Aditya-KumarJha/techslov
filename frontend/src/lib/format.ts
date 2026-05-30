export function formatCompactNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "--";

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value as number);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";

  return `${Number(value).toFixed(2)}%`;
}

export function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTimeRange(startTimeSeconds: number, endTimeSeconds: number) {
  return `${formatDuration(startTimeSeconds)}-${formatDuration(endTimeSeconds)}`;
}
