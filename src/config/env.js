import path from "node:path";
import { config } from "dotenv";

const nodeEnv = process.env.NODE_ENV || "development";
const envFile = path.resolve(process.cwd(), `.env.${nodeEnv}`);

// Precedence: real environment variables > `.env.<NODE_ENV>.local` >
// `.env.<NODE_ENV>` > `.env`.
config({ path: envFile, quiet: true });
config({ path: `${envFile}.local`, override: true, quiet: true });
config({ quiet: true });
