import { useState } from 'react';
import { CalendarDays, ChevronRight, GraduationCap, LayoutDashboard, LogOut, Mail, MessageCircleMore, Settings2, UsersRound, Menu, X } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../lib/permissions';

export default function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const itemsByRole = {
    principal_admin: [
      { to: '/', icon: LayoutDashboard, label: 'Pilotage' },
      { to: '/schedules', icon: CalendarDays, label: 'Emplois du temps' },
      { to: '/review', icon: ChevronRight, label: 'Validations' },
      { to: '/catalog', icon: Settings2, label: 'Référentiels' },
      { to: '/communications', icon: Mail, label: 'Communications' },
      { to: '/contractors', icon: UsersRound, label: 'Vacataires' },
    ],
    level_admin: [
      { to: '/', icon: LayoutDashboard, label: 'Mes propositions' },
      { to: '/schedules', icon: CalendarDays, label: 'Construction' },
      { to: '/communications', icon: Mail, label: 'Communications' },
    ],
    local_doctor: [
      { to: '/', icon: LayoutDashboard, label: 'Ma journée' },
      { to: '/timetable', icon: CalendarDays, label: 'Mon emploi du temps' },
      { to: '/community', icon: MessageCircleMore, label: 'Préoccupations' },
    ],
    student: [
      { to: '/', icon: LayoutDashboard, label: 'Ma journée' },
      { to: '/timetable', icon: CalendarDays, label: 'Mon emploi du temps' },
      { to: '/community', icon: MessageCircleMore, label: 'Préoccupations' },
    ],
    contract_doctor: [
      { to: '/community', icon: MessageCircleMore, label: 'Préoccupations' },
      { to: '/contractors', icon: UsersRound, label: 'Mes documents' },
    ],
  };
  const items = itemsByRole[user.role] || [];

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="app-shell">
      {/* Mobile Header */}
      <header className="mobile-header">
        <NavLink className="brand" to="/" onClick={closeMenu}>
          <span className="brand-mark"><GraduationCap size={20} /></span>
          <span>KRA</span>
        </NavLink>
        <button className="mobile-menu-btn" onClick={toggleMenu} aria-label="Menu">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Desktop & Mobile Overlay */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-inner">
          <NavLink className="brand desktop-brand" to="/">
            <span className="brand-mark"><GraduationCap size={21} /></span>
            <span>KRA<small>Académique</small></span>
          </NavLink>
          
          <div className="nav-label">Espace de travail</div>
          <nav>
            {items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={closeMenu}>
                <Icon size={19} className="nav-icon" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          
          <div className="account">
            <div className="avatar">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="account-info">
              <strong>{user.firstName} {user.lastName}</strong>
              <small>{ROLE_LABELS[user.role]}</small>
            </div>
            <button className="logout-btn" title="Se déconnecter" onClick={() => { logout(); nav('/login'); }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      
      {/* Overlay to close menu on click outside */}
      {isMobileMenuOpen && (
        <div className="mobile-overlay" onClick={closeMenu} />
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
