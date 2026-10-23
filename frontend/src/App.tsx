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
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "./components/AuthSessionProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const NotFound = lazy(() => import("./pages/NotFound"));

const SituationTool = lazy(() => import("./pages/tools/SituationTool"));
const StemTool = lazy(() => import("./pages/tools/StemTool"));
const DiversityTool = lazy(() => import("./pages/tools/DiversityTool"));
const SessionTool = lazy(() => import("./pages/tools/SessionTool"));
const CaseTool = lazy(() => import("./pages/tools/CaseTool"));
const TopicTool = lazy(() => import("./pages/tools/TopicTool"));
const DefenseTool = lazy(() => import("./pages/tools/DefenseTool"));
const IdeaTool = lazy(() => import("./pages/tools/IdeaTool"));
const MinutesTool = lazy(() => import("./pages/tools/MinutesTool"));
const InstitutionDocTool = lazy(() => import("./pages/tools/InstitutionDocTool"));
const InspectionReportTool = lazy(() => import("./pages/tools/InspectionReportTool"));
const ReinforcementPlanTool = lazy(() => import("./pages/tools/ReinforcementPlanTool"));
const NormativaTool = lazy(() => import("./pages/tools/NormativaTool"));
const PlanningTool = lazy(() => import("./pages/tools/PlanningTool"));

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));

const ClassManager = lazy(() => import("./pages/classroom/ClassManager"));
const ClassDetail = lazy(() => import("./pages/classroom/ClassDetail"));
const WeeklyPlanner = lazy(() => import("./pages/classroom/WeeklyPlanner"));

const Navbar = lazy(() => import("./components/Navbar"));
const EDUmindFooter = lazy(() => import("./components/EDUmindFooter"));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-slate-400 text-sm">
      Cargando modulo...
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

              <Route path="/tools/situation" element={renderLazy(SituationTool)} />
              <Route path="/tools/stem" element={renderLazy(StemTool)} />
              <Route path="/tools/diversity" element={renderLazy(DiversityTool)} />
              <Route path="/tools/session" element={renderLazy(SessionTool)} />

              <Route path="/tools/case" element={renderLazy(CaseTool)} />
              <Route path="/tools/topic" element={renderLazy(TopicTool)} />
              <Route path="/tools/defense" element={renderLazy(DefenseTool)} />
              <Route path="/tools/idea" element={renderLazy(IdeaTool)} />

              <Route path="/tools/minutes" element={renderLazy(MinutesTool)} />
              <Route path="/tools/institution_doc" element={renderLazy(InstitutionDocTool)} />
              <Route path="/tools/inspection_report" element={renderLazy(InspectionReportTool)} />
              <Route path="/tools/reinforcement_plan" element={renderLazy(ReinforcementPlanTool)} />
              <Route path="/tools/normativa" element={renderLazy(NormativaTool)} />
              <Route path="/tools/planning-ai" element={renderLazy(PlanningTool)} />

              <Route path="/login" element={renderLazy(AdminLogin)} />
              <Route
                path="/tools/planning"
                element={
                  <ProtectedRoute allowedRoles={["teacher_premium", "admin", "docente", "opositor", "centro"]} redirectTo="/login">
                    {renderLazy(WeeklyPlanner)}
                  </ProtectedRoute>
                }
              />

              <Route
                path="/classroom"
                element={
                  <ProtectedRoute allowedRoles={["teacher_premium", "admin", "docente", "opositor", "centro"]} redirectTo="/login">
                    {renderLazy(ClassManager)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="/classroom/:id"
                element={
                  <ProtectedRoute allowedRoles={["teacher_premium", "admin", "docente", "opositor", "centro"]} redirectTo="/login">
                    {renderLazy(ClassDetail)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planner"
                element={
                  <ProtectedRoute allowedRoles={["teacher_premium", "admin", "docente", "opositor", "centro"]} redirectTo="/login">
                    {renderLazy(WeeklyPlanner)}
                  </ProtectedRoute>
                }
              />

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
