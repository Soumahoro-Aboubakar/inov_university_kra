import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, CircleAlert, Clock3, Eye, FileCheck2, Pencil, Search, Send, Undo2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ConflictDetails } from '../components/ConflictDetails';

const statusLabels = { draft: 'Brouillon', submitted: 'Soumis', returned: 'Renvoyé', validated: 'Validé', published: 'Publié' };
const statusDescriptions = { draft: 'À compléter', submitted: 'En attente de validation', returned: 'À corriger', validated: 'Prêt à publier', published: 'Diffusé' };
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const pageStyles = `
  .review-workspace{--review-ink:#18343d;--review-muted:#6d8084;--review-line:#e5ecea;--review-soft:#f6f9f7;display:grid;grid-template-columns:minmax(300px,390px) minmax(0,1fr);gap:18px;min-height:min(720px,calc(100vh - 255px));height:calc(100vh - 255px);max-height:820px}
  .review-column,.review-inspector{min-height:0;border:1px solid var(--review-line);background:#fff;border-radius:18px;box-shadow:0 14px 35px rgba(26,57,64,.06)}
  .review-column{display:flex;flex-direction:column;overflow:hidden}.review-column-header{padding:22px 22px 16px;border-bottom:1px solid var(--review-line)}
  .review-column-header h2{margin:0;font-size:17px;color:var(--review-ink)}.review-count{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 7px;margin-left:6px;border-radius:8px;background:#edf4df;color:#466019;font:600 12px 'DM Mono',monospace}
  .review-column-header p{margin:7px 0 0;color:var(--review-muted);font-size:12px}.review-search{display:flex;align-items:center;gap:9px;margin-top:17px;padding:10px 12px;border:1px solid var(--review-line);border-radius:10px;color:#789095;background:var(--review-soft)}
  .review-search:focus-within{border-color:#9ab6a8;box-shadow:0 0 0 3px rgba(154,182,168,.18)}.review-search input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:var(--review-ink);font-size:12px}.review-list{padding:10px;overflow-y:auto;overscroll-behavior:contain;flex:1}
  .review-item{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 12px;margin-bottom:4px;text-align:left;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--review-ink);transition:background .16s ease,border-color .16s ease,transform .16s ease}.review-item:hover{background:#f7faf8;border-color:var(--review-line);transform:translateX(2px)}.review-item:focus-visible{outline:3px solid rgba(201,231,99,.8);outline-offset:2px}.review-item.selected{background:#eff6e2;border-color:#cddda9;box-shadow:inset 3px 0 #90b43a}.review-item-copy{min-width:0;display:grid;gap:5px}.review-item-copy strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-item-copy span{font-size:11px;color:var(--review-muted)}.review-item-meta{display:flex;align-items:center;gap:7px;flex-shrink:0}.review-item-meta svg{color:#91a2a0;transition:transform .16s ease}.review-item:hover .review-item-meta svg,.review-item.selected .review-item-meta svg{transform:translateX(2px);color:#587632}
  .review-status{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;padding:5px 7px;border-radius:6px;font:500 10px 'DM Mono',monospace}.review-status.submitted{background:#fff2d2;color:#946a12}.review-status.validated{background:#dff2e7;color:#286849}.review-status.returned{background:#ffe3e0;color:#a34b42}.review-status.draft{background:#edf0f0;color:#657577}.review-status.published{background:#e4edf7;color:#40678d}
  .review-inspector{display:flex;flex-direction:column;overflow:hidden}.review-inspector-scroll{overflow-y:auto;min-height:0;padding:26px 28px}.review-inspector-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:22px;border-bottom:1px solid var(--review-line)}.review-kicker{margin:0 0 7px;color:#759096;font:500 10px 'DM Mono',monospace;letter-spacing:1.1px;text-transform:uppercase}.review-inspector h2{margin:0 0 8px;font-size:25px;letter-spacing:-.8px;color:var(--review-ink)}.review-subtitle{display:flex;align-items:center;gap:9px;margin:0;color:var(--review-muted);font-size:12px}.review-subtitle strong{color:var(--review-ink)}.review-action{display:inline-flex;align-items:center;gap:7px;flex-shrink:0}.review-section-label{display:flex;align-items:center;gap:8px;margin:23px 0 10px;color:#6f8588;font:500 10px 'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase}.review-section-label:after{content:'';height:1px;flex:1;background:var(--review-line)}.review-check-panel{padding:17px;border:1px solid #e3eacb;border-radius:13px;background:#fbfdf4}.review-check-panel h3{margin:0 0 6px;font-size:14px}.review-check-panel p{margin:0 0 13px;color:var(--review-muted);font-size:12px;line-height:1.6}.review-check-panel textarea{display:block;width:100%;min-height:82px;resize:vertical;margin-bottom:11px;padding:11px;border:1px solid #dbe6d2;border-radius:9px;outline:0;background:#fff;color:var(--review-ink);font-size:12px}.review-check-panel textarea:focus{border-color:#98b66c;box-shadow:0 0 0 3px rgba(152,182,108,.16)}.review-verified{display:flex;align-items:center;gap:6px;margin-top:12px;color:#2e7654;font-size:11px}.review-actions{display:flex;align-items:center;gap:10px;padding:20px 28px;border-top:1px solid var(--review-line);background:#fbfcfb}.review-empty{display:grid;place-items:center;align-content:center;gap:10px;min-height:100%;padding:32px;text-align:center;color:var(--review-muted)}.review-empty svg{color:#a0b5ad}.review-empty p{margin:0;font-size:13px}.review-empty small{font-size:11px}.review-mobile-close{display:none}
  .review-alert{margin-bottom:14px}
  @media(max-width:900px){.review-workspace{grid-template-columns:minmax(260px,330px) minmax(0,1fr);gap:12px}.review-inspector-scroll{padding:22px 20px}.review-actions{padding:16px 20px}.review-inspector h2{font-size:21px}.review-action{padding:9px}}
  @media(max-width:720px){.review-workspace{display:block;height:auto;min-height:0;max-height:none}.review-column{min-height:calc(100vh - 245px);max-height:calc(100vh - 245px)}.review-inspector{position:fixed;inset:64px 0 0;z-index:12;border:0;border-radius:0;box-shadow:0 20px 50px rgba(16,44,52,.22);transform:translateY(105%);visibility:hidden;transition:transform .22s ease,visibility .22s ease}.review-inspector.mobile-open{transform:translateY(0);visibility:visible}.review-mobile-close{display:inline-flex;align-items:center;justify-content:center;padding:8px;border:1px solid var(--review-line);border-radius:8px;background:#fff;color:var(--review-ink)}.review-inspector-scroll{padding:20px 18px 24px}.review-inspector-top{padding-bottom:17px}.review-inspector h2{font-size:22px}.review-actions{padding:14px 18px;flex-wrap:wrap}.review-actions button{flex:1;justify-content:center}.review-action{display:none}.review-item:hover{transform:none}}
`;

