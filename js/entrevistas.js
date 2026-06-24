'use strict';

let sels = {}; // Estado local de selección de Sí/No
let fotosData = {}; // Almacena fotos en Base64 optimizadas
let entsCache = []; // Caché local de entrevistas cargadas

// ================================================================
// PANTALLA DE INICIO DEL ENTREVISTADOR
// ================================================================
async function cargarInicioE() {
  if (!yo) return;

  // Mostrar nombre de bienvenida
  const bvN = $('bv-n');
  if (bvN) bvN.textContent = `Hola, ${yo.nombre.split(' ')[0]} 👋`;

  // Actualizar badge de sincronización
  actualizarBadgeSync();

  // Fecha de hoy y de inicio de semana
  const hoy = hoyISO();
  const lun = lunesISO();

  try {
    // Contar desde Supabase si hay red
    let entsHoy = 0, entsSem = 0, entsTot = 0;

    if (navigator.onLine) {
      const { data } = await sb.from('entrevistas')
        .select('id, fecha_entrevista')
        .eq('usuario_id', yo.id);

      const all = data || [];
      entsTot = all.length;
      entsSem = all.filter(e => e.fecha_entrevista?.slice(0, 10) >= lun).length;
      entsHoy = all.filter(e => e.fecha_entrevista?.slice(0, 10) === hoy).length;
    }

    // Sumar entrevistas offline pendientes de esta sesión
    const locales = await dbObtenerTodos('entrevistas');
    const localesMias = locales.filter(e => e.usuario_id === yo.id);
    const localHoy = localesMias.filter(e => e.fecha_entrevista?.slice(0, 10) === hoy).length;
    const localSem = localesMias.filter(e => e.fecha_entrevista?.slice(0, 10) >= lun).length;

    if ($('e-hoy')) $('e-hoy').textContent = entsHoy + localHoy;
    if ($('e-sem')) $('e-sem').textContent = entsSem + localSem;
    if ($('e-tot')) $('e-tot').textContent = entsTot + localesMias.length;

    // Barra de meta diaria
    const metaCard = $('meta-c');
    const metaTxt = $('meta-txt');
    const metaBar = $('meta-bar');
    if (yo.meta && yo.meta > 0 && metaCard) {
      const totalHoy = entsHoy + localHoy;
      const pct = Math.min(100, Math.round((totalHoy / yo.meta) * 100));
      metaCard.style.display = 'block';
      if (metaTxt) metaTxt.textContent = `${totalHoy} / ${yo.meta} entrevistas`;
      if (metaBar) metaBar.style.width = pct + '%';
    } else if (metaCard) {
      metaCard.style.display = 'none';
    }

  } catch (e) {
    // Si falla la red, solo mostrar datos offline
    const locales = await dbObtenerTodos('entrevistas').catch(() => []);
    const localesMias = locales.filter(e => e.usuario_id === yo?.id);
    if ($('e-tot')) $('e-tot').textContent = localesMias.length;
    if ($('e-hoy')) $('e-hoy').textContent = localesMias.filter(e => e.fecha_entrevista?.slice(0, 10) === hoy).length;
    if ($('e-sem')) $('e-sem').textContent = localesMias.filter(e => e.fecha_entrevista?.slice(0, 10) >= lun).length;
  }
}


// ================================================================
function abrirForm() {
  sels = {};
  fotosData = {};
  
  // Limpiar fotos previas
  ['casa', 'idf', 'idr'].forEach(k => {
    const prev = $('prev-' + k);
    const fi = $('fi-' + k);
    if (prev) prev.innerHTML = '';
    if (fi) fi.value = '';
  });

  // Limpiar campos estáticos
  if ($('fn-total-18')) $('fn-total-18').value = '';
  if ($('fn-nombres')) $('fn-nombres').value = '';
  if ($('fn-paterno')) $('fn-paterno').value = '';
  if ($('fn-materno')) $('fn-materno').value = '';
  if ($('fn-edad')) $('fn-edad').value = '';
  if ($('fn-tel')) $('fn-tel').value = '';
  if ($('fn-colonia')) $('fn-colonia').value = '';
  if ($('fn-calle')) $('fn-calle').value = '';
  if ($('fn-seccion')) $('fn-seccion').value = '';
  if ($('fn-p1')) $('fn-p1').value = '';
  if ($('fn-p2')) $('fn-p2').value = '';
  if ($('fn-p3')) $('fn-p3').value = '';
  if ($('fn-p4')) $('fn-p4').value = '';
  if ($('fn-p5')) $('fn-p5').value = '';
  if ($('fn-p6')) $('fn-p6').value = '';
  if ($('fn-p7')) $('fn-p7').value = '';
  if ($('fn-p8')) $('fn-p8').value = '';
  if ($('fn-clasificacion')) $('fn-clasificacion').value = '';
  if ($('fn-observaciones')) $('fn-observaciones').value = '';

  // Renderizar formulario de preguntas dinámicas y candidato
  renderForm();
  
  // Intentar obtener GPS para adjuntarlo a la entrevista (invisible en background)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => { 
        gpsActual = { lat: pos.coords.latitude, lng: pos.coords.longitude }; 
        obtenerDireccionReversa(gpsActual.lat, gpsActual.lng);
      },
      null,
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
}

