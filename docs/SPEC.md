# Remarcá: especificación para la versión de producción

Este documento describe la app a construir. El prototipo funcional está en `prototipo/index.html` y es la referencia de comportamiento, textos y diseño: ante una duda, la respuesta es "hacé lo que hace el prototipo". El documento de negocio original está en `docs/proyecto-original.pdf`.

## 1. Qué es

Una app para celular que actualiza los precios de venta de un comercio chico (almacén, kiosco, ferretería, dietética, librería, pinturería, repuestos, farmacia chica) a partir de la lista del proveedor. El comerciante saca una foto o sube el PDF o el Excel; la IA lee productos y costos, los vincula con su catálogo, aplica su margen y le muestra solo lo que cambió. Confirma con un toque y puede deshacer.

**Acción principal en tres toques:** Nueva lista → foto → Aplicar. La revisión es opcional.

**Público:** gente no técnica, en celulares modestos y con mala conexión. Todo en español rioplatense, con lenguaje simple: costo, precio de venta, ganancia.

## 2. Qué cambia respecto del prototipo

El prototipo corre dentro de Claude y usa servicios de esa plataforma. En producción cada uno se reemplaza:

| En el prototipo | En producción |
|---|---|
| `claude.use("db")`: datos en la cuenta de Claude, en bloques JSON | Base de datos propia (Postgres) con las tablas de la sección 5 |
| `claude.use("user")`: identidad del visor | Registro con Google o mail (Supabase Auth o similar) |
| `claude.use("sample")`: la IA se cobra al usuario | Llamadas a la API de Anthropic **desde el servidor**, con la clave del negocio. Nunca desde el navegador |
| `claude.use("downloads")`: descarga confirmada | Descarga normal del navegador o compartir (Web Share) |
| `localStorage` como caché | Caché local (IndexedDB) para funcionar con mala conexión |
| Sin cobro | Suscripción con Mercado Pago (Argentina) y Stripe (otros países) |
| Sin límites de uso | Límites por plan (sección 9) y medición de costo de IA por lista |

## 3. Stack recomendado

- **Frontend:** Next.js + TypeScript, como **PWA** instalable (funciona en cualquier celular y no requiere tiendas para empezar). Más adelante se empaqueta con Capacitor para Play Store y App Store.
- **Backend y datos:** Supabase (Postgres, Auth con Google y mail, Storage para fotos y PDFs, Row Level Security por comercio).
- **IA:** API de Anthropic, del lado del servidor (route handlers o una cola de trabajos).
  - Lectura de fotos y PDFs escaneados: un modelo con visión de gama media, por ejemplo `claude-sonnet-5-5`.
  - Reconocer columnas de una planilla y confirmar coincidencias dudosas: un modelo rápido, por ejemplo `claude-haiku-5-5`.
  - Verificar modelos y precios vigentes en https://docs.claude.com antes de elegir.
- **Archivos:** SheetJS para Excel/CSV, pdf.js para extraer texto de PDFs, jsPDF (o generación en servidor) para etiquetas.
- **Pagos:** Mercado Pago Suscripciones (preapproval). Stripe Billing para otros países.
- **Procesamiento en segundo plano:** cada lista subida se procesa como un trabajo. El usuario puede salir de la pantalla y recibe un aviso cuando termina (notificación push en la PWA).

## 4. Pantallas

Navegación inferior: **Inicio · Precios · [Nueva lista] · Proveedores · Ajustes**. "Nueva lista" es el botón dominante.

1. **Bienvenida (primera vez):** nombre del comercio, margen habitual (atajos 30/35/40/50/60 %) y redondeo. Opción "Probar con datos de ejemplo".
2. **Inicio:** botón grande "Nueva lista"; alerta de productos que se venden por debajo del costo; alerta de proveedores sin lista nueva hace más de 30 días; totales (productos, proveedores, última actualización); últimas listas aplicadas, con detalle, etiquetas, Excel y deshacer.
3. **Nueva lista:**
   - Elegir proveedor (ordenados por última lista) o crear uno en el momento: nombre y si su lista incluye IVA.
   - Elegir la fuente: sacar foto (varias páginas), PDF, Excel/CSV, fotos guardadas o pegar texto (por ejemplo, un mensaje de WhatsApp).
