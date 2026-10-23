# FASE 7 | UX/UI de fiabilidad

Fecha de cierre: `2026-04-05`

## Objetivo

Reducir fricción operativa en el frontend y mejorar la presentación del contenido generado para que la app deje de sorprender con cambios automáticos, texto crudo, popups del navegador o estados poco claros.

## Entregado

- `Authentik` activado en runtime como SSO único de `miapp`:
  - proveedor OIDC `EDUMind MiApp` creado en `auth.edumind.es`
  - grupos de aplicación `edumind-admin` y `edumind-teacher-premium`
  - backend real en `AUTH_MODE=authentik`
  - login local desactivado en producción
- selector de motor sin cambios silenciosos:
  - se mantiene fallback solo si el motor actual queda inválido
  - la recomendación operativa se presenta como sugerencia explícita
- visualización de contenido mejorada:
  - nuevo renderizado estructurado para respuestas y salidas generadas
  - limpieza de artefactos `[Sistema]: ...`
  - supresión de fences markdown cuando solo envolvían texto
  - mejor lectura de títulos, listas, párrafos y bloques de código
- generadores con UX más fiable:
  - vista previa legible por defecto
  - modo edición separado
  - confirmación integrada antes de contribuir al dataset
  - avisos inline para exportación y contribución
- chat mejorado:
  - respuestas del asistente renderizadas con formato legible
  - conversación local WebGPU enviada como historial, no solo último prompt
  - `ObjectURL` revocado tras exportar
- flujos sin `alert/confirm` del navegador:
  - generadores
  - `DatasetBuilder`
  - `AdminUsers`
  - `TrainingPipeline`
  - `ClassManager`
  - `ClassDetail`
  - `WeeklyPlanner`
- fiabilidad operativa adicional:
  - abort de generación garantizado al desmontar componente
  - impresión de listados de alumnado saneada para evitar HTML visible o inyección accidental
  - copy obsoleto de loading actualizado y alineado con el stack real

## Verificación

- `scripts/phase7_verify.sh`
- `npm run lint`
- `npm run build`
- `GET /api/v1/auth/config` en modo `authentik`
- `GET /api/v1/auth/sso/login?next=/admin` redirigiendo a `auth.edumind.es`
- búsqueda sin restos de `alert(` ni `confirm(` en `frontend/src`

## Riesgos abiertos

- el chunk `webllm` sigue siendo muy grande y mantiene impacto en primera carga local
- el renderizado estructurado es intencionalmente ligero; no pretende ser un parser Markdown completo
