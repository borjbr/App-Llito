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
| Asistente | Vercel AI SDK + OpenAI (`gpt-5.4-mini` por defecto) | Único servicio de pago; con límite diario por hogar |
| Despliegue | Vercel (previews por PR) | Gratis para uso personal |

## Principios

- **Formularios que funcionan sin JavaScript**: cada página procesa su propio `POST` en el servidor y redirige (patrón PRG). El JS solo mejora (mostrar contraseña, añadir hijos).
- **Accesibilidad**: etiquetas siempre visibles, errores enlazados con `aria-describedby` y resumen de errores que recibe el foco, objetivos táctiles de 48px, foco visible, `prefers-reduced-motion`, contraste AA en ambos temas, fuente Atkinson Hyperlegible.
- **Fechas**: se guardan en UTC y se muestran en `Europe/Madrid`.
- **Seguridad**: rutas protegidas en `src/middleware.ts`, comprobación de origen de Astro en los `POST`, contraseñas con hash de Better Auth, cookies `httpOnly`.

## Estructura

```
src/
├── pages/           login, registro, inicio (/), hogar/, hijos/ (y recetas/), asistente, mi-perfil, salir
│   ├── api/auth/    endpoints de Better Auth
│   └── api/chat.ts  chat del asistente
├── layouts/         Base (HTML), Auth (pantallas de acceso), App (menú inferior)
├── components/      campos de formulario, selector de avatar, lista de hijos
├── db/              schema.ts (tablas) y client.ts (conexión)
├── lib/             auth, validación, avatares, utilidades de familia
├── scripts/         JavaScript de cliente (chat)
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

### Agenda y Google Calendar

- Tabla `evento` (del hogar): tipo (cita médica, cumpleaños, tarea, plan, vacuna, recordatorio), fecha y horas en hora de Madrid, todo el día, repetición (semanal, mensual, anual), lugar, notas, hijo, responsable, avisos (minutos antes) y estado de tarea.
- Las repeticiones se expanden al consultar un rango (`eventosEnRango`); el 29 de febrero y los días 31 caen en el último día disponible.
- Tabla `conexion_google` (una por hogar): cuenta, calendario creado por la app, *refresh token* cifrado con AES-GCM y `syncToken`.
- **App → Google**: al crear, editar, completar o borrar se llama a la API al momento. Si falla, el evento queda pendiente y se reintenta en la siguiente sincronización.
- **Google → App**: sincronización incremental con `syncToken` al abrir la agenda (como mucho una vez por minuto) o con «Sincronizar ahora». Los eventos llevan `llitoId` y `llitoTipo` en `extendedProperties` para reconocerlos.
- Los avisos son los recordatorios de Google Calendar: llegan como notificación nativa a cada móvil sin necesidad de un servidor de notificaciones propio.
- Guía de configuración: [GOOGLE-CALENDAR.md](GOOGLE-CALENDAR.md).

### Recetario

- Tabla `receta` (del hogar): título, `clave` (título normalizado, único por hogar para no duplicar), descripción, edad mínima en meses, minutos, raciones, pasos (uno por línea), notas y `origen` (`familia` o `asistente`).
- Tabla `ingrediente_receta`: categoría, producto, cantidad y orden.
- Catálogo de alimentos en `src/lib/alimentos.ts`: categorías con sus productos y avisos para bebés (miel, sal, espinacas, uvas enteras…). El formulario usa dos selects encadenados (tipo → ingrediente) con «Otro» para escribir uno nuevo; sin JavaScript, el select de ingrediente muestra todo el catálogo agrupado.
- Si un producto está en el catálogo, su categoría y su nombre los pone el catálogo.

### Asistente Llito

- `POST /api/chat` recibe solo el mensaje nuevo; el historial se lee de `mensaje_chat` (cada persona tiene su conversación) y se responde con el stream de mensajes del AI SDK.
- **La memoria vive en la base de datos, no en el modelo.** El recetario es la fuente de verdad: el modelo tiene la lista de recetas en sus instrucciones y usa herramientas:
  - `mostrar_receta(id)`: la app pinta la receta guardada como tarjeta, sin que el modelo la reescriba. Por eso pedir la misma receta dos veces devuelve exactamente la misma.
  - `guardar_receta(...)`: crea o sustituye una receta (con `origen = asistente`).
  - `buscar_recetas(texto)`: para recetarios grandes.
  - `recordar(texto)` / `olvidar(id)`: datos duraderos de la familia en la tabla `memoria`, que se ven y se borran desde `/asistente`.
- Instrucciones fijas con pautas de alimentación complementaria (AEP/AESAN) y aviso de consultar al pediatra.
- `store: false` en OpenAI: la conversación no se guarda en sus servidores. Sin razonamientos ni metadatos del proveedor en la BD.
- Límite de mensajes por hogar cada 24 horas (`ASISTENTE_LIMITE_DIARIO`, 100 por defecto) y como mucho 6 pasos de herramientas por respuesta.
- Cliente sin framework (`src/scripts/chat.ts`, ~9 KB): lee el stream SSE, pinta texto (markdown mínimo que escapa todo el HTML) y tarjetas, y anuncia la respuesta a los lectores de pantalla.

## Próximos pasos

1. Hijos: tomas y comidas.
2. Hijos: salud y crecimiento (con gráfica).
3. Hogar: lista de la compra.
4. PWA instalable y resumen del día más completo en Inicio.
