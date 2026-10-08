# Remarcá

App para celular que actualiza los precios de venta de comercios chicos a partir de la lista del proveedor (foto, PDF, Excel o texto), con IA para leer y vincular productos.

## Antes de empezar cualquier tarea

1. Leé `docs/SPEC.md`: es la especificación completa (pantallas, modelo de datos, fórmulas, vinculación, prompts, fases).
2. El prototipo funcional en `prototipo/index.html` es la referencia de comportamiento, textos y diseño. Para verlo, abrilo en un navegador y tocá "Probar con datos de ejemplo". El código está separado en `prototipo/src/`:
   - `core.js`: guardado, fórmulas de precio, normalización y vinculación, lectura de archivos y prompts de IA;
   - `ui.js`, `ui2.js`, `ui3.js`: pantallas, revisión, etiquetas, exportación, acciones y datos de ejemplo;
   - `head.html`: estilos y tokens de diseño.
3. Las funciones de `core.js` que calculan precios y vinculan productos (`parseNum`, `norm`, `prep`, `sim`, `candidates`, `matchItems`, `packOf`, `costFromList`, `roundPrice`, `marginFor`) se portan **con el mismo comportamiento** a TypeScript y con tests unitarios. Los casos de la sección 12 de la especificación son tests obligatorios.

## Convenciones

- Toda la interfaz en español rioplatense ("tocá", "subí", "revisá"), con palabras simples: costo, precio de venta, ganancia. Nada de jerga técnica para el usuario.
- Montos en pesos con formato `es-AR` ($ 1.234,56). Precios de venta sin decimales si hay redondeo.
- Mobile first: tiene que funcionar a 360 px de ancho, en celulares modestos y con mala conexión. Modo claro y oscuro.
- Diseño inspirado en los carteles de oferta de almacén, en versión prolija: azul índigo, fucsia y amarillo como colores principales, celeste, lima y naranja en tonos suaves; estrellas de oferta en puntos clave (botón Nueva lista, resumen, pantalla final), bordes finos con sombra corta, precios en etiqueta amarilla. Sin inclinaciones ni animaciones constantes. Tipografías Archivo Black (títulos), Barlow (texto) y Barlow Condensed (precios). Tokens y componentes en `prototipo/src/head.html`; confeti al aplicar una lista.
- La clave de la API de Anthropic vive solo en el servidor. El navegador nunca llama directo a la IA.
- Toda acción que cambia precios en lote tiene que poder deshacerse.
- No construir funciones de la fase 5 sin que lo pida el dueño del proyecto.

## Stack

Next.js + TypeScript (PWA), Supabase (Postgres, Auth, Storage, RLS por comercio), API de Anthropic del lado del servidor, Mercado Pago para suscripciones. Si se propone otro stack, explicar por qué antes de cambiarlo.
