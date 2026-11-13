import { activarVoz } from "./voz";
/**
 * Cliente del chat de Kissbell: envía el mensaje, lee el stream del AI SDK y
 * pinta texto y tarjetas de receta a medida que llegan.
 */
import type { UIMessage, UIMessageChunk } from "ai";
import { markdownSeguro } from "@/lib/markdown";

type Ingrediente = { emoji: string; producto: string; cantidad: string | null };
type RecetaChat = {
  id: string;
  titulo: string;
  descripcion: string | null;
  edad: string | null;
  minutos: number | null;
  raciones: string | null;
  ingredientes: Ingrediente[];
  pasos: string[];
  notas: string | null;
  avisos: string[];
  url: string;
  estado?: "creada" | "actualizada";
};
type Parte = UIMessage["parts"][number];
type ParteHerramienta = { type: string; state: string; output?: Record<string, unknown> & { error?: string } };

/* ── DOM ──────────────────────────────────────────────────────────────── */

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...hijos: (Node | string | null | false)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const hijo of hijos) if (hijo) el.append(hijo);
  return el;
}

const escribiendo = () => h("div", { class: "escribiendo", "aria-hidden": "true" }, h("span"), h("span"), h("span"));
const trabajando = (texto: string) => h("p", { class: "trabajando" }, h("span", { class: "trabajando-punto", "aria-hidden": "true" }), texto);

function tarjetaReceta(r: RecetaChat, origen: "mostrar" | "guardar"): HTMLElement {
  const etiqueta = origen === "mostrar" ? "Del recetario" : r.estado === "actualizada" ? "Actualizada en el recetario" : "Guardada en el recetario";
  const emojis = [...new Set(r.ingredientes.map((i) => i.emoji))].slice(0, 4).join("");
  const meta = [r.edad && `👶 ${r.edad}`, r.minutos && `⏱️ ${r.minutos} min`, r.raciones && `🍽️ ${r.raciones}`].filter(Boolean) as string[];

  return h(
    "article",
    { class: "tarjeta-receta", "aria-label": `Receta: ${r.titulo}` },
    h(
      "header",
      { class: "tr-cabecera" },
      h("span", { class: "tr-emojis", "aria-hidden": "true" }, emojis || "🥣"),
      h(
        "div",
        { class: "tr-titulos" },
        h("p", { class: "tr-etiqueta" }, origen === "guardar" ? "✓ " : "", etiqueta),
        h("h3", { class: "tr-titulo" }, r.titulo),
        r.descripcion ? h("p", { class: "tr-descripcion" }, r.descripcion) : null,
      ),
    ),
    meta.length ? h("ul", { class: "tr-meta" }, ...meta.map((m) => h("li", {}, m))) : null,
    h("h4", {}, "Ingredientes"),
    h(
      "ul",
      { class: "tr-ingredientes" },
      ...r.ingredientes.map((i) =>
        h("li", {}, h("span", { "aria-hidden": "true" }, i.emoji), h("span", { class: "tr-producto" }, i.producto), i.cantidad ? h("span", { class: "tr-cantidad" }, i.cantidad) : null),
      ),
    ),
    h("h4", {}, "Preparación"),
    h("ol", { class: "tr-pasos" }, ...r.pasos.map((p) => h("li", {}, p))),
    r.avisos.length ? h("div", { class: "tr-aviso" }, h("p", {}, h("strong", {}, "⚠️ Para bebés: ")), h("ul", {}, ...r.avisos.map((a) => h("li", {}, a)))) : null,
    r.notas ? h("p", { class: "tr-notas" }, h("strong", {}, "Notas: "), r.notas) : null,
    h("a", { class: "tr-enlace", href: r.url }, "Abrir en el recetario ", h("span", { "aria-hidden": "true" }, "→")),
  );
}