export default function ReviewPage() {
  const [schedules, setSchedules] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [query, setQuery] = useState('');
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
  const filteredSchedules = schedules.filter((schedule) => {
    const term = query.trim().toLowerCase();
    return !term || `${schedule.level?.name || ''} ${statusLabels[schedule.status] || ''}`.toLowerCase().includes(term);
  });
  const selectSchedule = (id) => details(id);

  return <div className="page">
    <style>{pageStyles}</style>
    <header className="page-header"><div><p className="eyebrow">SECRÉTARIAT PRINCIPAL</p><h1>Centre de validation</h1><p className="muted">Vérifiez, validez, puis publiez les propositions sans conflit interne.</p></div></header>
    {error && <div className="alert error review-alert">{error}</div>}
    {message && <div className="alert success review-alert">{message}</div>}
    <div className="review-workspace">
      <section className="review-column" aria-label="Propositions à traiter"><div className="review-column-header"><h2>Propositions <span className="review-count">{schedules.length}</span></h2><p>À vérifier et à publier</p><label className="review-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un niveau..." aria-label="Rechercher une proposition" /></label></div><div className="review-list">{filteredSchedules.map((schedule) => <button type="button" className={`review-item ${selected?.schedule._id === schedule._id ? 'selected' : ''}`} key={schedule._id} onClick={() => selectSchedule(schedule._id)} aria-current={selected?.schedule._id === schedule._id ? 'true' : undefined}><span className="review-item-copy"><strong>{schedule.level?.name || 'Niveau sans nom'}</strong><span>Mis à jour le {dateFormatter.format(new Date(schedule.updatedAt))}</span></span><span className="review-item-meta"><span className={`review-status ${schedule.status}`}><Clock3 size={11} />{statusLabels[schedule.status]}</span><ChevronRight size={15} /></span></button>)}{!filteredSchedules.length && <div className="review-empty"><Send size={26} /><p>{query ? 'Aucun résultat.' : 'Aucune proposition.'}</p><small>{query ? 'Essayez un autre terme de recherche.' : 'Les nouvelles propositions apparaîtront ici.'}</small></div>}</div></section>
      <section className={`review-inspector ${selected ? 'mobile-open' : ''}`} aria-label="Détails de la proposition"><div className="review-inspector-scroll">{selected ? <>
        <div className="review-inspector-top"><div><p className="review-kicker">Proposition sélectionnée</p><h2>{selected.schedule.level?.name || 'Niveau sans nom'}</h2><p className="review-subtitle"><span className={`review-status ${status}`}><FileCheck2 size={11} />{statusLabels[status]}</span><span>·</span><strong>{selected.sessions.length}</strong> créneau(x)<span>·</span><span>{statusDescriptions[status]}</span></p></div><div className="review-action"><button className="secondary" onClick={() => navigate(`/schedules?focus=${selected.schedule._id}${selected.sessions[0] ? `&focusSession=${selected.sessions[0]._id}` : ''}`)}><Pencil size={16} /> Corriger</button></div><button type="button" className="review-mobile-close" onClick={() => setSelected(null)} aria-label="Fermer les détails"><X size={17} /></button></div>
        {conflicts.length > 0 && <p className="review-section-label"><CircleAlert size={14} /> Attention requise</p>}
        <ConflictDetails conflicts={conflicts} onOpenSchedule={(scheduleId, sessionId) => navigate(`/schedules?focus=${scheduleId}${sessionId ? `&focusSession=${sessionId}` : ''}`)} />
        {['submitted', 'validated'].includes(status) && <div className="review-check-panel"><h3>Vérification externe manuelle</h3><p>Consignez la vérification des réservations hors plateforme. Elle est obligatoire avant publication.</p><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex. Salle 201 disponible auprès de la faculté de droit." /><button className="secondary" onClick={check}><Eye size={17} /> Confirmer la vérification</button>{selected.schedule.externalCheck?.checked && <div className="review-verified"><CheckCircle2 size={14} /> Vérifié le {new Date(selected.schedule.externalCheck.checkedAt).toLocaleString('fr-FR')}</div>}</div>}
      </> : <div className="review-empty"><Eye size={28} /><p>Sélectionnez une proposition</p><small>Ses détails et ses actions resteront accessibles ici.</small></div>}</div>{selected && <div className="review-actions">
          {status === 'submitted' && <button className="primary" onClick={() => run(`/schedules/${selected.schedule._id}/validate`, 'Proposition validée.')}><CheckCircle2 size={17} /> Valider</button>}
          {status === 'validated' && <button className="primary" onClick={() => run(`/schedules/${selected.schedule._id}/publish`, 'Emploi du temps publié.')}><Send size={17} /> Publier</button>}
          {status === 'draft' && selected.schedule.createdBy?.role === 'principal_admin' && <button className="primary" onClick={() => run(`/schedules/${selected.schedule._id}/publish`, 'Emploi du temps publié directement.')}><Send size={17} /> Publier directement</button>}
          {['submitted', 'validated'].includes(status) && <button className="secondary" onClick={() => run(`/schedules/${selected.schedule._id}/return`, 'Proposition renvoyée au responsable de niveau.')}><Undo2 size={17} /> Renvoyer</button>}
        </div>}</section>
    </div>
  </div>;
}
