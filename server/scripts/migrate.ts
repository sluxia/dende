import { runMigrations } from "../src/migrate";

const direction = (process.argv[2] ?? "up") as "up" | "down";

async function main() {
  await runMigrations({ direction });
  console.log(`Migrations ${direction === "up" ? "applied" : "rolled back"}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