// Geocodificación inversa silenciosa por Nominatim API
async function obtenerDireccionReversa(lat, lng) {
  const elCalle = $('fn-calle');
  if (!elCalle || elCalle.value.trim() !== '') return; // No sobreescribir si ya escribió algo
  
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
    const data = await res.json();
    if (data && data.address) {
      const road = data.address.road || '';
      const num = data.address.house_number || '';
      const suburb = data.address.suburb || data.address.neighbourhood || data.address.city_district || '';
      const suggestion = `${road} ${num}, ${suburb}`.trim().replace(/^,|,$/, '').replace(/\s+/g, ' ');
      
      if (suggestion && !elCalle.value) {
        elCalle.value = suggestion;
      }
    }
  } catch (e) {
    console.warn('Fallo al geocodificar dirección inversa:', e);
  }
}

// ================================================================
// RENDERIZAR PREGUNTAS DINÁMICAS
// ================================================================
function renderForm() {
  const c = $('preguntas-dinamicas-container');
  if (!c) return;
  c.innerHTML = '';

  preguntas.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'preg-card';
    div.id = 'pc-' + p.id;
    let inp = '';
    const req = p.obligatoria ? '<span class="req-mark">*</span>' : '';

    if (p.tipo === 'texto') {
      inp = `<textarea class="inp grande" id="r-${p.id}" placeholder="Escriba aquí..."></textarea>`;
    } else if (p.tipo === 'numero') {
      inp = `<input type="number" class="inp" id="r-${p.id}" placeholder="0" inputmode="decimal">`;
    } else if (p.tipo === 'opciones') {
      let optionsList = [];
      try {
        optionsList = JSON.parse(p.opciones) || [];
      } catch (e) {
        optionsList = [];
      }
      inp = `<select class="inp" id="r-${p.id}">
               <option value="">-- Seleccione una opción --</option>
               ${optionsList.map(o => `<option value="${o}">${o}</option>`).join('')}
             </select>`;
    } else if (p.tipo === 'si_no' || p.tipo === 'sino') {
      inp = `<div class="opts opt-sino">
               <button type="button" class="opt" id="r-${p.id}-si" onclick="selOptPreg('${p.id}', 'si')">✓ Sí</button>
               <button type="button" class="opt" id="r-${p.id}-no" onclick="selOptPreg('${p.id}', 'no')">✗ No</button>
             </div>`;
    }

    div.innerHTML = `<div class="preg-lbl"><div class="preg-num">${i + 7}</div><div>${p.pregunta}${req}</div></div>${inp}`;
    c.appendChild(div);
  });
}

// ================================================================
// MANEJO DE SELECCIONES SÍ/NO
// ================================================================
function selOptSimpatiza(val) {
  sels['simpatiza'] = val;
  $('opt-simpatiza-si').classList.toggle('selected', val === 'si');
  $('opt-simpatiza-no').classList.toggle('selected', val === 'no');

  // Mostrar u ocultar campo "¿Cuál partido?"
  if (val === 'si') {
    $('div-partido-cual').classList.remove('hidden');
    $('fn-partido-cual').setAttribute('required', 'true');
  } else {
    $('div-partido-cual').classList.add('hidden');
    $('fn-partido-cual').removeAttribute('required');
    $('fn-partido-cual').value = '';
  }
}

