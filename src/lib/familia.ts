import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { hijo, hogar, miembroHogar, user, type Hogar } from "@/db/schema";

/* ── Códigos de invitación ─────────────────────────────────────────────── */

// Sin 0/O ni 1/I/L para que se pueda dictar por teléfono sin confusiones
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generarCodigo(longitud = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(longitud));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

/** "abcd-2345 " → "ABCD2345" */
export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "ABCD2345" → "ABCD-2345" (más fácil de leer) */
export function formatearCodigo(codigo: string): string {
  return codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo;
}

/* ── Hogar ────────────────────────────────────────────────────────────── */

export type HogarConRol = Hogar & { rol: "admin" | "miembro" };

export async function hogarDe(userId: string): Promise<HogarConRol | undefined> {
  const fila = await db
    .select({ hogar, rol: miembroHogar.rol })
    .from(miembroHogar)
    .innerJoin(hogar, eq(hogar.id, miembroHogar.hogarId))
    .where(eq(miembroHogar.userId, userId))
    .get();
  return fila ? { ...fila.hogar, rol: fila.rol } : undefined;
}

export async function crearHogar(userId: string, nombre: string): Promise<HogarConRol> {
  const nuevo: Hogar = {
    id: crypto.randomUUID(),
    nombre,
    codigoInvitacion: generarCodigo(),
    creadoPor: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.batch([
    db.insert(hogar).values(nuevo),
    db.insert(miembroHogar).values({ hogarId: nuevo.id, userId, rol: "admin" }),
  ]);
  return { ...nuevo, rol: "admin" };
}

/** Devuelve el hogar del usuario y lo crea si todavía no tiene. */
export async function asegurarHogar(u: { id: string; apellidos?: string | null }): Promise<HogarConRol> {
  return (await hogarDe(u.id)) ?? crearHogar(u.id, nombreHogarPorDefecto(u.apellidos));
}

export function nombreHogarPorDefecto(apellidos?: string | null): string {
  const primero = apellidos?.trim().split(/\s+/)[0];
  return primero ? `Familia ${primero}` : "Mi familia";
}

export function buscarHogarPorCodigo(codigo: string) {
  return db.select().from(hogar).where(eq(hogar.codigoInvitacion, normalizarCodigo(codigo))).get();
}

export function miembrosDe(hogarId: string) {
  return db
    .select({ id: user.id, nombre: user.name, apellidos: user.apellidos, avatar: user.avatar, rol: miembroHogar.rol })
    .from(miembroHogar)
    .innerJoin(user, eq(user.id, miembroHogar.userId))
    .where(eq(miembroHogar.hogarId, hogarId))
    .orderBy(asc(miembroHogar.createdAt));
}

export async function regenerarCodigo(hogarId: string): Promise<string> {
  const codigo = generarCodigo();
  await db.update(hogar).set({ codigoInvitacion: codigo, updatedAt: new Date() }).where(eq(hogar.id, hogarId));
  return codigo;
}

/**
 * Qué pasaría si el usuario deja su hogar actual: si es la única persona,
 * el hogar y sus hijos se borran.
 */
export async function efectoDeSalir(userId: string) {
  const actual = await hogarDe(userId);
  if (!actual) return { borraHogar: false, hijos: [] as string[] };
  const otros = await db
    .select({ userId: miembroHogar.userId })
    .from(miembroHogar)
    .where(and(eq(miembroHogar.hogarId, actual.id), ne(miembroHogar.userId, userId)));
  if (otros.length > 0) return { borraHogar: false, hijos: [] as string[] };
  const hijos = await hijosDe(actual.id);
  return { borraHogar: true, hijos: hijos.map((h) => h.nombre) };
}

/** Mueve al usuario al hogar de destino. */
export async function unirseAHogar(userId: string, destinoId: string): Promise<void> {
  const actual = await hogarDe(userId);
  if (actual?.id === destinoId) return;

  const pasos = [];
  if (actual) {
    const otros = await db
      .select({ userId: miembroHogar.userId })
      .from(miembroHogar)
      .where(and(eq(miembroHogar.hogarId, actual.id), ne(miembroHogar.userId, userId)))
      .orderBy(asc(miembroHogar.createdAt));

    if (otros.length === 0) {
      // Era la única persona: el hogar vacío se borra (y sus hijos, en cascada)
      pasos.push(db.delete(hogar).where(eq(hogar.id, actual.id)));
    } else {
      pasos.push(db.delete(miembroHogar).where(eq(miembroHogar.userId, userId)));
      if (actual.rol === "admin") {
        // Que el hogar no se quede sin administrador
        pasos.push(
          db
            .update(miembroHogar)
            .set({ rol: "admin" })
            .where(and(eq(miembroHogar.hogarId, actual.id), eq(miembroHogar.userId, otros[0].userId))),
        );
      }
    }
  }
  pasos.push(db.insert(miembroHogar).values({ hogarId: destinoId, userId, rol: "miembro" }));
  const [primero, ...resto] = pasos;
  await db.batch([primero, ...resto]);
}

/* ── Hijos ────────────────────────────────────────────────────────────── */

export function hijosDe(hogarId: string) {
  return db.select().from(hijo).where(eq(hijo.hogarId, hogarId)).orderBy(asc(hijo.orden), asc(hijo.createdAt));
}

/** "Carmen", "Carmen y Lucas", "Carmen, Lucas y Ana" */
export function listaNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
