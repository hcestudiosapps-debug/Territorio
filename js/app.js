'use strict';

/* ================================================================
   TERRITORIA GIS V4 — ORCHESTRATOR & APPLICATION SHELL
   ================================================================ */

// ================================================================
// ESTADO GLOBAL COMPARTIDO
// ================================================================
let preguntas = [];

// ================================================================
// UTILIDADES DOM
// ================================================================
function $(id) {
  return document.getElementById(id);
}

function $$(selector, context) {
  return (context || document).querySelectorAll(selector);
}

function escondeModales() {
  $$('.modal-fondo').forEach(m => m.classList.add('hidden'));
}

function cerrarModal(id) {
  $(id)?.classList.add('hidden');
}

// ================================================================
// UTILIDADES DE ALERTA & TOAST
// ================================================================
function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), CONFIG.TOAST_DURATION);
}

// ================================================================
// UTILIDADES DE FECHAS
// ================================================================
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function lunesISO() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}

function hace7ISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function formatearFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatearHora(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ================================================================
// ESTADO DE RED
// ================================================================
function actualizarEstadoRed() {
  const el = $('hdr-status');
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = '● Online';
    el.className = 'hdr-status on';
  } else {
    el.textContent = '● Offline';
    el.className = 'hdr-status off';
  }
}

// ================================================================
// PWA: REGISTRO DE SERVICE WORKER
// ================================================================
function registrarSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log('Service Worker registrado con éxito:', reg.scope);
        
        // Escuchar por actualizaciones en segundo plano
        reg.addEventListener('updatefound', () => {
          const nuevoWorker = reg.installing;
          nuevoWorker.addEventListener('statechange', () => {
            if (nuevoWorker.state === 'installed' && navigator.serviceWorker.controller) {
              mostrarToastActualizacion();
            }
          });
        });
      })
      .catch(err => console.warn('Fallo al registrar Service Worker:', err));
  }
}

function mostrarToastActualizacion() {
  const t = $('toast');
  if (!t) return;
  t.innerHTML = `🔄 Nueva versión de la app instalada. <a href="#" onclick="window.location.reload(); return false;" style="color:#ffffff;text-decoration:underline;margin-left:8px;font-weight:800">Actualizar ahora</a>`;
  t.classList.add('visible');
}

// ================================================================
// ROUTING & NAVEGACIÓN
// ================================================================
const SECTION_HANDLERS = {
  'e-ini': cargarInicioE,
  'e-nv': abrirForm,
  'e-his': cargarHis,
  'a-db': adminDB,
  'a-ent': adminEnts,
  'a-usr': adminUsrs,
  'a-preg': adminPregs,
  'a-map': adminMapa,
  'a-rep': repPorEntrevistadora,
  'a-est': cargarEstadisticas
};