4. **Procesando:** pasos visibles (leer productos y costos → buscarlos en el catálogo → calcular precios), barra de progreso y botón Cancelar. Si una planilla no se reconoce, se piden las columnas una vez y se recuerdan para ese proveedor.
5. **Revisá y confirmá:**
   - Resumen en una frase: "Subieron 43, bajaron 2 y hay 5 nuevos", con tres totales que filtran la lista.
   - Avisos de IVA (la lista parece con IVA y el proveedor está configurado sin IVA, o al revés).
   - Coincidencias para confirmar: "En la lista dice X. ¿Es Y?" → Sí / Elegir otro / Es nuevo / No lo vendo.
   - Secciones: cambios grandes (resaltados), subieron, bajaron, nuevos (marcar todos o ninguno, categoría para los nuevos), sin cambios (plegado) y "no los vendés" (plegado).
   - Cada renglón: precio anterior tachado, precio nuevo en etiqueta amarilla, % de variación del costo, y chips "precio ÷ 12", "precio fijo", "a pérdida", "¿cambió la presentación?", "vinculado con IA".
   - Al tocar un renglón: desglose del costo (precio de lista, ÷ unidades, + IVA, − bonificación), unidades por precio, precio manual, incluir o no, cambiar el producto vinculado, marcarlo como nuevo o como "no lo vendo".
   - Barra fija abajo: "Aplicar N".
6. **Listo:** "Actualizaste N precios", etiquetas de lo que cambió, exportar cambios a Excel, deshacer y volver al inicio.
7. **Precios:** buscador por nombre, código o categoría; filtros (a pérdida, categoría, proveedor); modo selección para etiquetas; agregar producto; exportar Excel; importar catálogo.
8. **Ficha de producto:** nombre, código, categoría (con alta de categoría en el momento), proveedor; cómo lo cobra el proveedor (unidad, bulto de N, kilo) y cómo se vende (unidad, kilo, 100 g); costo; margen propio; precio de venta (calculado o manual, con la ganancia por unidad en vivo); precio fijo; historial de costos con gráfico; etiqueta individual; eliminar con confirmación.
9. **Proveedores:** lista con IVA, bonificación, productos, renglones aprendidos y última lista. Ficha: nombre, lista con IVA sí o no, bonificación %, indicaciones para leer su lista, olvidar vinculaciones, eliminar.
10. **Importar catálogo:** vista previa de la planilla; elegir columnas (producto, código, categoría, costo, precio de venta) y proveedor; opción de recalcular precios con el margen. Productos existentes (mismo código o nombre) se actualizan.
11. **Ajustes:** nombre, margen general, IVA general, redondeo ($ 1, 10, 50, 100; hacia arriba o al más cercano), terminación (normal, 9, 90, 99), umbral de cambio grande, márgenes e IVA por categoría, recalcular precios con los márgenes actuales (deshacible), copia de seguridad, borrar datos.

## 5. Modelo de datos

```
stores            id, name, margin, iva, round_step, round_mode('up'|'near'), ending(''|'9'|'90'|'99'),
                  big_change_pct, plan, created_at
store_members     store_id, user_id, role('owner'|'employee')           -- fase 2: permisos
categories        id, store_id, name, margin NULL, iva NULL
suppliers         id, store_id, name, iva_included bool, discount_pct, ai_hint text,
                  sheet_columns jsonb NULL, last_list_at
products          id, store_id, code, name, category_id NULL, supplier_id NULL,
                  cost numeric,           -- costo por UNIDAD DE VENTA, con IVA y bonificación aplicados
                  price numeric, margin NULL, locked bool,
                  buy_type('u'|'pack'|'kg'), buy_n int, sell_unit('u'|'kg'|'100g'),
                  price_at, checked_at, updated_at
product_history   product_id, at, cost, price, batch_id NULL
supplier_links    supplier_id, item_key, product_id NULL, ignored bool   -- vinculaciones aprendidas
lists             id, store_id, supplier_id, source('foto'|'pdf'|'excel'|'texto'), files[], status,
                  ai_cost_usd, created_at
list_items        list_id, code, description, listed_price, units, product_id NULL,
                  match_type, score, state, include, price_override
batches           id, store_id, list_id NULL, kind('lista'|'recalculo'), counts jsonb,
                  prev_supplier_last_list_at, undone bool, created_at
batch_changes     batch_id, product_id, before jsonb NULL (NULL = producto creado), after jsonb
```

