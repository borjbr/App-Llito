import { defineMiddleware } from "astro:middleware";
import { auth } from "@/lib/auth";
import { asegurarHogar } from "@/lib/familia";

const PUBLICAS = ["/login", "/registro"];
const ARCHIVOS_APP = ["/manifest.webmanifest", "/sw.js", "/offline.html", "/favicon.svg"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Better Auth y los archivos estáticos no pasan por aquí
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/_")) return next();
  // Archivos públicos de la app instalable (manifest, iconos, service worker, página sin conexión)
  if (ARCHIVOS_APP.includes(pathname) || /^\/iconos\/[\w-]+\.png$/.test(pathname)) return next();

  const sesion = await auth.api.getSession({ headers: context.request.headers });
  context.locals.user = sesion?.user ?? null;
  context.locals.session = sesion?.session ?? null;
  context.locals.hogar = null;

  const esPublica = PUBLICAS.includes(pathname);

  if (!sesion && !esPublica) {
    const destino = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
    return context.redirect(destino);
  }
  if (sesion && esPublica) return context.redirect("/");

  if (context.locals.user) context.locals.hogar = await asegurarHogar(context.locals.user);

  return next();
});
