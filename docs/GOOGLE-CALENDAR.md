# Conectar App-Llito con Google (Calendar y Drive)

Guía paso a paso para crear el proyecto gratuito de Google Cloud y obtener las credenciales. Se hace una sola vez y tarda unos 15 minutos. No hace falta tarjeta de crédito: las APIs de Google Calendar y Drive son gratuitas para este uso.

Con esto funcionan dos cosas: la **agenda** sincronizada con Google Calendar y la **galería** de fotos y vídeos en Google Drive.

> Los nombres de los menús de Google Cloud cambian de vez en cuando. Si algo no coincide exactamente, busca el texto entre comillas con el buscador de la parte superior de la consola.

## 1. Crear el proyecto

1. Entra en [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta de Google.
2. Arriba a la izquierda, pulsa el selector de proyecto y luego **«Proyecto nuevo»**.
3. Nombre: `App-Llito`. Organización: «Sin organización». Pulsa **«Crear»**.
4. Cuando termine, asegúrate de que el selector de arriba muestra `App-Llito`.

## 2. Activar las APIs

1. Menú ☰ → **«APIs y servicios»** → **«Biblioteca»**.
2. Busca y pulsa **«Habilitar»** en estas tres, una a una:
   - **«Google Calendar API»** (agenda)
   - **«Google Drive API»** (galería)
   - **«Google Picker API»** (el selector para elegir la carpeta de la galería)

## 3. Configurar la pantalla de permisos (OAuth)

1. Menú ☰ → **«APIs y servicios»** → **«Pantalla de consentimiento de OAuth»** (en algunas cuentas aparece como **«Google Auth Platform»**). Pulsa **«Empezar»**.
2. **Información de la aplicación**: nombre `App-Llito` y tu correo como correo de asistencia.
3. **Audiencia**: elige **«Externo»**.
4. **Información de contacto**: tu correo. Acepta la política y pulsa **«Crear»**.

### Permisos que pide la app

1. Dentro de esa sección, ve a **«Acceso a los datos»** (o «Permisos») → **«Añadir o quitar permisos»**.
2. Marca estos cuatro (puedes buscarlos por el texto):
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/calendar` (Google Calendar API: ver, editar, compartir y eliminar calendarios)
   - `.../auth/drive.file` (Google Drive API: ver, editar, crear y eliminar **solo** los archivos de Drive que uses con esta app)
3. Pulsa **«Actualizar»** y luego **«Guardar»**.

### Publicar la app (importante)

1. Ve a **«Audiencia»** y pulsa **«Publicar aplicación»** → **«Confirmar»**. El estado debe quedar en **«En producción»**.
2. No pidas la verificación: no hace falta para una app familiar.

¿Por qué publicarla? En modo «Prueba», Google retira el permiso cada 7 días y habría que reconectar cada semana. En producción sin verificar funciona sin caducar; lo único es que Google muestra un aviso de «app no verificada» al conectar (ver paso 6).

## 4. Crear las credenciales

1. Ve a **«Clientes»** (o **«APIs y servicios» → «Credenciales» → «Crear credenciales» → «ID de cliente de OAuth»**).
2. Tipo de aplicación: **«Aplicación web»**. Nombre: `App-Llito web`.
3. En **«URIs de redirección autorizados»** añade estas dos (cambia la segunda por la URL real de Vercel):
   ```
   http://localhost:4321/api/google/callback
   https://app-llito.vercel.app/api/google/callback
   ```
4. Pulsa **«Crear»**. Google te muestra el **ID de cliente** y el **secreto del cliente**. Cópialos (puedes volver a verlos después en «Clientes»).

> Las URLs de *preview* de Vercel (las que cambian en cada pull request) no sirven para conectar Google. Conecta siempre desde la URL de producción o desde localhost.

## 5. Clave de API y número de proyecto (para la galería)

El selector de Google con el que se elige la carpeta de la galería necesita dos datos más.

**Clave de API**

1. **«APIs y servicios»** → **«Credenciales»** → **«Crear credenciales»** → **«Clave de API»**. Copia la clave.
2. Pulsa **«Editar clave de API»** (o el nombre de la clave) para restringirla:
   - **Restricciones de aplicación** → **«Sitios web»** → añade:
     ```
     https://app-llito.vercel.app/*
     http://localhost:4321/*
     ```
   - **Restricciones de API** → **«Restringir clave»** → marca solo **«Google Picker API»**.
3. **«Guardar»**.

**Número de proyecto**

1. Menú ☰ → **«Configuración de IAM y administración»** → **«Configuración»** (o pulsa el selector de proyecto arriba).
2. Copia el **«Número del proyecto»** (solo cifras, por ejemplo `123456789012`). No confundir con el «ID del proyecto».

## 6. Poner las credenciales en la app

**En local**, añade al archivo `.env`:

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
GOOGLE_API_KEY=AIzaSyxxxxxxxx
GOOGLE_PROJECT_NUMBER=123456789012
```

y reinicia `npm run dev`.

**En Vercel**: proyecto → **Settings → Environment Variables**, añade las mismas cuatro variables (entorno **Production**) y vuelve a desplegar (Deployments → ⋯ → Redeploy).

## 7. Conectar desde la app

1. Abre la app → **Agenda** → **«Conectar con Google Calendar»** → **«Conectar con Google»**.
2. Elige la cuenta de Google.
3. Aparecerá **«Google no ha verificado esta aplicación»**. Pulsa **«Configuración avanzada»** → **«Ir a App-Llito (no seguro)»**. Es seguro: la app es tuya.
4. Marca las casillas de **Google Calendar** y **Google Drive** si aparecen sin marcar y pulsa **«Continuar»**.
5. Vuelves a la app. Se habrá creado el calendario con el nombre de vuestro hogar y se habrá compartido con los correos de los demás miembros.

## 8. Que los avisos lleguen a cada móvil

Cada persona, una vez:

1. Acepta el correo de Google «… ha compartido un calendario contigo» (si no os llega porque la cuenta de la app no es de Google, compártelo desde **Agenda → Google Calendar → Compartir con otro correo de Google**).
2. Instala o abre la app **Google Calendar** en el móvil y comprueba que el calendario de la familia está marcado.
3. Google Calendar → Ajustes → el calendario de la familia → **Notificaciones predeterminadas**: añade «1 día antes» y «1 hora antes». En **Eventos de todo el día**: «El día anterior a las 20:00».

Los avisos que eliges al crear cada cita se aplican a la cuenta que conectó el calendario; el resto de la familia recibe sus notificaciones predeterminadas del paso 3.

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| `redirect_uri_mismatch` | La URL de redirección no coincide exactamente. Revisa el paso 4 (http/https, sin barra final). |
| «La API de Google Calendar no está activada» | Repite el paso 2 en el mismo proyecto. |
| «Google ha retirado el permiso» | Vuelve a conectar desde Agenda → Google Calendar. Si pasa cada semana, la app sigue en modo «Prueba» (paso 3). |
| «Google no ha dado acceso permanente» | Quita App-Llito en [myaccount.google.com/permissions](https://myaccount.google.com/permissions) y conecta de nuevo. |

## 9. Elegir la carpeta de la galería

Solo lo hace quien conectó Google, una vez:

1. Abre la app → **Hijos** → **Galería** (o la tarjeta Galería en Inicio).
2. Si la carpeta ya existe en tu Drive, pega su enlace en **«Enlace de la carpeta»** (`https://drive.google.com/drive/folders/…`).
3. Pulsa **«Elegir carpeta»**, selecciona la carpeta y pulsa **«Seleccionar»**.

La app solo puede ver lo que sube ella a esa carpeta (permiso `drive.file`), no el resto de tu Drive. Lo que metáis en la carpeta directamente desde Drive no aparece en la galería.

Si conectaste Google antes de que existiera la galería, la página te pedirá **«Dar permiso a Drive»**: vuelve a conectar y acepta el permiso nuevo. Se conserva el calendario.
