import { sqliteTable, text, integer, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

/* ── Autenticación (tablas que usa Better Auth) ───────────────────────── */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  /** Nombre de pila */
  name: text("name").notNull(),
  apellidos: text("apellidos").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  /** Emoji elegido como avatar */
  avatar: text("avatar").notNull().default("🙂"),
  edad: integer("edad"),
  ...timestamps,
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
});

/* ── Familia ──────────────────────────────────────────────────────────── */

/** Un hogar agrupa a la pareja (y más adelante cuidadores) y comparte hijos y datos. */
export const hogar = sqliteTable("hogar", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  nombre: text("nombre").notNull(),
  /** Código para invitar a otra persona al hogar */
  codigoInvitacion: text("codigo_invitacion").notNull().unique(),
  creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
  ...timestamps,
});

export const miembroHogar = sqliteTable(
  "miembro_hogar",
  {
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    /** Cada persona pertenece a un solo hogar */
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    rol: text("rol", { enum: ["admin", "miembro"] }).notNull().default("miembro"),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.hogarId, t.userId] }), index("miembro_hogar_idx").on(t.hogarId)],
);

export const hijo = sqliteTable(
  "hijo",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    orden: integer("orden").notNull().default(0),
    /** YYYY-MM-DD; opcional, para mostrar la edad en cada consulta */
    fechaNacimiento: text("fecha_nacimiento"),
    ...timestamps,
  },
  (t) => [index("hijo_hogar_idx").on(t.hogarId)],
);

export const hogarRelations = relations(hogar, ({ many }) => ({
  miembros: many(miembroHogar),
  hijos: many(hijo),
}));

export const miembroHogarRelations = relations(miembroHogar, ({ one }) => ({
  hogar: one(hogar, { fields: [miembroHogar.hogarId], references: [hogar.id] }),
  user: one(user, { fields: [miembroHogar.userId], references: [user.id] }),
}));

export const hijoRelations = relations(hijo, ({ one }) => ({
  hogar: one(hogar, { fields: [hijo.hogarId], references: [hogar.id] }),
}));

export type Usuario = typeof user.$inferSelect;
export type Hogar = typeof hogar.$inferSelect;
export type Hijo = typeof hijo.$inferSelect;

/* ── Agenda ───────────────────────────────────────────────────────────── */

export const TIPOS_EVENTO = ["cita_medica", "cumpleanos", "tarea", "evento", "vacuna", "recordatorio"] as const;
export const REPETICIONES = ["ninguna", "semanal", "mensual", "anual"] as const;

export const evento = sqliteTable(
  "evento",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: TIPOS_EVENTO }).notNull().default("evento"),
    titulo: text("titulo").notNull(),
    /** Día en hora de Madrid (YYYY-MM-DD). Null solo en tareas sin fecha. */
    fecha: text("fecha"),
    todoElDia: integer("todo_el_dia", { mode: "boolean" }).notNull().default(true),
    /** Horas en hora de Madrid (HH:MM), solo si no es de todo el día */
    horaInicio: text("hora_inicio"),
    horaFin: text("hora_fin"),
    /** Instante de inicio en UTC, para ordenar y buscar por rango */
    inicio: integer("inicio", { mode: "timestamp_ms" }),
    repeticion: text("repeticion", { enum: REPETICIONES }).notNull().default("ninguna"),
    ubicacion: text("ubicacion"),
    notas: text("notas"),
    hijoId: text("hijo_id").references(() => hijo.id, { onDelete: "set null" }),
    asignadoA: text("asignado_a").references(() => user.id, { onDelete: "set null" }),
    completado: integer("completado", { mode: "boolean" }).notNull().default(false),
    /** Minutos antes del inicio, separados por comas: "1440,60" */
    recordatorios: text("recordatorios").notNull().default(""),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    /** Sincronización con Google Calendar */
    googleId: text("google_id"),
    sincronizado: integer("sincronizado", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("evento_hogar_fecha_idx").on(t.hogarId, t.fecha), index("evento_google_idx").on(t.hogarId, t.googleId)],
);

