export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 21;
export const PIXELS_PER_HOUR = 60;

const toDate = (value) => new Date(value);
const toMinutes = (value) => {
  const date = toDate(value);
  return date.getHours() * 60 + date.getMinutes();
};

const toLabel = (value) => {
  const date = toDate(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const dayKey = (value) => {
  const date = toDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const getWeekStart = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
};

export const getWeekEnd = (value = new Date()) => {
  const end = getWeekStart(value);
  end.setDate(end.getDate() + 7);
  return end;
};

export const getSessionPlacement = (session, dayValue) => {
  const startMinutes = toMinutes(session.startsAt);
  const endMinutes = toMinutes(session.endsAt);
  const dayStartMinutes = GRID_START_HOUR * 60;
  const totalMinutes = Math.max(endMinutes - startMinutes, 30);

  return {
    top: Math.max(0, ((startMinutes - dayStartMinutes) / 60) * PIXELS_PER_HOUR),
    height: Math.max((totalMinutes / 60) * PIXELS_PER_HOUR, 36),
    startLabel: toLabel(session.startsAt),
    endLabel: toLabel(session.endsAt),
    durationMinutes: totalMinutes,
    dayValue,
  };
};

export const getDayTimeline = (sessions = [], dayValue) => {
  const day = new Date(dayValue);
  const dayIso = dayKey(day);

  const sorted = [...sessions]
    .filter((session) => dayKey(session.startsAt) === dayIso)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  const blocks = [];
  let cursor = new Date(day);
  cursor.setHours(GRID_START_HOUR, 0, 0, 0);

  for (const session of sorted) {
    const startsAt = toDate(session.startsAt);
    const endsAt = toDate(session.endsAt);
    const gapMinutes = (startsAt - cursor) / 60000;

    if (gapMinutes > 0) {
      blocks.push({
        type: 'pause',
        start: new Date(cursor),
        end: new Date(startsAt),
        startHour: cursor.getHours() + cursor.getMinutes() / 60,
        endHour: startsAt.getHours() + startsAt.getMinutes() / 60,
        top: Math.max(0, ((cursor.getHours() * 60 + cursor.getMinutes() - GRID_START_HOUR * 60) / 60) * PIXELS_PER_HOUR),
        height: Math.max((gapMinutes / 60) * PIXELS_PER_HOUR, 8),
      });
    }

    const placement = getSessionPlacement(session, dayValue);
    blocks.push({
      type: 'session',
      session,
      ...placement,
      start: startsAt,
      end: endsAt,
    });

    cursor = new Date(endsAt);
  }

  const dayEnd = new Date(day);
  dayEnd.setHours(GRID_END_HOUR, 0, 0, 0);

  if (cursor < dayEnd) {
    const remainingMinutes = (dayEnd - cursor) / 60000;
    if (remainingMinutes > 0) {
      blocks.push({
        type: 'pause',
        start: new Date(cursor),
        end: new Date(dayEnd),
        startHour: cursor.getHours() + cursor.getMinutes() / 60,
        endHour: dayEnd.getHours() + dayEnd.getMinutes() / 60,
        top: Math.max(0, ((cursor.getHours() * 60 + cursor.getMinutes() - GRID_START_HOUR * 60) / 60) * PIXELS_PER_HOUR),
        height: Math.max((remainingMinutes / 60) * PIXELS_PER_HOUR, 8),
      });
    }
  }

  return {
    startHour: GRID_START_HOUR,
    endHour: GRID_END_HOUR,
    blocks: blocks.sort((a, b) => new Date(a.start || a.session?.startsAt) - new Date(b.start || b.session?.startsAt)),
  };
};
