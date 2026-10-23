# Sistema de Contribución para Mejora del Modelo EDUmind Local

## Visión General

El modelo WebLLM (Llama-3.2-1B) ejecutado localmente es un modelo base que puede mejorarse mediante:
1. **Contribuciones de usuarios** → Datos de entrenamiento
2. **Fine-tuning periódico** → Modelo EDUmind especializado

---

## Flujo de Mejora Continua

```
Usuario genera contenido → Revisa/Edita → Contribuye → Dataset crece
                                                           ↓
                                           Fine-tuning mensual
                                                           ↓
                                           Nuevo modelo publicado
```

---

## Estrategia Técnica

### 1. Recolección de Datos (Ya implementado)

El botón "👍 Contribuir" en `GeneratorLayout.tsx` permite a usuarios aportar:
- **Prompt original**: Lo que solicitaron
- **Output editado**: La versión corregida/mejorada por el usuario

Estos datos se almacenan en la tabla `TrainingItem` del backend.

### 2. Formato de Dataset

Los datos se exportan en formato JSONL para fine-tuning:

```jsonl
{"instruction": "Genera planificación para 3º ESO...", "output": "1. DATOS IDENTIFICATIVOS..."}
{"instruction": "Situación de aprendizaje sobre...", "output": "TÍTULO: ..."}
```

### 3. Opciones de Fine-tuning

| Opción | Ventajas | Consideraciones |
|--------|----------|-----------------|
| **LoRA local** | Control total, sin costes | Requiere GPU potente |
| **Unsloth** | Rápido, eficiente memoria | Requiere Colab Pro |
| **OpenPipe** | SaaS, fácil de usar | Coste por entrenamiento |
| **Predibase** | LoRA as a service | Coste mensual |

### 4. Distribución del Modelo Mejorado

Una vez fine-tuneado, el modelo puede publicarse en:
- **HuggingFace Hub** → Descarga directa
- **WebLLM format** → Conversión a MLC para navegador

---

## Implementación Sugerida

### Fase 1: Mejorar Contribución (Actual)
- [x] Botón contribuir existente
- [ ] Modal de confirmación con preview
- [ ] Opción de editar antes de contribuir
- [ ] Anonimización automática

### Fase 2: Dashboard de Dataset
- [ ] Vista de contribuciones en Admin
- [ ] Revisión manual de calidad
- [ ] Exportación JSONL
- [ ] Métricas de contribución

### Fase 3: Pipeline de Fine-tuning
- [ ] Script de entrenamiento LoRA
- [ ] Automatización mensual
- [ ] Validación de calidad
- [ ] Publicación automática

### Fase 4: Actualización del Modelo Cliente
- [ ] Detección de nueva versión
- [ ] Descarga incremental
- [ ] Caché inteligente

---

## Consideraciones RGPD

1. **Consentimiento explícito**: El usuario debe aceptar contribuir
2. **Anonimización**: Eliminar datos personales automáticamente
3. **Derecho al olvido**: Poder eliminar contribuciones
4. **Transparencia**: Informar del uso de los datos

---

## Modelo Recomendado de Partida

Para WebLLM, modelos compatibles y eficientes:

| Modelo | Parámetros | Tamaño | Calidad |
|--------|------------|--------|---------|
| Llama-3.2-1B | 1B | ~600MB | Básica |
| Llama-3.2-3B | 3B | ~1.8GB | Mejor |
| Phi-3-mini | 3.8B | ~2GB | Excelente |
| Qwen2.5-3B | 3B | ~1.8GB | Muy buena |

**Recomendación**: Empezar con Llama-3.2-1B y migrar a 3B cuando el dataset tenga >1000 ejemplos de calidad.
