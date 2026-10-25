/*
 * data.js — Modelo de datos, catálogos y evaluación global de la inspección.
 *
 * Se usa igual en el navegador (window.DATA, apoyado en window.CALC) y en
 * Node para pruebas (require('./data.js')).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calc.js'));
  else root.DATA = factory(root.CALC);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  const SCHEMA = 3;
  const STORAGE_INDEX = 'retie3.index';
  const STORAGE_DOC = 'retie3.doc.';
  const STORAGE_SETTINGS = 'retie3.settings';

  const INMUEBLES = ['Vivienda unifamiliar', 'Apartamento', 'Local comercial', 'Bodega', 'Oficina', 'Otro'];
  const NORMATIVAS = ['RETIE', 'RETIE + NTC 2050', 'RETIE + NTC 2050 + RETILAP'];
  const USOS = ['Iluminación', 'Tomas generales', 'Cocina', 'Baño', 'Lavandería', 'Exterior', 'Garaje', 'Cochera', 'Climatización', 'Motor', 'Piscina', 'Otro'];
  const CURVAS = ['B', 'C', 'D', 'Otra'];
  const TIPOS_PROT = ['Termomagnético', 'Diferencial', 'GFCI', 'AFCI', 'Diferencial + termomagnético', 'Interruptor de caja moldeada'];
  const METODOS = ['Caída de potencial 3 picas (62 %)', 'Caída de potencial 2 picas (aproximado)', 'Pinza de tierra (sin picas)'];
  const ELECTRODOS = ['Varilla', 'Placa', 'Malla', 'Tubo', 'Anillo'];
  const MATERIALES = ['Cobre', 'Acero cobrizado', 'Acero galvanizado', 'Otro'];
  const CONEXIONES = ['Exotérmica', 'Mecánica con tornillería', 'Soldadura', 'Otra'];
  const AISLAMIENTOS = ['THHN', 'THW', 'THWN-2', 'XLPE', 'Otro'];
  const TIPOS_CANAL = ['Tubería conduit', 'Bandeja', 'Canaleta', 'Ducto'];
  const MAT_TUBO = ['EMT', 'PVC', 'IMC'];
  const DIAM_TUBO = ['1/2', '3/4', '1', '1 1/4'];
  const CLIMA = ['Seco', 'Húmedo', 'Lluvioso', 'No aplica'];
  const PRIORIDADES = ['Alta', 'Media', 'Baja'];
  const ESTADOS_HALLAZGO = ['Abierto', 'Cerrado'];
  const CONCEPTOS = ['Aprobado', 'Aprobado con observaciones', 'No aprobado'];

  const tituloSistema = id => (C.SISTEMAS.find(s => s.id === id) || C.SISTEMAS[1]).label;

  /** Campos de formulario (no tablas). */
  const CAMPOS = {
    info: [
      { k: 'informe', l: 'N.º de informe', t: 't', req: 1, ancho: 1 },
      { k: 'proyecto', l: 'Nombre del proyecto', t: 't', req: 1, ancho: 2 },
      { k: 'cliente', l: 'Cliente / propietario', t: 't', ancho: 2 },
      { k: 'direccion', l: 'Dirección', t: 't', ancho: 2 },
      { k: 'telefono', l: 'Teléfono', t: 't' },
      { k: 'correo', l: 'Correo', t: 't' },
      { k: 'inmueble', l: 'Tipo de inmueble', t: 's', opts: INMUEBLES },
      { k: 'area', l: 'Área construida (m²)', t: 'n' },
      { k: 'pisos', l: 'Número de pisos', t: 'n' },
      { k: 'uso', l: 'Uso de la edificación', t: 't' },
      { k: 'fecha', l: 'Fecha de inspección', t: 'd', req: 1 },
      { k: 'sistema', l: 'Sistema eléctrico', t: 's', opts: C.SISTEMAS.map(s => s.label), req: 1 },
      { k: 'normativa', l: 'Normativa aplicable', t: 's', opts: NORMATIVAS, req: 1 },
      { k: 'tecnico', l: 'Técnico responsable', t: 't', req: 1 },
      { k: 'matricula', l: 'Matrícula profesional', t: 't' },
      { k: 'empresa', l: 'Empresa', t: 't' },
      { k: 'croquis', l: 'Referencia del croquis o plano', t: 't' },
      { k: 'alcance', l: 'Objeto y alcance de la inspección', t: 'ta', ancho: 3 }
    ],
    tierra: [
      { k: 'tipo', l: 'Tipo de electrodo', t: 's', opts: ELECTRODOS },
      { k: 'n', l: 'Número de electrodos', t: 'n' },
      { k: 'prof', l: 'Profundidad (m)', t: 'n' },
      { k: 'mat', l: 'Material', t: 's', opts: MATERIALES },
      { k: 'met', l: 'Método de prueba', t: 's', opts: METODOS },
      { k: 'dEC', l: 'Distancia E–C (m)', t: 'n' },
      { k: 'Rp', l: 'Lectura de pinza (Ω)', t: 'n' },
      { k: 'rmax', l: 'Máximo permitido (Ω)', t: 'n' },
      { k: 'cont', l: 'Continuidad (Ω)', t: 'n' },
      { k: 'cal', l: 'Conductor de tierra', t: 's', opts: C.CALIBRES },
      { k: 'con', l: 'Conexiones', t: 's', opts: CONEXIONES },
      { k: 'obs', l: 'Observaciones', t: 'ta', ancho: 3 }
    ],
    env: [
      { k: 'tempAmb', l: 'Temperatura ambiente (°C)', t: 'n' },
      { k: 'humedad', l: 'Humedad relativa (%)', t: 'n' },
      { k: 'clima', l: 'Condición climática', t: 's', opts: CLIMA },
      { k: 'hora', l: 'Hora de la inspección', t: 't' },
      { k: 'notas', l: 'Notas del entorno', t: 'ta', ancho: 3 }
    ],
    dict: [
      { k: 'concepto', l: 'Concepto', t: 's', opts: CONCEPTOS, req: 1 },
      { k: 'fecha', l: 'Fecha de emisión', t: 'd', req: 1 },
      { k: 'tecnico', l: 'Técnico responsable', t: 't', req: 1 },
      { k: 'matricula', l: 'Matrícula profesional', t: 't', req: 1 },
      { k: 'propietario', l: 'Propietario o responsable', t: 't' },
      { k: 'firma', l: 'Nombre del firmante', t: 't' },
      { k: 'conclusiones', l: 'Conclusiones y recomendaciones generales', t: 'ta', ancho: 3 }
    ]
  };

  /** Columnas de tabla: [clave, etiqueta, tipo, opciones, fase mínima]. */
  const TABLAS = {
    inst: [
      { k: 'instrumento', l: 'Instrumento', t: 't', req: 1 },
      { k: 'marca', l: 'Marca', t: 't' },
      { k: 'modelo', l: 'Modelo', t: 't' },
      { k: 'serial', l: 'Serial', t: 't' },
      { k: 'calibracion', l: 'Calibración', t: 'd' },
      { k: 'vence', l: 'Vence', t: 'd' },
      { k: 'obs', l: 'Observaciones', t: 't' }
    ],
    circ: [
      { k: 'id', l: 'Circuito', t: 'c' },
      { k: 'st', l: 'Estado', t: 'c' },
      { k: 'tipo', l: 'Tipo', t: 's', opts: C.TIPOS_CIRCUITO, req: 1 },
      { k: 'desc', l: 'Descripción', t: 't', req: 1 },
      { k: 'uso', l: 'Uso / ubicación', t: 's', opts: USOS },
      { k: 'brk', l: 'Breaker (A)', t: 'n', req: 1 },
      { k: 'curva', l: 'Curva', t: 's', opts: CURVAS },
      { k: 'cal', l: 'Conductor de fase', t: 's', opts: C.CALIBRES, req: 1 },
      { k: 'L', l: 'Longitud (m)', t: 'n', req: 1 },
      { k: 'W', l: 'Carga (W)', t: 'n', req: 1 },
      { k: 'fd', l: 'Factor demanda', t: 'n' },
      { k: 'fp', l: 'FP', t: 'n' },
      { k: 'continua', l: 'Carga continua', t: 's', opts: ['Sí', 'No'] },
      { k: 'VA', l: 'Demanda (VA)', t: 'c' },
      { k: 'I', l: 'Corriente (A)', t: 'c' },
      { k: 'dv', l: 'ΔV (%)', t: 'c' },
      { k: 'amp', l: 'Ampacidad (A)', t: 'c' }
    ],
    meas: [
      { k: 'id', l: 'Circuito', t: 'c' },
      { k: 'st', l: 'Estado', t: 'c' },
      { k: 'va', l: 'V A–N', t: 'n', fase: 1 },
      { k: 'vb', l: 'V B–N', t: 'n', fase: 2 },
      { k: 'vc', l: 'V C–N', t: 'n', fase: 3 },
      { k: 'vn', l: 'V N–T', t: 'n' },
      { k: 'ia', l: 'I A', t: 'n', fase: 1 },
      { k: 'ib', l: 'I B', t: 'n', fase: 2 },
      { k: 'ic', l: 'I C', t: 'n', fase: 3 },
      { k: 'ine', l: 'I neutro', t: 'n' },
      { k: 'fp', l: 'FP', t: 'n' },
      { k: 'hz', l: 'Hz', t: 'n' },
      { k: 'tmp', l: 'Temp. (°C)', t: 'n' },
      { k: 'dvm', l: 'ΔV medida (%)', t: 'n' },
      { k: 'P', l: 'P (W)', t: 'c' },
      { k: 'S', l: 'S (VA)', t: 'c' },
      { k: 'Q', l: 'Q (var)', t: 'c' },
      { k: 'Im', l: 'I prom. (A)', t: 'c' },
      { k: 'dvs', l: 'Estado ΔV', t: 'c' },
      { k: 'obs', l: 'Observaciones', t: 't' }
    ],
    meg: [
      { k: 'id', l: 'Circuito', t: 'c' },
      { k: 'st', l: 'Estado', t: 'c' },
      { k: 'pt', l: 'Punto de medición', t: 'c' },
      { k: 's30', l: '30 s (MΩ)', t: 'n' },
      { k: 'm1', l: '1 min (MΩ)', t: 'n' },
      { k: 'min', l: 'Mínimo (MΩ)', t: 'c' }
    ],
    prot: [
      { k: 'id', l: 'Circuito', t: 'c' },
      { k: 'st', l: 'Estado', t: 'c' },
      { k: 'brk', l: 'Breaker', t: 'c' },
      { k: 'curva', l: 'Curva', t: 'c' },
      { k: 'tp', l: 'Tipo de protección', t: 's', opts: TIPOS_PROT, req: 1 },
      { k: 'kA', l: 'Poder de corte (kA)', t: 'n' },
      { k: 'ma', l: 'Sensibilidad (mA)', t: 'n' },
      { k: 'ms', l: 'Tiempo (ms)', t: 'n' },
      { k: 'pr', l: 'Prueba de disparo', t: 's', opts: ['Correcto', 'Falla', 'No aplica'] },
      { k: 'obs', l: 'Observaciones', t: 't' }
    ],
    canal: [
      { k: 'tramo', l: 'Tramo', t: 't', req: 1 },
      { k: 'tipo', l: 'Tipo', t: 's', opts: TIPOS_CANAL },
      { k: 'mat', l: 'Material', t: 's', opts: MAT_TUBO },
      { k: 'd', l: 'Diámetro', t: 's', opts: DIAM_TUBO },
      { k: 'ncond', l: 'N.º conductores', t: 'n' },
      { k: 'cal', l: 'Calibre', t: 's', opts: C.CALIBRES },
      { k: 'ais', l: 'Aislamiento', t: 's', opts: AISLAMIENTOS },
      { k: 'ocu', l: 'Ocupación', t: 'c' },
      { k: 'emp', l: 'Empalmes', t: 's', opts: ['Conforme', 'No conforme'] },
      { k: 'ide', l: 'Identificación', t: 's', opts: ['Conforme', 'No conforme'] },
      { k: 'st', l: 'Estado', t: 'c' },
      { k: 'obs', l: 'Observaciones', t: 't' }
    ],
    lux: [
      { k: 'area', l: 'Área / ambiente', t: 't', req: 1 },
      { k: 'lum', l: 'Luminaria', t: 't' },
      { k: 'cant', l: 'Cantidad', t: 'n' },
      { k: 'P', l: 'Potencia (W)', t: 'n' },
      { k: 'phi', l: 'Flujo (lm)', t: 'n' },
      { k: 'sup', l: 'Superficie (m²)', t: 'n' },
      { k: 'ef', l: 'Eficacia', t: 'c' },
      { k: 'dp', l: 'Densidad', t: 'c' },
      { k: 'lmin', l: 'Lux mín. RETILAP', t: 'n' },
      { k: 'lux', l: 'Lux medido', t: 'n' },
      { k: 'ok', l: 'Cumple', t: 'c' },
      { k: 'st', l: 'Estado', t: 'c' },
      { k: 'obs', l: 'Observaciones', t: 't' }
    ],
    hall: [
      { k: 'n', l: 'N.º', t: 't' },
      { k: 'desc', l: 'No conformidad / hallazgo', t: 't', req: 1 },
      { k: 'riesgo', l: 'Riesgo', t: 't' },
      { k: 'pri', l: 'Prioridad', t: 's', opts: PRIORIDADES, req: 1 },
      { k: 'rec', l: 'Acción correctiva', t: 't' },
      { k: 'est', l: 'Estado', t: 's', opts: ESTADOS_HALLAZGO },
      { k: 'evi', l: 'Evidencia', t: 't' }
    ]
  };

  const SECCIONES = [
    { id: 'info', titulo: '1. Proyecto', nota: 'Obligatorios: N.º de informe, proyecto, fecha, sistema, normativa y técnico responsable. El sistema eléctrico define las tensiones de referencia de todas las verificaciones.' },
    { id: 'inst', titulo: '2. Instrumentos y ambiente', nota: 'Registre los instrumentos con su calibración y las condiciones ambientales. Una inspección sin trazabilidad de instrumentos no es defendible.' },
    { id: 'circ', titulo: '3. Circuitos', nota: 'El ID se asigna por espacios del tablero: monofásico 1 (C1), bifásico 2 (C2-3), trifásico 3 (C4-6). Demanda = W × FD ÷ FP. ΔV = k·ρ·L·I ÷ (S·V), con k = 2 en monofásico/bifásico y √3 en trifásico; límite 3 %.' },
    { id: 'meas', titulo: '4. Mediciones', nota: 'Los circuitos pasan automáticamente. Registre tensiones fase-neutro, corriente por fase, neutro, FP, frecuencia, temperatura y ΔV medida. Se validan ±5 % de tensión, ±1 % de frecuencia, 80 % del breaker (carga continua), 5 V N–T y desbalance.' },
    { id: 'meg', titulo: '5. Aislamiento', nota: 'Puntos automáticos por circuito (fase-tierra, fase-neutro y neutro-tierra). Desconecte cargas y electrónica antes de meggear. Mínimo configurable (por defecto 1 MΩ). En sistemas delta sin neutro solo se prueba fase-tierra.' },
    { id: 'tierra', titulo: '6. Puesta a tierra', nota: 'Método del 62 %: tome al menos 3 lecturas (ideal 5) moviendo la pica de potencial; debe haber lecturas antes y después del 62 % y la meseta debe ser plana (±10 %). La continuidad del conductor de tierra se mide con método de 4 hilos o poniendo a cero las puntas.' },
    { id: 'prot', titulo: '7. Protecciones', nota: 'Breaker principal con Icc del punto para comparar el poder de corte. Por circuito: tipo, kA, sensibilidad ≤ 30 mA y tiempo ≤ 300 ms. Cocina, baño, lavandería, exterior, garaje, cochera y piscina exigen diferencial de 30 mA (NTC 2050 210-8).' },
    { id: 'canal', titulo: '8. Canalizaciones', nota: 'La ocupación se calcula con el número de conductores, el calibre y el diámetro del tubo (53 % para 1, 31 % para 2 y 40 % para 3 o más). Empalmes solo en cajas y conductores identificados.' },
    { id: 'lux', titulo: '9. Iluminación', nota: 'Eficacia = flujo ÷ potencia. Densidad = potencia total ÷ superficie. Cumple si el lux medido es igual o mayor al mínimo RETILAP del ambiente; consulte la tabla vigente para cada uso.' },
    { id: 'hall', titulo: '10. Hallazgos', nota: 'Cada alerta crítica debe quedar como hallazgo. Una prioridad alta abierta impide aprobar la instalación.' },
    { id: 'dict', titulo: '11. Dictamen', nota: 'El dictamen lo decide el técnico responsable. La sugerencia automática se calcula por severidad y no reemplaza el criterio profesional. Sin concepto, fecha, técnico, matrícula y firma el informe se marca como BORRADOR.' },
    { id: 'fotos', titulo: '12. Anexo fotográfico', nota: 'Las fotos se guardan en el dispositivo (IndexedDB) y se incluyen en el anexo del informe. Se reducen automáticamente para no llenar el almacenamiento.' }
  ];

  // ---------------------------------------------------------------------------
  // Estado inicial y utilidades
  // ---------------------------------------------------------------------------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function hoyISO() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function docNuevo() {
    return {
      schema: SCHEMA,
      id: uid(),
      meta: { creado: new Date().toISOString(), actualizado: new Date().toISOString() },
      info: { fecha: hoyISO(), sistema: C.SISTEMAS[1].label, normativa: 'RETIE + NTC 2050', inmueble: 'Vivienda unifamiliar' },
      inst: [],
      env: {},
      circ: [],
      meas: [],
      meg: { vp: '500', rows: [] },
      tierra: { met: '', rmax: 25, pts: [] },
      prot: { main: {}, rows: [] },
      canal: [],
      lux: [],
      hall: [],
      dict: { fecha: hoyISO() },
      fotos: []
    };
  }

  function clonar(o) {
    return JSON.parse(JSON.stringify(o));
  }

  /** Rellena claves faltantes sin sobrescribir datos existentes. */
  function normalizar(doc) {
    const base = docNuevo();
    const d = Object.assign({}, base, doc || {});
    d.schema = SCHEMA;
    d.id = d.id || uid();
    d.meta = Object.assign({}, base.meta, d.meta || {});
    d.info = Object.assign({}, base.info, d.info || {});
    d.env = Object.assign({}, d.env || {});
    d.dict = Object.assign({}, base.dict, d.dict || {});
    d.tierra = Object.assign({}, base.tierra, d.tierra || {});
    d.tierra.pts = Array.isArray(d.tierra.pts) ? d.tierra.pts : [];
    d.prot = Object.assign({}, base.prot, d.prot || {});
    d.prot.main = Object.assign({}, d.prot.main || {});
    d.meg = Object.assign({}, base.meg, d.meg || {});
    d.meg.rows = Array.isArray(d.meg.rows) ? d.meg.rows : [];
    ['inst', 'circ', 'meas', 'canal', 'lux', 'hall', 'fotos'].forEach(k => {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    if (!Array.isArray(d.prot.rows)) d.prot.rows = [];
    d.circ.forEach(c => { if (!c.uid) c.uid = uid(); });
    return d;
  }

  /**
   * Migra un respaldo del modelo anterior (v2, app de 2026-10) al modelo actual.
   * Conserva la mayor cantidad posible de datos.
   */
  function migrarV2(o) {
    const d = docNuevo();
    const info = o.info || {};
    d.info = Object.assign(d.info, {
      proyecto: info.proyecto || '',
      cliente: info.cliente || '',
      direccion: info.direccion || '',
      telefono: info.telefono || '',
      correo: info.correo || '',
      inmueble: info.inmueble || 'Vivienda unifamiliar',
      area: info.area || '',
      pisos: info.pisos || '',
      uso: info.uso || '',
      fecha: info.fecha || hoyISO(),
      normativa: info.norma || 'RETIE + NTC 2050',
      tecnico: info.tecnico || '',
      matricula: info.matricula || '',
      empresa: info.empresa || '',
      croquis: info.croquis || ''
    });
    const sys = C.SISTEMAS.find(s => s.label === info.sis);
    if (sys) d.info.sistema = sys.label;

    const uidMap = {};
    (o.circ || []).forEach(c => {
      const nu = uid();
      uidMap[c.uid] = nu;
      d.circ.push({
        uid: nu,
        tipo: c.tipo || 'Monofásico',
        desc: c.desc || '',
        brk: c.brk || '',
        curva: c.curva || '',
        cal: c.cal || '',
        L: c.L || '',
        W: c.W || '',
        fd: c.fd || 1,
        fp: 0.9,
        uso: 'Otro',
        continua: 'No'
      });
    });
    (o.meas || []).forEach(m => {
      d.meas.push({
        uid: uidMap[m.uid] || uid(),
        va: m.va, vb: m.vb, vc: m.vc, vn: m.vn,
        ia: m.ia, ib: m.ib, ic: m.ic, ine: m.ine,
        fp: m.fp, hz: m.hz, tmp: m.tmp, dvm: m.dvm, obs: m.obs
      });
    });
    (o.prot || []).forEach(p => {
      d.prot.rows.push({
        uid: uidMap[p.uid] || uid(),
        tp: p.tp, kA: p.kA, ma: p.ma, ms: p.ms, pr: p.pr, obs: p.obs
      });
    });
    d.meg.vp = (o.megset && o.megset.vp) || '500';
    (o.meg || []).forEach(m => {
      d.meg.rows.push({ uid: uidMap[m.uid] || uid(), pt: m.pt, s30: m.s30, m1: m.m1 });
    });
    d.tierra = Object.assign({}, d.tierra, o.tierra || {});
    d.tierra.pts = (o.tierra && o.tierra.pts) || [];
    d.prot.main = Object.assign({}, o.main || {});
    ['canal', 'lux', 'hall'].forEach(k => {
      if (Array.isArray(o[k])) d[k] = clonar(o[k]);
    });
    d.dict = Object.assign(d.dict, o.dict || {});
    return normalizar(d);
  }

  function esV2(o) {
    return !!o && !o.schema && (Array.isArray(o.circ) || o.info || o.megset);
  }

  /** Acepta un respaldo v2 o v3 y devuelve un documento normalizado. */
  function importar(o) {
    if (!o || typeof o !== 'object') throw new Error('El archivo no contiene un objeto JSON válido.');
    if (o.schema && o.schema > SCHEMA) throw new Error('El respaldo es de una versión más nueva de la aplicación.');
    if (esV2(o)) return migrarV2(o);
    return normalizar(o);
  }

  // ---------------------------------------------------------------------------
  // Sincronización de filas dependientes de los circuitos
  // ---------------------------------------------------------------------------

  function sync(doc) {
    const uids = doc.circ.map(c => c.uid);
    const sis = C.sistemaDe(doc.info.sistema);

    doc.meas = uids.map(u => doc.meas.find(r => r.uid === u) || { uid: u });
    doc.prot.rows = uids.map(u => doc.prot.rows.find(r => r.uid === u) || { uid: u });

    const filas = [];
    doc.circ.forEach(c => {
      const pts = C.puntosAislamiento(c.tipo, sis);
      pts.forEach(p => {
        filas.push(doc.meg.rows.find(r => r.uid === c.uid && r.pt === p.pt) || { uid: c.uid, pt: p.pt });
      });
    });
    doc.meg.rows = filas;
    return doc;
  }

  // ---------------------------------------------------------------------------
  // Evaluación
  // ---------------------------------------------------------------------------

  function etiqueta(sec, k) {
    const cols = TABLAS[sec] || CAMPOS[sec] || [];
    const c = cols.find(x => x.k === k);
    return c ? c.l : k;
  }

  function evaluar(docRaw, critRaw) {
    const doc = normalizar(docRaw);
    const crit = C.criterios(critRaw);
    const sis = C.sistemaDe(doc.info.sistema);
    const ids = C.idsCircuitos(doc.circ);
    const issues = [];

    const add = (sec, idx, k, sev, msg) => issues.push({ sec, idx, k, sev, msg, campo: etiqueta(sec, k) });

    const circ = doc.circ.map((c, i) => {
      const r = C.calcularCircuito(c, sis, crit);
      r.id = ids[i];
      r.uid = c.uid;
      r.tipo = c.tipo;
      r.uso = c.uso;
      r.desc = c.desc;
      r.continua = c.continua;
      r.issues.forEach(x => add('circ', i, x.k, x.sev, x.msg));
      return r;
    });

    const meas = doc.meas.map((m, i) => {
      const c = doc.circ.find(x => x.uid === m.uid);
      const r = C.evaluarMedicion(m, c, sis, crit);
      r.id = ids[doc.circ.indexOf(c)] || '—';
      r.uid = m.uid;
      r.issues.forEach(x => add('meas', i, x.k, x.sev, x.msg));
      return r;
    });

    const meg = doc.meg.rows.map((m, i) => {
      const c = doc.circ.find(x => x.uid === m.uid);
      const r = C.evaluarAislamiento(m, crit);
      r.id = c ? ids[doc.circ.indexOf(c)] : '—';
      r.ptLabel = (C.puntosAislamiento(c ? c.tipo : 'Monofásico', sis).find(p => p.pt === m.pt) || {}).label || m.pt;
      r.uid = m.uid;
      r.issues.forEach(x => add('meg', i, x.k, x.sev, x.msg));
      return r;
    });

    const tierra = C.evaluarTierra(doc.tierra, crit);
    tierra.issues.forEach(x => add('tierra', 0, x.k, x.sev, x.msg));

    // Conductor de tierra del sistema (tabla 250-122) según el breaker principal.
    const reqTierra = C.tierraRequerida(doc.prot.main.A);
    const condTierra = C.conductorDeEtiqueta(doc.tierra.cal);
    const tierraReq = { awg: reqTierra, ok: null };
    if (reqTierra && condTierra) {
      tierraReq.ok = C.calibreMayorOIgual(condTierra.awg, reqTierra);
      if (!tierraReq.ok) {
        const msg = `Conductor de tierra ${condTierra.awg} AWG menor al requerido ${reqTierra} AWG (NTC 2050 250-122)`;
        add('tierra', 0, 'cal', 'critica', msg);
      }
    }

    const resumenParcial = {
      demandaTotal: circ.reduce((a, r) => a + (isFinite(r.va) ? r.va : 0), 0),
      sis
    };

    const main = C.evaluarPrincipal(doc.prot.main, crit, resumenParcial);
    main.issues.forEach(x => add('prot', -1, x.k, x.sev, x.msg));

    const prot = doc.prot.rows.map((p, i) => {
      const c = doc.circ.find(x => x.uid === p.uid);
      const r = C.evaluarProteccion(p, c, doc.prot.main, crit);
      r.id = c ? ids[doc.circ.indexOf(c)] : '—';
      r.brk = c ? c.brk : '—';
      r.curva = c ? c.curva : '—';
      r.uid = p.uid;
      r.issues.forEach(x => add('prot', i, x.k, x.sev, x.msg));
      return r;
    });

    const canal = doc.canal.map((f, i) => {
      const r = C.evaluarCanal(f, crit);
      r.issues.forEach(x => add('canal', i, x.k, x.sev, x.msg));
      return r;
    });

    const lux = doc.lux.map((f, i) => {
      const r = C.evaluarLux(f);
      r.issues.forEach(x => add('lux', i, x.k, x.sev, x.msg));
      return r;
    });

    const hall = doc.hall.map((h, i) => {
      const r = C.evaluarHallazgo(h);
      r.issues.forEach(x => add('hall', i, x.k, x.sev, x.msg));
      return r;
    });

    const faltantesInfo = (CAMPOS.info || []).filter(f => f.req && !String(doc.info[f.k] || '').trim());
    if (!doc.circ.length) {
      issues.push({ sec: 'circ', idx: 0, k: 'circ', sev: 'media', msg: 'No hay circuitos registrados', campo: 'Circuitos' });
    }
    if (!doc.meas.some(m => m.va || m.ia || m.fp || m.hz)) {
      issues.push({ sec: 'meas', idx: 0, k: 'meas', sev: 'media', msg: 'No hay mediciones registradas', campo: 'Mediciones' });
    }

    const faltantesDict = (CAMPOS.dict || []).filter(f => f.req && !String(doc.dict[f.k] || '').trim());
    const dictOk = faltantesDict.length === 0 && (!!doc.dict.firmaImg || !!String(doc.dict.firma || '').trim());

    const completo = faltantesInfo.length === 0 && doc.circ.length > 0;
    const v = C.veredicto(issues, completo);

    const demandaTotal = resumenParcial.demandaTotal;
    return {
      doc, crit, sis, ids, circ, meas, meg, tierra, tierraReq, main, prot, canal, lux, hall,
      issues, veredicto: v, completo, dictOk,
      faltantesInfo, faltantesDict,
      demandaTotal,
      porSeccion: SECCIONES.reduce((acc, s) => {
        acc[s.id] = issues.filter(i => i.sec === s.id).length;
        return acc;
      }, {})
    };
  }

  return {
    SCHEMA, STORAGE_INDEX, STORAGE_DOC, STORAGE_SETTINGS,
    INMUEBLES, NORMATIVAS, USOS, CURVAS, TIPOS_PROT, METODOS, ELECTRODOS,
    MATERIALES, CONEXIONES, AISLAMIENTOS, TIPOS_CANAL, MAT_TUBO, DIAM_TUBO,
    CLIMA, PRIORIDADES, ESTADOS_HALLAZGO, CONCEPTOS,
    CAMPOS, TABLAS, SECCIONES,
    uid, hoyISO, docNuevo, normalizar, migrarV2, esV2, importar, sync, evaluar,
    tituloSistema
  };
});
