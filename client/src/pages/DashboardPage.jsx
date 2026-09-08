import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Sparkles } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { clock, when } from '../components/Timetable';
import { useAuth } from '../context/AuthContext';

const labels = { course: 'Cours', tutorial: 'TD', lab: 'TP', exam: 'Examen', quiz: 'Interrogation', other: 'Séance' };

function ManagementDashboard({ user }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/overview').then(setOverview).catch((event) => setError(event.message));
  }, []);

  const isPrincipal = user.role === 'principal_admin';
  return <div className="page">
    <header className="page-header">
      <div>
        <p className="eyebrow">{isPrincipal ? 'PILOTAGE' : 'GESTION DE MON NIVEAU'}</p>
        <h1>Bonjour, {user.firstName}.</h1>
        <p className="muted">{isPrincipal ? 'Suivez les propositions et les publications à traiter.' : `Gérez uniquement la proposition de ${user.level?.name || 'votre niveau'}.`}</p>
      </div>
      <label className="schedule-date-search dashboard-date-search">
        <span>Rechercher un emploi du temps</span>
        <input type="date" defaultValue={new Date().toISOString().slice(0, 10)} onChange={(event) => event.target.value && navigate(`/schedules?date=${event.target.value}`)} aria-label="Rechercher un emploi du temps par date" />
      </label>
    </header>
    {error && <div className="alert error">{error}</div>}
    <section className="management-intro card">
      <CalendarDays size={23} />
      <div><strong>{isPrincipal ? 'Gestion des emplois du temps' : 'Proposition de niveau'}</strong><p>{isPrincipal ? 'Les cartes du jour sont réservées aux étudiants et aux docteurs. Utilisez les espaces de gestion pour contrôler les propositions.' : 'Construisez, soumettez et ajustez la proposition de votre niveau ; aucun planning personnel ne vous est présenté.'}</p></div>
    </section>
    {overview && <section className="metrics">
      <article><Clock3 /><div><strong>{overview.awaitingReview}</strong><span>À vérifier</span></div></article>
      <article><Sparkles /><div><strong>{overview.validated}</strong><span>Validés</span></div></article>
      <article><CalendarDays /><div><strong>{overview.published}</strong><span>Publiés</span></div></article>
    </section>}
  </div>;
}

function DailyDashboard({ user }) {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isDoctor = user.role === 'local_doctor';

  useEffect(() => {
    setError('');
    setLoading(true);
    api.get(`/dashboard/today?date=${date.toISOString()}`)
      .then(setSessions)
      .catch((event) => {
        setSessions([]);
        setError(event.message);
      })
      .finally(() => setLoading(false));
  }, [date]);

  const dailyMinutes = useMemo(() => sessions.reduce((total, session) => total + (new Date(session.endsAt) - new Date(session.startsAt)) / 60000, 0), [sessions]);
  const shift = (amount) => setDate((old) => new Date(old.getFullYear(), old.getMonth(), old.getDate() + amount));

  return <div className="page">
    <header className="page-header">
      <div>
        <p className="eyebrow">MA JOURNÉE</p>
        <h1>{isDoctor ? 'Mes cours du jour' : 'Mon programme du jour'}</h1>
        <p className="muted">Consultez uniquement les séances publiées qui vous concernent.</p>
      </div>
      <div className="date-switch" aria-label="Changer de journée">
        <button onClick={() => shift(-1)} aria-label="Jour précédent"><ChevronLeft size={18} /></button>
        <span>{when(date)}</span>
        <button onClick={() => shift(1)} aria-label="Jour suivant"><ChevronRight size={18} /></button>
      </div>
      <label className="schedule-date-search dashboard-date-search">
        <span>Rechercher la semaine d’une date</span>
        <input type="date" onChange={(event) => event.target.value && navigate(`/timetable?date=${event.target.value}`)} aria-label="Rechercher un emploi du temps par date" />
      </label>
    </header>
    {error && <div className="alert error">{error}</div>}
    <section className="day-hero">
      <div className="hero-top"><div><p className="eyebrow">CARTE DU JOUR</p><h2>{sessions.length ? `${sessions.length} séance${sessions.length > 1 ? 's' : ''}` : 'Pas de cours'}</h2></div><Sparkles size={22} /></div>
      {isDoctor && sessions.length > 0 && <p className="daily-total"><Clock3 size={15} /> Cumul de la journée : {Math.floor(dailyMinutes / 60)} h {dailyMinutes % 60 ? `${dailyMinutes % 60} min` : ''}</p>}
      {loading ? <div className="schedule-loading dashboard-loading" role="status" aria-live="polite">
        <span className="schedule-loading-icon"><CalendarClock size={32} /></span>
        <strong>Chargement des emplois du temps…</strong>
        <span>Récupération des séances de la journée</span>
      </div> : sessions.length ? <div className="today-list">{sessions.map((session) => <article className={`today-session ${session.type}`} key={session._id}>
        <div className="session-time"><strong>{clock(session.startsAt)}</strong><span>{clock(session.endsAt)}</span></div>
        <div><span className="pill">{labels[session.type]}</span><h3>{session.subjectName}</h3><p>{isDoctor ? session.level?.name : `${session.doctor?.firstName || ''} ${session.doctor?.lastName || ''}`.trim()}</p></div>
        <div className="session-place"><span><MapPin size={16} />{session.room?.name}</span><span><CalendarDays size={16} />{when(session.startsAt)}</span></div>
      </article>)}</div> : !error && <div className="empty on-dark"><CalendarDays size={30} /><p>Pas de cours</p><span>Utilisez les flèches pour consulter une autre journée.</span></div>}
    </section>
  </div>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (user.role === 'contract_doctor') return <Navigate to="/contractors" replace />;
  return ['principal_admin', 'level_admin'].includes(user.role) ? <ManagementDashboard user={user} /> : <DailyDashboard user={user} />;
}
