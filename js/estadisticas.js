'use strict';

// ================================================================
// ESTADÍSTICAS — TERRITORIA GIS
// Gráficas de: ¿Conoce a Luis Emilio? y Simpatía por Partido
// ================================================================

let chartEmilioInstance = null;
let chartPartidosInstance = null;
let datosEstadisticas = null; // caché de datos

// Colores por partido
const PARTIDO_COLORES = {
  'Morena': '#7b1c3e',
  'PAN':    '#003087',
  'PRI':    '#006600',
  'Otro':   '#e07b00'
};

async function cargarEstadisticas() {
  // Reset leyendas
  const lEmilio  = $('est-emilio-legend');
  const lPartido = $('est-partido-legend');
  const tEmilio  = $('est-emilio-total');
  const tPartido = $('est-partido-total');

  if (tEmilio)  tEmilio.textContent  = 'Cargando datos...';
  if (tPartido) tPartido.textContent = 'Cargando datos...';

  try {
    const { data, error } = await sb.from('entrevistas')
      .select('nombres, apellido_paterno, telefono, conoce_candidato, partido_cual')
      .order('fecha_entrevista', { ascending: false });

    if (error) throw error;
    datosEstadisticas = data || [];

    _renderGraficaEmilio(datosEstadisticas);
    _renderGraficaPartidos(datosEstadisticas);

  } catch (e) {
    if (tEmilio)  tEmilio.textContent  = 'Error al cargar datos.';
    if (tPartido) tPartido.textContent = 'Error al cargar datos.';
    console.error('cargarEstadisticas error:', e);
  }
}

// ----------------------------------------------------------------
// GRÁFICA 1: ¿Conoce a Luis Emilio?
// ----------------------------------------------------------------
function _renderGraficaEmilio(data) {
  const si  = data.filter(e => e.conoce_candidato === 'si').length;
  const no  = data.filter(e => e.conoce_candidato === 'no').length;
  const nd  = data.filter(e => !e.conoce_candidato).length;
  const tot = si + no + nd;

  const tEmilio = $('est-emilio-total');
  if (tEmilio) tEmilio.textContent = `Total entrevistas: ${tot}`;

  // Leyenda
  const lEmilio = $('est-emilio-legend');
  if (lEmilio) {
    lEmilio.innerHTML = `
      <div class="est-legend-item"><span class="est-dot" style="background:#2d9f5c"></span>Sí conoce: <b>${si}</b> (${tot ? Math.round(si/tot*100) : 0}%)</div>
      <div class="est-legend-item"><span class="est-dot" style="background:#d9534f"></span>No conoce: <b>${no}</b> (${tot ? Math.round(no/tot*100) : 0}%)</div>
      <div class="est-legend-item"><span class="est-dot" style="background:#888"></span>Sin respuesta: <b>${nd}</b></div>
    `;
  }

  // Destruir gráfica anterior si existe
  if (chartEmilioInstance) {
    chartEmilioInstance.destroy();
    chartEmilioInstance = null;
  }

  const canvas = $('chart-emilio');
  if (!canvas) return;

  chartEmilioInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Sí conoce', 'No conoce', 'Sin respuesta'],
      datasets: [{
        data: [si, no, nd],
        backgroundColor: ['#2d9f5c', '#d9534f', '#aaaaaa'],
        borderColor: ['#fff', '#fff', '#fff'],
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed;
              const pct = tot ? Math.round(val / tot * 100) : 0;
              return ` ${ctx.label}: ${val} personas (${pct}%)`;
            }
          }
        }
      },
      cutout: '60%'
    }
  });
}

