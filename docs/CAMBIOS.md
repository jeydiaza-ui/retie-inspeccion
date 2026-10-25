# Cambios de la versión 3.0.0

Reescritura de la plantilla original (`CLAUDE/`, 2026-10-09) a partir de la revisión
técnica. Cada hallazgo de la revisión quedó corregido o documentado.

## Críticos

| Hallazgo en la versión anterior | Corrección |
|---|---|
| El service worker se registraba como `sw.js` pero el archivo se llamaba `sw (1).js`: no había modo sin conexión | `sw.js` con el nombre correcto, caché versionada y estrategia *stale-while-revalidate* + respaldo de navegación |
| El PDF recortaba las tablas: solo se veían las primeras columnas y no se imprimían VA, I ni ΔV | Informe generado por JavaScript con paginación real, tablas completas y división de tablas largas |
| El dictamen salía vacío pero con la sugerencia “Aprobado con observaciones” | Campos obligatorios, firma en canvas y marca de agua **BORRADOR** si falta algo |
| Cualquier alerta valía igual: 3 fallas de aislamiento seguían dando “Aprobado con observaciones” | Veredicto por severidad; una alerta crítica impide aprobar |
| ΔV trifásico usaba factor 2 y tensión fase-neutro (duplicaba el valor) | Factor √3 y tensión entre fases; monofásico y bifásico con factor 2 |
| 208 V y 440 V aparecían como “delta” con tensión de estrella | Tabla de sistemas corregida, con V fase-neutro y V entre fases separadas |
| El PDF incluía la página de Instrucciones, un sello “Powered by Netlify” y una página en blanco | Informe con portada, resumen, secciones y anexo; sin instrucciones ni páginas vacías |

## Altos

| Hallazgo | Corrección |
|---|---|
| No se verificaba ampacidad, coordinación conductor–breaker ni tierra 250-122 | Tablas 310-16 y 250-122 aplicadas; alertas críticas |
| No se comparaba la demanda total con el breaker principal ni la Icc con el poder de corte | Verificación de demanda total y de kA contra Icc |
| La ocupación de tubería se escribía a mano | Cálculo con número de conductores, calibre, material y diámetro (53/31/40 %) |
| No se exigía diferencial por uso | Regla NTC 2050 210-8 para cocina, baño, lavandería, exterior, garaje, cochera y piscina |
| V N–T, I de neutro y temperatura se registraban pero no se evaluaban | Ahora generan alertas y tienen criterios configurables |
| Un circuito con datos incompletos podía salir “OK” | Estado **INCOMPLETO** explícito |
| El método del 62 % aceptaba 2 lecturas sin confirmar la meseta | Mínimo 2 (crítico) y recomendación de 3–5; meseta ±10 % |
| Medir continuidad con óhmetro simple no es confiable | Se documenta el método de 4 hilos / puesta a cero |
| El dictamen no se validaba y no se autocompletaba | Validación, fecha por defecto y datos del proyecto a la vista |

## Medios

| Hallazgo | Corrección |
|---|---|
| Un solo expediente por navegador, sin historial ni deshacer | Varios expedientes con selector, duplicar, eliminar y autoguardado |
| Borrar un circuito borraba sus mediciones sin avisar | Confirmación explícita cuando hay datos asociados |
| `save()` silenciaba errores de cuota | Aviso visible si no se pudo guardar |
| Importación superficial y sin migración | Validación, `normalizar()` y migración de respaldos v2 |
| Errores solo por color rojo y `title` (invisible en móvil) | Lista de alertas por sección, `aria-invalid` y texto en el informe |
| Sin fotos ni firma | Anexo fotográfico en IndexedDB y firma en canvas |
| Sin instrumentos, calibración ni condiciones ambientales | Sección 2 del informe |
| Iconos solo SVG, sin `maskable` ni `apple-touch-icon` | PNG 192/512, maskable y 180 para iOS |
| Sin repositorio, README ni licencia | Repositorio git, README, LICENSE, workflow de Pages y documentación |

## Otros

- Se eliminó el código muerto (`chartOld`) y se separó el cálculo puro para poder
  probarlo con Node.
- Se corrigió la codificación UTF-8 de los archivos (se habían guardado con doble
  codificación durante el desarrollo).
- Se agregaron pruebas: 22 unitarias del núcleo y una E2E que llena una inspección,
  genera el PDF, comprueba el modo sin conexión y la vista móvil.

## Compatibilidad

Los respaldos JSON de la versión anterior se pueden importar desde **Abrir**; la
aplicación los convierte al modelo nuevo y conserva circuitos, mediciones,
aislamiento, tierra, protecciones, canalizaciones, iluminación, hallazgos y
dictamen.
