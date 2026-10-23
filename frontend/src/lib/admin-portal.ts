const DEFAULT_ADMIN_PORTAL_PATH = "/portal-ops-7f3d9a";

function normalizeAdminPortalPath(rawValue: string | undefined): string {
    const trimmed = (rawValue || DEFAULT_ADMIN_PORTAL_PATH).trim();
    if (!trimmed) {
        return DEFAULT_ADMIN_PORTAL_PATH;
    }

    let candidate = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (candidate !== "/" && candidate.endsWith("/")) {
        candidate = candidate.replace(/\/+$/, "");
    }

    if (candidate === "/" || candidate === "/admin" || candidate === "/login" || candidate.startsWith("/api/")) {
        return DEFAULT_ADMIN_PORTAL_PATH;
    }

    return candidate;
}

export const ADMIN_PORTAL_PATH = normalizeAdminPortalPath(import.meta.env.VITE_ADMIN_PORTAL_PATH);

export function normalizeAdminPortalCandidate(path: string | null | undefined): string | null {
    if (!path) return null;
    const candidate = path.trim();
    if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/api/")) {
        return null;
    }
    if (candidate === "/admin" || candidate.startsWith("/admin/")) {
        return `${ADMIN_PORTAL_PATH}${candidate.slice("/admin".length)}`;
    }
    return candidate;
}

export function buildAdminPortalPath(segment = ""): string {
    if (!segment || segment === "/") {
        return ADMIN_PORTAL_PATH;
    }

    return segment.startsWith("/")
        ? `${ADMIN_PORTAL_PATH}${segment}`
        : `${ADMIN_PORTAL_PATH}/${segment}`;
}
