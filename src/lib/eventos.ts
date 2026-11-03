import { and, asc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { evento, type Evento, type Repeticion, type TipoEvento } from "@/db/schema";
import { diasDelMes, diaSemana, madridAUtc, sumarDias } from "./fechas";

/* ── Tipos de evento ──────────────────────────────────────────────────── */

export const TIPOS: Record<
  TipoEvento,
  { nombre: string; emoji: string; color: string; ayuda: string; porDefecto: Partial<DatosEvento> }
> = {
  cita_medica: {
    nombre: "Cita médica",
    emoji: "🩺",
    color: "var(--hijos)",
    ayuda: "Pediatra, revisiones, especialistas.",
    porDefecto: { todoElDia: false, recordatorios: [1440, 60] },
  },
  vacuna: {
    nombre: "Vacuna",
    emoji: "💉",
    color: "var(--hijos)",
    ayuda: "Calendario de vacunación.",
    porDefecto: { todoElDia: false, recordatorios: [1440, 60] },
  },
  cumpleanos: {
    nombre: "Cumpleaños",
    emoji: "🎂",
    color: "var(--cumple)",
    ayuda: "Se repite cada año.",
    porDefecto: { todoElDia: true, repeticion: "anual", recordatorios: [240, 8880] },
  },
  tarea: {
    nombre: "Tarea",
    emoji: "✅",
    color: "var(--hogar)",
    ayuda: "Algo que hacer, con o sin fecha.",
    porDefecto: { todoElDia: true, recordatorios: [] },
  },
  evento: {
    nombre: "Plan",
    emoji: "📅",
    color: "var(--accent)",
    ayuda: "Comidas, viajes, visitas…",
    porDefecto: { todoElDia: false, recordatorios: [60] },
  },
  recordatorio: {
    nombre: "Recordatorio",
    emoji: "🔔",
    color: "var(--aviso)",
    ayuda: "Un aviso puntual: pagar, llamar, renovar…",
    porDefecto: { todoElDia: false, recordatorios: [0] },
  },
};

export const ORDEN_TIPOS: TipoEvento[] = ["cita_medica", "cumpleanos", "tarea", "evento", "vacuna", "recordatorio"];

export const REPETICIONES_TXT: Record<Repeticion, string> = {
  ninguna: "No se repite",
  semanal: "Cada semana",
  mensual: "Cada mes",
  anual: "Cada año",
};

/** Opciones de aviso. Para eventos de todo el día, Google cuenta desde las 00:00 del día. */
export const AVISOS_HORA = [
  { min: 0, txt: "A la hora" },
  { min: 15, txt: "15 minutos antes" },
  { min: 60, txt: "1 hora antes" },
  { min: 180, txt: "3 horas antes" },
  { min: 1440, txt: "1 día antes" },
  { min: 10080, txt: "1 semana antes" },
];
export const AVISOS_DIA = [
  { min: 240, txt: "La víspera a las 20:00" },
  { min: 900, txt: "La víspera a las 9:00" },
  { min: 8880, txt: "Una semana antes, a las 20:00" },
];

/* ── Datos ────────────────────────────────────────────────────────────── */

export type DatosEvento = {
  tipo: TipoEvento;
  titulo: string;
  fecha: string | null;
  todoElDia: boolean;
  horaInicio: string | null;
  horaFin: string | null;
  repeticion: Repeticion;
  ubicacion: string | null;
  notas: string | null;
  hijoId: string | null;
  asignadoA: string | null;
  recordatorios: number[];
};

export function aFila(d: DatosEvento) {
  return {
    tipo: d.tipo,
    titulo: d.titulo,
    fecha: d.fecha,
    todoElDia: d.todoElDia,
    horaInicio: d.todoElDia ? null : d.horaInicio,
    horaFin: d.todoElDia ? null : d.horaFin,
    inicio: d.fecha ? madridAUtc(d.fecha, d.todoElDia ? "00:00" : (d.horaInicio ?? "00:00")) : null,
    repeticion: d.repeticion,
    ubicacion: d.ubicacion,
    notas: d.notas,
    hijoId: d.hijoId,
    asignadoA: d.asignadoA,
    recordatorios: d.recordatorios.join(","),
  };
}

export function leerRecordatorios(e: Pick<Evento, "recordatorios">): number[] {
  return e.recordatorios
    ? e.recordatorios.split(",").map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    : [];
}

export function buscarEvento(hogarId: string, id: string) {
  return db.select().from(evento).where(and(eq(evento.id, id), eq(evento.hogarId, hogarId))).get();
}

/* ── Consultas por rango (con repeticiones) ───────────────────────────── */

export type Ocurrencia = Evento & { dia: string };

/** ¿En qué día cae la repetición de `e` dentro del mes/semana de `dia`? */
function ocurreEl(e: Evento, dia: string): boolean {
  if (!e.fecha || dia < e.fecha) return false;
  if (e.fecha === dia) return true;
  const [, m0, d0] = e.fecha.split("-").map(Number);
  const [y, m, d] = dia.split("-").map(Number);
  switch (e.repeticion) {
    case "semanal":
      return diaSemana(e.fecha) === diaSemana(dia);
    case "mensual":
      // Si el mes no tiene ese día (31), cae en el último día del mes
      return d === Math.min(d0, diasDelMes(y, m));
    case "anual":
      // 29 de febrero → 28 en años no bisiestos
      return m === m0 && d === Math.min(d0, diasDelMes(y, m));
    default:
      return false;
  }
}

/** Ocurrencias entre `desde` y `hasta` (incluidos), ordenadas por día y hora. */
export async function eventosEnRango(hogarId: string, desde: string, hasta: string): Promise<Ocurrencia[]> {
  const candidatos = await db
    .select()
    .from(evento)
    .where(
      and(
        eq(evento.hogarId, hogarId),
        lte(evento.fecha, hasta),
        or(and(eq(evento.repeticion, "ninguna"), gte(evento.fecha, desde)), ne(evento.repeticion, "ninguna")),
      ),
    );

  const salida: Ocurrencia[] = [];
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
    for (const e of candidatos) {
      if (e.repeticion === "ninguna" ? e.fecha === dia : ocurreEl(e, dia)) salida.push({ ...e, dia });
    }
  }
  return salida.sort(
    (a, b) =>
      a.dia.localeCompare(b.dia) ||
      Number(b.todoElDia) - Number(a.todoElDia) ||
      (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "") ||
      a.titulo.localeCompare(b.titulo),
  );
}

/** Tareas sin fecha pendientes */
export function tareasSinFecha(hogarId: string) {
  return db
    .select()
    .from(evento)
    .where(and(eq(evento.hogarId, hogarId), eq(evento.tipo, "tarea"), isNull(evento.fecha)))
    .orderBy(asc(evento.completado), asc(evento.createdAt));
}

/** Texto de hora: "Todo el día", "10:30", "10:30 – 11:15" */
export function textoHora(e: Pick<Evento, "todoElDia" | "horaInicio" | "horaFin">): string {
  if (e.todoElDia || !e.horaInicio) return "Todo el día";
  return e.horaFin ? `${e.horaInicio} – ${e.horaFin}` : e.horaInicio;
}

/** Años que cumple en `dia` (para cumpleaños con año de nacimiento) */
export function edadEn(e: Pick<Evento, "fecha" | "tipo">, dia: string): number | null {
  if (e.tipo !== "cumpleanos" || !e.fecha) return null;
  const anios = Number(dia.slice(0, 4)) - Number(e.fecha.slice(0, 4));
  return anios > 0 ? anios : null;
}
