import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conexionGoogle } from "@/db/schema";
import { contextoGaleria, json, mismoOrigen } from "@/lib/galeria";
import { comprobarCarpeta } from "@/lib/drive";
import { ErrorGoogle } from "@/lib/google";

/** Guarda la carpeta elegida con el selector de Google (tras comprobar que la app puede escribir en ella). */
export const POST: APIRoute = async ({ request, url, locals }) => {
  if (!mismoOrigen(request, url)) return json({ error: "Origen no permitido." }, 403);
  const ctx = await contextoGaleria(locals, { carpeta: false });
  if (ctx instanceof Response) return ctx;
  if (ctx.conexion.userId !== ctx.userId) return json({ error: "Solo quien conectó Google puede elegir la carpeta." }, 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  try {
    const carpeta = await comprobarCarpeta(ctx.conexion, String(id ?? ""));
    await db
      .update(conexionGoogle)
      .set({ carpetaDriveId: carpeta.id, carpetaDriveNombre: carpeta.nombre, updatedAt: new Date() })
      .where(eq(conexionGoogle.hogarId, ctx.hogarId));
    return json({ ok: true, nombre: carpeta.nombre });
  } catch (e) {
    const status = e instanceof ErrorGoogle ? e.status : 500;
    return json({ error: e instanceof ErrorGoogle && status < 500 ? e.message : "No se ha podido usar esa carpeta." }, status === 404 ? 404 : status >= 500 ? 502 : status);
  }
};
