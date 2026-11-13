/**
 * Versión de la app y registro de cambios.
 *
 * La versión viene de package.json (una sola fuente de verdad). El historial
 * está en CHANGELOG.md, en la raíz, y se muestra en /novedades. Al publicar:
 *   1. `npm version minor` (o patch / major): actualiza package.json y crea el tag.
 *   2. Añade la entrada en CHANGELOG.md con la misma versión y fecha.
 */
import pkg from "../../package.json";
import changelog from "../../CHANGELOG.md?raw";

export const VERSION: string = pkg.version;

export type Entrada = { version: string; fecha: string; cambios: string[] };

/** Lee CHANGELOG.md: cabeceras «## 1.2.0 — 2026-11-09» y viñetas «- …» */
export function historial(): Entrada[] {
  const entradas: Entrada[] = [];
  let actual: Entrada | null = null;
  for (const linea of changelog.split("\n")) {
    const cab = /^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})/.exec(linea);
    if (cab) {
      actual = { version: cab[1], fecha: cab[2], cambios: [] };
      entradas.push(actual);
    } else if (actual && /^- /.test(linea)) {
      actual.cambios.push(linea.slice(2).trim());
    }
  }
  return entradas;
}