`item_key` = `c:<código normalizado>` si el renglón tiene código; si no, `d:<descripción normalizada>`. Ver `norm()` y `itemKey()` en `prototipo/src/core.js`.

## 6. Reglas de cálculo (portar tal cual, con tests)

Todas están en `prototipo/src/core.js`.

1. **Unidades por precio** (`packOf`): bulto de N → N; kilo vendido por 100 g → 10; en otro caso, 1.
2. **Costo por unidad de venta** (`costFromList`):
   `costo = precio_lista / unidades`; si la lista viene **sin** IVA: `× (1 + IVA_categoría_o_general / 100)`; si hay bonificación: `× (1 − bonif / 100)`. Redondeo a centavos.
3. **Margen** (`marginFor`): el del producto, si no el de la categoría, si no el general.
4. **Precio de venta** (`priceFrom` + `roundPrice`): `costo × (1 + margen / 100)`, y después:
   - terminación 9: `ceil((v + 1) / 10) × 10 − 1` (1.234,5 → 1.239; 1.300 → 1.309);
   - terminación 90: `ceil((v + 10) / 100) × 100 − 10`;
   - terminación 99: `ceil((v + 1) / 100) × 100 − 1`;
   - si no hay terminación: redondear al paso elegido, hacia arriba o al más cercano.
5. **Precio fijo:** las listas actualizan el costo pero el precio queda igual, salvo que el usuario escriba otro. El recálculo general lo saltea.
6. **A pérdida:** `precio < costo`. Se marca en Inicio, en Precios y en la revisión.
7. **Estado de un renglón:** sin cambio si costo y precio difieren menos de $ 0,005; si no, sube o baja según el costo. "Cambio grande": |variación del costo| ≥ umbral (20 % por defecto). "¿Cambió la presentación?": variación mayor a +150 % o menor a −60 %.
8. **Números en formato argentino** (`parseNum`): "1.234,56" → 1234.56; "12.500" → 12500; "1,5" → 1.5; "$ 10.400,00" → 10400.

## 7. Vinculación con el catálogo

Orden (ver `matchItems` y `candidates` en `core.js`):

1. **Memoria del proveedor:** si `item_key` ya está vinculado, se usa ese producto. Si está marcado como "no lo vendo", se oculta.
2. **Código:** mismo código normalizado y mismo proveedor (o producto sin proveedor).
3. **Parecido de nombre:** normalización de unidades (1KG = 1 kg = 1000 g; 1.5LT = 1,5 l; 500GR = 500 g), sin acentos ni palabras vacías. El puntaje combina 55 % coincidencia de palabras y 45 % de trigramas, con estas penalizaciones:
   - ×0,45 si los dos tienen tamaño y no coincide (500 g contra 1 kg);
   - ×0,7 por cada palabra distintiva del renglón (presente en 1 a 3 productos del catálogo) que el candidato no tiene;
   - ×0,6 extra si además el candidato tiene una palabra distintiva propia (otra marca).
   - Un índice invertido por palabra evita comparar contra todo el catálogo.
4. **Umbrales:** ≥ 0,97 exacto; ≥ 0,84 con 0,06 de ventaja sobre el segundo, vinculado automáticamente; ≥ 0,42 dudoso; menos, producto nuevo.
5. **Dudosos:** se mandan a la IA de a 25, con hasta 5 candidatos cada uno. La IA responde el id o null. Lo que no se resuelve se le pregunta al usuario.
6. **Al aplicar,** cada renglón confirmado se guarda en `supplier_links`. Los nuevos que no se agregan quedan como "no lo vendo".

Para producción conviene sumar búsqueda con `pg_trgm` y, más adelante, embeddings para catálogos grandes.

## 8. IA: prompts y salida

Los prompts del prototipo están en `extractPrompt`, `aiDetectCols` y `aiResolveDoubts` (`core.js`). Mantener:

- **Salida JSON compacta:** `{"iva": "...", "columna": "...", "items": [["código", "descripción", 1234.56, unidades]]}`.
- **Reglas:** formato argentino; preferir precio unitario y sin IVA; incluir presentación en la descripción; ignorar encabezados y totales; no inventar.
- **Indicación por proveedor (`ai_hint`):** se aprende de la columna usada la primera vez y se puede editar.
- **Planillas:** la IA solo identifica columnas mirando las primeras 25 filas. El resto se procesa en código: es más barato y no se trunca.
- **PDF con texto:** se extrae el texto con pdf.js, se reconstruyen los renglones por posición y se manda en partes de unas 140 líneas.
- **PDF escaneado:** se rasteriza (hasta 10 páginas) y va por visión.
- **Fotos:** se reducen a 2000 px de lado, JPEG 85 %, una página por llamada.
- **Fallas:** si una parte falla, se usa la lectura sin IA para esa parte y se avisa en la revisión.

En producción, además:

- Validar el JSON con un esquema (zod) y reintentar una vez si no parsea.
- Usar *structured outputs* o *tool use* de la API para forzar el formato.
- Guardar `ai_cost_usd` por lista (tokens de entrada y salida) para controlar el costo por cliente.
- Usar *prompt caching* para la parte fija del prompt.

## 9. Planes y límites

| Plan | Incluye | Precio orientativo |
|---|---|---|
| Gratis | 2 proveedores, 4 listas por mes | USD 0 |
| Básico | Proveedores y listas ilimitadas (uso justo), etiquetas, exportación | USD 8–15 / mes |
| Avanzado | Varios usuarios, comparación de proveedores, alertas, historial completo, integraciones | USD 20–35 / mes |

Se cobra en pesos con Mercado Pago. Referidos: un mes gratis por comercio invitado.

## 10. Etiquetas y exportación

- **Etiquetas en PDF A4** en tres tamaños: chicas (4×10), medianas (3×8) y grandes (2×5). Cada una lleva nombre (2 líneas), unidad si corresponde ("por kg", "x 100 g"), precio grande, fecha, comercio (opcional) y código.
- **Excel de precios:** código, producto, categoría, proveedor, se vende por, costo, margen %, precio, fecha.
- **Excel de cambios de una lista:** costo y precio anteriores y nuevos, variación %.

## 11. Fases de construcción

1. **Base:** auth, comercio, categorías, proveedores, productos, importar Excel, ficha de producto, ajustes. Tests de las reglas de la sección 6.
2. **Corazón:** subir lista → trabajo en segundo plano → extracción con IA → vinculación → revisión → aplicar y deshacer. Tests de vinculación con listas reales anonimizadas.
3. **Salida:** etiquetas PDF, exportación Excel, historial.
4. **Negocio:** planes, Mercado Pago, límites, medición de costo de IA, panel interno con las métricas del documento (listas por comercio, % vinculado sin intervención, tiempo hasta aplicar, conversión, retención).
5. **Después** (solo con clientes pagando): comparar proveedores, alertas de aumentos anormales, recibir listas por WhatsApp o mail, varios usuarios con permisos, lector de código de barras, integración con cajas y tiendas online, portal de proveedores.

## 12. Criterios de aceptación clave

- Con la lista de ejemplo del prototipo (`DEMO_LIST` en `ui3.js`) y el catálogo de ejemplo (`seedDemo`):
  - al confirmar la duda del dulce de leche: subieron 14, bajó 1 (aceite) y 1 sin cambio (arroz);
  - "DDL SERENISIMA CLASICO 400G" queda como duda con sugerencia "Dulce de leche La Serenísima 400 g";
  - "YERBA PLAYADITO 500GR" sale como nuevo y no se confunde con 1 kg ni con Taragüí 500 g;
  - el alfajor (caja x 6) da costo $ 847 por unidad: 4.200 / 6 × 1,21.
- Deshacer la última lista deja costos, precios, historial y fecha de última lista exactamente como estaban.
- Ninguna pantalla scrollea en horizontal a 360 px de ancho, y todo se lee en modo claro y oscuro.
- Una lista de 300 renglones en PDF con texto se procesa en menos de 90 segundos.