function selOptCandidato(val) {
  sels['candidato'] = val;
  $('opt-cand-si').classList.toggle('selected', val === 'si');
  $('opt-cand-no').classList.toggle('selected', val === 'no');
}

function selOptPreg(id, val) {
  sels[id] = val;
  $(`r-${id}-si`)?.classList.toggle('selected', val === 'si');
  $(`r-${id}-no`)?.classList.toggle('selected', val === 'no');
}

// ================================================================
// PROCESAMIENTO Y COMPRESIÓN DE FOTOGRAFÍAS (CANVAS RESIZING)
// ================================================================
function onFoto(file, tipo) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      
      // Redimensionar al ancho máximo configurado
      if (w > CONFIG.PHOTO_MAX_WIDTH) {
        h = Math.round(h * CONFIG.PHOTO_MAX_WIDTH / w);
        w = CONFIG.PHOTO_MAX_WIDTH;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      
      // Compresión inteligente: ajustar calidad para quedar en un peso ideal (~100-150KB)
      let quality = CONFIG.PHOTO_QUALITY;
      let base64 = canvas.toDataURL('image/jpeg', quality);
      
      // Si el peso aproximado de la imagen base64 es mayor a 200KB, comprimir más
      if (base64.length > 270000) {
        quality = 0.5;
        base64 = canvas.toDataURL('image/jpeg', quality);
      }
      
      fotosData[tipo] = base64;
      renderPrevs(tipo);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderPrevs(tipo) {
  const c = $('prev-' + tipo);
  if (!c) return;
  const src = fotosData[tipo];
  if (src) {
    c.innerHTML = `
      <div class="foto-thumb-wrap">
        <img src="${src}" class="foto-thumb">
        <button class="foto-del" type="button" onclick="quitarFoto('${tipo}')">×</button>
      </div>`;
  } else {
    c.innerHTML = '';
  }
}

function quitarFoto(tipo) {
  delete fotosData[tipo];
  renderPrevs(tipo);
  const fi = $('fi-' + tipo);
  if (fi) fi.value = '';
}

// ================================================================
// GUARDAR ENTREVISTA
// ================================================================
async function guardarEnt() {
  const btn = $('btn-guardar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  // Validaciones manuales de campos obligatorios
  const totalMayores18 = parseInt($('fn-total-18')?.value) || null;
  const nombres = $('fn-nombres').value.trim();
  const paterno = $('fn-paterno').value.trim();
  const materno = $('fn-materno').value.trim();
  const edad = parseInt($('fn-edad')?.value) || null;
  const telefono = $('fn-tel').value.trim();
  const colonia = $('fn-colonia').value.trim();
  const calle = $('fn-calle').value.trim();
  const seccion = $('fn-seccion').value.trim();

  const p1 = $('fn-p1').value;
  const p2 = $('fn-p2').value;
  const p3 = $('fn-p3').value;
  const p4 = $('fn-p4').value;
  const p5 = $('fn-p5').value;
  const p6 = $('fn-p6').value;
  const p7 = $('fn-p7').value;
  const p8 = $('fn-p8').value;
  const clasificacion = $('fn-clasificacion').value;
  const observaciones = $('fn-observaciones').value.trim();

  let ok = true;

  const checkReq = (val, inputId) => {
    const el = $(inputId);
    if (!val) {
      el.classList.add('preg-err');
      setTimeout(() => el.classList.remove('preg-err'), 2000);
      ok = false;
    }
  };

  if (!totalMayores18 || totalMayores18 < 1) {
    $('fn-total-18')?.classList.add('preg-err');
    setTimeout(() => $('fn-total-18')?.classList.remove('preg-err'), 2000);
    ok = false;
  }
  checkReq(nombres, 'fn-nombres');
  checkReq(telefono, 'fn-tel');
  checkReq(paterno, 'fn-paterno');
  if (!edad || edad < 18 || edad > 110) {
    $('fn-edad')?.classList.add('preg-err');
    setTimeout(() => $('fn-edad')?.classList.remove('preg-err'), 2000);
    ok = false;
  }
  checkReq(colonia, 'fn-colonia');
  checkReq(calle, 'fn-calle');
  checkReq(seccion, 'fn-seccion');

  checkReq(p1, 'fn-p1');
  checkReq(p2, 'fn-p2');
  checkReq(p3, 'fn-p3');
  checkReq(p4, 'fn-p4');
  checkReq(p5, 'fn-p5');
  checkReq(p6, 'fn-p6');
  checkReq(p7, 'fn-p7');
  checkReq(p8, 'fn-p8');
  checkReq(clasificacion, 'fn-clasificacion');

  // Recolectar respuestas a preguntas dinámicas
  const respuestas = {};
  preguntas.forEach(p => {
    let v = '';
    if (p.tipo === 'texto' || p.tipo === 'numero' || p.tipo === 'opciones') {
      v = $('r-' + p.id)?.value?.trim() || '';
    } else if (p.tipo === 'si_no' || p.tipo === 'sino') {
      v = sels[p.id] || '';
    }

    if (p.obligatoria && !v) {
      ok = false;
      const card = $('pc-' + p.id);
      card?.classList.add('preg-err');
      setTimeout(() => card?.classList.remove('preg-err'), 2000);
    }
    if (v) respuestas[p.id] = v;
  });

  if (!ok) {
    toast('Complete los campos obligatorios (*)');
    btn.disabled = false;
    btn.textContent = '✓ Guardar entrevista';
    return;
  }

  // --- VALIDACIÓN ANTIDUPLICADOS POR TELÉFONO ---
  if (telefono && telefono.length >= 8) {
    try {
      // 1. Revisar en IndexedDB local
      const localEnts = await dbObtenerTodos('entrevistas');
      const duplicadoLocal = localEnts.some(e => e.telefono === telefono);
      
      if (duplicadoLocal) {
        toast('Error: Este teléfono ya está registrado localmente.', 4000);
        btn.disabled = false;
        btn.textContent = '✓ Guardar entrevista';
        $('fn-tel')?.classList.add('preg-err');
        setTimeout(() => $('fn-tel')?.classList.remove('preg-err'), 3000);
        return;
      }

      // 2. Revisar en Supabase si hay conexión
      if (navigator.onLine) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 6000));
        const reqPromise = sb.from('entrevistas').select('id').eq('telefono', telefono).limit(1);
        const { data, error } = await Promise.race([reqPromise, timeoutPromise]);
        if (data && data.length > 0) {
          toast('Error: Este teléfono ya ha sido encuestado en el sistema.', 5000);
          btn.disabled = false;
          btn.textContent = '✓ Guardar entrevista';
          $('fn-tel')?.classList.add('preg-err');
          setTimeout(() => $('fn-tel')?.classList.remove('preg-err'), 3000);
          return;
        }
      }
    } catch (e) {
      console.warn('No se pudo verificar el duplicado, procediendo...', e);
    }
  }

  // Estructurar objeto final
  const ent = {
    usuario_id: yo.id,
    total_mayores_18: totalMayores18,
    nombres: nombres,
    apellido_paterno: paterno,
    apellido_materno: materno || null,
    edad: edad,
    telefono: telefono || null,
    colonia: colonia,
    calle: calle,
    seccion: seccion,
    problema_principal: p1,
    conoce_diputada: p2,
    evaluacion_diputada: p3,
    cumplimiento_diputada: p4,
    simpatia_politica: p5,
    conocimiento_luis_emilio: p6,
    canal_posicionamiento: p7,
    voto_confianza: p8,
    clasificacion_interna: clasificacion,
    observaciones_internas: observaciones || null,
    foto_casa: fotosData['casa'] || null,
    foto_ine_frente: fotosData['idf'] || null,
    foto_ine_reverso: fotosData['idr'] || null,
    latitud: gpsActual?.lat || null,
    longitud: gpsActual?.lng || null,
    fecha_entrevista: new Date().toISOString(),
    respuestas: respuestas
  };

  // Enviar a Supabase o encolar localmente en IndexedDB
  if (navigator.onLine) {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000));
      const reqPromise = sb.from('entrevistas').insert(ent);
      const { error } = await Promise.race([reqPromise, timeoutPromise]);
      
      if (error) {
        await encolarEntrevistaLocal(ent);
        toast('Error Supabase: ' + (error.message || 'Desconocido'), 5000);
      } else {
        toast('✓ Entrevista enviada correctamente');
      }
    } catch (e) {
      await encolarEntrevistaLocal(ent);
      toast('Excepción: ' + (e.message || 'Red inestable'), 5000);
    }
  } else {
    await encolarEntrevistaLocal(ent);
    toast('Guardada localmente (Modo offline)');
  }

  btn.disabled = false;
  btn.textContent = '✓ Guardar entrevista';

  // Reiniciar formulario y redirigir
  sels = {};
  fotosData = {};
  gpsActual = null;
  
  if (yo.rol === 'admin') {
    irSec('a-db');
    adminDB();
  } else {
    cargarInicioE();
    const nt = document.querySelector('#nav-e .nt[data-nav-section="e-ini"]');
    irSec('e-ini', nt, 'nav-e');
  }
}

