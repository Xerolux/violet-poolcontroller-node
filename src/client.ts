import {
  ACTIONS,
  API_ENDPOINTS,
  DOSING_CANISTER_ID,
  DOSING_CONFIG_PREFIX,
  DOSING_FUNCTIONS,
  DOSING_OUTPUT_INDEX,
  ERROR_CODES,
  OMNI_POSITIONS,
  RS485_PUMP_MODES,
  RS485_PUMP_NAMES,
  SETPOINT_RANGES,
  SYSTEM_SERVICES,
  TARGETS,
} from "./constants/api.js";
import { COVER_FUNCTIONS, DEVICE_PARAMETERS } from "./constants/devices.js";
import {
  VioletPayloadError,
  VioletPoolError,
  VioletSetpointError,
  VioletUnsafeOperationError,
} from "./errors.js";
import { HttpTransport } from "./internal/transport.js";
import { VioletReadings } from "./readings.js";
import { InputSanitizer } from "./sanitizer.js";
import type {
  CommandResult,
  ControllerRecord,
  DosingType,
  ErrorNotification,
  HardwareProfile,
  LogResult,
  Rs485PumpMode,
  Rs485PumpName,
  SystemService,
  VioletPoolClientOptions,
} from "./types.js";

const API_PRIORITY_CRITICAL = 1;

function isRecord(value: unknown): value is ControllerRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function quoteCommand(value: string): string {
  return encodeURIComponent(value).replaceAll("%2C", ",");
}

function stripJsonString(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
}

function validateDuration(value: number, minimum = 0, maximum = 86_400): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new VioletPoolError(
      `Duration must be a whole number between ${minimum} and ${maximum} seconds`,
    );
  }
  return value;
}

export function validateSetpoint(field: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new VioletSetpointError(`Invalid setpoint for '${field}': value is not finite`, {
      code: "INVALID_SETPOINT",
    });
  }
  const bounds = SETPOINT_RANGES[field];
  if (bounds !== undefined && (value < bounds[0] || value > bounds[1])) {
    throw new VioletSetpointError(
      `Setpoint '${field}' value ${value} is outside the valid range [${bounds[0]}, ${bounds[1]}]`,
      { code: "SETPOINT_OUT_OF_RANGE" },
    );
  }
}

export class VioletPoolClient {
  private readonly transport: HttpTransport;
  private standalone: boolean;

  constructor(options: VioletPoolClientOptions) {
    this.transport = new HttpTransport(options);
    this.standalone = options.dosingStandalone ?? false;
  }

  get timeoutMs(): number {
    return this.transport.timeoutMs;
  }

  get maxRetries(): number {
    return this.transport.maxRetries;
  }

