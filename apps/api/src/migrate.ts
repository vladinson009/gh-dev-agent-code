import "./lib/env.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./lib/database.js";

const migrationUrl = new URL(
  "../../../prisma/migrations/0001_init/migration.sql",
  import.meta.url,
);

try {
  const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
  await pool.query(migration);
  console.info("Database schema is up to date.");
} finally {
  await pool.end();
}
