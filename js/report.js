/*
 * report.js — Generador del informe A4 paginado.
 *
 * Construye las páginas midiendo el contenido real en el navegador, de modo
 * que ninguna tabla quede recortada y cada página lleve encabezado y pie con
 * numeración. No usa dependencias externas.
 */
(function (root) {
  'use strict';

  const C = root.CALC;
  const D = root.DATA;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const fecha = v => {
    if (!v) return '—';
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
  };

  /** Título de la sección, tomado del modelo para que informe y app coincidan. */
  const titulo = id => {
    const s = D.SECCIONES.find(x => x.id === id);
    return s ? s.titulo : id;
  };

  function nodo(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    if (t.content.children.length > 1 && typeof console !== 'undefined') {
      console.warn('nodo(): se recibieron varios elementos y solo se usa el primero. Use un nodo por bloque.', html);
    }
    return t.content.firstElementChild;
  }

  function claseEstado(txt) {
    if (txt === 'OK' || txt === 'CERRADO') return 'ok';
    if (txt === 'NO CUMPLE' || txt === 'ABIERTO') return 'no';
    return 'incompleto';
  }

  /** Tabla DOM con encabezado; el paginador la parte por filas. */
  function tabla(cols, filas, titulo) {
    const t = document.createElement('table');
    if (titulo) {
      const cap = document.createElement('caption');
      cap.style.captionSide = 'top';
      cap.style.textAlign = 'left';
      cap.style.fontWeight = '700';
      cap.style.padding = '0 0 1.2mm';
      cap.textContent = titulo;
      t.appendChild(cap);
    }
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    cols.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c.l;
      if (c.num) th.className = 'num';
      if (c.w) th.style.width = c.w;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    t.appendChild(thead);
    const tb = document.createElement('tbody');
    filas.forEach(f => {
      const row = document.createElement('tr');
      cols.forEach(c => {
        const td = document.createElement('td');
        const v = c.v ? c.v(f) : f[c.k];
        if (c.cls) td.className = typeof c.cls === 'function' ? c.cls(f) : c.cls;
        if (c.num) td.className = (td.className ? td.className + ' ' : '') + 'num';
        td.textContent = v == null || v === '' ? '—' : String(v);
        row.appendChild(td);
      });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    return t;
  }

  function kv(pares) {
    return `<div class="kv">${pares.map(([k, v]) =>
      `<dt>${esc(k)}</dt><dd>${v == null || v === '' ? '—' : esc(v)}</dd>`).join('')}</div>`;
  }

  // -------------------------------------------------------------------------
  // Construcción del contenido
  // -------------------------------------------------------------------------

  function bloqueResumen(doc, res) {
    const v = res.veredicto;
    const out = [];
    const malo = v.concepto === 'No aprobado' || v.concepto === 'Incompleto';
    out.push(nodo(`<h2>Resumen ejecutivo</h2>`));
    out.push(nodo(`<div class="callout${malo ? ' bad' : ''}">
      <strong>Concepto sugerido: ${esc(v.concepto)}</strong><br>
      ${v.cuenta.critica} alerta(s) crítica(s), ${v.cuenta.alta} alta(s), ${v.cuenta.media} media(s).
      ${res.dictOk ? '' : '<br><strong>Documento en borrador: el dictamen no está completo.</strong>'}
    </div>`));
    out.push(nodo(kv([
      ['Proyecto', doc.info.proyecto],
      ['Cliente', doc.info.cliente],
      ['Dirección', doc.info.direccion],
      ['Sistema eléctrico', doc.info.sistema],
      ['Normativa', doc.info.normativa],
      ['Técnico', doc.info.tecnico],
      ['Circuitos', String(doc.circ.length)],
      ['Demanda total', `${C.fmt(res.demandaTotal, 0)} VA`],
      ['Breaker principal', doc.prot.main.A ? `${doc.prot.main.A} A` : ''],
      ['Resistencia de tierra', res.tierra.rTxt]
    ])));

    const criticas = res.issues.filter(i => i.sev === 'critica' || i.sev === 'alta').slice(0, 14);
    if (criticas.length) {
      out.push(nodo(`<h3>Alertas principales</h3>`));
      out.push(nodo(`<ul class="issues">${criticas.map(i =>
        `<li class="sev-${i.sev}"><span class="tag">${esc(i.sev)}</span>${esc(i.msg)}</li>`).join('')}</ul>`));
    }
    return out;
  }

  function bloqueProyecto(doc, res) {
    const out = [nodo(`<h2>${esc(titulo('info'))}</h2>`)];
    out.push(nodo(kv([
      ['N.º de informe', doc.info.informe],
      ['Proyecto', doc.info.proyecto],
      ['Cliente', doc.info.cliente],
      ['Dirección', doc.info.direccion],
      ['Teléfono', doc.info.telefono],
      ['Correo', doc.info.correo],
      ['Inmueble', doc.info.inmueble],
      ['Área / pisos', [doc.info.area ? `${doc.info.area} m²` : '', doc.info.pisos ? `${doc.info.pisos} piso(s)` : ''].filter(Boolean).join(' · ')],
      ['Uso', doc.info.uso],
      ['Fecha', fecha(doc.info.fecha)],
      ['Sistema', doc.info.sistema],
      ['Normativa', doc.info.normativa],
      ['Técnico', doc.info.tecnico],
      ['Matrícula', doc.info.matricula],
      ['Empresa', doc.info.empresa],
      ['Croquis', doc.info.croquis]
    ])));
    if (doc.info.alcance) {
      out.push(nodo('<h3>Objeto y alcance</h3>'));
      out.push(nodo(`<p>${esc(doc.info.alcance)}</p>`));
    }
    return out;
  }

  function bloqueInstrumentos(doc) {
    const out = [nodo(`<h2>${esc(titulo('inst'))}</h2>`)];
    const env = [
      ['Temperatura ambiente', doc.env.tempAmb ? `${doc.env.tempAmb} °C` : ''],
      ['Humedad relativa', doc.env.humedad ? `${doc.env.humedad} %` : ''],
      ['Condición', doc.env.clima],
      ['Hora', doc.env.hora]
    ].filter(([, v]) => v);
    if (env.length) {
      out.push(nodo('<h3>Condiciones ambientales</h3>'));
      out.push(nodo(kv(env)));
    }
    if (doc.env.notas) out.push(nodo(`<p class="muted">${esc(doc.env.notas)}</p>`));

    if (doc.inst.length) {
      out.push(nodo('<h3>Instrumentos y calibración</h3>'));
      out.push(tabla([
        { l: 'Instrumento', k: 'instrumento' },
        { l: 'Marca / modelo', v: f => [f.marca, f.modelo].filter(Boolean).join(' ') },
        { l: 'Serial', k: 'serial' },
        { l: 'Calibración', v: f => fecha(f.calibracion) },
        { l: 'Vence', v: f => fecha(f.vence) },
        { l: 'Observaciones', k: 'obs' }
      ], doc.inst));
    } else {
      out.push(nodo('<p class="muted">Sin instrumentos registrados.</p>'));
    }
    return out;
  }

  function bloqueCircuitos(doc, res) {
    if (!doc.circ.length) return [];
    const out = [nodo(`<h2>${esc(titulo('circ'))}</h2>`)];
    out.push(nodo('<h3>Datos del circuito</h3>'));
    out.push(tabla([
      { l: 'ID', v: r => r.id, w: '10mm' },
      { l: 'Tipo', v: r => r.tipo },
      { l: 'Descripción', v: r => r.desc },
      { l: 'Uso', v: r => r.uso },
      { l: 'Breaker', v: r => r.brk, num: true },
      { l: 'Curva', v: r => r.curva },
      { l: 'Conductor', v: r => r.cal }
    ], doc.circ.map((c, i) => Object.assign({}, c, { id: res.circ[i].id }))));
    out.push(nodo('<h3>Cálculo de demanda y caída de tensión</h3>'));
    out.push(tabla([
      { l: 'ID', v: r => r.id, w: '10mm' },
      { l: 'Long.', v: r => r.L, num: true },
      { l: 'Carga (W)', v: r => r.W, num: true },
      { l: 'FD', v: r => r.fd, num: true },
      { l: 'FP', v: r => r.fp, num: true },
      { l: 'VA', v: r => r.vaTxt, num: true },
      { l: 'I (A)', v: r => r.iTxt, num: true },
      { l: 'ΔV', v: r => r.dvTxt, num: true },
      { l: 'Ampacidad', v: r => r.ampTxt, num: true },
      { l: 'Estado', v: r => r.st, cls: r => claseEstado(r.st) }
    ], doc.circ.map((c, i) => Object.assign({}, c, res.circ[i]))));
    return out;
  }

  function bloqueMediciones(doc, res) {
    const filas = doc.meas
      .map((m, i) => Object.assign({}, m, res.meas[i]))
      .filter(r => ['va', 'vb', 'vc', 'ia', 'ib', 'ic', 'fp', 'hz', 'dvm'].some(k => r[k] !== '' && r[k] != null));
    if (!filas.length) return [];
    const out = [nodo(`<h2>${esc(titulo('meas'))}</h2>`)];
    out.push(nodo('<h3>Tensiones y calidad de la energía</h3>'));
    out.push(tabla([
      { l: 'ID', v: r => r.id, w: '10mm' },
      { l: 'V A–N', v: r => r.va, num: true },
      { l: 'V B–N', v: r => r.vb, num: true },
      { l: 'V C–N', v: r => r.vc, num: true },
      { l: 'V N–T', v: r => r.vn, num: true },
      { l: 'FP', v: r => r.fp, num: true },
      { l: 'Hz', v: r => r.hz, num: true },
      { l: 'Temp.', v: r => r.tmp, num: true },
      { l: 'ΔV med.', v: r => r.dvm, num: true },
      { l: 'Estado', v: r => r.st, cls: r => claseEstado(r.st) }
    ], filas));
    out.push(nodo('<h3>Corrientes y potencias</h3>'));
    out.push(tabla([
      { l: 'ID', v: r => r.id, w: '10mm' },
      { l: 'I A', v: r => r.ia, num: true },
      { l: 'I B', v: r => r.ib, num: true },
      { l: 'I C', v: r => r.ic, num: true },
      { l: 'I N', v: r => r.ine, num: true },
      { l: 'P (W)', v: r => r.pTxt, num: true },
      { l: 'S (VA)', v: r => r.sTxt, num: true },
      { l: 'Q (var)', v: r => r.qTxt, num: true },
      { l: 'I prom.', v: r => r.imTxt, num: true }
    ], filas));
    const obs = filas.filter(r => r.obs);
    if (obs.length) {
      out.push(nodo('<h3>Observaciones</h3>'));
      obs.forEach(r => out.push(nodo(`<p><strong>${esc(r.id)}</strong> · ${esc(r.obs)}</p>`)));
    }
    return out;
  }

  function bloqueAislamiento(doc, res) {
    const filas = doc.meg.rows
      .map((m, i) => Object.assign({}, m, res.meg[i]))
      .filter(r => r.s30 || r.m1);
    if (!filas.length) return [];
    const out = [nodo(`<h2>${esc(titulo('meg'))}</h2>`)];
    out.push(nodo(`<p class="muted">Voltaje de prueba: ${esc(doc.meg.vp || '—')} V · mínimo ${C.fmt(res.crit.aislamientoMin, 1)} MΩ</p>`));
    out.push(tabla([
      { l: 'ID', v: r => r.id, w: '11mm' },
      { l: 'Punto de medición', v: r => r.ptLabel },
      { l: '30 s (MΩ)', v: r => r.s30, num: true },
      { l: '1 min (MΩ)', v: r => r.m1, num: true },
      { l: 'Mínimo', v: r => r.minTxt, num: true },
      { l: 'Estado', v: r => r.st, cls: r => claseEstado(r.st) }
    ], filas));
    return out;
  }

  function bloqueTierra(doc, res) {
    const t = doc.tierra;
    const r = res.tierra;
    const out = [nodo(`<h2>${esc(titulo('tierra'))}</h2>`)];
    out.push(nodo(kv([
      ['Tipo de electrodo', t.tipo],
      ['Electrodos / profundidad', [t.n ? `${t.n} electrodo(s)` : '', t.prof ? `${t.prof} m` : ''].filter(Boolean).join(' · ')],
      ['Material', t.mat],
      ['Método', t.met],
      ['Distancia E–C', t.dEC ? `${t.dEC} m` : ''],
      ...(/pinza/i.test(t.met || '') ? [['Lectura de pinza', t.Rp ? `${t.Rp} Ω` : '']] : []),
      ['Máximo permitido', t.rmax ? `${t.rmax} Ω` : ''],
      ['Continuidad', t.cont ? `${t.cont} Ω` : ''],
      ['Conductor de tierra', t.cal],
      ['Requerido 250-122', res.tierraReq && res.tierraReq.awg ? `${res.tierraReq.awg} AWG` : ''],
      ['Conexiones', t.con]
    ])));
    const pts = (t.pts || []).filter(p => p.d || p.R);
    if (pts.length) {
      out.push(tabla([
        { l: 'Distancia E–P (m)', v: p => p.d, num: true },
        { l: 'Lectura (Ω)', v: p => p.R, num: true }
      ], pts));
    }
    out.push(nodo(`<div class="callout">
      <strong>Resultado del método:</strong> distancia al 62 % ${esc(r.d62Txt)};
      resistencia ${esc(r.rTxt)}; 1 m antes ${esc(r.rmTxt)}; 1 m después ${esc(r.rpTxt)};
      meseta ${esc(r.mesetaTxt)}; estado <strong class="${claseEstado(r.st)}">${esc(r.st)}</strong>.
    </div>`));
    const chart = document.getElementById('tierraChart');
    if (chart && chart.querySelector('svg')) {
      const caja = document.createElement('div');
      caja.className = 'chart';
      caja.appendChild(chart.querySelector('svg').cloneNode(true));
      out.push(caja);
    }
    if (t.obs) out.push(nodo(`<p>${esc(t.obs)}</p>`));
    return out;
  }

  function bloqueProtecciones(doc, res) {
    const out = [nodo(`<h2>${esc(titulo('prot'))}</h2>`)];
    const m = doc.prot.main || {};
    out.push(nodo(kv([
      ['Breaker principal', [m.marca, m.modelo].filter(Boolean).join(' ')],
      ['Capacidad', m.A ? `${m.A} A` : ''],
      ['Poder de corte', m.kA ? `${m.kA} kA` : ''],
      ['Curva', m.curva],
      ['Icc en el punto', m.icc ? `${m.icc} kA` : '']
    ])));
    const filas = doc.prot.rows
      .map((p, i) => Object.assign({}, p, res.prot[i]))
      .filter(p => p.tp || p.kA || p.ma || p.pr);
    if (filas.length) {
      out.push(tabla([
        { l: 'ID', v: r => r.id, w: '11mm' },
        { l: 'Breaker', v: r => r.brk, num: true, w: '15mm' },
        { l: 'Curva', v: r => r.curva, w: '12mm' },
        { l: 'Tipo', v: r => r.tp, w: '31mm' },
        { l: 'kA', v: r => r.kA, num: true, w: '12mm' },
        { l: 'mA', v: r => r.ma, num: true, w: '12mm' },
        { l: 'ms', v: r => r.ms, num: true, w: '12mm' },
        { l: 'Prueba', v: r => r.pr, w: '20mm' },
        { l: 'Estado', v: r => r.st, cls: r => claseEstado(r.st), w: '16mm' }
      ], filas));
    }
    return out;
  }

  function bloqueCanal(doc, res) {
    if (!doc.canal.length) return [];
    const filas = doc.canal.map((c, i) => Object.assign({}, c, { _r: res.canal[i] || {} }));
    return [nodo(`<h2>${esc(titulo('canal'))}</h2>`), tabla([
      { l: 'Tramo', v: r => r.tramo, w: '30mm' },
      { l: 'Tipo', v: r => r.tipo, w: '18mm' },
      { l: 'Material', v: r => r.mat, w: '14mm' },
      { l: 'Diám.', v: r => r.d, w: '11mm' },
      { l: 'N.º', v: r => r.ncond, num: true, w: '9mm' },
      { l: 'Calibre', v: r => r.cal, w: '24mm' },
      { l: 'Ocup.', v: r => r._r.pctTxt, num: true, w: '14mm' },
      { l: 'Lím.', v: r => r._r.limiteTxt, num: true, w: '11mm' },
      { l: 'Empalmes', v: r => r.emp, w: '19mm' },
      { l: 'Identif.', v: r => r.ide, w: '16mm' },
      { l: 'Estado', v: r => r._r.st, cls: r => claseEstado(r._r.st), w: '14mm' }
    ], filas)];
  }

  function bloqueLux(doc, res) {
    if (!doc.lux.length) return [];
    const filas = doc.lux.map((c, i) => Object.assign({}, c, { _r: res.lux[i] || {} }));
    return [nodo(`<h2>${esc(titulo('lux'))}</h2>`), tabla([
      { l: 'Área', v: r => r.area, w: '24mm' },
      { l: 'Luminaria', v: r => r.lum, w: '26mm' },
      { l: 'Cant.', v: r => r.cant, num: true, w: '10mm' },
      { l: 'P (W)', v: r => r.P, num: true, w: '11mm' },
      { l: 'Flujo (lm)', v: r => r.phi, num: true, w: '14mm' },
      { l: 'Eficacia', v: r => r._r.efTxt, num: true, w: '16mm' },
      { l: 'Densidad', v: r => r._r.dpTxt, num: true, w: '16mm' },
      { l: 'Lux mín.', v: r => r.lmin, num: true, w: '12mm' },
      { l: 'Lux med.', v: r => r.lux, num: true, w: '12mm' },
      { l: 'Cumple', v: r => r._r.okTxt, w: '15mm' },
      { l: 'Estado', v: r => r._r.st, cls: r => claseEstado(r._r.st) }
    ], filas)];
  }

  function bloqueHallazgos(doc) {
    if (!doc.hall.length) return [];
    return [nodo(`<h2>${esc(titulo('hall'))}</h2>`), tabla([
      { l: 'N.º', v: r => r.n, w: '8mm' },
      { l: 'Hallazgo', v: r => r.desc },
      { l: 'Riesgo', v: r => r.riesgo },
      { l: 'Prioridad', v: r => r.pri },
      { l: 'Acción correctiva', v: r => r.rec },
      { l: 'Estado', v: r => r.est }
    ], doc.hall)];
  }

  function bloqueDictamen(doc, res) {
    const d = doc.dict;
    const out = [nodo(`<h2>${esc(titulo('dict'))}</h2>`)];
    out.push(nodo(`<div class="callout${res.dictOk ? '' : ' bad'}">
      <strong>Concepto: ${esc(d.concepto || 'PENDIENTE')}</strong><br>
      ${res.dictOk ? 'Dictamen completo.' : 'Documento en BORRADOR: falta concepto, fecha, técnico, matrícula o firma.'}
    </div>`));
    const sugerido = res.veredicto.concepto;
    if (d.concepto && sugerido === 'No aprobado' && /^Aprobado/.test(d.concepto)) {
      out.push(nodo(`<div class="callout bad">
        <strong>El concepto registrado difiere de la validación:</strong> la sugerencia automática es
        «No aprobado» por las alertas críticas de la inspección. El técnico responsable asume la decisión
        y debe justificarla en las conclusiones.
      </div>`));
    }
    out.push(nodo(kv([
      ['Fecha de emisión', fecha(d.fecha)],
      ['Técnico responsable', d.tecnico],
      ['Matrícula profesional', d.matricula],
      ['Propietario', d.propietario],
      ['Firmante', d.firma]
    ])));
    if (d.conclusiones) {
      out.push(nodo('<h3>Conclusiones</h3>'));
      out.push(nodo(`<p>${esc(d.conclusiones)}</p>`));
    }
    if (d.firmaImg) {
      out.push(nodo('<h3>Firma</h3>'));
      out.push(nodo(`<img class="firma-img" src="${esc(d.firmaImg)}" alt="Firma del técnico responsable">`));
    }
    out.push(nodo(`<p class="muted">Este informe documenta la inspección realizada y no sustituye la certificación
      de conformidad emitida por un organismo de inspección acreditado. El dictamen es responsabilidad del
      técnico firmante.</p>`));
    return out;
  }

  function bloqueFotos(doc, fotos) {
    if (!doc.fotos.length) return [];
    const conDatos = doc.fotos.filter(f => fotos[f.id]);
    if (!conDatos.length) return [];
    const out = [nodo(`<h2>${esc(titulo('fotos'))}</h2>`)];
    for (let i = 0; i < conDatos.length; i += 2) {
      const par = conDatos.slice(i, i + 2);
      const div = document.createElement('div');
      div.className = 'fotos-grid';
      par.forEach((f, j) => {
        const fig = document.createElement('figure');
        const img = document.createElement('img');
        img.src = fotos[f.id];
        img.alt = f.caption || `Foto ${i + j + 1}`;
        const cap = document.createElement('figcaption');
        cap.textContent = `${i + j + 1}. ${f.caption || 'Sin descripción'}`;
        fig.appendChild(img);
        fig.appendChild(cap);
        div.appendChild(fig);
      });
      out.push(div);
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Paginación
  // -------------------------------------------------------------------------

  function crearPagina(doc, res, esPortada) {
    const el = document.createElement('section');
    el.className = 'page' + (res.dictOk ? '' : ' draft');
    if (esPortada) {
      el.classList.add('cover');
      return { el, body: null, pie: null };
    }
    el.innerHTML = `
      <header class="pg-head">
        <div>${esc(doc.info.proyecto || 'Sin proyecto')}</div>
        <div class="ph-r">${doc.info.informe ? 'Informe ' + esc(doc.info.informe) : 'Sin N.º de informe'} · ${esc(fecha(doc.info.fecha))}</div>
      </header>
      <div class="pg-body"></div>
      <footer class="pg-foot"><span>${esc(doc.info.empresa || 'Inspección eléctrica')}</span><span class="pg-num"></span></footer>`;
    return {
      el,
      body: el.querySelector('.pg-body'),
      pie: el.querySelector('.pg-num')
    };
  }

  function portada(doc, res) {
    const el = document.createElement('section');
    el.className = 'page cover' + (res.dictOk ? '' : ' draft');
    el.innerHTML = `
      <div class="cover-top">
        <svg class="clogo" viewBox="0 0 512 512" aria-hidden="true">
          <rect width="512" height="512" rx="96" fill="#1B1F24"/>
          <path d="M290 84 L150 290 H248 L216 428 L366 216 H270 Z" fill="#F2B705"/>
        </svg>
        <h1>Informe de inspección eléctrica</h1>
        <p>RETIE · NTC 2050 · RETILAP</p>
      </div>
      <div class="cover-body">
        <table class="cover-meta">
          <tr><th>Proyecto</th><td>${esc(doc.info.proyecto || '—')}</td></tr>
          <tr><th>Cliente</th><td>${esc(doc.info.cliente || '—')}</td></tr>
          <tr><th>Dirección</th><td>${esc(doc.info.direccion || '—')}</td></tr>
          <tr><th>Informe N.º</th><td>${esc(doc.info.informe || '—')}</td></tr>
          <tr><th>Fecha</th><td>${esc(fecha(doc.info.fecha))}</td></tr>
          <tr><th>Sistema eléctrico</th><td>${esc(doc.info.sistema || '—')}</td></tr>
          <tr><th>Normativa</th><td>${esc(doc.info.normativa || '—')}</td></tr>
          <tr><th>Técnico</th><td>${esc(doc.info.tecnico || '—')}${doc.info.matricula ? ' · Mat. ' + esc(doc.info.matricula) : ''}</td></tr>
          <tr><th>Empresa</th><td>${esc(doc.info.empresa || '—')}</td></tr>
          <tr><th>Concepto</th><td>${esc(doc.dict.concepto || 'PENDIENTE')}</td></tr>
        </table>
      </div>
      <div class="cover-foot">
        Documento generado el ${new Date().toLocaleString('es-CO')} con la aplicación de inspección eléctrica.
        ${res.dictOk ? '' : '<br><strong>BORRADOR: no válido sin firma del técnico responsable.</strong>'}
      </div>`;
    return el;
  }

  function render(doc, res, crit, fotos, host) {
    host.innerHTML = '';
    host.appendChild(portada(doc, res));

    const bloques = [].concat(
      bloqueResumen(doc, res),
      bloqueProyecto(doc, res),
      bloqueInstrumentos(doc),
      bloqueCircuitos(doc, res),
      bloqueMediciones(doc, res),
      bloqueAislamiento(doc, res),
      bloqueTierra(doc, res),
      bloqueProtecciones(doc, res),
      bloqueCanal(doc, res),
      bloqueLux(doc, res),
      bloqueHallazgos(doc, res),
      bloqueDictamen(doc, res),
      bloqueFotos(doc, fotos || {})
    );

    paginar(bloques, host, doc, res);
  }

  function paginar(bloques, host, doc, res) {
    const paginas = [];
    let actual = crearPagina(doc, res, false);
    host.appendChild(actual.el);
    paginas.push(actual);
    let body = actual.body;

    const desborda = () => body.scrollHeight > body.clientHeight + 1;

    function nuevaPagina() {
      actual = crearPagina(doc, res, false);
      host.appendChild(actual.el);
      paginas.push(actual);
      body = actual.body;
      return actual;
    }

    /**
     * Mueve al inicio de la página siguiente los títulos (h2/h3) que hayan
     * quedado al final de la página actual, para que no queden huérfanos.
     */
    function recogerTitulos() {
      const titulos = [];
      while (body.lastElementChild && /^H[23]$/.test(body.lastElementChild.tagName)) {
        titulos.unshift(body.removeChild(body.lastElementChild));
      }
      return titulos;
    }

    function agregarTabla(tablaOriginal) {
      const thead = tablaOriginal.tHead ? tablaOriginal.tHead.cloneNode(true) : null;
      const caption = tablaOriginal.querySelector('caption');
      const filas = Array.from(tablaOriginal.tBodies[0] ? tablaOriginal.tBodies[0].rows : []);

      const crear = (continuacion) => {
        const t = document.createElement('table');
        if (caption) {
          const cap = document.createElement('caption');
          cap.style.cssText = caption.style.cssText;
          cap.textContent = caption.textContent + (continuacion ? ' (continuación)' : '');
          t.appendChild(cap);
        }
        if (thead) t.appendChild(thead.cloneNode(true));
        const tb = document.createElement('tbody');
        t.appendChild(tb);
        body.appendChild(t);
        return { t, tb };
      };

      let { t, tb } = crear(false);
      let puestas = 0;
      for (const f of filas) {
        tb.appendChild(f.cloneNode(true));
        if (desborda()) {
          if (puestas === 0) {
            // La cabecera y la primera fila no caben: se lleva la tabla y sus
            // títulos a la página siguiente.
            body.removeChild(t);
            const titulos = recogerTitulos();
            nuevaPagina();
            titulos.forEach(x => body.appendChild(x));
            const nuevo = crear(false);
            t = nuevo.t;
            tb = nuevo.tb;
            tb.appendChild(f.cloneNode(true));
            puestas = 1;
          } else {
            tb.removeChild(tb.lastElementChild);
            nuevaPagina();
            const nuevo = crear(true);
            t = nuevo.t;
            tb = nuevo.tb;
            tb.appendChild(f.cloneNode(true));
            puestas = 1;
          }
        } else {
          puestas++;
        }
      }
    }

    for (const b of bloques) {
      if (!b) continue;
      if (b.tagName === 'TABLE') { agregarTabla(b); continue; }

      body.appendChild(b);
      if (desborda() && body.children.length > 1) {
        body.removeChild(b);
        const titulos = recogerTitulos();
        nuevaPagina();
        titulos.forEach(x => body.appendChild(x));
        body.appendChild(b);
      }
    }

    // La portada es la página 1; el contenido empieza en la 2. Así el total
    // coincide con el número real de hojas del PDF.
    const total = paginas.length + 1;
    paginas.forEach((p, i) => {
      if (p.pie) p.pie.textContent = `Página ${i + 2} de ${total}`;
    });
  }

  root.REPORT = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
