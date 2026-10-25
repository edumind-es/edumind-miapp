/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Configuración de Vitest: hereda alias y plugins de Vite y ejecuta en jsdom
// para poder probar hooks y componentes además de la lógica pura.
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: "jsdom",
            include: ["src/**/*.test.{ts,tsx}"],
            restoreMocks: true,
        },
    })
);
