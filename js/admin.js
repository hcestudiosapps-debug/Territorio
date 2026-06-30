'use strict';

let usrsCache = []; // Caché de usuarios en memoria
let filteredEnts = []; // Caché de entrevistas filtradas
let currentPage = 1;
const itemsPerPage = 10;

// ================================================================
// DASHBOARD DE ADMINISTRACIÓN
// ================================================================
async function adminDB() {
  const hoy = hoyISO();
  const lun = lunesISO();

  $('a-fecha-hoy').textContent =
    new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  try {
    const [{ data: ents }, { data: usrs }] = await Promise.all([
      sb.from('entrevistas').select('id,usuario_id,fecha_entrevista,conoce_candidato,seccion'),
      sb.from('usuarios').select('*')
    ]);

    const e = ents || [];
    const u = usrs || [];
    usrsCache = u;

    // Métricas principales
    const activeUsrs = u.filter(x => x.activo && x.rol === 'entrevistador').length;
    const todayEnts = e.filter(x => x.fecha_entrevista?.slice(0, 10) === hoy).length;
    
    // Conteo de Luis Emilio
    const candSi = e.filter(x => x.conoce_candidato === 'si').length;
    const candNo = e.filter(x => x.conoce_candidato === 'no').length;

    $('a-tot').textContent = e.length;
    $('a-hoy').textContent = todayEnts;
    $('a-nusr').textContent = activeUsrs;
    $('a-cand-si').textContent = candSi;
    $('a-cand-no').textContent = candNo;

    // Calcular productividad y ranking de entrevistadoras
    const byUsr = {};
    e.forEach(ent => {
      if (!byUsr[ent.usuario_id]) byUsr[ent.usuario_id] = { total: 0, hoy: 0 };
      byUsr[ent.usuario_id].total++;
      if (ent.fecha_entrevista?.slice(0, 10) === hoy) byUsr[ent.usuario_id].hoy++;
    });

    const ranking = u
      .filter(usr => usr.rol === 'entrevistador')
      .map(usr => ({ ...usr, stats: byUsr[usr.id] || { total: 0, hoy: 0 } }))
      .sort((a, b) => b.stats.total - a.stats.total);

    const posClases = ['gold', 'silver', ''];
    $('ranking').innerHTML = ranking.map((usr, i) => `
      <div class="rk-card">
        <div class="rk-pos ${posClases[i] || ''}">${i + 1}</div>
        <div class="rk-avatar">${usr.nombre.charAt(0).toUpperCase()}</div>
        <div class="rk-nombre">${usr.nombre}</div>
        <div class="rk-sub">${usr.activo ? 'Activa' : 'Inactiva'}</div>
        <div class="rk-stats">
          <div class="rk-st"><div class="rk-st-n">${usr.stats.total}</div><div class="rk-st-l">Total</div></div>
          <div class="rk-st"><div class="rk-st-n">${usr.stats.hoy}</div><div class="rk-st-l">Hoy</div></div>
        </div>
      </div>
    `).join('') || '<div class="table-empty">No hay datos de entrevistadoras.</div>';

    // Calcular Top Secciones Electorales
    const bySeccion = {};
    e.forEach(ent => {
      if (ent.seccion) {
        bySeccion[ent.seccion] = (bySeccion[ent.seccion] || 0) + 1;
      }
    });

    const topSecciones = Object.entries(bySeccion)
      .map(([seccion, total]) => ({ seccion, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Mostrar Top 5

    $('a-top-secciones').innerHTML = topSecciones.map((sec, i) => `
      <div class="seccion-item">
        <div class="sec-badge">#${i + 1}</div>
        <div class="sec-info">
          <div class="sec-title">Sección ${sec.seccion}</div>
          <div class="sec-desc">${sec.total} entrevistas registradas</div>
        </div>
      </div>
    `).join('') || '<div class="table-empty">Sin secciones registradas.</div>';

    // Gráficos SVG interactivos
    renderDashboardCharts(e, u.filter(usr => usr.rol === 'entrevistador'));

  } catch (err) {
    toast('Error al cargar dashboard');
  }
}

// Renderizador de Gráficos SVG Interactivos en el Dashboard
function renderDashboardCharts(ents, usrs) {
  const containerSemana = $('chart-semana-svg');
  const containerUsr = $('chart-usr-svg');
  if (!containerSemana || !containerUsr) return;

  // 1. Gráfico de Semana (últimos 7 días)
  const hoy = new Date();
  const dias = [];
  const countsDias = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(hoy.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const lbl = d.toLocaleDateString('es-MX', { weekday: 'short' });
    dias.push({ label: lbl.charAt(0).toUpperCase() + lbl.slice(1, 3), rawDate: dateStr });
    
    const count = ents.filter(e => e.fecha_entrevista?.slice(0, 10) === dateStr).length;
    countsDias.push(count);
  }

  const maxCountSemana = Math.max(...countsDias, 1);
  let svgSemana = `<svg width="100%" height="100%" viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">`;
  
  for (let l = 0; l <= 4; l++) {
    const y = 20 + l * 30;
    const val = Math.round(maxCountSemana - (l * maxCountSemana / 4));
    svgSemana += `
      <line x1="30" y1="${y}" x2="290" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3" />
      <text x="25" y="${y + 4}" font-size="9" fill="var(--text-muted)" text-anchor="end" font-weight="600">${val}</text>
    `;
  }

  dias.forEach((dia, i) => {
    const count = countsDias[i];
    const barHeight = (count / maxCountSemana) * 120;
    const x = 36 + i * 36;
    const y = 140 - barHeight;

    svgSemana += `
      <g>
        <rect x="${x}" y="${y}" width="20" height="${barHeight}" rx="4" fill="url(#barGrad)" />
        <text x="${x + 10}" y="${y - 6}" font-size="9" font-weight="700" fill="var(--primary)" text-anchor="middle">${count > 0 ? count : ''}</text>
        <text x="${x + 10}" y="156" font-size="10" font-weight="600" fill="var(--text-muted)" text-anchor="middle">${dia.label}</text>
      </g>
    `;
  });

  svgSemana += `
    <defs>
      <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="var(--primary-hover)" />
        <stop offset="100%" stop-color="var(--primary)" />
      </linearGradient>
    </defs>
  </svg>`;

  containerSemana.innerHTML = svgSemana;

  // 2. Gráfico por Entrevistadora (horizontal)
  const byUsr = {};
  ents.forEach(ent => {
    byUsr[ent.usuario_id] = (byUsr[ent.usuario_id] || 0) + 1;
  });

  const usrData = usrs.map(u => ({
    nombre: u.nombre.split(' ')[0],
    count: byUsr[u.id] || 0
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  const maxCountUsr = Math.max(...usrData.map(ud => ud.count), 1);
  let svgUsr = `<svg width="100%" height="100%" viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">`;
  
  usrData.forEach((ud, i) => {
    const barWidth = (ud.count / maxCountUsr) * 160;
    const y = 20 + i * 32;

    svgUsr += `
      <g>
        <text x="5" y="${y + 13}" font-size="10" font-weight="700" fill="var(--text-main)" text-anchor="start">${ud.nombre}</text>
        <rect x="90" y="${y}" width="${barWidth}" height="18" rx="4" fill="url(#barGradUsr)" />
        <text x="${95 + barWidth}" y="${y + 13}" font-size="10" font-weight="700" fill="var(--primary)">${ud.count}</text>
      </g>
    `;
  });

  svgUsr += `
    <defs>
      <linearGradient id="barGradUsr" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="var(--primary)" />
        <stop offset="100%" stop-color="var(--primary-hover)" />
      </linearGradient>
    </defs>
  </svg>`;

  containerUsr.innerHTML = svgUsr;
}

// ================================================================
// ADMIN — ENTREVISTAS (FILTRADO LOCAL Y PAGINACIÓN)
// ================================================================
async function adminEnts() {
  const sel = $('fil-usr');
  if (sel && sel.options.length <= 1) {
    try {
      const { data: usrs } = await sb.from('usuarios').select('id,nombre').eq('rol', 'entrevistador');
      (usrs || []).forEach(u => {
        const o = document.createElement('option');
        o.value = u.id;
        o.textContent = u.nombre;
        sel.appendChild(o);
      });
    } catch (e) { /* skip */ }
  }

  const tbody = $('tbody-ents');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="cargando"><span class="loader"></span>Cargando...</td></tr>`;

  try {
    const { data } = await sb.from('entrevistas').select('*').order('fecha_entrevista', { ascending: false }).limit(400);
    entsCache = data || [];

    if (!usrsCache.length) {
      const { data: u } = await sb.from('usuarios').select('id,nombre');
      usrsCache = u || [];
    }

    aplicarFiltrosTablaLocal();
  } catch (e) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Error al cargar entrevistas.</td></tr>';
  }
}

function aplicarFiltrosTablaLocal() {
  const usrFil = $('fil-usr').value;
  const fechaFil = $('fil-fecha').value;
  const busquedaFil = $('fil-busqueda').value.trim().toLowerCase();

  filteredEnts = entsCache.filter(e => {
    if (usrFil && e.usuario_id !== usrFil) return false;
    if (fechaFil && e.fecha_entrevista?.slice(0, 10) !== fechaFil) return false;
    
    if (busquedaFil) {
      // Buscar en los campos estáticos
      const nombreCompleto = `${e.nombres} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase();
      const calle = (e.calle || '').toLowerCase();
      const seccion = (e.seccion || '').toLowerCase();
      const obs = (e.observaciones || '').toLowerCase();
      const part = (e.partido_cual || '').toLowerCase();
      
      // Buscar en las respuestas dinámicas
      let textoRespuestas = '';
      if (e.respuestas) {
        textoRespuestas = Object.values(e.respuestas).join(' ').toLowerCase();
      }

      if (
        !nombreCompleto.includes(busquedaFil) &&
        !calle.includes(busquedaFil) &&
        !seccion.includes(busquedaFil) &&
        !obs.includes(busquedaFil) &&
        !part.includes(busquedaFil) &&
        !textoRespuestas.includes(busquedaFil)
      ) {
        return false;
      }
    }
    return true;
  });

  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = $('tbody-ents');
  if (!tbody) return;
  const total = filteredEnts.length;
  
  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No hay entrevistas con los filtros seleccionados.</td></tr>';
    $('table-info').textContent = 'Mostrando registros 0-0 de 0';
    $('btn-pag-prev').disabled = true;
    $('btn-pag-next').disabled = true;
    $('pag-current').textContent = '1';
    return;
  }

  const maxPage = Math.ceil(total / itemsPerPage);
  if (currentPage > maxPage) currentPage = maxPage;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, total);
  
  const pageItems = filteredEnts.slice(startIdx, endIdx);
  const getNombre = id => usrsCache.find(u => u.id === id)?.nombre || 'Desconocida';

  tbody.innerHTML = pageItems.map((e, idx) => {
    const globalIdx = startIdx + idx + 1;
    const fechaStr = formatearFecha(e.fecha_entrevista);
    const horaStr = formatearHora(e.fecha_entrevista);
    const gps = (e.latitud && e.longitud)
      ? '<span class="badge vd">GPS</span>'
      : '<span class="badge gz">Sin GPS</span>';
    const fotoCnt = (e.foto_casa ? 1 : 0) + (e.foto_ine_frente ? 1 : 0) + (e.foto_ine_reverso ? 1 : 0);
    const fotos = fotoCnt > 0
      ? `<span class="badge gd">${fotoCnt} foto${fotoCnt > 1 ? 's' : ''}</span>`
      : '<span class="badge gz">Sin fotos</span>';
    return `<tr>
      <td style="font-weight:700;color:var(--primary)">#${globalIdx}</td>
      <td>${getNombre(e.usuario_id)}</td>
      <td>${fechaStr} ${horaStr}</td>
      <td>${gps}</td>
      <td>${fotos}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-sm bord" data-action="ver-ent" data-idx="${startIdx + idx}">Ver</button>
          <button class="btn-sm rojo" data-action="del-ent" data-id="${e.id}">Eliminar</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  $('table-info').textContent = `Mostrando registros ${startIdx + 1}-${endIdx} de ${total}`;
  $('pag-current').textContent = currentPage;
  $('btn-pag-prev').disabled = currentPage === 1;
  $('btn-pag-next').disabled = currentPage === maxPage;
}

function cambiarPagina(dir) {
  currentPage += dir;
  renderTable();
}

function limpiarFiltrosEnts() {
  $('fil-usr').value = '';
  $('fil-fecha').value = '';
  $('fil-busqueda').value = '';
  aplicarFiltrosTablaLocal();
}

function verDetAdmin(idx) {
  const e = entsCache[idx];
  if (!e) return;

  const getNombre = id => usrsCache.find(u => u.id === id)?.nombre || 'Desconocida';
  const fecha = new Date(e.fecha_entrevista);

  let html = `
    <div class="det-row"><span class="det-lbl">Entrevistadora</span><span class="det-val">${getNombre(e.usuario_id)}</span></div>
    <div class="det-row"><span class="det-lbl">Ciudadano</span><span class="det-val">${e.nombres} ${e.apellido_paterno} ${e.apellido_materno || ''}</span></div>
    <div class="det-row"><span class="det-lbl">Teléfono</span><span class="det-val">${e.telefono || 'No proporcionado'}</span></div>
    <div class="det-row"><span class="det-lbl">Dirección</span><span class="det-val">${e.calle}</span></div>
    <div class="det-row"><span class="det-lbl">Sección Electoral</span><span class="det-val">${e.seccion}</span></div>
    <div class="det-row"><span class="det-lbl">Simpatiza</span><span class="det-val">${e.partido_cual ? `Sí (${e.partido_cual})` : 'No'}</span></div>
    <div class="det-row"><span class="det-lbl">Conoce Candidato</span><span class="det-val">${e.conoce_candidato ? (e.conoce_candidato === 'si' ? 'Sí' : 'No') : 'No responde'}</span></div>
    <div class="det-row"><span class="det-lbl">Fecha</span><span class="det-val">${fecha.toLocaleDateString('es-MX')} a las ${fecha.toLocaleTimeString('es-MX')}</span></div>
    <div class="det-row"><span class="det-lbl">Coordenadas GPS</span><span class="det-val">${e.latitud ? `${Number(e.latitud).toFixed(5)}, ${Number(e.longitud).toFixed(5)}` : 'No disponible'}</span></div>
    <div class="det-row"><span class="det-lbl">Observaciones</span><span class="det-val">${e.observaciones || 'Ninguna'}</span></div>
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

  let fotosHtml = '';
  if (e.foto_casa) fotosHtml += `<div class="det-foto-card"><div class="det-foto-lbl">Foto de la Vivienda</div><img src="${e.foto_casa}" class="det-foto"></div>`;
  if (e.foto_ine_frente) fotosHtml += `<div class="det-foto-card"><div class="det-foto-lbl">INE Frente</div><img src="${e.foto_ine_frente}" class="det-foto"></div>`;
  if (e.foto_ine_reverso) fotosHtml += `<div class="det-foto-card"><div class="det-foto-lbl">INE Reverso</div><img src="${e.foto_ine_reverso}" class="det-foto"></div>`;

  if (fotosHtml) {
    html += '<div class="sec-tit">Fotografías</div><div style="display:flex;flex-direction:column;gap:12px">' + fotosHtml + '</div>';
  }

  html += `<button class="popup-btn-del" id="btn-del-from-det" data-id="${e.id}">Eliminar esta entrevista</button>`;

  $('m-det-c').innerHTML = html;
  $('m-det').classList.remove('hidden');
}

function confirmarEliminar(id) {
  const btn = $('btn-conf-del');
  if (btn) {
    btn.onclick = async () => {
      const { error } = await sb.from('entrevistas').delete().eq('id', id);
      if (!error) {
        toast('Entrevista eliminada');
        cerrarModal('m-del');
        adminEnts();
      } else {
        toast('Error al eliminar');
      }
    };
  }
  $('m-del').classList.remove('hidden');
}

// ================================================================
// ADMIN — USUARIOS
// ================================================================
async function adminUsrs() {
  const c = $('lista-usr');
  if (!c) return;
  c.innerHTML = '<div class="cargando"><span class="loader"></span>Cargando...</div>';
  try {
    const { data } = await sb.from('usuarios').select('*').order('nombre');
    usrsCache = data || [];
    if (!data?.length) {
      c.innerHTML = '<div class="table-empty">No hay usuarios registrados.</div>';
      return;
    }

    c.innerHTML = data.map(u => `
      <div class="usr-item">
        <div class="usr-av" style="${u.activo ? '' : 'opacity:.4'}">${u.nombre.charAt(0).toUpperCase()}</div>
        <div class="usr-inf">
          <div class="usr-n">${u.nombre}</div>
          <div class="usr-e">
            @${u.user_login} ·
            <span class="badge ${u.rol === 'admin' ? 'gd' : 'az'}">${u.rol === 'admin' ? 'Admin' : 'Entrevistadora'}</span>
            <span class="badge ${u.activo ? 'vd' : 'rj'}" style="margin-left:4px">${u.activo ? 'Activo' : 'Inactivo'}</span>
            ${u.meta ? `· Meta: ${u.meta}/día` : ''}
          </div>
        </div>
        <div class="usr-acc">
          <button class="btn-sm bord" data-action="edit-usr" data-id="${u.id}">Editar</button>
          <button class="btn-sm ${u.activo ? 'rojo' : 'ok'}" data-action="toggle-usr" data-id="${u.id}" data-activo="${u.activo}">
            ${u.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button class="btn-sm rojo" data-action="del-usr" data-id="${u.id}">Eliminar</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    c.innerHTML = '<div class="table-empty">Error al cargar usuarios.</div>';
  }
}

function abrirModalUsr(id) {
  const usr = id ? usrsCache.find(u => u.id === id) : null;
  $('m-usr-t').textContent = usr ? '👤 Editar usuario' : '👤 Nuevo usuario';
  $('mu-n').value = usr?.nombre || '';
  $('mu-u').value = usr?.user_login || '';
  $('mu-p').value = '';
  $('mu-t').value = usr?.telefono || '';
  $('mu-r').value = usr?.rol || 'entrevistador';
  $('mu-m').value = usr?.meta || '';
  $('mu-activo').checked = usr ? usr.activo : true;
  $('mu-id').value = usr?.id || '';
  $('m-usr').classList.remove('hidden');
}

async function guardarUsr() {
  const btn = $('btn-grd-usr');
  const id = $('mu-id').value;
  const datos = {
    nombre: $('mu-n').value.trim(),
    user_login: $('mu-u').value.trim().toLowerCase(),
    telefono: $('mu-t').value.trim(),
    rol: $('mu-r').value,
    meta: parseInt($('mu-m').value) || 0,
    activo: $('mu-activo').checked
  };
  const pass = $('mu-p').value;
  if (pass) datos.password = pass;

  if (!datos.nombre || !datos.user_login) { toast('Nombre y usuario son obligatorios'); return; }
  if (!id && !pass) { toast('Ingrese una contraseña para el nuevo usuario'); return; }

  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    let error;
    if (id) {
      ({ error } = await sb.from('usuarios').update(datos).eq('id', id));
    } else {
      ({ error } = await sb.from('usuarios').insert(datos));
    }
    if (error) {
      toast('Error: ' + (error.message || 'Verifique los datos'));
    } else {
      toast(`Usuario ${id ? 'actualizado' : 'creado'}`);
      cerrarModal('m-usr');
      adminUsrs();
    }
  } catch (e) { toast('Error de conexión'); }
  btn.disabled = false;
  btn.textContent = 'Guardar usuario';
}

async function toggleActivo(id, nuevoEstado) {
  try {
    const { error } = await sb.from('usuarios').update({ activo: nuevoEstado }).eq('id', id);
    if (!error) {
      toast(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'}`);
      adminUsrs();
    } else toast('Error al cambiar estado');
  } catch (e) { toast('Error de conexión'); }
}

async function eliminarUsr(id) {
  if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer y borrará también sus entrevistas (si están vinculadas en cascada).')) return;
  try {
    const { error } = await sb.from('usuarios').delete().eq('id', id);
    if (!error) {
      toast('Usuario eliminado');
      adminUsrs();
    } else {
      toast('Error al eliminar');
    }
  } catch (e) {
    toast('Error de conexión');
  }
}

// ================================================================
// ADMIN — PREGUNTAS DINÁMICAS
// ================================================================
async function adminPregs() {
  const c = $('lista-preg');
  if (!c) return;
  c.innerHTML = '<div class="cargando"><span class="loader"></span>Cargando...</div>';
  try {
    const { data } = await sb.from('preguntas').select('*').order('orden');
    const mappedData = (data || []).map(p => ({
      ...p,
      pregunta: p.pregunta || p.texto,
      obligatoria: p.obligatoria !== undefined ? p.obligatoria : p.requerida
    }));
    if (!mappedData.length) {
      c.innerHTML = '<div class="table-empty">No hay preguntas. Agregue la primera.</div>';
      return;
    }

    const tipos = { texto: 'Texto', numero: 'Número', opciones: 'Opciones', si_no: 'Sí / No', sino: 'Sí / No' };
    c.innerHTML = mappedData.map(p => `
      <div class="preg-item">
        <div class="preg-ord">${p.orden || '?'}</div>
        <div class="preg-txt">
          ${p.pregunta}
          <div class="preg-sub">${p.obligatoria ? 'Obligatoria' : 'Opcional'}</div>
        </div>
        <span class="preg-tipo">${tipos[p.tipo] || p.tipo}</span>
        <div style="display:flex;gap:6px">
          <button class="btn-sm bord" data-action="edit-preg" data-id="${p.id}">Editar</button>
          <button class="btn-sm rojo" data-action="del-preg" data-id="${p.id}">Eliminar</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    c.innerHTML = '<div class="table-empty">Error al cargar preguntas.</div>';
  }
}

function toggleOpts() {
  const tipo = $('mp-tipo').value;
  const optsWrapper = $('mp-opts-w');
  if (optsWrapper) {
    optsWrapper.classList.toggle('hidden', tipo !== 'opciones');
  }
}

async function abrirModalPreg(id) {
  let preg = null;
  if (id) {
    const { data } = await sb.from('preguntas').select('*').eq('id', id).single();
    if (data) {
      preg = {
        ...data,
        pregunta: data.pregunta || data.texto,
        obligatoria: data.obligatoria !== undefined ? data.obligatoria : data.requerida
      };
    }
  }

  const maxOrden = await sb.from('preguntas').select('orden').order('orden', { ascending: false }).limit(1);
  const sig = (maxOrden.data?.[0]?.orden || 0) + 1;

  $('m-preg-t').textContent = preg ? '❓ Editar pregunta' : '❓ Nueva pregunta';
  $('mp-t').value = preg?.pregunta || '';
  $('mp-tipo').value = preg?.tipo || 'texto';
  
  let opts = '';
  if (preg?.opciones) {
    try { opts = JSON.parse(preg.opciones).join('\n'); } catch (e) { opts = preg.opciones; }
  }
  $('mp-opts').value = opts;
  
  $('mp-req').checked = preg?.obligatoria || false;
  $('mp-id').value = preg?.id || '';
  toggleOpts();
  $('m-preg').dataset.orden = preg?.orden || sig;
  $('m-preg').classList.remove('hidden');
}

async function guardarPreg() {
  const btn = $('btn-grd-preg');
  const id = $('mp-id').value;
  const pregunta = $('mp-t').value.trim();
  if (!pregunta) { toast('Ingrese el texto de la pregunta'); return; }

  const tipo = $('mp-tipo').value;
  let opciones = null;
  if (tipo === 'opciones') {
    const raw = $('mp-opts').value.trim();
    const arr = raw.split('\n').map(s => s.trim()).filter(Boolean);
    if (!arr.length) { toast('Ingrese al menos una opción'); return; }
    opciones = JSON.stringify(arr);
  }

  const datos = {
    texto: pregunta,
    tipo,
    opciones,
    requerida: $('mp-req').checked,
    activa: true,
    orden: parseInt($('m-preg').dataset.orden) || 1
  };

  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    let error;
    if (id) {
      ({ error } = await sb.from('preguntas').update(datos).eq('id', id));
    } else {
      ({ error } = await sb.from('preguntas').insert(datos));
    }
    if (error) {
      toast('Error al guardar');
    } else {
      toast(`Pregunta ${id ? 'actualizada' : 'creada'}`);
      cerrarModal('m-preg');
      adminPregs();
      
      const { data } = await sb.from('preguntas').select('*').eq('activa', true).order('orden');
      preguntas = (data || []).map(p => ({
        ...p,
        pregunta: p.pregunta || p.texto,
        obligatoria: p.obligatoria !== undefined ? p.obligatoria : p.requerida
      }));
      localStorage.setItem(STORAGE_KEYS.PREGUNTAS, JSON.stringify(preguntas));
    }
  } catch (e) { toast('Error de conexión'); }
  btn.disabled = false;
  btn.textContent = 'Guardar pregunta';
}

async function eliminarPreg(id) {
  if (!confirm('¿Eliminar esta pregunta? No se puede deshacer.')) return;
  const { error } = await sb.from('preguntas').delete().eq('id', id);
  if (!error) {
    toast('Pregunta eliminada');
    adminPregs();
  } else {
    toast('Error al eliminar');
  }
}
