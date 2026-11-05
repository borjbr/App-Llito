import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { ingredienteReceta, receta, type CategoriaAlimento, type IngredienteReceta, type Receta } from "@/db/schema";
import { avisosDe, buscarProducto, CATEGORIAS, esCategoria, normalizar, textoEdad } from "./alimentos";
import type { Errores } from "./validacion";

/* ── Tipos ────────────────────────────────────────────────────────────── */

export type IngredienteDatos = { categoria: CategoriaAlimento; producto: string; cantidad: string | null };

/** Datos de una receta ya validados, listos para guardar */
export type DatosReceta = {
  titulo: string;
  descripcion: string | null;
  edadMeses: number | null;
  minutos: number | null;
  raciones: string | null;
  ingredientes: IngredienteDatos[];
  pasos: string[];
  notas: string | null;
};

export type RecetaCompleta = Receta & { ingredientes: IngredienteReceta[] };

/** Lo que el chat necesita para pintar la tarjeta de una receta */
export type RecetaParaChat = {
  id: string;
  titulo: string;
  descripcion: string | null;
  edad: string | null;
  minutos: number | null;
  raciones: string | null;
  ingredientes: { emoji: string; producto: string; cantidad: string | null }[];
  pasos: string[];
  notas: string | null;
  avisos: string[];
  url: string;
};

export const LIMITES = { titulo: 120, descripcion: 300, raciones: 60, producto: 60, cantidad: 40, ingredientes: 30, pasos: 30, paso: 500, notas: 2000 };

/* ── Consultas ────────────────────────────────────────────────────────── */

export function pasosDe(r: Pick<Receta, "pasos">): string[] {
  return r.pasos.split("\n").map((s) => s.trim()).filter(Boolean);
}

export async function recetasDe(hogarId: string): Promise<RecetaCompleta[]> {
  const recetas = await db.select().from(receta).where(eq(receta.hogarId, hogarId)).orderBy(desc(receta.updatedAt));
  if (recetas.length === 0) return [];
  const ingredientes = await db
    .select()
    .from(ingredienteReceta)
    .where(inArray(ingredienteReceta.recetaId, recetas.map((r) => r.id)))
    .orderBy(asc(ingredienteReceta.orden));
  const porReceta = new Map<string, IngredienteReceta[]>();
  for (const i of ingredientes) porReceta.set(i.recetaId, [...(porReceta.get(i.recetaId) ?? []), i]);
  return recetas.map((r) => ({ ...r, ingredientes: porReceta.get(r.id) ?? [] }));
}

export async function buscarReceta(hogarId: string, id: string): Promise<RecetaCompleta | undefined> {
  const r = await db
    .select()
    .from(receta)
    .where(and(eq(receta.id, id), eq(receta.hogarId, hogarId)))
    .get();
  if (!r) return undefined;
  const ingredientes = await db.select().from(ingredienteReceta).where(eq(ingredienteReceta.recetaId, r.id)).orderBy(asc(ingredienteReceta.orden));
  return { ...r, ingredientes };
}

export function paraChat(r: RecetaCompleta): RecetaParaChat {
  return {
    id: r.id,
    titulo: r.titulo,
    descripcion: r.descripcion,
    edad: textoEdad(r.edadMeses),
    minutos: r.minutos,
    raciones: r.raciones,
    ingredientes: r.ingredientes.map((i) => ({ emoji: CATEGORIAS[i.categoria].emoji, producto: i.producto, cantidad: i.cantidad })),
    pasos: pasosDe(r),
    notas: r.notas,
    avisos: avisosDe(r.ingredientes.map((i) => i.producto)),
    url: `/hijos/recetas/${r.id}`,
  };
}

/* ── Guardar ──────────────────────────────────────────────────────────── */

export type ResultadoGuardar = { ok: true; receta: RecetaCompleta; nueva: boolean } | { ok: false; error: string; existenteId?: string };

/**
 * Crea una receta (sin `id`) o la sustituye entera (con `id`).
 * No permite dos recetas con el mismo título en un hogar.
 */
