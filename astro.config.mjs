// @ts-check
import { defineConfig, envField } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  site: process.env.BETTER_AUTH_URL,
  security: {
    checkOrigin: true,
    // Dominios en los que Astro se fía de la cabecera Host. Sin esto, en Vercel
    // Astro cree que la app está en "localhost": el control de origen rechaza
    // los formularios y Astro.url apunta a un dominio falso.
    allowedDomains: [
      { protocol: "https", hostname: "*.vercel.app" }, // producción y previews
      { hostname: "localhost" }, // astro preview en local
    ],
  },
  env: {
    schema: {
      TURSO_DATABASE_URL: envField.string({ context: "server", access: "secret", default: "file:local.db" }),
      TURSO_AUTH_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      BETTER_AUTH_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      BETTER_AUTH_URL: envField.string({ context: "server", access: "secret", optional: true }),
      GOOGLE_CLIENT_ID: envField.string({ context: "server", access: "secret", optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      // Asistente (OpenAI). Sin clave, el chat se muestra como «no configurado».
      OPENAI_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENAI_MODEL: envField.string({ context: "server", access: "secret", default: "gpt-5.4-mini" }),
      ASISTENTE_LIMITE_DIARIO: envField.number({ context: "server", access: "secret", default: 100, int: true, gt: 0 }),
    },
  },
  vite: {
    // @ts-expect-error: tipos de Vite duplicados entre Astro y el plugin de Tailwind
    plugins: [tailwindcss()],
  },
});
