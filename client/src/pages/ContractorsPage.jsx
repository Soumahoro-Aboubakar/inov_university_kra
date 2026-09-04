import { useEffect, useState } from 'react';
import { Download, FileUp, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ContractorsPage() {
  const { user } = useAuth();
  const isPrincipal = user.role === 'principal_admin';
  const [users, setUsers] = useState([]); const [history, setHistory] = useState([]); const [file, setFile] = useState(null); const [form, setForm] = useState({ recipient: '', subject: '' }); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = async () => {
    const historyPromise = api.get('/contractors/history');
    if (isPrincipal) setUsers(await api.get('/users'));
    setHistory(await historyPromise);
  };
  useEffect(() => { load().catch((event) => setError(event.message)); }, [isPrincipal]);
  const submit = async (event) => {
    event.preventDefault(); if (!file) return setError('Choisissez le document signé.');
    const body = new FormData(); body.append('recipient', form.recipient); body.append('subject', form.subject); body.append('document', file);
    try { await api.post('/contractors/dispatches', body); setMessage('E-mail envoyé et historisé.'); setForm({ recipient: '', subject: '' }); setFile(null); load(); } catch (eventError) { setError(eventError.message); }
  };
  const contractors = users.filter((account) => account.role === 'contract_doctor');
  return <div className="page"><header className="page-header"><div><p className="eyebrow">VACATAIRES</p><h1>{isPrincipal ? 'Documents et historique' : 'Mes documents reçus'}</h1><p className="muted">{isPrincipal ? 'Transmission et suivi des documents signés.' : 'Consultez l’historique des documents qui vous ont été transmis.'}</p></div></header>
    <div className={isPrincipal ? 'communication-layout' : 'contractor-history-only'}>{isPrincipal && <section className="card"><h2>Nouvel envoi</h2>{error && <div className="alert error">{error}</div>}{message && <div className="alert success">{message}</div>}<form onSubmit={submit}><label>Docteur vacataire<select required value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })}><option value="">Sélectionner</option>{contractors.map((account) => <option key={account._id} value={account._id}>{account.firstName} {account.lastName} · {account.email}</option>)}</select></label><label>Objet<input required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Convention d’enseignement signée" /></label><label className="file-input"><FileUp size={20} /><span>{file?.name || 'Choisir le document signé (PDF, Word, Excel)'}</span><input required type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files[0])} /></label><button className="primary wide"><Send size={17} /> Envoyer l’e-mail</button></form></section>}
      <section className="card"><h2>{isPrincipal ? 'Envois récents' : 'Historique'}</h2>{!isPrincipal && error && <div className="alert error">{error}</div>}<div className="history">{history.map((item) => <article key={item._id}><span className="history-icon"><FileUp /></span><div><strong>{item.subject}</strong><p>{isPrincipal ? `${item.recipient?.firstName || ''} ${item.recipient?.lastName || ''} · ` : ''}{item.file?.name}</p><small>{new Date(item.sentAt).toLocaleString('fr-FR')}</small>{item.file?.name && <button className="text-button download-document" onClick={() => api.download(`/contractors/dispatches/${item._id}/document`, item.file.name)}><Download size={14} /> Télécharger le document</button>}</div></article>)}{!history.length && <div className="empty"><FileUp size={25} /><p>Aucun document reçu.</p></div>}</div></section>
    </div>
  </div>;
}
