import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Shell from './components/Shell';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import TimetablePage from './pages/TimetablePage';
import ScheduleBuilderPage from './pages/ScheduleBuilderPage';
import ReviewPage from './pages/ReviewPage';
import CommunityPage from './pages/CommunityPage';
import CommunicationsPage from './pages/CommunicationsPage';
import ContractorsPage from './pages/ContractorsPage';
import CatalogPage from './pages/CatalogPage';
import { ROLES } from './lib/permissions';
import './styles.css';

function Protected() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="loading">Chargement…</div>;
  return user ? <Shell /> : <Navigate to="/login" replace />;
}

function RoleRoute({ roles }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />;
}

function App() {
  return <Routes>
    <Route path="/login" element={<AuthPage />} />
    <Route element={<Protected />}>
      <Route index element={<DashboardPage />} />
      <Route element={<RoleRoute roles={ROLES.consultation} />}>
        <Route path="timetable" element={<TimetablePage />} />
      </Route>
      <Route element={<RoleRoute roles={ROLES.community} />}>
        <Route path="community" element={<CommunityPage />} />
      </Route>
      <Route element={<RoleRoute roles={ROLES.management} />}>
        <Route path="schedules" element={<ScheduleBuilderPage />} />
      </Route>
      <Route element={<RoleRoute roles={ROLES.review} />}>
        <Route path="review" element={<ReviewPage />} />
      </Route>
      <Route element={<RoleRoute roles={ROLES.communications} />}>
        <Route path="communications" element={<CommunicationsPage />} />
      </Route>
      <Route element={<RoleRoute roles={ROLES.contractors} />}>
        <Route path="contractors" element={<ContractorsPage />} />
      </Route>
      <Route element={<RoleRoute roles={ROLES.catalog} />}>
        <Route path="catalog" element={<CatalogPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>);
