import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout';
import { Dashboard } from './components/client/Dashboard';

// Lazy-load heavy route components for code splitting
const Discovery = lazy(() => import('./components/discovery/Discovery').then(m => ({ default: m.Discovery })));
const Profile = lazy(() => import('./components/client/Profile').then(m => ({ default: m.Profile })));
const Projections = lazy(() => import('./components/projections/Projections').then(m => ({ default: m.Projections })));
const Summary = lazy(() => import('./components/recommendations/Summary'));
const ScenarioComparison = lazy(() => import('./components/scenarios/ScenarioComparison').then(m => ({ default: m.ScenarioComparison })));
const InsuranceNeeds = lazy(() => import('./components/insurance/InsuranceNeeds').then(m => ({ default: m.InsuranceNeeds })));
const PlanReport = lazy(() => import('./components/recommendations/PlanReport'));

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
            <Route path="/client/:id/discovery" element={<Discovery />} />
            <Route path="/client/:id/profile" element={<Profile />} />
            <Route path="/client/:id/projections" element={<Projections />} />
            <Route path="/client/:id/scenarios" element={<ScenarioComparison />} />
            <Route path="/client/:id/insurance" element={<InsuranceNeeds />} />
            <Route path="/client/:id/summary" element={<Summary />} />
            <Route path="/client/:id/report" element={<PlanReport />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
