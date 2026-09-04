import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Search } from 'lucide-react';
import { buildConflictGroups, summarizeConflictGroups } from '../lib/conflictGroups';

const typeLabels = { room: 'Salle', doctor: 'Enseignant', level: 'Niveau' };
const sessionLabels = { course: 'Cours', tutorial: 'TD', lab: 'TP', exam: 'Examen', quiz: 'Interrogation', other: 'Séance' };
const dateTime = (value) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

function SessionFacts({ session }) {
  return <dl className="conflict-facts">
    <div><dt>Niveau</dt><dd>{session.level || 'Votre niveau'}</dd></div>
    <div><dt>Matière</dt><dd>{session.subjectName}</dd></div>
    <div><dt>Enseignant</dt><dd>{session.teacher || 'À confirmer'}</dd></div>
    <div><dt>Salle</dt><dd>{session.room || 'À confirmer'}</dd></div>
    <div><dt>Horaire</dt><dd>{session.startsAt ? `${dateTime(session.startsAt)} – ${new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(session.endsAt))}` : 'À confirmer'}</dd></div>
    <div><dt>Type</dt><dd>{sessionLabels[session.type] || session.type || 'Séance'}</dd></div>
  </dl>;
}

export function ConflictDetails({ conflicts = [], currentSession, onOpenSchedule }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setPage(1);
  }, [query, resourceFilter, conflicts.length]);

  const groups = useMemo(() => buildConflictGroups(conflicts), [conflicts]);
  const summary = useMemo(() => summarizeConflictGroups(conflicts), [conflicts]);
  const primaryGroup = groups[0];
  const primaryType = primaryGroup ? typeLabels[primaryGroup.resourceType] || 'Ressource' : 'Conflit';

  const resourceOptions = useMemo(
    () => ['all', ...Array.from(new Set(groups.flatMap((group) => group.rooms)))],
    [groups],
  );

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    return groups.filter((group) => {
      const matchesResource = resourceFilter === 'all' || group.rooms.includes(resourceFilter) || group.resource === resourceFilter;
      const haystack = [
        group.resource,
        group.levels.join(' '),
        group.teachers.join(' '),
        group.dateLabel,
        group.members.map((member) => `${member.level} ${member.subjectName} ${member.teacher}`).join(' '),
      ].join(' ').toLowerCase();
      const matchesQuery = !term || haystack.includes(term);
      return matchesResource && matchesQuery;
    });
  }, [groups, query, resourceFilter]);

  const visibleGroups = filteredGroups.slice(0, page * pageSize);
  const hasMore = visibleGroups.length < filteredGroups.length;

  if (!conflicts.length) return null;

  return <section className="conflict-panel" aria-live="polite">
    <div className="conflict-header">
      <div className="conflict-title">
        <AlertTriangle size={18} />
        <div>
          <strong>{primaryGroup ? `${primaryType} · ${primaryGroup.resource}` : 'Conflit détecté'}</strong>
          <p>{summary.totalGroups} groupe(s) de conflit · {summary.totalConflicts} conflit(s) détecté(s) · {summary.rooms.size} salle(s) · {summary.levels.size} niveau(x)</p>
        </div>
      </div>
      <button type="button" className="secondary compact" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <><ChevronUp size={15} /> Masquer</> : <><ChevronDown size={15} /> Afficher les conflits</>}
      </button>
    </div>

    {!expanded && primaryGroup && <div className="conflict-summary-strip">
      <span><strong>{primaryType}</strong> · {primaryGroup.resource}</span>
      <span><strong>{primaryGroup.memberCount}</strong> emplois</span>
      <span><strong>{primaryGroup.dateLabel}</strong></span>
      <span>{new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(primaryGroup.startsAt))}–{new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(primaryGroup.endsAt))}</span>
    </div>}

    {expanded && <div className="conflict-list-shell">
      <div className="conflict-toolbar">
        <label className="conflict-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un niveau, une salle, un enseignant..." />
        </label>
        <select value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value)}>
          <option value="all">Toutes les salles</option>
          {resourceOptions.filter((option) => option !== 'all').map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {filteredGroups.length === 0 ? <div className="conflict-empty">Aucun conflit ne correspond à ce filtre.</div> : (
        <div className="conflict-group-list">
          {visibleGroups.map((group) => {
            const isOpen = group.key === expanded;
            return <article className="conflict-group-card" key={group.key}>
              <div className="conflict-group-header">
                <div>
                  <div className="conflict-group-kicker">{typeLabels[group.resourceType] || 'Ressource'} · {group.resource}</div>
                  <strong>{group.dateLabel}</strong>
                </div>
                <div className="conflict-group-header-meta">
                  <span>{group.memberCount} emploi(s) du temps</span>
                  <button type="button" className="secondary compact" onClick={() => setExpanded((value) => value === group.key ? null : group.key)}>
                    {isOpen ? 'Fermer' : 'Voir les détails'}
                  </button>
                </div>
              </div>

              <div className="conflict-group-body">
                <div className="conflict-group-range">
                  <span>Début : {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(group.startsAt))}</span>
                  <span>Fin : {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(group.endsAt))}</span>
                </div>
                <div className="conflict-group-tags">
                  {group.levels.slice(0, 6).map((level) => <span key={level}>{level}</span>)}
                  {group.levels.length > 6 && <span>+{group.levels.length - 6}</span>}
                </div>
              </div>

              {isOpen && <div className="conflict-group-details">
                {currentSession ? <div className="conflict-compare"><div><strong>Votre séance</strong><SessionFacts session={currentSession} /></div><div><strong>Emplois déjà présents</strong>{group.members.map((member) => <div className="conflict-member" key={`${member.scheduleId || member.sessionId}-${member.level}`}>
                  <div className="conflict-member-header"><strong>{member.subjectName}</strong><span>{member.level}</span></div>
                  <SessionFacts session={member} />
                  {onOpenSchedule && member.scheduleId && <button className="secondary compact" onClick={() => onOpenSchedule(member.scheduleId, member.sessionId)}><ExternalLink size={15} /> Voir le planning</button>}
                </div>)}</div></div> : group.members.map((member) => <div className="conflict-member" key={`${member.scheduleId || member.sessionId}-${member.level}`}>
                  <div className="conflict-member-header"><strong>{member.subjectName}</strong><span>{member.level}</span></div>
                  <SessionFacts session={member} />
                  {onOpenSchedule && member.scheduleId && <button className="secondary compact" onClick={() => onOpenSchedule(member.scheduleId, member.sessionId)}><ExternalLink size={15} /> Voir le planning</button>}
                </div>)}
              </div>}
            </article>;
          })}
        </div>
      )}

      {filteredGroups.length > visibleGroups.length && <div className="conflict-pagination">
        <button type="button" className="secondary" onClick={() => setPage((value) => value + 1)}>Afficher plus</button>
      </div>}
    </div>}
  </section>;
}

export const getCurrentSessionFacts = (form, levelName, doctors = [], rooms = []) => ({
  level: levelName,
  subjectName: form.subjectName,
  teacher: (() => { const doctor = doctors.find((item) => item._id === form.doctor); return doctor ? `${doctor.firstName} ${doctor.lastName}` : ''; })(),
  room: rooms.find((item) => item._id === form.room)?.name || '',
  startsAt: form.startsAt,
  endsAt: form.endsAt,
  type: form.type,
});
