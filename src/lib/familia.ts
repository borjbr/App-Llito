import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { hijo } from "@/db/schema";

export function hijosDe(userId: string) {
  return db.select().from(hijo).where(eq(hijo.userId, userId)).orderBy(asc(hijo.orden), asc(hijo.createdAt));
}

/** "Carmen", "Carmen y Lucas", "Carmen, Lucas y Ana" */
export function listaNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
