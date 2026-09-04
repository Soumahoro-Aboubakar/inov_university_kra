import { useEffect, useState } from 'react';
import { Mail, Send, Smartphone, UsersRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function CommunicationsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ channel: 'sms', audience: user.role === 'level_admin' ? 'level_students' : 'all_students', subject: '', body: '', recipientIds: [] });
  const [mode, setMode] = useState('broadcast');
  const [recipients, setRecipients] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    const [recipientList, messageList] = await Promise.all([api.get('/communications/recipients'), api.get('/communications')]);
    setRecipients(recipientList); setHistory(messageList);
  };
  useEffect(() => { load().catch((event) => setError(event.message)); }, []);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    const payload = { channel: form.channel, body: form.body, ...(form.channel === 'email' ? { subject: form.subject } : {}), ...(mode === 'targeted' ? { recipientIds: form.recipientIds } : { audience: form.audience }) };
    try {
      await api.post('/communications', payload);
      setForm((current) => ({ ...current, body: '', subject: '', recipientIds: [] }));
      setMessage('Message envoyé.'); load();
    } catch (eventError) { setError(eventError.message); }
  };
  const selectRecipients = (event) => setForm((current) => ({ ...current, recipientIds: [...event.target.selectedOptions].map((option) => option.value) }));

  return <div className="page">
    <header className="page-header"><div><p className="eyebrow">COMMUNICATION</p><h1>Informer au bon moment</h1><p className="muted">Le SMS reste le canal prioritaire pour un changement urgent.</p></div></header>
    <div className="communication-layout"><section className="card"><h2>Nouveau message</h2>{error && <div className="alert error">{error}</div>}{message && <div className="alert success">{message}</div>}<form onSubmit={submit}>
      <div className="channel-toggle"><button type="button" className={form.channel === 'sms' ? 'active' : ''} onClick={() => setForm({ ...form, channel: 'sms' })}><Smartphone size={17} /> SMS</button>{user.role === 'principal_admin' && <button type="button" className={form.channel === 'email' ? 'active' : ''} onClick={() => setForm({ ...form, channel: 'email' })}><Mail size={17} /> E-mail</button>}</div>
      <div className="delivery-mode"><button type="button" className={mode === 'broadcast' ? 'active' : ''} onClick={() => setMode('broadcast')}><UsersRound size={15} /> Diffusion</button><button type="button" className={mode === 'targeted' ? 'active' : ''} onClick={() => setMode('targeted')}><UsersRound size={15} /> Destinataires ciblés</button></div>
      {mode === 'broadcast' ? <label>Audience<select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>{user.role === 'principal_admin' ? <><option value="all_students">Tous les étudiants</option><option value="all_doctors">Tous les docteurs</option><option value="all_users">Toute la plateforme</option></> : <option value="level_students">Étudiants de mon niveau</option>}</select></label> : <label>Destinataires <span className="field-help">Maintenez Ctrl/Cmd pour en sélectionner plusieurs.</span><select required multiple value={form.recipientIds} onChange={selectRecipients}>{recipients.map((recipient) => <option key={recipient._id} value={recipient._id}>{recipient.firstName} {recipient.lastName} · {recipient.role === 'student' ? recipient.level?.name || 'Étudiant' : recipient.role}</option>)}</select></label>}
      {form.channel === 'email' && <label>Objet<input required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>}
      <label>Message<textarea required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Votre information importante…" /></label><button className="primary wide"><Send size={17} /> Envoyer maintenant</button>
    </form></section><section className="card"><h2>Historique</h2><div className="history">{history.map((item) => <article key={item._id}><span className="history-icon">{item.channel === 'sms' ? <Smartphone /> : <Mail />}</span><div><strong>{item.subject || 'SMS académique'}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString('fr-FR')} · {item.status}</small></div></article>)}{!history.length && <div className="empty"><Mail size={25} /><p>Aucun envoi enregistré.</p></div>}</div></section></div>
  </div>;
}
