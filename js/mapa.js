'use strict';

let mapaL = null;
let mapSelectedUserId = '';
let capaSatelite = null;
let capaCalles = null;
let capaOscura = null;
let marcadoresGrupo = [];
let rutasGrupo = [];
let capaCalor = null;

// ================================================================
// INICIALIZACIÓN DEL MAPA
// ================================================================
async function adminMapa() {
  try {
    // Cargar usuarios para el listado del sidebar
    const { data: usrs } = await sb.from('usuarios').select('*').eq('rol', 'entrevistador').eq('activo', true);
    usrsCache = usrs || [];

    // Renderizar lista en el sidebar del mapa con su color correspondiente
    const container = $('map-lista-senoras');
    if (container) {
      container.innerHTML = usrsCache.map((u, idx) => {
        const color = COLORES_ENTREVISTADORES[idx % COLORES_ENTREVISTADORES.length];
        return `
          <button class="map-user-item" data-map-user="${u.id}" onclick="seleccionarUsuarioMapa('${u.id}')">
            <div class="map-user-color-dot" style="background:${color}"></div>
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.nombre}</span>
          </button>`;
      }).join('');
    }

    // Inicializar el geocodificador (Buscador)
    const btnBuscar = $('btn-map-buscar');
    if (btnBuscar) {
      btnBuscar.onclick = buscarDireccionEnMapa;
      $('fil-map-buscar-txt').onkeydown = e => { if (e.key === 'Enter') buscarDireccionEnMapa(); };
    }

    $('chk-heatmap')?.addEventListener('change', actualizarMapa);
    $('fil-map-fotos')?.addEventListener('change', actualizarMapa);
    $('fil-map-dia')?.addEventListener('change', actualizarMapa);
    $('fil-map-modo')?.addEventListener('change', actualizarMapa);

    await actualizarMapa();
  } catch (e) {
    toast('Error al cargar mapa');
  }
}