/** Una conexión con Google por hogar: el calendario compartido de la familia. */
export const conexionGoogle = sqliteTable("conexion_google", {
  hogarId: text("hogar_id")
    .primaryKey()
    .references(() => hogar.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  cuentaEmail: text("cuenta_email").notNull(),
  /** Refresh token cifrado con AES-GCM */
  refreshToken: text("refresh_token").notNull(),
  calendarId: text("calendar_id").notNull(),
  calendarNombre: text("calendar_nombre").notNull(),
  syncToken: text("sync_token"),
  ultimaSync: integer("ultima_sync", { mode: "timestamp_ms" }),
  ultimoError: text("ultimo_error"),
  ...timestamps,
});

/* ── Recetario ────────────────────────────────────────────────────────── */

export const CATEGORIAS_ALIMENTO = ["verdura", "fruta", "cereal", "legumbre", "proteina", "lacteo", "grasa", "especia", "otro"] as const;
export const ORIGENES_RECETA = ["familia", "asistente"] as const;

/** Receta del hogar. Es la fuente de verdad: el asistente la muestra tal cual, sin reescribirla. */
export const receta = sqliteTable(
  "receta",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    /** Título normalizado (sin tildes ni mayúsculas) para no duplicar recetas */
    clave: text("clave").notNull(),
    descripcion: text("descripcion"),
    /** Edad mínima recomendada en meses; null = sin indicar */
    edadMeses: integer("edad_meses"),
    minutos: integer("minutos"),
    raciones: text("raciones"),
    /** Un paso por línea */
    pasos: text("pasos").notNull().default(""),
    notas: text("notas"),
    origen: text("origen", { enum: ORIGENES_RECETA }).notNull().default("familia"),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("receta_hogar_clave_idx").on(t.hogarId, t.clave)],
);

export const ingredienteReceta = sqliteTable(
  "ingrediente_receta",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recetaId: text("receta_id")
      .notNull()
      .references(() => receta.id, { onDelete: "cascade" }),
    categoria: text("categoria", { enum: CATEGORIAS_ALIMENTO }).notNull().default("otro"),
    producto: text("producto").notNull(),
    cantidad: text("cantidad"),
    orden: integer("orden").notNull().default(0),
  },
  (t) => [index("ingrediente_receta_idx").on(t.recetaId)],
);

/* ── Asistente ────────────────────────────────────────────────────────── */

/** Datos que el asistente recuerda del hogar (preferencias, alimentos ya introducidos…). */
export const memoria = sqliteTable(
  "memoria",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    texto: text("texto").notNull(),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("memoria_hogar_idx").on(t.hogarId)],
);

/** Historial del chat: cada persona tiene su conversación; recetas y memoria son del hogar. */
export const mensajeChat = sqliteTable(
  "mensaje_chat",
  {
    id: text("id").primaryKey(),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rol: text("rol", { enum: ["user", "assistant"] }).notNull(),
    /** Partes del mensaje (formato UIMessage del AI SDK) en JSON */
    partes: text("partes").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("mensaje_chat_user_idx").on(t.userId, t.createdAt), index("mensaje_chat_hogar_idx").on(t.hogarId, t.createdAt)],
);

export const recetaRelations = relations(receta, ({ many }) => ({
  ingredientes: many(ingredienteReceta),
}));

export const ingredienteRecetaRelations = relations(ingredienteReceta, ({ one }) => ({
  receta: one(receta, { fields: [ingredienteReceta.recetaId], references: [receta.id] }),
}));

export type Receta = typeof receta.$inferSelect;
export type IngredienteReceta = typeof ingredienteReceta.$inferSelect;
export type CategoriaAlimento = (typeof CATEGORIAS_ALIMENTO)[number];
export type Memoria = typeof memoria.$inferSelect;

export type Evento = typeof evento.$inferSelect;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export type Repeticion = (typeof REPETICIONES)[number];
export type ConexionGoogle = typeof conexionGoogle.$inferSelect;

/* ── Hogar: lista de la compra, limpieza y pelis/series ───────────────── */

