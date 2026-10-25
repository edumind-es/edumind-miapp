import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormattedContent } from "./FormattedContent";

describe("FormattedContent", () => {
    it("muestra el estado vacío cuando no hay contenido útil", () => {
        render(<FormattedContent content="<think>...</think>" emptyState="Nada que mostrar" />);
        expect(screen.getByText("Nada que mostrar")).toBeTruthy();
    });
    it("renderiza encabezados y listas de texto markdown", () => {
        render(<FormattedContent content={"## Objetivos\n- Saltar\n- Correr"} />);
        expect(screen.getByText("Objetivos")).toBeTruthy();
        expect(screen.getByText("Saltar")).toBeTruthy();
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });
    it("renderiza salidas JSON como contenido estructurado", () => {
        render(<FormattedContent content={'{"nivel_confianza": "alto", "respuesta": "Sí"}'} />);
        expect(screen.getByText(/nivel confianza/i)).toBeTruthy();
        expect(screen.getByText("Sí")).toBeTruthy();
    });
});
