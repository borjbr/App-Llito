/**
 * Utilidades de las rutas de la galería: comprobaciones comunes y formatos.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { medio, type ConexionGoogle } from "@/db/schema";
import { conexionDe } from "./google";
import { tienePermisoDrive } from "./drive";

export const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Rechaza peticiones que cambian datos si no vienen de la propia app */
export function mismoOrigen(request: Request, url: URL) {
  const origen = request.headers.get("origin");
  return !origen || origen === url.origin;
}

type Contexto = { hogarId: string; userId: string; conexion: ConexionGoogle };

/** Sesión, hogar y conexión con permiso de Drive y carpeta elegida */
export async function contextoGaleria(locals: App.Locals, { carpeta = true } = {}): Promise<Contexto | Response> {
  if (!locals.user || !locals.hogar) return json({ error: "Inicia sesión." }, 401);
  const conexion = await conexionDe(locals.hogar.id);
  if (!conexion || !tienePermisoDrive(conexion)) return json({ error: "Conecta Google Drive desde la galería." }, 409);
  if (carpeta && !conexion.carpetaDriveId) return json({ error: "Elige primero la carpeta de Drive." }, 409);
  return { hogarId: locals.hogar.id, userId: locals.user.id, conexion };
}

export function medioDelHogar(hogarId: string, id: string) {
  return db.select().from(medio).where(and(eq(medio.id, id), eq(medio.hogarId, hogarId))).get();
}

const mb = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
export const formatoTamano = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${mb.format(bytes / 1024 / 1024)} MB`);
export const formatoDuracion = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
