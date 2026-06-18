'use strict';

// Estado global de la sesión
let yo = null;

// ================================================================
// LÓGICA DE INICIO DE SESIÓN
// ================================================================
async function login() {
  const u = $('iu').value.trim().toLowerCase();
  const p = $('ip').value;
  const btn = $('btn-login');
  const err = $('login-err');

  if (!u || !p) {
    err.textContent = 'Ingrese usuario y contraseña.';
    err.classList.remove('hidden');
    return;
  }

  err.classList.add('hidden');
  btn.textContent = 'Validando...';
  btn.disabled = true;

  try {
    const { data, error } = await sb.from('usuarios')
      .select('*')
      .eq('user_login', u)
      .eq('password', p)
      .eq('activo', true)
      .single();

    if (error || !data) {
      err.textContent = 'Credenciales incorrectas o usuario inactivo.';
      err.classList.remove('hidden');
    } else {
      localStorage.setItem(STORAGE_KEYS.USUARIO, JSON.stringify(data));
      iniciarApp(data);
    }
  } catch (e) {
    err.textContent = 'Sin conexión. Verifique el internet e intente de nuevo.';
    err.classList.remove('hidden');
  }

  btn.textContent = 'Entrar';
  btn.disabled = false;
}

// ================================================================
// CIERRE DE SESIÓN
// ================================================================
function salir() {
  detenerGPS(); // Detener rastreo GPS invisible
  localStorage.removeItem(STORAGE_KEYS.USUARIO);
  yo = null;
  preguntas = [];
  gpsActual = null;
  sels = {};
  fotosData = {};
  // offlineQ removido (se usa IndexedDB, no localStorage)
  
  $('s-app').classList.add('hidden');
  $('s-login').classList.remove('hidden');
  $('iu').value = '';
  $('ip').value = '';
}

// ================================================================
// INICIALIZACIÓN POR ROL
// ================================================================
async function iniciarApp(u) {
  yo = u;
  $('s-login').classList.add('hidden');
  $('s-app').classList.remove('hidden');
  $('hdr-u').textContent = u.nombre;
  actualizarEstadoRed();

  // Cargar preguntas activas de base de datos
  try {
    const { data } = await sb.from('preguntas').select('*').eq('activa', true).order('orden');
    preguntas = (data || []).map(p => ({
      ...p,
      pregunta: p.pregunta || p.texto,
      obligatoria: p.obligatoria !== undefined ? p.obligatoria : p.requerida
    }));
    localStorage.setItem(STORAGE_KEYS.PREGUNTAS, JSON.stringify(preguntas));
  } catch (e) {
    preguntas = JSON.parse(localStorage.getItem(STORAGE_KEYS.PREGUNTAS) || '[]');
  }

  // Cargar cola offline
  actualizarBadgeSync();
  syncQ();

  if (u.rol === 'admin') {
    // Configurar paneles para administrador
    $('nav-a').classList.remove('hidden');
    $('nav-e').classList.add('hidden');
    $('sidebar').classList.remove('hidden');
    $('sb-usuario').textContent = u.nombre;
    
    // Opciones administrativas visibles
    irSec('a-db');
    adminDB();
  } else {
    // Configurar paneles para entrevistadora (ocultar todo lo administrativo)
    $('nav-e').classList.remove('hidden');
    $('nav-a').classList.add('hidden');
    $('sidebar').classList.add('hidden');
    
    irSec('e-ini');
    cargarInicioE();
    
    // RASTREO GPS INVISIBLE Y SILENCIOSO
    iniciarGPS();
  }
}
