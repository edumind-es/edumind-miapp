/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "./components/AuthSessionProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TOOLS } from "./lib/tools-registry";

const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Las herramientas se declaran una sola vez en lib/tools-registry.ts.
const toolComponents = Object.fromEntries(TOOLS.map((tool) => [tool.id, lazy(tool.load)])) as Record<
  string,
  LazyExoticComponent<ComponentType>
>;

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));

const ClassManager = lazy(() => import("./pages/classroom/ClassManager"));
const ClassDetail = lazy(() => import("./pages/classroom/ClassDetail"));

const Navbar = lazy(() => import("./components/Navbar"));
const EDUmindFooter = lazy(() => import("./components/EDUmindFooter"));

const ANY_SIGNED_IN_ROLE = ["teacher_premium", "admin", "docente", "opositor", "centro"];

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center lam-mono">
      Cargando módulo
    </div>
  );
}

function App() {
  const renderLazy = (Component: LazyExoticComponent<ComponentType>) => (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );

  return (
    <Router>
      <AuthSessionProvider>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>

          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={renderLazy(Home)} />
              <Route path="/chat" element={renderLazy(Chat)} />
              <Route path="/dashboard" element={renderLazy(Dashboard)} />
              {TOOLS.map((tool) =>
                tool.requiresAuth ? (
                  <Route
                    key={tool.id}
                    path={tool.path}
                    element={
                      <ProtectedRoute allowedRoles={ANY_SIGNED_IN_ROLE} redirectTo="/login">
                        {renderLazy(toolComponents[tool.id])}
                      </ProtectedRoute>
                    }
                  />
                ) : (
                  <Route key={tool.id} path={tool.path} element={renderLazy(toolComponents[tool.id])} />
                )
              )}

              <Route path="/login" element={renderLazy(AdminLogin)} />

              <Route
                path="/classroom"
                element={
                  <ProtectedRoute allowedRoles={ANY_SIGNED_IN_ROLE} redirectTo="/login">
                    {renderLazy(ClassManager)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="/classroom/:id"
                element={
                  <ProtectedRoute allowedRoles={ANY_SIGNED_IN_ROLE} redirectTo="/login">
                    {renderLazy(ClassDetail)}
                  </ProtectedRoute>
                }
              />
              {/* Ruta antigua del planificador: se unifica en /tools/planning */}
              <Route path="/planner" element={<Navigate to="/tools/planning" replace />} />

              <Route path="*" element={renderLazy(NotFound)} />
            </Routes>
          </div>

          <Suspense fallback={null}>
            <EDUmindFooter
              appName="EDUmind® MiApp"
              version="1.0.0"
              versionStage="Beta"
              hideNavigation={true}
            />
          </Suspense>
        </div>
      </AuthSessionProvider>
    </Router>
  );
}

export default App;
