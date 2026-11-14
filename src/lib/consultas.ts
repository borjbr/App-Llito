/**
 * Consultas médicas de los hijos: lectura de medidas, formatos y consultas.
 * Las medidas se guardan en gramos y milímetros; se escriben y muestran en kg y cm.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consulta, hijo, type Consulta } from "@/db/schema";
import { esFechaValida } from "./fechas";

export const ESPECIALIDADES = [
  "Pediatría",
  "Enfermería",
  "Vacunas",
  "Neurología",
  "Neurocirugía",
  "Traumatología",
  "Oftalmología",
  "Otorrino",
  "Dermatología",
  "Cardiología",
  "Digestivo",
  "Urgencias",
] as const;

export const LIMITES = { especialidad: 60, centro: 120, profesional: 80, motivo: 160, notas: 4000, indicaciones: 2000 } as const;

/** Icono según la especialidad (texto libre) */
export function iconoEspecialidad(e: string | null): string {
  const t = (e ?? "").toLowerCase();
  if (t.includes("vacun")) return "💉";
  if (t.includes("neuro")) return "🧠";
  if (t.includes("urgenc")) return "🚑";
  if (t.includes("oftal") || t.includes("ojo")) return "👁️";
  if (t.includes("otorr") || t.includes("oído")) return "👂";
  if (t.includes("trauma")) return "🦴";
  if (t.includes("cardio")) return "❤️";
  if (t.includes("derma")) return "🧴";
  if (t.includes("enferm")) return "🩹";
  return "🩺";
}

/* ── Medidas ──────────────────────────────────────────────────────────── */

const numero = (texto: string) => {
  const t = texto.trim().replace(/\s*(kg|cm|g)$/i, "").replace(",", ".");
  return /^\d{1,3}(\.\d{1,3})?$/.test(t) ? Number(t) : null;
};

/** «7,35» o «7.350 kg» → 7350 g. También acepta gramos («7350»). */
export function leerPeso(texto: string): number | null | "error" {
  if (!texto.trim()) return null;
  const limpio = texto.trim().replace(/\s*g$/i, "");
  if (/^\d{3,5}$/.test(limpio) && Number(limpio) >= 500) return Number(limpio); // escrito en gramos
  const n = numero(texto);
  if (n === null) return "error";
  const g = Math.round(n * 1000);
  return g >= 500 && g <= 60000 ? g : "error";
}

/** «66,5» → 665 mm */
export function leerCm(texto: string, min: number, max: number): number | null | "error" {
  if (!texto.trim()) return null;
  const n = numero(texto);
  if (n === null || n < min || n > max) return "error";
  return Math.round(n * 10);
}

const kg = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const cm = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
export const formatoPeso = (g: number) => `${kg.format(g / 1000)} kg`;
export const formatoCm = (mm: number) => `${cm.format(mm / 10)} cm`;
/** Para rellenar el formulario: 7350 → «7,35» */
export const pesoAInput = (g: number | null) => (g ? kg.format(g / 1000).replace(/(,\d*?)0+$/, "$1").replace(/,$/, "") : "");
export const cmAInput = (mm: number | null) => (mm ? cm.format(mm / 10) : "");

/** Diferencia con signo: «+350 g», «+1,5 cm» */
export function diferencia(actual: number, anterior: number, tipo: "peso" | "cm"): string {
  const d = actual - anterior;
  const signo = d > 0 ? "+" : d < 0 ? "−" : "±";
  const abs = Math.abs(d);
  if (tipo === "peso") return `${signo}${abs >= 1000 ? kg.format(abs / 1000) + " kg" : abs + " g"}`;
  return `${signo}${cm.format(abs / 10)} cm`;
}

/* ── Edad ─────────────────────────────────────────────────────────────── */

