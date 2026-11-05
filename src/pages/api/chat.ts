/**
 * Chat con Llito. Recibe solo el mensaje nuevo: el historial se lee de la base
 * de datos, así nadie puede inyectar respuestas falsas desde el navegador.
 * Responde con el stream de mensajes del AI SDK (texto + tarjetas de herramientas).
 */
import type { APIRoute } from "astro";
import { APICallError, convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { ASISTENTE_LIMITE_DIARIO, OPENAI_API_KEY, OPENAI_MODEL } from "astro:env/server";
import { contextoHogar, guardarMensaje, herramientas, historialDe, instrucciones, MAX_MENSAJE, mensajesHoy } from "@/lib/asistente";

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const entrada = z.object({
  id: z.uuid("Petición no válida."),
  texto: z.string().trim().min(1, "Escribe un mensaje.").max(MAX_MENSAJE, `El mensaje puede tener como mucho ${MAX_MENSAJE} caracteres.`),
});

function mensajeDeError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401) return "La clave de OpenAI no es válida. Revisa OPENAI_API_KEY en Vercel.";
    if (error.statusCode === 429) return "OpenAI ha rechazado la petición por límite de uso o falta de saldo. Revisa la facturación de tu cuenta de OpenAI.";
    if (error.statusCode === 404) return "El modelo configurado no existe o tu cuenta no tiene acceso. Revisa OPENAI_MODEL.";
  }
  return "No he podido responder. Inténtalo de nuevo en un momento.";
}

export const POST: APIRoute = async ({ request, locals, url }) => {
  const usuario = locals.user;
  const hogar = locals.hogar;
  if (!usuario || !hogar) return json({ error: "Inicia sesión para hablar con Llito." }, 401);
  // JSON no pasa por la comprobación de origen de Astro (solo mira formularios): se comprueba aquí
  if (request.headers.get("origin") !== url.origin) return json({ error: "Origen no permitido." }, 403);
  if (!OPENAI_API_KEY) return json({ error: "El asistente todavía no está configurado: falta la variable OPENAI_API_KEY." }, 503);

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ error: "Petición no válida." }, 400);
  }
  const leido = entrada.safeParse(cuerpo);
  if (!leido.success) return json({ error: leido.error.issues[0]?.message ?? "Petición no válida." }, 400);
  const { id, texto } = leido.data;

  if ((await mensajesHoy(hogar.id)) >= ASISTENTE_LIMITE_DIARIO) {
    return json({ error: `Habéis llegado al límite de ${ASISTENTE_LIMITE_DIARIO} mensajes en 24 horas. Vuelve a intentarlo más tarde.` }, 429);
  }

  const [historial, contexto] = await Promise.all([historialDe(usuario.id), contextoHogar(hogar.id)]);
  const mensajeUsuario: UIMessage = { id, role: "user", parts: [{ type: "text", text: texto }] };
  await guardarMensaje({ id, hogarId: hogar.id, userId: usuario.id, rol: "user", partes: mensajeUsuario.parts });
  const mensajes = [...historial.filter((m) => m.id !== id), mensajeUsuario];

  const tools = herramientas({ hogarId: hogar.id, userId: usuario.id });
  const openai = createOpenAI({ apiKey: OPENAI_API_KEY });

  const resultado = streamText({
    model: openai(OPENAI_MODEL),
    instructions: instrucciones({ ...contexto, usuario, hogarNombre: hogar.nombre }),
    messages: await convertToModelMessages(mensajes, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: stepCountIs(6),
    maxOutputTokens: 4000,
    // store: false → OpenAI no conserva la conversación; el historial vive en nuestra BD
    providerOptions: { openai: { reasoningEffort: "low", store: false } },
  });

  return resultado.toUIMessageStreamResponse({
    originalMessages: mensajes,
    generateMessageId: () => crypto.randomUUID(),
    sendReasoning: false,
    onEnd: async ({ responseMessage }) => {
      if (responseMessage.parts.some((p) => p.type !== "step-start")) {
        await guardarMensaje({ id: responseMessage.id, hogarId: hogar.id, userId: usuario.id, rol: "assistant", partes: responseMessage.parts });
      }
    },
    onError: (error) => {
      console.error("[asistente]", error);
      return mensajeDeError(error);
    },
  });
};
