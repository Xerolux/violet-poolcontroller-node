import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  OutputState,
  VioletAuthError,
  VioletPoolClient,
  VioletSetpointError,
  VioletUnsafeOperationError,
  getGlobalRateLimiter,
} from "../src/index.js";
import { createMockController, type MockController } from "./mock-server.js";

const controllers: MockController[] = [];
const clients: VioletPoolClient[] = [];

async function setup(options: Parameters<typeof createMockController>[0] = {}): Promise<{
  controller: MockController;
  client: VioletPoolClient;
}> {
  const controller = await createMockController(options);
  const client = new VioletPoolClient({
    host: controller.host,
    maxRetries: 1,
    retryBaseDelayMs: 1,
    ...(options.username === undefined ? {} : options),
  });
  controllers.push(controller);
  clients.push(client);
  return { controller, client };
}

beforeEach(() => getGlobalRateLimiter().reset());

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(controllers.splice(0).map((controller) => controller.close()));
});

describe("VioletPoolClient", () => {
  it("reads and normalizes a base-module snapshot", async () => {
    const { client } = await setup();
    const readings = await client.getReadings();

    expect(readings.pump).toBe(OutputState.ManualOn);
    expect(readings.ph).toBe(7.21);
    expect(readings.pumpRuntimeMilliseconds).toBe(3_723_000);
    expect(readings.has("EXT1_1")).toBe(true);
    expect(readings.has("EXT2_1")).toBe(false);
  });

  it("normalizes standalone list responses", async () => {
    const { controller, client } = await setup();
    controller.state.standalone = true;

    const readings = await client.getReadings();

    expect(client.dosingStandalone).toBe(true);
    expect(readings.ph).toBe(7.21);
    expect(readings.get("DOS_1_CL")).toBe("4");
    await expect(client.setPumpSpeed(2)).rejects.toThrow(/base module/);
  });

  it("reports the connected hardware profile", async () => {
    const { client } = await setup();
    await expect(client.getHardwareProfile()).resolves.toEqual({
      baseModule: true,
      dosingModule: true,
      extensionModule1: true,
      extensionModule2: false,
    });
  });

  it("uses the manual-function command format for pump control", async () => {
    const { controller, client } = await setup();

    const result = await client.setPumpSpeed(3, 120);

    expect(result.success).toBe(true);
    expect(controller.state.requests.at(-1)).toMatchObject({
      method: "GET",
      path: "/setFunctionManually",
      query: "PUMP,ON,120,3",
    });
  });

  it("routes dosing through triggerManualDosing", async () => {
    const { controller, client } = await setup();

    await client.manualDosing("Flockmittel", 125);

    const request = controller.state.requests.at(-1);
    expect(request).toMatchObject({ method: "POST", path: "/triggerManualDosing" });
    expect(new URLSearchParams(request?.body).get("output")).toBe("5");
    expect(new URLSearchParams(request?.body).get("runtime_formatted")).toBe("02:05");
  });

  it("requires acknowledgement for physical movement", async () => {
    const { client } = await setup();

    await expect(client.setCoverCommand("OPEN")).rejects.toBeInstanceOf(VioletUnsafeOperationError);
    await expect(
      client.setCoverCommand("OPEN", { acknowledgeUnsafe: true }),
    ).resolves.toMatchObject({ success: true });
  });

  it("validates setpoint ranges before sending", async () => {
    const { controller, client } = await setup();

    await expect(client.setPhTarget(9)).rejects.toBeInstanceOf(VioletSetpointError);
    expect(controller.state.requests).toHaveLength(0);

    await client.setPhTarget(7.2);
    expect(controller.state.config.DOSAGE_phminus_setpoint).toBe("7.2");
  });

  it("preserves Basic Auth and fails fast on invalid credentials", async () => {
    const { controller, client } = await setup({ username: "admin", password: "secret" });
    await expect(client.getReadings()).resolves.toBeDefined();
    expect(controller.state.requests[0]?.headers.authorization).toMatch(/^Basic /);

    const invalid = new VioletPoolClient({
      host: controller.host,
      username: "admin",
      password: "wrong",
      maxRetries: 3,
    });
    clients.push(invalid);
    const before = controller.state.requests.length;
    await expect(invalid.getReadings()).rejects.toBeInstanceOf(VioletAuthError);
    expect(controller.state.requests.length - before).toBe(1);
  });

  it("retries transient server failures", async () => {
    const { controller } = await setup();
    const client = new VioletPoolClient({
      host: controller.host,
      maxRetries: 2,
      retryBaseDelayMs: 1,
    });
    clients.push(client);
    controller.state.failuresRemaining = 1;

    await expect(client.getReadings()).resolves.toBeDefined();
    expect(controller.state.requests).toHaveLength(2);
  });

  it("supports service, trace, RS485 and update endpoints", async () => {
    const { client } = await setup();

    await expect(client.getSystemServices()).resolves.toMatchObject({ ftp: true, samba: false });
    await expect(client.getLiveTrace()).resolves.toEqual({ pH: "7.21", ORP: "735" });
    await expect(client.getRs485PumpData("BADU_ECO_DRIVE_II")).resolves.toMatchObject({
      SLAVE_PRESENT: 1,
    });
    await expect(client.endRs485Live()).resolves.toBe("DONE");
    await expect(client.initUpdate()).resolves.toBe("STARTING");
    await expect(client.getUpdateState()).resolves.toBe("STANDBY");
  });
});
