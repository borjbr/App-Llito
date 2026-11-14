import type { APIRoute } from "astro";
import { contextoGaleria, medioDelHogar } from "@/lib/galeria";
import { rango, TROZO } from "@/lib/drive";

/**
 * El archivo original por rangos (para el reproductor de vídeo). Cada respuesta
 * lleva como mucho un trozo; el navegador pide el siguiente cuando lo necesita.
 */
export const GET: APIRoute = async ({ request, params, locals }) => {
  const ctx = await contextoGaleria(locals, { carpeta: false });
  if (ctx instanceof Response) return ctx;
  const m = await medioDelHogar(ctx.hogarId, params.id!);
  if (!m) return new Response("No encontrado", { status: 404 });

  const pedido = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get("range") ?? "");
  const desde = pedido ? Number(pedido[1]) : 0;
  if (desde >= m.tamano) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${m.tamano}` } });
  const fin = pedido?.[2] ? Number(pedido[2]) : m.tamano - 1;
  const hasta = Math.min(fin, desde + TROZO - 1, m.tamano - 1);

  try {
    const res = await rango(ctx.conexion, m.driveId, desde, hasta);
    if (!res.ok) return new Response("No disponible", { status: 502 });
    const datos = await res.arrayBuffer();
    return new Response(datos, {
      status: 206,
      headers: {
        "Content-Type": m.mime,
        "Content-Length": String(datos.byteLength),
        "Content-Range": `bytes ${desde}-${desde + datos.byteLength - 1}/${m.tamano}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[galería] archivo", e);
    return new Response("No disponible", { status: 502 });
  }
};
