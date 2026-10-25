#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

from typing import Dict, Any

# Contexto del Ecosistema EDUmind
ECOSYSTEM_CONTEXT = """
REGLAS ESTRICTAS DE RESPUESTA:
1. NO INVENTES INFORMACIÓN: usa exclusivamente los datos proporcionados; si falta algo crítico, dilo en una línea.
2. RIGOR: tono técnico-pedagógico propio del sistema educativo español (LOMLOE); terminología curricular oficial.
3. FORMATO: texto plano. Títulos en MAYÚSCULAS, listas con guiones. Sin asteriscos (**), almohadillas (##) ni guiones bajos (__).
4. MIRADA EDUmind: cuando encaje de forma natural, considera Los Cinco Mundos del alumnado (físico, mental, emocional, social e interior) y el Diseño Universal para el Aprendizaje; no los fuerces ni los nombres si no aportan.

FUENTES EXTERNAS (solo si la consulta lo requiere, nunca como relleno):
- Normativa autonómica y estatal vigente, citada con su denominación oficial.
- CEDEC (Proyecto EDIA) e INTEF para recursos educativos abiertos.
"""

def build_enriched_context(data: Dict[str, Any]) -> str:
    """Build optional enriched context from contextual fields."""
    context_parts = []
    
    if data.get("num_alumnos"):
        context_parts.append(f"Número de alumnos: {data['num_alumnos']}")
    
    if data.get("tipo_agrupamiento"):
        context_parts.append(f"Tipo de agrupamiento preferido: {data['tipo_agrupamiento']}")
    
    if data.get("metodologia_slider") is not None:
        slider = data["metodologia_slider"]
        if slider < 30:
            method_desc = "Enfoque TRADICIONAL (instrucción directa, ejercicios estructurados, evaluación clásica)"
        elif slider < 70:
            method_desc = "Enfoque EQUILIBRADO (combina métodos tradicionales con aprendizaje activo y tecnología)"
        else:
            method_desc = "Enfoque INNOVADOR (ABP, aprendizaje colaborativo, uso intensivo de tecnología y metodologías activas)"
        context_parts.append(f"Preferencia metodológica: {method_desc}")
    
    if data.get("neae_cases"):
        cases = ", ".join(data["neae_cases"])
        context_parts.append(f"Casos NEAE identificados en el aula: {cases}")
    
    if data.get("neae_otros"):
        context_parts.append(f"Información NEAE adicional: {data['neae_otros']}")
    
    if data.get("contexto_adicional"):
        context_parts.append(f"Contexto adicional del aula/centro: {data['contexto_adicional']}")
    
    result = ""
    if context_parts:
        result = "\n\nCONTEXTO ESPECÍFICO DEL AULA:\n" + "\n".join(f"- {part}" for part in context_parts)
    return result + build_marco_curricular_block(data)


def build_marco_curricular_block(data: Dict[str, Any]) -> str:
    """Bloque con los elementos oficiales de la matriz curricular seleccionada (si la hay)."""
    marco = data.get("marco_curricular")
    if not marco:
        return ""
    return f"\n\n{marco}\n"

