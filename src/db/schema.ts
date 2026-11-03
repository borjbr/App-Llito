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
