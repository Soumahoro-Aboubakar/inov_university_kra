import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, Pencil, Send, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ConflictDetails } from '../components/ConflictDetails';

const statusLabels = { draft: 'Brouillon', submitted: 'Soumis', returned: 'Renvoyé', validated: 'Validé', published: 'Publié' };

export default function ReviewPage() {
  const [schedules, setSchedules] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const navigate = useNavigate();

  const load = () => api.get('/schedules').then(setSchedules).catch((event) => setError(event.message));
  useEffect(() => {
    load();
  }, []);
  const details = async (id) => {
    setError(''); setConflicts([]);
    const [data, conflictData] = await Promise.all([
      api.get(`/schedules/${id}`),
      api.get(`/schedules/${id}/conflicts`),
    ]);
    setSelected(data);
    setConflicts(conflictData.conflicts || []);
    setNotes(data.schedule.externalCheck?.notes || '');
  };
  const run = async (path, success) => {
    if (!selected) return;
    setError(''); setMessage(''); setConflicts([]);
    try {
      await api.post(path, {});
      setMessage(success);
      await details(selected.schedule._id);
      load();
    } catch (event) {
      setError(event.message);
      setConflicts(event.payload?.conflicts || []);
    }
  };
  const check = async () => {
    if (!selected) return;
    setError(''); setMessage('');
    try {
      await api.post(`/schedules/${selected.schedule._id}/external-check`, { notes });
      setMessage('Vérification externe enregistrée.');
      await details(selected.schedule._id);
    } catch (event) { setError(event.message); }
  };
  const status = selected?.schedule.status;

  return <div className="page">
    <header className="page-header"><div><p className="eyebrow">SECRÉTARIAT PRINCIPAL</p><h1>Centre de validation</h1><p className="muted">Vérifiez, validez, puis publiez les propositions sans conflit interne.</p></div></header>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    <div className="review-layout">
      <section className="card"><h2>Propositions à traiter</h2><div className="review-list">{schedules.map((schedule) => <button className={selected?.schedule._id === schedule._id ? 'selected' : ''} key={schedule._id} onClick={() => details(schedule._id)}><div><strong>{schedule.level?.name}</strong><span>Mis à jour le {new Date(schedule.updatedAt).toLocaleDateString('fr-FR')}</span></div><span className={`status ${schedule.status}`}>{statusLabels[schedule.status]}</span></button>)}{!schedules.length && <div className="empty"><Send size={26} /><p>Aucune proposition.</p></div>}</div></section>
      <section className="card review-detail">{selected ? <>
        <div className="section-heading"><div><h2>{selected.schedule.level?.name}</h2><p className="muted">{selected.sessions.length} créneau(x) · statut : {statusLabels[status]}</p></div><button className="secondary" onClick={() => navigate(`/schedules?focus=${selected.schedule._id}${selected.sessions[0] ? `&focusSession=${selected.sessions[0]._id}` : ''}`)}><Pencil size={16} /> Ouvrir pour corriger</button></div>
        <ConflictDetails conflicts={conflicts} onOpenSchedule={(scheduleId, sessionId) => navigate(`/schedules?focus=${scheduleId}${sessionId ? `&focusSession=${sessionId}` : ''}`)} />
        {['submitted', 'validated'].includes(status) && <div className="check-panel"><h3>Vérification externe manuelle</h3><p>Consignez la vérification des réservations hors plateforme. Elle est obligatoire avant publication.</p><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex. Salle 201 disponible auprès de la faculté de droit." /><button className="secondary" onClick={check}><Eye size={17} /> Confirmer la vérification</button>{selected.schedule.externalCheck?.checked && <div className="alert success">Vérifié le {new Date(selected.schedule.externalCheck.checkedAt).toLocaleString('fr-FR')}.</div>}</div>}
        <div className="split-actions">
          {status === 'submitted' && <button className="primary" onClick={() => run(`/schedules/${selected.schedule._id}/validate`, 'Proposition validée.')}><CheckCircle2 size={17} /> Valider</button>}
          {status === 'validated' && <button className="primary" onClick={() => run(`/schedules/${selected.schedule._id}/publish`, 'Emploi du temps publié.')}><Send size={17} /> Publier</button>}
          {status === 'draft' && selected.schedule.createdBy?.role === 'principal_admin' && <button className="primary" onClick={() => run(`/schedules/${selected.schedule._id}/publish`, 'Emploi du temps publié directement.')}><Send size={17} /> Publier directement</button>}
          {['submitted', 'validated'].includes(status) && <button className="secondary" onClick={() => run(`/schedules/${selected.schedule._id}/return`, 'Proposition renvoyée au responsable de niveau.')}><Undo2 size={17} /> Renvoyer</button>}
        </div>
      </> : <div className="empty"><Eye size={28} /><p>Sélectionnez une proposition.</p></div>}</section>
    </div>
  </div>;
}
