/**
 * Markdown mínimo y seguro para las respuestas del asistente.
 * Primero se escapa todo el HTML; después se aplican negritas, cursivas,
 * código, enlaces http(s), listas y párrafos. No admite HTML del modelo.
 */

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function enLinea(texto: string): string {
  let s = escapar(texto);
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  // Enlaces: solo http(s). El texto y la URL ya están escapados.
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

export function markdownSeguro(md: string): string {
  const lineas = md.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let lista: "ul" | "ol" | null = null;
  let parrafo: string[] = [];

  const cerrarParrafo = () => {
    if (parrafo.length) html.push(`<p>${parrafo.map(enLinea).join("<br>")}</p>`);
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) html.push(`</${lista}>`);
    lista = null;
  };

  for (const linea of lineas) {
    const t = linea.trim();
    const vineta = /^[-*•]\s+(.*)$/.exec(t);
    const numero = /^\d+[.)]\s+(.*)$/.exec(t);
    const titulo = /^#{1,6}\s+(.*)$/.exec(t);

    if (!t) {
      cerrarParrafo();
      cerrarLista();
    } else if (vineta || numero) {
      cerrarParrafo();
      const tipo = vineta ? "ul" : "ol";
      if (lista !== tipo) {
        cerrarLista();
        html.push(`<${tipo}>`);
        lista = tipo;
      }
      html.push(`<li>${enLinea((vineta ?? numero)![1])}</li>`);
    } else if (titulo) {
      cerrarParrafo();
      cerrarLista();
      html.push(`<p><strong>${enLinea(titulo[1])}</strong></p>`);
    } else {
      cerrarLista();
      parrafo.push(t);
    }
  }
  cerrarParrafo();
  cerrarLista();
  return html.join("");
}
