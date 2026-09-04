import { Session } from '../models/index.js';

const toDate = (value) => value instanceof Date ? value : new Date(value);
const identifier = (value) => value?.id || value?._id || value?.toString();

export const sameCalendarDay = (left, right) => {
  const start = toDate(left);
  const end = toDate(right);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  return startKey === endKey;
};

export const hasTimeOverlap = (leftStart, leftEnd, rightStart, rightEnd) => {
  const startA = toDate(leftStart);
  const endA = toDate(leftEnd);
  const startB = toDate(rightStart);
  const endB = toDate(rightEnd);

  if ([startA, endA, startB, endB].some((value) => Number.isNaN(value.getTime()))) return false;
  return sameCalendarDay(startA, startB)
    && startA.getTime() < endB.getTime()
    && startB.getTime() < endA.getTime();
};

const resourceMatches = (session, reference, field) => {
  const a = identifier(session?.[field]);
  const b = identifier(reference?.[field]);
  return a && b && a.toString() === b.toString();
};

const overlapFilter = (session, reference) => {
  if (!session || !reference) return false;
  const sameDay = sameCalendarDay(session.startsAt, reference.startsAt);
  if (!sameDay) return false;
  return session.startsAt.getTime() < new Date(reference.endsAt).getTime()
    && new Date(reference.startsAt).getTime() < session.endsAt.getTime();
};

export const findRoomConflicts = async ({ room, startsAt, endsAt, excludeSessionId }) => {
  const sessions = await Session.find({ room, startsAt: { $lt: new Date(endsAt) }, endsAt: { $gt: new Date(startsAt) } })
    .populate('level', 'name code')
    .populate('room', 'name')
    .populate('schedule', 'status');

  return sessions.filter((session) => {
    if (session.id === excludeSessionId?.toString()) return false;
    return overlapFilter(session, { startsAt, endsAt });
  });
};

export const findSessionConflicts = async ({ room, doctor, level, startsAt, endsAt, excludeSessionId }) => {
  const sessions = await Session.find({
    $or: [{ room }, { doctor }, { level }],
  })
    .populate('level', 'name code')
    .populate('room', 'name')
    .populate('doctor', 'firstName lastName')
    .populate('schedule', 'status');

  return sessions.filter((session) => {
    if (session.id === excludeSessionId?.toString()) return false;
    if (!overlapFilter(session, { startsAt, endsAt })) return false;

    return [
      resourceMatches(session, { room }, 'room'),
      resourceMatches(session, { doctor }, 'doctor'),
      resourceMatches(session, { level }, 'level'),
    ].some(Boolean);
  });
};

export const conflictPayload = (sessions, reference) => sessions.map((session) => {
  const conflictTypes = reference ? [
    resourceMatches(session, reference, 'room') && 'room',
    resourceMatches(session, reference, 'doctor') && 'doctor',
    resourceMatches(session, reference, 'level') && 'level',
  ].filter(Boolean) : [];

  return {
    sessionId: session.id,
    scheduleId: identifier(session.schedule),
    levelId: identifier(session.level),
    level: session.level?.name || 'Niveau inconnu',
    subjectName: session.subjectName,
    room: session.room?.name || 'Salle inconnue',
    teacher: session.doctor ? `${session.doctor.firstName} ${session.doctor.lastName}`.trim() : 'Enseignant inconnu',
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    type: session.type,
    scheduleStatus: session.schedule?.status,
    conflictTypes,
  };
});
