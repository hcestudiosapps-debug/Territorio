'use strict';

// ================================================================
// LOGICA DE REPORTES — TERRITORIA GIS
// ================================================================

async function repPorEntrevistadora() {
  const area = $('rep-detalle-area');
  if (!area) return;
  area.innerHTML = '<div class="cargando"><span class="loader"></span>Calculando estadísticas...</div>';
  
  try {
    const [{ data: ents }, { data: usrs }] = await Promise.all([
      sb.from('entrevistas').select('id,usuario_id,fecha_entrevista'),
      sb.from('usuarios').select('*').eq('rol', 'entrevistador')
    ]);

    const e = ents || [];
    const u = usrs || [];

    const hoy = hoyISO();
    const byUsr = {};
    e.forEach(ent => {
      if (!byUsr[ent.usuario_id]) byUsr[ent.usuario_id] = { total: 0, hoy: 0 };
      byUsr[ent.usuario_id].total++;
      if (ent.fecha_entrevista?.slice(0, 10) === hoy) byUsr[ent.usuario_id].hoy++;
    });

    const ranking = u.map(usr => ({
      ...usr,
      stats: byUsr[usr.id] || { total: 0, hoy: 0 }
    })).sort((a, b) => b.stats.total - a.stats.total);

    area.innerHTML = `
      <div class="rep-detalle">
        <div class="flex-between mb16">
          <div class="rep-detalle-t">Productividad por Entrevistadora</div>
          <button class="btn-sm bord" onclick="exportarPDF()">🖨 Imprimir PDF</button>
        </div>
        <div style="overflow-x:auto">
          <table class="t-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Capturas Hoy</th>
                <th>Total Capturas</th>
                <th>Meta Diaria</th>
              </tr>
            </thead>
            <tbody>
              ${ranking.map((usr, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${usr.nombre}</td>
                  <td>
                    <span class="badge ${usr.activo ? 'vd' : 'rj'}">
                      ${usr.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>${usr.stats.hoy}</td>
                  <td><b>${usr.stats.total}</b></td>
                  <td>${usr.meta || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    area.innerHTML = '<div class="table-empty">Error al cargar el reporte de entrevistadoras.</div>';
  }
}

async function repPorDia() {
  const area = $('rep-detalle-area');
  if (!area) return;
  area.innerHTML = '<div class="cargando"><span class="loader"></span>Calculando productividad diaria...</div>';
  
  try {
    const { data: ents } = await sb.from('entrevistas')
      .select('fecha_entrevista')
      .order('fecha_entrevista', { ascending: false });
      
    const byDia = {};
    (ents || []).forEach(e => {
      const d = e.fecha_entrevista?.slice(0, 10);
      if (d) byDia[d] = (byDia[d] || 0) + 1;
    });

    const dias = Object.entries(byDia)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30);
      
    const max = Math.max(...dias.map(d => d[1]), 1);

    area.innerHTML = `
      <div class="rep-detalle">
        <div class="flex-between mb16">
          <div class="rep-detalle-t">Entrevistas por Día (Últimos 30 días)</div>
          <button class="btn-sm bord" onclick="exportarPDF()">🖨 Imprimir PDF</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${dias.map(([dia, cnt]) => `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;font-weight:600">
                <span>${formatearFecha(dia)}</span>
                <span>${cnt} entrevistas</span>
              </div>
              <div class="barra-f">
                <div class="barra-r" style="width:${Math.round((cnt / max) * 100)}%"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    area.innerHTML = '<div class="table-empty">Error al cargar reporte diario.</div>';
  }
}

async function repRespuestas() {
  const area = $('rep-detalle-area');
  if (!area) return;
  area.innerHTML = '<div class="cargando"><span class="loader"></span>Analizando respuestas dinámicas...</div>';
  
  try {
    const { data: ents } = await sb.from('entrevistas').select('respuestas');
    const conteo = {};
    
    (ents || []).forEach(e => {
      if (!e.respuestas) return;
      Object.entries(e.respuestas).forEach(([id, val]) => {
        if (!conteo[id]) conteo[id] = {};
        conteo[id][val] = (conteo[id][val] || 0) + 1;
      });
    });

    let html = `
      <div class="rep-detalle">
        <div class="flex-between mb16">
          <div class="rep-detalle-t">Análisis de Respuestas Dinámicas</div>
          <button class="btn-sm bord" onclick="exportarPDF()">🖨 Imprimir PDF</button>
        </div>
    `;
    
    preguntas.forEach(p => {
      if (!conteo[p.id]) {
        html += `
          <div style="margin-bottom:24px;border-bottom:1px solid var(--border-color);padding-bottom:16px">
            <div style="font-size:14px;font-weight:800;margin-bottom:10px">${p.pregunta}</div>
            <div class="table-empty" style="padding:16px">Sin respuestas registradas.</div>
          </div>`;
        return;
      }
      
      const vals = Object.entries(conteo[p.id]).sort((a, b) => b[1] - a[1]);
      const total = vals.reduce((s, [, c]) => s + c, 0);
      
      html += `
        <div style="margin-bottom:24px;border-bottom:1px solid var(--border-color);padding-bottom:16px">
          <div style="font-size:14px;font-weight:800;color:var(--text-main);margin-bottom:12px">${p.pregunta}</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${vals.slice(0, 10).map(([v, c]) => {
              const pct = Math.round((c / total) * 100);
              const labelVal = p.tipo === 'si_no' ? (v === 'si' ? 'Sí' : 'No') : v;
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;font-weight:600">
                    <span>${labelVal}</span>
                    <span>${c} (${pct}%)</span>
                  </div>
                  <div class="barra-f">
                    <div class="barra-r" style="width:${pct}%"></div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    });
    
    html += '</div>';
    area.innerHTML = html;
  } catch (e) {
    area.innerHTML = '<div class="table-empty">Error al cargar análisis de respuestas.</div>';
  }
}

// ================================================================
// EXPORTADORES A FORMATOS (CSV & EXCEL)
// ================================================================

async function exportarCSV() {
  toast('Generando archivo CSV...');
  try {
    const [{ data: ents }, { data: usrs }] = await Promise.all([
      sb.from('entrevistas').select('*').order('fecha_entrevista'),
      sb.from('usuarios').select('id,nombre')
    ]);
    const getNombre = id => usrs?.find(u => u.id === id)?.nombre || 'Desconocida';

    const cabecera = [
      '#', 'Entrevistadora', 'Fecha', 'Hora', 'Nombres', 'Apellido Paterno', 
      'Apellido Materno', 'Edad', 'Teléfono', 'Calle', 'Sección', 'Simpatiza', 
      'Conoce Candidato', 'Observaciones', 'Latitud', 'Longitud',
      ...preguntas.map(p => p.pregunta)
    ].join(',');

    const filas = (ents || []).map((e, i) => {
      const fecha = new Date(e.fecha_entrevista);
      const simpatiza = e.partido_cual ? 'Sí' : 'No';
      
      const resp = preguntas.map(p => {
        const v = e.respuestas?.[p.id] || '';
        const labelVal = p.tipo === 'si_no' ? (v === 'si' ? 'Sí' : 'No') : v;
        return `"${String(labelVal).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
      });

      return [
        i + 1,
        `"${getNombre(e.usuario_id)}"`,
        fecha.toLocaleDateString('es-MX'),
        fecha.toLocaleTimeString('es-MX'),
        `"${String(e.nombres || '').replace(/"/g, '""')}"`,
        `"${String(e.apellido_paterno || '').replace(/"/g, '""')}"`,
        `"${String(e.apellido_materno || '').replace(/"/g, '""')}"`,
        e.edad || '',
        `"${String(e.telefono || '').replace(/"/g, '""')}"`,
        `"${String(e.calle || '').replace(/"/g, '""')}"`,
        `"${String(e.seccion || '').replace(/"/g, '""')}"`,
        `"${simpatiza}"`,
        `"${e.conoce_candidato || 'No responde'}"`,
        `"${String(e.observaciones || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
        e.latitud || '',
        e.longitud || '',
        ...resp
      ].join(',');
    });

    const csv = [cabecera, ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rutaguinda_${hoyISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`✓ Exportado: ${e.length} entrevistas`);
  } catch (e) {
    toast('Error al exportar a CSV');
  }
}

async function exportarExcel() {
  toast('Generando archivo Excel...');
  try {
    const [{ data: ents }, { data: usrs }] = await Promise.all([
      sb.from('entrevistas').select('*').order('fecha_entrevista'),
      sb.from('usuarios').select('id,nombre')
    ]);
    const getNombre = id => usrs?.find(u => u.id === id)?.nombre || 'Desconocida';

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Entrevistas</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Entrevistadora</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Nombres</th>
              <th>Apellido Paterno</th>
              <th>Apellido Materno</th>
              <th>Edad</th>
              <th>Teléfono</th>
              <th>Calle</th>
              <th>Sección</th>
              <th>Simpatiza</th>
              <th>Partido</th>
              <th>Conoce Candidato</th>
              <th>Observaciones</th>
              <th>Latitud</th>
              <th>Longitud</th>
              ${preguntas.map(p => `<th>${p.pregunta}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    (ents || []).forEach((e, i) => {
      const fecha = new Date(e.fecha_entrevista);
      const simpatiza = e.partido_cual ? 'Sí' : 'No';
      
      html += `
        <tr>
          <td>${i + 1}</td>
          <td>${getNombre(e.usuario_id)}</td>
          <td>${fecha.toLocaleDateString('es-MX')}</td>
          <td>${fecha.toLocaleTimeString('es-MX')}</td>
          <td>${e.nombres || ''}</td>
          <td>${e.apellido_paterno || ''}</td>
          <td>${e.apellido_materno || ''}</td>
          <td>${e.edad || ''}</td>
          <td>${e.telefono || ''}</td>
          <td>${e.calle || ''}</td>
          <td>${e.seccion || ''}</td>
          <td>${simpatiza}</td>
          <td>${e.partido_cual || ''}</td>
          <td>${e.conoce_candidato || 'No responde'}</td>
          <td>${e.observaciones || ''}</td>
          <td>${e.latitud || ''}</td>
          <td>${e.longitud || ''}</td>
          ${preguntas.map(p => {
            const v = e.respuestas?.[p.id] || '';
            const labelVal = p.tipo === 'si_no' ? (v === 'si' ? 'Sí' : 'No') : v;
            return `<td>${labelVal}</td>`;
          }).join('')}
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rutaguinda_${hoyISO()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`✓ Exportado a Excel: ${(ents || []).length} registros`);
  } catch (e) {
    toast('Error al exportar a Excel');
  }
}

function exportarPDF() {
  window.print();
}
