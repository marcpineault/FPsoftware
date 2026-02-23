import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout';
import { Dashboard } from './components/client/Dashboard';
import { Discovery } from './components/discovery/Discovery';
import { Profile } from './components/client/Profile';
import { Projections } from './components/projections/Projections';
import Summary from './components/recommendations/Summary';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/client/:id/discovery" element={<Discovery />} />
          <Route path="/client/:id/profile" element={<Profile />} />
          <Route path="/client/:id/projections" element={<Projections />} />
          <Route path="/client/:id/summary" element={<Summary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
