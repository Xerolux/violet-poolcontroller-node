export type StateLanguage = "de" | "en";
export type DeviceMode =
  "auto" | "manual" | "frost_protection" | "error" | "maintenance" | "unknown";

export interface DeviceStateInfo {
  mode: DeviceMode;
  active: boolean | undefined;
  description: string;
}

const stateMapping: Readonly<Record<string, DeviceStateInfo>> = {
  ON: { mode: "manual", active: true, description: "Manual ON" },
  OFF: { mode: "manual", active: false, description: "Manual OFF" },
  AUTO: { mode: "auto", active: undefined, description: "Auto Mode" },
  "0": { mode: "auto", active: false, description: "Auto - Standby" },
  "1": { mode: "auto", active: true, description: "Auto - Active (Scheduled)" },
  "2": { mode: "auto", active: false, description: "Auto - Priority OFF (Rule Blocked)" },
  "3": { mode: "auto", active: true, description: "Auto - Priority ON (Emergency Rule)" },
  "4": { mode: "manual", active: true, description: "Manual ON (Forced)" },
  "5": { mode: "auto", active: false, description: "Rule OFF (Emergency Rule)" },
  "6": { mode: "manual", active: false, description: "Manual OFF" },
  "3|PUMP_ANTI_FREEZE": {
    mode: "frost_protection",
    active: true,
    description: "Frost Protection Active",
  },
  PUMP_ANTI_FREEZE: {
    mode: "frost_protection",
    active: true,
    description: "Frost Protection Active",
  },
  STOPPED: { mode: "manual", active: false, description: "Stopped" },
  ERROR: { mode: "error", active: false, description: "Error State" },
  MAINTENANCE: { mode: "maintenance", active: false, description: "Maintenance" },
};

export const COVER_STATE_MAP: Readonly<Record<string, string>> = {
  "0": "open",
  "1": "opening",
  "2": "closed",
  "3": "closing",
  "4": "stopped",
  OPEN: "open",
  OPENING: "opening",
  CLOSED: "closed",
  CLOSING: "closing",
  STOPPED: "stopped",
};

export const STATE_TRANSLATIONS = {
  en: {
    auto_active: "Auto (Active)",
    auto_inactive: "Auto (Ready)",
    manual_on: "Manual On",
    manual_off: "Manual Off",
    frost_protection: "Frost Protection",
    error: "Error",
    maintenance: "Maintenance",
    unknown: "Unknown",
  },
  de: {
    auto_active: "Automatik (Aktiv)",
    auto_inactive: "Automatik (Bereit)",
    manual_on: "Manuell Ein",
    manual_off: "Manuell Aus",
    frost_protection: "Frostschutz",
    error: "Fehler",
    maintenance: "Wartung",
    unknown: "Unbekannt",
  },
} as const;

const stateIcons: Readonly<Record<string, string>> = {
  auto_active: "mdi:autorenew",
  auto_inactive: "mdi:autorenew-off",
  manual_on: "mdi:power-plug",
  manual_off: "mdi:power-plug-off",
  frost_protection: "mdi:snowflake-alert",
  error: "mdi:alert-circle",
  maintenance: "mdi:wrench",
};

let stateLanguage: StateLanguage = "de";

export function setStateTranslationLanguage(language: StateLanguage): void {
  if (!Object.hasOwn(STATE_TRANSLATIONS, language)) {
    throw new RangeError(`Unsupported language '${language}'. Available: de, en`);
  }
  stateLanguage = language;
}

export function getStateTranslationLanguage(): StateLanguage {
  return stateLanguage;
}

export function getDeviceStateInfo(rawState: unknown): DeviceStateInfo {
  const normalized = String(rawState ?? "")
    .trim()
    .toUpperCase();
  const direct = stateMapping[normalized];
  if (direct !== undefined) return direct;
  const prefix = normalized.split("|", 1)[0];
  if (prefix !== undefined && stateMapping[prefix] !== undefined) return stateMapping[prefix];
  if (["", "[]", "{}"].includes(normalized)) {
    return { mode: "unknown", active: undefined, description: "No data" };
  }
  return { mode: "unknown", active: undefined, description: `Unknown: ${String(rawState)}` };
}

export function getDeviceModeFromState(rawState: unknown): string {
  const info = getDeviceStateInfo(rawState);
  if (info.mode === "manual") return info.active === true ? "manual_on" : "manual_off";
  if (info.mode === "auto") return info.active === true ? "auto_active" : "auto_inactive";
  return info.mode;
}

export class VioletState {
  readonly rawState: string;
  readonly deviceKey: string | undefined;
  readonly language: StateLanguage | undefined;
  private readonly info: DeviceStateInfo;

  constructor(rawState: unknown, deviceKey?: string, language?: StateLanguage) {
    this.rawState = String(rawState).trim();
    this.deviceKey = deviceKey;
    this.language = language;
    this.info = getDeviceStateInfo(this.rawState);
  }

  get mode(): DeviceMode {
    return this.info.mode;
  }

  get isActive(): boolean | undefined {
    return this.info.active;
  }

  get description(): string {
    return this.info.description;
  }

  get displayMode(): string {
    return this.displayModeFor(this.language ?? stateLanguage);
  }

  displayModeFor(language: StateLanguage): string {
    const mode = getDeviceModeFromState(this.rawState);
    const translations: Readonly<Record<string, string>> = STATE_TRANSLATIONS[language];
    return (
      translations[mode] ??
      mode.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    );
  }

  get icon(): string {
    return stateIcons[getDeviceModeFromState(this.rawState)] ?? "mdi:help-circle";
  }

  toString(): string {
    return `VioletState(raw='${this.rawState}', mode='${this.mode}', active=${String(this.isActive)})`;
  }
}
