'use strict';
/*
 * Pruebas del núcleo de cálculo. Ejecutar con:  node --test tests/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

const crit = C.criterios();
const sis120 = C.sistemaDe('120-1f');
const sis208 = C.sistemaDe('208y-120');
const sis240 = C.sistemaDe('120-240-1f3h');
const sis240d = C.sistemaDe('240d');

test('num acepta coma y punto decimal', () => {
  assert.equal(C.num('12,5'), 12.5);
  assert.equal(C.num('12.5'), 12.5);
  assert.equal(C.num(' 120 '), 120);
  assert.ok(Number.isNaN(C.num('')));
  assert.ok(Number.isNaN(C.num('abc')));
});

test('IDs de circuito por espacios del tablero', () => {
  const ids = C.idsCircuitos([
    { tipo: 'Monofásico' },
    { tipo: 'Bifásico' },
    { tipo: 'Monofásico' },
    { tipo: 'Trifásico' }
  ]);
  assert.deepEqual(ids, ['C1', 'C2-3', 'C4', 'C5-7']);
});

test('caída de tensión monofásica (2 hilos, 120 V)', () => {
  const r = C.calcularCircuito(
    { tipo: 'Monofásico', cal: '2.08 mm² (14 AWG)', L: 20, W: 2000, fd: 1, fp: 1, brk: 20 },
    sis120, crit
  );
  assert.ok(Math.abs(r.i - 16.667) < 0.01, `I=${r.i}`);
  assert.ok(Math.abs(r.dv - 4.594) < 0.01, `dv=${r.dv}`);
});

test('caída de tensión trifásica usa √3 y tensión entre fases', () => {
  const r = C.calcularCircuito(
    { tipo: 'Trifásico', cal: '2.08 mm² (14 AWG)', L: 20, W: 2000, fd: 1, fp: 1, brk: 20 },
    sis208, crit
  );
  // I = 2000/(√3·208) = 5,55 A ; ΔV = ρ·L·VA/(S·V²) ≈ 0,764 %
  assert.ok(Math.abs(r.i - 5.551) < 0.01, `I=${r.i}`);
  assert.ok(Math.abs(r.dv - 0.7645) < 0.001, `dv=${r.dv}`);
  assert.equal(r.vref, 208);
});

test('caída de tensión bifásica 240 V no duplica el valor', () => {
  const r = C.calcularCircuito(
    { tipo: 'Bifásico', cal: '3.31 mm² (12 AWG)', L: 25, W: 3000, fd: 1, fp: 1, brk: 20 },
    sis240, crit
  );
  // I = 3000/240 = 12,5 A ; ΔV = 2·0,0172·25·12,5/(3,31·240)·100 ≈ 1,353 %
  assert.ok(Math.abs(r.i - 12.5) < 0.001, `I=${r.i}`);
  assert.ok(Math.abs(r.dv - 1.3529) < 0.01, `dv=${r.dv}`);
});

test('delta sin neutro toma la tensión entre fases', () => {
  const r = C.calcularCircuito(
    { tipo: 'Trifásico', cal: '5.26 mm² (10 AWG)', L: 30, W: 5000, fd: 1, fp: 1, brk: 30 },
    sis240d, crit
  );
  assert.equal(r.vref, 240);
});

test('breaker mayor que la ampacidad del conductor es crítico', () => {
  const r = C.calcularCircuito(
    { tipo: 'Monofásico', cal: '2.08 mm² (14 AWG)', L: 10, W: 1000, fd: 1, fp: 1, brk: 30 },
    sis120, crit
  );
  assert.ok(r.issues.some(i => i.k === 'brk' && i.sev === 'critica'));
});

test('carga continua por encima del 80 % del breaker es alerta alta', () => {
  const r = C.calcularCircuito(
    { tipo: 'Monofásico', cal: '3.31 mm² (12 AWG)', L: 10, W: 2000, fd: 1, fp: 1, brk: 20, continua: 'Sí' },
    sis120, crit
  );
  // I = 16,67 A > 16 A (80 % de 20)
  assert.ok(r.issues.some(i => i.k === 'i' && i.sev === 'alta'));
});

test('circuito incompleto no se reporta como OK', () => {
  const r = C.calcularCircuito({ tipo: 'Monofásico', cal: '', L: '', W: 100, fd: 1, fp: 1, brk: 20 }, sis120, crit);
  assert.equal(r.st, 'INCOMPLETO');
  assert.equal(r.completo, false);
});

test('mínimo de aislamiento y puntos por tipo de sistema', () => {
  const mono = C.puntosAislamiento('Monofásico', sis120);
  assert.deepEqual(mono.map(p => p.pt), ['FT-A', 'FN-A', 'NT']);
  const tri = C.puntosAislamiento('Trifásico', sis208);
  assert.equal(tri.length, 7);
  const delta = C.puntosAislamiento('Trifásico', sis240d);
  assert.deepEqual(delta.map(p => p.pt), ['FT-A', 'FT-B', 'FT-C']);

  const bajo = C.evaluarAislamiento({ s30: 0.5, m1: 0.8 }, crit);
  assert.ok(bajo.issues.some(i => i.sev === 'critica'));
  const ok = C.evaluarAislamiento({ s30: 5, m1: 6 }, crit);
  assert.equal(ok.st, 'OK');
});

test('interpolación lineal y fuera de rango', () => {
  const p = [{ d: 0, R: 10 }, { d: 10, R: 20 }];
  assert.equal(C.interpolar(p, 5), 15);
  assert.ok(Number.isNaN(C.interpolar(p, 20)));
});

test('método del 62 % con dos lecturas', () => {
  const t = {
    met: 'Caída de potencial 3 picas (62 %)',
    dEC: 20,
    rmax: 25,
    cont: 0.4,
    pts: [{ d: 11.4, R: 15.5 }, { d: 13.4, R: 15.1 }]
  };
  const r = C.evaluarTierra(t, crit);
  assert.ok(Math.abs(r.R - 15.3) < 0.01, `R=${r.R}`);
  assert.ok(Math.abs(r.d62 - 12.4) < 0.001);
  assert.equal(r.meseta, true);
  assert.ok(r.issues.some(i => i.k === 'pts' && i.sev === 'media'));
});

test('tierra con lectura alta es crítica', () => {
  const r = C.evaluarTierra({ met: 'Pinza', Rp: 40, rmax: 25, cont: 0.2 }, crit);
  assert.ok(r.issues.some(i => i.k === 'R' && i.sev === 'critica'));
});

test('conductor de tierra según tabla 250-122', () => {
  assert.equal(C.tierraRequerida(20), '12');
  assert.equal(C.tierraRequerida(60), '10');
  assert.equal(C.tierraRequerida(100), '8');
  assert.equal(C.tierraRequerida(200), '6');
  assert.equal(C.tierraRequerida(1200), '4/0');
  assert.equal(C.calibreMayorOIgual('10', '12'), true);
  assert.equal(C.calibreMayorOIgual('14', '12'), false);
});

test('protección diferencial obligatoria en cocina', () => {
  const circ = { tipo: 'Monofásico', brk: 20, uso: 'Cocina' };
  const r = C.evaluarProteccion({ tp: 'Termomagnético', kA: 10, ma: 30, ms: 30, pr: 'Correcto' }, circ, { icc: 4.5 }, crit);
  assert.ok(r.issues.some(i => i.k === 'tp' && i.sev === 'critica'));

  const ok = C.evaluarProteccion({ tp: 'Diferencial', kA: 10, ma: 30, ms: 30, pr: 'Correcto' }, circ, { icc: 4.5 }, crit);
  assert.equal(ok.st, 'OK');
});

test('poder de corte insuficiente es crítico', () => {
  const r = C.evaluarProteccion({ tp: 'Termomagnético', kA: 3, ma: 30, ms: 30, pr: 'Correcto' }, { tipo: 'Monofásico', brk: 20 }, { icc: 6 }, crit);
  assert.ok(r.issues.some(i => i.k === 'kA' && i.sev === 'critica'));
});

test('demanda total contra breaker principal', () => {
  const r = C.evaluarPrincipal({ A: 60, icc: 5, kA: 10 }, crit, { sis: sis208, demandaTotal: 30000 });
  assert.ok(r.issues.some(i => i.k === 'A'));
});

test('ocupación de tubería calculada', () => {
  const oc = C.ocupacionTubo(3, '3.31 mm² (12 AWG)', 'EMT', '1/2');
  assert.ok(Math.abs(oc.pct - 13.125) < 0.01, `pct=${oc.pct}`);
  assert.equal(oc.limite, 40);

  const dos = C.ocupacionTubo(2, '3.31 mm² (12 AWG)', 'EMT', '1/2');
  assert.equal(dos.limite, 31);
});

test('iluminación: eficacia, densidad y cumplimiento', () => {
  const r = C.evaluarLux({ P: 20, phi: 2000, cant: 4, sup: 20, lmin: 300, lux: 350 });
  assert.ok(Math.abs(r.ef - 100) < 0.001);
  assert.ok(Math.abs(r.dp - 4) < 0.001);
  assert.equal(r.okTxt, 'Sí');

  const mal = C.evaluarLux({ P: 20, phi: 1000, cant: 2, sup: 20, lmin: 300, lux: 200 });
  assert.ok(mal.issues.some(i => i.k === 'lux' && i.sev === 'alta'));
});

test('hallazgo de prioridad alta abierto es crítico', () => {
  const r = C.evaluarHallazgo({ desc: 'Toma sin tierra', pri: 'Alta', est: 'Abierto' });
  assert.ok(r.issues.some(i => i.sev === 'critica'));
  const cerrado = C.evaluarHallazgo({ desc: 'Toma sin tierra', pri: 'Alta', est: 'Cerrado' });
  assert.equal(cerrado.issues.length, 0);
});

test('veredicto por severidad', () => {
  assert.equal(C.veredicto([], true).concepto, 'Aprobado');
  assert.equal(C.veredicto([{ sev: 'media' }], true).concepto, 'Aprobado con observaciones');
  assert.equal(C.veredicto([{ sev: 'alta' }], true).concepto, 'Aprobado con observaciones');
  assert.equal(C.veredicto([{ sev: 'critica' }], true).concepto, 'No aprobado');
  assert.equal(C.veredicto([], false).concepto, 'Incompleto');
});

test('criterios personalizados', () => {
  const c = C.criterios({ dvMax: 5, tierraMax: 10 });
  assert.equal(c.dvMax, 5);
  assert.equal(c.tierraMax, 10);
  assert.equal(c.ivMax, undefined);
  assert.equal(c.aislamientoMin, 1);
});