export async function guardarReceta(
  hogarId: string,
  userId: string,
  datos: DatosReceta,
  opciones: { id?: string; origen?: "familia" | "asistente" } = {},
): Promise<ResultadoGuardar> {
  const clave = normalizar(datos.titulo);
  const duplicada = await db
    .select({ id: receta.id })
    .from(receta)
    .where(and(eq(receta.hogarId, hogarId), eq(receta.clave, clave), opciones.id ? ne(receta.id, opciones.id) : undefined))
    .get();
  if (duplicada) return { ok: false, error: "Ya tenéis una receta con ese nombre.", existenteId: duplicada.id };

  const fila = {
    titulo: datos.titulo,
    clave,
    descripcion: datos.descripcion,
    edadMeses: datos.edadMeses,
    minutos: datos.minutos,
    raciones: datos.raciones,
    pasos: datos.pasos.join("\n"),
    notas: datos.notas,
  };

  let id = opciones.id;
  if (id) {
    const actual = await db.select({ id: receta.id }).from(receta).where(and(eq(receta.id, id), eq(receta.hogarId, hogarId))).get();
    if (!actual) return { ok: false, error: "Esa receta no existe." };
  } else {
    id = crypto.randomUUID();
  }

  const filasIngredientes = datos.ingredientes.map((i, orden) => ({ recetaId: id, categoria: i.categoria, producto: i.producto, cantidad: i.cantidad, orden }));
  const guardarFila = opciones.id
    ? db.update(receta).set({ ...fila, updatedAt: new Date() }).where(eq(receta.id, id))
    : db.insert(receta).values({ ...fila, id, hogarId, origen: opciones.origen ?? "familia", creadoPor: userId });

  await db.batch([
    guardarFila,
    db.delete(ingredienteReceta).where(eq(ingredienteReceta.recetaId, id)),
    ...(filasIngredientes.length > 0 ? [db.insert(ingredienteReceta).values(filasIngredientes)] : []),
  ]);

  return { ok: true, receta: (await buscarReceta(hogarId, id))!, nueva: !opciones.id };
}

export async function borrarReceta(hogarId: string, id: string) {
  await db.delete(receta).where(and(eq(receta.id, id), eq(receta.hogarId, hogarId)));
}

/* ── Validación (común al formulario y al asistente) ──────────────────── */

const limpiar = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Quita la numeración que a veces se escribe al principio de un paso: "1. ", "2) ", "- " */
const sinNumero = (paso: string) => paso.replace(/^\s*(\d+[.)-]|[-•*])\s*/, "").trim();

export function validarReceta(entrada: {
  titulo: unknown;
  descripcion?: unknown;
  edadMeses?: unknown;
  minutos?: unknown;
  raciones?: unknown;
  ingredientes: { categoria?: unknown; producto: unknown; cantidad?: unknown }[];
  pasos: unknown[];
  notas?: unknown;
}): { datos?: DatosReceta; errores: Errores } {
  const errores: Errores = {};
  const titulo = limpiar(entrada.titulo);
  if (!titulo) errores.titulo = "Escribe el nombre de la receta.";
  else if (titulo.length > LIMITES.titulo) errores.titulo = `El nombre puede tener como mucho ${LIMITES.titulo} caracteres.`;

  const descripcion = limpiar(entrada.descripcion);
  if (descripcion.length > LIMITES.descripcion) errores.descripcion = `La descripción puede tener como mucho ${LIMITES.descripcion} caracteres.`;

  const raciones = limpiar(entrada.raciones);
  if (raciones.length > LIMITES.raciones) errores.raciones = `Las raciones pueden tener como mucho ${LIMITES.raciones} caracteres.`;

  let edadMeses: number | null = null;
  if (entrada.edadMeses !== undefined && entrada.edadMeses !== null && entrada.edadMeses !== "") {
    const n = Number(entrada.edadMeses);
    if (!Number.isInteger(n) || n < 4 || n > 216) errores.edad_meses = "Elige una edad válida.";
    else edadMeses = n;
  }

  let minutos: number | null = null;
  if (entrada.minutos !== undefined && entrada.minutos !== null && entrada.minutos !== "") {
    const n = Number(entrada.minutos);
    if (!Number.isInteger(n) || n < 1 || n > 1440) errores.minutos = "Escribe los minutos en números enteros, por ejemplo 30.";
    else minutos = n;
  }

  const ingredientes: IngredienteDatos[] = [];
  for (const i of entrada.ingredientes) {
    const producto = limpiar(i.producto);
    if (!producto) continue;
    const cantidad = limpiar(i.cantidad);
    if (producto.length > LIMITES.producto) errores.ingredientes = `Cada ingrediente puede tener como mucho ${LIMITES.producto} caracteres.`;
    if (cantidad.length > LIMITES.cantidad) errores.ingredientes = `Cada cantidad puede tener como mucho ${LIMITES.cantidad} caracteres.`;
    // El catálogo manda: si el producto es conocido, su categoría y su nombre son los del catálogo
    const conocido = buscarProducto(producto);
    const categoria = conocido?.categoria ?? (esCategoria(limpiar(i.categoria)) ? (limpiar(i.categoria) as CategoriaAlimento) : "otro");
    ingredientes.push({ categoria, producto: conocido?.producto.nombre ?? producto, cantidad: cantidad || null });
  }
  if (ingredientes.length === 0) errores.ingredientes ??= "Añade al menos un ingrediente.";
  else if (ingredientes.length > LIMITES.ingredientes) errores.ingredientes = `Puedes añadir como mucho ${LIMITES.ingredientes} ingredientes.`;

  const pasos = entrada.pasos.map((p) => sinNumero(limpiar(p))).filter(Boolean);
  if (pasos.length === 0) errores.pasos = "Escribe al menos un paso de la preparación.";
  else if (pasos.length > LIMITES.pasos) errores.pasos = `Puedes escribir como mucho ${LIMITES.pasos} pasos.`;
  else if (pasos.some((p) => p.length > LIMITES.paso)) errores.pasos = `Cada paso puede tener como mucho ${LIMITES.paso} caracteres.`;

  const notas = limpiar(entrada.notas);
  if (notas.length > LIMITES.notas) errores.notas = `Las notas pueden tener como mucho ${LIMITES.notas} caracteres.`;

  if (Object.keys(errores).length > 0) return { errores };
  return {
    errores,
    datos: { titulo, descripcion: descripcion || null, edadMeses, minutos, raciones: raciones || null, ingredientes, pasos, notas: notas || null },
  };
}

