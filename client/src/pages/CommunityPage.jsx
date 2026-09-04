import { useEffect, useState } from 'react';
import { BadgeCheck, Bell, CheckCircle2, ImagePlus, MessageCircle, Reply, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

function CommentTree({ comments, parent = null, post, isReferenceDoctor, onSend, onAccept }) {
  return <>{comments.filter((comment) => (comment.parent || null) === parent).map((comment) => <div className={`comment ${comment.accepted ? 'accepted' : ''}`} key={comment._id}>
    <div><strong>{comment.author.firstName} {comment.author.lastName}</strong>{comment.certified && <span className="certified"><BadgeCheck size={15} /> Docteur référent</span>}{comment.accepted && <span className="accepted-label"><CheckCircle2 size={15} /> Bonne réponse</span>}</div><p>{comment.text}</p>
    <div className="comment-actions"><button className="link inline-link" onClick={() => onSend(post._id, comment._id)}><Reply size={14} /> Répondre</button>{isReferenceDoctor && !comment.accepted && <button className="link inline-link" onClick={() => onAccept(post._id, comment._id)}>Valider cette réponse</button>}</div>
    <div className="comment-replies"><CommentTree comments={comments} parent={comment._id} post={post} isReferenceDoctor={isReferenceDoctor} onSend={onSend} onAccept={onAccept} /></div>
  </div>)}</>;
}

function DiscussionImage({ post }) {
  const [source, setSource] = useState(post.imageUrl || '');
  useEffect(() => {
    if (!post.image?.name || post.imageUrl) return undefined;
    let active = true;
    let url = '';
    api.blob(`/discussions/${post._id}/image`).then((blob) => {
      url = URL.createObjectURL(blob);
      if (active) setSource(url);
    }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [post._id, post.image?.name, post.imageUrl]);
  return source ? <img className="discussion-image" src={source} alt="Illustration associée à la question" /> : null;
}

export default function CommunityPage() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState({ subjects: [] }); const [posts, setPosts] = useState([]); const [notifications, setNotifications] = useState([]); const [question, setQuestion] = useState({ subject: '', text: '', image: null }); const [drafts, setDrafts] = useState({}); const [replyTo, setReplyTo] = useState(null); const [error, setError] = useState('');
  const load = async () => { const requests = [api.get('/catalog'), api.get('/discussions')]; if (user.role === 'local_doctor') requests.push(api.get('/notifications?unread=true')); const [catalogData, discussionData, notificationData = []] = await Promise.all(requests); setCatalog(catalogData); setPosts(discussionData); setNotifications(notificationData); };
  useEffect(() => { load().catch((event) => setError(event.message)); }, []);
  const post = async (event) => { event.preventDefault(); setError(''); const body = new FormData(); body.append('subject', question.subject); body.append('text', question.text); if (question.image) body.append('image', question.image); try { await api.post('/discussions', body); setQuestion({ subject: '', text: '', image: null }); event.currentTarget.reset(); load(); } catch (eventError) { setError(eventError.message); } };
  const submitComment = async (event, postId) => { event.preventDefault(); const parent = replyTo?.postId === postId ? replyTo.commentId : undefined; const key = parent ? `${postId}-${parent}` : postId; try { await api.post(`/discussions/${postId}/comments`, { text: drafts[key], parent }); setDrafts({ ...drafts, [key]: '' }); setReplyTo(null); load(); } catch (eventError) { setError(eventError.message); } };
  const prepareReply = (postId, commentId) => setReplyTo({ postId, commentId });
  const accept = async (postId, commentId) => { try { await api.post(`/discussions/${postId}/comments/${commentId}/accept`, {}); load(); } catch (event) { setError(event.message); } };
  const markNotificationsRead = async () => { await Promise.all(notifications.map((notification) => api.patch(`/notifications/${notification._id}/read`, {}))); setNotifications([]); };
  return <div className="page"><header className="page-header"><div><p className="eyebrow">ENTRAIDE PÉDAGOGIQUE</p><h1>Préoccupations</h1><p className="muted">Posez vos questions, échangez et identifiez clairement la réponse validée.</p></div></header>{error && <div className="alert error">{error}</div>}{user.role === 'local_doctor' && notifications.length > 0 && <div className="alert success notification-alert"><Bell size={17} /><div><strong>{notifications.length} nouvelle{notifications.length > 1 ? 's' : ''} question{notifications.length > 1 ? 's' : ''}</strong><br />Vos matières comportent de nouvelles préoccupations à consulter.</div><button className="text-button" onClick={markNotificationsRead}>Marquer comme lues</button></div>}
    {user.role === 'student' && <section className="card question-form"><h2>Une question sur un cours ?</h2><form onSubmit={post}><select required value={question.subject} onChange={(event) => setQuestion({ ...question, subject: event.target.value })}><option value="">Choisir une matière</option>{catalog.subjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}</select><textarea required minLength="8" value={question.text} onChange={(event) => setQuestion({ ...question, text: event.target.value })} placeholder="Décrivez votre question avec le plus de contexte possible…" /><div className="question-actions"><label className="image-upload"><ImagePlus size={16} /> Image (facultatif, 5 Mo max)<input type="file" accept="image/*" onChange={(event) => setQuestion({ ...question, image: event.target.files[0] || null })} /></label><button className="primary"><Send size={17} /> Publier la question</button></div></form></section>}
    <section className="discussion-list">{posts.map((post) => { const isReferenceDoctor = user.role === 'local_doctor' && post.subject.doctors?.some((doctor) => (doctor._id || doctor) === user.id); const replyKey = replyTo?.postId === post._id ? `${post._id}-${replyTo.commentId}` : post._id; return <article className="discussion card" key={post._id}><div className="discussion-head"><div className="avatar small">{post.author.firstName[0]}{post.author.lastName[0]}</div><div><strong>{post.author.firstName} {post.author.lastName}</strong><span>{post.subject.name} · {new Date(post.createdAt).toLocaleDateString('fr-FR')}</span></div></div><p className="post-text">{post.text}</p><DiscussionImage post={post} />
      <div className="comments"><CommentTree comments={post.comments} post={post} isReferenceDoctor={isReferenceDoctor} onSend={prepareReply} onAccept={accept} /></div><form className="comment-form" onSubmit={(event) => submitComment(event, post._id)}>{replyTo?.postId === post._id && <span className="replying-to">Réponse à un commentaire <button type="button" onClick={() => setReplyTo(null)}>Annuler</button></span>}<input required value={drafts[replyKey] || ''} onChange={(event) => setDrafts({ ...drafts, [replyKey]: event.target.value })} placeholder={replyTo?.postId === post._id ? 'Écrire une réponse…' : 'Ajouter un commentaire…'} /><button title="Envoyer"><MessageCircle size={18} /></button></form></article>; })}{!posts.length && <div className="empty"><MessageCircle size={28} /><p>Aucune question pour le moment.</p></div>}</section>
  </div>;
}
