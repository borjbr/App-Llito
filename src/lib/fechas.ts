/**
 * Fechas en hora de Madrid. El servidor (Vercel) funciona en UTC, así que
 * nunca usamos la zona local del proceso: todo pasa por Intl con la zona fija.
 */
export const ZONA = "Europe/Madrid";

const partesFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partes(d: Date) {
  const p = Object.fromEntries(partesFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** YYYY-MM-DD de hoy (o de un instante) en Madrid */
export function fechaMadrid(d = new Date()): string {
  return partes(d).fecha;
}

/** HH:MM de un instante en Madrid */
export function horaMadrid(d: Date): string {
  return partes(d).hora;
}

/** Diferencia en ms entre la hora de Madrid y UTC en ese instante */
function desfase(instante: number): number {
  const { fecha, hora } = partes(new Date(instante));
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - Math.floor(instante / 60000) * 60000;
}

/** "2026-11-04" + "10:30" (hora de Madrid) → Date en UTC */
export function madridAUtc(fecha: string, hora = "00:00"): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const ingenuo = Date.UTC(y, m - 1, d, hh, mm);
  let t = ingenuo - desfase(ingenuo);
  t = ingenuo - desfase(t); // segunda pasada por si cae en el cambio de hora
  return new Date(t);
}

/* ── Aritmética de días (sobre fechas YYYY-MM-DD, sin zonas) ─────────── */

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunes
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function esFechaValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const [y, m, d] = f.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= diasDelMes(y, m);
}

export function esHoraValida(h: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
}

/* ── Textos ───────────────────────────────────────────────────────────── */

const fmtLargo = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fmtMes = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

function aDate(fecha: string) {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "Hoy", "Mañana", "Ayer" o "jueves, 6 de noviembre" */
export function nombreDia(fecha: string, hoy = fechaMadrid()): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  if (fecha === sumarDias(hoy, -1)) return "Ayer";
  return fmtLargo.format(aDate(fecha));
}

export function fechaLarga(fecha: string): string {
  return fmtLargo.format(aDate(fecha));
}

/** "noviembre de 2026" */
export function nombreMes(anio: number, mes: number): string {
  return fmtMes.format(new Date(Date.UTC(anio, mes - 1, 1)));
}

export const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
export const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