// ================================================================
// GUARDAR EN INDEXEDDB (OFFLINE)
// ================================================================
async function encolarEntrevistaLocal(ent) {
  try {
    ent._qid = Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    await dbGuardar('entrevistas', ent);
    actualizarBadgeSync();
  } catch (e) {
    console.error('Error al guardar entrevista offline:', e);
  }
}

// ================================================================
// VER HISTORIAL ENTREVISTADOR (COMBINA INDEXEDDB Y SUPABASE)
// ================================================================
async function cargarHis() {
  const c = $('lista-his');
  if (!c) return;
  c.innerHTML = '<div class="cargando"><span class="loader"></span>Cargando historial...</div>';

  try {
    // 1. Obtener entrevistas pendientes locales
    const locales = await dbObtenerTodos('entrevistas');
    const localesFiltradas = locales.filter(e => e.usuario_id === yo.id);

    // 2. Obtener de Supabase si hay red
    let remotos = [];
    if (navigator.onLine) {
      const { data } = await sb.from('entrevistas')
        .select('*')
        .eq('usuario_id', yo.id)
        .order('fecha_entrevista', { ascending: false })
        .limit(50);
      remotos = data || [];
    }

    // Combinar: primero las locales encoladas
    const combinadas = [
      ...localesFiltradas.map(x => ({ ...x, _offline: true })),
      ...remotos
    ];

    if (!combinadas.length) {
      c.innerHTML = '<div class="table-empty">Aún no tienes entrevistas registradas.</div>';
      return;
    }

    entsCache = combinadas;

    c.innerHTML = combinadas.map((e, i) => {
      const fechaStr = formatearFecha(e.fecha_entrevista);
      const horaStr = formatearHora(e.fecha_entrevista);
      const gps = (e.latitud && e.longitud) ? '📍 Con GPS' : 'Sin GPS';
      const fotosCount = (e.foto_casa ? 1 : 0) + (e.foto_ine_frente ? 1 : 0) + (e.foto_ine_reverso ? 1 : 0);
      
      const badge = e._offline 
        ? '<span class="badge am" style="margin-left:8px">Pendiente</span>' 
        : '<span class="badge vd" style="margin-left:8px">Enviado</span>';
      
      return `
        <div class="ent-item" onclick="verDetEnt(${i})">
          <div class="ent-av" style="${e._offline ? 'background:var(--warn-light);color:var(--warn)' : ''}">${i + 1}</div>
          <div class="ent-info">
            <div class="ent-n" style="display:flex;align-items:center;font-weight:800">${e.nombres} ${e.apellido_paterno} ${badge}</div>
            <div class="ent-d">${fechaStr} ${horaStr} · ${gps} · ${fotosCount} foto(s)</div>
          </div>
          <span style="font-size:18px;color:var(--text-muted)">❯</span>
        </div>`;
    }).join('');
  } catch (e) {
    c.innerHTML = '<div class="table-empty">Error al cargar. Verifique su conexión.</div>';
  }
}