  get dosingStandalone(): boolean {
    return this.standalone;
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  async getReadings(): Promise<VioletReadings> {
    const response = await this.requestRecord(API_ENDPOINTS.readings, {
      query: "ALL",
      payloadName: "getReadings",
    });
    return new VioletReadings(this.flattenReadings(response));
  }

  async getHardwareProfile(): Promise<HardwareProfile> {
    const response = await this.requestRecord(API_ENDPOINTS.readings, {
      query: "ALL",
      payloadName: "getReadings",
    });
    const flat = this.flattenReadings(response);
    return {
      baseModule: !this.standalone && Object.keys(flat).length > 0,
      dosingModule: this.standalone || Object.hasOwn(flat, "SYSTEM_dosagemodule_alive_count"),
      extensionModule1: Object.hasOwn(flat, "SYSTEM_ext1module_alive_count"),
      extensionModule2: Object.hasOwn(flat, "SYSTEM_ext2module_alive_count"),
    };
  }

  async getSpecificReadings(categories: readonly string[]): Promise<VioletReadings> {
    const query = this.csvQuery(categories, "categories");
    const response = await this.requestRecord(API_ENDPOINTS.readings, {
      query,
      payloadName: "getReadings",
    });
    return new VioletReadings(this.flattenReadings(response));
  }

  async getHistory(options: { hours?: number; sensor?: string } = {}): Promise<ControllerRecord> {
    return this.requestRecord(API_ENDPOINTS.getHistory, {
      parameters: {
        hours: Math.max(1, Math.trunc(options.hours ?? 24)),
        sensor: options.sensor || "ALL",
      },
      payloadName: "getHistory",
    });
  }

  async getWeatherData(): Promise<ControllerRecord> {
    return this.requestRecord(API_ENDPOINTS.getWeatherData, { payloadName: "getWeatherdata" });
  }

  async getOverallDosing(): Promise<ControllerRecord> {
    return this.requestRecord(API_ENDPOINTS.getOverallDosing, {
      payloadName: "getOverallDosing",
    });
  }

  async getOutputStates(): Promise<ControllerRecord> {
    return this.requestRecord(API_ENDPOINTS.getOutputStates, { payloadName: "getOutputstates" });
  }

  async getConfig(parameters: readonly string[]): Promise<ControllerRecord> {
    return this.requestRecord(API_ENDPOINTS.getConfig, {
      query: this.csvQuery(parameters, "configuration keys"),
      payloadName: "getConfig",
    });
  }

  async setConfig(config: Readonly<ControllerRecord>): Promise<CommandResult> {
    if (Object.keys(config).length === 0) {
      throw new VioletPoolError("Configuration payload must not be empty");
    }
    const form: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(config)) {
      let safeKey: string;
      try {
        safeKey = InputSanitizer.validateApiParameter(key);
      } catch (error) {
        throw new VioletPoolError(`Invalid configuration parameter: ${key}`, {
          code: "INVALID_CONFIG_PARAMETER",
          cause: error,
        });
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          throw new VioletPoolError(`Invalid configuration value for: ${key}`);
        }
        form[safeKey] = value;
      } else if (typeof value === "boolean") {
        form[safeKey] = value ? 1 : 0;
      } else {
        form[safeKey] = InputSanitizer.sanitizeString(value, {
          maximumLength: 1_000,
          allowSpecialCharacters: true,
          escapeHtml: false,
        });
      }
    }
    return this.commandResult(
      await this.transport.request(API_ENDPOINTS.setConfig, {
        method: "POST",
        form,
        retryable: true,
      }),
    );
  }

  async getCalibrationRawValues(): Promise<ControllerRecord> {
    return this.requestRecord(API_ENDPOINTS.getCalibrationRawValues, {
      payloadName: "getCalibRawValues",
    });
  }

  async getCalibrationHistory(sensor: string): Promise<ControllerRecord[]> {
    if (sensor.trim().length === 0) {
      throw new VioletPoolError("Sensor name required for calibration history");
    }
    const response = await this.transport.request(API_ENDPOINTS.getCalibrationHistory, {
      query: quoteCommand(sensor),
    });
    const text = String(response ?? "").trim();
    if (text.length === 0) return [];
    return text
      .split(/\r?\n/)
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter((parts) => parts.length >= 3)
      .map((parts) => ({ timestamp: parts[0], value: parts[1], type: parts[2] }));
  }

  async restoreCalibration(sensor: string, timestamp: string): Promise<CommandResult> {
    if (sensor.trim().length === 0 || timestamp.trim().length === 0) {
      throw new VioletPoolError("Sensor and timestamp are required for calibration restore");
    }
    return this.commandResult(
      await this.transport.request(API_ENDPOINTS.restoreCalibration, {
        method: "POST",
        form: { sensor, timestamp },
      }),
    );
  }

  async setOutputTestMode(options: {
    output: string;
    mode?: string;
    durationSeconds?: number;
  }): Promise<CommandResult> {
    if (options.output.trim().length === 0) {
      throw new VioletPoolError("Output identifier is required");
    }
    const durationMilliseconds = validateDuration(options.durationSeconds ?? 120) * 1_000;
    const query = quoteCommand(
      `${options.output},${options.mode ?? "SWITCH"},${durationMilliseconds}`,
    );
    return this.commandResult(
      await this.transport.request(API_ENDPOINTS.setOutputTestMode, { query }),
    );
  }

  async setSwitchState(
    key: string,
    action: string,
    options: { durationSeconds?: number; lastValue?: number } = {},
  ): Promise<CommandResult> {
    const normalizedKey = InputSanitizer.validateDeviceKey(key);
    const duration =
      options.durationSeconds === undefined ? undefined : validateDuration(options.durationSeconds);
    if (this.standalone && this.isBaseModuleFunction(normalizedKey)) {
      throw new VioletPoolError(
        `Function '${normalizedKey}' requires the Violet base module and is not available in dosing-standalone mode`,
      );
    }
    if (normalizedKey.startsWith("DOS_")) {
      return this.triggerDosing(normalizedKey, action, duration);
    }
    const normalizedAction =
      normalizedKey === "PVSURPLUS"
        ? this.normalizePvSurplusAction(action)
        : action.trim().toUpperCase();
    const query = quoteCommand(
      this.manualCommand(normalizedKey, normalizedAction, duration, options.lastValue),
    );
    return this.commandResult(
      await this.transport.request(API_ENDPOINTS.setFunctionManually, { query }),
    );
  }

  async manualDosing(
    dosingType: Exclude<DosingType, "H2O2">,
    durationSeconds: number,
  ): Promise<CommandResult> {
    const key = DOSING_FUNCTIONS[dosingType];
    if (key === undefined) throw new VioletPoolError(`Unknown dosing type: ${dosingType}`);
    if (durationSeconds <= 0) return this.setSwitchState(key, ACTIONS.off);
    return this.setSwitchState(key, ACTIONS.on, { durationSeconds });
  }

  async setPvSurplus(options: { active: boolean; pumpSpeed?: number }): Promise<CommandResult> {
    const speed =
      options.pumpSpeed === undefined
        ? undefined
        : Math.max(1, Math.min(3, Math.trunc(options.pumpSpeed)));
    return this.setSwitchState("PVSURPLUS", options.active ? ACTIONS.on : ACTIONS.off, {
      ...(speed === undefined ? {} : { lastValue: speed }),
    });
  }

  async setAllDmxScenes(action: "ALLON" | "ALLOFF" | "ALLAUTO"): Promise<CommandResult> {
    if (![ACTIONS.allOn, ACTIONS.allOff, ACTIONS.allAuto].includes(action)) {
      throw new VioletPoolError(`Unsupported DMX action: ${action}`);
    }
    return this.setSwitchState("DMX_SCENE1", action);
  }

  async setCoverCommand(
    action: string,
    options: { acknowledgeUnsafe?: boolean } = {},
  ): Promise<CommandResult> {
    if (options.acknowledgeUnsafe !== true) {
      throw new VioletUnsafeOperationError(
        "Cover movement is potentially unsafe. Pass acknowledgeUnsafe: true to confirm the risk.",
      );
    }
    const coverKey = COVER_FUNCTIONS[action.trim().toUpperCase()];
    if (coverKey === undefined) {
      throw new VioletPoolError(`Unknown cover action '${action}'. Valid: OPEN, CLOSE, STOP`);
    }
    return this.setSwitchState(coverKey, ACTIONS.push);
  }

  async setLightColorPulse(): Promise<CommandResult> {
    return this.setSwitchState("LIGHT", ACTIONS.color);
  }

  async triggerDigitalInputRule(ruleKey: string): Promise<CommandResult> {
    return this.setSwitchState(ruleKey, ACTIONS.push);
  }

  async setDigitalInputRuleLock(ruleKey: string, locked: boolean): Promise<CommandResult> {
    return this.setSwitchState(ruleKey, locked ? ACTIONS.lock : ACTIONS.unlock);
  }

  async setDeviceTemperature(climateKey: string, temperature: number): Promise<CommandResult> {
    const normalized = climateKey.trim().toUpperCase();
    const configKey =
      normalized === "HEATER"
        ? "HEATER_set_temp"
        : normalized === "SOLAR"
          ? "SOLAR_maxtemp"
          : undefined;
    if (configKey === undefined) {
      throw new VioletPoolError(`Unknown climate key '${climateKey}'. Expected HEATER or SOLAR`);
    }
    return this.setTargetValue(configKey, temperature);
  }

  async setPhTarget(value: number): Promise<CommandResult> {
    return this.setTargetValue(TARGETS.ph, value);
  }

  async setOrpTarget(value: number): Promise<CommandResult> {
    return this.setTargetValue(TARGETS.orp, Math.trunc(value));
  }

  async setMinimumChlorineLevel(value: number): Promise<CommandResult> {
    return this.setTargetValue(TARGETS.minimumChlorine, value);
  }

  async setTargetValue(key: string, value: number): Promise<CommandResult> {
    validateSetpoint(key, value);
    return this.setConfig({ [key]: value });
  }

  async setDosingParameters(parameters: Readonly<ControllerRecord>): Promise<CommandResult> {
    return this.setConfig(parameters);
  }

  async setDosageEnabled(dosingType: DosingType, enabled: boolean): Promise<CommandResult> {
    const prefix = DOSING_CONFIG_PREFIX[dosingType];
    if (prefix === undefined) throw new VioletPoolError(`Unknown dosing type '${dosingType}'`);
    return this.setConfig({ [`${prefix}_use`]: enabled ? 1 : 0 });
  }

  async isDosageEnabled(dosingType: DosingType): Promise<boolean> {
    const prefix = DOSING_CONFIG_PREFIX[dosingType];
    if (prefix === undefined) throw new VioletPoolError(`Unknown dosing type '${dosingType}'`);
    const result = await this.getConfig([`${prefix}_use`]);
    const rawValue = result[`${prefix}_use`] ?? 0;
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      throw new VioletPayloadError(
        `Invalid dosage enabled state for ${dosingType}: ${String(rawValue)}`,
      );
    }
    return Math.trunc(numeric) !== 0;
  }

  async setPumpSpeed(speed: number, durationSeconds = 0): Promise<CommandResult> {
    return this.setSwitchState("PUMP", ACTIONS.on, {
      durationSeconds: validateDuration(durationSeconds),
      lastValue: Math.max(1, Math.min(3, Math.trunc(speed))),
    });
  }

  async controlPump(
    action: string,
    options: { speed?: number; durationSeconds?: number } = {},
  ): Promise<CommandResult> {
    return this.setSwitchState("PUMP", action, {
      ...(options.speed === undefined ? {} : { lastValue: options.speed }),
      ...(options.durationSeconds === undefined
        ? {}
        : { durationSeconds: options.durationSeconds }),
    });
  }

  static parseErrorNotification(errorCode: string, subject?: string): ErrorNotification {
    const trimmed = String(errorCode).trim();
    if (trimmed.length === 0) {
      return {
        code: "0000",
        severity: "UNKNOWN",
        message: "Invalid empty error code",
        isAlarm: false,
        isWarning: false,
        isInfo: false,
        isReminder: false,
      };
    }
    const code = trimmed.padStart(4, "0");
    const info = ERROR_CODES[code];
    const severity = info?.severity ?? "WARNING";
    const message = info?.message ?? subject ?? `Unbekannter Fehlercode ${code}`;
    return {
      code,
      severity,
      message,
      isAlarm: severity === "ALARM",
      isWarning: severity === "WARNING",
      isInfo: severity === "INFO",
      isReminder: severity === "REMINDER",
    };
  }

  static parseMultipleErrors(errorData: Readonly<ControllerRecord>): ErrorNotification[] {
    const code = String(errorData.ERRORCODE ?? "");
    if (code.length === 0 || code === "0") return [];
    const subject = String(errorData.SUBJECT ?? "");
    return code
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value !== "0")
      .map((value) => VioletPoolClient.parseErrorNotification(value, subject));
  }

  async getLog(logType: string, page = 0): Promise<LogResult> {
    const query = page < 0 && logType === "actions" ? "downloadActionsLog" : `${logType}&${page}`;
    const raw = String(
      (await this.transport.request(API_ENDPOINTS.getLog, { query })) ?? "",
    ).trim();
    const lines = raw.length === 0 ? [] : raw.split(/\r?\n/);
    const hasMore = lines.at(-1)?.trim() === "LOAD_MORE";
    if (hasMore) lines.pop();
    return { lines: lines.filter((line) => line.trim().length > 0), hasMore, raw };
  }

  async getNotifications(): Promise<ControllerRecord> {
    return this.requestRecord(API_ENDPOINTS.getNotifications, {
      query: "ALL",
      payloadName: "getNotifications",
    });
  }

  async resetBlocking(): Promise<CommandResult> {
    return this.commandResult(
      await this.transport.request(API_ENDPOINTS.resetBlocking, {
        priority: API_PRIORITY_CRITICAL,
      }),
    );
  }

  async setCanAmount(
    dosingKey: string,
    amountMl: number,
    options: { reset?: boolean } = {},
  ): Promise<CommandResult> {
    const canisterId = DOSING_CANISTER_ID[dosingKey];
    if (canisterId === undefined) {
      throw new VioletPoolError(`Unknown dosing key for setCanAmount: '${dosingKey}'`);
    }
    if (!Number.isFinite(amountMl) || amountMl <= 0) {
      throw new RangeError(`amountMl must be > 0, got ${amountMl}`);
    }
    return this.commandResult(
      await this.transport.request(API_ENDPOINTS.setCanAmount, {
        method: "POST",
        form: {
          action: options.reset === true ? "RESET" : "ADJUST",
          which: dosingKey,
          amount: Math.trunc(amountMl),
          cid: canisterId,
        },
        priority: API_PRIORITY_CRITICAL,
      }),
    );
  }

  async setSystemService(service: SystemService, enabled: boolean): Promise<CommandResult> {
    const definition = SYSTEM_SERVICES[service];
    if (definition === undefined) throw new VioletPoolError(`Unknown system service: '${service}'`);
    return this.commandResult(
      await this.transport.request(
        enabled ? definition.enableEndpoint : definition.disableEndpoint,
        { priority: API_PRIORITY_CRITICAL },
      ),
    );
  }

  async getSystemServices(): Promise<Partial<Record<SystemService, boolean>>> {
    const raw = await this.requestRecord(API_ENDPOINTS.getServiceStates, {
      payloadName: "getServiceStates",
    });
    const result: Partial<Record<SystemService, boolean>> = {};
    for (const [service, definition] of Object.entries(SYSTEM_SERVICES) as [
      SystemService,
      (typeof SYSTEM_SERVICES)[SystemService],
    ][]) {
      if (definition.stateKey !== "" && Object.hasOwn(raw, definition.stateKey)) {
        const state = Number(raw[definition.stateKey]);
        if (!Number.isInteger(state)) {
          throw new VioletPayloadError(
            `Unexpected service state for ${service}: ${String(raw[definition.stateKey])}`,
          );
        }
        result[service] = state !== 0;
      }
    }
    return result;
  }

  async setOmniPosition(position: number): Promise<CommandResult> {
    if (!Number.isInteger(position) || position < 0 || position >= OMNI_POSITIONS.length) {
      throw new VioletPoolError(`Invalid OmniTronic position: ${position}. Must be 0-5`);
    }
    return this.commandResult(
      await this.transport.request(API_ENDPOINTS.setFunctionManually, {
        query: `OMNI,${OMNI_POSITIONS[position]},0,0`,
        priority: API_PRIORITY_CRITICAL,
      }),
    );
  }

  async getRs485PumpData(pumpName: Rs485PumpName): Promise<ControllerRecord> {
    if (!RS485_PUMP_NAMES.includes(pumpName)) {
      throw new VioletPoolError(`Unknown RS485 pump name: '${pumpName}'`);
    }
    const body = await this.transport.request(API_ENDPOINTS.getRs485PumpData, {
      query: pumpName,
      expectJson: true,
    });
    return isRecord(body) ? body : { raw: body };
  }

  async setRs485Live(
    pumpName: Rs485PumpName,
    slaveId: number,
    mode: Rs485PumpMode,
    level: number,
  ): Promise<string> {
    if (!RS485_PUMP_NAMES.includes(pumpName)) {
      throw new VioletPoolError(`Unknown RS485 pump name: '${pumpName}'`);
    }
    if (!RS485_PUMP_MODES.includes(mode)) {
      throw new VioletPoolError(`Invalid RS485 mode: '${mode}'`);
    }
    if (!Number.isInteger(slaveId) || slaveId < 1 || slaveId > 247) {
      throw new RangeError(`slaveId must be 1-247, got ${slaveId}`);
    }
    const body = await this.transport.request(API_ENDPOINTS.setRs485Live, {
      query: `${pumpName},${slaveId},${mode},${level}`,
      priority: API_PRIORITY_CRITICAL,
    });
    return stripJsonString(String(body ?? ""));
  }

  async endRs485Live(): Promise<string> {
    const body = await this.transport.request(API_ENDPOINTS.setRs485Live, {
      query: "DONE",
      priority: API_PRIORITY_CRITICAL,
    });
    return stripJsonString(String(body ?? ""));
  }

  async getLiveTrace(): Promise<Record<string, string>> {
    const body = String((await this.transport.request(API_ENDPOINTS.getLiveTrace)) ?? "");
    const lines = body.split(/\r?\n/);
    if (lines.length < 3) {
      throw new VioletPayloadError(
        `Malformed getLiveTrace payload: expected 3 lines, got ${lines.length}`,
      );
    }
    const headers = lines[0]?.split(";") ?? [];
    const values = lines[2]?.split(";") ?? [];
    const result: Record<string, string> = {};
    for (let index = 0; index < Math.min(headers.length, values.length); index += 1) {
      const key = headers[index]?.trim();
      if (key !== undefined && key.length > 0) {
        result[key] = values[index]?.replaceAll(",", ".").trim() ?? "";
      }
    }
    return result;
  }

  async initUpdate(): Promise<string> {
    return String(
      (await this.transport.request(API_ENDPOINTS.initUpdate, {
        priority: API_PRIORITY_CRITICAL,
      })) ?? "",
    ).trim();
  }

  async getUpdateState(): Promise<string> {
    const result = String(
      (await this.transport.request(API_ENDPOINTS.getUpdateState)) ?? "",
    ).trim();
    return result || "STANDBY";
  }

  async getUpdateHistory(): Promise<string> {
    return String((await this.transport.request(API_ENDPOINTS.getUpdateHistory)) ?? "").trim();
  }

  async getOutputRuntimes(): Promise<ControllerRecord> {
    return this.requestRecord(API_ENDPOINTS.getOutputRuntimes, {
      payloadName: "getOutputruntimes",
    });
  }

  private async triggerDosing(
    key: string,
    action: string,
    durationSeconds?: number,
  ): Promise<CommandResult> {
    const output = DOSING_OUTPUT_INDEX[key];
    if (output === undefined) throw new VioletPoolError(`Unknown dosing output key: ${key}`);
    const normalized = action.trim().toUpperCase();
    let dosingAction: "DOSSTART" | "DOSSTOP";
    if (["OFF", "STOP", "AUTO", "DOSSTOP"].includes(normalized)) dosingAction = "DOSSTOP";
    else if (["ON", "START", "DOSSTART"].includes(normalized)) dosingAction = "DOSSTART";
    else throw new VioletPoolError(`Unsupported dosing action for ${key}: ${action}`);
    let duration = 0;
    if (dosingAction === "DOSSTART") {
      if (durationSeconds === undefined) {
        throw new VioletPoolError(`A positive duration is required to start dosing output ${key}`);
      }
      duration = validateDuration(durationSeconds, 1);
    }
    return this.commandResult(
      await this.transport.request(API_ENDPOINTS.triggerManualDosing, {
        method: "POST",
        form: {
          action: dosingAction,
          output,
          runtime: duration,
          from: 1,
          runtime_formatted: `${String(Math.trunc(duration / 60)).padStart(2, "0")}:${String(duration % 60).padStart(2, "0")}`,
        },
        priority: API_PRIORITY_CRITICAL,
      }),
    );
  }

  private normalizePvSurplusAction(action: string): string {
    const normalized = action.trim().toUpperCase();
    if (normalized === ACTIONS.auto) return ACTIONS.off;
    if (normalized !== ACTIONS.on && normalized !== ACTIONS.off) {
      throw new VioletPoolError(
        `Unsupported PVSURPLUS action '${action}': only ON and OFF are supported`,
      );
    }
    return normalized;
  }

  private manualCommand(
    key: string,
    action: string,
    durationSeconds?: number,
    lastValue?: number,
  ): string {
    const template = DEVICE_PARAMETERS[key]?.apiTemplate ?? `${key},{action},{duration},{value}`;
    const values: Record<string, number | string> = {
      action,
      duration: validateDuration(durationSeconds ?? 0),
      speed: Math.trunc(lastValue ?? 0),
      value: Math.trunc(lastValue ?? 0),
    };
    return template.replace(/\{(action|duration|speed|value)\}/g, (_, name: string) =>
      String(values[name] ?? 0),
    );
  }

  private commandResult(body: unknown): CommandResult {
    if (isRecord(body)) {
      return {
        ...body,
        success: body.success === undefined ? true : Boolean(body.success),
        response: String(body.response ?? ""),
      };
    }
    const response = String(body ?? "").trim();
    const lines = response.length === 0 ? [] : response.split(/\r?\n/);
    const first = lines[0]?.trim().toUpperCase() ?? "";
    const success = first === "OK" || first.startsWith("MANDOS_");
    return {
      success,
      response,
      ...(lines[1] === undefined ? {} : { output: lines[1].trim() }),
      ...(lines.length < 3
        ? {}
        : {
            message: lines
              .slice(2)
              .map((line) => line.trim())
              .join("\n"),
          }),
    };
  }

  private async requestRecord(
    endpoint: string,
    options: {
      parameters?: Readonly<Record<string, string | number | boolean>>;
      query?: string;
      payloadName: string;
    },
  ): Promise<ControllerRecord> {
    const response = await this.transport.request(endpoint, {
      expectJson: true,
      ...(options.parameters === undefined ? {} : { parameters: options.parameters }),
      ...(options.query === undefined ? {} : { query: options.query }),
    });
    if (!isRecord(response)) {
      throw new VioletPayloadError(`Unexpected payload returned from ${options.payloadName}`, {
        code: "UNEXPECTED_PAYLOAD",
        endpoint,
      });
    }
    return response;
  }

  private csvQuery(values: readonly string[], fieldName: string): string {
    const query = values
      .map((value) => value.trim())
      .filter(Boolean)
      .join(",");
    if (query.length === 0) throw new VioletPoolError(`No valid ${fieldName} provided`);
    return quoteCommand(query);
  }

  private flattenReadings(response: ControllerRecord): ControllerRecord {
    const readings = response.getReadings;
    if (isRecord(readings)) {
      this.standalone = false;
      return this.filterOrphanExtensions(readings);
    }
    if (Array.isArray(readings)) {
      this.standalone = true;
      const result: ControllerRecord = {};
      for (const item of readings) {
        if (!isRecord(item) || item["VALUE NAME"] === undefined) continue;
        const key = String(item["VALUE NAME"]).trim().replace(/^"|"$/g, "");
        result[key] = item.VALUE ?? item["VALUE "] ?? item.value;
      }
      return result;
    }
    return response;
  }

  private filterOrphanExtensions(readings: ControllerRecord): ControllerRecord {
    const hasExtension1 = Object.hasOwn(readings, "SYSTEM_ext1module_alive_count");
    const hasExtension2 = Object.hasOwn(readings, "SYSTEM_ext2module_alive_count");
    return Object.fromEntries(
      Object.entries(readings).filter(
        ([key]) =>
          (hasExtension1 || !key.startsWith("EXT1")) && (hasExtension2 || !key.startsWith("EXT2")),
      ),
    );
  }

  private isBaseModuleFunction(key: string): boolean {
    if (key.startsWith("DOS_")) return false;
    if (/^(EXT|DMX_SCENE|DIRULE_|OMNI_DC)/.test(key)) return true;
    return [
      "PUMP",
      "SOLAR",
      "HEATER",
      "LIGHT",
      "ECO",
      "BACKWASH",
      "BACKWASHRINSE",
      "REFILL",
      "PVSURPLUS",
      "COVER_OPEN",
      "COVER_CLOSE",
      "COVER_STOP",
    ].includes(key);
  }
}
