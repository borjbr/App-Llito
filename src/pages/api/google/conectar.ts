import type { APIRoute } from "astro";
import { googleConfigurado, urlAutorizacion } from "@/lib/google";

/** Inicia la conexión con Google: redirige a la pantalla de permisos de Google. */
export const GET: APIRoute = ({ url, cookies, redirect, locals }) => {
  if (!locals.user) return redirect("/login");
  if (!googleConfigurado) return redirect("/agenda/google?error=sin-configurar");

  const state = crypto.randomUUID();
  cookies.set("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/api/google",
    maxAge: 600,
  });
  // A dónde volver al terminar (solo valores conocidos)
  if (url.searchParams.get("volver") === "galeria") {
    cookies.set("g_volver", "galeria", { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/", maxAge: 600 });
  }
  return redirect(urlAutorizacion(`${url.origin}/api/google/callback`, state));
};
