import { z } from "zod";
import { EMOJIS_AVATAR } from "./avatares";

export type Errores = Record<string, string>;

const texto = (vacio: string, campo: string, max = 80) =>
  z
    .string()
    .trim()
    .min(1, vacio)
    .max(max, `${campo} puede tener como mucho ${max} caracteres.`);

export const perfilSchema = z.object({
  nombre: texto("Escribe tu nombre.", "El nombre", 60),
  apellidos: texto("Escribe tus apellidos.", "Los apellidos", 80),
  email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido, por ejemplo nombre@correo.com.")),
  avatar: z.string().refine((v) => EMOJIS_AVATAR.includes(v), "Elige un avatar."),
  edad: z.coerce
    .number({ message: "Escribe tu edad en números." })
    .int("Escribe tu edad en años, sin decimales.")
    .min(14, "La edad mínima es 14 años.")
    .max(120, "Revisa la edad: parece demasiado alta."),
});

export const registroSchema = perfilSchema.extend({
  password: z.string().min(8, "La contraseña necesita al menos 8 caracteres.").max(128),
});

export type HijoForm = { id?: string; nombre: string };

/**
 * Lee la lista de hijos del formulario: campos repetidos `hijo_nombre`
 * (y `hijo_id` para los que ya existen), más `tiene_hijos` = "si" | "no".
 */
export function leerHijos(form: FormData): { hijos: HijoForm[]; error?: string } {
  if (form.get("tiene_hijos") !== "si") return { hijos: [] };
  const nombres = form.getAll("hijo_nombre").map((v) => String(v).trim());
  const ids = form.getAll("hijo_id").map((v) => String(v));
  const hijos = nombres
    .map((nombre, i) => ({ id: ids[i] || undefined, nombre }))
    .filter((h) => h.nombre.length > 0);
  if (hijos.length === 0) return { hijos, error: "Escribe el nombre de al menos un hijo o hija, o marca «No»." };
  if (hijos.some((h) => h.nombre.length > 60)) return { hijos, error: "Cada nombre puede tener como mucho 60 caracteres." };
  if (hijos.length > 12) return { hijos, error: "Puedes añadir como máximo 12 hijos." };
  return { hijos };
}

/** Convierte los errores de Zod en { campo: mensaje } (el primero de cada campo). */
export function aErrores(error: z.ZodError): Errores {
  const salida: Errores = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? "general");
    salida[campo] ??= issue.message;
  }
  return salida;
}
