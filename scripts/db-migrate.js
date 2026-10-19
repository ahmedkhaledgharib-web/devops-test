import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import "../src/config/env.js";

const require = createRequire(import.meta.url);
const drizzleKitBin = path.join(path.dirname(require.resolve("drizzle-kit")), "bin.cjs");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("[migrate] DATABASE_URL is not set");
    process.exit(1);
}

const { hostname, port } = new URL(databaseUrl);
const targetPort = Number(port || 5432);
const waitTimeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 120_000);
const attempts = Number(process.env.DB_MIGRATE_ATTEMPTS ?? 10);
const retryDelayMs = Number(process.env.DB_MIGRATE_RETRY_DELAY_MS ?? 5_000);

function canConnect() {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host: hostname, port: targetPort });
        const finish = (result) => {
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(3_000);
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));
    });
}

async function waitForDatabase() {
    const deadline = Date.now() + waitTimeoutMs;

    while (Date.now() < deadline) {
        if (await canConnect()) {
            console.log(`[migrate] ${hostname}:${targetPort} is reachable`);
            return;
        }

        console.log(`[migrate] waiting for ${hostname}:${targetPort}...`);
        await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    throw new Error(`Timed out after ${waitTimeoutMs}ms waiting for ${hostname}:${targetPort}`);
}

function runMigration() {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [drizzleKitBin, "migrate"], { stdio: "inherit" });
        child.once("close", (code) => resolve(code ?? 1));
        child.once("error", (error) => {
            console.error("[migrate]", error);
            resolve(1);
        });
    });
}

await waitForDatabase();

for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`[migrate] applying migrations (attempt ${attempt}/${attempts})`);

    if ((await runMigration()) === 0) {
        console.log("[migrate] migrations applied");
        process.exit(0);
    }

    if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
}

console.error(`[migrate] failed after ${attempts} attempts`);
process.exit(1);