def build_planning_prompt(data: Dict[str, Any]) -> str:
    """
    Builds the prompt for Didactic Planning (Planificación Didáctica).
    """
    curso = data.get("curso") or "No especificado"
    horas = data.get("horas") or "No especificado"
    objetivo = data.get("objetivo") or "No especificado"
    metodologia_tipo = data.get("metodologia_tipo", "Intermedia")
    metodologia_texto = data.get("metodologia_texto", "Individual")
    
    # Map descriptions (migrated from legacy app)
    METODOLOGIAS = {
        "Individual": "El estudiante trabaja de manera autónoma con instrucciones claras.",
        "Grupos pequeños": "Trabajo en equipos reducidos favoreciendo la interacción cooperativa.",
        "Grupos grandes": "Se organiza a la clase en grupos grandes con tareas distribuidas.",
        "Ambientes de aprendizaje": "Espacios diseñados para promover la autonomía y exploración."
    }
    metodologia_desc = METODOLOGIAS.get(metodologia_texto, "Metodología no especificada.")

    return f"""
    Genera una planificación didáctica rigurosa para {curso} con {horas} horas semanales.
    Objetivo: {objetivo}.
    Se aplicará una metodología de tipo {metodologia_tipo}, combinada con un enfoque de "{metodologia_texto}".
    Descripción del enfoque: {metodologia_desc}.
    
    Estructura requerida (CUMPLE ESTRICTAMENTE, SIN FORMATO MARKDOWN):
    1. DATOS IDENTIFICATIVOS
    2. OBJETIVOS DE APRENDIZAJE
    3. CONTENIDOS
    4. METODOLOGÍA DETALLADA
    5. SECUENCIACIÓN DE ACTIVIDADES
    6. CRITERIOS DE EVALUACIÓN
    7. RECURSOS
    
    {build_enriched_context(data)}
    {ECOSYSTEM_CONTEXT}
    """

def build_situation_prompt(data: Dict[str, Any]) -> str:
    """
    Builds the prompt for Learning Situation (Situación de Aprendizaje).
    """
    # ... extraction of fields ...
    modelo_pedagogico = data.get("modelo_pedagogico") or "No especificado"
    tipo_tarea = data.get("tipo_tarea") or "No especificado"
    estilo_ensenanza = data.get("estilo_ensenanza") or "No especificado"
    curso = data.get("curso") or "No especificado"
    etapa = data.get("etapa_educativa") or "No especificada"
    objetivos = data.get("objetivos") or "No especificado"
    contenidos = data.get("contenidos") or "No especificado"
    criterios = data.get("criterios_evaluacion") or "No especificado"
    casos_neae = data.get("casos_neae") or "No especificados"
    temporalizacion = data.get("temporalizacion") or "No especificado"
    tipo_temp = data.get("tipo_temporalizacion") or "semanas"

    text_temp = f"{temporalizacion} {tipo_temp}"

    return f"""
    Eres un experto en didáctica. Genera una Situación de Aprendizaje detallada y técnica.
    
    Contexto:
    - Curso/Etapa: {curso} ({etapa})
    - Modelo Pedagógico: {modelo_pedagogico}
    - Estilo Enseñanza: {estilo_ensenanza}
    - Tipo Tarea: {tipo_tarea}
    
    Elementos Curriculares Proporcionados (Usa SOLO estos, no inventes otros):
    - Objetivos: {objetivos}
    - Contenidos: {contenidos}
    - Criterios: {criterios}
    
    Atención a la Diversidad (NEAE): {casos_neae}
    
    Temporalización: {text_temp}
    
    Estructura requerida (CUMPLE ESTRICTAMENTE, SIN FORMATO MARKDOWN):
    1. TÍTULO Y JUSTIFICACIÓN
    2. CONCRECIÓN CURRICULAR
    3. SECUENCIA DIDÁCTICA (Sesión por Sesión con objetivos y actividades)
    4. MEDIDAS DE ATENCIÓN A LA DIVERSIDAD (Detalladas para los casos indicados)
    5. EVALUACIÓN (Indicadores de logro)
    6. RECURSOS Y TECNOLOGÍA
    
    {build_enriched_context(data)}
    {ECOSYSTEM_CONTEXT}
    """

def build_project_prompt(data: Dict[str, Any]) -> str:
    nombre = data.get("nombre_proyecto") or "No especificado"
    descripcion = data.get("descripcion") or "No especificado"
    objetivos = data.get("objetivos") or "No especificado"
    materiales = data.get("materiales") or "No especificado"
    
    return f"""
    Genera un proyecto educativo técnico llamado '{nombre}'. 
    Descripción proporcionada: {descripcion}. 
    Objetivos proporcionados: {objetivos}. 
    Materiales disponibles: {materiales}. 
    
    Incluye fases del proyecto y evaluación.
    SIN FORMATO MARKDOWN.
    {ECOSYSTEM_CONTEXT}
    """

