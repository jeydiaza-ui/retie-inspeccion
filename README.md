# Inspección eléctrica RETIE

Aplicación web (PWA) para registrar, calcular y documentar inspecciones eléctricas
residenciales bajo **RETIE**, **NTC 2050** y **RETILAP**. Funciona sin conexión,
guarda varios expedientes en el dispositivo y genera un informe A4 en PDF.

**En línea:** <https://jeydiaza-ui.github.io/retie-inspeccion/>
**Repositorio:** <https://github.com/jeydiaza-ui/retie-inspeccion>

> **Versión 3.0.1.** Reescritura de la plantilla original de 2026-10: corrige el
> informe recortado, el service worker, el dictamen sin firma, el cálculo de ΔV
> trifásico y agrega verificaciones de ampacidad, conductor de tierra, llenado de
> tubería, poder de corte y protección diferencial por uso.

---

## Qué hace

- **12 secciones**: proyecto, instrumentos y ambiente, circuitos, mediciones,
  aislamiento, puesta a tierra, protecciones, canalizaciones, iluminación,
  hallazgos, dictamen y anexo fotográfico.
- **Cálculos automáticos**: demanda (W × FD ÷ FP), corriente, caída de tensión
  (2·ρ·L·I/S en monofásico y bifásico; √3·ρ·L·I/S en trifásico), ampacidad,
  ocupación de tubería, método del 62 % con interpolación y meseta, P/S/Q.
- **Validación por severidad**: una sola alerta crítica impide aprobar; cada alerta
  queda listada en la sección y en el resumen.
- **Informe paginado**: portada, resumen ejecutivo, tablas completas (sin recortes),
  encabezado, pie con “Página X de Y” y marca de agua **BORRADOR** si falta firma.
- **Firma** en canvas y **fotos** comprimidas en el anexo.
- **Expedientes múltiples** con autoguardado, exportación/importación JSON y
  migración de los respaldos de la versión anterior.
- **PWA**: instalable, funciona sin conexión y se actualiza sola.

---

## Uso

1. Abra la aplicación publicada (o sirva la carpeta por HTTP, ver abajo).
2. Cree un expediente con **Nuevo** y complete la sección 1.
3. Agregue circuitos; las secciones de mediciones, aislamiento y protecciones se
   crean automáticamente.
4. Registre mediciones, tierra, canalizaciones, iluminación y hallazgos.
5. Complete el dictamen y firme con el dedo, el lápiz o el mouse.
6. Pulse **Informe** para revisar la vista previa y luego **Imprimir / PDF**.

### Instalación en el teléfono

- **Android/Chrome**: menú ⋮ → *Instalar aplicación* (o *Agregar a pantalla de inicio*).
- **iPhone/Safari**: botón Compartir → *Agregar a pantalla de inicio*.

El service worker requiere HTTPS o `localhost`; abrir el archivo con `file://`
no habilita el modo sin conexión.

### Servir en local

```powershell
python -m http.server 8080
# Abrir http://127.0.0.1:8080
```

---

## Datos, respaldo y privacidad

- Los expedientes se guardan en **localStorage** del navegador; las fotos, en
  **IndexedDB**. Nada se envía a un servidor: la app no tiene backend ni analítica.
- **Exporte el JSON con frecuencia** (*Guardar copia*). Si borra los datos del
  navegador, cambia de dispositivo o de dominio, el expediente se pierde.
- El JSON **no incluye las fotos** (solo sus descripciones); conserve las imágenes
  originales por separado.
- El informe contiene datos personales del cliente. En Colombia aplica la
  **Ley 1581 de 2012**: obtenga autorización, limite el acceso y defina un plazo
  de conservación. No comparta la carpeta del proyecto con informes de clientes.
- La aplicación es una herramienta de apoyo: **no sustituye** la certificación de
  conformidad RETIE emitida por un organismo de inspección acreditado ni el
  criterio del profesional responsable.

---

## Publicación en GitHub Pages

El repositorio incluye el flujo `.github/workflows/pages.yml`:

1. Suba el proyecto a un repositorio **público** (Pages gratuito requiere repo público).
2. En *Settings → Pages*, en *Build and deployment*, seleccione **GitHub Actions**.
3. Cada push a `main` publica la app en
   `https://<usuario>.github.io/<repositorio>/`.

> Al cambiar cualquier archivo de `sw.js`, suba el número de `CACHE` para que los
> clientes reciban la versión nueva.
### Netlify u otro hosting estático

Cualquier hosting estático sirve. No hay build: el repositorio se publica tal cual.

---

## Estructura

```
index.html               Estructura de la aplicación
styles.css               Estilos de pantalla, informe A4 e impresión
manifest.json            Manifiesto PWA
sw.js                    Service worker (caché versionada)
icon.svg                 Ícono vectorial
icons/                   Íconos PNG 192/512, maskable y apple-touch-icon
js/calc.js               Cálculos puros (compartidos con las pruebas)
js/data.js               Modelo, catálogos, migración y evaluación global
js/report.js             Generador del informe A4 paginado
js/app.js                Estado, interfaz, almacenamiento, fotos y firma
tests/calc.test.js       Pruebas unitarias del núcleo de cálculo
tests/e2e.cjs            Prueba de extremo a extremo con Chrome headless
docs/CRITERIOS.md        Fórmulas, criterios y limitaciones
docs/CAMBIOS.md          Correcciones de la versión 3 respecto a la original
```

---

## Desarrollo

Requisitos: Node.js 20 o superior y Chrome/Chromium para la prueba E2E.

```powershell
# Pruebas de cálculo (sin dependencias)
node --test tests/calc.test.js

# Prueba completa: navegador, informe, PDF, offline y móvil
npm install --no-save --ignore-scripts puppeteer-core
node tests/e2e.cjs
```

La prueba E2E usa `CHROME_PATH` si está definida; si no, busca Chrome o Chromium
en las rutas habituales. Genera `retie-informe.pdf` y capturas en la carpeta
temporal del sistema.

### Cómo actualizar

1. Edite los archivos de `js/` o `styles.css`.
2. Ejecute `node --test tests/calc.test.js` y `node tests/e2e.cjs`.
3. Suba el número de `CACHE` en `sw.js`.
4. Haga commit y push.

---

## Criterios y alcance

Las fórmulas, tablas y umbrales están documentados en
[`docs/CRITERIOS.md`](docs/CRITERIOS.md). Los valores son de **referencia** y deben
contrastarse con la edición vigente de RETIE (Resolución 90708 de 2013 y sus
modificaciones), NTC 2050 y RETILAP (Resolución 180540 de 2010). El dictamen final
es responsabilidad del técnico firmante.

---

## Licencia

Uso profesional autorizado al titular. El código no se distribuye como software
libre; consulte [`LICENSE`](LICENSE).

© 2026 Jeison Díaz · Díaz Ingeniería
