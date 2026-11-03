import { REPETICIONES, TIPOS_EVENTO, type Evento, type Repeticion, type TipoEvento } from "@/db/schema";
import { esFechaValida, esHoraValida } from "./fechas";
import { leerRecordatorios, TIPOS, type DatosEvento } from "./eventos";
import type { Errores } from "./validacion";

/** Valores tal como los muestra el formulario */
export type ValoresEvento = {
  tipo: TipoEvento;
  titulo: string;
  fecha: string;
  sinFecha: boolean;
  todoElDia: boolean;
  horaInicio: string;
  horaFin: string;
  repeticion: Repeticion;
  ubicacion: string;
  notas: string;
  hijoId: string;
  asignadoA: string;
  recordatorios: number[];
};

export function valoresIniciales(tipo: TipoEvento, fecha: string): ValoresEvento {
  const d = TIPOS[tipo].porDefecto;
  return {
    tipo,
    titulo: "",
    fecha,
    sinFecha: false,
    todoElDia: d.todoElDia ?? false,
    horaInicio: "10:00",
    horaFin: "",
    repeticion: d.repeticion ?? "ninguna",
    ubicacion: "",
    notas: "",
    hijoId: "",
    asignadoA: "",
    recordatorios: d.recordatorios ?? [],
  };
}

export function valoresDe(e: Evento): ValoresEvento {
  return {
    tipo: e.tipo,
    titulo: e.titulo,
    fecha: e.fecha ?? "",
    sinFecha: !e.fecha,
    todoElDia: e.todoElDia,
    horaInicio: e.horaInicio ?? "10:00",
    horaFin: e.horaFin ?? "",
    repeticion: e.repeticion,
    ubicacion: e.ubicacion ?? "",
    notas: e.notas ?? "",
    hijoId: e.hijoId ?? "",
    asignadoA: e.asignadoA ?? "",
    recordatorios: leerRecordatorios(e),
  };
}

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

export function leerFormEvento(
  form: FormData,
  permitidos: { hijos: string[]; miembros: string[] },
): { valores: ValoresEvento; datos?: DatosEvento; errores: Errores } {
  const tipoRaw = s(form, "tipo");
  const tipo: TipoEvento = (TIPOS_EVENTO as readonly string[]).includes(tipoRaw) ? (tipoRaw as TipoEvento) : "evento";
  const repRaw = s(form, "repeticion");
  const valores: ValoresEvento = {
    tipo,
    titulo: s(form, "titulo"),
    fecha: s(form, "fecha"),
    sinFecha: tipo === "tarea" && form.get("sin_fecha") === "si",
    todoElDia: form.get("todo_el_dia") === "si",
    horaInicio: s(form, "hora_inicio"),
    horaFin: s(form, "hora_fin"),
    repeticion: (REPETICIONES as readonly string[]).includes(repRaw) ? (repRaw as Repeticion) : "ninguna",
    ubicacion: s(form, "ubicacion"),
    notas: s(form, "notas"),
    hijoId: s(form, "hijo_id"),
    asignadoA: s(form, "asignado_a"),
    recordatorios: [...new Set(form.getAll("recordatorio").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 40320))].sort((a, b) => a - b),
  };

  const errores: Errores = {};
  if (!valores.titulo) errores.titulo = tipo === "cumpleanos" ? "Escribe de quién es el cumpleaños." : "Escribe un título.";
  else if (valores.titulo.length > 120) errores.titulo = "El título puede tener como mucho 120 caracteres.";

  if (!valores.sinFecha) {
    if (!valores.fecha) errores.fecha = "Elige una fecha.";
    else if (!esFechaValida(valores.fecha)) errores.fecha = "La fecha no es válida.";
    if (!valores.todoElDia) {
      if (!esHoraValida(valores.horaInicio)) errores.hora_inicio = "Escribe la hora de inicio, por ejemplo 10:30.";
      if (valores.horaFin && !esHoraValida(valores.horaFin)) errores.hora_fin = "La hora de fin no es válida.";
      else if (valores.horaFin && valores.horaFin <= valores.horaInicio) errores.hora_fin = "La hora de fin tiene que ser posterior a la de inicio.";
    }
  }
  if (valores.ubicacion.length > 200) errores.ubicacion = "El lugar puede tener como mucho 200 caracteres.";
  if (valores.notas.length > 2000) errores.notas = "Las notas pueden tener como mucho 2000 caracteres.";
  if (valores.hijoId && !permitidos.hijos.includes(valores.hijoId)) valores.hijoId = "";
  if (valores.asignadoA && !permitidos.miembros.includes(valores.asignadoA)) valores.asignadoA = "";
  if (valores.recordatorios.length > 5) errores.recordatorios = "Elige como mucho 5 avisos.";

  if (Object.keys(errores).length > 0) return { valores, errores };

  return {
    valores,
    errores,
    datos: {
      tipo,
      titulo: valores.titulo,
      fecha: valores.sinFecha ? null : valores.fecha,
      todoElDia: valores.sinFecha ? true : valores.todoElDia,
      horaInicio: valores.todoElDia ? null : valores.horaInicio,
      horaFin: valores.todoElDia || !valores.horaFin ? null : valores.horaFin,
      repeticion: valores.sinFecha ? "ninguna" : valores.repeticion,
      ubicacion: valores.ubicacion || null,
      notas: valores.notas || null,
      hijoId: valores.hijoId || null,
      asignadoA: valores.asignadoA || null,
      recordatorios: valores.sinFecha ? [] : valores.recordatorios,
    },
  };
}

/** Solo se permite volver a páginas de la agenda o al inicio */
export function destinoSeguro(v: FormDataEntryValue | string | null, porDefecto = "/agenda"): string {
  const t = typeof v === "string" ? v : "";
  return /^\/(agenda)?([/?#][^\s]*)?$/.test(t) && !t.startsWith("//") ? t : porDefecto;
}
