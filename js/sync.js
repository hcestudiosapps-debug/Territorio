'use strict';

// ================================================================
// SINCRONIZACIÓN AUTOMÁTICA DE DATOS OFFLINE (INDEXEDDB -> SUPABASE)
// ================================================================

// Actualiza el indicador visual de elementos pendientes de sincronización
async function actualizarBadgeSync() {
  const badge = $('sync-badge');
  const alertCard = $('local-alert');
  const alertTxt = $('local-alert-txt');
  
  try {
    const localEnts = await dbObtenerTodos('entrevistas');
    const localGPS = await dbObtenerTodos('gps_puntos');
    
    const pendEnts = localEnts.length;
    const pendGPS = localGPS.length;
    const totalPendientes = pendEnts + pendGPS;

    // 1. Mostrar/Ocultar badge flotante
    if (badge) {
      if (totalPendientes > 0) {
        badge.textContent = `⏳ ${totalPendientes} pendientes`;
        badge.className = 'sync-badge pend';
      } else {
        badge.className = 'sync-badge'; // Ocultado por CSS sin la clase .pend
      }
    }

    // 2. Mostrar/Ocultar tarjeta de alerta en Inicio de Entrevistador
    if (alertCard && alertTxt) {
      if (totalPendientes > 0) {
        alertCard.style.display = 'flex';
        const partes = [];
        if (pendEnts > 0) partes.push(`${pendEnts} entrevista${pendEnts > 1 ? 's' : ''}`);
        if (pendGPS > 0) partes.push(`${pendGPS} punto${pendGPS > 1 ? 's' : ''} GPS`);
        alertTxt.textContent = `${partes.join(' y ')} guardados localmente. Esperando conexión para sincronizar.`;
      } else {
        alertCard.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Error al actualizar el indicador de sincronización:', e);
  }
}

// Sincroniza los registros de IndexedDB con Supabase
async function syncQ() {
  if (!navigator.onLine) {
    await actualizarBadgeSync();
    return;
  }

  try {
    const localEnts = await dbObtenerTodos('entrevistas');
    const localGPS = await dbObtenerTodos('gps_puntos');
    
    if (localEnts.length === 0 && localGPS.length === 0) {
      await actualizarBadgeSync();
      return;
    }

    let exitos = 0;
    let errores = 0;

    // 1. Sincronizar Entrevistas
    if (localEnts.length > 0) {
      for (const ent of localEnts) {
        const entData = { ...ent };
        const qid = entData._qid;
        // Eliminar propiedades temporales de IndexedDB
        delete entData._qid;
        delete entData._offline;

        try {
          const { error } = await sb.from('entrevistas').insert(entData);
          if (!error) {
            await dbEliminar('entrevistas', qid);
            exitos++;
          } else {
            console.error('Fallo al subir entrevista remota:', error.message);
            errores++;
          }
        } catch (e) {
          errores++;
        }
      }
    }

    // 2. Sincronizar Puntos GPS
    if (localGPS.length > 0) {
      for (const punto of localGPS) {
        const puntoData = { ...punto };
        const qid = puntoData._qid;
        delete puntoData._qid;

        try {
          const { error } = await sb.from('gps_puntos').insert({
            usuario_id: puntoData.usuario_id,
            latitud: puntoData.latitud,
            longitud: puntoData.longitud,
            capturado_en: puntoData.capturado_en
          });
          if (!error) {
            await dbEliminar('gps_puntos', qid);
            exitos++;
          } else {
            errores++;
          }
        } catch (e) {
          errores++;
        }
      }
    }

    // Actualizar interfaz
    await actualizarBadgeSync();

    if (exitos > 0) {
      toast(`✓ ${exitos} registro${exitos > 1 ? 's' : ''} sincronizado${exitos > 1 ? 's' : ''} con éxito`);
      if (yo && yo.rol === 'entrevistador') {
        cargarInicioE();
        // Recargar historial si la vista actual es historial
        if (!$('e-his').classList.contains('hidden')) {
          cargarHis();
        }
      }
    }
  } catch (err) {
    console.error('Error durante la sincronización:', err);
  }
}
