import runner from "node-pg-migrate";
import path from "path";
import { config } from "./config";

export interface MigrationOptions {
  /** "up" migrates all pending; "down" rolls back a single migration. */
  direction?: "up" | "down";
}

/**
 * Applies node-pg-migrate SQL/TS migrations from server/migrations against the
 * configured DATABASE_URL. Used at server startup and by scripts/migrate.ts.
 */
export async function runMigrations(options: MigrationOptions = {}): Promise<void> {
  const direction = options.direction ?? "up";
  await runner({
    databaseUrl: config.databaseUrl,
    dir: path.resolve(__dirname, "..", "migrations"),
    direction,
    migrationsTable: "pgmigrations",
    count: direction === "up" ? Infinity : 1,
    log: () => {}
  });
}
