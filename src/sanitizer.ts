export interface NumericOptions {
  minimum?: number;
  maximum?: number;
  fallback?: number;
}

export class InputSanitizer {
  static sanitizeString(
    value: unknown,
    options: {
      maximumLength?: number;
      allowSpecialCharacters?: boolean;
      escapeHtml?: boolean;
    } = {},
  ): string {
    const maximumLength = options.maximumLength ?? 255;
    const normalized = String(value ?? "")
      .trim()
      .normalize("NFKD");
    const truncated = normalized.slice(0, maximumLength);
    const cleaned = options.allowSpecialCharacters
      ? truncated
      : truncated.replace(/[^a-zA-Z0-9 _-]/g, "");
    if (options.escapeHtml === false) return cleaned;
    return cleaned
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#x27;");
  }

  static sanitizeNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    const text = String(value ?? "").trim();
    const negative = text.startsWith("-");
    const cleaned = text.replace(/[^0-9.]/g, "");
    if (cleaned.length === 0) return fallback;
    const parsed = Number(`${negative ? "-" : ""}${cleaned}`);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static sanitizeInteger(value: unknown, options: NumericOptions = {}): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return Math.trunc(options.fallback ?? 0);
    return Math.trunc(InputSanitizer.clamp(numeric, options));
  }

  static sanitizeFloat(
    value: unknown,
    options: NumericOptions & { precision?: number } = {},
  ): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return options.fallback ?? 0;
    const valueInRange = InputSanitizer.clamp(numeric, options);
    const factor = 10 ** (options.precision ?? 2);
    return Math.round(valueInRange * factor) / factor;
  }

  static sanitizeBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
      if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
    }
    return fallback;
  }

  static validateDeviceKey(key: string): string {
    if (key.length === 0) throw new TypeError("Device-Key darf nicht leer sein");
    const normalized = key.toUpperCase().replaceAll("-", "_");
    const sanitized = normalized.replace(/[^A-Z0-9_]/g, "");
    if (sanitized.length > 50) throw new RangeError(`Device-Key zu lang: ${sanitized.length} > 50`);
    return sanitized;
  }

  static validateApiParameter(parameter: string): string {
    if (parameter.length === 0) throw new TypeError("API-Parameter darf nicht leer sein");
    if (/\.\.|[/\\]/.test(parameter)) {
      throw new TypeError(`Path Traversal erkannt in Parameter: ${parameter}`);
    }
    const sanitized = parameter.replace(/[^a-zA-Z0-9_-]/g, "");
    if (sanitized.length > 100) {
      throw new RangeError(`API-Parameter zu lang: ${sanitized.length} > 100`);
    }
    return sanitized;
  }

  static validateDuration(value: unknown, minimum = 0, maximum = 86_400): number {
    return InputSanitizer.sanitizeInteger(value, { minimum, maximum, fallback: 0 });
  }

  static validateSpeed(value: unknown, minimum = 1, maximum = 4, fallback = 2): number {
    return InputSanitizer.sanitizeInteger(value, { minimum, maximum, fallback });
  }

  static validateTemperature(value: unknown, minimum = -50, maximum = 100): number {
    return InputSanitizer.sanitizeFloat(value, { minimum, maximum, precision: 1, fallback: 20 });
  }

  static validatePh(value: unknown): number {
    return InputSanitizer.sanitizeFloat(value, {
      minimum: 6,
      maximum: 9,
      precision: 1,
      fallback: 7.2,
    });
  }

  static validateOrp(value: unknown): number {
    return InputSanitizer.sanitizeInteger(value, { minimum: 500, maximum: 900, fallback: 700 });
  }

  static validateChlorine(value: unknown): number {
    return InputSanitizer.sanitizeFloat(value, {
      minimum: 0,
      maximum: 5,
      precision: 1,
      fallback: 0.6,
    });
  }

  private static clamp(value: number, options: NumericOptions): number {
    let result = value;
    if (options.minimum !== undefined) result = Math.max(result, options.minimum);
    if (options.maximum !== undefined) result = Math.min(result, options.maximum);
    return result;
  }
}
