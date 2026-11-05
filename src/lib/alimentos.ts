/**
 * Catálogo de alimentos para el recetario: cada categoría con sus productos.
 * Lo usan el formulario (selects encadenados) y el asistente.
 *
 * Los avisos resumen pautas generales de alimentación complementaria
 * (AEP y AESAN). No sustituyen el consejo del pediatra.
 */
import type { CategoriaAlimento } from "@/db/schema";

export type Producto = { nombre: string; aviso?: string };
export type Categoria = { nombre: string; emoji: string; productos: Producto[] };

const p = (...nombres: string[]): Producto[] => nombres.map((nombre) => ({ nombre }));

export const CATEGORIAS: Record<CategoriaAlimento, Categoria> = {
  verdura: {
    nombre: "Verduras y hortalizas",
    emoji: "🥕",
    productos: [
      ...p(
        "Calabaza",
        "Zanahoria",
        "Calabacín",
        "Patata",
        "Boniato",
        "Brócoli",
        "Coliflor",
        "Judía verde",
        "Puerro",
        "Cebolla",
        "Tomate",
        "Pimiento rojo",
        "Berenjena",
        "Chirivía",
        "Apio",
        "Espárrago verde",
        "Alcachofa",
        "Champiñón",
        "Remolacha",
        "Pepino",
      ),
      { nombre: "Espinaca", aviso: "Mejor no darla antes de los 12 meses (nitratos)." },
      { nombre: "Acelga", aviso: "Mejor no darla antes de los 12 meses (nitratos)." },
    ],
  },
  fruta: {
    nombre: "Frutas",
    emoji: "🍎",
    productos: [
      ...p(
        "Manzana",
        "Pera",
        "Plátano",
        "Melocotón",
        "Mango",
        "Ciruela",
        "Naranja",
        "Mandarina",
        "Fresa",
        "Kiwi",
        "Melón",
        "Sandía",
        "Albaricoque",
        "Papaya",
        "Aguacate",
        "Higo",
      ),
      { nombre: "Uva", aviso: "Siempre cortada en cuartos a lo largo: entera puede atragantar." },
      { nombre: "Arándanos", aviso: "Aplastados o cortados por la mitad en los más pequeños." },
    ],
  },
  cereal: {
    nombre: "Cereales y pasta",
    emoji: "🌾",
    productos: p("Arroz", "Avena", "Mijo", "Quinoa", "Maíz", "Pasta", "Pan", "Cuscús", "Sémola de trigo", "Tapioca"),
  },
  legumbre: {
    nombre: "Legumbres",
    emoji: "🫘",
    productos: p("Lenteja roja", "Lenteja", "Garbanzo", "Alubia blanca", "Guisante", "Edamame"),
  },
  proteina: {
    nombre: "Carne, pescado y huevo",
    emoji: "🍗",
    productos: [
      ...p("Pollo", "Pavo", "Conejo", "Ternera", "Cerdo magro", "Cordero", "Huevo", "Merluza", "Bacalao", "Lenguado", "Gallo", "Salmón", "Sardina", "Tofu"),
      { nombre: "Atún", aviso: "Solo atún claro y en poca cantidad; evitar atún rojo y pez espada en niños." },
    ],
  },
  lacteo: {
    nombre: "Lácteos",
    emoji: "🥛",
    productos: [
      ...p("Yogur natural", "Queso fresco", "Requesón", "Queso tierno", "Leche materna", "Leche de fórmula"),
      { nombre: "Leche de vaca", aviso: "Como bebida, no antes de los 12 meses; en recetas, en pequeñas cantidades." },
    ],
  },
  grasa: {
    nombre: "Aceites, frutos secos y semillas",
    emoji: "🫒",
    productos: [
      ...p("Aceite de oliva virgen extra", "Mantequilla", "Tahini", "Semillas de chía molidas"),
      { nombre: "Frutos secos molidos", aviso: "Siempre molidos o en crema: enteros pueden atragantar hasta los 5-6 años." },
      { nombre: "Crema de cacahuete", aviso: "Sin sal ni azúcar añadidos; es un alérgeno: introducir sola y en poca cantidad." },
    ],
  },
  especia: {
    nombre: "Hierbas y especias",
    emoji: "🌿",
    productos: p("Ajo", "Comino", "Cúrcuma", "Canela", "Orégano", "Albahaca", "Perejil", "Tomillo", "Laurel", "Pimentón dulce", "Nuez moscada", "Vainilla"),
  },
  otro: {
    nombre: "Otros",
    emoji: "🥄",
    productos: [
      ...p("Agua", "Caldo casero sin sal"),
      { nombre: "Sal", aviso: "Sin sal añadida antes de los 12 meses." },
      { nombre: "Azúcar", aviso: "Sin azúcares añadidos antes de los 12 meses." },
      { nombre: "Miel", aviso: "Nunca antes de los 12 meses (riesgo de botulismo)." },
    ],
  },
};

export const ORDEN_CATEGORIAS = Object.keys(CATEGORIAS) as CategoriaAlimento[];

export function esCategoria(v: string): v is CategoriaAlimento {
  return v in CATEGORIAS;
}

/** "Puré de Calabaza" → "pure de calabaza" (para comparar sin tildes ni mayúsculas) */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

const indice = new Map<string, { categoria: CategoriaAlimento; producto: Producto }>();
for (const categoria of ORDEN_CATEGORIAS) {
  for (const producto of CATEGORIAS[categoria].productos) indice.set(normalizar(producto.nombre), { categoria, producto });
}

/** Busca un producto del catálogo por nombre (sin distinguir tildes ni mayúsculas). */
export function buscarProducto(nombre: string) {
  return indice.get(normalizar(nombre));
}

/** Avisos de los ingredientes de una receta, sin repetir. */
export function avisosDe(productos: string[]): string[] {
  const avisos = new Set<string>();
  for (const nombre of productos) {
    const aviso = buscarProducto(nombre)?.producto.aviso;
    if (aviso) avisos.add(`${buscarProducto(nombre)!.producto.nombre}: ${aviso}`);
  }
  return [...avisos];
}

export const EDADES = [
  { meses: 6, txt: "Desde los 6 meses" },
  { meses: 7, txt: "Desde los 7 meses" },
  { meses: 8, txt: "Desde los 8 meses" },
  { meses: 9, txt: "Desde los 9 meses" },
  { meses: 12, txt: "Desde los 12 meses" },
  { meses: 18, txt: "Desde los 18 meses" },
  { meses: 24, txt: "Desde los 2 años" },
];

export function textoEdad(meses: number | null | undefined): string | null {
  if (meses == null) return null;
  if (meses >= 24 && meses % 12 === 0) return `Desde los ${meses / 12} años`;
  return `Desde los ${meses} meses`;
}
