# 🍲 Profit Cocina — plataforma colaborativa de producción y cocina (Albion Online)

Un grupo de amigos produce recursos distintos (pan, ternera, calabaza…), se los
compra entre sí a costo y cada uno cocina y vende sus guisos. **La plataforma no
impone un modelo de precios: registra lo que pasa de verdad y compara modelos
con datos reales**, para medir si el acuerdo es justo para todos.

> Filosofía: **primero datos reales, después decisiones.**

Es un proyecto **nuevo e independiente** de la calculadora Caerleon Profit; esa
no se toca.

---

## Qué resuelve

1. Registrar producción, compras entre miembros, cocina y ventas, con la carga
   más rápida posible (pensado para el celular).
2. Calcular el **costo real por unidad** de cada recurso, arrastrado por toda la
   cadena de procesos.
3. Medir la **justicia del acuerdo**: cuánto gana cada uno con el acuerdo contra
   cuánto ganaría vendiendo solo en el mercado.
4. **Comparar modelos de precio** (costo, costo+%, precio amigo, compensación,
   pozo común) sobre los mismos datos.
5. Planificar qué comidas conviene cocinar con los costos reales del grupo.

---

## Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Base de datos + Auth + Realtime | **Supabase (Postgres)** | `numeric` = decimal exacto para silver; RLS para la transparencia por grupo; Realtime para colaboración; `pg_cron` para el job de precios. |
| Motor de costos / Kardex | **TypeScript puro** ejecutado en **Edge Functions** dentro de una transacción | Lógica contable testeable (Tests A–D), recálculo atómico al editar lotes viejos, mismo lenguaje que el front. |
| Frontend | **SvelteKit (`adapter-static`) + TypeScript + Tailwind** | App de ~9 pantallas con formularios y tablas; se aloja gratis en **GitHub Pages**. |
| Catálogo del juego | Script `import:items` sobre **ao-bin-dumps** | Fuente oficial, re-ejecutable cuando el juego actualice. |
| Precios de mercado | **Albion Online Data Project** (API) + `pg_cron` | Por servidor y ciudad; guardamos la fecha y avisamos si el precio es viejo. |
| Pruebas | **Vitest** (motor), Supabase local/Docker (RLS e integración), Playwright (e2e, fase posterior) | El Test D es el *gate* del MVP. |

### Idea central — event sourcing contable

```
Registros de dominio        →   Movimientos de Kardex       →   Saldos
(proceso, compra, venta,        (inmutables, con el saldo        (cantidad,
 ajuste) = fuente de verdad      resultante en cada fila)         promedio, valor)
                              ↑
                    runEngine() en TypeScript, dentro de una
                    transacción, al crear / editar / borrar
```

Editar un lote de hace tres días recalcula hacia adelante toda la cadena. La
correctitud vive en **un solo lugar**: `src/lib/core`.

### El Kardex (promedio ponderado móvil)

- Una **entrada** suma cantidad y valor; el nuevo promedio = `valor / cantidad`.
- Una **salida** se valoriza al promedio vigente, así el promedio no cambia.
- El **valor total** es la fuente de verdad; el costo promedio se deriva siempre
  (`value / qty`) para no arrastrar redondeos por la cadena.
- No se permite **stock negativo**: un registro que lo produciría queda marcado
  como error y pide un ajuste.

---

## Estructura del repo

```
src/lib/core/        Motor de costos puro (sin DOM ni DB) — el corazón del sistema
  types.ts           Tipos de eventos, movimientos y saldos
  money.ts           Redondeo para mostrar (el motor guarda precisión completa)
  engine.ts          runEngine(): reducer de eventos → movimientos + saldos
  index.ts           Reexportes
tests/
  kardex.test.ts     Test D (cadena de pan, promedio ponderado, subproducto, ajuste)
supabase/            Esquema SQL + Edge Functions (próximo paso)
scripts/             import:items y utilidades (próximo paso)
```

---

## Desarrollo

Requisitos: **Node.js** y **npm**.

```bash
npm install          # dependencias de desarrollo
npm test             # corre las pruebas del motor (Vitest)
npm run test:watch   # en modo watch
npm run typecheck    # TypeScript estricto, sin emitir
```

---

## Estado y hoja de ruta

- [x] **Fase 0 — Cimientos (en curso)**:
  - [x] Repo, motor de costos puro, Test D verde, typecheck limpio.
  - [x] Esquema SQL con RLS validado en Supabase local (grupos, invitaciones, catálogo, procesos, Kardex, auditoría); aislamiento entre usuarios probado.
  - [ ] Edge Functions base (registrar proceso/compra/ajuste + recompute del Kardex).
  - [ ] App SvelteKit (`adapter-static`) con login y pantalla *Registrar*.
- [ ] **Fase 1 — MVP (recolección de datos)**: catálogo importado, proceso genérico por lotes, Kardex, subproductos, ajustes/conteo, compras entre miembros, ventas, snapshots de precios manuales, import/export CSV. *Gate: Test D en integración.*
- [ ] **Fase 2 — Análisis**: métricas de justicia, comparador de modelos, liquidaciones. *Gate: Tests A, B, C.*
- [ ] **Fase 3 — Precios automáticos** (API + catálogo completo con encantamientos).
- [ ] **Fase 4 — Planificador** (ranking, sensibilidad).
- [ ] **Fase 5 — Pulido** (gráficos, notificaciones, PWA).
