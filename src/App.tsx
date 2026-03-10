import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout';
import { Dashboard } from './components/client/Dashboard';

// Lazy-load route components
const SetupWizard = lazy(() => import('./components/setup/SetupWizard'));
const Projections = lazy(() => import('./components/projections/Projections').then(m => ({ default: m.Projections })));
const ScenarioComparison = lazy(() => import('./components/scenarios/ScenarioComparison').then(m => ({ default: m.ScenarioComparison })));
const InsuranceNeeds = lazy(() => import('./components/insurance/InsuranceNeeds').then(m => ({ default: m.InsuranceNeeds })));
const PlanReport = lazy(() => import('./components/recommendations/PlanReport'));
const QuickCalc = lazy(() => import('./components/tools/QuickCalc'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/client/:id/setup" element={<Navigate to="client" replace />} />
            <Route path="/client/:id/setup/:step" element={<SetupWizard />} />
            <Route path="/client/:id/projections" element={<Projections />} />
            <Route path="/client/:id/scenarios" element={<ScenarioComparison />} />
            <Route path="/client/:id/insurance" element={<InsuranceNeeds />} />
            <Route path="/client/:id/report" element={<PlanReport />} />
            <Route path="/tools" element={<QuickCalc />} />
            {/* Redirect old routes */}
            <Route path="/client/:id/discovery" element={<RedirectToSetup />} />
            <Route path="/client/:id/profile" element={<RedirectToSetup />} />
            <Route path="/client/:id/summary" element={<RedirectToReport />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// Redirect components for old routes
function RedirectToSetup() {
  return <Navigate to="../setup/client" replace />;
}

function RedirectToReport() {
  return <Navigate to="../report" replace />;
}

export default App;
