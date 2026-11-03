# Conectar App-Llito con Google Calendar

Guía paso a paso para crear el proyecto gratuito de Google Cloud y obtener las credenciales. Se hace una sola vez y tarda unos 15 minutos. No hace falta tarjeta de crédito: la API de Google Calendar es gratuita para este uso.

> Los nombres de los menús de Google Cloud cambian de vez en cuando. Si algo no coincide exactamente, busca el texto entre comillas con el buscador de la parte superior de la consola.

## 1. Crear el proyecto

1. Entra en [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta de Google.
2. Arriba a la izquierda, pulsa el selector de proyecto y luego **«Proyecto nuevo»**.
3. Nombre: `App-Llito`. Organización: «Sin organización». Pulsa **«Crear»**.
4. Cuando termine, asegúrate de que el selector de arriba muestra `App-Llito`.

## 2. Activar la API de Google Calendar

1. Menú ☰ → **«APIs y servicios»** → **«Biblioteca»**.
2. Busca **«Google Calendar API»**, ábrela y pulsa **«Habilitar»**.

## 3. Configurar la pantalla de permisos (OAuth)

1. Menú ☰ → **«APIs y servicios»** → **«Pantalla de consentimiento de OAuth»** (en algunas cuentas aparece como **«Google Auth Platform»**). Pulsa **«Empezar»**.
2. **Información de la aplicación**: nombre `App-Llito` y tu correo como correo de asistencia.
3. **Audiencia**: elige **«Externo»**.
4. **Información de contacto**: tu correo. Acepta la política y pulsa **«Crear»**.

### Permisos que pide la app

1. Dentro de esa sección, ve a **«Acceso a los datos»** (o «Permisos») → **«Añadir o quitar permisos»**.
2. Marca estos tres (puedes buscarlos por el texto):
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/calendar` (Google Calendar API: ver, editar, compartir y eliminar calendarios)
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

## 5. Poner las credenciales en la app

**En local**, añade al archivo `.env`:

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
```

y reinicia `npm run dev`.

**En Vercel**: proyecto → **Settings → Environment Variables**, añade las mismas dos variables y vuelve a desplegar (Deployments → ⋯ → Redeploy).

## 6. Conectar desde la app

1. Abre la app → **Agenda** → **«Conectar con Google Calendar»** → **«Conectar con Google»**.
2. Elige la cuenta de Google.
3. Aparecerá **«Google no ha verificado esta aplicación»**. Pulsa **«Configuración avanzada»** → **«Ir a App-Llito (no seguro)»**. Es seguro: la app es tuya.
4. Marca la casilla de **Google Calendar** si aparece sin marcar y pulsa **«Continuar»**.
5. Vuelves a la app. Se habrá creado el calendario con el nombre de vuestro hogar y se habrá compartido con los correos de los demás miembros.

## 7. Que los avisos lleguen a cada móvil

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
