import type { APIRoute } from "astro";
import { db } from "@/db/client";
import { conexionGoogle } from "@/db/schema";
import { miembrosDe } from "@/lib/familia";
import { buscarEmails } from "@/lib/emails";
import {
  canjearCodigo,
  cifrar,
  crearCalendarioFamiliar,
  emailDeIdToken,
  ErrorGoogle,
  sincronizarDesdeGoogle,
  SCOPES,
} from "@/lib/google";

/** Vuelta de Google tras aceptar los permisos. */
export const GET: APIRoute = async ({ url, cookies, redirect, locals }) => {
  const user = locals.user;
  const hogar = locals.hogar;
  if (!user || !hogar) return redirect("/login");

  const esperado = cookies.get("g_oauth_state")?.value;
  cookies.delete("g_oauth_state", { path: "/api/google" });

  if (url.searchParams.get("error")) return redirect("/agenda/google?error=cancelado");
  const code = url.searchParams.get("code");
  if (!code || !esperado || url.searchParams.get("state") !== esperado) return redirect("/agenda/google?error=estado");

  try {
    const tokens = await canjearCodigo(code, `${url.origin}/api/google/callback`);
    if (!tokens.refresh_token) return redirect("/agenda/google?error=sin-permiso-offline");
    if (tokens.scope && !tokens.scope.includes(SCOPES[2])) return redirect("/agenda/google?error=sin-calendario");

    const cuentaEmail = emailDeIdToken(tokens.id_token) || user.email;
    const miembros = await miembrosDe(hogar.id);
    const otros = (await buscarEmails(miembros.map((m) => m.id))).filter(
      (e) => e.toLowerCase() !== cuentaEmail.toLowerCase(),
    );

    const calendario = await crearCalendarioFamiliar(tokens.access_token, hogar.nombre, otros);

    const fila = {
      hogarId: hogar.id,
      userId: user.id,
      cuentaEmail,
      refreshToken: await cifrar(tokens.refresh_token),
      calendarId: calendario.id,
      calendarNombre: calendario.summary,
      syncToken: null,
      ultimaSync: null,
      ultimoError: null,
      updatedAt: new Date(),
    };
    await db.insert(conexionGoogle).values(fila).onConflictDoUpdate({ target: conexionGoogle.hogarId, set: fila });

    // Sube lo que ya había en la agenda y trae lo que haya en Google
    await sincronizarDesdeGoogle(hogar.id, { forzar: true });
    return redirect("/agenda/google?ok=conectado");
  } catch (err) {
    console.error("Error conectando Google Calendar", err);
    const motivo = err instanceof ErrorGoogle && err.status === 403 ? "api-desactivada" : "fallo";
    return redirect(`/agenda/google?error=${motivo}`);
  }
};
