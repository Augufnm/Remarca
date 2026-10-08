# Remarcá: paquete para continuar en Claude Code

## Qué hay acá

- `CLAUDE.md`: instrucciones que Claude Code lee solo al abrir el proyecto.
- `docs/SPEC.md`: especificación completa de la app de producción.
- `docs/proyecto-original.pdf`: tu documento de la idea.
- `prototipo/`: la app que funciona hoy, como referencia (abrí `prototipo/index.html` en el navegador).

## Cómo seguir en Claude Code

1. Creá un repositorio en GitHub (por ejemplo, `remarca`) y subí todo el contenido de esta carpeta.
2. Abrí Claude Code con ese repositorio.
3. Pedile, por ejemplo:

   > Leé CLAUDE.md y docs/SPEC.md. Armá el proyecto con el stack indicado y construí la fase 1. Empezá por las reglas de cálculo con sus tests.

4. Avanzá de a una fase por vez (la sección 11 de la especificación las ordena), probando cada una antes de seguir.

## Cuentas que vas a necesitar

- **Supabase:** base de datos, registro de usuarios y archivos. Tiene plan gratuito para empezar.
- **Anthropic API:** la IA que lee las listas. Se paga por uso; cargá crédito en console.anthropic.com.
- **Vercel** (o similar): para publicar la app. Tiene plan gratuito.
- **Mercado Pago Developers:** para cobrar la suscripción (fase 4).
