# Matrices curriculares LOMLOE en MiApp

MiApp incorpora las matrices curriculares iDoceo publicadas en `edumind_content/idoceo_matrices`
(todas las comunidades, Infantil, Primaria y Secundaria) como base de conocimiento para los
generadores: planes de refuerzo, situaciones de aprendizaje, programaciones, etc.

## Flujo de datos

1. **Fuente**: carpetas publicadas por territorio en `/var/www/edumind_content/idoceo_matrices/`
   (formato iDoceo de 8 columnas, jerarquía Tipo 0–4). Se ignoran `CURRICULOS_NUEVOS`,
   herramientas y pruebas.
2. **Importación**: `backend/scripts/importar_matrices_idoceo.py` genera el índice comprimido
   `backend/curriculo/matrices_idoceo.json.gz` (unos 4 MB, versionado en git). Es idempotente:
   vuelve a ejecutarlo cada vez que actualices las matrices publicadas.

   ```bash
   cd backend && .venv/bin/python scripts/importar_matrices_idoceo.py
   ```

   Opciones: `--source RUTA`, `--output RUTA`, `--dry-run`.
3. **Servicio**: `app/services/curriculum_matrix_service.py` carga el índice en memoria la primera
   vez que se usa (medio segundo). Ruta configurable con `CURRICULUM_INDEX_PATH`.

## Estructura de una matriz

Identificador: `comunidad/etapa/area/nivel` (p. ej. `galicia/primaria/educacion-fisica/5o`).

| Campo | Contenido |
|---|---|
| `competencias_clave` | Tipo 0 (perfil de salida, compartido entre matrices) |
| `descriptores` | Tipo 1, descriptores operativos con enlace a su competencia clave |
| `competencias_especificas` | Tipo 2 (en Galicia aparecen como objetivos `OBJn`) |
| `criterios` | Tipo 3, con `enlaces` a la competencia específica y `peso` |
| `bloques` / `saberes` | Tipo 4: cabeceras de bloque `Bn` y saberes `Bn.m` con enlaces a criterios |
| `revisar` | `true` si el archivo está marcado `[REVISAR]` o el curso está sin concretar |
| `idioma` | `es`, `gl`, `ca` o `va` |

## API (`/api/v1/curriculum`, pública)

| Ruta | Uso |
|---|---|
| `GET /status` | Estado del índice (matrices, criterios, saberes, errores) |
| `GET /catalogo` | Árbol comunidad → etapa → área → niveles con el `id` de cada matriz |
| `GET /matrices?comunidad=&etapa=&area=&incluir_revisar=` | Listado resumido |
| `GET /matrices/{id}` | Matriz completa |
| `GET /buscar?q=&comunidad=&etapa=&area=&tipo=&limit=` | Búsqueda de texto en competencias, criterios y saberes |
| `POST /contexto` | Bloque de texto con los elementos seleccionados, listo para un prompt |

Cliente frontend: `frontend/src/lib/curriculum-service.ts`.

## Uso desde los generadores

Los generadores con `ContextualFieldsMixin` (programación, situación de aprendizaje, sesión,
STEAM, ficha, metodología, organización) y el plan de refuerzo aceptan el campo opcional:

```json
"matriz_curricular": {
  "id": "galicia/primaria/educacion-fisica/5o",
  "competencias": ["OBJ1"],
  "criterios": ["CE1.1", "CE1.2"],
  "saberes": ["B1.1", "B1.2"]
}
```

El backend (`CurriculumMatrixService.enrich_generator_payload`) vuelca los criterios y saberes
seleccionados en `criterios_evaluacion`, `contenidos` o `contenidos_refuerzo`, y añade al prompt
el bloque `MARCO CURRICULAR OFICIAL` con los textos literales de la norma. Si no se indican
códigos, se incluye la matriz completa (recortada a 7.000 caracteres).

## Calidad de los datos

El informe `idoceo_matrices/INFORME_GLOBAL_matrices.md` recoge los archivos con contenido
pendiente de revisión manual (celdas contaminadas, pies de boletín, descriptores ausentes).
El importador avisa de las matrices sin criterios o sin saberes; esas matrices se cargan igual
pero conviene tratarlas como provisionales.
