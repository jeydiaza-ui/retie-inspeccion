# Criterios de cálculo y verificación

Este documento explica qué calcula la aplicación, con qué supuestos y dónde están
los límites. Los valores son de **referencia** y deben contrastarse con la edición
vigente de RETIE (Resolución 90708 de 2013 y modificaciones), NTC 2050 y RETILAP
(Resolución 180540 de 2010).

## 1. Sistemas eléctricos

| Sistema | V fase-neutro | V entre fases | Neutro |
|---|---:|---:|---|
| 110 V monofásico | 110 | — | Sí |
| 120 V monofásico | 120 | — | Sí |
| 127 V monofásico | 127 | — | Sí |
| 120/240 V monofásico 3 hilos | 120 | 240 | Sí |
| 208Y/120 V trifásico 4 hilos | 120 | 208 | Sí |
| 220Y/127 V trifásico 4 hilos | 127 | 220 | Sí |
| 240 V trifásico delta 3 hilos | — | 240 | No |
| 380Y/220 V trifásico 4 hilos | 220 | 380 | Sí |
| 440Y/254 V trifásico 4 hilos | 254 | 440 | Sí |
| 480Y/277 V trifásico 4 hilos | 277 | 480 | Sí |

La tensión del circuito depende del número de polos: monofásico usa fase-neutro;
bifásico y trifásico usan la tensión entre fases.

## 2. Demanda y corriente

```
VA = W × FD ÷ FP
I  = VA ÷ V                     (monofásico; bifásico entre fases)
I  = VA ÷ (√3 × V_LL)           (trifásico equilibrado)
```

- **FD** (factor de demanda) se acota entre 0,1 y 1; si se deja vacío se usa 1.
- **FP** por defecto es 0,9 y puede cambiarse por circuito o en los criterios.
- El cálculo supone carga equilibrada entre fases. Una carga concentrada en una
  fase de un sistema bifásico o trifásico puede tener más corriente que la estimada.

## 3. Caída de tensión

```
Monofásico y bifásico:  ΔV% = 2 × ρ × L × I ÷ (S × V) × 100
Trifásico:              ΔV% = √3 × ρ × L × I ÷ (S × V_LL) × 100
```

- `ρ = 0,0172 Ω·mm²/m` (cobre a 20 °C).
- `L` en metros, `S` en mm², `I` en amperios, `V` en voltios.
- Límite de referencia: **3 %** en ramal (NTC 2050 210-19); configurable.
- A 5 % o más se marca alerta crítica; entre 3 % y 5 %, alerta alta.

La versión anterior usaba el factor 2 y la tensión fase-neutro también en
trifásico, lo que duplicaba la caída calculada.

## 4. Conductores y protecciones

- Ampacidad de referencia (NTC 2050 tabla 310-16, cobre, THHN/THW/THWN-2), a
  60/75/90 °C:

| AWG | mm² | 60 °C | 75 °C | 90 °C |
|---|---:|---:|---:|---:|
| 14 | 2,08 | 15 | 20 | 25 |
| 12 | 3,31 | 20 | 25 | 30 |
| 10 | 5,26 | 30 | 35 | 40 |
| 8 | 8,37 | 40 | 50 | 55 |
| 6 | 13,3 | 55 | 65 | 75 |
| 4 | 21,15 | 70 | 85 | 95 |
| 2 | 33,62 | 95 | 115 | 130 |
| 1/0 | 53,5 | 125 | 150 | 170 |

- Se aplica un factor de derrateo configurable (agrupamiento y temperatura). El
  valor por defecto es 1: la app **no** calcula correcciones por temperatura
  ambiente ni por número de conductores en la tubería.
- Verificaciones: `I ≤ breaker`; en carga continua `I ≤ 0,8 × breaker`; y
  `breaker ≤ ampacidad` (esta última es crítica).

### Conductor de tierra (NTC 2050 tabla 250-122)

| Breaker | Tierra mínima |
|---:|---|
| ≤ 15 A | 14 AWG |
| 20 A | 12 AWG |
| 30–60 A | 10 AWG |
| 100 A | 8 AWG |
| 200 A | 6 AWG |
| 300 A | 4 AWG |
| 400 A | 3 AWG |
| 500 A | 2 AWG |
| 600 A | 1/0 |
| 800 A | 2/0 |
| 1000 A | 3/0 |
| 1200 A | 4/0 |

