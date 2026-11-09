/**
 * Kissbell, el asistente de la familia (Vercel AI SDK + OpenAI).
 *
 * Idea clave: lo que el asistente "recuerda" vive en la base de datos, no en
 * la conversación. Las recetas se guardan en el recetario y se muestran tal
 * cual (como tarjeta), así que pedir la misma receta dos veces devuelve
 * exactamente la misma. Los datos sueltos de la familia van a `memoria`.
 */
import { tool, type UIMessage } from "ai";
import { z } from "zod";
import { and, asc, count, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { CATEGORIAS_ALIMENTO, memoria, mensajeChat, productoCompra } from "@/db/schema";
import { hijosDe, miembrosDe } from "./familia";
import { fechaLarga, fechaMadrid } from "./fechas";
import { normalizar, textoEdad } from "./alimentos";
import { buscarReceta, guardarReceta, paraChat, recetasDe, validarReceta, type RecetaCompleta } from "./recetas";

export const MAX_HISTORIAL = 20;
export const MAX_MENSAJE = 2000;
const MAX_MEMORIAS = 100;
const MAX_RECETAS_EN_CONTEXTO = 80;

/* ── Contexto del hogar ───────────────────────────────────────────────── */

export async function contextoHogar(hogarId: string) {
  const [hijos, miembros, recetas, memorias] = await Promise.all([
    hijosDe(hogarId),
    miembrosDe(hogarId),
    recetasDe(hogarId),
    db.select().from(memoria).where(eq(memoria.hogarId, hogarId)).orderBy(asc(memoria.createdAt)),
  ]);
  return { hijos, miembros, recetas, memorias };
}

type Contexto = Awaited<ReturnType<typeof contextoHogar>> & {
  usuario: { name: string };
  hogarNombre: string;
};

const lineaReceta = (r: RecetaCompleta) => {
  const edad = textoEdad(r.edadMeses);
  const ingredientes = r.ingredientes.slice(0, 5).map((i) => i.producto.toLowerCase()).join(", ");
  return `- id: ${r.id} · ${r.titulo}${edad ? ` (${edad.toLowerCase()})` : ""} · ${ingredientes}`;
};

export function instrucciones(c: Contexto): string {
  const hoy = fechaMadrid();
  const recetas = c.recetas.slice(0, MAX_RECETAS_EN_CONTEXTO);
  const hijos = c.hijos.map((h) => h.nombre);
  const adultos = c.miembros.map((m) => m.nombre);

  return `Eres Kissbell, el asistente de la familia «${c.hogarNombre}» en la app App-Llito. Ayudas en el día a día de la pareja y en el cuidado de los hijos: recetas y alimentación, organización de casa, ideas y dudas cotidianas.

# Contexto
- Hoy es ${fechaLarga(hoy)} (${hoy}), hora de Madrid.
- Hablas con ${c.usuario.name}. Adultos del hogar: ${adultos.join(", ") || c.usuario.name}.
- Hijos: ${hijos.length ? hijos.join(", ") : "ninguno apuntado todavía"}.

# Recetas: el recetario es la fuente de verdad
Recetas guardadas (${c.recetas.length}${c.recetas.length > recetas.length ? `, se muestran las ${recetas.length} más recientes; usa buscar_recetas para el resto` : ""}):
${recetas.length ? recetas.map(lineaReceta).join("\n") : "(ninguna todavía)"}

Reglas:
1. Si piden una receta que ya está guardada, aunque la nombren de otra forma («crema de zanahoria y calabaza» = «puré de calabaza y zanahoria»), llama a mostrar_receta con su id. No la escribas ni la resumas: la app la enseña como tarjeta. Después añade como mucho una frase breve.
2. Si piden una receta nueva, créala y llama a guardar_receta (sin id). No escribas la receta en el texto: la tarjeta la muestra. Después, una frase breve (por ejemplo, que ya está en el recetario).
3. Si piden cambiar una receta guardada, llama a guardar_receta con su id y la receta completa ya modificada. No cambies nunca una receta guardada sin que te lo pidan.
4. Si solo quieren ideas o comparar opciones, contesta en texto y ofrece guardar la que elijan.
5. Cantidades en gramos, mililitros o unidades caseras. Pasos cortos y claros, un paso por elemento.

# Memoria de la familia
Datos que te han pedido recordar o que conviene recordar:
${c.memorias.length ? c.memorias.map((m) => `- id: ${m.id} · ${m.texto}`).join("\n") : "(nada todavía)"}

- Cuando te cuenten algo útil y duradero (edad del bebé, alimentos ya introducidos, alergias o intolerancias, gustos, nombre del pediatra, rutinas), guárdalo con recordar en una frase corta y autosuficiente.
- Si algo deja de ser cierto, llama a olvidar con el id antiguo y, si procede, recordar con el dato nuevo.
- Usa estos datos para personalizar respuestas y recetas (por ejemplo, evita alimentos que no le sientan bien).
- No guardes contraseñas, números de documentos ni datos bancarios.

# Lista de la compra
- La familia tiene una lista de la compra compartida en Hogar → Lista de la compra (/hogar/compra).
- Si piden apuntar algo («añade leche», «apunta lo que falta para esta receta»), usa anadir_a_la_compra. Para saber qué falta, ver_lista_compra.
- Después, confirma en una frase lo que has apuntado.

# Alimentación infantil
Para recetas de bebés sigue las pautas generales de la AEP y la AESAN:
- Antes de los 12 meses: sin sal ni azúcar añadidos, sin miel, sin leche de vaca como bebida (en recetas, en poca cantidad), sin espinacas ni acelgas.
- Frutos secos siempre molidos o en crema hasta los 5-6 años. Uvas, arándanos o tomates cherry cortados a lo largo. Nada duro, redondo o pequeño que pueda atragantar.
- Nada de pez espada, atún rojo, tiburón ni lucio en niños; atún claro con moderación.
- Alérgenos (huevo, pescado, frutos secos, gluten…) de uno en uno y en pequeña cantidad para ver la tolerancia.
- Indica la edad mínima en edadMeses si la receta es para bebés.
- No eres pediatra: ante fiebre, vómitos, reacciones alérgicas, dificultad para respirar o cualquier duda de salud, recomienda consultar con su pediatra y, en una urgencia, llamar al 112.

# Estilo
- Español de España, cercano y breve. Tutea.
- Markdown sencillo: negritas y listas cortas. Sin tablas ni encabezados grandes.
- Si no sabes algo, dilo. No inventes datos de la familia.`;
}

/* ── Herramientas ─────────────────────────────────────────────────────── */

const textoOpcional = (descripcion: string) => z.string().optional().describe(descripcion);

const esquemaReceta = z.object({
  id: textoOpcional("Solo para modificar una receta ya guardada: su id. Omitir al crear una nueva."),
  titulo: z.string().describe("Nombre corto y claro, por ejemplo «Puré de calabaza y zanahoria»"),
  descripcion: textoOpcional("Una frase que describa la receta"),
  edadMeses: z.number().int().optional().describe("Edad mínima recomendada en meses (6, 7, 8, 9, 12, 18 o 24). Omitir si es para toda la familia."),
  minutos: z.number().int().optional().describe("Tiempo total aproximado en minutos"),
  raciones: textoOpcional("Por ejemplo «4 tomas» o «2 adultos»"),
  ingredientes: z
    .array(
      z.object({
        categoria: z.enum(CATEGORIAS_ALIMENTO).describe("Tipo de alimento"),
        producto: z.string().describe("Nombre del ingrediente en singular, por ejemplo «Calabaza»"),
        cantidad: textoOpcional("Por ejemplo «200 g», «1 unidad», «1 cucharada»"),
      }),
    )
    .min(1),
  pasos: z.array(z.string()).min(1).describe("Pasos de la preparación, uno por elemento, sin numerar"),
  notas: textoOpcional("Consejos: conservación, variantes, texturas…"),
});

export function herramientas(ctx: { hogarId: string; userId: string }) {
  return {
    mostrar_receta: tool({
      description: "Muestra al usuario una receta guardada del recetario, exactamente como está guardada.",
      inputSchema: z.object({ id: z.string().describe("id de la receta guardada") }),
      execute: async ({ id }) => {
        const r = await buscarReceta(ctx.hogarId, id);
        return r ? paraChat(r) : { error: "No hay ninguna receta guardada con ese id." };
      },
    }),

    buscar_recetas: tool({
      description: "Busca en el recetario por nombre o ingrediente. Úsala si la receta no aparece en la lista de las más recientes.",
      inputSchema: z.object({ texto: z.string().describe("Nombre o ingrediente a buscar") }),
      execute: async ({ texto }) => {
        const termino = normalizar(texto);
        const recetas = (await recetasDe(ctx.hogarId))
          .filter((r) => normalizar(r.titulo).includes(termino) || r.ingredientes.some((i) => normalizar(i.producto).includes(termino)))
          .slice(0, 10);
        return { recetas: recetas.map((r) => ({ id: r.id, titulo: r.titulo, ingredientes: r.ingredientes.map((i) => i.producto) })) };
      },
    }),

    guardar_receta: tool({
      description: "Guarda una receta nueva en el recetario de la familia, o sustituye una existente si se indica su id. La app la muestra como tarjeta.",
      inputSchema: esquemaReceta,
      execute: async (entrada) => {
        const { datos, errores } = validarReceta(entrada);
        if (!datos) return { error: `La receta no es válida: ${Object.values(errores).join(" ")}` };
        const res = await guardarReceta(ctx.hogarId, ctx.userId, datos, { id: entrada.id, origen: "asistente" });
        if (!res.ok) {
          return {
            error: res.existenteId
              ? `${res.error} Su id es ${res.existenteId}: muéstrala con mostrar_receta o, si te han pedido cambiarla, usa ese id.`
              : res.error,
          };
        }
        return { ...paraChat(res.receta), estado: res.nueva ? ("creada" as const) : ("actualizada" as const) };
      },
    }),

    recordar: tool({
      description: "Guarda un dato duradero de la familia para tenerlo en cuenta en el futuro.",
      inputSchema: z.object({ texto: z.string().describe("El dato en una frase corta y autosuficiente, por ejemplo «Carmen ya ha probado la calabaza y le gusta»") }),
      execute: async ({ texto }) => {
        const limpio = texto.trim().slice(0, 300);
        if (!limpio) return { error: "El dato está vacío." };
        const [{ total }] = await db.select({ total: count() }).from(memoria).where(eq(memoria.hogarId, ctx.hogarId));
        if (total >= MAX_MEMORIAS) return { error: `La memoria está llena (${MAX_MEMORIAS} datos). Pide que borren alguno desde la página del asistente.` };
        const [fila] = await db.insert(memoria).values({ hogarId: ctx.hogarId, texto: limpio, creadoPor: ctx.userId }).returning();
        return { id: fila.id, texto: fila.texto };
      },
    }),

    ver_lista_compra: tool({
      description: "Devuelve los productos que faltan en la lista de la compra del hogar.",
      inputSchema: z.object({}),
      execute: async () => {
        const filas = await db
          .select({ nombre: productoCompra.nombre, cantidad: productoCompra.cantidad })
          .from(productoCompra)
          .where(and(eq(productoCompra.hogarId, ctx.hogarId), isNull(productoCompra.compradoEn)));
        return { productos: filas.map((f) => (f.cantidad ? `${f.nombre} (${f.cantidad})` : f.nombre)) };
      },
    }),

    anadir_a_la_compra: tool({
      description: "Apunta productos en la lista de la compra compartida del hogar. No duplica los que ya están.",
      inputSchema: z.object({
        productos: z
          .array(z.object({ nombre: z.string().describe("Producto, por ejemplo «Aceite de oliva»"), cantidad: textoOpcional("Por ejemplo «2 botellas»") }))
          .min(1)
          .max(30),
      }),
      execute: async ({ productos }) => {
        const yaEstan = new Set(
          (
            await db
              .select({ nombre: productoCompra.nombre })
              .from(productoCompra)
              .where(and(eq(productoCompra.hogarId, ctx.hogarId), isNull(productoCompra.compradoEn)))
          ).map((p) => normalizar(p.nombre)),
        );
        const ahora = new Date();
        const nuevos = productos
          .map((p) => ({ nombre: p.nombre.trim().slice(0, 80), cantidad: p.cantidad?.trim().slice(0, 40) || null }))
          .filter((p) => p.nombre && !yaEstan.has(normalizar(p.nombre)))
          .map((p) => ({ ...p, nombre: p.nombre.charAt(0).toUpperCase() + p.nombre.slice(1) }));
        if (nuevos.length) {
          await db.insert(productoCompra).values(nuevos.map((p) => ({ ...p, hogarId: ctx.hogarId, creadoPor: ctx.userId, createdAt: ahora, updatedAt: ahora })));
        }
        return { anadidos: nuevos.map((p) => p.nombre), yaEstaban: productos.length - nuevos.length };
      },
    }),

    olvidar: tool({
      description: "Borra un dato de la memoria de la familia que ya no es cierto o que piden olvidar.",
      inputSchema: z.object({ id: z.string().describe("id del dato a olvidar") }),
      execute: async ({ id }) => {
        const [borrado] = await db
          .delete(memoria)
          .where(and(eq(memoria.id, id), eq(memoria.hogarId, ctx.hogarId)))
          .returning();
        return borrado ? { texto: borrado.texto } : { error: "No hay ningún dato con ese id." };
      },
    }),
  };
}

/* ── Historial ────────────────────────────────────────────────────────── */

/** Últimos mensajes de la persona, en orden cronológico */
export async function historialDe(userId: string, limite = MAX_HISTORIAL): Promise<UIMessage[]> {
  const filas = await db
    .select()
    .from(mensajeChat)
    .where(eq(mensajeChat.userId, userId))
    .orderBy(desc(mensajeChat.createdAt), desc(mensajeChat.id))
    .limit(limite);
  return filas.reverse().map((f) => ({ id: f.id, role: f.rol, parts: JSON.parse(f.partes) }));
}

/**
 * Deja solo lo que hace falta guardar: sin razonamientos ni metadatos del
 * proveedor (así la conversación se puede reenviar sin depender de OpenAI).
 */
export function partesParaGuardar(partes: UIMessage["parts"]): UIMessage["parts"] {
  return partes
    .filter((p) => p.type !== "reasoning")
    .map((p) => {
      const { providerMetadata, callProviderMetadata, ...resto } = p as Record<string, unknown>;
      void providerMetadata;
      void callProviderMetadata;
      return resto as UIMessage["parts"][number];
    });
}

export async function guardarMensaje(m: { id: string; hogarId: string; userId: string; rol: "user" | "assistant"; partes: UIMessage["parts"] }) {
  await db
    .insert(mensajeChat)
    .values({
      id: m.id,
      hogarId: m.hogarId,
      userId: m.userId,
      rol: m.rol,
      partes: JSON.stringify(partesParaGuardar(m.partes)),
      // Con milisegundos: la pregunta y la respuesta suelen caer en el mismo segundo
      createdAt: new Date(),
    })
    .onConflictDoNothing();
}

/** Mensajes enviados por el hogar en las últimas 24 horas (para el límite diario) */
export async function mensajesHoy(hogarId: string): Promise<number> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ total }] = await db
    .select({ total: count() })
    .from(mensajeChat)
    .where(and(eq(mensajeChat.hogarId, hogarId), eq(mensajeChat.rol, "user"), gte(mensajeChat.createdAt, desde)));
  return total;
}