/** Pinta una parte del mensaje. Devuelve null si no se muestra. */
function pintarParte(p: Parte): HTMLElement | null {
  if (p.type === "text") {
    if (!p.text.trim()) return null;
    const div = h("div", { class: "texto" });
    div.innerHTML = markdownSeguro(p.text);
    return div;
  }
  if (!p.type.startsWith("tool-")) return null;
  const t = p as unknown as ParteHerramienta;
  const nombre = t.type.slice(5);
  const listo = t.state === "output-available";
  const out = t.output;

  if (nombre === "mostrar_receta" || nombre === "guardar_receta") {
    if (!listo) return t.state === "output-error" ? null : trabajando(nombre === "mostrar_receta" ? "Buscando la receta…" : "Preparando la receta…");
    if (!out || out.error) return null; // el modelo explica el problema en el texto
    return tarjetaReceta(out as unknown as RecetaChat, nombre === "mostrar_receta" ? "mostrar" : "guardar");
  }
  if (nombre === "recordar" || nombre === "olvidar") {
    if (!listo || !out || out.error) return null;
    return h("p", { class: "nota-memoria" }, h("span", { "aria-hidden": "true" }, "🧠 "), nombre === "recordar" ? "Lo recordaré: " : "Olvidado: ", h("span", {}, String(out.texto ?? "")));
  }
  if (nombre === "anadir_a_la_compra") {
    if (!listo) return trabajando("Apuntando en la lista de la compra…");
    const anadidos = (out?.anadidos as string[] | undefined) ?? [];
    if (!anadidos.length) return null;
    const nota = h("a", { class: "nota-memoria", href: "/hogar/compra" }, h("span", { "aria-hidden": "true" }, "🛒 "), "Apuntado en la compra: ", h("span", {}, anadidos.join(", ")));
    return nota;
  }
  if (nombre === "ver_lista_compra") return listo ? null : trabajando("Mirando la lista de la compra…");
  if (nombre === "buscar_recetas") return listo ? null : trabajando("Buscando en el recetario…");
  return null;
}