/**
 * Producto de la lista de la compra. Al comprarlo no se borra: se marca con
 * `compradoEn`, así queda registro de cuándo cambió la lista y se puede volver
 * a añadir con un toque desde «Comprado hace poco».
 */
export const productoCompra = sqliteTable(
  "producto_compra",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    cantidad: text("cantidad"),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    compradoEn: integer("comprado_en", { mode: "timestamp_ms" }),
    compradoPor: text("comprado_por").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("producto_compra_hogar_idx").on(t.hogarId, t.compradoEn)],
);

/** Un día de limpieza: fecha, tiempo trabajado y precio por hora de ese día. */
export const jornadaLimpieza = sqliteTable(
  "jornada_limpieza",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    /** Día en hora de Madrid (YYYY-MM-DD) */
    fecha: text("fecha").notNull(),
    /** Tiempo trabajado en minutos (admite medias horas) */
    minutos: integer("minutos").notNull(),
    /** Precio por hora en céntimos, guardado en cada día por si cambia la tarifa */
    tarifaCentimos: integer("tarifa_centimos").notNull().default(1000),
    notas: text("notas"),
    pagado: integer("pagado", { mode: "boolean" }).notNull().default(false),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("jornada_limpieza_hogar_idx").on(t.hogarId, t.fecha)],
);

export const TIPOS_TITULO = ["pelicula", "serie"] as const;

/** Película o serie pendiente de ver. Al verla se marca con `vistaEn`. */
export const titulo = sqliteTable(
  "titulo",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    tipo: text("tipo", { enum: TIPOS_TITULO }).notNull().default("pelicula"),
    /** Netflix, HBO, cine… */
    plataforma: text("plataforma"),
    notas: text("notas"),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    vistaEn: integer("vista_en", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [index("titulo_hogar_idx").on(t.hogarId, t.vistaEn)],
);

/** Restaurante al que os apetece ir. Al visitarlo se marca con `visitadoEn`. */
export const restaurante = sqliteTable(
  "restaurante",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    direccion: text("direccion"),
    /** Italiana, japonesa, tapas… */
    tipoComida: text("tipo_comida"),
    notas: text("notas"),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    visitadoEn: integer("visitado_en", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [index("restaurante_hogar_idx").on(t.hogarId, t.visitadoEn)],
);

/* ── Consultas médicas ─────────────────────────────────────────────────── */

/**
 * Lo que pasó en una visita al médico: medidas, lo que dijeron y qué hacer
 * después. Las medidas se guardan en enteros (gramos y milímetros) para no
 * arrastrar decimales; se muestran en kg y cm.
 */
export const consulta = sqliteTable(
  "consulta",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hogarId: text("hogar_id")
      .notNull()
      .references(() => hogar.id, { onDelete: "cascade" }),
    hijoId: text("hijo_id")
      .notNull()
      .references(() => hijo.id, { onDelete: "cascade" }),
    /** Cita de la agenda de la que sale, si la hay */
    eventoId: text("evento_id").references(() => evento.id, { onDelete: "set null" }),
    /** Día de la consulta (YYYY-MM-DD, hora de Madrid) */
    fecha: text("fecha").notNull(),
    /** Pediatría, Neurología… */
    especialidad: text("especialidad"),
    centro: text("centro"),
    profesional: text("profesional"),
    motivo: text("motivo"),
    pesoGramos: integer("peso_gramos"),
    tallaMm: integer("talla_mm"),
    perimetroMm: integer("perimetro_mm"),
    /** Lo que dijeron */
    notas: text("notas"),
    /** Tratamiento, pruebas, próxima revisión… */
    indicaciones: text("indicaciones"),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("consulta_hijo_idx").on(t.hijoId, t.fecha), index("consulta_hogar_idx").on(t.hogarId)],
);

export type Consulta = typeof consulta.$inferSelect;
export type ProductoCompra = typeof productoCompra.$inferSelect;
export type Restaurante = typeof restaurante.$inferSelect;
export type JornadaLimpieza = typeof jornadaLimpieza.$inferSelect;
export type Titulo = typeof titulo.$inferSelect;
export type TipoTitulo = (typeof TIPOS_TITULO)[number];
