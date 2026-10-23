#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Galicia curriculum catalog service (initial scope: Primary Education)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


class GaliciaCurriculumService:
    """Serve a backend-maintained curriculum catalog for guided generators."""

    _PRIMARY_CATALOG: dict[str, Any] = {
        "region": "Galicia",
        "stage": "Educacion Primaria",
        "source": "Catalogo inicial EDUmind (version operativa para planes de refuerzo).",
        "normative_notes": [
            "Marco LOMLOE en vigor.",
            "Curriculo de Primaria de Galicia (revision y actualizacion continua en despliegues sucesivos).",
            "Catalogo orientado a apoyo docente; la concrecion final corresponde al centro y a la normativa vigente.",
        ],
        "areas": [
            {
                "area_id": "lengua_castellana_literatura",
                "area_name": "Lengua Castellana y Literatura",
                "evaluation_criteria": [
                    "Comprende y sintetiza la información esencial de textos orales y escritos adecuados al curso.",
                    "Produce textos orales planificados con claridad, corrección y vocabulario ajustado a la intención comunicativa.",
                    "Redacta textos breves y medios con coherencia, cohesión y revisión autónoma progresiva.",
                    "Aplica estrategias de lectura para localizar, interpretar y valorar información relevante.",
                    "Utiliza convenciones ortográficas y gramaticales básicas en situaciones reales de comunicación.",
                ],
                "contents": [
                    "Comprension oral de instrucciones, relatos y exposiciones breves.",
                    "Expresion oral planificada con vocabulario preciso y conectores basicos.",
                    "Comprension lectora literal, inferencial y critica de textos adecuados al nivel.",
                    "Estrategias de lectura: anticipacion, subrayado, resumen y preguntas guiadas.",
                    "Produccion escrita de textos narrativos, descriptivos, expositivos y argumentativos iniciales.",
                    "Ortografia de uso frecuente, acentuacion basica y revision de textos.",
                    "Gramática funcional: categorias gramaticales, concordancia y estructura de la oracion.",
                    "Educacion literaria: poesia, cuento, teatro y lectura autonoma con dialogo literario.",
                    "Alfabetizacion mediatica: uso responsable de fuentes y deteccion de informacion no fiable.",
                    "Interaccion comunicativa respetuosa en contextos presenciales y digitales.",
                ],
            },
            {
                "area_id": "lingua_galega_literatura",
                "area_name": "Lingua Galega e Literatura",
                "evaluation_criteria": [
                    "Comprende mensaxes orais e textos escritos en galego identificando información relevante.",
                    "Exprésase oralmente en galego con adecuación ao contexto e progresiva corrección lingüística.",
                    "Produce textos escritos en galego con estrutura clara, cohesión e revisión guiada.",
                    "Emprega estratexias de lectura e mediación para comprender e comunicar información en galego.",
                    "Valora a lingua galega como elemento de identidade cultural e social nas tarefas da aula.",
                ],
                "contents": [
                    "Comprension oral en galego de mensaxes, narracions e textos funcionais.",
                    "Producion oral en galego adaptada ao contexto comunicativo escolar.",
                    "Comprension lectora en galego con estratexias de interpretacion progresiva.",
                    "Producion de textos escritos en galego con coherencia e correccion linguistica.",
                    "Norma ortografica e morfosintactica galega de uso escolar.",
                    "Ampliacion do lexico e uso de rexistros axeitados.",
                    "Literatura galega infantil e xuvenil: lectura, comentario e creacion.",
                    "Valoracion da lingua galega como patrimonio cultural e social.",
                    "Comparacion e transferencia positiva entre linguas do repertorio do alumnado.",
                    "Uso etico e responsable de recursos dixitais en lingua galega.",
                ],
            },
            {
                "area_id": "matematicas",
                "area_name": "Matematicas",
                "evaluation_criteria": [
                    "Resuelve problemas contextualizados seleccionando estrategias, representaciones y operaciones adecuadas.",
                    "Explica procesos de razonamiento matemático utilizando lenguaje oral, escrito y gráfico.",
                    "Aplica procedimientos de cálculo y estimación con precisión ajustada a la tarea.",
                    "Interpreta datos, tablas y gráficos para tomar decisiones fundamentadas.",
                    "Reconoce relaciones numéricas, geométricas y de medida en situaciones del entorno.",
                ],
                "contents": [
                    "Sentido numerico: numeracion, valor posicional y calculo mental.",
                    "Operaciones con numeros naturales, fracciones y decimales segun curso.",
                    "Resolucion de problemas mediante estrategias diversas y verificacion de resultados.",
                    "Sentido algebraico inicial: patrones, relaciones y expresiones equivalentes.",
                    "Magnitudes y medida: longitud, masa, capacidad, tiempo y temperatura.",
                    "Geometria plana y espacial: figuras, cuerpos, propiedades y composicion.",
                    "Localizacion espacial, planos y coordenadas basicas.",
                    "Tratamiento de datos: tablas, graficos e interpretacion de informacion.",
                    "Probabilidad intuitiva y toma de decisiones en contextos cotidianos.",
                    "Razonamiento matematico, argumentacion y comunicacion de procesos.",
                ],
            },
            {
                "area_id": "conocimiento_medio",
                "area_name": "Conocimiento del Medio Natural, Social y Cultural",
                "evaluation_criteria": [
                    "Formula preguntas investigables y registra observaciones con procedimientos propios de la indagación escolar.",
                    "Explica fenómenos naturales, sociales y culturales relacionando causas, consecuencias y evidencias.",
                    "Utiliza información de distintas fuentes para interpretar hechos del entorno con sentido crítico.",
                    "Propone actuaciones responsables vinculadas a salud, sostenibilidad y convivencia democrática.",
                    "Comunica conclusiones de proyectos y experiencias usando soportes analógicos o digitales.",
                ],
                "contents": [
                    "Indagacion cientifica escolar: observacion, preguntas, hipotesis y registro.",
                    "Seres vivos, ecosistemas y relaciones de interdependencia.",
                    "Cuerpo humano, salud, habitos de vida activa y bienestar emocional.",
                    "Materia, energia y cambios en fenomenos del entorno.",
                    "Tecnologia y cultura digital con enfoque critico y seguro.",
                    "Tiempo historico: cambios, permanencias y fuentes de informacion.",
                    "Espacio geografico: paisaje, clima, mapas y orientacion territorial.",
                    "Instituciones, organizacion social y participacion democratica.",
                    "Sostenibilidad, consumo responsable y cuidado del medio ambiente.",
                    "Patrimonio cultural de Galicia y diversidad cultural en Espana.",
                ],
            },
            {
                "area_id": "educacion_artistica",
                "area_name": "Educacion Artistica",
                "evaluation_criteria": [
                    "Explora y combina elementos visuales, sonoros y corporales para crear producciones propias.",
                    "Aplica técnicas artísticas básicas con intención expresiva y cuidado en el proceso.",
                    "Analiza manifestaciones artísticas identificando rasgos, emociones y contextos culturales.",
                    "Participa en proyectos artísticos cooperativos asumiendo responsabilidades y respetando aportaciones ajenas.",
                    "Utiliza recursos digitales y materiales diversos de forma segura y creativa.",
                ],
                "contents": [
                    "Exploracion de elementos visuales: linea, forma, color, textura y composicion.",
                    "Tecnicas plasticas variadas: dibujo, pintura, collage, volumen y medios mixtos.",
                    "Percepcion y analisis de obras artisticas de distintos contextos.",
                    "Creacion de proyectos artisticos individuales y cooperativos.",
                    "Expresion musical: ritmo, melodia, pulso y audicion activa.",
                    "Interpretacion vocal, instrumental y corporal de piezas sencillas.",
                    "Improvisacion y composicion elemental con recursos analogicos y digitales.",
                    "Artes escenicas: dramatizacion, expresion corporal y comunicacion no verbal.",
                    "Valoracion del patrimonio artistico gallego y universal.",
                    "Uso respetuoso de materiales, espacios y producciones propias y ajenas.",
                ],
            },
            {
                "area_id": "educacion_fisica",
                "area_name": "Educacion Fisica",
                "evaluation_criteria": [
                    "Aplica habilidades motrices y patrones de movimiento adaptándolos a juegos y situaciones motrices diversas.",
                    "Participa de forma activa, segura e inclusiva en prácticas motrices individuales y colectivas.",
                    "Regula el esfuerzo, el calentamiento y la vuelta a la calma en función de la tarea.",
                    "Resuelve retos motrices mostrando cooperación, respeto a las normas y juego limpio.",
                    "Relaciona actividad física, salud y bienestar con hábitos de vida activa sostenibles.",
                ],
                "contents": [
                    "Habilidades motrices basicas y su combinacion en tareas motrices.",
                    "Coordinacion, equilibrio, lateralidad y control postural.",
                    "Condicion fisica saludable adaptada a la edad y a la diversidad.",
                    "Juegos motores y deportes con reglas, cooperacion y oposicion.",
                    "Expresion corporal, comunicacion motriz y creatividad.",
                    "Actividad fisica en el medio natural con seguridad y respeto ambiental.",
                    "Autonomia en el calentamiento, vuelta a la calma y prevencion de lesiones.",
                    "Educacion en valores: respeto, inclusion, juego limpio y resolucion de conflictos.",
                    "Habitos de vida activa y relacion entre ejercicio, descanso y alimentacion.",
                    "Uso critico de tecnologia aplicada al movimiento y al aprendizaje motor.",
                ],
            },
            {
                "area_id": "lengua_extranjera",
                "area_name": "Lengua Extranjera",
                "evaluation_criteria": [
                    "Comprende mensajes orales y escritos breves apoyándose en claves contextuales y visuales.",
                    "Interactúa en situaciones comunicativas sencillas con apoyo de estructuras y vocabulario trabajados.",
                    "Produce textos breves funcionales respetando modelos y convenciones básicas.",
                    "Emplea estrategias de mediación y compensación para mantener la comunicación.",
                    "Muestra curiosidad y respeto hacia otras lenguas y culturas en actividades compartidas.",
                ],
                "contents": [
                    "Comprension oral de mensajes cotidianos en contextos cercanos.",
                    "Interaccion oral guiada: saludos, rutinas, preferencias y necesidades.",
                    "Comprension lectora de textos breves multimodales.",
                    "Produccion escrita de mensajes funcionales con apoyo de modelos.",
                    "Vocabulario de alta frecuencia vinculado a situaciones reales.",
                    "Estructuras gramaticales basicas para comunicacion significativa.",
                    "Pronunciacion, entonacion y fluidez inicial.",
                    "Estrategias de mediacion linguistica y comunicacion compensatoria.",
                    "Dimension intercultural y respeto a la diversidad linguistica.",
                    "Uso de recursos digitales para practica autonoma y colaborativa.",
                ],
            },
            {
                "area_id": "valores_civicos_eticos",
                "area_name": "Educacion en Valores Civicos y Eticos",
                "evaluation_criteria": [
                    "Analiza situaciones de convivencia identificando derechos, deberes y alternativas de actuación.",
                    "Participa en diálogos y acuerdos mostrando escucha activa, respeto y pensamiento crítico.",
                    "Reconoce conductas discriminatorias y propone respuestas inclusivas y responsables.",
                    "Toma decisiones fundamentadas sobre consumo, sostenibilidad y ciudadanía digital.",
                    "Relaciona acciones personales y colectivas con el bien común y la participación democrática.",
                ],
                "contents": [
                    "Convivencia democratica y respeto a los derechos humanos.",
                    "Identidad personal, autoestima y autorregulacion emocional.",
                    "Igualdad efectiva y prevencion de discriminaciones.",
                    "Dialogo, pensamiento critico y resolucion pacifica de conflictos.",
                    "Corresponsabilidad, participacion y compromiso comunitario.",
                    "Consumo responsable y sostenibilidad.",
                    "Ciudadania digital, privacidad y comportamiento etico en red.",
                    "Cuidado de los bienes comunes y del entorno.",
                    "Analisis de dilemas morales adecuados al desarrollo evolutivo.",
                    "Proyecto personal de mejora y contribucion al bien comun.",
                ],
            },
        ],
    }

    @classmethod
    def get_primary_catalog(cls) -> dict[str, Any]:
        """Return a copy to prevent accidental in-memory mutations."""
        return deepcopy(cls._PRIMARY_CATALOG)
