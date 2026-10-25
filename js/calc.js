/*
 * calc.js — Núcleo de cálculo de la inspección eléctrica.
 *
 * Funciones puras, sin DOM. Se carga como script clásico en el navegador
 * (expone window.CALC) y como módulo CommonJS en Node (require('./calc.js'))
 * para poder probarlas con `node --test`.
 *
 * Referencias: RETIE (Res. 90708 de 2013 y sus modificaciones), NTC 2050
 * (Código Eléctrico Colombiano) y RETILAP (Res. 180540 de 2010).
 * Los valores de las tablas son de referencia: el técnico responsable debe
 * verificarlos contra la edición vigente antes de emitir un dictamen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CALC = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Resistividad del cobre a 20 °C, Ω·mm²/m. */
  const RHO = 0.0172;

  /**
   * Sistemas eléctricos. `fases` es el número de fases del sistema (no del
   * circuito); `vln` es la tensión fase-neutro y `vll` la tensión entre fases.
   * En los sistemas delta no hay neutro utilizable: vln = null.
   */
  const SISTEMAS = [
    { id: '110-1f', label: '110 V monofásico (1F+N)', fases: 1, vln: 110, vll: null, neutro: true },
    { id: '120-1f', label: '120 V monofásico (1F+N)', fases: 1, vln: 120, vll: null, neutro: true },
    { id: '127-1f', label: '127 V monofásico (1F+N)', fases: 1, vln: 127, vll: null, neutro: true },
    { id: '120-240-1f3h', label: '120/240 V monofásico 3 hilos', fases: 2, vln: 120, vll: 240, neutro: true },
    { id: '208y-120', label: '208Y/120 V trifásico 4 hilos', fases: 3, vln: 120, vll: 208, neutro: true },
    { id: '220y-127', label: '220Y/127 V trifásico 4 hilos', fases: 3, vln: 127, vll: 220, neutro: true },
    { id: '240d', label: '240 V trifásico delta 3 hilos', fases: 3, vln: null, vll: 240, neutro: false },
    { id: '380y-220', label: '380Y/220 V trifásico 4 hilos', fases: 3, vln: 220, vll: 380, neutro: true },
    { id: '440y-254', label: '440Y/254 V trifásico 4 hilos', fases: 3, vln: 254, vll: 440, neutro: true },
    { id: '480y-277', label: '480Y/277 V trifásico 4 hilos', fases: 3, vln: 277, vll: 480, neutro: true }
  ];

  /**
   * Conductores de cobre. Ampacidades en A según NTC 2050 tabla 310-16
   * (THHN/THW/THWN-2) y área aproximada del conductor con aislamiento en in²
   * (capítulo 9, tabla 5), usada para el cálculo de llenado de tubería.
   */
  const CONDUCTORES = [
    { awg: '14', mm2: 2.08, amp60: 15, amp75: 20, amp90: 25, areaIn2: 0.0097 },
    { awg: '12', mm2: 3.31, amp60: 20, amp75: 25, amp90: 30, areaIn2: 0.0133 },
    { awg: '10', mm2: 5.26, amp60: 30, amp75: 35, amp90: 40, areaIn2: 0.0211 },
    { awg: '8', mm2: 8.37, amp60: 40, amp75: 50, amp90: 55, areaIn2: 0.0366 },
    { awg: '6', mm2: 13.3, amp60: 55, amp75: 65, amp90: 75, areaIn2: 0.0507 },
    { awg: '4', mm2: 21.15, amp60: 70, amp75: 85, amp90: 95, areaIn2: 0.0824 },
    { awg: '2', mm2: 33.62, amp60: 95, amp75: 115, amp90: 130, areaIn2: 0.1158 },
    { awg: '1/0', mm2: 53.5, amp60: 125, amp75: 150, amp90: 170, areaIn2: 0.1855 }
  ];

  const CALIBRES = CONDUCTORES.map(c => `${c.mm2.toFixed(2)} mm² (${c.awg} AWG)`);

  /** Orden de calibres, de menor a mayor. */
  const ORDEN_AWG = ['14', '12', '10', '8', '6', '4', '3', '2', '1/0', '2/0', '3/0', '4/0'];

  /** NTC 2050 tabla 250-122: conductor de tierra por capacidad del breaker. */
  const TIERRA_250_122 = [
    { max: 15, awg: '14' }, { max: 20, awg: '12' }, { max: 30, awg: '10' },
    { max: 60, awg: '10' }, { max: 100, awg: '8' }, { max: 200, awg: '6' },
    { max: 300, awg: '4' }, { max: 400, awg: '3' }, { max: 500, awg: '2' },
    { max: 600, awg: '1/0' }, { max: 800, awg: '2/0' }, { max: 1000, awg: '3/0' },
    { max: 1200, awg: '4/0' }
  ];

  /** Área interior total de la tubería en in² (capítulo 9, tabla 4). */
  const TUBOS = {
    'EMT': { '1/2': 0.304, '3/4': 0.533, '1': 0.864, '1 1/4': 1.496 },
    'PVC': { '1/2': 0.285, '3/4': 0.508, '1': 0.832, '1 1/4': 1.440 },
    'IMC': { '1/2': 0.314, '3/4': 0.549, '1': 0.887, '1 1/4': 1.526 }
  };

  const TIPOS_CIRCUITO = ['Monofásico', 'Bifásico', 'Trifásico'];

  /** Número de fases/espacios que ocupa un circuito. */
  function fasesDe(tipo) {
    return tipo === 'Trifásico' ? 3 : tipo === 'Bifásico' ? 2 : 1;
  }

  function sistemaDe(idOLabel) {
    return SISTEMAS.find(s => s.id === idOLabel || s.label === idOLabel) || SISTEMAS[1];
  }

  /** Tensión de referencia del circuito según el sistema y el número de polos. */
  function tensionDeCircuito(sis, tipo) {
    if (!sis) return NaN;
    if (tipo === 'Monofásico') return sis.vln != null ? sis.vln : sis.vll / Math.sqrt(3);
    return sis.vll != null ? sis.vll : sis.vln;
  }

  // ---------------------------------------------------------------------------
  // Utilidades numéricas
  // ---------------------------------------------------------------------------

  function num(v) {
    if (v === '' || v == null) return NaN;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/\s/g, '');
    if (!s) return NaN;
    const hasDot = s.indexOf('.') >= 0;
    const hasComma = s.indexOf(',') >= 0;
    if (hasDot && hasComma) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
      else s = s.replace(/,/g, '');
    } else if (hasComma) {
      s = s.replace(/,/g, '.');
    }
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function fmt(x, d) {
    if (d === undefined) d = 2;
    return isFinite(x) ? Number(x).toFixed(d) : '—';
  }

  function pct(x, d) {
    return isFinite(x) ? `${Number(x).toFixed(d === undefined ? 1 : d)} %` : '—';
  }

  // ---------------------------------------------------------------------------
  // Circuitos
  // ---------------------------------------------------------------------------

  /** ID de cada circuito por posición en el tablero: C1, C2-3, C4-6... */
  function idsCircuitos(circ) {
    let p = 1;
    return (circ || []).map(c => {
      const n = fasesDe(c.tipo);
      const id = n === 1 ? `C${p}` : `C${p}-${p + n - 1}`;
      p += n;
      return id;
    });
  }

  function conductorDeEtiqueta(label) {
    if (!label) return null;
    const m = String(label).match(/\(([\d/]+)\s*AWG\)/);
    if (!m) return null;
    return CONDUCTORES.find(c => c.awg === m[1]) || null;
  }

  /**
   * Cálculo eléctrico de un circuito.
   * @param {object} c circuito ({tipo, cal, L, W, fd, fp, brk, continua})
   * @param {object} sis sistema eléctrico
   * @param {object} crit criterios
   */
  function calcularCircuito(c, sis, crit) {
    const cond = conductorDeEtiqueta(c.cal);
    const tipo = TIPOS_CIRCUITO.indexOf(c.tipo) >= 0 ? c.tipo : 'Monofásico';
    const vref = tensionDeCircuito(sis, tipo);
    const fp = num(c.fp) > 0 ? num(c.fp) : (crit.fpDemanda || 0.9);
    let fd = num(c.fd);
    if (!isFinite(fd)) fd = 1;
    fd = Math.min(1, Math.max(0.1, fd));
    const w = num(c.W);
    const va = isFinite(w) ? (w * fd) / fp : NaN;
    const l = num(c.L);

    let i = NaN;
    let dv = NaN;
    if (isFinite(va) && isFinite(vref)) {
      if (tipo === 'Trifásico') i = va / (Math.sqrt(3) * vref);
      else i = va / vref;
    }
    if (isFinite(i) && isFinite(l) && cond && vref) {
      const k = tipo === 'Trifásico' ? Math.sqrt(3) : 2;
      dv = (k * RHO * l * i) / (cond.mm2 * vref) * 100;
    }

    const temp = crit.tempAmp || 75;
    const ampBase = cond ? (temp === 60 ? cond.amp60 : temp === 90 ? cond.amp90 : cond.amp75) : NaN;
    const amp = isFinite(ampBase) ? ampBase * (num(crit.factorDerrateo) || 1) : NaN;
    const brk = num(c.brk);

    const issues = [];
    if (isFinite(dv) && dv > crit.dvMax) {
      const sev = dv > crit.dvCritico ? 'critica' : 'alta';
      issues.push({ k: 'dv', sev, msg: `ΔV ${fmt(dv, 2)} % supera el máximo de ${crit.dvMax} %` });
    }
    if (isFinite(i) && isFinite(brk)) {
      if (i > brk) {
        issues.push({ k: 'i', sev: 'critica', msg: `Corriente ${fmt(i, 1)} A supera el breaker de ${brk} A` });
      } else if (c.continua === 'Sí' && i > brk * crit.icont) {
        issues.push({ k: 'i', sev: 'alta', msg: `Carga continua ${fmt(i, 2)} A > ${Math.round(crit.icont * 100)} % del breaker (${fmt(brk * crit.icont, 2)} A)` });
      }
    }
    if (isFinite(brk) && isFinite(amp) && brk > amp + 0.01) {
      issues.push({ k: 'brk', sev: 'critica', msg: `Breaker ${brk} A mayor que la ampacidad del conductor (${fmt(amp, 0)} A)` });
    }

    const completo = isFinite(w) && isFinite(l) && isFinite(brk) && !!cond && !!c.tipo;

    return {
      id: '', tipo, vref, va, i, dv, amp, brk, cond,
      completo, issues,
      st: !completo ? 'INCOMPLETO' : issues.length ? 'NO CUMPLE' : 'OK',
      dvTxt: isFinite(dv) ? `${fmt(dv, 2)} %` : '—',
      iTxt: isFinite(i) ? `${fmt(i, 1)} A` : '—',
      ampTxt: isFinite(amp) ? `${fmt(amp, 0)} A` : '—',
      vaTxt: isFinite(va) ? `${fmt(va, 0)} VA` : '—'
    };
  }

  // ---------------------------------------------------------------------------
  // Medidas
  // ---------------------------------------------------------------------------

  function evaluarMedicion(m, circ, sis, crit) {
    const tipo = (circ && circ.tipo) || 'Monofásico';
    const n = fasesDe(tipo);
    // Las columnas va/vb/vc son tensiones fase-neutro: se comparan contra la
    // tensión fase-neutro del sistema, no contra la tensión entre fases.
    const vfase = sis && sis.vln != null ? sis.vln : NaN;
    const brk = circ ? num(circ.brk) : NaN;
    const clavesV = ['va', 'vb', 'vc'];
    const clavesI = ['ia', 'ib', 'ic'];
    const issues = [];
    let s = 0, p = 0, sumaIntensidad = 0, cuentaI = 0, hayV = false, hayI = false;
    const fp = num(m.fp);

    for (let k = 0; k < n; k++) {
      const v = num(m[clavesV[k]]);
      const i = num(m[clavesI[k]]);
      if (isFinite(v)) hayV = true;
      if (isFinite(i)) { hayI = true; sumaIntensidad += i; cuentaI++; }
      if (isFinite(v) && isFinite(vfase)) {
        const tol = crit.vTol / 100;
        if (v < vfase * (1 - tol) || v > vfase * (1 + tol)) {
          issues.push({ k: clavesV[k], sev: 'alta', msg: `${fmt(v, 1)} V fuera de ±${crit.vTol} % de ${vfase} V` });
        }
      }
      if (isFinite(i) && isFinite(brk)) {
        if (i > brk) issues.push({ k: clavesI[k], sev: 'critica', msg: `I fase ${'ABC'[k]} ${fmt(i, 1)} A supera el breaker de ${brk} A` });
        else if (circ && circ.continua === 'Sí' && i > brk * crit.icont) {
          issues.push({ k: clavesI[k], sev: 'alta', msg: `I fase ${'ABC'[k]} ${fmt(i, 2)} A > ${Math.round(crit.icont * 100)} % del breaker` });
        }
      }
      if (isFinite(v) && isFinite(i) && isFinite(fp)) { s += v * i; p += v * i * fp; }
    }

    const q = isFinite(p) && isFinite(s) ? Math.sqrt(Math.max(s * s - p * p, 0)) : NaN;
    const im = cuentaI ? sumaIntensidad / cuentaI : NaN;

    const hz = num(m.hz);
    if (isFinite(hz) && (hz < crit.hzNom - crit.hzTol || hz > crit.hzNom + crit.hzTol)) {
      issues.push({ k: 'hz', sev: 'alta', msg: `${fmt(hz, 2)} Hz fuera de ${crit.hzNom} Hz ±${crit.hzTol} %` });
    }
    if (isFinite(fp) && fp < crit.fpMin) {
      issues.push({ k: 'fp', sev: 'media', msg: `FP ${fmt(fp, 2)} menor a ${crit.fpMin} (criterio de facturación)` });
    }
    const dvm = num(m.dvm);
    if (isFinite(dvm) && dvm > crit.dvMax) {
      issues.push({ k: 'dvm', sev: dvm > crit.dvCritico ? 'critica' : 'alta', msg: `ΔV medida ${fmt(dvm, 2)} % supera ${crit.dvMax} %` });
    }
    const vn = num(m.vn);
    if (isFinite(vn) && vn > crit.vntMax) {
      issues.push({ k: 'vn', sev: vn > 2 * crit.vntMax ? 'alta' : 'media', msg: `Tensión N–T ${fmt(vn, 1)} V mayor a ${crit.vntMax} V (neutro flotante o mala tierra)` });
    }
    const ine = num(m.ine);
    if (isFinite(ine) && isFinite(im) && im > 0 && ine > im * 1.1) {
      issues.push({ k: 'ine', sev: 'media', msg: `Corriente de neutro ${fmt(ine, 1)} A mayor que la de fase (${fmt(im, 1)} A)` });
    }
    const tmp = num(m.tmp);
    if (isFinite(tmp) && tmp > crit.tempMax) {
      issues.push({ k: 'tmp', sev: tmp > crit.tempMax + 20 ? 'critica' : 'alta', msg: `Temperatura ${fmt(tmp, 0)} °C mayor a ${crit.tempMax} °C` });
    }

    // Desbalance de tensión y de corriente (solo si hay las 3 fases).
    if (n === 3) {
      const vs = clavesV.map(k => num(m[k])).filter(isFinite);
      const is_ = clavesI.map(k => num(m[k])).filter(isFinite);
      const desbalance = arr => {
        if (arr.length < 3) return NaN;
        const max = Math.max.apply(null, arr), min = Math.min.apply(null, arr);
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        return avg > 0 ? ((max - min) / avg) * 100 : NaN;
      };
      const dv = desbalance(vs);
      const di = desbalance(is_);
      if (isFinite(dv) && dv > crit.desbalanceMax) issues.push({ k: 'va', sev: 'alta', msg: `Desbalance de tensión ${fmt(dv, 1)} % > ${crit.desbalanceMax} %` });
      if (isFinite(di) && di > crit.desbalanceMax) issues.push({ k: 'ia', sev: 'media', msg: `Desbalance de corriente ${fmt(di, 1)} % > ${crit.desbalanceMax} %` });
    }

    const completo = hayV && hayI && isFinite(fp) && isFinite(hz);
    return {
      id: '', issues, completo,
      p, s, q, im,
      pTxt: isFinite(p) ? `${fmt(p, 0)} W` : '—',
      sTxt: isFinite(s) ? `${fmt(s, 0)} VA` : '—',
      qTxt: isFinite(q) ? `${fmt(q, 0)} var` : '—',
      imTxt: isFinite(im) ? `${fmt(im, 1)} A` : '—',
      dvsTxt: isFinite(dvm) ? (dvm > crit.dvMax ? `FUERA (${fmt(dvm, 2)} %)` : `OK (${fmt(dvm, 2)} %)`) : '—',
      st: !completo ? 'INCOMPLETO' : issues.length ? 'NO CUMPLE' : 'OK'
    };
  }

  // ---------------------------------------------------------------------------
  // Aislamiento
  // ---------------------------------------------------------------------------

  function puntosAislamiento(tipo, sis) {
    const n = fasesDe(tipo);
    const fases = ['A', 'B', 'C'].slice(0, n);
    const pts = [];
    fases.forEach(f => pts.push({ pt: 'FT-' + f, label: `Fase ${f} – tierra` }));
    if (!sis || sis.neutro !== false) {
      fases.forEach(f => pts.push({ pt: 'FN-' + f, label: `Fase ${f} – neutro` }));
      pts.push({ pt: 'NT', label: 'Neutro – tierra' });
    }
    return pts;
  }

  function evaluarAislamiento(row, crit) {
    const issues = [];
    const min = crit.aislamientoMin;
    ['s30', 'm1'].forEach(k => {
      const v = num(row[k]);
      if (isFinite(v) && v < min) {
        issues.push({ k, sev: 'critica', msg: `${k === 's30' ? 'Lectura a 30 s' : 'Lectura a 1 min'} ${fmt(v, 1)} MΩ menor al mínimo de ${min} MΩ` });
      }
    });
    const completo = isFinite(num(row.s30)) || isFinite(num(row.m1));
    return { issues, completo, minTxt: fmt(min, 1), st: !completo ? 'INCOMPLETO' : issues.length ? 'NO CUMPLE' : 'OK' };
  }

  // ---------------------------------------------------------------------------
  // Puesta a tierra
  // ---------------------------------------------------------------------------

  function interpolar(puntos, x) {
    if (!puntos || !puntos.length || !isFinite(x)) return NaN;
    for (let i = 0; i < puntos.length - 1; i++) {
      const a = puntos[i], b = puntos[i + 1];
      if (x >= a.d && x <= b.d) {
        if (b.d === a.d) return a.R;
        return a.R + ((b.R - a.R) * (x - a.d)) / (b.d - a.d);
      }
    }
    return NaN;
  }

  function evaluarTierra(t, crit) {
    const met = t.met || '';
    const dEC = num(t.dEC);
    const puntos = (t.pts || [])
      .map(p => ({ d: num(p.d), R: num(p.R) }))
      .filter(p => isFinite(p.d) && isFinite(p.R))
      .sort((a, b) => a.d - b.d);

    const issues = [];
    let R = NaN, d62 = NaN, rm = NaN, rp = NaN, meseta = null;
    const pinza = /pinza/i.test(met);

    if (pinza) {
      R = num(t.Rp);
      if (!isFinite(R)) issues.push({ k: 'Rp', sev: 'media', msg: 'Registre la lectura de la pinza' });
    } else if (met) {
      d62 = 0.62 * dEC;
      if (!isFinite(dEC)) issues.push({ k: 'dEC', sev: 'critica', msg: 'Falta la distancia E–C' });
      if (puntos.length < 2) {
        issues.push({ k: 'pts', sev: 'critica', msg: 'El método del 62 % exige al menos 2 lecturas (ideal 3–5)' });
      } else {
        R = interpolar(puntos, d62);
        rm = interpolar(puntos, d62 - 1);
        rp = interpolar(puntos, d62 + 1);
        if (!isFinite(R)) issues.push({ k: 'pts', sev: 'critica', msg: 'Las lecturas no cubren el 62 % de la distancia E–C' });
        if (isFinite(rm) && isFinite(rp) && isFinite(R)) {
          meseta = Math.abs(rm - R) <= 0.1 * R && Math.abs(rp - R) <= 0.1 * R;
          if (!meseta) issues.push({ k: 'meseta', sev: 'alta', msg: 'La meseta no es plana (±10 %) alrededor del 62 %; repita las lecturas' });
        } else {
          issues.push({ k: 'meseta', sev: 'media', msg: 'Faltan lecturas a ±1 m del 62 % para comprobar la meseta' });
        }
        if (puntos.length === 2) {
          issues.push({ k: 'pts', sev: 'media', msg: 'Con solo 2 lecturas no se confirma la meseta: tome 3–5 puntos' });
        }
      }
    } else {
      issues.push({ k: 'met', sev: 'media', msg: 'Seleccione el método de medición de tierra' });
    }

    const rmax = num(t.rmax);
    const limite = isFinite(rmax) && rmax > 0 ? rmax : crit.tierraMax;
    if (isFinite(R) && R > limite) {
      issues.push({ k: 'R', sev: 'critica', msg: `Resistencia de tierra ${fmt(R, 2)} Ω mayor al máximo de ${fmt(limite, 2)} Ω` });
    }

    const cont = num(t.cont);
    if (isFinite(cont) && cont > crit.contMax) {
      issues.push({ k: 'cont', sev: 'critica', msg: `Continuidad ${fmt(cont, 2)} Ω mayor a ${crit.contMax} Ω` });
    }

    const completo = (pinza ? isFinite(R) : isFinite(R)) && isFinite(cont);
    return {
      R, d62, rm, rp, meseta, puntos, pinza, issues, completo,
      rTxt: isFinite(R) ? `${fmt(R, 2)} Ω` : '—',
      d62Txt: isFinite(d62) ? `${fmt(d62, 2)} m` : '—',
      rmTxt: isFinite(rm) ? `${fmt(rm, 2)} Ω` : '—',
      rpTxt: isFinite(rp) ? `${fmt(rp, 2)} Ω` : '—',
      mesetaTxt: meseta === null ? '—' : meseta ? 'OK (±10 %)' : 'FUERA (±10 %)',
      st: !completo ? 'INCOMPLETO' : issues.length ? 'NO CUMPLE' : 'OK'
    };
  }

  // ---------------------------------------------------------------------------
  // Protecciones
  // ---------------------------------------------------------------------------

  /** Usos que, según NTC 2050 210-8, requieren protección diferencial de 30 mA. */
  const USOS_GFCI = ['Cocina', 'Baño', 'Lavandería', 'Exterior', 'Garaje', 'Cochera', 'Piscina'];

  function evaluarProteccion(pr, circ, main, crit) {
    const issues = [];
    const brk = circ ? num(circ.brk) : NaN;
    const icc = num(main && main.icc);
    const kA = num(pr.kA);
    if (isFinite(kA) && isFinite(icc) && kA < icc) {
      issues.push({ k: 'kA', sev: 'critica', msg: `Poder de corte ${fmt(kA, 1)} kA menor que la Icc ${fmt(icc, 1)} kA` });
    }
    const ma = num(pr.ma);
    if (isFinite(ma) && ma > crit.rcdMa) issues.push({ k: 'ma', sev: 'alta', msg: `Sensibilidad ${fmt(ma, 0)} mA mayor a ${crit.rcdMa} mA` });
    const ms = num(pr.ms);
    if (isFinite(ms) && ms > crit.rcdMs) issues.push({ k: 'ms', sev: 'alta', msg: `Tiempo de disparo ${fmt(ms, 0)} ms mayor a ${crit.rcdMs} ms` });
    if (pr.pr === 'Falla') issues.push({ k: 'pr', sev: 'critica', msg: 'La prueba de disparo del diferencial falló' });

    const uso = circ && circ.uso;
    const requiere = USOS_GFCI.indexOf(uso) >= 0;
    const tp = pr.tp || '';
    const tieneDiferencial = /diferencial|gfci/i.test(tp) && isFinite(ma) && ma <= crit.rcdMa;
    if (requiere && !tieneDiferencial) {
      issues.push({ k: 'tp', sev: 'critica', msg: `El uso "${uso}" exige protección diferencial ≤ ${crit.rcdMa} mA (NTC 2050 210-8)` });
    }

    const completo = !!pr.tp && isFinite(brk) && (!requiere || isFinite(ma));
    return { issues, completo, st: !completo ? 'INCOMPLETO' : issues.length ? 'NO CUMPLE' : 'OK' };
  }

  function evaluarPrincipal(main, crit, resumen) {
    const issues = [];
    const a = num(main.A);
    const icc = num(main.icc);
    const ka = num(main.kA);
    if (isFinite(ka) && isFinite(icc) && ka < icc) {
      issues.push({ k: 'kA', sev: 'critica', msg: `Poder de corte ${fmt(ka, 1)} kA < Icc ${fmt(icc, 1)} kA` });
    }
    if (isFinite(a) && resumen && isFinite(resumen.demandaTotal) && resumen.sis) {
      const s = resumen.sis;
      const iTotal = s.fases >= 2 ? resumen.demandaTotal / (Math.sqrt(3) * s.vll) : resumen.demandaTotal / s.vln;
      if (iTotal > a) issues.push({ k: 'A', sev: 'critica', msg: `Demanda total ${fmt(iTotal, 1)} A supera el breaker principal de ${a} A` });
      else if (iTotal > 0.8 * a) issues.push({ k: 'A', sev: 'media', msg: `Demanda total ${fmt(iTotal, 1)} A > 80 % del breaker principal (${fmt(0.8 * a, 1)} A)` });
    }
    const completo = isFinite(a);
    return { issues, completo, st: !completo ? 'INCOMPLETO' : issues.length ? 'NO CUMPLE' : 'OK' };
  }

  // ---------------------------------------------------------------------------
  // Canalizaciones e iluminación
  // ---------------------------------------------------------------------------

  function limiteOcupacion(n) {
    if (n <= 1) return 53;
    if (n === 2) return 31;
    return 40;
  }

  function ocupacionTubo(n, calLabel, tipoTubo, diametro) {
    const cond = conductorDeEtiqueta(calLabel);
    const areas = TUBOS[tipoTubo] || {};
    const areaTubo = areas[diametro];
    const nNum = Math.max(0, Math.round(num(n)));
    if (!cond || !areaTubo || !nNum) return null;
    const areaCond = cond.areaIn2 * nNum;
    return {
      pct: (areaCond / areaTubo) * 100,
      limite: limiteOcupacion(nNum),
      areaCond,
      areaTubo,
      n: nNum
    };
  }

  function evaluarCanal(fila, crit) {
    const issues = [];
    const oc = ocupacionTubo(fila.ncond, fila.cal, fila.mat, fila.d);
    const manual = num(fila.ocu);
    const pct = oc ? oc.pct : manual;
    const limite = oc ? oc.limite : crit.ocupacionMax;
    if (isFinite(pct) && pct > limite) {
      issues.push({ k: 'ocu', sev: 'alta', msg: `Ocupación ${fmt(pct, 1)} % mayor al ${limite} % permitido` });
    }
    if (fila.emp === 'No conforme') issues.push({ k: 'emp', sev: 'alta', msg: 'Empalmes no conformes' });
    if (fila.ide === 'No conforme') issues.push({ k: 'ide', sev: 'media', msg: 'Conductores sin identificación' });
    const completo = isFinite(pct) || (fila.emp && fila.ide);
    return {
      issues, completo, oc, pct,
      pctTxt: isFinite(pct) ? `${fmt(pct, 1)} %` : '—',
      limiteTxt: isFinite(limite) ? `${limite} %` : '—',
      st: !completo ? 'INCOMPLETO' : issues.length ? 'NO CUMPLE' : 'OK'
    };
  }

  function evaluarLux(fila) {
    const issues = [];
    const p = num(fila.P);
    const phi = num(fila.phi);
    const cant = num(fila.cant) > 0 ? num(fila.cant) : 1;
    const sup = num(fila.sup);
    const ef = isFinite(phi) && p > 0 ? phi / p : NaN;
    const dp = isFinite(p) && isFinite(sup) && sup > 0 ? (p * cant) / sup : NaN;
    const lux = num(fila.lux);
    const lmin = num(fila.lmin);
    let ok = null;
    if (isFinite(lux) && isFinite(lmin)) {
      ok = lux >= lmin;
      if (!ok) issues.push({ k: 'lux', sev: 'alta', msg: `Iluminancia ${fmt(lux, 0)} lx menor al mínimo ${fmt(lmin, 0)} lx` });
    }
    const completo = isFinite(lux) && isFinite(lmin);
    return {
      issues, completo, ef, dp,
      efTxt: isFinite(ef) ? `${fmt(ef, 1)} lm/W` : '—',
      dpTxt: isFinite(dp) ? `${fmt(dp, 2)} W/m²` : '—',
      okTxt: ok === null ? '—' : ok ? 'Sí' : 'No',
      st: !completo ? 'INCOMPLETO' : issues.length ? 'NO CUMPLE' : 'OK'
    };
  }

  function evaluarHallazgo(h) {
    const issues = [];
    if (h.pri === 'Alta' && h.est !== 'Cerrado') {
      issues.push({ k: 'pri', sev: 'critica', msg: 'Hallazgo de prioridad alta abierto' });
    }
    const completo = !!(h.desc && h.pri);
    return { issues, completo, st: !completo ? 'INCOMPLETO' : h.est === 'Cerrado' ? 'CERRADO' : 'ABIERTO' };
  }

  // ---------------------------------------------------------------------------
  // Criterios y veredicto
  // ---------------------------------------------------------------------------

  const CRITERIOS = {
    dvMax: 3,          // NTC 2050 210-19: 3 % en ramal
    dvCritico: 5,
    vTol: 5,           // ±5 % de la tensión nominal
    hzNom: 60,
    hzTol: 1,          // ±1 %
    fpMin: 0.9,        // criterio de facturación, no de seguridad
    icont: 0.8,        // carga continua: 80 % del breaker (125 % inverso)
    tempAmp: 75,       // 60 / 75 / 90 °C
    factorDerrateo: 1, // agrupamiento y temperatura
    tierraMax: 25,     // valor de referencia, configurable
    contMax: 1,
    aislamientoMin: 1,
    rcdMa: 30,
    rcdMs: 300,
    ocupacionMax: 40,
    desbalanceMax: 20,
    vntMax: 5,
    tempMax: 60,
    fpDemanda: 0.9
  };

  function criterios(extra) {
    return Object.assign({}, CRITERIOS, extra || {});
  }

  const PESO = { critica: 3, alta: 2, media: 1, baja: 0 };

  /**
   * Veredicto sugerido a partir de las alertas y del estado de completitud.
   * Una sola alerta crítica impide aprobar.
   */
  function veredicto(issues, completo) {
    const cuenta = { critica: 0, alta: 0, media: 0, baja: 0 };
    (issues || []).forEach(i => { if (cuenta[i.sev] != null) cuenta[i.sev]++; });
    let concepto;
    if (!completo) concepto = 'Incompleto';
    else if (cuenta.critica > 0) concepto = 'No aprobado';
    else if (cuenta.alta + cuenta.media > 0) concepto = 'Aprobado con observaciones';
    else concepto = 'Aprobado';
    return { concepto, cuenta, total: cuenta.critica + cuenta.alta + cuenta.media + cuenta.baja };
  }

  /** Menor o igual calibre: devuelve true si `a` es de sección >= `b`. */
  function calibreMayorOIgual(a, b) {
    const ia = ORDEN_AWG.indexOf(a), ib = ORDEN_AWG.indexOf(b);
    if (ia < 0 || ib < 0) return false;
    return ia >= ib;
  }

  function tierraRequerida(breakerA) {
    const a = num(breakerA);
    if (!isFinite(a)) return null;
    const fila = TIERRA_250_122.find(f => a <= f.max);
    return fila ? fila.awg : null;
  }

  return {
    RHO, SISTEMAS, CONDUCTORES, CALIBRES, TUBOS, TIERRA_250_122, USOS_GFCI,
    TIPOS_CIRCUITO, CRITERIOS, PESO,
    num, fmt, pct,
    fasesDe, sistemaDe, tensionDeCircuito, idsCircuitos, conductorDeEtiqueta,
    calcularCircuito, evaluarMedicion, puntosAislamiento, evaluarAislamiento,
    interpolar, evaluarTierra, evaluarProteccion, evaluarPrincipal,
    limiteOcupacion, ocupacionTubo, evaluarCanal, evaluarLux, evaluarHallazgo,
    criterios, veredicto, calibreMayorOIgual, tierraRequerida
  };
});
