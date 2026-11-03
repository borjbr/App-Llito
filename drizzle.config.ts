import { defineConfig } from "drizzle-kit";

// Carga .env si existe (Node 20.12+). En Vercel/CI las variables ya vienen del entorno.
try {
  process.loadEnvFile?.(".env");
} catch {
  /* sin .env: se usan las variables del entorno o la BD local */
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
