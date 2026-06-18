'use strict';

// ================================================================
// CONFIGURACIÓN GLOBAL — TERRITORIA GIS
// ================================================================
const CONFIG = {
  // Supabase Credentials
  SB_URL: 'https://mnilgerraozidfbzhazr.supabase.co',
  SB_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaWxnZXJyYW96aWRmYnpoYXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzQyNTUsImV4cCI6MjA5NzE1MDI1NX0.isB3Zzw01lfgSgpNCBxSdYRR0GkPtuHhpjpqG4gq-1g',
  
  // Parámetros de GPS
  GPS_INTERVAL: 3 * 60 * 1000,       // Cada 3 minutos
  GPS_MIN_DISTANCE: 25,              // O movimiento de 25 metros
  
  // Fotos
  PHOTO_MAX_WIDTH: 1024,             // Resolución óptima
  PHOTO_QUALITY: 0.7,                // Compresión base
  
  // Sincronización
  SYNC_INTERVAL: 30000,              // Cada 30 segundos
  TOAST_DURATION: 3500
};

// Secciones de la app
const SECCIONES = ['e-ini', 'e-nv', 'e-his', 'a-db', 'a-ent', 'a-usr', 'a-preg', 'a-map', 'a-rep', 'a-est'];

// Colores del mapa para entrevistadores
const COLORES_ENTREVISTADORES = [
  '#7b1c3e', // Guinda principal
  '#16803d', // Verde
  '#2563eb', // Azul
  '#ea580c', // Naranja
  '#7c3aed', // Morado
  '#0891b2', // Cian
  '#db2777', // Rosa
  '#dc2626'  // Rojo
];

// Claves de LocalStorage
const STORAGE_KEYS = {
  USUARIO: 'eft_usuario',
  PREGUNTAS: 'eft_preguntas',
  CONFIG: 'eft_config'
};

// Instancia global de Supabase
const sb = supabase.createClient(CONFIG.SB_URL, CONFIG.SB_KEY);

// ================================================================
// GESTOR DE ALMACENAMIENTO OFFLINE — INDEXEDDB (EVITA LÍMITE DE 5MB)
// ================================================================
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TerritoriaDB', 1);
    
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('entrevistas')) {
        db.createObjectStore('entrevistas', { keyPath: '_qid' });
      }
      if (!db.objectStoreNames.contains('gps_puntos')) {
        db.createObjectStore('gps_puntos', { keyPath: '_qid' });
      }
    };
    
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

async function dbGuardar(storeName, item) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
}

async function dbObtenerTodos(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = e => reject(e.target.error);
  });
}

async function dbEliminar(storeName, key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
}