// ================================================================
// SELECCIÓN DE USUARIO EN SIDEBAR
// ================================================================
function seleccionarUsuarioMapa(userId) {
  mapSelectedUserId = userId;
  
  // Modificar clases del DOM
  const items = document.querySelectorAll('.map-user-item');
  items.forEach(el => el.classList.remove('active'));
  
  if (userId === '') {
    $('btn-map-all-usrs')?.classList.add('active');
  } else {
    const activeBtn = document.querySelector(`.map-user-item[data-map-user="${userId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }
  
  actualizarMapa();
}

// ================================================================
// BUSCADOR GEOGRÁFICO (NOMINATIM API)
// ================================================================
async function buscarDireccionEnMapa() {
  const query = $('fil-map-buscar-txt').value.trim();
  if (!query) return;

  const btn = $('btn-map-buscar');
  btn.textContent = '🔍 ...';
  btn.disabled = true;

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      
      // Mover mapa suavemente al punto
      if (mapaL) {
        mapaL.flyTo([lat, lon], 14, { duration: 1.5 });
      }
    } else {
      toast('Ubicación no encontrada');
    }
  } catch (e) {
    toast('Error al buscar dirección');
  }
  
  btn.textContent = 'Buscar';
  btn.disabled = false;
}

// ================================================================
// ACTUALIZAR MAPA CON FILTROS Y CAPAS
// ================================================================
async function actualizarMapa() {
  const periodo = $('fil-map-dia').value;
  const modoVisualizacion = $('fil-map-modo').value; // rutas, entrevistas, ambos
  const soloConFotos = $('fil-map-fotos').checked; // Checkbox de filtros de fotos
  const hoy = hoyISO();
  const hace7 = hace7ISO();

  // Limpiar capas previas si existen
  if (mapaL) {
    marcadoresGrupo.forEach(m => mapaL.removeLayer(m));
    rutasGrupo.forEach(r => mapaL.removeLayer(r));
    if (capaCalor) mapaL.removeLayer(capaCalor);
    marcadoresGrupo = [];
    rutasGrupo = [];
    capaCalor = null;
  }

  // Estructurar queries Supabase
  let qe = sb.from('entrevistas').select('*').not('latitud', 'is', null);
  let qg = sb.from('gps_puntos').select('*').order('capturado_en');

  // Aplicar filtros por usuario seleccionado
  if (mapSelectedUserId) {
    qe = qe.eq('usuario_id', mapSelectedUserId);
    qg = qg.eq('usuario_id', mapSelectedUserId);
  }

  // Filtros por periodo
  if (periodo === 'hoy') {
    qe = qe.gte('fecha_entrevista', hoy);
    qg = qg.gte('capturado_en', hoy);
  } else if (periodo === 'semana') {
    qe = qe.gte('fecha_entrevista', hace7);
    qg = qg.gte('capturado_en', hace7);
  }

  try {
    const [{ data: ents }, { data: puntos }] = await Promise.all([qe, qg]);
    
    // Filtrar localmente por fotos si el checkbox está activo
    let entrevistasFiltradas = ents || [];
    if (soloConFotos) {
      entrevistasFiltradas = entrevistasFiltradas.filter(e => e.foto_casa || e.foto_ine_frente || e.foto_ine_reverso);
    }

    $('map-cnt-ents').textContent = entrevistasFiltradas.length;
    $('map-cnt-pts').textContent = (puntos || []).length;

    // Inicializar Leaflet si no existe
    if (!mapaL) {
      mapaL = L.map('mapa-leaflet', {
        center: [20.97, -89.62], // Centro en Mérida por defecto
        zoom: 12,
        zoomControl: true,
        attributionControl: true
      });

      // Definir mapas base
      capaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      });

      capaSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      });

      capaOscura = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CartoDB'
      });

      // Añadir la de calles por defecto
      capaCalles.addTo(mapaL);

      // Añadir control de capas de Leaflet
      L.control.layers({
        'Calles (OSM)': capaCalles,
        'Satélite': capaSatelite,
        'Modo Oscuro': capaOscura
      }, null, { position: 'topright' }).addTo(mapaL);
    }

    const bounds = [];
    const getNombre = id => usrsCache.find(u => u.id === id)?.nombre || 'Desconocida';
    const getColor = id => {
      const idx = usrsCache.findIndex(u => u.id === id);
      return idx >= 0 ? COLORES_ENTREVISTADORES[idx % COLORES_ENTREVISTADORES.length] : '#7b1c3e';
    };
    const getInicial = id => {
      const u = usrsCache.find(u => u.id === id);
      return u ? u.nombre.charAt(0).toUpperCase() : '?';
    };

    // 1. Dibujar Heatmap o Entrevistas en mapa
    const verHeatmap = $('chk-heatmap')?.checked;

    if (verHeatmap) {
      const heatData = [];
      entrevistasFiltradas.forEach(e => {
        if (!e.latitud || !e.longitud) return;
        // Solo incluimos simpatizantes o que conocen al candidato para el heatmap
        if (e.conoce_candidato === 'si' || (e.partido_cual && e.partido_cual.toLowerCase() !== 'otro')) {
          heatData.push([e.latitud, e.longitud, 1]); // Lat, Lng, Intensidad
          bounds.push([e.latitud, e.longitud]);
        }
      });
      if (heatData.length > 0) {
        capaCalor = L.heatLayer(heatData, {
          radius: 25,
          blur: 15,
          maxZoom: 15,
          gradient: { 0.4: 'blue', 0.6: 'cyan', 0.8: 'yellow', 1.0: 'red' }
        }).addTo(mapaL);
      } else {
        toast('No hay datos suficientes para el Heatmap en este filtro.');
      }
    } else if (modoVisualizacion === 'ambos' || modoVisualizacion === 'entrevistas') {
      const interviewTracks = {}; // Para conectar entrevistas de cada usuaria

      entrevistasFiltradas.forEach(e => {
        if (!e.latitud || !e.longitud) return;
        const color = getColor(e.usuario_id);
        const inicial = getInicial(e.usuario_id);
        const nombre = getNombre(e.usuario_id);
        const fecha = new Date(e.fecha_entrevista);

        // Guardar para la ruta
        if (!interviewTracks[e.usuario_id]) interviewTracks[e.usuario_id] = [];
        interviewTracks[e.usuario_id].push({ lat: e.latitud, lng: e.longitud, time: fecha.getTime() });

        // Crear popup detallado
        let popHtml = `
          <div class="popup-ent">
            <h4 style="border-bottom: 2px solid ${color}">${nombre}</h4>
            <div class="p-row"><b>Ciudadano:</b> ${e.nombres || ''} ${e.apellido_paterno || ''}</div>
            <div class="p-row"><b>Teléfono:</b> ${e.telefono || 'Sin teléfono'}</div>
            <div class="p-row"><b>Sección electoral:</b> ${e.seccion || ''}</div>
            <div class="p-row"><b>Simpatiza:</b> ${e.partido_cual ? `Sí (${e.partido_cual})` : 'No'}</div>
            <div class="p-row"><b>Conoce Candidato:</b> ${e.conoce_candidato === 'si' ? 'Sí' : 'No'}</div>
            <div class="p-row"><b>Fecha:</b> ${fecha.toLocaleDateString('es-MX')} a las ${fecha.toLocaleTimeString('es-MX')}</div>
            <div class="p-row"><b>Obs:</b> ${e.observaciones || 'Sin observaciones'}</div>`;
            
        if (e.foto_casa) {
          popHtml += `<img src="${e.foto_casa}" class="p-foto">`;
        }
        popHtml += `</div>`;

        const icono = L.divIcon({
          html: `<div class="marker-ent" style="background:${color}">${inicial}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          className: ''
        });

        const marker = L.marker([e.latitud, e.longitud], { icon: icono })
          .addTo(mapaL)
          .bindPopup(popHtml, { maxWidth: 260 });
          
        marcadoresGrupo.push(marker);
        bounds.push([e.latitud, e.longitud]);
      });

      // Dibujar rutas conectando las entrevistas
      Object.keys(interviewTracks).forEach(userId => {
        const coordsObj = interviewTracks[userId].sort((a, b) => a.time - b.time);
        if (coordsObj.length > 1) {
          const color = getColor(userId);
          const coords = coordsObj.map(c => [c.lat, c.lng]);
          const polyline = L.polyline(coords, { color, weight: 3, opacity: 0.9, dashArray: '6, 8' }).addTo(mapaL);
          marcadoresGrupo.push(polyline); // Usar el mismo grupo para limpiarlos fácilmente
        }
      });
    }

    // 2. Dibujar rutas GPS en mapa (Background GPS Tracking)
    if (!verHeatmap && (modoVisualizacion === 'ambos' || modoVisualizacion === 'rutas')) {
      const tracks = {};
      (puntos || []).forEach(p => {
        if (!tracks[p.usuario_id]) tracks[p.usuario_id] = [];
        tracks[p.usuario_id].push([p.latitud, p.longitud]);
        bounds.push([p.latitud, p.longitud]);
      });

      usrsCache.forEach((u, idx) => {
        if (mapSelectedUserId && mapSelectedUserId !== u.id) return;
        const coords = tracks[u.id] || [];
        if (!coords.length) return;
        const color = COLORES_ENTREVISTADORES[idx % COLORES_ENTREVISTADORES.length];
        
        const polyline = L.polyline(coords, { color, weight: 4, opacity: 0.5 }).addTo(mapaL);
        rutasGrupo.push(polyline);
      });
    }

    // Ajustar zoom automático si hay coordenadas registradas
    if (bounds.length > 0) {
      try { mapaL.fitBounds(bounds, { padding: [40, 40] }); } catch (e) { /* skip */ }
    }
  } catch (err) {
    toast('Error al actualizar el mapa');
  }
}

