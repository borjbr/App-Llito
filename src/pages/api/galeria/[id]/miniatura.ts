import type { APIRoute } from "astro";
import { contextoGaleria, medioDelHogar } from "@/lib/galeria";
import { miniatura } from "@/lib/drive";

/** Miniatura (?lado=400) o foto grande (?lado=1600), redimensionada por Drive. */
export const GET: APIRoute = async ({ url, params, locals }) => {
  const ctx = await contextoGaleria(locals, { carpeta: false });
  if (ctx instanceof Response) return ctx;
  const m = await medioDelHogar(ctx.hogarId, params.id!);
  if (!m) return new Response("No encontrado", { status: 404 });
  const lado = Math.min(2000, Math.max(100, Number(url.searchParams.get("lado")) || 400));
  try {
    const res = await miniatura(ctx.conexion, m.driveId, lado);
    if (!res) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        // Privada: solo en el navegador de quien la ve
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    console.error("[galería] miniatura", e);
    return new Response("No disponible", { status: 502 });
  }
};
