import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { medio, subida } from "@/db/schema";
import { contextoGaleria, json, mismoOrigen } from "@/lib/galeria";
import { enviarTrozo, subidaDe, TROZO } from "@/lib/drive";

/**
 * Recibe un trozo (cuerpo binario, cabecera X-Desde con la posición) y lo reenvía a Drive.
 * Con el último trozo, guarda la foto o el vídeo en la galería.
 */
export const PUT: APIRoute = async ({ request, url, params, locals }) => {
  if (!mismoOrigen(request, url)) return json({ error: "Origen no permitido." }, 403);
  const ctx = await contextoGaleria(locals);
  if (ctx instanceof Response) return ctx;
  const s = await subidaDe(ctx.hogarId, params.id!);
  if (!s) return json({ error: "Subida no encontrada. Vuelve a intentarlo." }, 404);

  const desde = Number(request.headers.get("x-desde"));
  const cuerpo = await request.arrayBuffer();
  if (!Number.isInteger(desde) || desde < 0 || desde >= s.tamano) return json({ error: "Posición no válida." }, 400);
  if (cuerpo.byteLength === 0 || cuerpo.byteLength > TROZO || desde + cuerpo.byteLength > s.tamano) return json({ error: "Trozo no válido." }, 400);
  // Todos los trozos menos el último deben medir exactamente TROZO (Drive pide múltiplos de 256 KiB)
  if (desde + cuerpo.byteLength < s.tamano && cuerpo.byteLength !== TROZO) return json({ error: "Tamaño de trozo no válido." }, 400);

  try {
    const r = await enviarTrozo(s.uri, desde, s.tamano, cuerpo);
    if (!r.hecho) return json({ hecho: false, recibido: r.recibido });

    const ahora = new Date();
    const [m] = await db
      .insert(medio)
      .values({
        hogarId: s.hogarId,
        hijoId: s.hijoId,
        driveId: r.driveId,
        tipo: s.tipo,
        mime: s.mime,
        nombre: s.nombre,
        tamano: s.tamano,
        duracionS: s.duracionS,
        fecha: s.fecha,
        descripcion: s.descripcion,
        subidoPor: s.userId,
        createdAt: ahora,
        updatedAt: ahora,
      })
      .returning({ id: medio.id });
    await db.delete(subida).where(eq(subida.id, s.id));
    return json({ hecho: true, id: m.id });
  } catch (e) {
    console.error("[galería] trozo", e);
    return json({ error: "Se ha cortado la subida. Inténtalo de nuevo." }, 502);
  }
};
