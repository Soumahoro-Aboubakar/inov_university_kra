import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { WeekGrid } from "../components/Timetable";
import { ConflictDetails, getCurrentSessionFacts } from "../components/ConflictDetails";
import { useAuth } from "../context/AuthContext";
import { getWeekStart } from "../lib/scheduleUtils";

const blank = {
  subjectName: "",
  subject: "",
  doctor: "",
  room: "",
  startsAt: "",
  endsAt: "",
  type: "course",
};

const TYPE_OPTIONS = [
  { value: "course", label: "Cours" },
  { value: "tutorial", label: "TD" },
  { value: "lab", label: "TP" },
  { value: "exam", label: "Examen" },
  { value: "quiz", label: "Interrogation" },
  { value: "other", label: "Autre" },
];

const typeLabel = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));

const toLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fmt = (value) =>
  new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ScheduleBuilderPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedSchedule = searchParams.get("focus");
  const requestedSession = searchParams.get("focusSession");
  const [catalog, setCatalog] = useState({
    levels: [],
    rooms: [],
    subjects: [],
    doctors: [],
  });
  const [schedules, setSchedules] = useState([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState(null);
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [focusedSessionId, setFocusedSessionId] = useState(requestedSession || "");

  // --- Modal state (remplace l'ancien formulaire empilé) ---
  const [modalOpen, setModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleLevel, setScheduleLevel] = useState("");
  const [publicationIntent, setPublicationIntent] = useState("draft");
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [modalConflicts, setModalConflicts] = useState([]);

  const [message, setMessage] = useState("");
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState("");

  const firstFieldRef = useRef(null);

  const refreshDetail = async (scheduleId, requestedWeek = weekStart) => {
    if (!scheduleId) {
      setDetail(null);
      setConflicts([]);
      return;
    }
    const [scheduleDetail, conflictData] = await Promise.all([
      api.get(`/schedules/${scheduleId}?weekStart=${encodeURIComponent(requestedWeek.toISOString())}`),
      api.get(`/schedules/${scheduleId}/conflicts`),
    ]);
    setDetail(scheduleDetail);
    setConflicts(conflictData.conflicts || []);
  };

  const load = async () => {
    const [c, list] = await Promise.all([
      api.get("/catalog"),
      api.get("/schedules"),
    ]);
    setCatalog(c);
    setSchedules(list);

    const requestedExists = !requestedSchedule || list.some((schedule) => schedule._id === requestedSchedule);
    if (!requestedExists) {
      setSelected("");
      setDetail(null);
      setError("L’emploi du temps demandé est introuvable.");
      return;
    }
    const candidate = requestedSchedule || selected || list[0]?._id;
    if (candidate) {
      setSelected(candidate);
      const fullDetail = await api.get(`/schedules/${candidate}`);
      const focus = fullDetail.sessions.find((session) => session._id === requestedSession) || (requestedSchedule ? fullDetail.sessions[0] : null);
      const targetWeek = focus ? getWeekStart(focus.startsAt) : getWeekStart();
      setFocusedSessionId(focus?._id || "");
      setWeekStart(targetWeek);
      await refreshDetail(candidate, targetWeek);
    }
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [requestedSchedule, requestedSession]);

  const changeWeek = async (offset) => {
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + offset * 7);
    setWeekStart(nextWeek);
    setFocusedSessionId("");
    await refreshDetail(selected, nextWeek);
  };

  // Fermeture au clavier (Échap) tant que le modal est ouvert
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  // Focus sur le premier champ à l'ouverture
  useEffect(() => {
    if (modalOpen) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [modalOpen]);

  const openCreateSchedule = () => {
    setScheduleLevel(user.role === "level_admin"
      ? user.level?._id || user.level?.id || user.level || ""
      : "");
    setPublicationIntent("draft");
    setError("");
    setScheduleModalOpen(true);
  };

  const create = async (e) => {
    e.preventDefault();
    if (!scheduleLevel) {
      setError("Sélectionnez le niveau de destination.");
      return;
    }
    setCreatingSchedule(true);
    try {
      const schedule = await api.post("/schedules", { level: scheduleLevel, publicationIntent });
      setSelected(schedule._id);
      setSchedules((list) => [schedule, ...list]);
      setScheduleModalOpen(false);
      await refreshDetail(schedule._id);
      setMessage(publicationIntent === "publish"
        ? "Brouillon du SP créé. Ajoutez les séances puis publiez directement."
        : "Emploi du temps enregistré en brouillon.");
    } catch (e) {
      setError(e.message);
    } finally {
      setCreatingSchedule(false);
    }
  };

  const doctorsForSubject = (subjectId) => {
    if (!subjectId) return catalog.doctors;
    const subject = catalog.subjects.find((item) => item._id === subjectId);
    const doctorIds = (subject?.doctors || []).map((doctor) => doctor?._id || doctor);
    return doctorIds.length ? catalog.doctors.filter((doctor) => doctorIds.includes(doctor._id)) : catalog.doctors;
  };

  const chooseSubject = (id) => {
    const subject = catalog.subjects.find((s) => s._id === id);
    const stillValidDoctor = doctorsForSubject(id).some((d) => d._id === form.doctor);
    setForm((f) => ({
      ...f,
      subject: id,
      subjectName: subject?.name || f.subjectName,
      doctor: stillValidDoctor ? f.doctor : "",
    }));
  };

  // --- Ouverture / fermeture du modal ---
  const openCreate = () => {
    setEditingSessionId(null);
    setForm(blank);
    setModalConflicts([]);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (session) => {
    setEditingSessionId(session._id);
    setForm({
      subjectName: session.subjectName,
      subject: session.subject?._id || session.subject || "",
      doctor: session.doctor?._id || session.doctor || "",
      room: session.room?._id || session.room || "",
      startsAt: toLocalInput(session.startsAt),
      endsAt: toLocalInput(session.endsAt),
      type: session.type || "course",
    });
    setModalConflicts([]);
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSessionId(null);
    setForm(blank);
    setModalConflicts([]);
    setSaving(false);
  };

  const saveSession = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    setModalConflicts([]);

    try {
      const payload = {
        ...form,
        subject: form.subject || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      };

      const result = editingSessionId
        ? await api.patch(
            `/schedules/${selected}/sessions/${editingSessionId}`,
            payload,
          )
        : await api.post(`/schedules/${selected}/sessions`, payload);

      const returnedConflicts = result.conflicts || [];
      setConflicts(returnedConflicts);
      const updatedSession = result.session;
      const updatedWeek = updatedSession ? getWeekStart(updatedSession.startsAt) : weekStart;
      setWeekStart(updatedWeek);
      setFocusedSessionId(updatedSession?._id || "");
      await refreshDetail(selected, updatedWeek);

      if (returnedConflicts.length) {
        setEditingSessionId(result.session?._id || editingSessionId);
        setModalConflicts(returnedConflicts);
        setMessage("Séance enregistrée avec une alerte de conflit à résoudre.");
        setSaving(false);
        return;
      }

      setMessage(editingSessionId ? "Séance enregistrée." : "Créneau ajouté.");
      closeModal();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const removeSession = async (sessionId) => {
    if (!window.confirm("Supprimer cette séance ?")) return;

    try {
      await api.delete(`/schedules/${selected}/sessions/${sessionId}`);
      setMessage("Séance supprimée.");
      setError("");
      await refreshDetail(selected);
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async () => {
    try {
      await api.post(`/schedules/${selected}/submit`, {});
      setMessage("Proposition transmise au secrétariat.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const publishDirectly = async () => {
    try {
      await api.post(`/schedules/${selected}/publish`, {});
      setMessage("Emploi du temps publié directement par le secrétariat principal.");
      await load();
    } catch (e) {
      setError(e.message);
      setConflicts(e.payload?.conflicts || []);
    }
  };

  const openConflictingSchedule = async (scheduleId, sessionId) => {
    setSelected(scheduleId);
    closeModal();
    const scheduleDetail = await api.get(`/schedules/${scheduleId}`);
    const target = scheduleDetail.sessions.find((session) => session._id === sessionId) || scheduleDetail.sessions[0];
    const targetWeek = target ? getWeekStart(target.startsAt) : getWeekStart();
    setWeekStart(targetWeek);
    setFocusedSessionId(target?._id || "");
    await refreshDetail(scheduleId, targetWeek);
  };

  const editable = Boolean(detail && (user.role === "principal_admin"
    ? detail.schedule.status !== "published"
    : ["draft", "returned"].includes(detail.schedule.status)) && weekStart >= getWeekStart());
  const currentConflictSession = getCurrentSessionFacts(form, detail?.schedule?.level?.name, catalog.doctors, catalog.rooms);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{user.role === "principal_admin" ? "GESTION DES EMPLOIS DU TEMPS" : "CONSTRUCTION"}</p>
          <h1>{user.role === "principal_admin" ? "Gérer les propositions" : "Proposer un emploi du temps"}</h1>
          <p className="muted">
            {user.role === "principal_admin" ? "Modifiez une proposition existante, avec détection immédiate des conflits." : "Chaque changement est vérifié dès son enregistrement."}
          </p>
        </div>
        <div className="header-actions">
          <select
            value={selected}
            onChange={async (e) => {
              const next = e.target.value;
              setSelected(next);
              closeModal();
              if (next) await refreshDetail(next);
            }}
          > 
            <option value="">Choisir une proposition</option>
            {schedules.map((s) => (
              <option key={s._id} value={s._id}>
                {s.level?.name} · {s.status}
              </option>
            ))}
          </select>
          {(user.role === "level_admin" || user.role === "principal_admin") && <button className="primary" onClick={openCreateSchedule}>
            <Plus size={17} /> Nouvelle proposition
          </button>}
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}
      {conflicts.length > 0 && !modalOpen && <ConflictDetails conflicts={conflicts} onOpenSchedule={user.role === "principal_admin" ? openConflictingSchedule : undefined} />}

      {selected ? (
        <div className="builder-preview" style={{ width: "100%" }}>
          <div className="section-heading">
            <div>
              <h2>{detail?.schedule.level?.name}</h2>
              <span className={`status ${detail?.schedule.status}`}>
                {detail?.schedule.status}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {editable && <button className="secondary" onClick={openCreate}>
                <Plus size={16} /> Ajouter une séance
              </button>}
              {user.role === "principal_admin" && detail?.schedule.status === "draft" && detail?.schedule.createdBy?.role === "principal_admin" && (
                <button className="primary" onClick={publishDirectly}>
                  <Send size={16} /> Publier directement
                </button>
              )}
              {user.role === "level_admin" && ["draft", "returned"].includes(detail?.schedule.status) && (
                <button className="primary" onClick={submit}>
                  <Send size={16} /> Soumettre
                </button>
              )}
            </div>
          </div>

          <div className="session-list">
            {detail?.sessions?.map((session) => (
              <div
                className="session-row"
                key={session._id}
                onDoubleClick={editable ? () => openEdit(session) : undefined}
                onKeyDown={editable ? (e) => e.key === "Enter" && openEdit(session) : undefined}
                tabIndex={editable ? 0 : undefined}
                role={editable ? "button" : undefined}
                title={editable ? "Double-cliquez pour modifier" : undefined}
                style={{ cursor: editable ? "pointer" : "default" }}
              >
                <div>
                  <strong>{session.subjectName}</strong>
                  <span>
                    {fmt(session.startsAt)} – {fmt(session.endsAt)}
                    {"  ·  "}
                    {session.room?.name} {session.doctor?.firstName
                      ? `· ${session.doctor.firstName} ${session.doctor.lastName}`
                      : ""}
                    {"  ·  "}
                    {typeLabel[session.type] || session.type}
                  </span>
                </div>
                {editable && <div className="session-row-actions">
                  <button type="button" className="session-edit-button" onClick={() => openEdit(session)} aria-label={`Modifier ${session.subjectName}`} title="Modifier ce créneau">
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSession(session._id);
                    }}
                  >
                    <Trash2 size={15} /> Supprimer
                  </button>
                </div>}
              </div>
            ))}
            {!detail?.sessions?.length && (
              <div className="empty-state">
                <p className="muted">Aucune séance pour l'instant.</p>
              </div>
            )}
          </div>

          <WeekGrid
            sessions={detail?.sessions || []}
            weekStart={weekStart}
            focusedSessionId={focusedSessionId}
            onWeekChange={changeWeek}
            onSessionDoubleClick={editable ? openEdit : undefined}
          />
        </div>
      ) : (
        <div className="empty">
          <Plus size={28} />
          <p>{user.role === "principal_admin" ? "Sélectionnez une proposition à vérifier." : "Créez une proposition pour commencer."}</p>
        </div>
      )}

      <div
        className={`drawer-overlay ${scheduleModalOpen ? "open" : ""}`}
        onClick={() => setScheduleModalOpen(false)}
      />
      <div className={`form-drawer ${scheduleModalOpen ? "open" : ""}`} role="dialog" aria-modal="true">
        <div className="drawer-header">
          <h2>Créer un emploi du temps</h2>
          <button className="close-btn" onClick={() => setScheduleModalOpen(false)} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">
          <form className="dynamic-form" onSubmit={create}>
            <div className="form-group">
              <label htmlFor="schedule-level">À quel niveau cet emploi du temps est-il destiné ? <span className="req">*</span></label>
              <select id="schedule-level" required value={scheduleLevel} onChange={(e) => setScheduleLevel(e.target.value)} disabled={user.role === "level_admin"}>
                <option value="">Sélectionner un niveau</option>
                {catalog.levels.map((level) => <option key={level._id} value={level._id}>{level.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="publication-intent">Action à la création</label>
              <select id="publication-intent" value={publicationIntent} onChange={(e) => setPublicationIntent(e.target.value)}>
                <option value="draft">Enregistrer en brouillon</option>
                {user.role === "principal_admin" && <option value="publish">Publier directement</option>}
              </select>
            </div>
            <div className="form-actions">
              <button className="primary wide" type="submit" disabled={creatingSchedule}>
                {creatingSchedule ? "Création…" : publicationIntent === "publish" ? "Créer et préparer la publication" : "Enregistrer en brouillon"}
              </button>
              <button className="ghost wide" type="button" onClick={() => setScheduleModalOpen(false)}>Annuler</button>
            </div>
          </form>
        </div>
      </div>

      {/* ===== MODAL D'ÉDITION / CRÉATION ===== */}
      <div
        className={`drawer-overlay ${modalOpen ? "open" : ""}`}
        onClick={closeModal}
      />
      <div className={`form-drawer ${modalOpen ? "open" : ""}`} role="dialog" aria-modal="true">
        <div className="drawer-header">
          <h2>{editingSessionId ? "Modifier la séance" : "Ajouter une séance"}</h2>
          <button className="close-btn" onClick={closeModal} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <ConflictDetails conflicts={modalConflicts} currentSession={currentConflictSession} onOpenSchedule={user.role === "principal_admin" ? openConflictingSchedule : undefined} />

          <form className="dynamic-form" onSubmit={saveSession}>
            <div className="type-selector">
              <div className="field-label">Type de séance</div>
              <div className="type-options">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    className={`type-btn ${form.type === t.value ? "active" : ""}`}
                    onClick={() => setForm({ ...form, type: t.value })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Matière enregistrée</label>
              <select value={form.subject} onChange={(e) => chooseSubject(e.target.value)}>
                <option value="">Saisie directe</option>
                {catalog.subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                Intitulé de la matière <span className="req">*</span>
              </label>
              <input
                ref={firstFieldRef}
                required
                value={form.subjectName}
                onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>
                Enseignant <span className="req">*</span>
              </label>
              <select
                required
                value={form.doctor}
                onChange={(e) => setForm({ ...form, doctor: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {doctorsForSubject(form.subject).map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.firstName} {d.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                Salle <span className="req">*</span>
              </label>
              <select
                required
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {catalog.rooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="two-fields">
              <div className="form-group">
                <label>
                  Début <span className="req">*</span>
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>
                  Fin <span className="req">*</span>
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="primary wide" type="submit" disabled={saving}>
                {saving
                  ? "Enregistrement…"
                  : editingSessionId
                  ? "Enregistrer"
                  : "Ajouter le créneau"}
              </button>
              <button className="ghost wide" type="button" onClick={closeModal}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
