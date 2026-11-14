/**
 * Subida de fotos y vídeos a la galería, de uno en uno y en trozos de 4 MB.
 * Comprueba en el móvil la duración de los vídeos antes de subir nada.
 */

type Limites = { imagenMB: number; videoMB: number; videoSegundos: number };

const fechaLocal = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Duración de un vídeo leyendo solo sus metadatos */
function duracionDe(archivo: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const url = URL.createObjectURL(archivo);
    const fin = (d: number | null) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onloadedmetadata = () => fin(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => fin(null);
    setTimeout(() => fin(null), 8000);
    v.src = url;
  });
}

function fila(archivo: File) {
  const li = document.createElement("li");
  li.className = "cola-fila";
  const vista = document.createElement(archivo.type.startsWith("video/") ? "video" : "img") as HTMLImageElement | HTMLVideoElement;
  vista.className = "cola-vista";
  vista.src = URL.createObjectURL(archivo);
  if (vista instanceof HTMLVideoElement) {
    vista.muted = true;
    vista.playsInline = true;
  } else vista.alt = "";
  const texto = document.createElement("div");
  texto.className = "cola-texto";
  const nombre = document.createElement("span");
  nombre.className = "cola-nombre";
  nombre.textContent = archivo.name;
  const estado = document.createElement("span");
  estado.className = "cola-estado";
  estado.textContent = "En espera…";
  const barra = document.createElement("progress");
  barra.max = 100;
  barra.value = 0;
  barra.setAttribute("aria-label", `Progreso de ${archivo.name}`);
  texto.append(nombre, barra, estado);
  li.append(vista, texto);
  return {
    li,
    progreso(p: number) {
      barra.value = p;
      estado.textContent = `Subiendo… ${p}%`;
    },
    estado(t: string, tipo: "ok" | "error" | "" = "") {
      estado.textContent = t;
      li.dataset.estado = tipo;
      if (tipo) barra.hidden = true;
    },
  };
}

async function subirUno(archivo: File, extra: { descripcion: string; hijoId: string; duracion: number | null }, alProgreso: (p: number) => void) {
  const r = await fetch("/api/galeria/subidas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: archivo.name,
      mime: archivo.type,
      tamano: archivo.size,
      duracion: extra.duracion,
      fecha: fechaLocal(archivo.lastModified || Date.now()),
      descripcion: extra.descripcion,
      hijoId: extra.hijoId || null,
    }),
  });
  const inicio = (await r.json()) as { id?: string; trozo?: number; error?: string };
  if (!r.ok || !inicio.id || !inicio.trozo) throw new Error(inicio.error ?? "No se ha podido empezar la subida.");

  let desde = 0;
  let intentos = 0;
  while (desde < archivo.size) {
    const trozo = archivo.slice(desde, Math.min(desde + inicio.trozo, archivo.size));
    let res: Response;
    try {
      res = await fetch(`/api/galeria/subidas/${inicio.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream", "X-Desde": String(desde) },
        body: trozo,
      });
    } catch {
      // Cobertura que va y viene: reintenta el mismo trozo unas veces
      if (++intentos > 4) throw new Error("Se ha perdido la conexión. Vuelve a intentarlo.");
      await new Promise((ok) => setTimeout(ok, 1500 * intentos));
      continue;
    }
    const j = (await res.json().catch(() => ({}))) as { hecho?: boolean; recibido?: number; id?: string; error?: string };
    if (!res.ok) throw new Error(j.error ?? "Se ha cortado la subida.");
    intentos = 0;
    if (j.hecho) {
      alProgreso(100);
      return j.id!;
    }
    desde = typeof j.recibido === "number" && j.recibido > desde ? j.recibido : desde + trozo.size;
    alProgreso(Math.min(99, Math.round((desde / archivo.size) * 100)));
  }
  throw new Error("La subida no ha terminado bien.");
}

export function activarSubida(zona: HTMLElement) {
  const limites = JSON.parse(zona.dataset.limites ?? "{}") as Limites;
  const input = zona.querySelector<HTMLInputElement>("[data-archivos]")!;
  const cola = zona.querySelector<HTMLUListElement>("[data-cola]")!;
  const descripcion = zona.querySelector<HTMLInputElement>("[data-descripcion]");
  const hijo = zona.querySelector<HTMLSelectElement>("[data-hijo]");
  let subiendo = false;

  // Avisar si se intenta salir a mitad
  addEventListener("beforeunload", (e) => {
    if (subiendo) e.preventDefault();
  });

  input.addEventListener("change", async () => {
    const archivos = [...(input.files ?? [])];
    input.value = "";
    if (!archivos.length) return;
    subiendo = true;
    let subidos = 0;

    // Primero se comprueban todos (tipo, tamaño y duración), luego se suben de uno en uno
    const tareas: { archivo: File; ui: ReturnType<typeof fila>; duracion: number | null }[] = [];
    for (const archivo of archivos) {
      const ui = fila(archivo);
      cola.append(ui.li);
      const esVideo = archivo.type.startsWith("video/");
      if (!esVideo && !archivo.type.startsWith("image/")) {
        ui.estado("No es una foto ni un vídeo.", "error");
        continue;
      }
      const maxMB = esVideo ? limites.videoMB : limites.imagenMB;
      if (archivo.size > maxMB * 1024 * 1024) {
        ui.estado(`Demasiado grande (máximo ${maxMB} MB).`, "error");
        continue;
      }
      let duracion: number | null = null;
      if (esVideo) {
        duracion = await duracionDe(archivo);
        if (duracion == null) {
          ui.estado("No se ha podido leer la duración del vídeo.", "error");
          continue;
        }
        if (duracion > limites.videoSegundos + 0.5) {
          ui.estado(`Dura ${Math.round(duracion)} s: el máximo es ${limites.videoSegundos} s. Recórtalo en el móvil y vuelve a subirlo.`, "error");
          continue;
        }
      }
      tareas.push({ archivo, ui, duracion });
    }

    for (const t of tareas) {
      try {
        t.ui.progreso(0);
        await subirUno(t.archivo, { descripcion: descripcion?.value.trim() ?? "", hijoId: hijo?.value ?? "", duracion: t.duracion }, (p) => t.ui.progreso(p));
        t.ui.estado("Subido ✓", "ok");
        subidos++;
      } catch (e) {
        t.ui.estado(e instanceof Error ? e.message : "No se ha podido subir.", "error");
      }
    }
    subiendo = false;
    if (subidos > 0 && subidos === archivos.length) {
      location.href = "/galeria?ok=subido";
    } else if (subidos > 0) {
      const enlace = document.createElement("a");
      enlace.href = "/galeria?ok=subido";
      enlace.className = "btn btn-secondary";
      enlace.textContent = `Ver ${subidos === 1 ? "la subida" : `las ${subidos} subidas`}`;
      cola.after(enlace);
    }
  });
}
