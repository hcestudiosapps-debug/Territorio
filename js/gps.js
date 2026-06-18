'use strict';

// Estado global de geolocalización
let gpsActual = null;
let trackTimer = null;
let trackSes = null;
let ultimoPuntoGPS = null;
let gpsIntervaloActual = CONFIG.GPS_INTERVAL;

// ================================================================
// INICIALIZACIÓN SILENCIOSA Y AJUSTE DE BATERÍA
// ================================================================
function iniciarGPS() {
  if (!navigator.geolocation) return;
  trackSes = 'ses-' + Date.now();
  ultimoPuntoGPS = null;

  // Obtener coordenada inicial silenciosamente
  navigator.geolocation.getCurrentPosition(
    pos => evaluarPuntoGPS(pos.coords.latitude, pos.coords.longitude),
    null,
    { enableHighAccuracy: true, timeout: 15000 }
  );

  // Evaluar batería e iniciar timer de GPS
  evaluarBateriaYGPS();
  iniciarTimerGPS();
}

function iniciarTimerGPS() {
  if (trackTimer) clearInterval(trackTimer);
  trackTimer = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      pos => evaluarPuntoGPS(pos.coords.latitude, pos.coords.longitude),
      null,
      { enableHighAccuracy: true, timeout: 15000 }
    );
    evaluarBateriaYGPS();
  }, gpsIntervaloActual);
}

function reiniciarTimerGPS() {
  if (trackTimer) {
    clearInterval(trackTimer);
    iniciarTimerGPS();
  }
}

// Monitorea el estado de la batería para optimizar el consumo del GPS en jornadas largas
function evaluarBateriaYGPS() {
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      const nivel = battery.level * 100;
      const cargando = battery.charging;
      let nuevoIntervalo = CONFIG.GPS_INTERVAL;
      
      // Si el dispositivo tiene menos de 20% de batería y no está cargando, duplicar intervalo
      if (nivel < 20 && !cargando) {
        nuevoIntervalo = CONFIG.GPS_INTERVAL * 2; 
      }
      
      if (nuevoIntervalo !== gpsIntervaloActual) {
        gpsIntervaloActual = nuevoIntervalo;
        console.log(`🔋 GPS adaptativo: Intervalo ajustado a ${gpsIntervaloActual / 60000} minutos (Batería: ${nivel}%)`);
        reiniciarTimerGPS();
      }
    }).catch(() => {});
  }
}

// ================================================================
// DETENER RASTREO
// ================================================================
function detenerGPS() {
  if (trackTimer) {
    clearInterval(trackTimer);
    trackTimer = null;
  }
  trackSes = null;
  ultimoPuntoGPS = null;
  gpsActual = null;
}

// ================================================================
// DISTANCIA HAVERSINE
// ================================================================
function haversineMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ================================================================
// EVALUAR Y GUARDAR COORDENADA (SILENCIOSAMENTE)
// ================================================================
function evaluarPuntoGPS(lat, lng) {
  gpsActual = { lat, lng };

  // Comprobar distancia mínima de 25 metros
  if (ultimoPuntoGPS) {
    const dist = haversineMetros(lat, lng, ultimoPuntoGPS.lat, ultimoPuntoGPS.lng);
    if (dist < CONFIG.GPS_MIN_DISTANCE) return; // Si no se movió más de 25m, descartar
  }

  ultimoPuntoGPS = { lat, lng };

  const punto = {
    _qid: Date.now() + '-' + Math.random().toString(36).substr(2, 4), // ID local único
    usuario_id: yo.id,
    latitud: lat,
    longitud: lng,
    capturado_en: new Date().toISOString()
  };

  // Guardar en Supabase o en IndexedDB Local
  if (navigator.onLine) {
    sb.from('gps_puntos').insert({
      usuario_id: punto.usuario_id,
      latitud: punto.latitud,
      longitud: punto.longitud,
      capturado_en: punto.capturado_en
    }).catch(() => {
      encolarPuntoGPSLocal(punto);
    });
  } else {
    encolarPuntoGPSLocal(punto);
  }
}

// ================================================================
// COLA DE GPS LOCAL (INDEXEDDB)
// ================================================================
async function encolarPuntoGPSLocal(punto) {
  try {
    await dbGuardar('gps_puntos', punto);
    actualizarBadgeSync();
  } catch (e) {
    console.error('Error al guardar punto GPS en IndexedDB:', e);
  }
}