# Docentes
def build_stem_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Actúa como docente especialista en proyectos STEM y Polos Creativos.
    Producto final: {data.get('producto') or 'No especificado'}
    Curso: {data.get('curso') or 'No especificado'}
    Materiales: {data.get('materiales') or 'No especificado'}
    NEAE: {data.get('neae') or 'No especificado'}
    
    Estructura: VISIÓN GENERAL, OBJETIVOS, JUSTIFICACIÓN, ATENCIÓN A NEAE, PLAN DE PROYECTO (Fases), RÚBRICA, INTEGRACIÓN TECNOLÓGICA.
    SIN FORMATO MARKDOWN.
    {ECOSYSTEM_CONTEXT}
    """

def build_diversity_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Actúa como orientador escolar senior.
    Caso: {data.get('caso') or 'No especificado'}
    Intervención actual: {data.get('intervencion_actual') or 'No especificado'}
    Resultados actuales: {data.get('resultados') or 'No especificado'}
    
    Genera informe técnico con: CONTEXTO, OBJETIVOS SMART, PLAN DE INTERVENCIÓN, SEGUIMIENTO, MARCO NORMATIVO.
    SIN FORMATO MARKDOWN.
    {ECOSYSTEM_CONTEXT}
    """

def build_session_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Diseño de Sesión Competencial Estricta.
    Tema: {data.get('tema') or 'No especificado'}
    Curso: {data.get('curso') or 'No especificado'}
    Descripción: {data.get('descripcion') or 'No especificado'}
    
    Estructura: CONTEXTO, OBJETIVOS OPERATIVOS, CRONOGRAMA DETALLADO (Fases), EVALUACIÓN FORMATIVA, INCLUSIÓN, RECURSOS DIGITALES.
    SIN FORMATO MARKDOWN.
    {ECOSYSTEM_CONTEXT}
    """

# Opositores
def build_topic_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Desarrollo de Tema de Oposición.
    Tema {data.get('numero')}: {data.get('titulo')}
    Cuerpo: {data.get('cuerpo')}
    Especialidad: {data.get('especialidad')}
    Parte: {data.get('parte')}
    
    Estructura académica rigurosa: INTRODUCCIÓN, DESARROLLO (Epígrafes numerados), INNOVACIÓN EDUCATIVA, CONCLUSIÓN, BIBLIOGRAFÍA.
    SIN FORMATO MARKDOWN.
    {ECOSYSTEM_CONTEXT}
    """

def build_case_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Supuesto Práctico de Oposición (Tribunal).
    Cuerpo: {data.get('cuerpo')}
    Especialidad: {data.get('especialidad')}
    Ejercicios: {data.get('numero_preguntas')}
    Tiempo: {data.get('tiempo_respuesta')}
    
    Incluye: CONTEXTO, SITUACIÓN PROBLEMÁTICA, PRUEBAS PROPUESTAS, ADAPTACIONES, NORMATIVA VIGENTE, RÚBRICA.
    Si aplica, menciona cómo el uso de tecnología (Moodle, Videoanálisis) podría enriquecer la solución didáctica.
    SIN FORMATO MARKDOWN.
    {ECOSYSTEM_CONTEXT}
    """

def build_defense_prompt(data: Dict[str, Any]) -> str:
    modo = data.get("modo")
    if modo == "evaluar":
        return f"""
        Evalúa respuesta de opositor (Parte A) con rigor de tribunal.
        Especialidad: {data.get('especialidad')}
        Enunciado: {data.get('enunciado')}
        Respuesta del opositor: {data.get('respuesta_usuario')}
        
        Dictamen: VALORACIÓN POR DIMENSIONES, CALIFICACIÓN PROPUESTA, RECOMENDACIONES DE MEJORA.
        SIN FORMATO MARKDOWN.
        """
    else:
        return f"""
        Respuesta Modelo al Supuesto (Parte A) con nivel de excelencia.
        Especialidad: {data.get('especialidad')}
        Enunciado: {data.get('enunciado')}
        
        Estructura: CONTEXTUALIZACIÓN, FUNDAMENTACIÓN TEÓRICA, DESARROLLO DIDÁCTICO, EVALUACIÓN, NORMATIVA.
        SIN FORMATO MARKDOWN.
        {ECOSYSTEM_CONTEXT}
        """

def build_idea_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Mentor de Oposiciones (Experto).
    Consulta: {data.get('consulta') or 'No especificada'}
    
    Respuesta técnica: IDEA PRINCIPAL, RECURSOS NORMATIVOS/BIBLIOGRÁFICOS, ACCIÓN INMEDIATA, PROPUESTA DE AUTOEVALUACIÓN.
    SIN FORMATO MARKDOWN.
    """

