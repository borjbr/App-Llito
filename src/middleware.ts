import { defineMiddleware } from "astro:middleware";
import { auth } from "@/lib/auth";

const PUBLICAS = ["/login", "/registro"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Better Auth y los archivos estáticos no pasan por aquí
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/_")) return next();

  const sesion = await auth.api.getSession({ headers: context.request.headers });
  context.locals.user = sesion?.user ?? null;
  context.locals.session = sesion?.session ?? null;

  const esPublica = PUBLICAS.includes(pathname);

  if (!sesion && !esPublica) {
    const destino = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
    return context.redirect(destino);
  }
  if (sesion && esPublica) return context.redirect("/");

  return next();
});
