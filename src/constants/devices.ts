export enum OutputState {
  AutoOff = 0,
  AutoOn = 1,
  AutoPriorityOff = 2,
  AutoPriorityOn = 3,
  ManualOn = 4,
  EmergencyOff = 5,
  ManualOff = 6,
}

export enum DmxSceneState {
  AutoOff = 0,
  AutoOn = 1,
  ManualOn = 4,
  ManualOff = 6,
}

export enum RuleState {
  Inactive = 0,
  Active = 1,
  BlockedByRule = 5,
  BlockedManually = 6,
}

export enum CoverState {
  Open = "OPEN",
  Closed = "CLOSED",
  Opening = "OPENING",
  Closing = "CLOSING",
  Stopped = "STOPPED",
}

export enum OnewireState {
  Ok = "OK",
  CrcFault = "CRC_FAULT",
  DataMismatch = "DATA_MISSMATCH",
  NotConnected = "NOT_CONNECTED",
  NoSensorConfigured = "NO_SENSOR_CONFIGURED",
}

export enum PvSurplusState {
  Off = 0,
  OnByInput = 1,
  OnByHttp = 2,
}

export const COVER_FUNCTIONS: Readonly<Record<string, string>> = {
  OPEN: "COVER_OPEN",
  CLOSE: "COVER_CLOSE",
  STOP: "COVER_STOP",
};

export interface DeviceParameters {
  apiTemplate: string;
  supportsSpeed?: boolean;
  supportsTimer?: boolean;
  supportsLock?: boolean;
  supportsColorPulse?: boolean;
  dosingType?: string;
}

const parameters: Record<string, DeviceParameters> = {
  PUMP: { supportsSpeed: true, apiTemplate: "PUMP,{action},{duration},{speed}" },
  HEATER: { supportsTimer: true, apiTemplate: "HEATER,{action},{duration},0" },
  SOLAR: { supportsTimer: true, apiTemplate: "SOLAR,{action},{duration},0" },
  LIGHT: { supportsColorPulse: true, apiTemplate: "LIGHT,{action},0,0" },
  DOS_1_CL: {
    supportsTimer: true,
    dosingType: "Chlor",
    apiTemplate: "DOS_1_CL,{action},{duration},0",
  },
  DOS_4_PHM: {
    supportsTimer: true,
    dosingType: "pH-",
    apiTemplate: "DOS_4_PHM,{action},{duration},0",
  },
  DOS_5_PHP: {
    supportsTimer: true,
    dosingType: "pH+",
    apiTemplate: "DOS_5_PHP,{action},{duration},0",
  },
  DOS_2_ELO: {
    supportsTimer: true,
    dosingType: "Elektrolyse",
    apiTemplate: "DOS_2_ELO,{action},{duration},0",
  },
  DOS_6_FLOC: {
    supportsTimer: true,
    dosingType: "Flockmittel",
    apiTemplate: "DOS_6_FLOC,{action},{duration},0",
  },
  BACKWASH: { supportsTimer: true, apiTemplate: "BACKWASH,{action},{duration},0" },
  BACKWASHRINSE: { supportsTimer: true, apiTemplate: "BACKWASHRINSE,{action},{duration},0" },
  PVSURPLUS: { supportsSpeed: true, apiTemplate: "PVSURPLUS,{action},{speed},0" },
  ECO: { apiTemplate: "ECO,{action},0,0" },
  REFILL: { supportsTimer: true, apiTemplate: "REFILL,{action},{duration},0" },
};

for (const bank of [1, 2]) {
  for (let relay = 1; relay <= 8; relay += 1) {
    parameters[`EXT${bank}_${relay}`] = {
      supportsTimer: true,
      apiTemplate: `EXT${bank}_${relay},{action},{duration},0`,
    };
  }
}

for (let rule = 1; rule <= 8; rule += 1) {
  parameters[`DIRULE_${rule}`] = {
    supportsLock: true,
    apiTemplate: `DIRULE_${rule},{action},0,0`,
  };
}

for (let scene = 1; scene <= 12; scene += 1) {
  parameters[`DMX_SCENE${scene}`] = {
    apiTemplate: `DMX_SCENE${scene},{action},0,0`,
  };
}

export const DEVICE_PARAMETERS: Readonly<Record<string, DeviceParameters>> = parameters;

export function isOutputOn(state: OutputState): boolean {
  return [OutputState.AutoOn, OutputState.AutoPriorityOn, OutputState.ManualOn].includes(state);
}

export function isOutputManual(state: OutputState): boolean {
  return [OutputState.ManualOn, OutputState.ManualOff].includes(state);
}

export function isOutputEmergency(state: OutputState): boolean {
  return [OutputState.AutoPriorityOn, OutputState.EmergencyOff].includes(state);
}
