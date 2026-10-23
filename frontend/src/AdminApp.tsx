import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";

import { AuthSessionProvider } from "./components/AuthSessionProvider";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { ADMIN_PORTAL_PATH, buildAdminPortalPath } from "./lib/admin-portal";

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const DatasetBuilder = lazy(() => import("./pages/admin/DatasetBuilder"));
const TrainingPipeline = lazy(() => import("./pages/admin/TrainingPipeline"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminConfig = lazy(() => import("./pages/admin/AdminConfig"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));

function RouteFallback() {
    return (
        <div className="min-h-[40vh] flex items-center justify-center text-slate-400 text-sm">
            Cargando modulo...
        </div>
    );
}

export default function AdminApp() {
    const renderLazy = (Component: LazyExoticComponent<ComponentType>) => (
        <Suspense fallback={<RouteFallback />}>
            <Component />
        </Suspense>
    );

    return (
        <Router>
            <AuthSessionProvider>
                <Routes>
                    <Route
                        path={ADMIN_PORTAL_PATH}
                        element={
                            <AdminProtectedRoute redirectTo="/login">
                                {renderLazy(AdminDashboard)}
                            </AdminProtectedRoute>
                        }
                    />
                    <Route
                        path={buildAdminPortalPath("/dataset")}
                        element={
                            <AdminProtectedRoute redirectTo="/login">
                                {renderLazy(DatasetBuilder)}
                            </AdminProtectedRoute>
                        }
                    />
                    <Route
                        path={buildAdminPortalPath("/training")}
                        element={
                            <AdminProtectedRoute redirectTo="/login">
                                {renderLazy(TrainingPipeline)}
                            </AdminProtectedRoute>
                        }
                    />
                    <Route
                        path={buildAdminPortalPath("/users")}
                        element={
                            <AdminProtectedRoute redirectTo="/login">
                                {renderLazy(AdminUsers)}
                            </AdminProtectedRoute>
                        }
                    />
                    <Route
                        path={buildAdminPortalPath("/config")}
                        element={
                            <AdminProtectedRoute redirectTo="/login">
                                {renderLazy(AdminConfig)}
                            </AdminProtectedRoute>
                        }
                    />
                    <Route
                        path={buildAdminPortalPath("/logs")}
                        element={
                            <AdminProtectedRoute redirectTo="/login">
                                {renderLazy(AdminLogs)}
                            </AdminProtectedRoute>
                        }
                    />
                    <Route path="*" element={<Navigate to={ADMIN_PORTAL_PATH} replace />} />
                </Routes>
            </AuthSessionProvider>
        </Router>
    );
}
