/**
 * Tiempo de hoy en la cabecera de Inicio, con Open-Meteo (gratis, sin clave).
 * Usa la ubicación del navegador si la dan; si no, Madrid. Se guarda media
 * hora en localStorage para no pedir el tiempo en cada visita.
 */

const MADRID = { lat: 40.4168, lon: -3.7038, nombre: "Madrid" };
const CACHE = "tiempo-hoy";
const MEDIA_HORA = 30 * 60 * 1000;

type Tiempo = { icono: string; texto: string; max: number; min: number; actual: number; lluvia: number; nombre: string; en: number };

/** Código WMO → icono y texto. De día o de noche para los despejados. */
function describir(codigo: number, esDeDia: boolean): { icono: string; texto: string } {
  if (codigo === 0) return esDeDia ? { icono: "☀️", texto: "Despejado" } : { icono: "🌙", texto: "Despejado" };
  if (codigo <= 2) return esDeDia ? { icono: "🌤️", texto: "Algo de nubes" } : { icono: "☁️", texto: "Algo de nubes" };
  if (codigo === 3) return { icono: "☁️", texto: "Nublado" };
  if (codigo <= 48) return { icono: "🌫️", texto: "Niebla" };
  if (codigo <= 57) return { icono: "🌦️", texto: "Llovizna" };
  if (codigo <= 67) return { icono: "🌧️", texto: "Lluvia" };
  if (codigo <= 77) return { icono: "🌨️", texto: "Nieve" };
  if (codigo <= 82) return { icono: "🌦️", texto: "Chubascos" };
  if (codigo <= 86) return { icono: "🌨️", texto: "Nieve" };
  return { icono: "⛈️", texto: "Tormenta" };
}

function pintar(el: HTMLElement, t: Tiempo) {
  el.innerHTML = "";
  const icono = document.createElement("span");
  icono.className = "tiempo-icono";
  icono.setAttribute("aria-hidden", "true");
  icono.textContent = t.icono;
  const datos = document.createElement("span");
  datos.className = "tiempo-datos";
  const linea = document.createElement("span");
  linea.className = "tiempo-linea";
  const grados = document.createElement("strong");
  grados.textContent = `${Math.round(t.actual)}°`;
  linea.append(grados, ` ${t.texto}`);
  const detalle = document.createElement("span");
  detalle.className = "tiempo-detalle";
  detalle.textContent = `Mín ${Math.round(t.min)}° · Máx ${Math.round(t.max)}°${t.lluvia >= 30 ? ` · ☔\u00a0${t.lluvia}%` : ""}`;
  datos.append(linea, detalle);
  el.append(icono, datos);
  el.setAttribute("aria-label", `Tiempo en ${t.nombre}: ${t.texto}, ${Math.round(t.actual)} grados, mínima ${Math.round(t.min)} y máxima ${Math.round(t.max)}`);
  el.title = `Tiempo en ${t.nombre}`;
  el.hidden = false;
}

async function consultar(lat: number, lon: number, nombre: string): Promise<Tiempo> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "Europe/Madrid",
    forecast_days: "1",
  }).toString();
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as {
    current: { temperature_2m: number; weather_code: number; is_day: number };
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] };
  };
  const desc = describir(d.current.weather_code, d.current.is_day === 1);
  return {
    ...desc,
    actual: d.current.temperature_2m,
    max: d.daily.temperature_2m_max[0],
    min: d.daily.temperature_2m_min[0],
    lluvia: d.daily.precipitation_probability_max[0] ?? 0,
    nombre,
    en: Date.now(),
  };
}

function ubicacion(): Promise<{ lat: number; lon: number; nombre: string }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(MADRID);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, nombre: "tu zona" }),
      () => resolve(MADRID),
      { maximumAge: 60 * 60 * 1000, timeout: 4000 },
    );
  });
}

export async function mostrarTiempo(el: HTMLElement) {
  try {
    const guardado = localStorage.getItem(CACHE);
    if (guardado) {
      const t = JSON.parse(guardado) as Tiempo;
      if (Date.now() - t.en < MEDIA_HORA) return pintar(el, t);
    }
  } catch {
    /* sin almacenamiento */
  }
  try {
    const u = await ubicacion();
    const t = await consultar(u.lat, u.lon, u.nombre);
    pintar(el, t);
    try {
      localStorage.setItem(CACHE, JSON.stringify(t));
    } catch {
      /* sin almacenamiento */
    }
  } catch {
    el.hidden = true; // sin red o sin servicio: no se enseña nada
  }
}