// ================================================================
// MODAL DETALLE DE ENTREVISTA
// ================================================================
function verDetEnt(idx) {
  const e = entsCache[idx];
  if (!e) return;

  const fecha = new Date(e.fecha_entrevista);
  
  let html = `
    <div class="det-row"><span class="det-lbl">Folio</span><span class="det-val">${e.folio_vivienda || 'Pendiente de sincronizar'}</span></div>
    <div class="det-row"><span class="det-lbl">Nº Persona</span><span class="det-val">${e.persona_entrevistada_num || 'Pendiente de sincronizar'}</span></div>
    <div class="det-row"><span class="det-lbl">Nombre</span><span class="det-val">${e.nombres} ${e.apellido_paterno} ${e.apellido_materno || ''}</span></div>
    <div class="det-row"><span class="det-lbl">Mayores de 18</span><span class="det-val">${e.total_mayores_18 || 'No especificado'}</span></div>
    <div class="det-row"><span class="det-lbl">Teléfono</span><span class="det-val">${e.telefono || 'No proporcionado'}</span></div>
    <div class="det-row"><span class="det-lbl">Dirección</span><span class="det-val">${e.calle}, Col. ${e.colonia || ''}</span></div>
    <div class="det-row"><span class="det-lbl">Sección</span><span class="det-val">${e.seccion}</span></div>
    
    <div class="sec-tit" style="margin-top:16px">Cuestionario</div>
    <div class="det-row"><span class="det-lbl">P1. Problema Principal</span><span class="det-val">${e.problema_principal || '—'}</span></div>
    <div class="det-row"><span class="det-lbl">P2. Conoce Diputada</span><span class="det-val">${e.conoce_diputada || '—'}</span></div>
    <div class="det-row"><span class="det-lbl">P3. Evaluación Dip.</span><span class="det-val">${e.evaluacion_diputada || '—'}</span></div>
    <div class="det-row"><span class="det-lbl">P4. Cumplimiento Dip.</span><span class="det-val">${e.cumplimiento_diputada || '—'}</span></div>
    <div class="det-row"><span class="det-lbl">P5. Simpatía Partido</span><span class="det-val">${e.simpatia_politica || '—'}</span></div>
    <div class="det-row"><span class="det-lbl">P6. Conoce L. Emilio</span><span class="det-val">${e.conocimiento_luis_emilio || '—'}</span></div>
    <div class="det-row"><span class="det-lbl">P7. Canal L. Emilio</span><span class="det-val">${e.canal_posicionamiento || '—'}</span></div>
    <div class="det-row"><span class="det-lbl">P8. Voto Confianza</span><span class="det-val">${e.voto_confianza || '—'}</span></div>

    <div class="sec-tit" style="margin-top:16px">Clasificación Interna</div>
    <div class="det-row"><span class="det-lbl">Clasificación</span><span class="det-val">${e.clasificacion_interna || '—'}</span></div>
    <div class="det-row"><span class="det-lbl">Observaciones Internas</span><span class="det-val">${e.observaciones_internas || 'Ninguna'}</span></div>
    
    <div class="sec-tit" style="margin-top:16px">Otros Datos</div>
    <div class="det-row"><span class="det-lbl">Fecha</span><span class="det-val">${fecha.toLocaleDateString('es-MX')} a las ${fecha.toLocaleTimeString('es-MX')}</span></div>
  `;

  if (e.respuestas && Object.keys(e.respuestas).length) {
    html += '<div class="sec-tit">Respuestas Dinámicas</div>';
    preguntas.forEach(p => {
      if (e.respuestas[p.id]) {
        const val = p.tipo === 'si_no' ? (e.respuestas[p.id] === 'si' ? 'Sí' : 'No') : e.respuestas[p.id];
        html += `<div class="det-row"><span class="det-lbl">${p.pregunta}</span><span class="det-val">${val}</span></div>`;
      }
    });
  }

  // Mostrar fotos individuales
  let fotosHtml = '';
  if (e.foto_casa) fotosHtml += `<div class="det-foto-card"><div class="det-foto-lbl">Foto de la Vivienda</div><img src="${e.foto_casa}" class="det-foto"></div>`;
  if (e.foto_ine_frente) fotosHtml += `<div class="det-foto-card"><div class="det-foto-lbl">INE Frente</div><img src="${e.foto_ine_frente}" class="det-foto"></div>`;
  if (e.foto_ine_reverso) fotosHtml += `<div class="det-foto-card"><div class="det-foto-lbl">INE Reverso</div><img src="${e.foto_ine_reverso}" class="det-foto"></div>`;
  
  if (fotosHtml) {
    html += '<div class="sec-tit">Fotografías</div><div style="display:flex;flex-direction:column;gap:12px">' + fotosHtml + '</div>';
  }

  $('m-det-c').innerHTML = html;
  $('m-det').classList.remove('hidden');
}
