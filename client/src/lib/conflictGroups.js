const isoKey = (value) => {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

const getConflictResource = (conflict) => {
  const types = Array.isArray(conflict.conflictTypes) && conflict.conflictTypes.length ? conflict.conflictTypes : ['room'];
  const resourceType = types[0] || 'room';
  if (resourceType === 'doctor') return { resourceType, resource: conflict.teacher || 'Enseignant inconnu' };
  if (resourceType === 'level') return { resourceType, resource: conflict.level || 'Niveau inconnu' };
  return { resourceType: 'room', resource: conflict.room || 'Salle inconnue' };
};

const normalizeConflictKey = (conflict) => {
  const start = isoKey(conflict.startsAt);
  const end = isoKey(conflict.endsAt);
  const { resourceType, resource } = getConflictResource(conflict);
  return `${resourceType}|${resource}|${start}|${end}`;
};

const parseLocalText = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export function buildConflictGroups(conflicts = []) {
  const map = new Map();

  for (const conflict of conflicts) {
    const { resourceType, resource } = getConflictResource(conflict);
    const key = normalizeConflictKey(conflict);
    if (!map.has(key)) {
      map.set(key, {
        key,
        resourceType,
        resource,
        startsAt: conflict.startsAt,
        endsAt: conflict.endsAt,
        dateLabel: parseLocalText(conflict.startsAt),
        members: [],
        memberIds: new Set(),
      });
    }

    const group = map.get(key);
    const memberKey = `${conflict.scheduleId || 'unknown'}:${conflict.sessionId || 'unknown'}:${conflict.level || 'unknown'}`;
    if (!group.memberIds.has(memberKey)) {
      group.memberIds.add(memberKey);
      group.members.push({
        ...conflict,
        scheduleId: conflict.scheduleId || null,
        sessionId: conflict.sessionId || null,
        level: conflict.level || 'Niveau inconnu',
        subjectName: conflict.subjectName || 'Matière inconnue',
        teacher: conflict.teacher || 'Enseignant inconnu',
        room: conflict.room || 'Salle inconnue',
      });
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      memberCount: group.members.length,
      levels: [...new Set(group.members.map((item) => item.level).filter(Boolean))],
      rooms: [...new Set(group.members.map((item) => item.room).filter(Boolean))],
      teachers: [...new Set(group.members.map((item) => item.teacher).filter(Boolean))],
    }))
    .sort((a, b) => new Date(a.startsAt || 0) - new Date(b.startsAt || 0));
}

export function summarizeConflictGroups(conflicts = []) {
  const groups = buildConflictGroups(conflicts);
  return {
    totalConflicts: conflicts.length,
    totalGroups: groups.length,
    rooms: new Set(groups.flatMap((group) => group.rooms)),
    levels: new Set(groups.flatMap((group) => group.levels)),
    slots: new Set(groups.map((group) => `${group.resource}|${group.startsAt}|${group.endsAt}`)),
  };
}
