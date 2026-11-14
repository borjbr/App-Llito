/**
 * Conexión con Google Calendar (sin librerías: OAuth 2.0 y API REST con fetch).
 *
 * - Un hogar se conecta una vez con la cuenta de Google de uno de sus miembros.
 * - La app crea un calendario propio para la familia y lo comparte con el resto.
 * - Los cambios en la app se suben al momento; los cambios en Google se traen
 *   con sincronización incremental (syncToken) al abrir la agenda.
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "astro:env/server";
import { db } from "@/db/client";
import { conexionGoogle, evento, type ConexionGoogle, type Evento, type Repeticion, type TipoEvento } from "@/db/schema";
import { fechaMadrid, horaMadrid, madridAUtc, sumarDias, ZONA } from "./fechas";
import { leerRecordatorios, TIPOS } from "./eventos";

const API = "https://www.googleapis.com/calendar/v3";
export const SCOPE_CALENDAR = "https://www.googleapis.com/auth/calendar";
/** Solo los archivos que crea la app (o la carpeta que se elige con el selector de Google) */
export const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive.file";
export const SCOPES = ["openid", "email", SCOPE_CALENDAR, SCOPE_DRIVE];

export const googleConfigurado = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

/* ── Cifrado del refresh token (AES-GCM con una clave derivada del secreto) ── */

async function clave(): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`google-token:${BETTER_AUTH_SECRET ?? "desarrollo-local"}`);
  const hash = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64url");
const desdeB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

export async function cifrar(texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await clave(), new TextEncoder().encode(texto));
  return `${b64(iv)}.${b64(new Uint8Array(datos))}`;
}

export async function descifrar(sobre: string): Promise<string> {
  const [iv, datos] = sobre.split(".");
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: desdeB64(iv) }, await clave(), desdeB64(datos));
  return new TextDecoder().decode(plano);
}

/* ── OAuth ───────────────────────────────────────────────────────────── */

export function urlAutorizacion(redirectUri: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url.toString();
}

type RespuestaToken = { access_token: string; expires_in: number; refresh_token?: string; id_token?: string; scope?: string };

async function pedirToken(params: Record<string, string>): Promise<RespuestaToken> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID!, client_secret: GOOGLE_CLIENT_SECRET!, ...params }),
  });
  const json = (await res.json()) as RespuestaToken & { error?: string; error_description?: string };
  if (!res.ok) throw new ErrorGoogle(json.error_description ?? json.error ?? "No se pudo obtener el token", res.status, json.error);
  return json;
}

