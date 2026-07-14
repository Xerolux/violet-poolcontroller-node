import { CoverState, OnewireState } from "./constants/devices.js";
import type { DmxSceneState, OutputState, PvSurplusState, RuleState } from "./constants/devices.js";
import { parseRuntimeMilliseconds, parseUptimeMilliseconds } from "./parsers.js";
import type { ControllerRecord } from "./types.js";

const dosingKeys = ["DOS_1_CL", "DOS_2_ELO", "DOS_4_PHM", "DOS_5_PHP", "DOS_6_FLOC"] as const;

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function numericEnumValue<T extends number>(values: readonly T[], value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  const numeric = Number(String(value).split("|")[0]?.trim());
  return values.includes(numeric as T) ? (numeric as T) : undefined;
}

function stringEnumValue<T extends string>(values: readonly T[], value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim().toUpperCase();
  return values.includes(normalized as T) ? (normalized as T) : undefined;
}

export class VioletReadings implements Iterable<[string, unknown]> {
  readonly raw: Readonly<ControllerRecord>;

  constructor(raw: ControllerRecord) {
    this.raw = Object.freeze({ ...raw });
  }

  get size(): number {
    return Object.keys(this.raw).length;
  }

  get softwareVersion(): string | undefined {
    const value = this.raw.SW_VERSION;
    return value === null || value === undefined ? undefined : String(value).trim();
  }

  get cpuTemperature(): number | undefined {
    return optionalNumber(this.raw.CPU_TEMP);
  }

  get carrierCpuTemperature(): number | undefined {
    return optionalNumber(this.raw.CPU_TEMP_CARRIER);
  }

  get cpuUptimeMilliseconds(): number {
    return parseUptimeMilliseconds(String(this.raw.CPU_UPTIME ?? ""));
  }

  get memoryUsageMb(): number | undefined {
    return optionalNumber(this.raw.SYSTEM_MEMORY);
  }

  get ph(): number | undefined {
    return optionalNumber(this.raw.pH_value);
  }

  get phMinimum(): number | undefined {
    return optionalNumber(this.raw.pH_value_min);
  }

  get phMaximum(): number | undefined {
    return optionalNumber(this.raw.pH_value_max);
  }

  get orp(): number | undefined {
    return optionalNumber(this.raw.orp_value);
  }

  get orpMinimum(): number | undefined {
    return optionalNumber(this.raw.orp_value_min);
  }

  get orpMaximum(): number | undefined {
    return optionalNumber(this.raw.orp_value_max);
  }

  get chlorine(): number | undefined {
    return optionalNumber(this.raw.pot_value);
  }

  get chlorineMinimum(): number | undefined {
    return optionalNumber(this.raw.pot_value_min);
  }

  get chlorineMaximum(): number | undefined {
    return optionalNumber(this.raw.pot_value_max);
  }

  get pump(): OutputState | undefined {
    return this.outputState("PUMP");
  }

  get pumpRuntimeMilliseconds(): number {
    return this.runtime("PUMP_RUNTIME");
  }

  get solar(): OutputState | undefined {
    return this.outputState("SOLAR");
  }

  get solarRuntimeMilliseconds(): number {
    return this.runtime("SOLAR_RUNTIME");
  }

  get heater(): OutputState | undefined {
    return this.outputState("HEATER");
  }

  get heaterRuntimeMilliseconds(): number {
    return this.runtime("HEATER_RUNTIME");
  }

  get light(): OutputState | undefined {
    return this.outputState("LIGHT");
  }

  get eco(): OutputState | undefined {
    return this.outputState("ECO");
  }

  get backwash(): OutputState | undefined {
    return this.outputState("BACKWASH");
  }

  get backwashRinse(): OutputState | undefined {
    return this.outputState("BACKWASHRINSE");
  }

  get refill(): OutputState | undefined {
    return this.outputState("REFILL");
  }

  get pvSurplus(): PvSurplusState | undefined {
    return numericEnumValue([0, 1, 2] as const, this.raw.PVSURPLUS);
  }

