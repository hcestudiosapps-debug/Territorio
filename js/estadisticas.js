'use strict';

// ================================================================
// ESTADÍSTICAS — TERRITORIA GIS
// Gráficas de Cuestionario
// ================================================================

let chartP1Instance = null;
let chartP6Instance = null;
let chartP7Instance = null;
let chartP8Instance = null;
let chartP9Instance = null;

let datosEstadisticas = null;

const COLORES = ['#7b1c3e', '#e07b00', '#2d9f5c', '#003087', '#d9534f', '#6c757d', '#17a2b8', '#ffc107', '#6f42c1', '#fd7e14'];

async function cargarEstadisticas() {
  const totIds = ['est-p1-total', 'est-p6-total', 'est-p7-total', 'est-p8-total', 'est-p9-total'];
  totIds.forEach(id => { if ($(id)) $(id).textContent = 'Cargando datos...'; });

  try {
    const { data, error } = await sb.from('entrevistas')
      .select('problema_principal, simpatia_politica, conocimiento_luis_emilio, canal_posicionamiento, voto_confianza')
      .order('fecha_entrevista', { ascending: false });

    if (error) throw error;
    datosEstadisticas = data || [];

    _renderChart('p1', 'problema_principal', 'doughnut', chartP1Instance, i => chartP1Instance = i);
    _renderChart('p6', 'simpatia_politica', 'doughnut', chartP6Instance, i => chartP6Instance = i);
    _renderChart('p7', 'conocimiento_luis_emilio', 'doughnut', chartP7Instance, i => chartP7Instance = i);
    _renderChart('p8', 'canal_posicionamiento', 'doughnut', chartP8Instance, i => chartP8Instance = i);
    _renderChart('p9', 'voto_confianza', 'doughnut', chartP9Instance, i => chartP9Instance = i);

  } catch (e) {
    totIds.forEach(id => { if ($(id)) $(id).textContent = 'Error al cargar datos.'; });
    console.error('cargarEstadisticas error:', e);
  }
}

function _renderChart(idPrefix, dbField, chartType, chartInstance, setInstanceFn) {
  if (chartInstance) {
    chartInstance.destroy();
    setInstanceFn(null);
  }

  const canvas = $('chart-' + idPrefix);
  const legendDiv = $('est-' + idPrefix + '-legend');
  const totalDiv = $('est-' + idPrefix + '-total');
  
  if (!canvas || !datosEstadisticas) return;

  const counts = {};
  let validCount = 0;
  datosEstadisticas.forEach(row => {
    let val = row[dbField];
    if (!val || val === '') val = 'Sin respuesta / No especificado';
    counts[val] = (counts[val] || 0) + 1;
    validCount++;
  });

  if (totalDiv) totalDiv.textContent = `Total respuestas: ${validCount}`;

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(x => x[0]);
  const data = sorted.map(x => x[1]);

  const bgColors = labels.map((_, i) => COLORES[i % COLORES.length]);

  if (legendDiv) {
    legendDiv.innerHTML = sorted.map((item, i) => {
      const pct = validCount ? Math.round(item[1] / validCount * 100) : 0;
      return `<div class="est-legend-item"><span class="est-dot" style="background:${bgColors[i]}"></span>${item[0]}: <b>${item[1]}</b> (${pct}%)</div>`;
    }).join('');
  }

  const newChart = new Chart(canvas, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderWidth: 1
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
              const pct = validCount ? Math.round(val / validCount * 100) : 0;
              return ` ${ctx.label}: ${val} (${pct}%)`;
            }
          }
        }
      },
      cutout: chartType === 'doughnut' ? '50%' : undefined
    }
  });

  setInstanceFn(newChart);
}