Se compara con el conductor de tierra registrado en la sección 6. Si el calibre es
menor al requerido, se marca alerta crítica.

## 5. Ocupación de tubería

Áreas interiores (capítulo 9, tabla 4) y áreas de conductor con aislamiento
(tabla 5), en in². Límite de llenado: **53 %** para 1 conductor, **31 %** para 2 y
**40 %** para 3 o más. Si no se registran número de conductores, calibre y
diámetro, se usa el porcentaje escrito a mano.

## 6. Aislamiento

- Mínimo configurable, por defecto **1 MΩ**, tanto a 30 s como a 1 min.
- Puntos automáticos: fase–tierra y fase–neutro por cada fase, más neutro–tierra.
- En sistemas delta sin neutro solo se prueban los puntos fase–tierra.
- El valor de 1 MΩ es un **mínimo de aceptación**; en instalaciones nuevas son
  esperables valores muy superiores (decenas o cientos de MΩ).
- Antes de meggear se deben desconectar cargas, electrónica y supresores.

## 7. Puesta a tierra

Método del 62 % (caída de potencial):

1. Se registran pares distancia E–P / lectura.
2. Se interpola linealmente la lectura a `0,62 × E–C`.
3. Se compara la meseta a ±1 m del 62 %: debe estar dentro de ±10 % del valor
   central.
4. Se exigen lecturas antes y después del 62 %; con solo 2 puntos se emite una
   alerta media porque no se confirma la meseta.

La lectura de pinza se usa cuando el método es “Pinza de tierra”. La continuidad
del conductor de tierra se compara con 1 Ω (configurable); para medirla se
recomienda método de 4 hilos o poner a cero las puntas.

El máximo de resistencia de tierra es configurable (25 Ω por defecto) y es un
**valor de referencia**: RETIE no fija un número único para toda instalación.

## 8. Mediciones

- Tensión fase-neutro dentro de **±5 %** de la tensión fase-neutro del sistema.
- Frecuencia **60 Hz ±1 %**.
- FP mínimo 0,9 (criterio de facturación, no de seguridad).
- Tensión N–T máxima 5 V (configurable).
- Corriente de neutro mayor que la de fase: alerta media.
- Temperatura máxima 60 °C (configurable).
- Desbalance de tensión y corriente: 20 % (configurable).

## 9. Protecciones y diferencial

- Poder de corte de cada breaker y del principal debe ser **≥ Icc** en el punto.
- Diferencial: sensibilidad ≤ 30 mA y tiempo ≤ 300 ms.
- Usos que exigen diferencial de 30 mA (NTC 2050 210-8): cocina, baño,
  lavandería, exterior, garaje, cochera y piscina.

## 10. Iluminación

- Eficacia = flujo ÷ potencia (lm/W).
- Densidad = potencia total ÷ superficie (W/m²).
- Cumple si el lux medido ≥ lux mínimo RETILAP del ambiente. La tabla de mínimos
  **no** está incluida: el usuario debe consultar el valor vigente para cada uso.

## 11. Veredicto

| Situación | Concepto sugerido |
|---|---|
| Falta información obligatoria o no hay circuitos | Incompleto |
| Alguna alerta crítica | No aprobado |
| Alertas altas o medias | Aprobado con observaciones |
| Sin alertas y datos completos | Aprobado |

El dictamen final lo decide el técnico. Si el concepto registrado es “Aprobado”
cuando la sugerencia es “No aprobado”, el informe lo advierte y deja constancia de
que la decisión es del firmante.

## 12. Limitaciones

- No calcula cortocircuito: la Icc se ingresa manualmente.
- No calcula coordinación selectiva, curva tiempo-corriente ni arranque de motores.
- No aplica factores de temperatura ni agrupamiento salvo el factor global.
- No verifica requisitos de RETILAP distintos de la iluminancia (por ejemplo,
  densidad de potencia o eficacia mínima de luminarias).
- No valida la geometría de la instalación (alturas, distancias de seguridad,
  soportes, barreras).
- Las fotos no se incluyen en el respaldo JSON.
- La firma es un trazo digital, no una firma electrónica certificada.
- No sustituye la inspección ni la certificación de un organismo acreditado.
