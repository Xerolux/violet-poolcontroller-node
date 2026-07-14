import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  path: string;
  query: string;
  body: string;
  headers: IncomingHttpHeaders;
}

export interface MockControllerState {
  requests: RecordedRequest[];
  standalone: boolean;
  failuresRemaining: number;
  failureStatus: number;
  config: Record<string, string>;
}

export interface MockController {
  host: string;
  state: MockControllerState;
  close(): Promise<void>;
}

function readBody(request: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function listen(server: Server): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address() as AddressInfo));
  });
}

export async function createMockController(
  options: {
    username?: string;
    password?: string;
  } = {},
): Promise<MockController> {
  const state: MockControllerState = {
    requests: [],
    standalone: false,
    failuresRemaining: 0,
    failureStatus: 500,
    config: {},
  };
  const expectedAuthorization =
    options.username === undefined
      ? undefined
      : `Basic ${Buffer.from(`${options.username}:${options.password ?? ""}`).toString("base64")}`;

  const server = createServer((request, response) => {
    void readBody(request)
      .then((body) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        state.requests.push({
          method: request.method ?? "GET",
          path: url.pathname,
          query: url.search.slice(1),
          body,
          headers: request.headers,
        });

        if (
          expectedAuthorization !== undefined &&
          request.headers.authorization !== expectedAuthorization
        ) {
          response.writeHead(401, { "content-type": "text/plain" });
          response.end("Unauthorized");
          return;
        }

        if (state.failuresRemaining > 0) {
          state.failuresRemaining -= 1;
          response.writeHead(state.failureStatus, { "content-type": "text/plain" });
          response.end("simulated failure");
          return;
        }

        const json = (payload: unknown): void => {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify(payload));
        };
        const text = (payload: string): void => {
          response.writeHead(200, { "content-type": "text/plain" });
          response.end(payload);
        };

        switch (url.pathname) {
          case "/getReadings":
            json(
              state.standalone
                ? {
                    getReadings: [
                      { "VALUE NAME": '"pH_value"', VALUE: "7.21" },
                      { "VALUE NAME": '"DOS_1_CL"', "VALUE ": "4" },
                    ],
                  }
                : {
                    getReadings: {
                      PUMP: "4",
                      PUMP_RUNTIME: "01h 02m 03s",
                      pH_value: "7.21",
                      orp_value: "735",
                      EXT1_1: "1",
                      EXT2_1: "1",
                      SYSTEM_ext1module_alive_count: 0,
                      SYSTEM_dosagemodule_alive_count: 0,
                    },
                  },
            );
            break;
          case "/getConfig": {
            const keys = url.search.slice(1).split(",");
            json(Object.fromEntries(keys.map((key) => [key, state.config[key] ?? "1"])));
            break;
          }
          case "/setConfig":
            for (const [key, value] of new URLSearchParams(body)) state.config[key] = value;
            text("OK\nCONFIG\nSAVED");
            break;
          case "/setFunctionManually":
            text("OK\nPUMP\nON");
            break;
          case "/triggerManualDosing":
            text("MANDOS_STARTED\nOK");
            break;
          case "/getCalibHistory":
            text("2026-01-01|7.0|pH\nmalformed\n2026-02-01|7.1|pH");
            break;
          case "/getLiveTrace":
            text("pH;ORP\n;pH;mV\n7,21;735");
            break;
          case "/getServiceStates":
            json({ proftpd: 1, samba: 0, sshd: 1, shairport: 0, homekit: 1 });
            break;
          case "/getRS485PumpData":
            json({ SLAVE_PRESENT: 1, POWER: 450 });
            break;
          case "/setRS485Live":
            text(url.search === "?DONE" ? '"DONE"' : '"1|0,0|2,4500"');
            break;
          case "/getHistory":
          case "/getWeatherdata":
          case "/getOverallDosing":
          case "/getOutputstates":
          case "/getOutputruntimes":
          case "/getCalibRawValues":
          case "/getNotifications":
            json({ ok: true });
            break;
          case "/getUpdateState":
            text("STANDBY");
            break;
          case "/getUpdateHistory":
            text("Version 1.2.3");
            break;
          case "/initUpdate":
            text("STARTING");
            break;
          default:
            text("OK");
        }
      })
      .catch((error: unknown) => {
        response.writeHead(500, { "content-type": "text/plain" });
        response.end(error instanceof Error ? error.message : "mock server error");
      });
  });

  const address = await listen(server);
  return {
    host: `127.0.0.1:${address.port}`,
    state,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      }),
  };
}
