import { config } from "./config";
import { pool } from "./db";
import { runMigrations } from "./migrate";
import { buildApp } from "./app";

async function main() {
  await runMigrations();
  const app = buildApp();

  const shutdown = async () => {
    app.log.info("Shutting down...");
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error("Fatal server error:", error);
  process.exit(1);
});
