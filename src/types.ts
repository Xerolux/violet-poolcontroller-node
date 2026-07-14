import type { Dispatcher, RequestInit, Response } from "undici";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;
export type ControllerRecord = Record<string, unknown>;

export type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface VioletPoolClientOptions {
  host: string;
  username?: string;
  password?: string;
  useSsl?: boolean;
  verifySsl?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  dosingStandalone?: boolean;
  fetch?: FetchImplementation;
  dispatcher?: Dispatcher;
}

export interface CommandResult extends ControllerRecord {
  success: boolean;
  response: string;
  output?: string;
  message?: string;
}

export interface HardwareProfile {
  baseModule: boolean;
  dosingModule: boolean;
  extensionModule1: boolean;
  extensionModule2: boolean;
}

export interface LogResult {
  lines: string[];
  hasMore: boolean;
  raw: string;
}

export type ErrorSeverity = "ALARM" | "WARNING" | "INFO" | "REMINDER" | "UNKNOWN";

export interface ErrorNotification {
  code: string;
  severity: ErrorSeverity;
  message: string;
  isAlarm: boolean;
  isWarning: boolean;
  isInfo: boolean;
  isReminder: boolean;
}

export type DosingType = "pH-" | "pH+" | "Chlor" | "Elektrolyse" | "Flockmittel" | "H2O2";
export type SystemService =
  "ftp" | "samba" | "ssh" | "shairport" | "homebridge" | "alexa" | "tunnel" | "support_tunnel";
export type Rs485PumpMode = "rpm" | "pwr" | "hz";
export type Rs485PumpName = "BADU_ECO_DRIVE_II" | "BADU_ECO_FLEX" | "BADU_PRIME_NEO_VS";
