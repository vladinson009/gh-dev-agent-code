import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const localEnv = resolve(process.cwd(), ".env");
const workspaceEnv = resolve(process.cwd(), "../../.env");
const envFile = [localEnv, workspaceEnv].find(existsSync);

if (envFile) config({ path: envFile });
