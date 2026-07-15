const runtimePattern = /^(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i;
const hmsPattern = /^(\d+):(\d+):(\d+)$/;
const uptimePattern = /^(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i;

function componentsToMilliseconds(parts: RegExpMatchArray | null): number {
  if (parts === null) return 0;
  const days = Number(parts[1] ?? 0);
  const hours = Number(parts[2] ?? 0);
  const minutes = Number(parts[3] ?? 0);
  const seconds = Number(parts[4] ?? 0);
  return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1_000;
}

export function parseRuntimeMilliseconds(value: string): number {
  return componentsToMilliseconds(value.trim().match(runtimePattern));
}

export function parseHmsMilliseconds(value: string): number {
  const match = value.trim().match(hmsPattern);
  if (match === null) return 0;
  return (Number(match[1]) * 3_600 + Number(match[2]) * 60 + Number(match[3])) * 1_000;
}

export function parseUptimeMilliseconds(value: string): number {
  const match = value.trim().match(uptimePattern);
  if (match === null) return 0;
  return (
    ((Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0)) * 60 + Number(match[3] ?? 0)) * 60_000
  );
}

function parseEpoch(value: number | string, divisor: number): Date | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return undefined;
  const date = new Date((numeric / divisor) * 1_000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseEpochSeconds(value: number | string): Date | undefined {
  return parseEpoch(value, 1);
}

export function parseEpochMilliseconds(value: number | string): Date | undefined {
  return parseEpoch(value, 1_000);
}

export function parseOptionalMilliseconds(value: number | string): number | undefined {
  if (typeof value === "string" && value.trim().toUpperCase() === "NONE") return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1_000 : undefined;
}