// ================================================================
// EXPORTAR MAPA A IMAGEN (WHATSAPP)
// ================================================================
async function exportarMapa() {
  const mapElement = $('mapa-leaflet');
  if (!mapElement) return;

  const btn = $('btn-exportar-mapa');
  const btnOriginalText = btn.innerHTML;
  btn.innerHTML = '⏳ Generando...';
  btn.disabled = true;

  try {
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const dateStr = hoyISO().replace(/-/g, '');
    const filename = `rutaguinda_mapa_${dateStr}.jpg`;

    // Intentar usar Web Share API si es móvil/compatible
    if (navigator.share && dataUrl) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: 'image/jpeg' });
        await navigator.share({
          title: 'Mapa RutaGuinda',
          text: 'Aquí está la vista actual del mapa de cobertura:',
          files: [file]
        });
        toast('✓ Compartido');
      } catch (shareErr) {
        console.warn('Share API falló o se canceló, descargando...', shareErr);
        descargarDataUrl(dataUrl, filename);
      }
    } else {
      descargarDataUrl(dataUrl, filename);
    }
  } catch (error) {
    console.error('Error al exportar mapa:', error);
    toast('Error al capturar mapa. Intente de nuevo.');
  } finally {
    btn.innerHTML = btnOriginalText;
    btn.disabled = false;
  }
}

function descargarDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
  toast('✓ Imagen descargada');
}