# Centros
def build_minutes_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Redacción de Acta de Reunión Oficial.
    Tipo: {data.get('tipo')}
    Fecha: {data.get('fecha')}
    Presentes: {data.get('presentes')}
    Temas: {data.get('temas')}
    Acuerdos: {data.get('acuerdos')}
    
    Secciones: CONVOCATORIA, ASISTENTES, ORDEN DEL DÍA, DESARROLLO, ACUERDOS FINALES, TAREAS PENDIENTES, PRÓXIMA CONVOCATORIA.
    SIN FORMATO MARKDOWN.
    """

def build_institution_doc_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Documentación Institucional (PE/PGA/RRI).
    Documento/Sección: {data.get('tipo')} - {data.get('seccion')}
    Contexto: {data.get('contexto')}
    DAFO Proporcionado: F:{data.get('fortalezas')} D:{data.get('debilidades')} O:{data.get('oportunidades')} A:{data.get('amenazas')}
    
    Estructura Técnica: DIAGNÓSTICO SITUACIONAL, OBJETIVOS ESTRATÉGICOS, LÍNEAS DE ACTUACIÓN, RECURSOS, INDICADORES DE EVALUACIÓN.
    SIN FORMATO MARKDOWN.
    """

def _inspection_subtemplate_block(subtemplate: str) -> str:
    templates = {
        "informe_tecnico": """
        SUBPLANTILLA INFORME TECNICO:
        1. Objeto del informe y alcance de la revision.
        2. Hechos verificados y trazabilidad de evidencias.
        3. Matriz de cumplimiento (cumple | parcialmente | no cumple) con riesgos.
        4. Acciones correctoras priorizadas (responsable, plazo, evidencia).
        5. Recomendaciones de mejora y seguimiento interno.
        """,
        "acta_seguimiento": """
        SUBPLANTILLA ACTA DE SEGUIMIENTO:
        1. Convocatoria, asistentes y funciones.
        2. Estado de cumplimiento por acuerdo previo.
        3. Incidencias detectadas y causas.
        4. Nuevos acuerdos operativos (responsable y fecha limite).
        5. Cierre, fecha de proxima revision y anexos.
        """,
        "respuesta_requerimiento": """
        SUBPLANTILLA RESPUESTA A REQUERIMIENTO:
        1. Identificacion del requerimiento y plazo administrativo.
        2. Contestacion punto por punto con evidencias verificables.
        3. Medidas ya implantadas y estado de ejecucion.
        4. Medidas pendientes con cronograma comprometido.
        5. Declaracion final de remision y persona responsable.
        """,
        "plan_actuacion": """
        SUBPLANTILLA PLAN DE ACTUACION:
        1. Diagnostico inicial y causas raices.
        2. Objetivos de mejora medibles.
        3. Plan operativo por fases (accion, responsable, recurso, hito, indicador).
        4. Riesgos de implementacion y medidas de contingencia.
        5. Sistema de seguimiento y evaluacion de impacto.
        """,
        "alegaciones": """
        SUBPLANTILLA ALEGACIONES:
        1. Antecedentes del expediente.
        2. Fundamentos facticos (hechos acreditados).
        3. Fundamentos juridico-educativos con soporte documental.
        4. Peticion concreta y propuesta de resolucion.
        5. Relacion ordenada de anexos.
        """,
        "informe_cierre": """
        SUBPLANTILLA INFORME DE CIERRE:
        1. Resumen ejecutivo del proceso de cumplimiento.
        2. Evidencias finales de cierre por accion.
        3. Indicadores de impacto alcanzados y brechas residuales.
        4. Lecciones aprendidas y mejoras estructurales.
        5. Propuesta de seguimiento preventivo.
        """,
    }
    return templates.get(subtemplate, templates["informe_tecnico"])


