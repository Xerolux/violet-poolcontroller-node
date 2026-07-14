import { describe, expect, it } from "vitest";

import {
  CoverState,
  DmxSceneState,
  InputSanitizer,
  OnewireState,
  OutputState,
  PvSurplusState,
  RuleState,
  VioletReadings,
  VioletState,
  getStateTranslationLanguage,
  isOutputEmergency,
  isOutputManual,
  isOutputOn,
  setStateTranslationLanguage,
} from "../src/index.js";

describe("typed model parity", () => {
  it("exposes the same typed readings as the Python snapshot", () => {
    const readings = new VioletReadings({
      SW_VERSION: "1.1.9",
      CPU_TEMP: "52.5",
      CPU_TEMP_CARRIER: 44,
      CPU_UPTIME: "2d 03h 04m",
      SYSTEM_MEMORY: "128.5",
      pH_value: "7.2",
      pH_value_min: "7.0",
      pH_value_max: "7.4",
      orp_value: 730,
      orp_value_min: 700,
      orp_value_max: 760,
      pot_value: "0.6",
      pot_value_min: "0.4",
      pot_value_max: "0.8",
      PUMP: "3|PUMP_ANTI_FREEZE",
      SOLAR: "1",
      HEATER: "6",
      LIGHT: 4,
      ECO: 0,
      BACKWASH: 2,
      BACKWASHRINSE: 5,
      REFILL: 1,
      PVSURPLUS: 2,
      COVER_STATE: "opening",
      PUMP_RUNTIME: "01h 02m 03s",
      SOLAR_RUNTIME: "02h",
      HEATER_RUNTIME: "45m",
      onewire1_value: "25.5",
      onewire1_state: "OK",
      ADC1_value: "12.3",
      IMP1_value: "4",
      INPUT1: "1",
      DOS_1_CL: "4",
      DOS_1_CL_DAILY_DOSING_AMOUNT_ML: "125",
      DMX_SCENE1: "1",
      EXT1_1: "3",
      DIGITALINPUTRULE_STATE_DIGITALINPUT_RULE_1: "5",
    });

    expect(readings.softwareVersion).toBe("1.1.9");
    expect(readings.cpuTemperature).toBe(52.5);
    expect(readings.carrierCpuTemperature).toBe(44);
    expect(readings.cpuUptimeMilliseconds).toBe(183_840_000);
    expect(readings.memoryUsageMb).toBe(128.5);
    expect([readings.ph, readings.phMinimum, readings.phMaximum]).toEqual([7.2, 7, 7.4]);
    expect([readings.orp, readings.orpMinimum, readings.orpMaximum]).toEqual([730, 700, 760]);
    expect([readings.chlorine, readings.chlorineMinimum, readings.chlorineMaximum]).toEqual([
      0.6, 0.4, 0.8,
    ]);
    expect(readings.pump).toBe(OutputState.AutoPriorityOn);
    expect(readings.solar).toBe(OutputState.AutoOn);
    expect(readings.heater).toBe(OutputState.ManualOff);
    expect(readings.light).toBe(OutputState.ManualOn);
    expect(readings.eco).toBe(OutputState.AutoOff);
    expect(readings.backwash).toBe(OutputState.AutoPriorityOff);
    expect(readings.backwashRinse).toBe(OutputState.EmergencyOff);
    expect(readings.refill).toBe(OutputState.AutoOn);
    expect(readings.pvSurplus).toBe(PvSurplusState.OnByHttp);
    expect(readings.cover).toBe(CoverState.Opening);
    expect(readings.pumpRuntimeMilliseconds).toBe(3_723_000);
    expect(readings.solarRuntimeMilliseconds).toBe(7_200_000);
    expect(readings.heaterRuntimeMilliseconds).toBe(2_700_000);
    expect(readings.onewireTemperatures[1]).toBe(25.5);
    expect(readings.onewireStates[1]).toBe(OnewireState.Ok);
    expect(readings.analogInputs[1]).toBe(12.3);
    expect(readings.impulseInputs[1]).toBe(4);
    expect(readings.digitalInputs[1]).toBe(true);
    expect(readings.dosingStates.DOS_1_CL).toBe(OutputState.ManualOn);
    expect(readings.dosingDailyAmountsMl.DOS_1_CL).toBe(125);
    expect(readings.dmxScenes[1]).toBe(DmxSceneState.AutoOn);
    expect(readings.extensionRelays.EXT1_1).toBe(OutputState.AutoPriorityOn);
    expect(readings.digitalRules[1]).toBe(RuleState.BlockedByRule);
    expect([...readings.keys()]).toContain("PUMP");
    expect(readings.toString()).toContain("VioletReadings");
  });

  it("matches state interpretation and translations", () => {
    const state = new VioletState("3|PUMP_ANTI_FREEZE");
    expect(state.mode).toBe("frost_protection");
    expect(state.isActive).toBe(true);
    expect(state.icon).toBe("mdi:snowflake-alert");
    expect(state.displayMode).toBe("Frostschutz");
    expect(state.displayModeFor("en")).toBe("Frost Protection");
    setStateTranslationLanguage("en");
    expect(getStateTranslationLanguage()).toBe("en");
    expect(new VioletState(4).displayMode).toBe("Manual On");
    setStateTranslationLanguage("de");
  });

  it("matches enum convenience predicates", () => {
    expect(isOutputOn(OutputState.ManualOn)).toBe(true);
    expect(isOutputManual(OutputState.ManualOff)).toBe(true);
    expect(isOutputEmergency(OutputState.EmergencyOff)).toBe(true);
  });
});

describe("input sanitizer parity", () => {
  it("matches string, numeric, range and boolean normalization", () => {
    expect(InputSanitizer.sanitizeString(" <b>Pool</b> ")).toBe("bPoolb");
    expect(InputSanitizer.sanitizeString("<Pool & Spa>", { allowSpecialCharacters: true })).toBe(
      "&lt;Pool &amp; Spa&gt;",
    );
    expect(InputSanitizer.sanitizeNumber("EUR -12.5")).toBe(12.5);
    expect(InputSanitizer.sanitizeNumber("-EUR 12.5")).toBe(-12.5);
    expect(InputSanitizer.sanitizeNumber(Number.NaN)).toBe(0);
    expect(InputSanitizer.sanitizeInteger("3.9", { minimum: 1, maximum: 3 })).toBe(3);
    expect(InputSanitizer.sanitizeFloat("7.234", { precision: 2 })).toBe(7.23);
    expect(InputSanitizer.sanitizeBoolean("enabled")).toBe(true);
    expect(InputSanitizer.sanitizeBoolean("off")).toBe(false);
    expect(InputSanitizer.validateDeviceKey("ext1-1")).toBe("EXT1_1");
    expect(() => InputSanitizer.validateApiParameter("../secret")).toThrow(/Path Traversal/);
    expect(InputSanitizer.validateDuration(90_000)).toBe(86_400);
    expect(InputSanitizer.validateSpeed(9)).toBe(4);
    expect(InputSanitizer.validateTemperature(20.04)).toBe(20);
    expect(InputSanitizer.validatePh(8.95)).toBe(9);
    expect(InputSanitizer.validateOrp(1_000)).toBe(900);
    expect(InputSanitizer.validateChlorine(-1)).toBe(0);
  });
});