  get cover(): CoverState | undefined {
    return stringEnumValue(Object.values(CoverState), this.raw.COVER_STATE);
  }

  get onewireTemperatures(): Readonly<Record<number, number | undefined>> {
    return Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const sensor = index + 1;
        return [sensor, optionalNumber(this.raw[`onewire${sensor}_value`])];
      }),
    );
  }

  get onewireStates(): Readonly<Record<number, OnewireState | undefined>> {
    return Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const sensor = index + 1;
        return [
          sensor,
          stringEnumValue(Object.values(OnewireState), this.raw[`onewire${sensor}_state`]),
        ];
      }),
    );
  }

  get analogInputs(): Readonly<Record<number, number | undefined>> {
    return this.numberedValues("ADC", "_value", 6);
  }

  get impulseInputs(): Readonly<Record<number, number | undefined>> {
    return this.numberedValues("IMP", "_value", 2);
  }

  get digitalInputs(): Readonly<Record<number, boolean>> {
    return Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const input = index + 1;
        return [input, Number(this.raw[`INPUT${input}`] ?? 0) !== 0];
      }),
    );
  }

  get dosingStates(): Readonly<Record<string, OutputState | undefined>> {
    return Object.fromEntries(dosingKeys.map((key) => [key, this.outputState(key)]));
  }

  get dosingDailyAmountsMl(): Readonly<Record<string, number | undefined>> {
    return Object.fromEntries(
      dosingKeys.map((key) => [key, optionalNumber(this.raw[`${key}_DAILY_DOSING_AMOUNT_ML`])]),
    );
  }

  get dmxScenes(): Readonly<Record<number, DmxSceneState | undefined>> {
    return Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const scene = index + 1;
        return [scene, numericEnumValue([0, 1, 4, 6] as const, this.raw[`DMX_SCENE${scene}`])];
      }),
    );
  }

  get extensionRelays(): Readonly<Record<string, OutputState | undefined>> {
    const entries: [string, OutputState | undefined][] = [];
    for (const bank of [1, 2]) {
      for (let relay = 1; relay <= 8; relay += 1) {
        const key = `EXT${bank}_${relay}`;
        entries.push([key, this.outputState(key)]);
      }
    }
    return Object.fromEntries(entries);
  }

  get digitalRules(): Readonly<Record<number, RuleState | undefined>> {
    return Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => {
        const rule = index + 1;
        const key = `DIGITALINPUTRULE_STATE_DIGITALINPUT_RULE_${rule}`;
        return [rule, numericEnumValue([0, 1, 5, 6] as const, this.raw[key])];
      }),
    );
  }

  get(key: string): unknown {
    return this.raw[key];
  }

  has(key: string): boolean {
    return Object.hasOwn(this.raw, key);
  }

  entries(): IterableIterator<[string, unknown]> {
    return Object.entries(this.raw)[Symbol.iterator]();
  }

  keys(): IterableIterator<string> {
    return Object.keys(this.raw)[Symbol.iterator]();
  }

  values(): IterableIterator<unknown> {
    return Object.values(this.raw)[Symbol.iterator]();
  }

  [Symbol.iterator](): IterableIterator<[string, unknown]> {
    return this.entries();
  }

  toString(): string {
    return `VioletReadings(keys=${this.size}, pump=${this.pump ?? "?"}, pH=${this.ph ?? "?"}, ORP=${this.orp ?? "?"})`;
  }

  private outputState(key: string): OutputState | undefined {
    return numericEnumValue([0, 1, 2, 3, 4, 5, 6] as const, this.raw[key]);
  }

  private runtime(key: string): number {
    return parseRuntimeMilliseconds(String(this.raw[key] ?? ""));
  }

  private numberedValues(
    prefix: string,
    suffix: string,
    count: number,
  ): Readonly<Record<number, number | undefined>> {
    return Object.fromEntries(
      Array.from({ length: count }, (_, index) => {
        const input = index + 1;
        return [input, optionalNumber(this.raw[`${prefix}${input}${suffix}`])];
      }),
    );
  }
}