// ----------------------------------------------------------------
// GRÁFICA 2: Simpatía por Partido
// ----------------------------------------------------------------
function _renderGraficaPartidos(data) {
  const partidos = ['Morena', 'PAN', 'PRI', 'Otro'];
  const conPartido = data.filter(e => e.partido_cual && e.partido_cual !== '');
  const totPartido = conPartido.length;
  const sin = data.length - totPartido;

  // Conteo por partido
  const conteo = {};
  partidos.forEach(p => conteo[p] = 0);
  conPartido.forEach(e => {
    const p = e.partido_cual;
    if (conteo.hasOwnProperty(p)) {
      conteo[p]++;
    } else {
      conteo['Otro'] = (conteo['Otro'] || 0) + 1;
    }
  });

  const tPartido = $('est-partido-total');
  if (tPartido) tPartido.textContent = `${totPartido} personas simpatizan con algún partido · ${sin} no simpatizan`;

  // Leyenda
  const lPartido = $('est-partido-legend');
  if (lPartido) {
    lPartido.innerHTML = partidos.map(p => `
      <div class="est-legend-item">
        <span class="est-dot" style="background:${PARTIDO_COLORES[p] || '#888'}"></span>
        ${p}: <b>${conteo[p]}</b> (${totPartido ? Math.round(conteo[p]/totPartido*100) : 0}%)
      </div>
    `).join('') + `<div class="est-legend-item"><span class="est-dot" style="background:#ccc"></span>No simpatizan: <b>${sin}</b></div>`;
  }

  // Destruir gráfica anterior si existe
  if (chartPartidosInstance) {
    chartPartidosInstance.destroy();
    chartPartidosInstance = null;
  }

  const canvas = $('chart-partidos');
  if (!canvas) return;

  chartPartidosInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: partidos,
      datasets: [{
        label: 'Personas',
        data: partidos.map(p => conteo[p]),
        backgroundColor: partidos.map(p => PARTIDO_COLORES[p] || '#888'),
        borderColor: partidos.map(p => PARTIDO_COLORES[p] || '#888'),
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              const pct = totPartido ? Math.round(val / totPartido * 100) : 0;
              return ` ${val} personas (${pct}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#555', font: { weight: '700', size: 13 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { color: '#888', stepSize: 1 }
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// IMPRESIÓN: Lista de personas ¿Conoce a Luis Emilio?
// ----------------------------------------------------------------
function imprimirListaEmilio(resp) {
  if (!datosEstadisticas) {
    toast('Primero carga las estadísticas');
    return;
  }

  const lista = datosEstadisticas.filter(e => (resp === 'si'
    ? e.conoce_candidato === 'si'
    : e.conoce_candidato === 'no' || !e.conoce_candidato));

  const titulo = resp === 'si'
    ? '✅ Personas que SÍ conocen a Luis Emilio'
    : '❌ Personas que NO conocen a Luis Emilio';

  _abrirVentanaImpresion(titulo, lista, [
    { key: 'index',          label: '#' },
    { key: 'nombre_completo', label: 'Nombre completo' },
    { key: 'telefono',        label: 'Teléfono' },
    { key: 'conoce_lbl',      label: '¿Conoce?' }
  ], e => ({
    index: '',
    nombre_completo: `${e.nombres || ''} ${e.apellido_paterno || ''}`.trim(),
    telefono: e.telefono || '—',
    conoce_lbl: e.conoce_candidato === 'si' ? 'Sí' : 'No'
  }));
}

// ----------------------------------------------------------------
// IMPRESIÓN: Lista de personas por partido
// ----------------------------------------------------------------
function imprimirListaPartido(partido) {
  if (!datosEstadisticas) {
    toast('Primero carga las estadísticas');
    return;
  }

  let lista;
  if (partido === 'Otro') {
    const conocidos = ['Morena', 'PAN', 'PRI'];
    lista = datosEstadisticas.filter(e =>
      e.partido_cual && !conocidos.includes(e.partido_cual));
  } else {
    lista = datosEstadisticas.filter(e => e.partido_cual === partido);
  }

  const titulo = `🗳 Personas que simpatizan con: ${partido}`;

  _abrirVentanaImpresion(titulo, lista, [
    { key: 'index',          label: '#' },
    { key: 'nombre_completo', label: 'Nombre completo' },
    { key: 'telefono',        label: 'Teléfono' },
    { key: 'partido_cual',    label: 'Partido' }
  ], e => ({
    index: '',
    nombre_completo: `${e.nombres || ''} ${e.apellido_paterno || ''}`.trim(),
    telefono: e.telefono || '—',
    partido_cual: e.partido_cual || '—'
  }));
}

// ----------------------------------------------------------------
// MOTOR DE IMPRESIÓN GENÉRICO (abre nueva ventana para imprimir)
// ----------------------------------------------------------------
function _abrirVentanaImpresion(titulo, lista, columnas, mapFn) {
  if (!lista.length) {
    toast(`Sin registros para imprimir en esta categoría`);
    return;
  }

  const filas = lista.map((e, i) => {
    const row = mapFn(e);
    row.index = i + 1;
    return `<tr>${columnas.map(c => `<td>${row[c.key]}</td>`).join('')}</tr>`;
  }).join('');

  const encabezados = columnas.map(c => `<th>${c.label}</th>`).join('');
  const fecha = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 13px; color: #222; padding: 24px; }
    .encabezado { margin-bottom: 20px; border-bottom: 3px solid #7b1c3e; padding-bottom: 12px; }
    .encabezado h1 { font-size: 18px; color: #7b1c3e; font-weight: 800; }
    .encabezado p { color: #666; font-size: 12px; margin-top: 4px; }
    .marca { font-size: 11px; color: #999; text-align: right; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #7b1c3e; color: #fff; padding: 8px 12px; text-align: left; font-size: 12px; font-weight: 700; }
    td { padding: 7px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr:nth-child(even) td { background: #fdf5f8; }
    .total { margin-top: 14px; font-size: 13px; font-weight: 700; color: #7b1c3e; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="encabezado">
    <h1>${titulo}</h1>
    <p>Generado: ${fecha} · Territoria GIS V4 · Campaña Luis Emilio</p>
  </div>
  <table>
    <thead><tr>${encabezados}</tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="total">Total: ${lista.length} personas</div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const ventana = window.open('', '_blank', 'width=900,height=700');
  if (ventana) {
    ventana.document.write(html);
    ventana.document.close();
  } else {
    toast('Active las ventanas emergentes para imprimir');
  }
}