def build_inspection_report_prompt(data: Dict[str, Any]) -> str:
    subtemplate = (
        str(data.get("subplantilla") or data.get("tipo_documento") or "informe_tecnico")
        .strip()
        .lower()
    )
    subtemplate_block = _inspection_subtemplate_block(subtemplate)

    return f"""
    Elaboracion de documentacion para demanda de Inspeccion Educativa (centro).
    Tipo de documento: {data.get('tipo_documento') or 'informe_tecnico'}
    Subplantilla operativa: {subtemplate}
    Ambito: {data.get('ambito') or 'general'}
    Demanda/Requerimiento de inspeccion: {data.get('demanda_inspeccion') or 'No especificada'}
    Hallazgos del centro: {data.get('hallazgos') or 'No especificados'}
    Actuaciones previas del centro: {data.get('actuaciones_previas') or 'No especificadas'}
    Evidencias disponibles: {data.get('evidencias') or 'No especificadas'}
    Plazo de respuesta: {data.get('plazo_respuesta') or 'No especificado'}
    Normativa de referencia aportada: {data.get('normativa_aplicable') or 'No especificada'}

    Estructura base requerida (CUMPLE ESTRICTAMENTE, SIN FORMATO MARKDOWN):
    1. IDENTIFICACION Y ALCANCE DEL DOCUMENTO
    2. SINTESIS DE LA DEMANDA DE INSPECCION
    3. ANALISIS TECNICO DE CUMPLIMIENTO (fortalezas, brechas y riesgos)
    4. RESPUESTA INSTITUCIONAL ARGUMENTADA (que se cumple, que se corrige, como se justifica)
    5. PLAN DE ACTUACION INMEDIATA (tabla: Accion | Responsable | Evidencia | Fecha limite)
    6. PROPUESTA DE SEGUIMIENTO Y CONTROL
    7. ANEXOS Y EVIDENCIAS A ADJUNTAR
    8. CIERRE FORMAL PARA REMISION A INSPECCION

    {subtemplate_block}

    Requisitos criticos:
    - No inventes normativa; si falta base legal, indicalo explicitamente.
    - Usa lenguaje profesional, verificable y orientado a auditoria/inspeccion.
    - Prioriza acciones ejecutables dentro del plazo indicado.
    {ECOSYSTEM_CONTEXT}
    """


