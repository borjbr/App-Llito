import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";
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

export type Evento = typeof evento.$inferSelect;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export type Repeticion = (typeof REPETICIONES)[number];
export type ConexionGoogle = typeof conexionGoogle.$inferSelect;
