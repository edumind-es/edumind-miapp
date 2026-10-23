/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

export interface DeviceCapability {
    hasWebGpu: boolean;
    deviceMemoryGb: number | null;
    hardwareConcurrency: number | null;
    isLikelyLowEnd: boolean;
}

interface NavigatorWithHints extends Navigator {
    deviceMemory?: number;
    gpu?: unknown;
}

export function detectDeviceCapability(): DeviceCapability {
    if (typeof navigator === "undefined") {
        return {
            hasWebGpu: false,
            deviceMemoryGb: null,
            hardwareConcurrency: null,
            isLikelyLowEnd: false,
        };
    }

    const nav = navigator as NavigatorWithHints;
    const hasWebGpu = Boolean(nav.gpu);
    const deviceMemoryGb = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
    const hardwareConcurrency = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null;

    const memoryLow = deviceMemoryGb !== null && deviceMemoryGb < 4;
    const cpuLow = hardwareConcurrency !== null && hardwareConcurrency < 4;
    const isLikelyLowEnd = memoryLow || cpuLow;

    return {
        hasWebGpu,
        deviceMemoryGb,
        hardwareConcurrency,
        isLikelyLowEnd,
    };
}