/** Edad en una fecha: «3 semanas», «5 meses», «1 año y 2 meses» */
export function edadEn(nacimiento: string | null, fecha: string): string | null {
  if (!nacimiento || !esFechaValida(nacimiento) || fecha < nacimiento) return null;
  const [y1, m1, d1] = nacimiento.split("-").map(Number);
  const [y2, m2, d2] = fecha.split("-").map(Number);
  let meses = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses < 1) {
    const dias = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
    const semanas = Math.floor(dias / 7);
    return semanas < 1 ? `${dias} ${dias === 1 ? "día" : "días"}` : `${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }
  if (meses < 24) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  meses %= 12;
  return `${anios} años${meses ? ` y ${meses} ${meses === 1 ? "mes" : "meses"}` : ""}`;
}

/** Meses (con decimales) entre el nacimiento y una fecha, para la gráfica */
const utc = (f: string) => {
  const [y, m, d] = f.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const mesesEntre = (nacimiento: string, fecha: string) => (utc(fecha) - utc(nacimiento)) / (30.4375 * 86_400_000);

/* ── Consultas ────────────────────────────────────────────────────────── */

export async function hijoDelHogar(hogarId: string, hijoId: string | null) {
  const hijos = await db.select().from(hijo).where(eq(hijo.hogarId, hogarId)).orderBy(asc(hijo.orden));
  return { hijos, actual: hijos.find((h) => h.id === hijoId) ?? hijos[0] ?? null };
}

export async function consultasDe(hogarId: string, hijoId: string) {
  return db
    .select()
    .from(consulta)
    .where(and(eq(consulta.hogarId, hogarId), eq(consulta.hijoId, hijoId)))
    .orderBy(desc(consulta.fecha), desc(consulta.createdAt));
}

export async function consultaDelHogar(hogarId: string, id: string) {
  const [c] = await db
    .select()
    .from(consulta)
    .where(and(eq(consulta.id, id), eq(consulta.hogarId, hogarId)));
  return c ?? null;
}

/** Última medida de cada tipo y la anterior, para el resumen */
export function ultimasMedidas(consultas: Consulta[]) {
  const campo = (k: "pesoGramos" | "tallaMm" | "perimetroMm") => {
    const con = consultas.filter((c) => c[k] != null);
    return con.length ? { actual: con[0][k]!, fecha: con[0].fecha, anterior: con[1]?.[k] ?? null, fechaAnterior: con[1]?.fecha ?? null } : null;
  };
  return { peso: campo("pesoGramos"), talla: campo("tallaMm"), perimetro: campo("perimetroMm") };
}

/* ── Formulario ───────────────────────────────────────────────────────── */

export type ValoresConsulta = {
  hijoId: string;
  fecha: string;
  especialidad: string;
  centro: string;
  profesional: string;
  motivo: string;
  peso: string;
  talla: string;
  perimetro: string;
  notas: string;
  indicaciones: string;
  eventoId: string;
};

export function leerFormulario(form: FormData): ValoresConsulta {
  const t = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  return {
    hijoId: t("hijo"),
    fecha: t("fecha", 10),
    especialidad: t("especialidad", LIMITES.especialidad),
    centro: t("centro", LIMITES.centro),
    profesional: t("profesional", LIMITES.profesional),
    motivo: t("motivo", LIMITES.motivo),
    peso: t("peso", 20),
    talla: t("talla", 20),
    perimetro: t("perimetro", 20),
    notas: String(form.get("notas") ?? "").trim().slice(0, LIMITES.notas),
    indicaciones: String(form.get("indicaciones") ?? "").trim().slice(0, LIMITES.indicaciones),
    eventoId: t("evento", 60),
  };
}

export function validar(v: ValoresConsulta, hoy: string, hijosValidos: string[]) {
  const errores: Record<string, string> = {};
  if (!hijosValidos.includes(v.hijoId)) errores.hijo = "Elige para quién es la consulta.";
  if (!esFechaValida(v.fecha)) errores.fecha = "Elige el día de la consulta.";
  else if (v.fecha > hoy) errores.fecha = "La consulta no puede ser de un día futuro. Las próximas citas van en la agenda.";
  const peso = leerPeso(v.peso);
  const talla = leerCm(v.talla, 30, 200);
  const perimetro = leerCm(v.perimetro, 25, 70);
  if (peso === "error") errores.peso = "Escribe el peso en kg, por ejemplo 7,35.";
  if (talla === "error") errores.talla = "Escribe la talla en cm, por ejemplo 66,5.";
  if (perimetro === "error") errores.perimetro = "Escribe el perímetro en cm, por ejemplo 43.";
  const algo = v.especialidad || v.motivo || v.notas || v.indicaciones || peso || talla || perimetro;
  if (!algo && !errores.fecha) errores.especialidad = "Apunta al menos la especialidad, una medida o una nota.";
  return {
    errores,
    datos: {
      hijoId: v.hijoId,
      fecha: v.fecha,
      especialidad: v.especialidad || null,
      centro: v.centro || null,
      profesional: v.profesional || null,
      motivo: v.motivo || null,
      pesoGramos: typeof peso === "number" ? peso : null,
      tallaMm: typeof talla === "number" ? talla : null,
      perimetroMm: typeof perimetro === "number" ? perimetro : null,
      notas: v.notas || null,
      indicaciones: v.indicaciones || null,
    },
  };
}
