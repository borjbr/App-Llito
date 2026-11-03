import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from "astro:env/server";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL ?? vercelUrl,
  trustedOrigins: [BETTER_AUTH_URL, vercelUrl].filter((o): o is string => Boolean(o)),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      apellidos: { type: "string", required: true, defaultValue: "" },
      avatar: { type: "string", required: true, defaultValue: "🙂" },
      edad: { type: "number", required: false },
    },
  },
  session: {
    // 30 días: es una app de uso diario en el móvil
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});

/**
 * Copia las cookies de una respuesta de Better Auth en una redirección 303.
 * Así los formularios funcionan sin JavaScript.
 */
export function redirigirConCookies(origen: Response, destino: string): Response {
  const headers = new Headers({ Location: destino });
  for (const cookie of origen.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
