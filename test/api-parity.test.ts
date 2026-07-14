import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  VioletPoolClient,
  VioletPoolError,
  VioletSetpointError,
  getGlobalRateLimiter,
} from "../src/index.js";
import { createMockController, type MockController } from "./mock-server.js";

let controller: MockController;
let client: VioletPoolClient;

beforeEach(async () => {
  getGlobalRateLimiter().reset();
  controller = await createMockController();
  client = new VioletPoolClient({
    host: controller.host,
    maxRetries: 1,
    retryBaseDelayMs: 1,
  });
});

afterEach(async () => {
  await client.close();
  await controller.close();
});

describe("Python API wire parity", () => {
  it("uses the reference read endpoints and query formats", async () => {
    await client.getSpecificReadings(["ALL", "DOSAGE"]);
    await client.getHistory({ hours: 12, sensor: "pH" });
    await client.getWeatherData();
    await client.getOverallDosing();
    await client.getOutputStates();
    await client.getOutputRuntimes();
    await client.getNotifications();

    expect(controller.state.requests.map(({ path }) => path)).toEqual([
      "/getReadings",
      "/getHistory",
      "/getWeatherdata",
      "/getOverallDosing",
      "/getOutputstates",
      "/getOutputruntimes",
      "/getNotifications",
    ]);
    expect(controller.state.requests[0]?.query).toBe("ALL,DOSAGE");
    expect(controller.state.requests[1]?.query).toBe("hours=12&sensor=pH");
    expect(controller.state.requests[6]?.query).toBe("ALL");
  });

  it("matches configuration and calibration request contracts", async () => {
    await client.getConfig(["PUMP_SPEED_1", "HEATER_set_temp"]);
    await client.setConfig({ PUMP_SPEED_1: 2, LABEL: "Pool & Spa" });
    await client.getCalibrationRawValues();
    const history = await client.getCalibrationHistory("pH");
    await client.restoreCalibration("pH", "2026-01-01");
    await client.setOutputTestMode({ output: "PUMP" });

    expect(history).toHaveLength(2);
    expect(controller.state.requests.map(({ path }) => path)).toEqual([
      "/getConfig",
      "/setConfig",
      "/getCalibRawValues",
      "/getCalibHistory",
      "/restoreOldCalib",
      "/setOutputTestmode",
    ]);
    expect(controller.state.requests[0]?.query).toBe("PUMP_SPEED_1,HEATER_set_temp");
    expect(new URLSearchParams(controller.state.requests[1]?.body).get("LABEL")).toBe("Pool & Spa");
    expect(controller.state.requests[5]?.query).toBe("PUMP,SWITCH,120000");
  });

  it("matches output, dosing, rule and setpoint commands", async () => {
    await client.controlPump("OFF", { durationSeconds: 60 });
    await client.setPvSurplus({ active: true, pumpSpeed: 3 });
    await client.setAllDmxScenes("ALLAUTO");
    await client.setCoverCommand("STOP", { acknowledgeUnsafe: true });
    await client.setLightColorPulse();
    await client.triggerDigitalInputRule("DIRULE_2");
    await client.setDigitalInputRuleLock("DIRULE_2", true);
    await client.setDeviceTemperature("SOLAR", 30);
    await client.setOrpTarget(750);
    await client.setMinimumChlorineLevel(0.5);
    await client.setDosingParameters({ DOSAGE_floc_use: 1 });
    await client.setDosageEnabled("pH-", true);
    await expect(client.isDosageEnabled("pH-")).resolves.toBe(true);

    const queries = controller.state.requests
      .filter(({ path }) => path === "/setFunctionManually")
      .map(({ query }) => query);
    expect(queries).toContain("PUMP,OFF,60,0");
    expect(queries).toContain("PVSURPLUS,ON,3,0");
    expect(queries).toContain("DMX_SCENE1,ALLAUTO,0,0");
    expect(queries).toContain("COVER_STOP,PUSH,0,0");
    expect(queries).toContain("LIGHT,COLOR,0,0");
    expect(queries).toContain("DIRULE_2,PUSH,0,0");
    expect(queries).toContain("DIRULE_2,LOCK,0,0");
    expect(controller.state.config.SOLAR_maxtemp).toBe("30");
    expect(controller.state.config.DOSAGE_chlorine_setpoint_orp).toBe("750");
    expect(controller.state.config.DOSAGE_chlorine_lowerval_cl).toBe("0.5");
  });

  it("matches diagnostics, service, canister, OmniTronic and RS485 contracts", async () => {
    await client.resetBlocking();
    await client.setCanAmount("DOS_4_PHM", 5_000, { reset: true });
    await client.setSystemService("ssh", true);
    await client.setOmniPosition(4);
    await client.setRs485Live("BADU_ECO_DRIVE_II", 1, "hz", 45);
    await client.getLog("actions", 0);
    await client.getUpdateHistory();

    expect(controller.state.requests.map(({ path }) => path)).toEqual([
      "/resetBlocking",
      "/setCanAmount",
      "/enableSSH",
      "/setFunctionManually",
      "/setRS485Live",
      "/getLog",
      "/getUpdateHistory",
    ]);
    const canister = new URLSearchParams(controller.state.requests[1]?.body);
    expect(Object.fromEntries(canister)).toEqual({
      action: "RESET",
      which: "DOS_4_PHM",
      amount: "5000",
      cid: "4",
    });
    expect(controller.state.requests[3]?.query).toBe("OMNI,OMNI_DC4,0,0");
    expect(controller.state.requests[4]?.query).toBe("BADU_ECO_DRIVE_II,1,hz,45");
    expect(controller.state.requests[5]?.query).toBe("actions&0");
  });

  it("matches reference validation failures", async () => {
    await expect(client.getSpecificReadings([])).rejects.toBeInstanceOf(VioletPoolError);
    await expect(client.getConfig([])).rejects.toBeInstanceOf(VioletPoolError);
    await expect(client.setConfig({})).rejects.toBeInstanceOf(VioletPoolError);
    await expect(client.getCalibrationHistory("")).rejects.toBeInstanceOf(VioletPoolError);
    await expect(client.restoreCalibration("", "")).rejects.toBeInstanceOf(VioletPoolError);
    await expect(client.setPhTarget(Number.NaN)).rejects.toBeInstanceOf(VioletSetpointError);
    await expect(client.setCanAmount("UNKNOWN", 100)).rejects.toBeInstanceOf(VioletPoolError);
    await expect(client.setOmniPosition(6)).rejects.toBeInstanceOf(VioletPoolError);
    expect(controller.state.requests).toHaveLength(0);
  });
});
