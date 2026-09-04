import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionPlacement, getDayTimeline } from './scheduleUtils.js';

test('compute placement for real session durations', () => {
  const startsAt = new Date(2026, 0, 5, 8, 0);
  const endsAt = new Date(2026, 0, 5, 12, 0);
  const session = {
    startsAt,
    endsAt,
    room: { name: 'A101' },
    doctor: { firstName: 'Alice', lastName: 'Durand' },
    subjectName: 'Maths',
    type: 'course',
  };

  const placement = getSessionPlacement(session, startsAt);
  assert.equal(placement.top, 60);
  assert.equal(placement.height, 240);
  assert.equal(placement.startLabel, '08:00');
  assert.equal(placement.endLabel, '12:00');
});

test('build a timeline with a pause interval', () => {
  const day = new Date(2026, 0, 5, 0, 0);
  const timeline = getDayTimeline(
    [
      { startsAt: new Date(2026, 0, 5, 8, 0), endsAt: new Date(2026, 0, 5, 12, 0) },
      { startsAt: new Date(2026, 0, 5, 12, 30), endsAt: new Date(2026, 0, 5, 14, 0) },
    ],
    day,
  );

  assert.equal(timeline.startHour, 7);
  assert.equal(timeline.endHour, 21);
  assert.equal(timeline.blocks.length, 5);
  assert.equal(timeline.blocks[2].type, 'pause');
  assert.equal(timeline.blocks[2].startHour, 12);
  assert.equal(timeline.blocks[2].endHour, 12.5);
});
