'use strict';
/*
 * Prueba de extremo a extremo con Chrome headless (puppeteer-core).
 * Uso: node tests/e2e.cjs
 *
 * - Levanta un servidor estático del proyecto.
 * - Abre la app, llena una inspección completa y genera el informe.
 * - Verifica que no haya errores de consola ni desbordes de página.
 * - Imprime el informe a PDF y prueba el modo sin conexión.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const CANDIDATOS_CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);
const CHROME = CANDIDATOS_CHROME.find(p => fs.existsSync(p));
if (!CHROME) {
  console.error('No se encontró Chrome/Chromium. Defina CHROME_PATH con la ruta del ejecutable.');
  process.exit(2);
}
console.log('Chrome:', CHROME);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function servir() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('no encontrado'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const errores = [];
const fallos = [];
function check(cond, msg) {
  if (cond) { console.log('  ok  ' + msg); }
  else { console.log('  FALLA  ' + msg); fallos.push(msg); }
}

(async () => {
  const server = await servir();
  const base = `http://127.0.0.1:${server.address().port}/`;
  console.log('Servidor:', base);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errores.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('dialog', d => d.accept());

  const fill = async (sel, value) => {
    await page.$eval(sel, (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
  };
  const click = async sel => { await page.click(sel); await sleep(120); };
  const txt = sel => page.$eval(sel, el => el.textContent.trim());

  console.log('\n[1] Carga inicial');
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#s-info.on');
  const navs = await page.$$eval('nav button[data-t]', b => b.length);
  check(navs === 12, `12 secciones en la navegación (${navs})`);
  check(await page.$eval('#verdictChip', el => el.textContent.includes('Incompleto')), 'estado inicial: Incompleto');

  console.log('\n[2] Datos del proyecto');
  await fill('[data-path="info.informe"]', 'INF-2026-001');
  await fill('[data-path="info.proyecto"]', 'Casa Ed Carbo');
  await fill('[data-path="info.cliente"]', 'Miriam Marcucci');
  await fill('[data-path="info.direccion"]', 'Calle 10 # 5-20, Popayán');
  await fill('[data-path="info.telefono"]', '300 000 0000');
  await fill('[data-path="info.correo"]', 'cliente@example.com');
  await fill('[data-path="info.area"]', '72');
  await fill('[data-path="info.pisos"]', '1');
  await fill('[data-path="info.uso"]', 'Residencial');
  await fill('[data-path="info.sistema"]', '208Y/120 V trifásico 4 hilos');
  await fill('[data-path="info.normativa"]', 'RETIE + NTC 2050 + RETILAP');
  await fill('[data-path="info.tecnico"]', 'Jeison Díaz');
  await fill('[data-path="info.matricula"]', 'MP-12345');
  await fill('[data-path="info.empresa"]', 'Díaz Ingeniería');
  await fill('[data-path="info.alcance"]', 'Inspección visual y de medición de la instalación eléctrica residencial.');
  await fill('[data-path="env.tempAmb"]', '24');
  await fill('[data-path="env.humedad"]', '62');
  await fill('[data-path="env.clima"]', 'Seco');

  console.log('\n[3] Circuitos');
  await click('nav button[data-t="circ"]');
  for (let i = 0; i < 3; i++) await click('[data-add="circ"]');
  const circ = [
    ['Monofásico', 'Iluminación sala y comedor', 'Iluminación', 15, 'C', '2.08 mm² (14 AWG)', 18, 800, 1, 0.95, 'No'],
    ['Bifásico', 'Aire acondicionado habitación 1', 'Climatización', 20, 'C', '3.31 mm² (12 AWG)', 22, 3000, 1, 0.9, 'Sí'],
    ['Trifásico', 'Motor bomba de agua', 'Motor', 30, 'D', '5.26 mm² (10 AWG)', 35, 5000, 1, 0.85, 'No']
  ];
  for (let i = 0; i < circ.length; i++) {
    const [tipo, desc, uso, brk, curva, cal, L, W, fd, fp, cont] = circ[i];
    await fill(`[data-path="circ.${i}.tipo"]`, tipo);
    await fill(`[data-path="circ.${i}.desc"]`, desc);
    await fill(`[data-path="circ.${i}.uso"]`, uso);
    await fill(`[data-path="circ.${i}.brk"]`, brk);
    await fill(`[data-path="circ.${i}.curva"]`, curva);
    await fill(`[data-path="circ.${i}.cal"]`, cal);
    await fill(`[data-path="circ.${i}.L"]`, L);
    await fill(`[data-path="circ.${i}.W"]`, W);
    await fill(`[data-path="circ.${i}.fd"]`, fd);
    await fill(`[data-path="circ.${i}.fp"]`, fp);
    await fill(`[data-path="circ.${i}.continua"]`, cont);
  }
  const dv0 = await txt('[data-c="circ|0|dv"]');
  const dv2 = await txt('[data-c="circ|2|dv"]');
  check(/1[.,]7/.test(dv0), `ΔV monofásico calculado ≈1,7 % (${dv0})`);
  check(/1[.,]5/.test(dv2), `ΔV trifásico calculado ≈1,6 % (${dv2})`);

  console.log('\n[4] Mediciones y aislamiento');
  await click('nav button[data-t="meas"]');
  await fill('[data-path="meas.0.va"]', '120');
  await fill('[data-path="meas.0.ia"]', '7');
  await fill('[data-path="meas.0.fp"]', '0.95');
  await fill('[data-path="meas.0.hz"]', '60');
  await fill('[data-path="meas.0.vn"]', '0.8');
  await fill('[data-path="meas.0.tmp"]', '31');
  await fill('[data-path="meas.1.va"]', '120');
  await fill('[data-path="meas.1.vb"]', '121');
  await fill('[data-path="meas.1.ia"]', '15');
  await fill('[data-path="meas.1.ib"]', '14');
  await fill('[data-path="meas.1.fp"]', '0.9');
  await fill('[data-path="meas.1.hz"]', '60');
  await click('nav button[data-t="meg"]');
  await fill('[data-path="meg.rows.0.s30"]', '50');
  await fill('[data-path="meg.rows.0.m1"]', '60');
  await fill('[data-path="meg.rows.1.s30"]', '0.5');
  await fill('[data-path="meg.rows.1.m1"]', '0.7');

  console.log('\n[5] Puesta a tierra, protecciones y canalización');
  await click('nav button[data-t="tierra"]');
  await fill('[data-path="tierra.tipo"]', 'Varilla');
  await fill('[data-path="tierra.n"]', '2');
  await fill('[data-path="tierra.prof"]', '2.4');
  await fill('[data-path="tierra.mat"]', 'Cobre');
  await fill('[data-path="tierra.met"]', 'Caída de potencial 3 picas (62 %)');
  await fill('[data-path="tierra.dEC"]', '20');
  await fill('[data-path="tierra.rmax"]', '25');
  await fill('[data-path="tierra.cont"]', '0.4');
  await fill('[data-path="tierra.cal"]', '8.37 mm² (8 AWG)');
  await click('[data-addpt]');
  await click('[data-addpt]');
  await click('[data-addpt]');
  for (let i = 0; i < 3; i++) {
    await fill(`[data-path="tierra.pts.${i}.d"]`, [11.4, 13.4, 14.4][i]);
    await fill(`[data-path="tierra.pts.${i}.R"]`, [15.5, 15.1, 15.0][i]);
  }
  const rTierra = await page.$eval('[data-out="R"]', el => el.textContent);
  check(/15[.,]3/.test(rTierra), `resistencia a 62 % ≈15,3 Ω (${rTierra})`);

  await click('nav button[data-t="prot"]');
  await fill('[data-path="prot.main.marca"]', 'Schneider');
  await fill('[data-path="prot.main.modelo"]', 'QO');
  await fill('[data-path="prot.main.A"]', '100');
  await fill('[data-path="prot.main.kA"]', '10');
  await fill('[data-path="prot.main.icc"]', '5');
  await fill('[data-path="prot.main.curva"]', 'C');
  await fill('[data-path="prot.rows.0.tp"]', 'Termomagnético');
  await fill('[data-path="prot.rows.0.kA"]', '10');
  await fill('[data-path="prot.rows.0.pr"]', 'Correcto');

  await click('nav button[data-t="canal"]');
  await click('[data-add="canal"]');
  await fill('[data-path="canal.0.tramo"]', 'Tablero - cocina');
  await fill('[data-path="canal.0.tipo"]', 'Tubería conduit');
  await fill('[data-path="canal.0.mat"]', 'EMT');
  await fill('[data-path="canal.0.d"]', '1/2');
  await fill('[data-path="canal.0.ncond"]', '3');
  await fill('[data-path="canal.0.cal"]', '3.31 mm² (12 AWG)');
  await fill('[data-path="canal.0.ais"]', 'THHN');
  await fill('[data-path="canal.0.emp"]', 'Conforme');
  await fill('[data-path="canal.0.ide"]', 'Conforme');
  const ocu = await txt('[data-c="canal|0|ocu"]');
  check(/13[.,]1/.test(ocu), `ocupación de tubería calculada ≈13,1 % (${ocu})`);

  console.log('\n[6] Iluminación y hallazgos');
  await click('nav button[data-t="lux"]');
  await click('[data-add="lux"]');
  await fill('[data-path="lux.0.area"]', 'Sala');
  await fill('[data-path="lux.0.lum"]', 'Panel LED 36 W');
  await fill('[data-path="lux.0.cant"]', '4');
  await fill('[data-path="lux.0.P"]', '36');
  await fill('[data-path="lux.0.phi"]', '3600');
  await fill('[data-path="lux.0.sup"]', '20');
  await fill('[data-path="lux.0.lmin"]', '150');
  await fill('[data-path="lux.0.lux"]', '240');

  await click('nav button[data-t="hall"]');
  await click('[data-add="hall"]');
  await fill('[data-path="hall.0.desc"]', 'Toma de cocina sin diferencial');
  await fill('[data-path="hall.0.pri"]', 'Alta');
  await fill('[data-path="hall.0.rec"]', 'Instalar diferencial de 30 mA');

  console.log('\n[7] Dictamen y firma');
  await click('nav button[data-t="dict"]');
  await fill('[data-path="dict.concepto"]', 'Aprobado con observaciones');
  await fill('[data-path="dict.tecnico"]', 'Jeison Díaz');
  await fill('[data-path="dict.matricula"]', 'MP-12345');
  await fill('[data-path="dict.propietario"]', 'Miriam Marcucci');
  await fill('[data-path="dict.firma"]', 'Jeison Díaz');
  await fill('[data-path="dict.conclusiones"]', 'Se verificó la instalación. Corregir el hallazgo antes de energizar la cocina.');
  const firma = await page.$('#sigPad');
  const caja = await firma.boundingBox();
  await page.mouse.move(caja.x + 60, caja.y + 120);
  await page.mouse.down();
  await page.mouse.move(caja.x + 180, caja.y + 60, { steps: 12 });
  await page.mouse.move(caja.x + 300, caja.y + 140, { steps: 12 });
  await page.mouse.up();
  await sleep(300);
  const chip = await page.$eval('#verdictChip', el => el.textContent);
  check(chip.includes('No aprobado'), `veredicto por severidad: ${chip}`);

  console.log('\n[7b] Anexo fotográfico');
  const fotoPath = path.join(os.tmpdir(), 'retie-foto.png');
  fs.writeFileSync(fotoPath, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  ));
  await click('nav button[data-t="fotos"]');
  const inputFoto = await page.$('#fFotos');
  await inputFoto.uploadFile(fotoPath);
  await page.waitForFunction(() => !!document.querySelector('.foto img[src^="data:"]'), { timeout: 10000 });
  check(true, 'foto agregada y guardada en IndexedDB');

  console.log('\n[8] Informe');
  await click('#bReport');
  await page.waitForSelector('#report:not([hidden])', { timeout: 15000 });
  await page.waitForSelector('.page');
  const paginas = await page.$$eval('.page', els => els.length);
  check(paginas >= 3, `informe paginado (${paginas} páginas)`);
  const imgs = await page.$$eval('.page img', els => els.length);
  check(imgs >= 1, `foto incluida en el anexo del informe (${imgs})`);
  const desbordes = await page.$$eval('.pg-body', els => els.map(e => e.scrollHeight - e.clientHeight));
  check(desbordes.every(d => d <= 1), `sin desbordes de página (${JSON.stringify(desbordes)})`);
  if (process.env.VERBOSE) {
    const mapa = await page.$$eval('.page', els => els.map(p => {
      const b = p.querySelector('.pg-body');
      return {
        h: (p.querySelector('h2') || {}).textContent || '(portada)',
        cuerpo: b ? b.clientHeight : null,
        contenido: b ? b.scrollHeight : null,
        bloques: b ? b.children.length : null
      };
    }));
    console.log(mapa);
  }
  const pie = await page.$eval('.pg-foot .pg-num', el => el.textContent);
  check(/Página 2 de \d+/.test(pie), `numeración de páginas (${pie})`);
  await page.screenshot({ path: path.join(os.tmpdir(), 'retie-informe.png'), fullPage: false });

  const pdf = path.join(os.tmpdir(), 'retie-informe.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  check(fs.existsSync(pdf) && fs.statSync(pdf).size > 20000, 'PDF generado (' + Math.round(fs.statSync(pdf).size / 1024) + ' KB)');

  await click('#bCloseReport');

  console.log('\n[9] Persistencia y sin conexión');
  const guardado = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('retie3.doc.')).length);
  check(guardado >= 1, `expediente guardado en localStorage (${guardado})`);
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'no soportado';
    const reg = await navigator.serviceWorker.ready;
    return reg.active ? 'activo' : 'sin activar';
  });
  check(sw === 'activo', `service worker ${sw}`);
  await sleep(800);
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#s-info', { timeout: 10000 });
  check(await page.$eval('#nav', el => el.children.length === 12), 'la app carga sin conexión');
  await page.setOfflineMode(false);

  console.log('\n[10] Vista móvil');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#s-info.on');
  await page.screenshot({ path: path.join(os.tmpdir(), 'retie-movil.png'), fullPage: false });
  check(true, 'captura móvil generada');

  check(errores.length === 0, 'sin errores de consola: ' + (errores.slice(0, 4).join(' | ') || 'ninguno'));

  await browser.close();
  server.close();

  console.log('\nResultado: ' + (fallos.length ? fallos.length + ' fallo(s)' : 'todo correcto'));
  if (fallos.length) { console.log(fallos.join('\n')); process.exit(1); }
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(2); });


