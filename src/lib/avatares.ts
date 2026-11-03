/** Avatares disponibles. La etiqueta es lo que leen los lectores de pantalla. */
export const AVATARES = [
  { emoji: "👩", etiqueta: "Mujer" },
  { emoji: "👨", etiqueta: "Hombre" },
  { emoji: "👩‍🦰", etiqueta: "Mujer pelirroja" },
  { emoji: "👨‍🦱", etiqueta: "Hombre con pelo rizado" },
  { emoji: "👱‍♀️", etiqueta: "Mujer rubia" },
  { emoji: "🧔", etiqueta: "Hombre con barba" },
  { emoji: "👵", etiqueta: "Abuela" },
  { emoji: "👴", etiqueta: "Abuelo" },
  { emoji: "🦊", etiqueta: "Zorro" },
  { emoji: "🐻", etiqueta: "Oso" },
  { emoji: "🐼", etiqueta: "Panda" },
  { emoji: "🐨", etiqueta: "Koala" },
  { emoji: "🦁", etiqueta: "León" },
  { emoji: "🐰", etiqueta: "Conejo" },
  { emoji: "🌻", etiqueta: "Girasol" },
  { emoji: "⭐", etiqueta: "Estrella" },
] as const;

export const EMOJIS_AVATAR: string[] = AVATARES.map((a) => a.emoji);
