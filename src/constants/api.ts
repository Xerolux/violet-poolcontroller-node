import type {
  DosingType,
  ErrorSeverity,
  Rs485PumpMode,
  Rs485PumpName,
  SystemService,
} from "../types.js";

export { ERROR_CODES } from "./error-codes.js";

export const API_ENDPOINTS = {
  readings: "/getReadings",
  setFunctionManually: "/setFunctionManually",
  getConfig: "/getConfig",
  setConfig: "/setConfig",
  getCalibrationRawValues: "/getCalibRawValues",
  getCalibrationHistory: "/getCalibHistory",
  restoreCalibration: "/restoreOldCalib",
  setOutputTestMode: "/setOutputTestmode",
  triggerManualDosing: "/triggerManualDosing",
  getHistory: "/getHistory",
  getWeatherData: "/getWeatherdata",
  getOverallDosing: "/getOverallDosing",
  getOutputStates: "/getOutputstates",
  getOutputRuntimes: "/getOutputruntimes",
  getLog: "/getLog",
  getNotifications: "/getNotifications",
  resetBlocking: "/resetBlocking",
  setCanAmount: "/setCanAmount",
  getServiceStates: "/getServiceStates",
  getLiveTrace: "/getLiveTrace",
  getRs485PumpData: "/getRS485PumpData",
  setRs485Live: "/setRS485Live",
  initUpdate: "/initUpdate",
  getUpdateState: "/getUpdateState",
  getUpdateHistory: "/getUpdateHistory",
} as const;

export const ACTIONS = {
  on: "ON",
  off: "OFF",
  auto: "AUTO",
  push: "PUSH",
  manual: "MAN",
  color: "COLOR",
  allOn: "ALLON",
  allOff: "ALLOFF",
  allAuto: "ALLAUTO",
  lock: "LOCK",
  unlock: "UNLOCK",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export const ACTION_ON = ACTIONS.on;
export const ACTION_OFF = ACTIONS.off;
export const ACTION_AUTO = ACTIONS.auto;
export const ACTION_PUSH = ACTIONS.push;
export const ACTION_MAN = ACTIONS.manual;
export const ACTION_COLOR = ACTIONS.color;
export const ACTION_ALLON = ACTIONS.allOn;
export const ACTION_ALLOFF = ACTIONS.allOff;
export const ACTION_ALLAUTO = ACTIONS.allAuto;
export const ACTION_LOCK = ACTIONS.lock;
export const ACTION_UNLOCK = ACTIONS.unlock;

export const TARGETS = {
  ph: "DOSAGE_phminus_setpoint",
  orp: "DOSAGE_chlorine_setpoint_orp",
  minimumChlorine: "DOSAGE_chlorine_lowerval_cl",
} as const;

export const SETPOINT_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  [TARGETS.ph]: [6, 8],
  [TARGETS.orp]: [500, 900],
  [TARGETS.minimumChlorine]: [0, 5],
  HEATER_set_temp: [5, 45],
  SOLAR_maxtemp: [5, 55],
};

export const SPECIFIC_READING_GROUPS = [
  "ADC",
  "DOSAGE",
  "RUNTIMES",
  "PUMPPRIOSTATE",
  "BACKWASH",
  "SYSTEM",
  "INPUT1",
  "INPUT2",
  "INPUT3",
  "INPUT4",
  "date",
  "time",
] as const;

export const DOSING_FUNCTIONS: Readonly<Record<Exclude<DosingType, "H2O2">, string>> = {
  "pH-": "DOS_4_PHM",
  "pH+": "DOS_5_PHP",
  Chlor: "DOS_1_CL",
  Elektrolyse: "DOS_2_ELO",
  Flockmittel: "DOS_6_FLOC",
};

export const DOSING_OUTPUT_INDEX: Readonly<Record<string, number>> = {
  DOS_1_CL: 0,
  DOS_2_ELO: 1,
  DOS_4_PHM: 3,
  DOS_5_PHP: 4,
  DOS_6_FLOC: 5,
};

export const DOSING_CONFIG_PREFIX: Readonly<Record<DosingType, string>> = {
  "pH-": "DOSAGE_phminus",
  "pH+": "DOSAGE_phplus",
  Chlor: "DOSAGE_chlorine",
  Elektrolyse: "DOSAGE_electrolysis",
  Flockmittel: "DOSAGE_floc",
  H2O2: "DOSAGE_h2o2",
};

export const DOSING_CANISTER_ID: Readonly<Record<string, number>> = {
  DOS_1_CL: 1,
  DOS_2_ELO: 2,
  DOS_4_PHM: 4,
  DOS_5_PHP: 5,
  DOS_6_FLOC: 6,
};

export const OMNI_POSITIONS = [
  "OMNI_DC0",
  "OMNI_DC1",
  "OMNI_DC2",
  "OMNI_DC3",
  "OMNI_DC4",
  "OMNI_DC5",
] as const;

export const RS485_PUMP_MODES: readonly Rs485PumpMode[] = ["rpm", "pwr", "hz"];
export const RS485_PUMP_NAMES: readonly Rs485PumpName[] = [
  "BADU_ECO_DRIVE_II",
  "BADU_ECO_FLEX",
  "BADU_PRIME_NEO_VS",
];

interface SystemServiceDefinition {
  enableEndpoint: string;
  disableEndpoint: string;
  stateKey: string;
}

export const SYSTEM_SERVICES: Readonly<Record<SystemService, SystemServiceDefinition>> = {
  ftp: { enableEndpoint: "/enableFTP", disableEndpoint: "/disableFTP", stateKey: "proftpd" },
  samba: { enableEndpoint: "/enableSAMBA", disableEndpoint: "/disableSAMBA", stateKey: "samba" },
  ssh: { enableEndpoint: "/enableSSH", disableEndpoint: "/disableSSH", stateKey: "sshd" },
  shairport: {
    enableEndpoint: "/enableSHAIRPORT",
    disableEndpoint: "/disableSHAIRPORT",
    stateKey: "shairport",
  },
  homebridge: {
    enableEndpoint: "/enableHOMEBRIDGE",
    disableEndpoint: "/disableHOMEBRIDGE",
    stateKey: "homekit",
  },
  alexa: { enableEndpoint: "/enableALEXA", disableEndpoint: "/disableALEXA", stateKey: "" },
  tunnel: {
    enableEndpoint: "/enableTUNNEL",
    disableEndpoint: "/disableTUNNEL",
    stateKey: "tunnel_state",
  },
  support_tunnel: {
    enableEndpoint: "/enableSUPPORTTUNNEL",
    disableEndpoint: "/disableSUPPORTTUNNEL",
    stateKey: "support_tunnel_state",
  },
};

export const ERROR_SEVERITY = {
  alarm: "ALARM",
  warning: "WARNING",
  info: "INFO",
  reminder: "REMINDER",
} as const satisfies Record<string, ErrorSeverity>;

export const ERROR_SEVERITY_ALARM = ERROR_SEVERITY.alarm;
export const ERROR_SEVERITY_WARNING = ERROR_SEVERITY.warning;
export const ERROR_SEVERITY_INFO = ERROR_SEVERITY.info;
export const ERROR_SEVERITY_REMINDER = ERROR_SEVERITY.reminder;
