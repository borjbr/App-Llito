/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import("better-auth").User & {
      apellidos: string;
      avatar: string;
      edad?: number | null;
    } | null;
    session: import("better-auth").Session | null;
  }
}
