import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";

export async function buscarEmails(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const filas = await db.select({ email: user.email }).from(user).where(inArray(user.id, ids));
  return filas.map((f) => f.email);
}
