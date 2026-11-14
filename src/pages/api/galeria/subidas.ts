import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { hijo } from "@/db/schema";
import { contextoGaleria, json, mismoOrigen } from "@/lib/galeria";
import { iniciarSubida, LIMITES, TROZO } from "@/lib/drive";
import { esFechaValida, fechaMadrid } from "@/lib/fechas";

/** Empieza la subida de una foto o vídeo. El archivo llega después, en trozos, a /api/galeria/subidas/[id]. */
export const POST: APIRoute = async ({ request, url, locals }) => {
  if (!mismoOrigen(request, url)) return json({ error: "Origen no permitido." }, 403);
  const ctx = await contextoGaleria(locals);
  if (ctx instanceof Response) return ctx;

  const d = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mime = String(d.mime ?? "").toLowerCase();
  const tipo = mime.startsWith("image/") ? "imagen" : mime.startsWith("video/") ? "video" : null;
  const tamano = Number(d.tamano);
  const duracion = d.duracion == null ? null : Math.round(Number(d.duracion));
  const nombre = String(d.nombre ?? "").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || `foto-${Date.now()}`;
  const fecha = esFechaValida(String(d.fecha ?? "")) ? String(d.fecha) : fechaMadrid();
  const descripcion = String(d.descripcion ?? "").trim().slice(0, 300) || null;

  if (!tipo || !/^[\w.+-]+\/[\w.+-]+$/.test(mime)) return json({ error: "Solo se pueden subir fotos y vídeos." }, 400);
  if (!Number.isFinite(tamano) || tamano <= 0) return json({ error: "Archivo vacío." }, 400);
  const maxMB = tipo === "imagen" ? LIMITES.imagenMB : LIMITES.videoMB;
  if (tamano > maxMB * 1024 * 1024) return json({ error: `Demasiado grande: el máximo es ${maxMB} MB.` }, 413);
  if (tipo === "video" && (duracion == null || !Number.isFinite(duracion) || duracion > LIMITES.videoSegundos + 0.5)) {
    return json({ error: `Los vídeos tienen que durar ${LIMITES.videoSegundos} segundos o menos.` }, 400);
  }

  let hijoId: string | null = null;
  if (d.hijoId) {
    const h = await db.select({ id: hijo.id }).from(hijo).where(and(eq(hijo.id, String(d.hijoId)), eq(hijo.hogarId, ctx.hogarId))).get();
    hijoId = h?.id ?? null;
  }

  try {
    const id = await iniciarSubida(ctx.conexion, ctx.hogarId, ctx.userId, {
      tipo,
      mime,
      nombre,
      tamano,
      duracionS: tipo === "video" ? duracion : null,
      fecha,
      hijoId,
      descripcion,
    });
    return json({ id, trozo: TROZO });
  } catch (e) {
    console.error("[galería] iniciar subida", e);
    return json({ error: "Google Drive no ha aceptado la subida. Inténtalo de nuevo." }, 502);
  }
};
