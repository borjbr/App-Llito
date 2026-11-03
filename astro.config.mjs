// @ts-check
import { defineConfig, envField } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  site: process.env.BETTER_AUTH_URL,
  security: { checkOrigin: true },
  env: {
    schema: {
      TURSO_DATABASE_URL: envField.string({ context: "server", access: "secret", default: "file:local.db" }),
      TURSO_AUTH_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      BETTER_AUTH_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      BETTER_AUTH_URL: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
  vite: {
    // @ts-expect-error: tipos de Vite duplicados entre Astro y el plugin de Tailwind
    plugins: [tailwindcss()],
  },
});
