import type { APIRoute } from "astro";
import { contextoGaleria, json } from "@/lib/galeria";
import { datosSelector, selectorConfigurado, tokenParaSelector } from "@/lib/drive";

/**
 * Datos para abrir el selector de carpetas de Google en el navegador.
 * Solo para quien conectó la cuenta: el token da acceso a su Google durante una hora.
 */
export const GET: APIRoute = async ({ locals }) => {
  const ctx = await contextoGaleria(locals, { carpeta: false });
  if (ctx instanceof Response) return ctx;
  if (ctx.conexion.userId !== ctx.userId) return json({ error: `Solo ${ctx.conexion.cuentaEmail} puede elegir la carpeta.` }, 403);
  if (!selectorConfigurado) return json({ error: "Falta configurar GOOGLE_API_KEY y GOOGLE_PROJECT_NUMBER." }, 503);
  return json({ token: await tokenParaSelector(ctx.conexion), ...datosSelector() });
};