export function canjearCodigo(code: string, redirectUri: string) {
  return pedirToken({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

/** Email de la cuenta, leído del id_token que Google nos acaba de dar por TLS */
export function emailDeIdToken(idToken?: string): string {
  if (!idToken) return "";
  try {
    const carga = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return carga.email ?? "";
  } catch {
    return "";
  }
}

// Caché del access token por hogar mientras la función siga viva
const cache = new Map<string, { token: string; caduca: number }>();

export async function accessToken(c: ConexionGoogle): Promise<string> {
  const guardado = cache.get(c.hogarId);
  if (guardado && guardado.caduca > Date.now() + 60_000) return guardado.token;
  const t = await pedirToken({ refresh_token: await descifrar(c.refreshToken), grant_type: "refresh_token" });
  cache.set(c.hogarId, { token: t.access_token, caduca: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

export class ErrorGoogle extends Error {
  status: number;
  codigo?: string;
  constructor(message: string, status: number, codigo?: string) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}

async function api<T>(c: ConexionGoogle | string, ruta: string, init: RequestInit = {}): Promise<T> {
  const token = typeof c === "string" ? c : await accessToken(c);
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
  if (!res.ok) throw new ErrorGoogle(json.error?.message ?? `Error ${res.status} de Google`, res.status, json.error?.status);
  return json;
}

/* ── Conexión del hogar ──────────────────────────────────────────────── */

export function conexionDe(hogarId: string) {
  return db.select().from(conexionGoogle).where(eq(conexionGoogle.hogarId, hogarId)).get();
}

/** Crea el calendario de la familia y lo comparte con los correos indicados. */
export async function crearCalendarioFamiliar(accessTokenNuevo: string, nombre: string, compartirCon: string[]) {
  const cal = await api<{ id: string; summary: string }>(accessTokenNuevo, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: nombre, timeZone: ZONA, description: "Calendario de la familia, gestionado desde App-Llito." }),
  });
  const compartidos: string[] = [];
  for (const email of compartirCon) {
    try {
      await compartirCalendario(accessTokenNuevo, cal.id, email);
      compartidos.push(email);
    } catch {
      /* el correo no es de Google o no se pudo invitar: se puede repetir desde la app */
    }
  }
  return { ...cal, compartidos };
}

export async function compartirCalendario(c: ConexionGoogle | string, calendarId: string, email: string) {
  await api(c, `/calendars/${encodeURIComponent(calendarId)}/acl?sendNotifications=true`, {
    method: "POST",
    body: JSON.stringify({ role: "writer", scope: { type: "user", value: email } }),
  });
}

export async function personasConAcceso(c: ConexionGoogle): Promise<string[]> {
  const acl = await api<{ items?: { role: string; scope: { type: string; value?: string } }[] }>(
    c,
    `/calendars/${encodeURIComponent(c.calendarId)}/acl`,
  );
  return (acl.items ?? [])
    .filter((r) => r.scope.type === "user" && r.scope.value && r.role !== "none")
    .map((r) => r.scope.value!.toLowerCase());
}

/* ── De la app a Google ──────────────────────────────────────────────── */

const RRULE: Record<Repeticion, string[] | undefined> = {
  ninguna: undefined,
  semanal: ["RRULE:FREQ=WEEKLY"],
  mensual: ["RRULE:FREQ=MONTHLY"],
  anual: ["RRULE:FREQ=YEARLY"],
};

type EventoGoogle = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
  extendedProperties?: { private?: Record<string, string> };
};

export function aEventoGoogle(e: Evento): EventoGoogle {
  const t = TIPOS[e.tipo];
  const fecha = e.fecha!;
  let start: EventoGoogle["start"];
  let end: EventoGoogle["end"];
  if (e.todoElDia || !e.horaInicio) {
    start = { date: fecha };
    end = { date: sumarDias(fecha, 1) };
  } else {
    const inicio = madridAUtc(fecha, e.horaInicio);
    const fin = e.horaFin && e.horaFin > e.horaInicio ? madridAUtc(fecha, e.horaFin) : new Date(inicio.getTime() + 3_600_000);
    start = { dateTime: inicio.toISOString(), timeZone: ZONA };
    end = { dateTime: fin.toISOString(), timeZone: ZONA };
  }
  const avisos = leerRecordatorios(e).slice(0, 5);
  return {
    summary: `${t.emoji} ${e.titulo}${e.tipo === "tarea" && e.completado ? " (hecha)" : ""}`,
    description: e.notas ?? undefined,
    location: e.ubicacion ?? undefined,
    start,
    end,
    recurrence: RRULE[e.repeticion],
    reminders: { useDefault: false, overrides: avisos.map((minutes) => ({ method: "popup", minutes })) },
    extendedProperties: { private: { llitoId: e.id, llitoTipo: e.tipo } },
  };
}

/** Sube o actualiza un evento en Google. Nunca lanza: si falla, queda pendiente. */
export async function subirEvento(hogarId: string, e: Evento): Promise<void> {
  const c = await conexionDe(hogarId);
  if (!c || !e.fecha) return;
  try {
    const cuerpo = JSON.stringify(aEventoGoogle(e));
    const base = `/calendars/${encodeURIComponent(c.calendarId)}/events`;
    let googleId = e.googleId;
    if (googleId) {
      try {
        await api(c, `${base}/${encodeURIComponent(googleId)}`, { method: "PUT", body: cuerpo });
      } catch (err) {
        if (err instanceof ErrorGoogle && (err.status === 404 || err.status === 410)) googleId = null;
        else throw err;
      }
    }
    if (!googleId) {
      const creado = await api<{ id: string }>(c, base, { method: "POST", body: cuerpo });
      googleId = creado.id;
    }
    await db.update(evento).set({ googleId, sincronizado: true }).where(eq(evento.id, e.id));
  } catch (err) {
    await db.update(evento).set({ sincronizado: false }).where(eq(evento.id, e.id));
    await anotarError(hogarId, err);
  }
}

/** Borra un evento en Google (si estaba sincronizado). */
export async function borrarEnGoogle(hogarId: string, googleId: string | null): Promise<void> {
  if (!googleId) return;
  const c = await conexionDe(hogarId);
  if (!c) return;
  try {
    await api(c, `/calendars/${encodeURIComponent(c.calendarId)}/events/${encodeURIComponent(googleId)}`, { method: "DELETE" });
  } catch (err) {
    if (!(err instanceof ErrorGoogle && (err.status === 404 || err.status === 410))) await anotarError(hogarId, err);
  }
}

async function anotarError(hogarId: string, err: unknown) {
  const mensaje =
    err instanceof ErrorGoogle && err.codigo === "invalid_grant"
      ? "Google ha retirado el permiso. Vuelve a conectar el calendario."
      : err instanceof Error
        ? err.message
        : "Error desconocido con Google";
  await db.update(conexionGoogle).set({ ultimoError: mensaje.slice(0, 300), updatedAt: new Date() }).where(eq(conexionGoogle.hogarId, hogarId));
}

/* ── De Google a la app ──────────────────────────────────────────────── */

function adivinarTipo(titulo: string): TipoEvento {
  if (/cumple/i.test(titulo)) return "cumpleanos";
  if (/vacuna/i.test(titulo)) return "vacuna";
  if (/pediatr|m[eé]dic|doctor|revisi[oó]n|enfermer|dentista|cita/i.test(titulo)) return "cita_medica";
  return "evento";
}

function leerRepeticion(reglas?: string[]): Repeticion {
  const regla = reglas?.find((r) => r.startsWith("RRULE:"));
  if (!regla) return "ninguna";
  const partes = Object.fromEntries(regla.slice(6).split(";").map((p) => p.split("=")));
  const simple = Object.keys(partes).every((k) => k === "FREQ" || k === "WKST" || (k === "INTERVAL" && partes[k] === "1"));
  if (!simple) return "ninguna";
  return ({ WEEKLY: "semanal", MONTHLY: "mensual", YEARLY: "anual" } as Record<string, Repeticion>)[partes.FREQ] ?? "ninguna";
}

/** Convierte un evento de Google en los campos de nuestra tabla. */
export function desdeEventoGoogle(g: EventoGoogle) {
  const tipoGuardado = g.extendedProperties?.private?.llitoTipo as TipoEvento | undefined;
  const resumen = (g.summary ?? "(Sin título)").trim();
  const tipo = tipoGuardado && tipoGuardado in TIPOS ? tipoGuardado : adivinarTipo(resumen);
  const emoji = TIPOS[tipo].emoji;
  const titulo = (resumen.startsWith(emoji) ? resumen.slice(emoji.length) : resumen).replace(/ \(hecha\)$/, "").trim() || "(Sin título)";

  let fecha: string;
  let todoElDia = true;
  let horaInicio: string | null = null;
  let horaFin: string | null = null;
  let inicio: Date;
  if (g.start?.date) {
    fecha = g.start.date;
    inicio = madridAUtc(fecha);
  } else {
    inicio = new Date(g.start!.dateTime!);
    fecha = fechaMadrid(inicio);
    todoElDia = false;
    horaInicio = horaMadrid(inicio);
    if (g.end?.dateTime) {
      const fin = new Date(g.end.dateTime);
      if (fechaMadrid(fin) === fecha) horaFin = horaMadrid(fin);
    }
  }
  const avisos = g.reminders && !g.reminders.useDefault ? (g.reminders.overrides ?? []).map((o) => o.minutes) : [];
  return {
    tipo,
    titulo: titulo.slice(0, 120),
    fecha,
    todoElDia,
    horaInicio,
    horaFin,
    inicio,
    repeticion: leerRepeticion(g.recurrence),
    ubicacion: g.location?.slice(0, 200) ?? null,
    notas: g.description?.slice(0, 2000) ?? null,
    recordatorios: avisos.join(","),
    googleId: g.id!,
    sincronizado: true,
  };
}

/**
 * Trae los cambios de Google desde la última vez. Devuelve cuántos eventos
 * han cambiado. Si `forzar` es false, no hace nada si se sincronizó hace poco.
 */
export async function sincronizarDesdeGoogle(hogarId: string, { forzar = false } = {}): Promise<number | null> {
  const c = await conexionDe(hogarId);
  if (!c) return null;
  if (!forzar && c.ultimaSync && Date.now() - c.ultimaSync.getTime() < 60_000) return 0;

  let cambios = 0;
  try {
    await subirPendientes(hogarId);

    let syncToken = c.syncToken;
    let pageToken: string | undefined;
    let nuevoSyncToken: string | undefined;
    const base = `/calendars/${encodeURIComponent(c.calendarId)}/events`;

    do {
      const q = new URLSearchParams({ showDeleted: "true", maxResults: "250" });
      if (pageToken) q.set("pageToken", pageToken);
      // La primera vez se lee todo (el calendario es solo de la familia); después, solo cambios
      if (syncToken) q.set("syncToken", syncToken);

      let pagina: { items?: EventoGoogle[]; nextPageToken?: string; nextSyncToken?: string };
      try {
        pagina = await api(c, `${base}?${q}`);
      } catch (err) {
        // 410: el syncToken caducó → sincronización completa desde cero
        if (err instanceof ErrorGoogle && err.status === 410 && syncToken) {
          syncToken = null;
          pageToken = undefined;
          continue;
        }
        throw err;
      }

      for (const g of pagina.items ?? []) {
        if (!g.id || g.recurringEventId) continue; // excepciones de series: se ignoran
        const local = await db
          .select()
          .from(evento)
          .where(and(eq(evento.hogarId, hogarId), eq(evento.googleId, g.id)))
          .get();
        const llitoId = g.extendedProperties?.private?.llitoId;
        const porId = !local && llitoId ? await db.select().from(evento).where(and(eq(evento.hogarId, hogarId), eq(evento.id, llitoId))).get() : undefined;
        const existente = local ?? porId;

        if (g.status === "cancelled") {
          if (existente) {
            await db.delete(evento).where(eq(evento.id, existente.id));
            cambios++;
          }
          continue;
        }
        if (!g.start) continue;

        const datos = desdeEventoGoogle(g);
        if (existente) {
          await db
            .update(evento)
            .set({ ...datos, completado: existente.completado, updatedAt: new Date() })
            .where(eq(evento.id, existente.id));
        } else {
          await db.insert(evento).values({ ...datos, hogarId });
        }
        cambios++;
      }
      pageToken = pagina.nextPageToken;
      nuevoSyncToken = pagina.nextSyncToken ?? nuevoSyncToken;
    } while (pageToken);

    await db
      .update(conexionGoogle)
      .set({ syncToken: nuevoSyncToken ?? syncToken, ultimaSync: new Date(), ultimoError: null, updatedAt: new Date() })
      .where(eq(conexionGoogle.hogarId, hogarId));
    return cambios;
  } catch (err) {
    await anotarError(hogarId, err);
    return null;
  }
}

/** Reintenta subir los eventos que fallaron (o se crearon antes de conectar). */
export async function subirPendientes(hogarId: string): Promise<void> {
  const pendientes = await db
    .select()
    .from(evento)
    .where(and(eq(evento.hogarId, hogarId), eq(evento.sincronizado, false), isNotNull(evento.fecha)));
  for (const e of pendientes) await subirEvento(hogarId, e);
}