/** Texto plano de un mensaje, para anunciarlo a los lectores de pantalla */
function textoPlano(m: UIMessage): string {
  const trozos: string[] = [];
  for (const p of m.parts) {
    if (p.type === "text") trozos.push(p.text.replace(/[*_`#>]/g, ""));
    const t = p as unknown as ParteHerramienta;
    if ((t.type === "tool-mostrar_receta" || t.type === "tool-guardar_receta") && t.output && !t.output.error) trozos.push(`Receta: ${t.output.titulo}.`);
  }
  return trozos.join(" ").replace(/\s+/g, " ").trim();
}

/* ── Stream ───────────────────────────────────────────────────────────── */

/** Convierte la respuesta SSE del AI SDK en un stream de chunks */
function chunksDe(cuerpo: ReadableStream<Uint8Array>, alError: (texto: string) => void): ReadableStream<UIMessageChunk> {
  let resto = "";
  return cuerpo.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).pipeThrough(
    new TransformStream<string, UIMessageChunk>({
      transform(trozo, control) {
        resto += trozo;
        const eventos = resto.split(/\r?\n\r?\n/);
        resto = eventos.pop() ?? "";
        for (const evento of eventos) {
          const datos = evento
            .split(/\r?\n/)
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trimStart())
            .join("\n");
          if (!datos || datos === "[DONE]") continue;
          try {
            const chunk = JSON.parse(datos) as UIMessageChunk;
            if (chunk.type === "error") alError(chunk.errorText);
            else control.enqueue(chunk);
          } catch {
            /* evento incompleto o desconocido: se ignora */
          }
        }
      },
    }),
  );
}

/**
 * Acumula los chunks en un mensaje (equivalente ligero a readUIMessageStream
 * del AI SDK, sin su validación, para no cargar ~150 KB en el móvil).
 */
async function* mensajesDe(chunks: ReadableStream<UIMessageChunk>): AsyncGenerator<UIMessage> {
  type ParteLibre = Record<string, unknown> & { type: string };
  const partes: ParteLibre[] = [];
  const textos = new Map<string, ParteLibre>();
  const herramientas = new Map<string, ParteLibre>();
  const herramienta = (toolCallId: string, toolName?: string) => {
    let p = herramientas.get(toolCallId);
    if (!p) {
      p = { type: `tool-${toolName ?? "desconocida"}`, toolCallId, state: "input-streaming" };
      herramientas.set(toolCallId, p);
      partes.push(p);
    }
    return p;
  };
  const lector = chunks.getReader();
  for (;;) {
    const { done, value: c } = await lector.read();
    if (done) return;
    switch (c.type) {
      case "start-step":
        partes.push({ type: "step-start" });
        break;
      case "text-start": {
        const p = { type: "text", text: "", state: "streaming" };
        textos.set(c.id, p);
        partes.push(p);
        break;
      }
      case "text-delta": {
        const p = textos.get(c.id);
        if (p) p.text = `${p.text}${c.delta}`;
        break;
      }
      case "text-end": {
        const p = textos.get(c.id);
        if (p) p.state = "done";
        break;
      }
      case "tool-input-start":
        herramienta(c.toolCallId, c.toolName);
        break;
      case "tool-input-available":
        Object.assign(herramienta(c.toolCallId, c.toolName), { state: "input-available", input: c.input });
        break;
      case "tool-input-error":
        Object.assign(herramienta(c.toolCallId, c.toolName), { state: "output-error", input: c.input, errorText: c.errorText });
        break;
      case "tool-output-available":
        Object.assign(herramienta(c.toolCallId), { state: "output-available", output: c.output });
        break;
      case "tool-output-error":
        Object.assign(herramienta(c.toolCallId), { state: "output-error", errorText: c.errorText });
        break;
      default:
        continue; // start, finish, reasoning…: no cambian lo que se ve
    }
    yield { id: "", role: "assistant", parts: partes.map((p) => ({ ...p })) as unknown as UIMessage["parts"] };
  }
}

/* ── Chat ─────────────────────────────────────────────────────────────── */

export function iniciarChat(raiz: HTMLElement) {
  const lista = raiz.querySelector<HTMLOListElement>("[data-mensajes]")!;
  const form = raiz.querySelector<HTMLFormElement>("[data-composer]");
  const campo = raiz.querySelector<HTMLTextAreaElement>("[data-campo]");
  const enviarBtn = raiz.querySelector<HTMLButtonElement>("[data-enviar]");
  const estado = raiz.querySelector<HTMLElement>("[data-estado]")!;
  const bienvenida = raiz.querySelector<HTMLElement>("[data-bienvenida]");
  const historial: UIMessage[] = JSON.parse(document.getElementById("datos-chat")?.textContent ?? "[]");
  const tactil = matchMedia("(pointer: coarse)").matches;
  let ocupado = false;

  const cercaDelFinal = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
  const alFinal = (suave = true) =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: suave && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });

  function anunciar(texto: string) {
    estado.textContent = "";
    // Pequeña espera para que el lector de pantalla detecte el cambio
    setTimeout(() => (estado.textContent = texto), 50);
  }

  function burbujaUsuario(texto: string) {
    const li = h("li", { class: "msg msg-usuario" }, h("h2", { class: "sr-only" }, "Tú:"), h("div", { class: "burbuja" }, texto));
    lista.append(li);
  }

  function burbujaLlito() {
    const contenido = h("div", { class: "contenido" });
    const li = h("li", { class: "msg msg-llito" }, h("span", { class: "avatar-llito", "aria-hidden": "true" }, "✨"), h("h2", { class: "sr-only" }, "Kissbell:"), contenido);
    lista.append(li);
    return contenido;
  }

  // Caché por parte para no rehacer las tarjetas en cada trozo de texto
  const cache = new WeakMap<HTMLElement, Map<number, { clave: string; nodo: HTMLElement | null }>>();
  function pintarMensaje(contenido: HTMLElement, m: UIMessage, enCurso: boolean) {
    const previa = cache.get(contenido) ?? new Map();
    const nueva = new Map<number, { clave: string; nodo: HTMLElement | null }>();
    const nodos: HTMLElement[] = [];
    m.parts.forEach((p, i) => {
      const t = p as unknown as ParteHerramienta & { text?: string };
      const clave = p.type === "text" ? `text:${t.text?.length}` : `${p.type}:${t.state}`;
      const antes = previa.get(i);
      const nodo = antes && antes.clave === clave ? antes.nodo : pintarParte(p);
      nueva.set(i, { clave, nodo });
      if (nodo) nodos.push(nodo);
    });
    cache.set(contenido, nueva);
    if (enCurso && !nodos.some((n) => n.classList.contains("trabajando")) && m.parts[m.parts.length - 1]?.type !== "text") nodos.push(escribiendo());
    if (!enCurso && nodos.length === 0) nodos.push(h("p", { class: "texto hint" }, "(Sin respuesta)"));
    contenido.replaceChildren(...nodos);
  }

  function pintarError(contenido: HTMLElement, texto: string) {
    contenido.append(h("p", { class: "error-chat", role: "alert" }, texto));
  }

  // Historial
  for (const m of historial) {
    if (m.role === "user") burbujaUsuario(m.parts.map((p) => (p.type === "text" ? p.text : "")).join(""));
    else pintarMensaje(burbujaLlito(), m, false);
  }
  if (historial.length) alFinal(false);

  if (!form || !campo || !enviarBtn) return; // asistente sin configurar

  const ajustarAltura = () => {
    campo.style.height = "auto";
    campo.style.height = `${Math.min(campo.scrollHeight, 200)}px`;
  };
  const actualizarBoton = () => (enviarBtn.disabled = ocupado || !campo.value.trim());
  campo.addEventListener("input", () => {
    ajustarAltura();
    actualizarBoton();
  });
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !tactil) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    enviar(campo.value);
  });
  // Dictado por voz: al terminar de hablar se envía solo
  const vozBtn = raiz.querySelector<HTMLButtonElement>("[data-voz]");
  if (vozBtn) {
    activarVoz(vozBtn, {
      alParcial: (t) => {
        campo!.value = t;
        ajustarAltura();
      },
      alTexto: (t) => enviar(t),
      alEstado: (e, detalle) => {
        campo!.placeholder = e === "escuchando" ? "Te escucho…" : "Pregúntale lo que quieras…";
        if (e === "error" && detalle) {
          campo!.value = "";
          anunciar(detalle);
          // Aviso breve debajo del campo, sin ensuciar la conversación
          const aviso = h("p", { class: "voz-aviso", role: "alert" }, detalle);
          form!.insertAdjacentElement("afterend", aviso);
          setTimeout(() => aviso.remove(), 6000);
        }
        if (e !== "escuchando") actualizarBoton();
      },
    });
  }

  raiz.addEventListener("click", (e) => {
    const boton = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-sugerencia]");
    if (boton) enviar(boton.dataset.sugerencia ?? boton.textContent ?? "");
  });

  async function enviar(texto: string) {
    texto = texto.trim();
    if (!texto || ocupado) return;
    ocupado = true;
    campo!.value = "";
    ajustarAltura();
    actualizarBoton();
    bienvenida?.remove();
    burbujaUsuario(texto);
    const contenido = burbujaLlito();
    contenido.append(escribiendo());
    alFinal();
    anunciar("Kissbell está escribiendo…");

    let ultimo: UIMessage | null = null;
    let errorStream = "";
    let pendiente = false;
    const programar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        if (!ultimo) return;
        const seguir = cercaDelFinal();
        pintarMensaje(contenido, ultimo, true);
        if (seguir) alFinal(false);
      });
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: crypto.randomUUID(), texto }),
      });
      if (!res.ok || !res.body || !res.headers.get("content-type")?.includes("text/event-stream")) {
        let mensaje = res.redirected || res.status === 401 ? "Tu sesión ha caducado. Vuelve a iniciar sesión." : "No he podido responder. Inténtalo de nuevo.";
        try {
          mensaje = (await res.json()).error ?? mensaje;
        } catch {
          /* respuesta sin JSON */
        }
        contenido.replaceChildren();
        pintarError(contenido, mensaje);
        campo!.value = texto; // para que no tenga que volver a escribirlo
        anunciar(mensaje);
        return;
      }

      for await (const m of mensajesDe(chunksDe(res.body, (t) => (errorStream = t)))) {
        ultimo = m;
        programar();
      }
      if (ultimo) pintarMensaje(contenido, ultimo, false);
      else contenido.replaceChildren();
      if (errorStream) pintarError(contenido, errorStream);
      anunciar(errorStream || `Kissbell: ${ultimo ? textoPlano(ultimo) : ""}`);
    } catch {
      if (ultimo) pintarMensaje(contenido, ultimo, false);
      else contenido.replaceChildren();
      pintarError(contenido, "Se ha cortado la conexión. Revisa tu internet e inténtalo de nuevo.");
      anunciar("Se ha cortado la conexión.");
    } finally {
      ocupado = false;
      actualizarBoton();
      if (cercaDelFinal()) alFinal();
      if (!tactil) campo!.focus();
    }
  }

  // Pregunta que llega desde la tarjeta de Inicio u otra página (?q=…)
  const url = new URL(location.href);
  const q = url.searchParams.get("q");
  if (q) {
    url.searchParams.delete("q");
    history.replaceState(null, "", url.pathname + url.search);
    if (q.trim().endsWith(":")) {
      // Pregunta a medio escribir (por ejemplo «Sobre la receta X: »): se deja en el campo
      campo.value = q;
      ajustarAltura();
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    } else {
      enviar(q);
    }
  }
  actualizarBoton();
}