def build_reinforcement_plan_prompt(data: Dict[str, Any]) -> str:
    contenidos = data.get("contenidos_refuerzo") or []
    if isinstance(contenidos, list):
        cleaned_contents = [str(item).strip() for item in contenidos if str(item).strip()]
    else:
        cleaned_contents = [str(contenidos).strip()] if str(contenidos).strip() else []
    contenidos_text = "; ".join(cleaned_contents) if cleaned_contents else "No especificados"

    comunidad = str(data.get("comunidad") or "Galicia").strip() or "Galicia"
    if data.get("normativa_aplicable"):
        normativa_aplicable = str(data["normativa_aplicable"])
    elif comunidad.lower() == "galicia":
        normativa_aplicable = "Orden del 8 de septiembre de 2021 y Decreto 229/2011, de 7 de diciembre (Galicia)."
    else:
        # Sin referencia concreta no se inventa: se pide citar solo normativa oficial verificable.
        normativa_aplicable = (
            f"Normativa autonómica vigente de {comunidad} sobre atención a la diversidad y refuerzo "
            "(cita únicamente referencias oficiales que conozcas con certeza; si no, indícalo)."
        )

    return f"""
    Elaboracion de PLAN DE REFUERZO EDUCATIVO individualizado con enfoque privacy-first.

    DATOS DE ENTRADA (SIN DATOS PERSONALES):
    - Area educativa: {data.get('area_educativa') or 'No especificada'}
    - Curso: {data.get('curso') or 'No especificado'}
    - Etapa educativa: {data.get('etapa_educativa') or 'No especificada'}
    - Fecha de inicio del refuerzo: {data.get('fecha_inicio_refuerzo') or 'No especificada'}
    - Fecha estimada de finalizacion: {data.get('fecha_fin_estimada') or 'No especificada'}
    - Contenidos a reforzar: {contenidos_text}
    - Criterios de evaluacion asociados: {data.get('criterios_evaluacion') or 'No especificados'}
    - Instrumentos de evaluacion aplicados: {data.get('instrumentos_evaluacion') or 'No especificados'}
    - Evidencias de necesidad de refuerzo: {data.get('evidencias_necesidad_refuerzo') or 'No especificadas'}
    - Forma de trabajo aplicada hasta la fecha: {data.get('forma_trabajo_aplicada') or 'No especificada'}
    - Recursos empleados: {data.get('recursos_empleados') or 'No especificados'}
    - Desarrollo aplicado hasta ahora: {data.get('desarrollo_aplicado') or 'No especificado'}
    - Normativa de referencia: {normativa_aplicable}
    {build_marco_curricular_block(data)}

    REGLA DE PROTECCION DE DATOS (OBLIGATORIA):
    - No incluyas nombre, apellidos, DNI ni ningun identificador personal del alumno/a.
    - Redacta en terminos anonimizados: "el/la alumno/a".

    ESTRUCTURA REQUERIDA (CUMPLE ESTRICTAMENTE, SIN FORMATO MARKDOWN):
    1. DIAGNOSTICO PEDAGOGICO INICIAL (causas probables y barreras detectadas)
    2. OBJETIVOS DEL PLAN DE REFUERZO (medibles, realistas y temporalizados)
    3. ALINEACION CURRICULAR (contenidos y criterios de evaluacion vinculados)
    4. PROPUESTA DE INTERVENCION (secuencia semanal y metodologia de trabajo)
    5. MEDIDAS DE ATENCION A LA DIVERSIDAD (DUA, apoyos, adaptaciones no significativas)
    6. PLAN DE EVALUACION Y SEGUIMIENTO (instrumentos, frecuencia, umbrales de progreso)
    7. REAJUSTE DEL PLAN SEGUN EVIDENCIAS (decision rules claras)
    8. COORDINACION DOCENTE-FAMILIA-CENTRO (sin exponer datos personales)
    9. ENCAJE NORMATIVO ({comunidad}) con referencias explicitas a:
       - {normativa_aplicable}
    10. PLAN DE APLICACION INMEDIATA (24-72h) y cronograma hasta cierre

    REQUISITOS CRITICOS:
    - No inventes normativa ni articulos; si no hay evidencia suficiente, declaralo.
    - Prioriza medidas aplicables desde el aula, con trazabilidad y evidencia.
    - Evita mensajes vacios; cada accion debe indicar responsable, recurso e indicador.
    {ECOSYSTEM_CONTEXT}
    """

