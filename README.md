# Remarcá

App para celular que actualiza los precios de venta de comercios chicos a partir de la lista del proveedor (foto, PDF, Excel o texto), con IA para leer y vincular productos.

- Especificación: [`docs/SPEC.md`](docs/SPEC.md) · Instrucciones para Claude Code: [`CLAUDE.md`](CLAUDE.md)
- Prototipo de referencia: [`prototipo/index.html`](prototipo/index.html)

## Cómo correrla

```bash
npm install
cp .env.example .env.local   # poné tu ANTHROPIC_API_KEY (opcional)
npm run dev                  # http://localhost:3000
```

Sin `ANTHROPIC_API_KEY` la app funciona igual: lee Excel, PDF con texto y texto pegado sin IA (con menos precisión). Las fotos y los PDF escaneados necesitan la IA.

```bash
npm test          # reglas de cálculo y vinculación (incluye los criterios de la sección 12)
npm run typecheck
npm run build
```

## Qué hay

| Parte | Dónde |
|---|---|
| Reglas de precio (`parseNum`, `packOf`, `costFromList`, `marginFor`, `roundPrice`…) | `src/lib/core/pricing.ts`, `format.ts` |
| Vinculación (`norm`, `prep`, `sim`, `candidates`, `matchItems`) | `src/lib/core/match.ts` |
| Lectura sin IA (planillas y texto) | `src/lib/core/listread.ts` |
| Revisión, aplicar, deshacer, recalcular, importar | `src/lib/core/review.ts` |
| IA del lado del servidor (la clave nunca llega al navegador) | `src/app/api/ai/*`, `src/lib/ai/` |
| Guardado local (IndexedDB, funciona sin conexión), archivos, Excel, etiquetas PDF | `src/lib/client/` |
| Pantallas | `src/components/` |
| Esquema de base de datos con RLS por comercio | `supabase/migrations/0001_init.sql` |

### IA

- Fotos y PDFs escaneados: `claude-sonnet-5-5` (visión). Columnas de planillas y coincidencias dudosas: `claude-haiku-5-5`. Se cambian con `REMARCA_MODEL_VISION` / `REMARCA_MODEL_QUICK`.
- Salida validada con un esquema (zod + *structured outputs*), un reintento si no se puede interpretar, *prompt caching* en la parte fija del prompt.
- Cada lista guarda tokens y costo estimado en USD (`batch.ai`).

## Estado

Funciona hoy, guardando en el dispositivo: bienvenida y datos de ejemplo, inicio con alertas, nueva lista (foto, PDF, Excel/CSV, texto), procesamiento con cancelar, revisión completa (dudas, IVA, cambios grandes, nuevos, precio a mano, unidades), aplicar y deshacer, etiquetas PDF, Excel de precios y de cambios, precios con buscador y filtros, ficha de producto con historial, proveedores, importar catálogo, ajustes, copia de seguridad. PWA instalable, modo claro y oscuro, 360 px sin scroll horizontal.

Pendiente:

- **Cuentas y nube (Supabase):** registro con Google/mail y sincronización con las tablas de `supabase/migrations`. Hasta entonces, las rutas `/api/ai/*` no tienen login: antes de publicar, protegerlas (auth o límite por IP) para que nadie gaste la clave.
- Procesamiento en segundo plano con aviso push (hoy la lectura corre con la pantalla abierta).
- Fase 4: planes, Mercado Pago, límites y panel interno.
- La librería `xlsx` de npm (0.18.5) tiene avisos de seguridad conocidos; conviene pasar a la versión del CDN de SheetJS (0.20.x) cuando se pueda descargar en el entorno de build.
