# App-Llito

App web familiar para organizar el hogar y el cuidado de los hijos. Hecha con Astro, Turso (SQLite) y Better Auth, y desplegada en Vercel.

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Desarrollo local

Requisitos: Node 20 o superior.

```bash
npm install
cp .env.example .env          # y pon una clave en BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate            # crea local.db con las tablas
npm run dev                   # http://localhost:4321
```

## Base de datos

- Cambia el esquema en `src/db/schema.ts`.
- `npm run db:generate` crea la migración SQL en `drizzle/`.
- `npm run db:migrate` la aplica a la base de datos de `.env`.
- `npm run db:studio` abre un explorador visual de la base de datos.

## Despliegue en Vercel

1. Crea una base de datos gratuita en [Turso](https://turso.tech) y copia su URL y un token.
2. Aplica las migraciones a Turso desde tu equipo:
   ```bash
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:migrate
   ```
3. Importa este repositorio en [Vercel](https://vercel.com/new) y añade estas variables de entorno:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `BETTER_AUTH_SECRET` (una clave larga y aleatoria)
   - `BETTER_AUTH_URL` (la URL de producción, por ejemplo `https://app-llito.vercel.app`)
   - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (opcionales, para Google Calendar)
   - `OPENAI_API_KEY` (opcional, para el asistente Llito) y, si quieres, `OPENAI_MODEL` y `ASISTENTE_LIMITE_DIARIO`
4. Despliega. Cada pull request genera una preview automática.

## Google Calendar

La agenda se sincroniza con un calendario de Google compartido por la familia. Cómo crear el proyecto gratuito de Google Cloud y obtener las credenciales: [docs/GOOGLE-CALENDAR.md](docs/GOOGLE-CALENDAR.md).

## Asistente Llito

Chat con OpenAI (Vercel AI SDK) en `/asistente`, con acceso desde Inicio. Las recetas que propone se guardan en el recetario (`/hijos/recetas`) y se muestran siempre tal como están guardadas; los datos que le cuentas se guardan en su memoria, visible y editable desde la propia página.

1. Crea una clave en [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. En tu cuenta de OpenAI, pon un **límite de gasto** mensual (Settings → Limits).
3. Añade `OPENAI_API_KEY` en Vercel y vuelve a desplegar.