def build_rubric_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Generador de Rúbricas de Evaluación.
    Título: {data.get('nombre')}
    Área/Materia: {data.get('area')}
    Número de criterios: {data.get('criterios')}
    Descripción del proyecto/tarea: {data.get('descripcion')}
    
    Genera una tabla CSV válida con las columnas: Criterio, Nivel 1 (Insuficiente), Nivel 2 (Suficiente), Nivel 3 (Notable), Nivel 4 (Sobresaliente).
    El formato debe ser estrictamente CSV separado por comas, sin texto adicional antes o después.
    """

def build_worksheet_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Generador de Fichas Didácticas / Material de Apoyo.
    Tema: {data.get('tema')}
    Objetivo: {data.get('objetivo')}
    Tipo de material: {data.get('tipo')}
    Edad/Nivel: {data.get('edad')}
    
    Estructura: TÍTULO, OBJETIVOS, INSTRUCCIONES, ACTIVIDADES (Secuenciadas), RECURSOS EXTRA.
    SIN FORMATO MARKDOWN EN EL CUERPO (Usa texto plano limpio).
    {ECOSYSTEM_CONTEXT}
    """

def build_methodology_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Asesor Pedagógico en Metodologías Activas.
    Contenido a enseñar: {data.get('contenido')}
    Grupo/Nivel: {data.get('grupo')}
    
    Proporciona 3 alternativas metodológicas:
    1. ENFOQUE DIRECTIVO (Tradicional optimizado).
    2. ENFOQUE INTERMEDIO (Híbrido/Guiado).
    3. ENFOQUE EMANCIPATIVO (Autónomo/Innovador).
    
    Para cada uno: Descripción, Rol Docente, Rol Alumno, Ventajas.
    Tabla comparativa final.
    {ECOSYSTEM_CONTEXT}
    """

def build_organization_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Diseño de Espacios de Aprendizaje y Organización de Aula.
    Metodología: {data.get('metodologia')}
    Tipo de Espacio: {data.get('espacio')}
    Recursos Disponibles: {data.get('recursos')}
    Casuística Alumnado: {data.get('casuistica')}
    
    Estructura: VISIÓN GENERAL, ZONIFICACIÓN (Rincones/Áreas), GESTIÓN DE TIEMPOS, ACCESIBILIDAD (DUA).
    SIN FORMATO MARKDOWN.
    {ECOSYSTEM_CONTEXT}
    """

def build_question_prompt(data: Dict[str, Any]) -> str:
    return f"""
    Generador de Preguntas Formato GIFT (Moodle).
    Texto base/Tema: {data.get('texto_fuente')}
    Tipo de pregunta: {data.get('tipo_pregunta')}
    Cantidad: {data.get('cantidad')}
    Dificultad: {data.get('dificultad')}
    
    INSTRUCCIONES CRÍTICAS:
    Genera ÚNICAMENTE las preguntas en formato GIFT válido.
    Ejemplo formato GIFT:
    ::Título:: Pregunta {{=Correcta ~Incorrecta}}

    No incluyas texto introductorio ni conclusiones. SOLO CÓDIGO GIFT.
    """

def build_normative_prompt(data: Dict[str, Any]) -> str:
    return f"""
    ACTÚA COMO ANALISTA LEGAL EXPERTO EN NORMATIVA EDUCATIVA DE GALICIA.
    Tu tarea es responder la consulta usando de forma estricta el contexto legal proporcionado.

    CONTEXTO LEGAL RECUPERADO:
    {data.get('contexto') or 'No disponible'}

    CONSULTA DEL USUARIO:
    "{data.get('consulta') or 'No especificada'}"

    DIRECTRICES:
    1. Prioriza [LEYES] y [DECRETOS] frente a documentos de apoyo.
    2. Cita norma y artículo cuando exista evidencia (ej: Decreto 8/2015, art. 19).
    3. Si solo hay apoyo interpretativo, indícalo explícitamente.
    4. Si no hay base suficiente en el contexto, dilo de forma clara.
    5. Redacta una respuesta breve, precisa y accionable para centro educativo.
    """
