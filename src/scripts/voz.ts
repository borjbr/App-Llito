/**
 * Dictado por voz con la Web Speech API del navegador (sin servidor ni coste).
 * Funciona en Chrome/Edge (Android y escritorio) y Safari (iPhone/iPad).
 * Donde no existe, el botón se oculta y el chat sigue igual.
 *
 * Uso: activarVoz(boton, { alTexto: (t) => enviar(t) })
 *  - Un toque empieza a escuchar; se para solo al terminar la frase
 *    (o con otro toque). Al parar, llama a alTexto con lo dictado.
 */

type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
};

const Ctor: (new () => Reconocimiento) | undefined =
  (globalThis as unknown as { SpeechRecognition?: new () => Reconocimiento }).SpeechRecognition ??
  (globalThis as unknown as { webkitSpeechRecognition?: new () => Reconocimiento }).webkitSpeechRecognition;

export const hayVoz = () => Boolean(Ctor) && (location.protocol === "https:" || location.hostname === "localhost");

export function activarVoz(
  boton: HTMLButtonElement,
  opciones: {
    alTexto: (texto: string) => void;
    /** Texto provisional mientras habla (para enseñarlo en el campo) */
    alParcial?: (texto: string) => void;
    alEstado?: (estado: "escuchando" | "parado" | "error", detalle?: string) => void;
  },
) {
  if (!hayVoz() || !Ctor) {
    boton.hidden = true;
    return;
  }
  const rec = new Ctor();
  rec.lang = "es-ES";
  rec.continuous = false; // se para al terminar la frase
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let escuchando = false;
  let final = "";
  let error = "";

  const estado = (e: "escuchando" | "parado" | "error", d?: string) => {
    boton.setAttribute("aria-pressed", String(e === "escuchando"));
    boton.classList.toggle("escuchando", e === "escuchando");
    boton.setAttribute("aria-label", e === "escuchando" ? "Parar y enviar" : "Dictar por voz");
    opciones.alEstado?.(e, d);
  };

  rec.onstart = () => {
    escuchando = true;
    final = "";
    error = "";
    estado("escuchando");
  };
  rec.onresult = (e) => {
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else parcial += r[0].transcript;
    }
    opciones.alParcial?.((final + parcial).trim());
  };
  rec.onerror = (e) => {
    error = e.error;
  };
  rec.onend = () => {
    escuchando = false;
    const texto = final.trim();
    if (error === "not-allowed" || error === "service-not-allowed") {
      estado("error", "No tengo permiso para usar el micrófono. Actívalo en los ajustes del navegador.");
    } else if (texto) {
      estado("parado");
      opciones.alTexto(texto);
    } else {
      estado("error", error === "no-speech" || !error ? "No he oído nada. Prueba otra vez." : "No se ha podido reconocer la voz.");
    }
  };

  boton.addEventListener("click", () => {
    if (escuchando) {
      rec.stop();
      return;
    }
    try {
      rec.start();
    } catch {
      /* ya estaba arrancando */
    }
  });
}