function irSec(id, btn, navId) {
  SECCIONES.forEach(s => $(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
  
  if (navId && btn) {
    $$(`#${navId} .nt`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else if (!navId) {
    // Si navegamos desde sidebar desktop en admin
    $$('.sidebar .sb-item').forEach(b => b.classList.remove('active'));
    const sbBtn = document.querySelector(`.sidebar .sb-item[data-sidebar-section="${id}"]`);
    if (sbBtn) sbBtn.classList.add('active');
  }
  
  $('main-area')?.scrollTo(0, 0);
}

// ================================================================
// TEMA VISUAL CLARO/OSCURO
// ================================================================
function inicializarTema() {
  const btn = $('btn-theme');
  if (!btn) return;

  const temaGuardado = localStorage.getItem('eft_theme') || 'light';
  aplicarTema(temaGuardado);

  btn.addEventListener('click', () => {
    const nuevoTema = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    aplicarTema(nuevoTema);
  });
}

function aplicarTema(tema) {
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  
  if (tema === 'dark') {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
    localStorage.setItem('eft_theme', 'dark');
  } else {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
    localStorage.setItem('eft_theme', 'light');
  }
}

// ================================================================
// INICIALIZACIÓN Y EVENTOS PRINCIPALES
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Cargar preferencias de tema
  inicializarTema();

  // 2. Comprobar sesión de usuario guardada
  const usuarioSesion = localStorage.getItem(STORAGE_KEYS.USUARIO);
  if (usuarioSesion) {
    try {
      iniciarApp(JSON.parse(usuarioSesion));
    } catch (e) {
      localStorage.removeItem(STORAGE_KEYS.USUARIO);
    }
  }

  // 3. Registrar Service Worker para PWA
  registrarSW();

  // 4. Configurar estado de red y sincronizadores
  actualizarEstadoRed();
  window.addEventListener('online', () => {
    actualizarEstadoRed();
    syncQ();
  });
  window.addEventListener('offline', () => {
    actualizarEstadoRed();
  });

  // 5. Configurar manejadores de Auth (Login / Logout)
  $('btn-login')?.addEventListener('click', login);
  $('ip')?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('iu')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('ip')?.focus(); });

  $$('.btn-sal-hdr, .btn-sal-sb').forEach(el => {
    el.addEventListener('click', salir);
  });

  // 6. Configurar manejador de navegación Sidebar Desktop (Admin)
  $$('.sidebar .sb-item[data-sidebar-section]').forEach(el => {
    el.addEventListener('click', function () {
      const sec = this.dataset.sidebarSection;
      const handler = SECTION_HANDLERS[sec];
      irSec(sec);
      if (handler) handler();
    });
  });

  // 7. Configurar manejador de navegación Dock Móvil
  $$('.nav-mob .nt[data-nav-section]').forEach(el => {
    el.addEventListener('click', function () {
      const sec = this.dataset.navSection;
      const navId = this.dataset.navId;
      const handler = SECTION_HANDLERS[sec];
      irSec(sec, this, navId);
      if (handler) handler();
    });
  });

  // 8. Botones de acción directa en el panel de inicio del entrevistador
  $('btn-nueva-ent')?.addEventListener('click', () => {
    const btnNav = document.querySelector('#nav-e .nt[data-nav-section="e-nv"]');
    irSec('e-nv', btnNav, 'nav-e');
    abrirForm();
  });

  $('btn-ver-reg')?.addEventListener('click', () => {
    const btnNav = document.querySelector('#nav-e .nt[data-nav-section="e-his"]');
    irSec('e-his', btnNav, 'nav-e');
    cargarHis();
  });

  // 9. Guardar y Cancelar Entrevista
  $('btn-guardar')?.addEventListener('click', guardarEnt);
  $('btn-can-nv')?.addEventListener('click', () => {
    const btnNav = document.querySelector('#nav-e .nt[data-nav-section="e-ini"]');
    irSec('e-ini', btnNav, 'nav-e');
    cargarInicioE();
  });

  // 10. Forzar sincronización manual
  $('btn-sync-now')?.addEventListener('click', syncQ);
  $('sync-badge')?.addEventListener('click', syncQ);

  // 11. Filtros y Búsqueda en panel administrativo de entrevistas
  $('fil-usr')?.addEventListener('change', aplicarFiltrosTablaLocal);
  $('fil-fecha')?.addEventListener('change', aplicarFiltrosTablaLocal);
  $('fil-busqueda')?.addEventListener('input', aplicarFiltrosTablaLocal);
  $('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltrosEnts);

  // 12. Paginación
  $('btn-pag-prev')?.addEventListener('click', () => cambiarPagina(-1));
  $('btn-pag-next')?.addEventListener('click', () => cambiarPagina(1));

  // 13. Filtros del Mapa de Cobertura
  $('fil-map-dia')?.addEventListener('change', actualizarMapa);
  $('fil-map-ses')?.addEventListener('change', actualizarMapa);
  $('btn-map-all-usrs')?.addEventListener('click', () => seleccionarUsuarioMapa(''));

  // 14. Panel de reportes
  $$('[data-reporte]').forEach(el => {
    el.addEventListener('click', function () {
      const tipo = this.dataset.reporte;
      const handlers = {
        'entrevistadora': repPorEntrevistadora,
        'dia': repPorDia,
        'respuestas': repRespuestas,
        'csv': exportarCSV
      };
      
      // Remover clase active de todos los cards de reportes
      $$('.rep-card').forEach(c => c.classList.remove('active'));
      this.classList.add('active');

      if (handlers[tipo]) handlers[tipo]();
    });
  });

  // 15. Modales — triggers de cerrado general
  $$('[data-modal-close]').forEach(el => {
    el.addEventListener('click', function () {
      cerrarModal(this.dataset.modalClose);
    });
  });

  $$('.modal-fondo').forEach(el => {
    el.addEventListener('click', function (e) {
      if (e.target === this) this.classList.add('hidden');
    });
  });

  // 16. Modal Usuarios (CRUD Admin)
  $('btn-add-usr')?.addEventListener('click', () => abrirModalUsr());
  $('btn-grd-usr')?.addEventListener('click', guardarUsr);

  // 17. Modal Preguntas (CRUD Admin)
  $('btn-add-preg')?.addEventListener('click', () => abrirModalPreg());
  $('btn-grd-preg')?.addEventListener('click', guardarPreg);
  $('mp-tipo')?.addEventListener('change', toggleOpts);

  // 18. Fotos adjuntas (Delegación de carga de imágenes)
  ['casa', 'idf', 'idr'].forEach(tipo => {
    const el = $('fi-' + tipo);
    if (el) {
      el.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          onFoto(e.target.files[0], tipo);
        }
      });
    }
  });

  // 19. Delegación de clics dinámicos en la tabla de entrevistas
  $('tbody-ents')?.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx);
    const id = btn.dataset.id;
    
    if (action === 'ver-ent') {
      verDetAdmin(idx);
    } else if (action === 'del-ent') {
      confirmarEliminar(id);
    }
  });

  // 20. Delegación de clics en la lista de usuarios
  $('lista-usr')?.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    
    if (action === 'edit-usr') {
      abrirModalUsr(id);
    } else if (action === 'toggle-usr') {
      const activeState = btn.dataset.activo === 'true';
      toggleActivo(id, !activeState);
    }
  });

  // 21. Delegación de clics en la lista de preguntas
  $('lista-preg')?.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    
    if (action === 'edit-preg') {
      abrirModalPreg(id);
    } else if (action === 'del-preg') {
      eliminarPreg(id);
    }
  });

  // 22. Delegación de clics en modal de detalle (botón eliminar)
  $('m-det-c')?.addEventListener('click', function (e) {
    const btn = e.target.closest('#btn-del-from-det');
    if (btn) {
      const id = btn.dataset.id;
      cerrarModal('m-det');
      confirmarEliminar(id);
    }
  });

  // 23. Intervalo de Sincronización Automática
  setInterval(syncQ, CONFIG.SYNC_INTERVAL);
});
