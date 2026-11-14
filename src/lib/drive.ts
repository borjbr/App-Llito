/**
 * Galería en Google Drive (permiso drive.file: solo lo que sube la app y la
 * carpeta elegida con el selector de Google).
 *
 * Subida: Vercel no acepta peticiones de más de 4,5 MB, así que el navegador
 * manda el archivo en trozos de 4 MB a la app y la app los reenvía a una
 * sesión «resumable» de Drive. La URL de la sesión no sale del servidor.
 *
 * Lectura: miniaturas y fotos grandes salen de `thumbnailLink` (Drive las
 * redimensiona); los vídeos se sirven por rangos de hasta 4 MB, que es como los
 * pide el reproductor del navegador.
 */
import { and, eq, lt } from "drizzle-orm";
import { GOOGLE_API_KEY, GOOGLE_PROJECT_NUMBER } from "astro:env/server";
import { db } from "@/db/client";
import { subida, type ConexionGoogle, type TipoMedio } from "@/db/schema";
import { accessToken, ErrorGoogle, SCOPE_DRIVE } from "./google";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

/** 16 × 256 KiB: Drive exige múltiplos de 256 KiB y Vercel corta en 4,5 MB */
export const TROZO = 4 * 1024 * 1024;
export const LIMITES = { imagenMB: 40, videoMB: 300, videoSegundos: 60 } as const;
export const selectorConfigurado = Boolean(GOOGLE_API_KEY && GOOGLE_PROJECT_NUMBER);
export const datosSelector = () => ({ apiKey: GOOGLE_API_KEY!, appId: GOOGLE_PROJECT_NUMBER! });

export const tienePermisoDrive = (c: ConexionGoogle | undefined | null) => Boolean(c?.scopes?.includes(SCOPE_DRIVE));

async function drive<T>(c: ConexionGoogle, ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(c)}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
  if (!res.ok) throw new ErrorGoogle(json.error?.message ?? `Error ${res.status} de Google Drive`, res.status, json.error?.status);
  return json;
}

/* ── Carpeta ─────────────────────────────────────────────────────────── */

/** Comprueba que la app puede escribir en la carpeta elegida con el selector */
export async function comprobarCarpeta(c: ConexionGoogle, id: string) {
  if (!/^[\w-]{10,200}$/.test(id)) throw new ErrorGoogle("Carpeta no válida", 400);
  const f = await drive<{ id: string; name: string; mimeType: string; trashed: boolean; capabilities?: { canAddChildren?: boolean } }>(
    c,
    `/files/${id}?fields=id,name,mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true`,
  );
  if (f.mimeType !== "application/vnd.google-apps.folder" || f.trashed) throw new ErrorGoogle("Eso no es una carpeta", 400);
  if (f.capabilities?.canAddChildren === false) throw new ErrorGoogle("No tienes permiso para añadir archivos a esa carpeta", 403);
  return { id: f.id, nombre: f.name };
}

/* ── Subida ──────────────────────────────────────────────────────────── */

export type DatosSubida = {
  tipo: TipoMedio;
  mime: string;
  nombre: string;
  tamano: number;
  duracionS: number | null;
  fecha: string;
  hijoId: string | null;
  descripcion: string | null;
};

/** Abre una sesión resumable en Drive y la guarda. Devuelve el id de la subida. */
export async function iniciarSubida(c: ConexionGoogle, hogarId: string, userId: string, d: DatosSubida) {
  // Limpieza perezosa de subidas abandonadas (las sesiones de Drive caducan a la semana)
  await db.delete(subida).where(lt(subida.createdAt, new Date(Date.now() - 86_400_000)));

  const res = await fetch(`${UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken(c)}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": d.mime,
      "X-Upload-Content-Length": String(d.tamano),
    },
    body: JSON.stringify({
      name: d.nombre,
      mimeType: d.mime,
      parents: [c.carpetaDriveId],
      description: d.descripcion ?? undefined,
      appProperties: { app: "app-llito" },
    }),
  });
  const uri = res.headers.get("location");
  if (!res.ok || !uri) {
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new ErrorGoogle(j.error?.message ?? "Drive no ha aceptado la subida", res.status, j.error?.status);
  }
  const ahora = new Date();
  const [fila] = await db
    .insert(subida)
    .values({ ...d, hogarId, userId, uri, createdAt: ahora, updatedAt: ahora })
    .returning({ id: subida.id });
  return fila.id;
}

export function subidaDe(hogarId: string, id: string) {
  return db.select().from(subida).where(and(eq(subida.id, id), eq(subida.hogarId, hogarId))).get();
}

/**
 * Reenvía un trozo a Drive. Devuelve `{ hecho: false }` mientras falten
 * trozos y `{ hecho: true, driveId }` con el último.
 */
export async function enviarTrozo(uri: string, desde: number, total: number, cuerpo: ArrayBuffer) {
  const hasta = desde + cuerpo.byteLength - 1;
  const res = await fetch(uri, {
    method: "PUT",
    headers: { "Content-Length": String(cuerpo.byteLength), "Content-Range": `bytes ${desde}-${hasta}/${total}` },
    body: cuerpo,
  });
  if (res.status === 308) {
    // Drive confirma lo recibido con «Range: bytes=0-N»
    const rango = res.headers.get("range");
    const recibido = rango ? Number(rango.split("-")[1]) + 1 : 0;
    return { hecho: false as const, recibido };
  }
  if (res.ok) {
    const j = (await res.json()) as { id: string };
    return { hecho: true as const, driveId: j.id };
  }
  const texto = await res.text().catch(() => "");
  throw new ErrorGoogle(`Drive rechazó el trozo (${res.status}) ${texto.slice(0, 200)}`, res.status);
}

/* ── Lectura ─────────────────────────────────────────────────────────── */

/** Miniatura redimensionada por Drive (lado mayor = `lado` px). Null si aún no existe (vídeos recién subidos). */
export async function miniatura(c: ConexionGoogle, driveId: string, lado: number): Promise<Response | null> {
  const f = await drive<{ thumbnailLink?: string }>(c, `/files/${driveId}?fields=thumbnailLink&supportsAllDrives=true`);
  if (!f.thumbnailLink) return null;
  const url = f.thumbnailLink.replace(/=s\d+(-[a-z]+)?$/, "") + `=s${lado}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(c)}` } });
  return res.ok ? res : null;
}

/** Un rango del archivo original (para el reproductor de vídeo). Máximo un trozo por respuesta. */
export async function rango(c: ConexionGoogle, driveId: string, desde: number, hasta: number) {
  return fetch(`${API}/files/${driveId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${await accessToken(c)}`, Range: `bytes=${desde}-${hasta}` },
  });
}

/** Lo manda a la papelera de Drive (se puede recuperar 30 días) */
export async function aLaPapelera(c: ConexionGoogle, driveId: string) {
  await drive(c, `/files/${driveId}?supportsAllDrives=true`, { method: "PATCH", body: JSON.stringify({ trashed: true }) });
}

export async function actualizarDescripcion(c: ConexionGoogle, driveId: string, descripcion: string | null) {
  await drive(c, `/files/${driveId}?supportsAllDrives=true`, { method: "PATCH", body: JSON.stringify({ description: descripcion ?? "" }) });
}

export async function tokenParaSelector(c: ConexionGoogle) {
  return accessToken(c);
}
