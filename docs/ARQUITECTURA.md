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
| Asistente | Vercel AI SDK + OpenAI (`gpt-4o-mini` por defecto) | Único servicio de pago; con límite diario por hogar |
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

### Asistente Kissbell

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

### Hogar

- `/hogar` es el menú de la sección: Agenda, Lista de la compra, María Eugenia (limpieza), Pelis y series y Restaurantes, cada una con su dato resumido.
- **Patrón común**: lo hecho no se borra al momento, se marca con fecha (`comprado_en`, `vista_en`). Desaparece de la lista principal, queda en un historial plegable desde el que se puede deshacer, y así hay registro de cuándo cambió la lista.
- Tabla `producto_compra`: nombre, cantidad, quién lo apuntó y quién lo compró. «Aceite, sal y leche» se apunta como tres productos y no se duplican los pendientes. La «última actualización» es el `updated_at` más reciente; los pendientes se agrupan por el día en que se apuntaron. Lo comprado se borra solo a los 30 días.
- Tabla `jornada_limpieza`: día, minutos trabajados, precio por hora en céntimos (se guarda en cada día por si cambia la tarifa; 10 € por defecto, en `LIMPIEZA` de `src/lib/hogar.ts`), notas y `pagado`. Se agrupa por semanas de lunes a domingo con su total, y cada semana se marca como pagada de una vez.
- Tabla `titulo`: película o serie, plataforma y `vista_en`, con filtro por tipo.
- Tabla `restaurante`: nombre, dirección (con enlace a Google Maps), tipo de comida, notas y `visitado_en`. Se edita en la propia lista (`?editar=id` abre la fila como formulario, sin JavaScript).
- Kissbell puede leer y apuntar en la lista de la compra (`ver_lista_compra`, `anadir_a_la_compra`).

### Inicio

- Orden: cabecera con fecha y tiempo de hoy (Open-Meteo, gratis, desde el navegador con la ubicación del usuario o Madrid; `src/scripts/tiempo.ts`), aviso de hoy/mañana, previsión de la agenda a 10 días agrupada por día, Kissbell y las secciones.
- Aviso destacado con lo que queda de hoy y lo de mañana (de la agenda). Se puede cerrar; vuelve a salir si cambia lo que hay apuntado (la clave se guarda en `localStorage`).
- Dos columnas a partir de 1024 px; menú inferior en el móvil y superior desde 768 px.

### Consultas médicas

- Tabla `consulta` (por hijo): fecha, especialidad, centro, profesional, motivo, medidas en enteros (`peso_gramos`, `talla_mm`, `perimetro_mm`), notas e indicaciones, y `evento_id` opcional con la cita de la agenda. `hijo.fecha_nacimiento` (opcional) da la edad en cada consulta y el eje de la gráfica.
- `/hijos/consultas` (resumen de medidas, gráfica SVG hecha en el servidor, historial por meses con búsqueda y filtro), `/nueva` (acepta `?evento=` para rellenar desde la agenda), `/[id]` y `/[id]/editar`. Lógica en `src/lib/consultas.ts`.
- Kissbell: herramienta `buscar_consultas`. No interpreta diagnósticos.

### App instalable (PWA)

- `public/manifest.webmanifest`, iconos en `public/iconos/` (incluido «maskable» y el de iPhone), `public/sw.js` y `public/offline.html`.
- El service worker guarda en caché solo estáticos (`/_astro`, iconos, fuentes). Las páginas van siempre por la red, para no dejar datos de la familia en el móvil; sin conexión se muestra `offline.html`.
- `InstalarApp.astro`: botón «Instalar» en Android (evento `beforeinstallprompt`, capturado en `Base.astro`) y pasos con Compartir en iPhone. Se oculta si ya está instalada.

### Voz

- `src/scripts/voz.ts`: dictado con la Web Speech API del navegador (Chrome, Edge, Safari). Al terminar la frase se envía solo. Donde no existe, el botón se oculta. Sin servidor ni coste.

### Versiones

- La versión sale de `package.json` (`src/lib/version.ts`) y se enseña en Inicio, Mi perfil y `/novedades`, que lee `CHANGELOG.md`.
- Al publicar: `npm version minor` (o `patch`), añadir la entrada en `CHANGELOG.md` con la misma versión y fecha, y hacer el PR.

## Próximos pasos

1. Hijos: tomas y comidas.
2. Hijos: salud y crecimiento (con gráfica).
3. PWA instalable y resumen del día más completo en Inicio.
