# Arquitectura de App-Llito

App web familiar para organizar el hogar y el cuidado de los hijos. Pensada primero para el móvil, accesible y con coste cero.

## Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | Astro 5 en modo servidor (`output: "server"`) + `@astrojs/vercel` | Frontend y backend en un solo proyecto |
| Estilos | Tailwind CSS 4 + tokens CSS propios (`src/styles/global.css`) | Tema claro/oscuro con las mismas variables |
| Base de datos | Turso (libSQL/SQLite) en producción, `local.db` en desarrollo | Plan gratuito, sin servidor que mantener |
| ORM | Drizzle ORM + drizzle-kit | Esquema tipado y migraciones versionadas en `drizzle/` |
| Autenticación | Better Auth (email y contraseña) | Sesiones en nuestra propia BD, sin servicios externos |
| Validación | Zod | Mensajes de error en español y de servidor |
| Interactividad | Scripts pequeños de Astro; Preact en islands cuando haga falta (gráficas, temporizadores) | Mínimo JavaScript en el móvil |
| Despliegue | Vercel (previews por PR) | Gratis para uso personal |

## Principios

- **Formularios que funcionan sin JavaScript**: cada página procesa su propio `POST` en el servidor y redirige (patrón PRG). El JS solo mejora (mostrar contraseña, añadir hijos).
- **Accesibilidad**: etiquetas siempre visibles, errores enlazados con `aria-describedby` y resumen de errores que recibe el foco, objetivos táctiles de 48px, foco visible, `prefers-reduced-motion`, contraste AA en ambos temas, fuente Atkinson Hyperlegible.
- **Fechas**: se guardan en UTC y se muestran en `Europe/Madrid`.
- **Seguridad**: rutas protegidas en `src/middleware.ts`, comprobación de origen de Astro en los `POST`, contraseñas con hash de Better Auth, cookies `httpOnly`.

## Estructura

```
src/
├── pages/           login, registro, inicio (/), hogar/, hijos/, mi-perfil, salir
│   └── api/auth/    endpoints de Better Auth
├── layouts/         Base (HTML), Auth (pantallas de acceso), App (menú inferior)
├── components/      campos de formulario, selector de avatar, lista de hijos
├── db/              schema.ts (tablas) y client.ts (conexión)
├── lib/             auth, validación, avatares, utilidades de familia
├── styles/          tokens y componentes CSS
└── middleware.ts    sesión y protección de rutas
drizzle/             migraciones SQL
docs/                este documento
```

## Modelo de datos actual

- `user`: nombre, apellidos, email, avatar (emoji), edad. Tablas `session`, `account`, `verification` de Better Auth.
- `hogar`: nombre y código de invitación (8 caracteres sin letras ambiguas).
- `miembro_hogar`: une cada persona con su hogar (una persona, un hogar) y su rol (`admin` o `miembro`).
- `hijo`: pertenece al hogar, no a la persona, para que la pareja comparta los mismos datos.

### Hogar compartido

- Al registrarse se elige **crear un hogar nuevo** o **unirse con un código**. El enlace `/registro?codigo=XXXX` preselecciona la opción y muestra a qué hogar se une.
- En **Mi perfil → Mi familia** se ven los miembros, se copia el enlace o el código, se cambia el nombre del hogar y quien lo administra puede crear un código nuevo.
- Unirse a otro hogar: si la persona era la única de su hogar y tenía hijos, se pide confirmación explícita porque ese hogar se borra.
- Todo dato nuevo (tomas, salud, tareas, citas) colgará de `hogar_id`.

## Próximos pasos

1. **Agenda y Google Calendar**: citas en la app sincronizadas con un calendario compartido de Google; los recordatorios de Google llegan como notificación a cada móvil.
2. Hijos: tomas y comidas.
3. Hijos: salud y crecimiento (con gráfica).
4. Hogar: tareas y lista de la compra.
5. Resumen del día en Inicio y PWA instalable.
