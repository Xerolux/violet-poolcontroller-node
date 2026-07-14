import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const argument = process.argv.indexOf("--upstream-dir");
if (argument === -1 || process.argv[argument + 1] === undefined) {
  throw new Error("Usage: npm run parity:check -- --upstream-dir <clean upstream checkout>");
}

const upstreamDirectory = resolve(process.argv[argument + 1]);
const manifest = JSON.parse(await readFile(resolve("parity/upstream.json"), "utf8"));
const extractor = resolve("scripts/extract-upstream-contract.py");
let extraction;
const extractionErrors = [];
for (const command of ["python3", "python"]) {
  const result = spawnSync(command, ["-X", "utf8", extractor, upstreamDirectory], {
    encoding: "utf8",
  });
  if (result.status === 0) {
    extraction = result.stdout;
    break;
  }
  extractionErrors.push(`${command}: ${result.error?.message ?? result.stderr.trim()}`);
}
if (extraction === undefined) {
  throw new Error(`Could not run the Python contract extractor\n${extractionErrors.join("\n")}`);
}

const upstream = JSON.parse(extraction);
const built = await import(pathToFileURL(resolve("dist/index.js")).href);
const failures = [];
const sameKeys = (left, right) => isDeepStrictEqual(Object.keys(left).sort(), [...right].sort());

if (upstream.commit !== manifest.commit) {
  failures.push(
    `Upstream main changed from ${manifest.commit} to ${upstream.commit}; port and update the manifest`,
  );
}
if (upstream.version !== manifest.version) {
  failures.push(`Upstream version changed from ${manifest.version} to ${upstream.version}`);
}
if (!sameKeys(manifest.clientMembers, upstream.clientMembers)) {
  failures.push("The public VioletPoolAPI member list changed");
}
if (!sameKeys(manifest.publicExports, upstream.publicExports)) {
  failures.push("The upstream __all__ export list changed");
}

for (const [pythonName, targetName] of Object.entries(manifest.clientMembers)) {
  if (pythonName === "__init__") continue;
  const available =
    Object.hasOwn(VioletPoolClientPrototype(), targetName) ||
    targetName in VioletPoolClientPrototype() ||
    Object.hasOwn(built.VioletPoolClient, targetName);
  if (!available) failures.push(`Missing VioletPoolClient member ${targetName} for ${pythonName}`);
}

for (const [pythonName, targetName] of Object.entries(manifest.publicExports)) {
  if (!(targetName in built))
    failures.push(`Missing package export ${targetName} for ${pythonName}`);
}

if (!sameKeys(manifest.endpointKeys, Object.keys(upstream.endpoints))) {
  failures.push("The upstream endpoint constant list changed");
}
for (const [pythonName, targetKey] of Object.entries(manifest.endpointKeys)) {
  if (built.API_ENDPOINTS[targetKey] !== upstream.endpoints[pythonName]) {
    failures.push(`Endpoint mismatch for ${pythonName}`);
  }
}
for (const [pythonName, value] of Object.entries(upstream.actions)) {
  if (built[pythonName] !== value) failures.push(`Action mismatch for ${pythonName}`);
}
if (!isDeepStrictEqual(built.ERROR_CODES, upstream.errorCodes)) {
  const keys = new Set([...Object.keys(built.ERROR_CODES), ...Object.keys(upstream.errorCodes)]);
  const mismatches = [...keys].filter(
    (key) => !isDeepStrictEqual(built.ERROR_CODES[key], upstream.errorCodes[key]),
  );
  failures.push(
    `The controller error-code catalog differs from upstream at: ${mismatches.join(", ")}; examples: ${mismatches
      .slice(0, 3)
      .map(
        (key) =>
          `${key}=${JSON.stringify(built.ERROR_CODES[key])}/${JSON.stringify(upstream.errorCodes[key])}`,
      )
      .join(" | ")}`,
  );
}

if (failures.length > 0) {
  throw new Error(`Upstream parity failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Parity OK: ${manifest.repository}@${upstream.commit.slice(0, 12)} (${upstream.clientMembers.length} client members, ${upstream.publicExports.length} exports)`,
);

function VioletPoolClientPrototype() {
  return built.VioletPoolClient.prototype;
}