/* ── Formulario ───────────────────────────────────────────────────────── */

export const OTRO = "__otro";

/** Fila de ingrediente tal como la pinta el formulario */
export type FilaIngrediente = { categoria: CategoriaAlimento | ""; producto: string; otro: string; cantidad: string };

export type ValoresReceta = {
  titulo: string;
  descripcion: string;
  edadMeses: string;
  minutos: string;
  raciones: string;
  ingredientes: FilaIngrediente[];
  pasos: string;
  notas: string;
};

export function filaDe(i: { categoria: CategoriaAlimento; producto: string; cantidad: string | null }): FilaIngrediente {
  const conocido = buscarProducto(i.producto);
  return conocido
    ? { categoria: conocido.categoria, producto: conocido.producto.nombre, otro: "", cantidad: i.cantidad ?? "" }
    : { categoria: i.categoria, producto: OTRO, otro: i.producto, cantidad: i.cantidad ?? "" };
}

export const filaVacia = (): FilaIngrediente => ({ categoria: "", producto: "", otro: "", cantidad: "" });

export function valoresVacios(): ValoresReceta {
  return { titulo: "", descripcion: "", edadMeses: "", minutos: "", raciones: "", ingredientes: [filaVacia(), filaVacia(), filaVacia()], pasos: "", notas: "" };
}

export function valoresDe(r: RecetaCompleta): ValoresReceta {
  return {
    titulo: r.titulo,
    descripcion: r.descripcion ?? "",
    edadMeses: r.edadMeses?.toString() ?? "",
    minutos: r.minutos?.toString() ?? "",
    raciones: r.raciones ?? "",
    ingredientes: [...r.ingredientes.map(filaDe), filaVacia()],
    pasos: pasosDe(r).join("\n"),
    notas: r.notas ?? "",
  };
}

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

/** Lee el formulario de receta: los ingredientes llegan como campos repetidos alineados por posición. */
export function leerFormReceta(form: FormData): { valores: ValoresReceta; datos?: DatosReceta; errores: Errores } {
  const categorias = form.getAll("ing_categoria").map(String);
  const productos = form.getAll("ing_producto").map(String);
  const otros = form.getAll("ing_otro").map(String);
  const cantidades = form.getAll("ing_cantidad").map(String);

  const filas: FilaIngrediente[] = productos.map((producto, i) => {
    const categoria = categorias[i] ?? "";
    return {
      categoria: esCategoria(categoria) ? categoria : "",
      producto: producto.trim(),
      otro: (otros[i] ?? "").trim(),
      cantidad: (cantidades[i] ?? "").trim(),
    };
  });

  const valores: ValoresReceta = {
    titulo: s(form, "titulo"),
    descripcion: s(form, "descripcion"),
    edadMeses: s(form, "edad_meses"),
    minutos: s(form, "minutos"),
    raciones: s(form, "raciones"),
    ingredientes: filas.filter((f) => f.producto || f.otro || f.cantidad),
    pasos: String(form.get("pasos") ?? "").trim(),
    notas: s(form, "notas"),
  };
  if (valores.ingredientes.length === 0) valores.ingredientes = [filaVacia()];

  const { datos, errores } = validarReceta({
    titulo: valores.titulo,
    descripcion: valores.descripcion,
    edadMeses: valores.edadMeses,
    minutos: valores.minutos,
    raciones: valores.raciones,
    ingredientes: valores.ingredientes.map((f) => ({ categoria: f.categoria, producto: f.producto === OTRO ? f.otro : f.producto, cantidad: f.cantidad })),
    pasos: valores.pasos.split("\n"),
    notas: valores.notas,
  });
  if (valores.ingredientes.some((f) => f.producto === OTRO && !f.otro)) errores.ingredientes = "Escribe el nombre del ingrediente que has marcado como «Otro».";
  if (errores.ingredientes) return { valores, errores };
  return { valores, datos, errores };
}
