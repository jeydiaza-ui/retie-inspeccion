/*
 * app.js — Interfaz, estado, almacenamiento e informe.
 * Requiere calc.js, data.js y report.js cargados antes.
 */
(function () {
  'use strict';

  const C = window.CALC;
  const D = window.DATA;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const SEV = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
  const LS = {
    get(k, def) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }
      catch (e) { return def; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) { return false; }
    },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  let DOC = null;
  let RES = null;
  let SETTINGS = C.criterios(LS.get(D.STORAGE_SETTINGS, {}));
  let CUR = 'info';
  let saveTimer = null;
  let refreshFrame = null;
  let db = null;

  // =========================================================================
  // Utilidades
  // =========================================================================

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function set(path, value) {
    const partes = path.split('.');
    const last = partes.pop();
    let o = DOC;
    for (const p of partes) {
      const key = String(+p) === p ? +p : p;
      if (o[key] == null) o[key] = {};
      o = o[key];
    }
    o[String(+last) === last ? +last : last] = value;
  }

  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), ms || 2600);
  }

  function setSaveState(txt) { $('#saveState').textContent = txt; }

  const hora = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  // =========================================================================
  // Persistencia
  // =========================================================================

  function indice() { return LS.get(D.STORAGE_INDEX, []); }

  function nombreDoc(doc) {
    const n = String(doc.info.proyecto || '').trim();
    const c = String(doc.info.cliente || '').trim();
    return (n || 'Sin nombre') + (c ? ` · ${c}` : '');
  }

  function indexar() {
    const idx = indice().filter(x => x.id !== DOC.id);
    idx.unshift({
      id: DOC.id,
      nombre: nombreDoc(DOC),
      actualizado: DOC.meta.actualizado || new Date().toISOString()
    });
    idx.sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)));
    LS.set(D.STORAGE_INDEX, idx);
    LS.set('retie3.active', DOC.id);
    pintarSelector(idx);
  }

  function pintarSelector(idx) {
    const sel = $('#selDoc');
    const lista = idx || indice();
    sel.innerHTML = lista.map(x => `<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join('') ||
      '<option value="">Sin expedientes</option>';
    sel.value = DOC.id;
  }

  function guardar(force) {
    clearTimeout(saveTimer);
    if (!force) {
      setSaveState('Guardando…');
      saveTimer = setTimeout(() => guardar(true), 450);
      return;
    }
    DOC.meta.actualizado = new Date().toISOString();
    if (LS.set(D.STORAGE_DOC + DOC.id, DOC)) {
      indexar();
      setSaveState('Guardado ' + hora());
    } else {
      setSaveState('Error al guardar');
      toast('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado. Exporte una copia.');
    }
  }

  function abrirDocumento(id) {
    guardar(true);
    const doc = LS.get(D.STORAGE_DOC + id, null);
    if (!doc) { toast('No se encontró el expediente.'); return; }
    DOC = D.normalizar(doc);
    D.sync(DOC);
    LS.set('retie3.active', DOC.id);
    pintarSelector();
    renderTodo();
  }

  function nuevoDocumento() {
    guardar(true);
    DOC = D.docNuevo();
    D.sync(DOC);
    guardar(true);
    pintarSelector();
    renderTodo();
    irA('info');
    toast('Expediente nuevo creado.');
  }

  function duplicarDocumento() {
    guardar(true);
    const copia = D.normalizar(JSON.parse(JSON.stringify(DOC)));
    copia.id = D.uid();
    copia.info.proyecto = (copia.info.proyecto || 'Sin nombre') + ' (copia)';
    copia.dict.firmaImg = '';
    copia.fotos = [];
    copia.meta = { creado: new Date().toISOString(), actualizado: new Date().toISOString() };
    DOC = copia;
    guardar(true);
    pintarSelector();
    renderTodo();
    toast('Expediente duplicado (sin fotos ni firma).');
  }

  function eliminarDocumento() {
    const nombre = nombreDoc(DOC);
    if (!confirm(`¿Eliminar el expediente "${nombre}"? Esta acción no se puede deshacer.\n\nSe recomienda "Guardar copia" antes de eliminar.`)) return;
    LS.del(D.STORAGE_DOC + DOC.id);
    const idx = indice().filter(x => x.id !== DOC.id);
    LS.set(D.STORAGE_INDEX, idx);
    if (idx.length) {
      DOC = D.normalizar(LS.get(D.STORAGE_DOC + idx[0].id, D.docNuevo()));
    } else {
      DOC = D.docNuevo();
      LS.set(D.STORAGE_DOC + DOC.id, DOC);
      LS.set(D.STORAGE_INDEX, [{ id: DOC.id, nombre: nombreDoc(DOC), actualizado: DOC.meta.actualizado }]);
    }
    D.sync(DOC);
    pintarSelector();
    renderTodo();
    toast('Expediente eliminado.');
  }

  function exportar() {
    guardar(true);
    const nombre = `RETIE_${(DOC.info.proyecto || 'proyecto').replace(/[^\wáéíóúñÁÉÍÓÚÑ-]+/g, '_')}_${DOC.info.fecha || D.hoyISO()}.json`;
    const blob = new Blob([JSON.stringify(DOC, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('Respaldo descargado.');
  }

  function importarArchivo(file) {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const doc = D.importar(JSON.parse(lector.result));
        doc.id = D.uid();
        doc.info.proyecto = (doc.info.proyecto || 'Sin nombre') + ' (importado)';
        guardar(true);
        DOC = doc;
        D.sync(DOC);
        guardar(true);
        pintarSelector();
        renderTodo();
        toast('Respaldo importado.');
      } catch (err) {
        alert('No se pudo importar el archivo:\n\n' + err.message);
      }
    };
    lector.onerror = () => alert('No se pudo leer el archivo.');
    lector.readAsText(file);
  }

  // =========================================================================
  // Fotos (IndexedDB)
  // =========================================================================

  function abrirDB() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('IndexedDB no disponible'));
      const r = indexedDB.open('retie3', 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains('fotos')) r.result.createObjectStore('fotos');
      };
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }

  function idbPut(id, data) {
    return abrirDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction('fotos', 'readwrite');
      tx.objectStore('fotos').put(data, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  }

  function idbGet(id) {
    return abrirDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction('fotos', 'readonly');
      const rq = tx.objectStore('fotos').get(id);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => rej(rq.error);
    }));
  }

  function idbDel(id) {
    return abrirDB().then(d => new Promise((res) => {
      const tx = d.transaction('fotos', 'readwrite');
      tx.objectStore('fotos').delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    }));
  }

  function comprimir(file, max, quality) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k));
          c.height = Math.max(1, Math.round(img.height * k));
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', quality));
        } catch (e) { rej(e); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Imagen no válida')); };
      img.src = url;
    });
  }

  async function agregarFotos(files) {
    if (!files || !files.length) return;
    for (const f of files) {
      if (!/^image\//.test(f.type)) continue;
      try {
        const datos = await comprimir(f, 1600, 0.82);
        const id = D.uid();
        await idbPut(id, datos);
        DOC.fotos.push({ id, caption: '' });
      } catch (e) {
        toast('No se pudo procesar una imagen: ' + e.message);
      }
    }
    guardar(true);
    renderSec('fotos');
    refresh();
    toast(`${files.length} imagen(es) agregada(s).`);
  }

  async function hidratarFotos() {
    const imgs = $$('img[data-foto]');
    for (const img of imgs) {
      if (img.dataset.cargada) continue;
      try {
        const datos = await idbGet(img.dataset.foto);
        if (datos) { img.src = datos; img.dataset.cargada = '1'; }
      } catch (e) { /* sin foto */ }
    }
  }

  // =========================================================================
  // Render de campos
  // =========================================================================

  function ctrl(f, path, value, id) {
    const attrs = [
      `id="${id}"`,
      `data-path="${path}"`,
      `aria-label="${esc(f.l)}"`,
      f.req ? 'aria-required="true"' : ''
    ].filter(Boolean).join(' ');
    const v = value == null ? '' : value;
    if (f.t === 's') {
      return `<select ${attrs}>${[''].concat(f.opts || []).map(o =>
        `<option value="${esc(o)}"${String(o) === String(v) ? ' selected' : ''}>${esc(o || '—')}</option>`).join('')}</select>`;
    }
    if (f.t === 'ta') return `<textarea ${attrs} rows="2">${esc(v)}</textarea>`;
    const tipo = f.t === 'd' ? 'date' : 'text';
    const extra = f.t === 'n' ? ' inputmode="decimal" autocomplete="off"' : '';
    return `<input ${attrs} type="${tipo}"${extra} value="${esc(v)}">`;
  }

  function campo(f, path, value) {
    const id = 'f_' + path.replace(/[^\w]/g, '_');
    const clase = f.ancho === 2 ? ' span2' : f.ancho === 3 ? ' span3' : '';
    const req = f.req ? ' <span class="req" aria-hidden="true">*</span>' : '';
    return `<label class="fld${clase}" for="${id}"><span class="lbl">${esc(f.l)}${req}</span>${ctrl(f, path, value, id)}</label>`;
  }

  function grid(sec, obj) {
    return `<div class="grid">${(D.CAMPOS[sec] || []).map(f =>
      campo(f, `${sec}.${f.k}`, obj ? obj[f.k] : '')).join('')}</div>`;
  }

  // =========================================================================
  // Render de tablas
  // =========================================================================

  function fasesDeFila(sec, row) {
    if (sec !== 'meas') return 3;
    const c = DOC.circ.find(x => x.uid === row.uid);
    return C.fasesDe(c ? c.tipo : 'Monofásico');
  }

  function fila(sec, cols, row, i, editable, prefijo) {
    const nf = fasesDeFila(sec, row);
    const base = (prefijo || sec) + '.' + i;
    const tds = cols.map(c => {
      if (c.t === 'c') return `<td class="calc" data-c="${sec}|${i}|${c.k}">—</td>`;
      if (c.fase && c.fase > nf) return '<td class="na" aria-label="No aplica">—</td>';
      return `<td>${ctrl(c, `${base}.${c.k}`, row[c.k], 'f_' + sec + '_' + i + '_' + c.k)}</td>`;
    }).join('');
    const rm = editable
      ? `<td><button type="button" class="rm" data-del-sec="${sec}" data-del-i="${i}" aria-label="Eliminar fila ${i + 1}" title="Eliminar fila">✕</button></td>`
      : '';
    return `<tr>${tds}${rm}</tr>`;
  }

  function tabla(sec, rows, opts) {
    opts = opts || {};
    const cols = D.TABLAS[sec];
    const editable = ['inst', 'circ', 'canal', 'lux', 'hall'].indexOf(sec) >= 0;
    const head = cols.map(c => `<th scope="col">${esc(c.l)}</th>`).join('') +
      (editable ? '<th scope="col"><span class="sr-only">Acciones</span></th>' : '');
    const vacio = `<tr><td colspan="${cols.length + (editable ? 1 : 0)}" class="note">Sin filas todavía.</td></tr>`;
    const cuerpo = rows.length
      ? rows.map((r, i) => fila(sec, cols, r, i, editable, opts.prefijo)).join('')
      : vacio;
    const add = editable
      ? `<div class="toolbar"><button type="button" data-add="${sec}">+ Agregar fila</button></div>`
      : '';
    return `${add}<div class="tbl-wrap"><table><thead><tr>${head}</tr></thead><tbody>${cuerpo}</tbody></table></div>`;
  }

  // =========================================================================
  // Cuerpo de cada sección
  // =========================================================================

  function tierraHTML() {
    const t = DOC.tierra;
    const pts = (t.pts || []).map((p, i) => `<tr>
      <td>${ctrl({ l: 'Distancia E–P (m)', t: 'n' }, `tierra.pts.${i}.d`, p.d, 'f_tierra_pts_' + i + '_d')}</td>
      <td>${ctrl({ l: 'Lectura (Ω)', t: 'n' }, `tierra.pts.${i}.R`, p.R, 'f_tierra_pts_' + i + '_R')}</td>
      <td class="calc" data-c="tierra|${i}|pct">—</td>
      <td><button type="button" class="rm" data-delpt="${i}" aria-label="Eliminar lectura ${i + 1}">✕</button></td>
    </tr>`).join('');
    return `${grid('tierra', t)}
      <div class="toolbar"><button type="button" data-addpt="1">+ Agregar lectura</button></div>
      <h3>Lecturas por distancia</h3>
      <p class="note">Distancia E–P: separación entre el electrodo y la pica de potencial. Se necesitan lecturas antes y después del 62 % de E–C.</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Distancia (m)</th><th>Lectura (Ω)</th><th>% de E–C</th><th><span class="sr-only">Acciones</span></th></tr></thead>
        <tbody>${pts || '<tr><td colspan="4" class="note">Sin lecturas.</td></tr>'}</tbody>
      </table></div>
      <h3>Resultado</h3>
      <div class="verdict">
        <div>Distancia al 62 % de E–C: <output data-out="d62">—</output></div>
        <div>Resistencia a 62 %: <output data-out="R">—</output></div>
        <div>1 m antes: <output data-out="rm">—</output> · 1 m después: <output data-out="rp">—</output></div>
        <div>Meseta (±10 %): <output data-out="meseta">—</output></div>
        <div>Estado: <output data-out="st">—</output></div>
      </div>
      <h3>Gráfica de lecturas</h3>
      <div class="method" id="tierraChart"></div>`;
  }

  function protHTML() {
    const campos = [
      { k: 'marca', l: 'Marca', t: 't' },
      { k: 'modelo', l: 'Modelo', t: 't' },
      { k: 'A', l: 'Capacidad (A)', t: 'n' },
      { k: 'kA', l: 'Poder de corte (kA)', t: 'n' },
      { k: 'curva', l: 'Curva', t: 's', opts: D.CURVAS },
      { k: 'icc', l: 'Icc en el punto (kA)', t: 'n' }
    ];
    return `<h3>Breaker principal</h3>
      <div class="grid">${campos.map(f => campo(f, `prot.main.${f.k}`, DOC.prot.main[f.k])).join('')}</div>
      <h3>Protección por circuito</h3>
      ${tabla('prot', DOC.prot.rows, { prefijo: 'prot.rows' })}`;
  }

  function megHTML() {
    return `<div class="grid">
        ${campo({ k: 'vp', l: 'Voltaje de prueba (V)', t: 's', opts: ['250', '500', '1000'] }, 'meg.vp', DOC.meg.vp)}
      </div>
      ${tabla('meg', DOC.meg.rows, { prefijo: 'meg.rows' })}`;
  }

  function dictHTML() {
    return `${grid('dict', DOC.dict)}
      <div class="verdict" id="dictSug">—</div>
      <h3>Firma del técnico</h3>
      <div class="sig-wrap">
        <canvas id="sigPad" class="sig-pad" aria-label="Área de firma del técnico"></canvas>
        <div class="toolbar">
          <button type="button" id="bClearSig">Limpiar firma</button>
          <span class="note">Firme con el dedo, el lápiz o el mouse. La firma se guarda en el dispositivo.</span>
        </div>
      </div>`;
  }

  function fotosHTML() {
    const lista = DOC.fotos.map((f, i) => `<figure class="foto">
      <img data-foto="${esc(f.id)}" alt="Foto ${i + 1} del anexo">
      <figcaption>
        <label class="fld" for="f_foto_${i}">Descripción
          <input id="f_foto_${i}" type="text" data-path="fotos.${i}.caption" value="${esc(f.caption || '')}" placeholder="Tablero, toma, puesta a tierra…">
        </label>
        <button type="button" class="rm" data-delfoto="${i}">Eliminar foto</button>
      </figcaption>
    </figure>`).join('');
    return `<div class="toolbar">
        <label class="fld" for="fFotos">Agregar fotos
          <input id="fFotos" type="file" accept="image/*" multiple>
        </label>
      </div>
      <p class="note">Las imágenes se reducen a 1600 px y se guardan en el navegador (IndexedDB). Exporte el respaldo JSON: las fotos no van dentro del JSON.</p>
      <div class="fotos">${lista || '<p class="note">Sin fotos.</p>'}</div>`;
  }

  function cuerpo(id) {
    switch (id) {
      case 'info': return grid('info', DOC.info) + '<h3>Condiciones ambientales</h3>' + grid('env', DOC.env);
      case 'inst': return tabla('inst', DOC.inst);
      case 'circ': return tabla('circ', DOC.circ);
      case 'meas': return tabla('meas', DOC.meas);
      case 'meg': return megHTML();
      case 'tierra': return tierraHTML();
      case 'prot': return protHTML();
      case 'canal': return tabla('canal', DOC.canal);
      case 'lux': return tabla('lux', DOC.lux);
      case 'hall': return tabla('hall', DOC.hall);
      case 'dict': return dictHTML();
      case 'fotos': return fotosHTML();
      default: return '';
    }
  }

  // =========================================================================
  // Gráfica del método del 62 %
  // =========================================================================

  function grafica(t) {
    const dEC = C.num(t.dEC);
    const pts = (t.pts || [])
      .map(p => ({ d: C.num(p.d), R: C.num(p.R) }))
      .filter(p => isFinite(p.d) && isFinite(p.R))
      .sort((a, b) => a.d - b.d);
    if (!pts.length) return '<p class="note">Ingrese distancia y lectura de cada punto para ver la gráfica.</p>';
    const W = 360, H = 230, m = 48;
    const xmax = Math.max(dEC || 0, ...pts.map(p => p.d)) * 1.05 || 1;
    const ymax = Math.max(...pts.map(p => p.R)) * 1.15 || 1;
    const sx = d => m + (d / xmax) * (W - m - 14);
    const sy = R => H - m - (R / ymax) * (H - m - 16);
    const d62 = 0.62 * dEC;
    const R62 = C.interpolar(pts, d62);
    const rm = C.interpolar(pts, d62 - 1);
    const rp = C.interpolar(pts, d62 + 1);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Resistencia de tierra contra distancia">`;
    s += `<line x1="${m}" y1="${H - m}" x2="${W - 10}" y2="${H - m}" stroke="#1B1F24"/>`;
    s += `<line x1="${m}" y1="10" x2="${m}" y2="${H - m}" stroke="#1B1F24"/>`;
    s += `<text x="${m - 6}" y="${H - m + 4}" text-anchor="end" font-size="11">0</text>`;
    s += `<text x="${m - 6}" y="${sy(ymax / 1.15) + 4}" text-anchor="end" font-size="11">${(ymax / 1.15).toFixed(0)} Ω</text>`;
    s += `<text x="${W - 10}" y="${H - m + 16}" text-anchor="end" font-size="11">${xmax.toFixed(0)} m</text>`;
    s += `<text x="${(m + W) / 2}" y="${H - 8}" text-anchor="middle" font-size="11">Distancia E–P (m)</text>`;
    s += `<polyline points="${pts.map(p => sx(p.d) + ',' + sy(p.R)).join(' ')}" fill="none" stroke="#5C6470" stroke-width="2"/>`;
    pts.forEach(p => { s += `<circle cx="${sx(p.d)}" cy="${sy(p.R)}" r="4" fill="#1B1F24"/>`; });
    if (isFinite(d62)) {
      s += `<line x1="${sx(d62)}" y1="10" x2="${sx(d62)}" y2="${H - m}" stroke="#F2B705" stroke-width="2" stroke-dasharray="5 4"/>`;
      [[rm, d62 - 1], [rp, d62 + 1]].forEach(([R, x]) => {
        if (isFinite(R)) s += `<rect x="${sx(x) - 5}" y="${sy(R) - 5}" width="10" height="10" fill="#2E6B45"/>`;
      });
      if (isFinite(R62)) s += `<circle cx="${sx(d62)}" cy="${sy(R62)}" r="7" fill="none" stroke="#B3261E" stroke-width="2.5"/>`;
    }
    s += '</svg>';
    return s;
  }

  // =========================================================================
  // Firma
  // =========================================================================

  let firmaCtx = null;

  function initFirma() {
    const cv = $('#sigPad');
    if (!cv) { firmaCtx = null; return; }
    const W = 1000, H = 320;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    firmaCtx = ctx;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';

    if (DOC.dict.firmaImg) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, W, H);
      img.src = DOC.dict.firmaImg;
    }

    let dibujando = false;
    const pos = e => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };
    cv.addEventListener('pointerdown', e => {
      dibujando = true;
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      if (!dibujando) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    });
    const fin = () => {
      if (!dibujando) return;
      dibujando = false;
      DOC.dict.firmaImg = cv.toDataURL('image/png');
      guardar();
    };
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', e => { if (dibujando && e.buttons === 0) fin(); });
  }

  // =========================================================================
  // Secciones y navegación
  // =========================================================================

  function renderSec(id) {
    const host = document.getElementById('body-' + id);
    if (!host) return;
    host.innerHTML = cuerpo(id);
    if (id === 'dict') initFirma();
    if (id === 'fotos') hidratarFotos();
  }

  function renderTodo() {
    D.SECCIONES.forEach(s => renderSec(s.id));
    refresh();
  }

  function construirNav() {
    $('#nav').innerHTML = D.SECCIONES.map(s => {
      const t = s.titulo.replace(/^\d+\.\s*/, '');
      return `<button type="button" data-t="${s.id}" aria-current="false">${esc(t)}<span class="n" hidden></span></button>`;
    }).join('');
  }

  function irA(id) {
    CUR = id;
    $$('section.sec').forEach(x => x.classList.toggle('on', x.id === 's-' + id));
    $$('nav button[data-t]').forEach(b => b.setAttribute('aria-current', b.dataset.t === id ? 'true' : 'false'));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // =========================================================================
  // Actualización de cálculos y alertas
  // =========================================================================

  function txtCalc(sec, i, k) {
    let r;
    if (sec === 'prot') r = RES.prot[i];
    else if (sec === 'tierra') r = RES.tierra;
    else r = RES[sec] && RES[sec][i];
    if (!r) return '';
    switch (sec) {
      case 'circ':
        return { id: r.id, st: r.st, VA: r.vaTxt, I: r.iTxt, dv: r.dvTxt, amp: r.ampTxt }[k] || '';
      case 'meas':
        return { id: r.id, st: r.st, P: r.pTxt, S: r.sTxt, Q: r.qTxt, Im: r.imTxt, dvs: r.dvsTxt }[k] || '';
      case 'meg':
        return { id: r.id, st: r.st, pt: r.ptLabel, min: r.minTxt }[k] || '';
      case 'prot':
        return { id: r.id, st: r.st, brk: r.brk, curva: r.curva }[k] || '';
      case 'canal':
        return { st: r.st, ocu: r.pctTxt }[k] || '';
      case 'lux':
        return { ef: r.efTxt, dp: r.dpTxt, ok: r.okTxt, st: r.st }[k] || '';
      case 'tierra':
        return r[k] || '';
      default:
        return '';
    }
  }

  function claseEstado(txt) {
    if (txt === 'OK' || txt === 'CERRADO') return 'st-OK';
    if (txt === 'NO CUMPLE' || txt === 'ABIERTO') return 'st-NO';
    return 'st-INCOMPLETO';
  }

  function pintarAlertas() {
    const marcas = {};
    RES.issues.forEach(i => {
      let key;
      if (i.sec === 'prot' && i.idx === -1) key = 'prot.main.' + i.k;
      else if (i.sec === 'meg') key = 'meg.rows.' + i.idx + '.' + i.k;
      else if (i.sec === 'prot') key = 'prot.rows.' + i.idx + '.' + i.k;
      else if (['info', 'env', 'dict', 'tierra'].indexOf(i.sec) >= 0) key = i.sec + '.' + i.k;
      else key = i.sec + '.' + i.idx + '.' + i.k;
      marcas[key] = i;
    });

    $$('[data-path]').forEach(el => {
      const m = marcas[el.dataset.path];
      el.classList.toggle('bad', !!m);
      if (m) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
      el.title = m ? `${SEV[m.sev]}: ${m.msg}` : '';
    });

    $$('[data-c]').forEach(el => {
      const m = marcas[el.dataset.c.replace(/\|/g, '.')];
      el.classList.toggle('bad', !!m);
      el.title = m ? `${SEV[m.sev]}: ${m.msg}` : '';
    });

    D.SECCIONES.forEach(s => {
      const host = document.getElementById('iss-' + s.id);
      if (!host) return;
      const lista = RES.issues.filter(i => i.sec === s.id);
      host.innerHTML = lista.length
        ? `<ul class="issues" aria-label="Alertas de la sección">${lista.map(i =>
            `<li class="sev-${i.sev}"><span class="tag">${SEV[i.sev]}</span>${esc(i.msg)}</li>`).join('')}</ul>`
        : '<p class="ok-note">Sin alertas en esta sección.</p>';
      const btn = document.querySelector(`nav button[data-t="${s.id}"] .n`);
      if (btn) {
        const n = lista.length;
        btn.textContent = n;
        btn.hidden = !n;
      }
    });
  }

  function pintarVeredicto() {
    const v = RES.veredicto;
    const chip = $('#verdictChip');
    chip.textContent = `${v.concepto} · ${v.total} alerta(s)`;
    chip.className = 'chip ' + (v.concepto === 'Aprobado' ? 'ok' : v.concepto === 'Aprobado con observaciones' ? 'warn' : 'bad');
    chip.title = `Críticas: ${v.cuenta.critica} · Altas: ${v.cuenta.alta} · Medias: ${v.cuenta.media}`;

    const sug = $('#dictSug');
    if (sug) {
      const c = v.cuenta;
      sug.innerHTML = `<strong>Sugerencia automática: ${esc(v.concepto)}</strong>
        <div class="note">${c.critica} crítica(s), ${c.alta} alta(s), ${c.media} media(s). ${
          RES.dictOk ? '' : '<span class="draft">BORRADOR: dictamen incompleto</span>'
        }</div>
        <p class="note">La sugerencia se calcula por severidad (una sola alerta crítica impide aprobar) y no reemplaza el criterio del técnico responsable.</p>`;
    }
  }

  function refresh() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = null;
      RES = D.evaluar(DOC, SETTINGS);

      $$('[data-c]').forEach(el => {
        const [sec, i, k] = el.dataset.c.split('|');
        if (sec === 'tierra') {
          const p = (DOC.tierra.pts || [])[+i];
          const d = p ? C.num(p.d) : NaN;
          const dEC = C.num(DOC.tierra.dEC);
          el.textContent = isFinite(d) && isFinite(dEC) && dEC > 0 ? C.fmt((d / dEC) * 100, 0) + ' %' : '—';
          return;
        }
        const txt = txtCalc(sec, +i, k);
        el.textContent = txt || '—';
        if (k === 'st') el.className = 'calc ' + claseEstado(txt);
        else if (k === 'ok') el.className = 'calc ' + (txt === 'Sí' ? 'st-OK' : txt === 'No' ? 'st-NO' : '');
        else el.className = 'calc';
      });

      $$('[data-out]').forEach(el => {
        const t = RES.tierra;
        const mapa = {
          d62: t.d62Txt, R: t.rTxt, rm: t.rmTxt, rp: t.rpTxt,
          meseta: t.mesetaTxt, st: t.st
        };
        const txt = mapa[el.dataset.out] || '—';
        el.textContent = txt;
        el.className = el.dataset.out === 'st' ? claseEstado(txt) : '';
      });

      const ch = $('#tierraChart');
      if (ch) ch.innerHTML = grafica(DOC.tierra);

      pintarAlertas();
      pintarVeredicto();
    });
  }

  // =========================================================================
  // Eventos de edición
  // =========================================================================

  function actualizarDoc() {
    guardar();
    refresh();
  }

  function onInput(e) {
    const el = e.target.closest('[data-path]');
    if (!el) return;
    set(el.dataset.path, el.value);
    if (el.dataset.path === 'info.sistema') {
      D.sync(DOC);
      renderSec('meg');
      renderSec('meas');
      renderSec('circ');
      renderSec('prot');
    }
    if (/\.tipo$/.test(el.dataset.path)) {
      D.sync(DOC);
      renderSec('circ');
      renderSec('meas');
      renderSec('meg');
      renderSec('prot');
    }
    actualizarDoc();
  }

  function onAdd(sec) {
    const plantillas = {
      inst: () => ({}),
      circ: () => ({ uid: D.uid(), tipo: 'Monofásico', continua: 'No', fd: 1, fp: 0.9, uso: 'Iluminación' }),
      canal: () => ({}),
      lux: () => ({}),
      hall: () => ({ n: String(DOC.hall.length + 1), est: 'Abierto', pri: 'Media' })
    };
    if (!plantillas[sec]) return;
    DOC[sec].push(plantillas[sec]());
    D.sync(DOC);
    guardar(true);
    renderSec(sec);
    if (sec === 'circ') { renderSec('meas'); renderSec('meg'); renderSec('prot'); }
    refresh();
  }

  function onDel(sec, i) {
    if (sec === 'circ') {
      const m = DOC.circ[i];
      const med = DOC.meas.find(x => x.uid === m.uid);
      const tieneDatos = med && ['va', 'vb', 'vc', 'ia', 'ib', 'ic', 'fp', 'hz'].some(k => med[k]);
      if (tieneDatos && !confirm('Este circuito tiene mediciones, aislamiento y protección asociados. Se eliminarán también. ¿Continuar?')) return;
    }
    DOC[sec].splice(i, 1);
    D.sync(DOC);
    guardar(true);
    renderSec(sec);
    if (sec === 'circ') { renderSec('meas'); renderSec('meg'); renderSec('prot'); }
    refresh();
  }

  function onDelFoto(i) {
    const f = DOC.fotos[i];
    if (!f) return;
    if (!confirm('¿Eliminar esta foto del anexo?')) return;
    idbDel(f.id);
    DOC.fotos.splice(i, 1);
    guardar(true);
    renderSec('fotos');
    refresh();
  }

  function onAddPt() {
    DOC.tierra.pts.push({});
    guardar(true);
    renderSec('tierra');
    refresh();
  }

  function onDelPt(i) {
    DOC.tierra.pts.splice(i, 1);
    guardar(true);
    renderSec('tierra');
    refresh();
  }

  // =========================================================================
  // Criterios
  // =========================================================================

  const CRIT_CAMPOS = [
    ['dvMax', 'ΔV máximo (%)', 'NTC 2050 210-19'],
    ['dvCritico', 'ΔV crítico (%)', 'por encima se marca crítica'],
    ['vTol', 'Tolerancia de tensión (± %)', 'NTC 2050 / RETIE'],
    ['hzNom', 'Frecuencia nominal (Hz)', ''],
    ['hzTol', 'Tolerancia de frecuencia (± %)', ''],
    ['fpMin', 'FP mínimo', 'criterio de facturación'],
    ['icont', 'Fracción del breaker, carga continua', '0,8 = 80 %'],
    ['tempAmp', 'Temperatura de ampacidad (°C)', '60 / 75 / 90'],
    ['factorDerrateo', 'Factor de derrateo', 'agrupamiento y temperatura'],
    ['tierraMax', 'Resistencia de tierra máxima (Ω)', 'valor de referencia'],
    ['contMax', 'Continuidad máxima (Ω)', ''],
    ['aislamientoMin', 'Aislamiento mínimo (MΩ)', ''],
    ['rcdMa', 'Sensibilidad diferencial máxima (mA)', ''],
    ['rcdMs', 'Tiempo de disparo máximo (ms)', ''],
    ['ocupacionMax', 'Ocupación de tubería máxima (%)', 'manual, si no se calcula'],
    ['desbalanceMax', 'Desbalance máximo (%)', 'tensión y corriente'],
    ['vntMax', 'Tensión N–T máxima (V)', ''],
    ['tempMax', 'Temperatura máxima (°C)', ''],
    ['fpDemanda', 'FP asumido para demanda', '']
  ];

  function pintarAjustes() {
    $('#settingsBody').innerHTML = CRIT_CAMPOS.map(([k, l, hint]) =>
      `<label class="fld" for="c_${k}">${esc(l)}
        <input id="c_${k}" data-crit="${k}" type="text" inputmode="decimal" value="${esc(SETTINGS[k])}">
        ${hint ? `<span class="note">${esc(hint)}</span>` : ''}
      </label>`).join('');
  }

  function guardarAjustes() {
    const nuevo = {};
    $$('[data-crit]').forEach(el => {
      const v = C.num(el.value);
      if (isFinite(v)) nuevo[el.dataset.crit] = v;
    });
    if (!(nuevo.icont > 0 && nuevo.icont <= 1)) nuevo.icont = 0.8;
    if (!(nuevo.tempAmp === 60 || nuevo.tempAmp === 75 || nuevo.tempAmp === 90)) nuevo.tempAmp = 75;
    SETTINGS = C.criterios(nuevo);
    LS.set(D.STORAGE_SETTINGS, SETTINGS);
    refresh();
    toast('Criterios guardados.');
    $('#dlgSettings').close();
  }

  // =========================================================================
  // Informe
  // =========================================================================

  async function abrirInforme() {
    guardar(true);
    RES = D.evaluar(DOC, SETTINGS);
    if (!RES.dictOk) {
      const ok = confirm('El dictamen está incompleto (concepto, fecha, técnico, matrícula o firma).\n\nEl informe se generará marcado como BORRADOR. ¿Desea continuar?');
      if (!ok) { irA('dict'); return; }
    }
    const fotos = {};
    for (const f of DOC.fotos) {
      try { fotos[f.id] = await idbGet(f.id); } catch (e) { /* sin foto */ }
    }
    const cont = document.getElementById('report');
    cont.hidden = false;
    document.body.style.overflow = 'hidden';
    try {
      window.REPORT.render(DOC, RES, SETTINGS, fotos, document.getElementById('reportPages'));
    } catch (e) {
      cont.hidden = true;
      document.body.style.overflow = '';
      alert('No se pudo generar el informe: ' + e.message);
      return;
    }
    document.getElementById('reportState').textContent = RES.dictOk
      ? 'Documento completo'
      : 'BORRADOR: complete el dictamen y la firma';
    cont.scrollTop = 0;
  }

  function cerrarInforme() {
    document.getElementById('report').hidden = true;
    document.body.style.overflow = '';
  }

  // =========================================================================
  // Arranque
  // =========================================================================

  function eventos() {
    $('#nav').addEventListener('click', e => {
      const b = e.target.closest('button[data-t]');
      if (b) irA(b.dataset.t);
    });

    const main = $('#main');
    main.addEventListener('input', onInput);
    main.addEventListener('change', onInput);
    main.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) { onAdd(add.dataset.add); return; }
      const del = e.target.closest('[data-del-sec]');
      if (del) { onDel(del.dataset.delSec, +del.dataset.delI); return; }
      const addpt = e.target.closest('[data-addpt]');
      if (addpt) { onAddPt(); return; }
      const delpt = e.target.closest('[data-delpt]');
      if (delpt) { onDelPt(+delpt.dataset.delpt); return; }
      const delf = e.target.closest('[data-delfoto]');
      if (delf) { onDelFoto(+delf.dataset.delfoto); return; }
      if (e.target.id === 'bClearSig') {
        DOC.dict.firmaImg = '';
        guardar(true);
        renderSec('dict');
        refresh();
      }
    });

    main.addEventListener('change', e => {
      if (e.target.id === 'fFotos') {
        agregarFotos(e.target.files);
        e.target.value = '';
      }
    });

    $('#selDoc').addEventListener('change', e => { if (e.target.value) abrirDocumento(e.target.value); });
    $('#bNew').addEventListener('click', nuevoDocumento);
    $('#bDup').addEventListener('click', duplicarDocumento);
    $('#bDel').addEventListener('click', eliminarDocumento);
    $('#bSave').addEventListener('click', exportar);
    $('#bOpen').addEventListener('click', () => $('#fOpen').click());
    $('#fOpen').addEventListener('change', e => {
      if (e.target.files[0]) importarArchivo(e.target.files[0]);
      e.target.value = '';
    });
    $('#bSettings').addEventListener('click', () => { pintarAjustes(); $('#dlgSettings').showModal(); });
    $('#bCloseSettings').addEventListener('click', () => $('#dlgSettings').close());
    $('#bSaveSettings').addEventListener('click', e => { e.preventDefault(); guardarAjustes(); });
    $('#bResetCrit').addEventListener('click', () => {
      SETTINGS = C.criterios();
      LS.set(D.STORAGE_SETTINGS, SETTINGS);
      pintarAjustes();
      refresh();
      toast('Criterios restablecidos a los valores por defecto.');
    });
    $('#bReport').addEventListener('click', abrirInforme);
    $('#bPrint').addEventListener('click', () => window.print());
    $('#bCloseReport').addEventListener('click', cerrarInforme);

    window.addEventListener('beforeunload', () => guardar(true));
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('#report').hidden) cerrarInforme();
    });
  }

  function arrancar() {
    const idx = indice();
    const activo = LS.get('retie3.active', null);
    let doc = activo ? LS.get(D.STORAGE_DOC + activo, null) : null;
    if (!doc && idx.length) doc = LS.get(D.STORAGE_DOC + idx[0].id, null);
    DOC = D.normalizar(doc || D.docNuevo());
    D.sync(DOC);

    construirNav();
    $('#main').innerHTML = D.SECCIONES.map(s =>
      `<section class="sec" id="s-${s.id}" aria-labelledby="h-${s.id}">
        <h2 id="h-${s.id}">${esc(s.titulo)}</h2>
        <p class="note">${esc(s.nota)}</p>
        <div id="body-${s.id}"></div>
        <div id="iss-${s.id}"></div>
      </section>`).join('');

    eventos();
    indexar();
    pintarSelector();
    renderTodo();
    irA('info');
    setSaveState('Guardado ' + hora());

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin conexión disponible */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
