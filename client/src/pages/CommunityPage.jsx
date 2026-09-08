import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  ImagePlus,
  MessageCircle,
  Paperclip,
  Reply,
  Search,
  Send,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import "./community.css";

const roleLabel = (person) => {
  if (person.certified) return "Docteur certifié";
  if (person.role === "local_doctor" || person.role === "contract_doctor")
    return "Docteur · certification en attente";
  if (person.role === "student" && person.level?.name)
    return `Aîné · ${person.level.name}`;
  return person.role === "student" ? "Étudiant" : "Membre";
};

function AuthorBadge({ person }) {
  const certified = Boolean(person.certified);
  return (
    <div className="forum-author-badge">
      <span className="avatar small">
        {person.firstName?.[0]}
        {person.lastName?.[0]}
      </span>
      <span>
        <strong>
          {person.firstName} {person.lastName}
        </strong>
        <small className={certified ? "doctor-label" : ""}>
          {certified && <BadgeCheck size={13} />}
          {roleLabel(person)}
        </small>
      </span>
    </div>
  );
}

function ImageGallery({ images = [], onOpen }) {
  if (!images.length) return null;
  return (
    <div className={`forum-gallery gallery-${Math.min(images.length, 3)}`}>
      {images.slice(0, 4).map((image, index) => (
        <button
          className="gallery-tile"
          key={`${image.url}-${index}`}
          type="button"
          onClick={() => onOpen(images, index)}
        >
          <img
            src={image.url}
            alt={image.name || "Illustration de la publication"}
          />
          {index === 3 && images.length > 4 && (
            <span>+{images.length - 4}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function LegacyImage({ post, onOpen }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!post.image?.name || post.images?.length) return undefined;
    let active = true;
    let url = "";
    api
      .blob(`/discussions/${post._id}/image`)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (active) setSource(url);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [post._id, post.image?.name, post.images?.length]);
  return source ? (
    <ImageGallery
      images={[{ url: source, name: post.image.name }]}
      onOpen={onOpen}
    />
  ) : null;
}

function CommentTree({
  comments,
  parent = null,
  post,
  canValidate,
  onReply,
  onAccept,
  onOpenGallery,
}) {
  return (
    <>
      {comments
        .filter(
          (comment) =>
            (comment.parent || null)?.toString() === parent?.toString(),
        )
        .map((comment) => (
          <div
            className={`forum-comment ${comment.accepted ? "is-accepted" : ""}`}
            key={comment._id}
          >
            <AuthorBadge person={comment.author} />
            {comment.accepted && (
              <span className="accepted-label">
                <CheckCircle2 size={14} /> Réponse validée par un docteur
              </span>
            )}
            <p>{comment.text}</p>
            <ImageGallery
              images={comment.images || []}
              onOpen={onOpenGallery}
            />
            <div className="comment-actions">
              <button
                className="link inline-link"
                type="button"
                onClick={() => onReply(post._id, comment._id)}
              >
                <Reply size={14} /> Répondre
              </button>
              {canValidate && !comment.accepted && (
                <button
                  className="link inline-link"
                  type="button"
                  onClick={() => onAccept(post._id, comment._id)}
                >
                  Valider cette réponse
                </button>
              )}
            </div>
            <div className="comment-replies">
              <CommentTree
                comments={comments}
                parent={comment._id}
                post={post}
                canValidate={canValidate}
                onReply={onReply}
                onAccept={onAccept}
                onOpenGallery={onOpenGallery}
              />
            </div>
          </div>
        ))}
    </>
  );
}

function ImagePicker({ files, setFiles, compact = false }) {
  return (
    <div className={`image-picker ${compact ? "compact" : ""}`}>
      <label className="image-picker-button">
        <ImagePlus size={16} /> {compact ? "Images" : "Ajouter des images"}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) =>
            setFiles(
              [...files, ...Array.from(event.target.files || [])].slice(0, 6),
            )
          }
        />
      </label>
      {!!files.length && (
        <div className="upload-previews">
          {files.map((file, index) => (
            <div className="upload-preview" key={`${file.name}-${index}`}>
              <img src={URL.createObjectURL(file)} alt="Aperçu" />
              <button
                type="button"
                title="Supprimer l’image"
                onClick={() =>
                  setFiles(files.filter((_, fileIndex) => fileIndex !== index))
                }
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {!compact && <small>6 images maximum · 5 Mo par image</small>}
    </div>
  );
}

function Lightbox({ viewer, onClose, onMove }) {
  if (!viewer) return null;
  const image = viewer.images[viewer.index];
  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button
        className="lightbox-close"
        type="button"
        onClick={onClose}
        aria-label="Fermer"
      >
        <X />
      </button>
      {viewer.images.length > 1 && (
        <button
          className="lightbox-arrow left"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMove(-1);
          }}
          aria-label="Image précédente"
        >
          <ChevronLeft />
        </button>
      )}
      <img
        src={image.url}
        alt={image.name || "Image agrandie"}
        onClick={(event) => event.stopPropagation()}
      />
      {viewer.images.length > 1 && (
        <button
          className="lightbox-arrow right"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMove(1);
          }}
          aria-label="Image suivante"
        >
          <ChevronRight />
        </button>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState({ subjects: [], levels: [] });
  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [filters, setFilters] = useState({
    subject: "",
    level: "",
    search: "",
    status: "",
  });
  const [question, setQuestion] = useState({
    subject: "",
    title: "",
    text: "",
  });
  const [questionImages, setQuestionImages] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [replyImages, setReplyImages] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const load = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const query = new URLSearchParams(
        Object.entries(nextFilters).filter(([, value]) => value),
      );
      const [catalogData, discussionData, notificationData] = await Promise.all(
        [
          api.get("/discussions/catalog"),
          api.get(`/discussions?${query}`),
          ["local_doctor", "contract_doctor"].includes(user.role)
            ? api.get("/notifications?unread=true")
            : Promise.resolve([]),
        ],
      );
      setCatalog(catalogData);
      setPosts(discussionData);
      setNotifications(notificationData);
    } catch (event) {
      setError(event.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const selectedSubject = useMemo(
    () => catalog.subjects.find((subject) => subject._id === filters.subject),
    [catalog.subjects, filters.subject],
  );
  const updateFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    load(next);
  };
  const openGallery = (images, index) => setViewer({ images, index });
  const moveViewer = (direction) =>
    setViewer((current) => ({
      ...current,
      index:
        (current.index + direction + current.images.length) %
        current.images.length,
    }));

  const publish = async (event) => {
    event.preventDefault();
    setError("");
    setPublishing(true);
    const body = new FormData();
    Object.entries(question).forEach(([key, value]) => body.append(key, value));
    questionImages.forEach((file) => body.append("images", file));
    try {
      await api.post("/discussions", body);
      setQuestion({ subject: "", title: "", text: "" });
      setQuestionImages([]);
      event.currentTarget.reset();
      await load();
    } catch (eventError) {
      setError(eventError.message);
    } finally {
      setPublishing(false);
    }
  };
  const submitComment = async (event, postId) => {
    event.preventDefault();
    const parent = replyTo?.postId === postId ? replyTo.commentId : undefined;
    const key = parent ? `${postId}-${parent}` : postId;
    const body = new FormData();
    body.append("text", drafts[key] || "");
    if (parent) body.append("parent", parent);
    (replyImages[key] || []).forEach((file) => body.append("images", file));
    try {
      await api.post(`/discussions/${postId}/comments`, body);
      setDrafts({ ...drafts, [key]: "" });
      setReplyImages({ ...replyImages, [key]: [] });
      setReplyTo(null);
      await load();
    } catch (eventError) {
      setError(eventError.message);
    }
  };
  const accept = async (postId, commentId) => {
    try {
      await api.post(`/discussions/${postId}/comments/${commentId}/accept`, {});
      await load();
    } catch (event) {
      setError(event.message);
    }
  };
  const markNotificationsRead = async () => {
    await Promise.all(
      notifications.map((notification) =>
        api.patch(`/notifications/${notification._id}/read`, {}),
      ),
    );
    setNotifications([]);
  };

  return (
    <div className="page community-page">
      <header className="community-hero">
        <div>
          <p className="eyebrow">CERCLE ACADÉMIQUE</p>
          <h1>Les questions qui font avancer.</h1>
          <p className="muted">
            Un espace de transmission entre étudiants, aînés et docteurs
            certifiés.
          </p>
        </div>
        <div className="forum-stat">
          <span>{posts.length}</span>
          <small>
            préoccupations
            <br />
            accessibles
          </small>
        </div>
      </header>
      {error && <div className="alert error">{error}</div>}
      {notifications.length > 0 && (
        <div className="forum-notification">
          <Bell size={18} />
          <div>
            <strong>
              {notifications.length} nouvelle
              {notifications.length > 1 ? "s" : ""} question
              {notifications.length > 1 ? "s" : ""}
            </strong>
            <span>
              Une matière que vous accompagnez a besoin de votre regard.
            </span>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={markNotificationsRead}
          >
            Marquer comme lues
          </button>
        </div>
      )}
      <section className="forum-navigation">
        <div className="level-context">
          <span className="context-label">Votre espace</span>
          <strong>{user.level?.name || "Toutes les matières assignées"}</strong>
          <span className="context-lock">Niveau géré automatiquement</span>
        </div>
        <div className="subject-tabs">
          <button
            className={!filters.subject ? "active" : ""}
            type="button"
            onClick={() => updateFilter("subject", "")}
          >
            <BookOpen size={15} /> Toutes
          </button>
          {catalog.subjects.map((subject) => (
            <button
              className={filters.subject === subject._id ? "active" : ""}
              type="button"
              key={subject._id}
              onClick={() => updateFilter("subject", subject._id)}
            >
              {subject.name}
            </button>
          ))}
        </div>
      </section>
      <div className="forum-toolbar">
        <div className="forum-search">
          <Search size={17} />
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            onKeyDown={(event) => event.key === "Enter" && load()}
            placeholder="Rechercher une question, une notion…"
          />
        </div>
        <select
          value={filters.status}
          onChange={(event) => updateFilter("status", event.target.value)}
          aria-label="Filtrer par statut"
        >
          <option value="">Toutes les questions</option>
          <option value="unanswered">Sans réponse</option>
          <option value="answered">Avec réponses</option>
          <option value="validated">Réponse validée</option>
        </select>
        <select
          value={filters.level}
          onChange={(event) => updateFilter("level", event.target.value)}
          aria-label="Filtrer par niveau"
        >
          <option value="">Tous les niveaux accessibles</option>
          {catalog.levels?.map((level) => (
            <option value={level._id} key={level._id}>
              {level.name}
            </option>
          ))}
        </select>
        <Filter size={17} className="toolbar-filter-icon" />
      </div>
      {user.role === "student" && (
        <section className="question-composer">
          <div className="composer-heading">
            <div>
              <span className="composer-kicker">NOUVELLE PRÉOCCUPATION</span>
              <h2>Faire circuler une difficulté</h2>
            
            </div>
            <div className="composer-mark">
              <MessageCircle size={23} />
            </div>
          </div>
          <form onSubmit={publish}>
            <div className="composer-grid">
              <label>
                Matière
                <select
                  required
                  value={question.subject}
                  onChange={(event) =>
                    setQuestion({ ...question, subject: event.target.value })
                  }
                >
                  <option value="">Choisir une matière</option>
                  {catalog.subjects.map((subject) => (
                    <option key={subject._id} value={subject._id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Titre de la préoccupation
                <input
                  required
                  minLength="4"
                  maxLength="140"
                  value={question.title}
                  onChange={(event) =>
                    setQuestion({ ...question, title: event.target.value })
                  }
                  placeholder="Ex. Comprendre l’intuition de la recherche dichotomique"
                />
              </label>
            </div>
            <label>
              Description détaillée
              <textarea
                required
                minLength="8"
                value={question.text}
                onChange={(event) =>
                  setQuestion({ ...question, text: event.target.value })
                }
                placeholder="Décrivez le point précis qui vous bloque, avec le contexte utile…"
              />
            </label>
            <div className="composer-footer">
              <ImagePicker
                files={questionImages}
                setFiles={setQuestionImages}
              />
              <button className="primary" disabled={publishing}>
                <Send size={17} />{" "}
                {publishing ? "Publication…" : "Publier la préoccupation"}
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="discussion-list">
        {loading ? (
          <div className="forum-loading">
            <span />
            <span />
            <span />
          </div>
        ) : (
          posts.map((post) => {
            const canValidate =
              ["local_doctor", "contract_doctor"].includes(user.role) &&
              user.certified &&
              post.subject?.assignments?.some(
                (assignment) =>
                  assignment.level === post.level?._id &&
                  assignment.doctors?.includes(user.id),
              );
            const replyKey =
              replyTo?.postId === post._id
                ? `${post._id}-${replyTo.commentId}`
                : post._id;
            return (
              <article className="forum-post" key={post._id}>
                <div className="post-meta">
                  <AuthorBadge person={post.author} />
                  <div className="post-context">
                    <span>{post.level?.name || "Niveau académique"}</span>
                    <span>{post.subject?.name}</span>
                    <time>
                      {new Date(post.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                  </div>
                </div>
                <div className="post-heading">
                  <div>
                    <h2>{post.title || "Préoccupation sans titre"}</h2>
                    <p>{post.text}</p>
                  </div>
                  {post.hasAcceptedAnswer && (
                    <span className="status-chip validated">
                      <CheckCircle2 size={14} /> Validée
                    </span>
                  )}
                </div>
                <ImageGallery images={post.images || []} onOpen={openGallery} />
                <LegacyImage post={post} onOpen={openGallery} />
                <div className="post-footer">
                  <span>
                    <MessageCircle size={15} />{" "}
                    {post.commentCount || post.comments?.length || 0} réponse
                    {(post.commentCount || post.comments?.length || 0) > 1
                      ? "s"
                      : ""}
                  </span>
                  <span>
                    <Paperclip size={14} /> {post.images?.length || 0} image
                    {post.images?.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="forum-comments">
                  <CommentTree
                    comments={post.comments || []}
                    post={post}
                    canValidate={canValidate}
                    onReply={(postId, commentId) =>
                      setReplyTo({ postId, commentId })
                    }
                    onAccept={accept}
                    onOpenGallery={openGallery}
                  />
                </div>
                <form
                  className="forum-reply"
                  onSubmit={(event) => submitComment(event, post._id)}
                >
                  {replyTo?.postId === post._id && (
                    <span className="replying-to">
                      Réponse ciblée{" "}
                      <button type="button" onClick={() => setReplyTo(null)}>
                        Annuler
                      </button>
                    </span>
                  )}
                  <input
                    required
                    value={drafts[replyKey] || ""}
                    onChange={(event) =>
                      setDrafts({ ...drafts, [replyKey]: event.target.value })
                    }
                    placeholder={
                      replyTo?.postId === post._id
                        ? "Écrire une réponse…"
                        : "Partager une explication…"
                    }
                  />
                  <ImagePicker
                    compact
                    files={replyImages[replyKey] || []}
                    setFiles={(files) =>
                      setReplyImages({ ...replyImages, [replyKey]: files })
                    }
                  />
                  <button title="Envoyer" aria-label="Envoyer">
                    <Send size={17} />
                  </button>
                </form>
              </article>
            );
          })
        )}
        {!loading && !posts.length && (
          <div className="forum-empty">
            <MessageCircle size={30} />
            <h2>
              {selectedSubject
                ? `Rien dans ${selectedSubject.name}, pour l’instant.`
                : "Le fil est encore silencieux."}
            </h2>
            <p>Essayez une autre matière ou lancez la première discussion.</p>
          </div>
        )}
      </section>
      <Lightbox
        viewer={viewer}
        onClose={() => setViewer(null)}
        onMove={moveViewer}
      />
    </div>
  );
}
