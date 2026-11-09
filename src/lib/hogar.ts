/**
 * Utilidades de la sección Hogar: lista de la compra, limpieza y pelis/series.
 * Las tres listas siguen el mismo patrón: lo hecho (comprado, visto) no se
 * borra al momento, se marca con fecha. Así queda registro y se puede deshacer.
 */
import { and, desc, eq, gte, isNotNull, isNull, lt, max } from "drizzle-orm";
import { db } from "@/db/client";
import { jornadaLimpieza, productoCompra, titulo, type JornadaLimpieza } from "@/db/schema";
import { diaSemana, fechaMadrid, sumarDias } from "./fechas";

/** Persona que limpia y su precio por hora por defecto */
export const LIMPIEZA = { nombre: "María Eugenia", tarifaCentimos: 1000 } as const;

/** Lo comprado o visto se conserva este tiempo como historial y luego se borra */
const DIAS_HISTORIAL = 30;

/* ── Formatos ─────────────────────────────────────────────────────────── */

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const formatoEuros = (centimos: number) => euros.format(centimos / 100);

/** 90 → "1 h 30 min", 120 → "2 h" */
export function formatoHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "3", "3,5", "3.5" o "3:30" → minutos. Null si no es válido. */
export function leerHoras(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  let minutos: number;
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (hm) minutos = Number(hm[1]) * 60 + Number(hm[2]);
  else if (/^\d{1,2}(\.\d{1,2})?$/.test(t)) minutos = Math.round(Number(t) * 60);
  else return null;
  return minutos > 0 && minutos <= 16 * 60 ? minutos : null;
}

/** "10", "10,50" o "10.5" → céntimos. Null si no es válido. */
export function leerEuros(texto: string): number | null {
  const t = texto.trim().replace(",", ".").replace("€", "").trim();
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
  const c = Math.round(Number(t) * 100);
  return c > 0 ? c : null;
}

export const costeJornada = (j: Pick<JornadaLimpieza, "minutos" | "tarifaCentimos">) =>
  Math.round((j.minutos * j.tarifaCentimos) / 60);

/** Lunes de la semana de `fecha` */
export const lunesDe = (fecha: string) => sumarDias(fecha, -diaSemana(fecha));

/** Fecha y hora legibles de un instante en Madrid: «lunes, 9 de noviembre a las 19:45» */
const fmtInstante = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});
export const formatoInstante = (d: Date) => fmtInstante.format(d).replace(",", "").replace(" ", ", ");

/** Texto limpio de un campo de formulario, o null si está vacío */
export function campo(form: FormData, nombre: string, maximo = 200): string | null {
  const v = String(form.get(nombre) ?? "").trim().replace(/\s+/g, " ");
  return v ? v.slice(0, maximo) : null;
}

/* ── Lista de la compra ───────────────────────────────────────────────── */

export async function listaCompra(hogarId: string) {
  const limite = new Date(Date.now() - DIAS_HISTORIAL * 86_400_000);
  // Limpieza perezosa del historial antiguo
  await db.delete(productoCompra).where(and(eq(productoCompra.hogarId, hogarId), lt(productoCompra.compradoEn, limite)));

  const [pendientes, comprados, [ultima]] = await Promise.all([
    db
      .select()
      .from(productoCompra)
      .where(and(eq(productoCompra.hogarId, hogarId), isNull(productoCompra.compradoEn)))
      .orderBy(desc(productoCompra.createdAt)),
    db
      .select()
      .from(productoCompra)
      .where(and(eq(productoCompra.hogarId, hogarId), isNotNull(productoCompra.compradoEn)))
      .orderBy(desc(productoCompra.compradoEn))
      .limit(20),
    db.select({ t: max(productoCompra.updatedAt) }).from(productoCompra).where(eq(productoCompra.hogarId, hogarId)),
  ]);
  return { pendientes, comprados, ultimaActualizacion: ultima?.t ?? null };
}

/* ── Pelis y series ───────────────────────────────────────────────────── */

export async function listaTitulos(hogarId: string) {
  const [pendientes, vistos] = await Promise.all([
    db
      .select()
      .from(titulo)
      .where(and(eq(titulo.hogarId, hogarId), isNull(titulo.vistaEn)))
      .orderBy(desc(titulo.createdAt)),
    db
      .select()
      .from(titulo)
      .where(and(eq(titulo.hogarId, hogarId), isNotNull(titulo.vistaEn)))
      .orderBy(desc(titulo.vistaEn))
      .limit(30),
  ]);
  return { pendientes, vistos };
}

/* ── Limpieza ─────────────────────────────────────────────────────────── */

export type Semana = { lunes: string; domingo: string; jornadas: JornadaLimpieza[]; minutos: number; centimos: number; pendiente: number };

/** Jornadas agrupadas por semana (de lunes a domingo), de la más reciente a la más antigua */
export async function semanasLimpieza(hogarId: string, semanas = 12): Promise<Semana[]> {
  const desde = sumarDias(lunesDe(fechaMadrid()), -7 * (semanas - 1));
  const filas = await db
    .select()
    .from(jornadaLimpieza)
    .where(and(eq(jornadaLimpieza.hogarId, hogarId), gte(jornadaLimpieza.fecha, desde)))
    .orderBy(desc(jornadaLimpieza.fecha), desc(jornadaLimpieza.createdAt));

  const porSemana = new Map<string, Semana>();
  for (const j of filas) {
    const lunes = lunesDe(j.fecha);
    let s = porSemana.get(lunes);
    if (!s) {
      s = { lunes, domingo: sumarDias(lunes, 6), jornadas: [], minutos: 0, centimos: 0, pendiente: 0 };
      porSemana.set(lunes, s);
    }
    const coste = costeJornada(j);
    s.jornadas.push(j);
    s.minutos += j.minutos;
    s.centimos += coste;
    if (!j.pagado) s.pendiente += coste;
  }
  return [...porSemana.values()];
}

/** Total pendiente de pagar (todas las fechas) */
export async function pendienteLimpieza(hogarId: string) {
  const filas = await db
    .select({ minutos: jornadaLimpieza.minutos, tarifaCentimos: jornadaLimpieza.tarifaCentimos })
    .from(jornadaLimpieza)
    .where(and(eq(jornadaLimpieza.hogarId, hogarId), eq(jornadaLimpieza.pagado, false)));
  return { dias: filas.length, centimos: filas.reduce((s, j) => s + costeJornada(j), 0) };
}
