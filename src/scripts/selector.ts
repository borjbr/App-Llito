/**
 * Selector de carpetas de Google (Picker). Con el permiso drive.file, elegir la
 * carpeta aquí es lo que da acceso a la app para guardar dentro.
 * Si se pega el enlace de la carpeta, el selector la muestra directamente.
 */

type Gapi = { load: (lib: string, cb: () => void) => void };
// Tipos mínimos del Picker (se carga desde apis.google.com)
interface Constructor {
  addView(v: unknown): Constructor;
  setOAuthToken(t: string): Constructor;
  setDeveloperKey(k: string): Constructor;
  setAppId(id: string): Constructor;
  setLocale(l: string): Constructor;
  setTitle(t: string): Constructor;
  setCallback(cb: (d: Record<string, unknown>) => void): Constructor;
  build(): { setVisible(v: boolean): void };
}
interface VistaDocs {
  setIncludeFolders(v: boolean): VistaDocs;
  setSelectFolderEnabled(v: boolean): VistaDocs;
  setMimeTypes(m: string): VistaDocs;
  setFileIds?(ids: string): VistaDocs;
}
type Picker = {
  PickerBuilder: new () => Constructor;
  DocsView: new (id?: string) => VistaDocs;
  ViewId: { FOLDERS: string };
  Action: { PICKED: string; CANCEL: string };
};

const idDeEnlace = (texto: string) => /\/folders\/([\w-]{10,})/.exec(texto)?.[1] ?? (/^[\w-]{20,}$/.test(texto.trim()) ? texto.trim() : null);

function cargarPicker(): Promise<Picker> {
  const w = window as unknown as { gapi?: Gapi; google?: { picker?: Picker } };
  if (w.google?.picker) return Promise.resolve(w.google.picker);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = () => w.gapi!.load("picker", () => resolve(w.google!.picker!));
    s.onerror = () => reject(new Error("No se ha podido cargar el selector de Google."));
    document.head.append(s);
  });
}

export function activarSelectorCarpeta(boton: HTMLButtonElement) {
  const error = document.querySelector<HTMLElement>("[data-error-carpeta]");
  const enlace = document.querySelector<HTMLInputElement>("#enlace-carpeta");
  const mostrarError = (t: string) => {
    if (!error) return;
    error.textContent = t;
    error.hidden = false;
  };

  boton.addEventListener("click", async () => {
    if (error) error.hidden = true;
    boton.disabled = true;
    const texto = boton.textContent;
    boton.textContent = "Abriendo…";
    try {
      const r = await fetch("/api/galeria/selector");
      const datos = (await r.json()) as { token?: string; apiKey?: string; appId?: string; error?: string };
      if (!r.ok || !datos.token) throw new Error(datos.error ?? "No se ha podido abrir el selector.");
      const picker = await cargarPicker();

      const sugerida = enlace?.value ? idDeEnlace(enlace.value) : null;
      if (enlace?.value && !sugerida) throw new Error("Ese enlace no parece de una carpeta de Drive.");

      const carpetas = new picker.DocsView(picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes("application/vnd.google-apps.folder");
      if (sugerida && carpetas.setFileIds) carpetas.setFileIds(sugerida);

      new picker.PickerBuilder()
        .addView(carpetas)
        .setOAuthToken(datos.token)
        .setDeveloperKey(datos.apiKey!)
        .setAppId(datos.appId!)
        .setLocale("es")
        .setTitle("Elige la carpeta de la galería")
        .setCallback(async (d) => {
          if (d.action !== picker.Action.PICKED) return;
          const id = (d.docs as { id: string }[] | undefined)?.[0]?.id;
          if (!id) return;
          const g = await fetch("/api/galeria/carpeta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const j = (await g.json()) as { error?: string };
          if (!g.ok) return mostrarError(j.error ?? "No se ha podido usar esa carpeta.");
          location.href = "/galeria?ok=carpeta";
        })
        .build()
        .setVisible(true);
    } catch (e) {
      mostrarError(e instanceof Error ? e.message : "No se ha podido abrir el selector.");
    } finally {
      boton.disabled = false;
      boton.textContent = texto;
    }
  });
}
