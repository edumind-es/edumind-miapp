# Evals de prompts (sin modelo)

`tests/test_prompt_evals.py` recorre todos los contratos de `prompt_registry` con un
payload mínimo válido y comprueba, en cada CI:

- que el prompt se renderiza y conserva literalmente cada dato de entrada;
- que no contiene frases prohibidas (publicidad de productos, cierre de consultoría, peticiones de Markdown);
- que respeta el presupuesto de longitud por perfil (`evals/budgets.json`);
- que las herramientas JSON incluyen el esquema y que, con matriz curricular, aparece el marco oficial.

`evals/golden_set.json` añade casos reales por herramienta (valores que deben sobrevivir al saneado).
Cuando haya un motor disponible en CI se podrá añadir un juez; hoy las evals son deterministas.
